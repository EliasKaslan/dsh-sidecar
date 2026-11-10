/** Per-session side-question thread: local persistence, polling and abort. */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  SidecarRpcError,
  type SidecarErrorBody,
  type SidecarHistoryItem,
  type SidecarRpc,
} from './rpc'

export interface ThreadItem {
  id: string
  question: string
  answer: string
  state: 'running' | 'done' | 'error' | 'cancelled'
  error: SidecarErrorBody | null
  jobId: string | null
  cursor: number
  createdAt: number
  endedAt: number | null
  model: string | null
  usage: unknown
}

const STORAGE_PREFIX = 'dsh-sidecar.thread.v1.'
const MAX_ITEMS = 40
const MAX_PERSIST_CHARS = 120_000
const POLL_INTERVAL_MS = 260

function storageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId}`
}

function makeId(): string {
  try {
    return globalThis.crypto.randomUUID()
  } catch {
    return `sc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}

function asItem(value: any): ThreadItem | null {
  if (value === null || typeof value !== 'object') return null
  if (typeof value.id !== 'string' || typeof value.question !== 'string') return null
  const state = value.state === 'done' || value.state === 'error' || value.state === 'cancelled'
    ? value.state
    : 'error'
  const error = value.error !== null && typeof value.error === 'object' && typeof value.error.code === 'string'
    ? { code: value.error.code, message: String(value.error.message ?? '') }
    : null
  return {
    id: value.id,
    question: value.question,
    answer: typeof value.answer === 'string' ? value.answer : '',
    state,
    error,
    jobId: typeof value.jobId === 'string' ? value.jobId : null,
    cursor: Number.isSafeInteger(value.cursor) ? value.cursor : 0,
    createdAt: Number.isFinite(value.createdAt) ? value.createdAt : Date.now(),
    endedAt: Number.isFinite(value.endedAt) ? value.endedAt : null,
    model: typeof value.model === 'string' ? value.model : null,
    usage: value.usage ?? null,
  }
}

function restore(sessionId: string): ThreadItem[] {
  try {
    const raw = localStorage.getItem(storageKey(sessionId))
    if (raw === null) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.items)) return []
    const items = (parsed.items as unknown[]).map((value) => asItem(value)).filter((item): item is ThreadItem => item !== null)
    // A job that was still running when the page went away cannot be resumed
    // without its id; mark it interrupted instead of pretending it is live.
    return items.map((item) => {
      if (item.state !== 'running') return item
      if (item.jobId !== null) return item
      return {
        ...item,
        state: 'error' as const,
        error: { code: 'sidecar/interrupted', message: 'the previous side question was interrupted' },
        endedAt: item.endedAt ?? Date.now(),
      }
    })
  } catch {
    return []
  }
}

function persist(sessionId: string, items: ThreadItem[]): void {
  try {
    const kept: ThreadItem[] = []
    let chars = 0
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index]
      const cost = item.question.length + item.answer.length + 160
      if (kept.length >= MAX_ITEMS) break
      if (chars + cost > MAX_PERSIST_CHARS && kept.length > 0) break
      kept.push(item)
      chars += cost
    }
    localStorage.setItem(
      storageKey(sessionId),
      JSON.stringify({ version: 1, updatedAt: Date.now(), items: kept.reverse() }),
    )
  } catch {
    // Storage can be unavailable or full; the panel still works in memory.
  }
}

function historyOf(items: ThreadItem[]): SidecarHistoryItem[] {
  const picked: SidecarHistoryItem[] = []
  let chars = 0
  for (const item of items.slice(-8)) {
    if (item.state === 'running' || item.answer.trim().length === 0) continue
    const question = item.question.trim()
    const answer = item.answer.trim()
    if (question.length === 0 || answer.length === 0) continue
    if (chars + question.length + answer.length > 10_000) break
    picked.push({ role: 'user', text: question }, { role: 'assistant', text: answer })
    chars += question.length + answer.length
  }
  return picked
}

function normalizedError(error: unknown): SidecarErrorBody {
  if (error instanceof SidecarRpcError) return { code: error.code, message: error.message }
  if (error !== null && typeof error === 'object') {
    const value = error as { code?: unknown; message?: unknown }
    return {
      code: typeof value.code === 'string' ? value.code : 'sidecar/transport',
      message: typeof value.message === 'string' ? value.message : String(error),
    }
  }
  return { code: 'sidecar/transport', message: String(error) }
}

export interface SidecarThread {
  items: ThreadItem[]
  activeId: string | null
  ask: (question: string) => void
  stop: () => void
  retry: (item: ThreadItem) => void
  clear: () => void
}

