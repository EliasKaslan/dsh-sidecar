/** Client half of the sidecar protocol; every call is a unary Typert Remote. */

export interface SidecarErrorBody {
  code: string
  message: string
  details?: unknown
}

export class SidecarRpcError extends Error {
  readonly code: string
  readonly details: unknown

  constructor(code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'SidecarRpcError'
    this.code = code
    this.details = details
  }
}

export interface SidecarSummary {
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
  tokens: {
    uncachedInputTokens?: number
    outputTokens?: number
    cacheReadTokens?: number
    cacheWriteTokens?: number
  } | null
  generatedAt: number
}

export interface SidecarAskResult {
  jobId: string
  summary: SidecarSummary
  model: string
}

export interface SidecarPollResult {
  state: 'running' | 'done' | 'error' | 'cancelled' | 'missing'
  text: string
  cursor: number
  done: boolean
  error: SidecarErrorBody | null
  usage: unknown
  model: string | null
}

export interface SidecarHistoryItem {
  role: 'user' | 'assistant'
  text: string
}

export interface SidecarRpc {
  ask(request: {
    sessionId: string
    question: string
    history: SidecarHistoryItem[]
    maxContextChars?: number
  }, signal?: AbortSignal): Promise<SidecarAskResult>
  poll(jobId: string, cursor: number, signal?: AbortSignal): Promise<SidecarPollResult>
  cancel(jobId: string, signal?: AbortSignal): Promise<{ ok: boolean }>
  snapshot(sessionId: string, signal?: AbortSignal): Promise<{ summary: SidecarSummary }>
}

function errorMessage(error: unknown): string {
  if (error !== null && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message
  }
  return String(error)
}

export function createRpc(ctx: any): SidecarRpc {
  const call = async (method: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<any> => {
    const connection = ctx?.connection
    if (connection === undefined || typeof connection.rpc?.call !== 'function') {
      throw new SidecarRpcError('sidecar/no-connection', 'the client connection is not available')
    }
    let result: any
    try {
      result = await connection.rpc.call('/api', `sidecar/${method}`, { args }, signal)
    } catch (error) {
      if (signal?.aborted === true) throw error
      throw new SidecarRpcError('sidecar/transport', errorMessage(error))
    }
    if (result === null || typeof result !== 'object' || result.ok !== true) {
      const body = result?.error ?? {}
      throw new SidecarRpcError(
        typeof body.code === 'string' ? body.code : 'sidecar/failed',
        typeof body.message === 'string' ? body.message : 'the sidecar request failed',
        body.details,
      )
    }
    return result.value
  }

  return {
    ask: (request, signal) => call('ask', { request }, signal),
    poll: (jobId, cursor, signal) => call('poll', { jobId, cursor }, signal),
    cancel: (jobId, signal) => call('cancel', { jobId }, signal),
    snapshot: (sessionId, signal) => call('snapshot', { sessionId }, signal),
  }
}
