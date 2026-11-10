/**
 * Read-only projection of one session's model-visible context.
 *
 * Everything here is derived from `ctx.sessionQuery` (the fold the agent loop
 * itself uses) plus optional projections. Nothing is appended, rewritten, or
 * cached inside the session; the returned object is a detached string rendered
 * for one side question.
 */

export interface SnapshotOptions {
  /** Hard character budget for the rendered conversation block. */
  maxContextChars: number
  /** How many side-chat history messages the caller may include. */
  maxHistoryMessages: number
}

export interface SnapshotMessage {
  seq: number
  role: 'user' | 'assistant' | 'tool' | 'context'
  text: string
  toolName?: string
  isError?: boolean
  chars: number
}

export interface SnapshotSummary {
  sessionId: string
  live: boolean
  cwd: string | null
  agentPreset: string | null
  provider: string | null
  model: string | null
  contextWindow: number | null
  userMessages: number
  assistantMessages: number
  toolResults: number
  developerMessages: number
  systemChars: number
  contextChars: number
  totalEvents: number
  capturedThroughSeq: number | null
  omittedMessages: number
  truncated: boolean
  todos: { total: number; pending: number; inProgress: number; completed: number }
  goal: string | null
  compactionSummaries: number
  tokens: { uncachedInputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number } | null
  generatedAt: number
}

export interface Snapshot {
  text: string
  summary: SnapshotSummary
  route: { provider: string; model: string; reasoningEffort?: string } | null
}

export class SnapshotError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'SnapshotError'
    this.code = code
  }
}

const MAX_SYSTEM_CHARS = 24_000
const MAX_ASSISTANT_CHARS = 6_000
const MAX_USER_CHARS = 4_000
const MAX_CONTEXT_CHARS = 3_000
const MAX_TOOL_CHARS = 2_400
const MAX_TOOL_ARG_CHARS = 320
const MIN_BUDGET = 8_000

function textOf(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (block === null || typeof block !== 'object') continue
    const value = block as { type?: unknown; text?: unknown }
    if (value.type === 'text' && typeof value.text === 'string') parts.push(value.text)
  }
  return parts.join('\n').trim()
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(0, max - 24)).trimEnd()}\n…[clipped ${text.length - max} chars]`
}

function oneLine(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  const flat = value.replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`
}

interface ToolCall {
  name: string
  argumentsText: string
}

function assistantParts(content: unknown, calls: Map<string, string>): string {
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (block === null || typeof block !== 'object') continue
    const value = block as {
      type?: unknown
      text?: unknown
      id?: unknown
      name?: unknown
      arguments?: unknown
    }
    if (value.type === 'text' && typeof value.text === 'string') {
      const text = value.text.trim()
      if (text.length > 0) parts.push(text)
      continue
    }
    if (value.type === 'tool-call') {
      const name = typeof value.name === 'string' ? value.name : 'tool'
      const id = typeof value.id === 'string' ? value.id : ''
      if (id.length > 0) calls.set(id, name)
      const args = oneLine(value.arguments, MAX_TOOL_ARG_CHARS)
      parts.push(args.length > 0 ? `[tool call] ${name}(${args})` : `[tool call] ${name}`)
    }
    // Reasoning blocks are intentionally dropped: the side panel never
    // re-exposes private chain-of-thought that the transcript UI also hides.
  }
  return parts.join('\n').trim()
}

function lastEvent(events: Array<{ type?: unknown; data?: unknown }>, type: string): any {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index]?.type === type) return events[index]
  }
  return undefined
}

function renderTodos(todos: unknown): string {
  if (!Array.isArray(todos) || todos.length === 0) return ''
  const lines = todos.slice(0, 20).map((item: any) => {
    const status = item?.status === 'completed' ? 'x' : item?.status === 'in_progress' ? '~' : ' '
    return `- [${status}] ${oneLine(item?.content, 240)}`
  })
  const more = todos.length > 20 ? `\n- … ${todos.length - 20} more` : ''
  return lines.join('\n') + more
}