export function useSidecarThread(sessionId: string | undefined, rpc: SidecarRpc): SidecarThread {
  const [items, setItems] = useState<ThreadItem[]>(() => (sessionId === undefined ? [] : restore(sessionId)))
  const [activeId, setActiveId] = useState<string | null>(null)
  const itemsRef = useRef(items)
  const alive = useRef(true)
  const generation = useRef(0)
  const loadedSession = useRef<string | undefined>(sessionId)
  const pollRef = useRef<{ itemId: string; jobId: string; timer: ReturnType<typeof setTimeout> | null; generation: number } | null>(null)
  const askAbort = useRef<AbortController | null>(null)

  itemsRef.current = items

  const patch = useCallback((id: string, update: Partial<ThreadItem>) => {
    setItems((previous) => previous.map((item) => (item.id === id ? { ...item, ...update } : item)))
  }, [])

  const clearTimer = useCallback(() => {
    const current = pollRef.current
    if (current?.timer !== undefined && current.timer !== null) clearTimeout(current.timer)
    pollRef.current = null
  }, [])

  const poll = useCallback(function tick(itemId: string, jobId: string, startCursor: number, expectedGeneration: number) {
    let cursor = startCursor
    const run = async (): Promise<void> => {
      if (!alive.current || generation.current !== expectedGeneration) return
      try {
        const result = await rpc.poll(jobId, cursor)
        if (!alive.current || generation.current !== expectedGeneration) return
        if (result.state === 'missing') {
          patch(itemId, {
            state: 'error',
            error: { code: 'sidecar/job-missing', message: 'this side question is no longer available' },
            endedAt: Date.now(),
          })
          pollRef.current = null
          setActiveId(null)
          return
        }
        setItems((previous) => previous.map((item) => {
          if (item.id !== itemId) return item
          const failed = result.error !== null
          const state = result.done ? (failed ? 'error' : result.state === 'cancelled' ? 'cancelled' : 'done') : 'running'
          return {
            ...item,
            answer: item.answer + result.text,
            cursor: result.cursor,
            model: result.model ?? item.model,
            usage: result.usage ?? item.usage,
            state,
            error: result.error ?? null,
            endedAt: result.done ? Date.now() : null,
          }
        }))
        if (result.done) {
          pollRef.current = null
          setActiveId(null)
          return
        }
        cursor = result.cursor
        const timer = setTimeout(() => { void run() }, POLL_INTERVAL_MS)
        pollRef.current = { itemId, jobId, timer, generation: expectedGeneration }
      } catch (error) {
        if (!alive.current || generation.current !== expectedGeneration) return
        patch(itemId, { state: 'error', error: normalizedError(error), endedAt: Date.now() })
        pollRef.current = null
        setActiveId(null)
      }
    }
    void run()
  }, [patch, rpc])

  const stop = useCallback(() => {
    const current = pollRef.current
    if (current !== null) {
      clearTimer()
      void rpc.cancel(current.jobId).catch(() => {})
      patch(current.itemId, { state: 'cancelled', endedAt: Date.now() })
    }
    const controller = askAbort.current
    if (controller !== null) {
      controller.abort()
      askAbort.current = null
      setItems((previous) => previous.map((item) => (
        item.state === 'running' && item.jobId === null
          ? { ...item, state: 'cancelled', endedAt: Date.now() }
          : item
      )))
    }
    setActiveId(null)
  }, [clearTimer, patch, rpc])

  const ask = useCallback((raw: string) => {
    const question = raw.trim()
    if (question.length === 0 || sessionId === undefined || pollRef.current !== null || askAbort.current !== null) return
    const id = makeId()
    const item: ThreadItem = {
      id,
      question,
      answer: '',
      state: 'running',
      error: null,
      jobId: null,
      cursor: 0,
      createdAt: Date.now(),
      endedAt: null,
      model: null,
      usage: null,
    }
    const generationAtStart = generation.current
    setItems((previous) => [...previous, item])
    setActiveId(id)
    const controller = new AbortController()
    askAbort.current = controller
    void (async () => {
      try {
        const result = await rpc.ask(
          { sessionId, question, history: historyOf(itemsRef.current) },
          controller.signal,
        )
        if (!alive.current || generation.current !== generationAtStart) return
        askAbort.current = null
        patch(id, { jobId: result.jobId, model: result.model })
        pollRef.current = { itemId: id, jobId: result.jobId, timer: null, generation: generationAtStart }
        poll(id, result.jobId, 0, generationAtStart)
      } catch (error) {
        if (!alive.current || generation.current !== generationAtStart) return
        askAbort.current = null
        if (controller.signal.aborted) {
          patch(id, { state: 'cancelled', endedAt: Date.now() })
          setActiveId(null)
          return
        }
        patch(id, { state: 'error', error: normalizedError(error), endedAt: Date.now() })
        setActiveId(null)
      }
    })()
  }, [patch, poll, rpc, sessionId])

  const retry = useCallback((item: ThreadItem) => {
    ask(item.question)
  }, [ask])

  const clear = useCallback(() => {
    stop()
    setItems([])
    if (sessionId !== undefined) {
      try {
        localStorage.removeItem(storageKey(sessionId))
      } catch {
        // ignore
      }
    }
  }, [sessionId, stop])

  // Load the thread for the selected session and resume a job that outlived a
  // reload (the host keeps it for 30 minutes).
  useEffect(() => {
    generation.current += 1
    const currentGeneration = generation.current
    clearTimer()
    askAbort.current?.abort()
    askAbort.current = null
    loadedSession.current = sessionId
    const restored = sessionId === undefined ? [] : restore(sessionId)
    setItems(restored)
    setActiveId(null)
    const resumable = [...restored].reverse().find((item) => item.state === 'running' && item.jobId !== null)
    if (resumable !== undefined && resumable.jobId !== null) {
      setActiveId(resumable.id)
      pollRef.current = { itemId: resumable.id, jobId: resumable.jobId, timer: null, generation: currentGeneration }
      poll(resumable.id, resumable.jobId, resumable.cursor, currentGeneration)
    }
  }, [clearTimer, poll, sessionId])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      generation.current += 1
      clearTimer()
      askAbort.current?.abort()
      askAbort.current = null
    }
  }, [clearTimer])

  useEffect(() => {
    if (sessionId === undefined || loadedSession.current !== sessionId) return
    const handle = setTimeout(() => persist(sessionId, items), 250)
    return () => clearTimeout(handle)
  }, [items, sessionId])

  return { items, activeId, ask, stop, retry, clear }
}