function summarizeTodos(todos: unknown) {
  const result = { total: 0, pending: 0, inProgress: 0, completed: 0 }
  if (!Array.isArray(todos)) return result
  result.total = todos.length
  for (const item of todos) {
    if (item?.status === 'completed') result.completed += 1
    else if (item?.status === 'in_progress') result.inProgress += 1
    else result.pending += 1
  }
  return result
}

function renderMessages(messages: SnapshotMessage[], budget: number): { block: string; omitted: number } {
  const rendered = messages.map((message) => {
    const label = message.role === 'tool'
      ? `tool result${message.toolName === undefined ? '' : `: ${message.toolName}`}${message.isError === true ? ' (error)' : ''}`
      : message.role
    const header = `### [#${message.seq}] ${label}`
    return `${header}\n${message.text}`
  })

  if (messages.length === 0) return { block: '(no model-visible messages)', omitted: 0 }

  const chosen: number[] = []
  let remaining = budget
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const length = rendered[index].length + 2
    if (chosen.length > 0 && length > remaining) break
    chosen.push(index)
    remaining -= length
  }
  if (chosen.length === 0) chosen.push(messages.length - 1)
  const chosenSet = new Set(chosen)

  // Preserve the opening user request when it still fits: questions such as
  // "what did I originally ask for" are common and cheap to keep.
  const firstUser = messages.findIndex((message) => message.role === 'user')
  if (firstUser >= 0 && !chosenSet.has(firstUser)) {
    const cost = rendered[firstUser].length + 2
    if (cost <= remaining) {
      chosen.push(firstUser)
      chosenSet.add(firstUser)
    }
  }

  const ordered = [...chosen].sort((left, right) => left - right)
  const omitted = messages.length - ordered.length
  const parts = ordered.map((index) => rendered[index])
  if (omitted > 0) {
    parts.unshift(`… ${omitted} earlier model-visible message${omitted === 1 ? '' : 's'} omitted to fit the snapshot budget …`)
  }
  return { block: parts.join('\n\n'), omitted }
}

/**
 * Build one snapshot. The caller owns no session state; this function only
 * reads through the query service and disposes its lease.
 */
export async function buildSnapshot(
  ctx: any,
  sessionId: string,
  options: SnapshotOptions,
): Promise<Snapshot> {
  const query = ctx?.sessionQuery
  if (query === undefined) {
    throw new SnapshotError('sidecar/query-unavailable', 'sessionQuery service is not available')
  }
  if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
    throw new SnapshotError('sidecar/bad-session', 'sessionId must be a non-empty string')
  }

  let surface: any
  try {
    surface = await query.readSurface(sessionId)
  } catch (error) {
    // `readSurface` validates the folded corpus strictly; a log that the live
    // host can still run may fail that validation (older/hand-written events).
    try {
      surface = await query.readSession(sessionId)
    } catch {
      throw new SnapshotError(
        'sidecar/session-unavailable',
        `cannot read session ${JSON.stringify(sessionId)}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  const events: any[] = Array.isArray(surface?.events) ? surface.events : []
  const header = surface?.session ?? {}
  const calls = new Map<string, string>()
  const messages: SnapshotMessage[] = []
  let system = ''
  let userMessages = 0
  let assistantMessages = 0
  let toolResults = 0
  let developerMessages = 0

  for (const event of events) {
    if (event === null || typeof event !== 'object') continue
    const data = event.data ?? {}
    const seq = Number.isSafeInteger(event.seq) ? event.seq : 0
    switch (event.type) {
      case 'system/message': {
        const text = textOf(data?.message?.content)
        if (text.length > 0) system = text
        break
      }
      case 'developer/message': {
        const text = textOf(data?.message?.content)
        if (text.length === 0) break
        developerMessages += 1
        messages.push({
          seq,
          role: 'context',
          text: clip(text, MAX_CONTEXT_CHARS),
          chars: text.length,
        })
        break
      }
      case 'user/message': {
        const text = textOf(data?.content)
        if (text.length === 0) break
        userMessages += 1
        messages.push({ seq, role: 'user', text: clip(text, MAX_USER_CHARS), chars: text.length })
        break
      }
      case 'assistant/message': {
        const content = data?.message?.content
        const text = assistantParts(content, calls)
        if (text.length === 0) break
        assistantMessages += 1
        messages.push({
          seq,
          role: 'assistant',
          text: clip(text, MAX_ASSISTANT_CHARS),
          chars: text.length,
        })
        break
      }
      case 'tool/result': {
        const text = textOf(data?.message?.content)
        if (text.length === 0 && data?.error === undefined) break
        toolResults += 1
        const callId = typeof data?.message?.toolCallId === 'string' ? data.message.toolCallId : ''
        const name = callId.length > 0 ? calls.get(callId) : undefined
        messages.push({
          seq,
          role: 'tool',
          text: clip(text.length > 0 ? text : '(empty result)', MAX_TOOL_CHARS),
          toolName: name,
          isError: data?.error !== undefined || data?.message?.isError === true,
          chars: text.length,
        })
        break
      }
      default:
        break
    }
  }

  // Metadata that lives outside the folded surface: route, usage, todos, goal.
  let lease: any
  let route: { provider: string; model: string; reasoningEffort?: string } | null = null
  let tokens: SnapshotSummary['tokens'] = null
  let todos: unknown
  let goal: unknown
  let contextWindow: number | null = null
  let live = false
  let compactionSummaries = 0

  try {
    // A live session is one the SessionStore still holds; the Agent registry
    // is a second, optional source for the exact route the main loop used.
    const liveSession = ctx?.sessions?.get?.(sessionId)
    const agent = ctx?.agents?.get?.(sessionId)
    live = liveSession !== undefined || agent !== undefined
    const requestContext = agent?.session?.requestContext?.() ?? liveSession?.requestContext?.()
    if (requestContext !== undefined && requestContext !== null) {
      route = {
        provider: String(requestContext.provider ?? ''),
        model: String(requestContext.model ?? ''),
        ...(typeof requestContext.reasoningEffort === 'string'
          ? { reasoningEffort: requestContext.reasoningEffort }
          : {}),
      }
      if (Number.isFinite(requestContext.contextWindow)) contextWindow = Number(requestContext.contextWindow)
    }
  } catch {
    // Routing metadata is best-effort; a snapshot without it is still useful.
  }

  try {
    lease = await query.observeSession(sessionId, { projectionMode: 'all' })
    // `observeSession` is authoritative: a `live` lease means the store still
    // holds the session, even when the Agent registry uses another key.
    if (lease?.source === 'live') live = true
    const values = lease?.projections?.values ?? {}
    if (values.tokenUsage !== null && typeof values.tokenUsage === 'object') tokens = values.tokenUsage
    if (values.todos !== undefined) todos = values.todos
    if (values.goal !== undefined) goal = values.goal
    const pressure = values.contextPressure
    if (contextWindow === null && Number.isFinite(pressure?.contextWindow)) {
      contextWindow = Number(pressure.contextWindow)
    }
    if (route === null) {
      const contextEvent = lastEvent(lease?.events ?? [], 'request/context')
      if (contextEvent !== undefined) {
        route = {
          provider: String(contextEvent.data?.provider ?? ''),
          model: String(contextEvent.data?.model ?? ''),
        }
        if (Number.isFinite(contextEvent.data?.contextWindow)) {
          contextWindow = Number(contextEvent.data.contextWindow)
        }
      }
    }
    const headerEvent = lastEvent(lease?.events ?? [], 'request/header')
    const config = headerEvent?.data?.header?.config
    if (route !== null && route.reasoningEffort === undefined && typeof config?.reasoningEffort === 'string') {
      route.reasoningEffort = config.reasoningEffort
    }
    if (todos === undefined) {
      const todoEvent = lastEvent(lease?.events ?? [], 'todo/write')
      if (todoEvent !== undefined) todos = todoEvent.data?.todos
    }
    if (goal === undefined) {
      const goalEvent = lastEvent(lease?.events ?? [], 'goal/change')
      if (goalEvent !== undefined) goal = goalEvent.data
    }
    for (const event of lease?.events ?? []) {
      if (event?.type === 'compaction/summary') compactionSummaries += 1
    }
    if (route === null && lease?.header?.provider !== undefined) {
      route = { provider: String(lease.header.provider), model: String(lease.header.model ?? '') }
    }
  } catch {
    // Cold sessions without a persistence backend still expose their surface.
  } finally {
    try {
      lease?.[Symbol.dispose]?.()
    } catch {
      // A lease disposal failure must not hide the snapshot.
    }
  }

  const summary = (): SnapshotSummary => ({
    sessionId,
    live,
    cwd: typeof header.cwd === 'string' ? header.cwd : null,
    agentPreset: typeof header.agentPreset === 'string' ? header.agentPreset : null,
    provider: route?.provider ?? null,
    model: route?.model ?? null,
    contextWindow,
    userMessages,
    assistantMessages,
    toolResults,
    developerMessages,
    systemChars: system.length,
    contextChars: 0,
    totalEvents: events.length,
    capturedThroughSeq: Number.isSafeInteger(surface?.capturedThroughSeq) ? surface.capturedThroughSeq : null,
    omittedMessages: 0,
    truncated: false,
    todos: summarizeTodos(todos),
    goal: typeof (goal as { objective?: unknown } | undefined)?.objective === 'string'
      ? String((goal as { objective: string }).objective)
      : null,
    compactionSummaries,
    tokens,
    generatedAt: Date.now(),
  })

  const budget = Math.max(MIN_BUDGET, Number.isFinite(options.maxContextChars) ? options.maxContextChars : 96_000)
  const meta = summary()
  const metaLines = [
    '# Session snapshot (read-only)',
    `- session: ${sessionId}`,
    `- cwd: ${meta.cwd ?? '(unknown)'}`,
    `- state: ${meta.live ? 'agent resident' : 'persisted log (agent not currently resident; this is not an archived session)'}${meta.capturedThroughSeq === null ? '' : `; captured through seq ${meta.capturedThroughSeq}`}`,
    `- model: ${meta.provider ?? '(unknown)'}/${meta.model ?? '(unknown)'}${meta.contextWindow === null ? '' : `; context window ${meta.contextWindow}`}`,
    `- counts: user=${userMessages}, assistant=${assistantMessages}, tool=${toolResults}, context=${developerMessages}`,
    meta.tokens === null
      ? '- token usage: (not projected)'
      : `- token usage: input=${meta.tokens.uncachedInputTokens ?? 0}, output=${meta.tokens.outputTokens ?? 0}, cache-read=${meta.tokens.cacheReadTokens ?? 0}, cache-write=${meta.tokens.cacheWriteTokens ?? 0}`,
    meta.agentPreset === null ? null : `- agent preset: ${meta.agentPreset}`,
    meta.goal === null ? null : `- goal: ${oneLine(meta.goal, 600)}`,
    compactionSummaries === 0 ? null : `- compaction summaries in log: ${compactionSummaries}`,
  ].filter((line): line is string => line !== null)

  const todosText = renderTodos(todos)
  if (todosText.length > 0) metaLines.push('', '## Todos', todosText)

  const systemBlock = system.length === 0
    ? '## System prompt\n(none recorded)'
    : `## System prompt\n${clip(system, MAX_SYSTEM_CHARS)}`

  const fixed = `${metaLines.join('\n')}\n\n${systemBlock}\n\n`
  const conversationBudget = Math.max(1_000, budget - fixed.length)
  const conversation = renderMessages(messages, conversationBudget)
  const text = `${fixed}## Model-visible conversation\n${conversation.block}\n`

  const finalSummary: SnapshotSummary = {
    ...meta,
    contextChars: text.length,
    omittedMessages: conversation.omitted,
    truncated: conversation.omitted > 0 || text.length > budget,
  }

  return { text, summary: finalSummary, route }
}
