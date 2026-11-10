import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSnapshot } from '../lib/index.js'

const OPTIONS = { maxContextChars: 96_000, maxHistoryMessages: 8 }

function text(value) {
  return [{ type: 'text', text: value }]
}

function fixture(overrides = {}) {
  const events = [
    { type: 'system/message', seq: 1, time: 1, data: { message: { content: text('SYSTEM-PROMPT') } } },
    { type: 'developer/message', seq: 2, time: 2, data: { message: { content: text('RUNTIME-CONTEXT') } } },
    { type: 'user/message', seq: 3, time: 3, data: { content: text('first question') } },
    {
      type: 'assistant/message',
      seq: 4,
      time: 4,
      data: {
        message: {
          content: [
            { type: 'text', text: 'calling a tool' },
            { type: 'tool-call', id: 'call-1', name: 'read', arguments: '{"path":"a.txt"}' },
          ],
        },
      },
    },
    {
      type: 'tool/result',
      seq: 5,
      time: 5,
      data: { message: { role: 'tool', toolCallId: 'call-1', content: text('FILE-BODY') } },
    },
    { type: 'assistant/message', seq: 6, time: 6, data: { message: { content: text('final answer') } } },
  ]
  const surface = { session: { id: 'session-1', cwd: '/tmp/work', agentPreset: 'default' }, capturedThroughSeq: 6, events }
  const lease = {
    source: 'live',
    header: { id: 'session-1' },
    events: [
      ...events,
      { type: 'request/context', seq: 7, time: 7, data: { provider: 'p', model: 'm', contextWindow: 1000 } },
      { type: 'todo/write', seq: 8, time: 8, data: { todos: [{ content: 'ship it', status: 'completed' }, { content: 'test it', status: 'in_progress' }] } },
    ],
    projections: {
      values: {
        tokenUsage: { uncachedInputTokens: 10, outputTokens: 5, cacheReadTokens: 2, cacheWriteTokens: 1 },
        contextPressure: { contextWindow: 1000, projectedTokens: 15 },
      },
    },
  }
  const ctx = {
    sessionQuery: {
      readSurface: async () => surface,
      readSession: async () => surface,
      observeSession: async () => lease,
    },
    sessions: { get: () => undefined },
    agents: { get: () => undefined },
    ...overrides,
  }
  return { ctx, events, surface, lease }
}

test('renders system, developer, tool call and tool result', async () => {
  const { ctx } = fixture()
  const snapshot = await buildSnapshot(ctx, 'session-1', OPTIONS)
  assert.match(snapshot.text, /SYSTEM-PROMPT/)
  assert.match(snapshot.text, /RUNTIME-CONTEXT/)
  assert.match(snapshot.text, /\[tool call\] read\(/)
  assert.match(snapshot.text, /tool result: read/)
  assert.match(snapshot.text, /FILE-BODY/)
  assert.match(snapshot.text, /## Todos/)
  assert.match(snapshot.text, /\[x\] ship it/)
  assert.match(snapshot.text, /\[~\] test it/)
  assert.equal(snapshot.summary.live, true)
  assert.equal(snapshot.summary.provider, 'p')
  assert.equal(snapshot.summary.model, 'm')
  assert.equal(snapshot.summary.contextWindow, 1000)
  assert.equal(snapshot.summary.userMessages, 1)
  assert.equal(snapshot.summary.assistantMessages, 2)
  assert.equal(snapshot.summary.toolResults, 1)
  assert.equal(snapshot.summary.developerMessages, 1)
  assert.deepEqual(snapshot.summary.todos, { total: 2, pending: 0, inProgress: 1, completed: 1 })
  assert.equal(snapshot.summary.tokens.outputTokens, 5)
})

test('does not mutate the event log', async () => {
  const { ctx, events } = fixture()
  const before = JSON.stringify(events)
  await buildSnapshot(ctx, 'session-1', OPTIONS)
  assert.equal(JSON.stringify(events), before)
})

test('truncates old messages and reports how many were omitted', async () => {
  const { ctx, surface } = fixture()
  surface.events = [
    { type: 'system/message', seq: 1, data: { message: { content: text('S') } } },
    ...Array.from({ length: 120 }, (_, index) => ({
      type: index % 2 === 0 ? 'user/message' : 'assistant/message',
      seq: index + 2,
      data: index % 2 === 0
        ? { content: text(`question ${index} ${'x'.repeat(300)}`) }
        : { message: { content: text(`answer ${index} ${'y'.repeat(300)}`) } },
    })),
  ]
  const snapshot = await buildSnapshot(ctx, 'session-1', { maxContextChars: 8_000, maxHistoryMessages: 8 })
  assert.equal(snapshot.summary.truncated, true)
  assert.ok(snapshot.summary.omittedMessages > 0)
  assert.ok(snapshot.text.length <= 8_000 + 2_000)
  assert.match(snapshot.text, /earlier model-visible message/)
  assert.match(snapshot.text, /answer 119/)
})

test('falls back to readSession when readSurface rejects', async () => {
  const { ctx, surface } = fixture()
  ctx.sessionQuery.readSurface = async () => { throw new Error('surface corrupt') }
  ctx.sessionQuery.readSession = async () => surface
  const snapshot = await buildSnapshot(ctx, 'session-1', OPTIONS)
  assert.match(snapshot.text, /FILE-BODY/)
})

test('reports a missing session with a stable code', async () => {
  const ctx = {
    sessionQuery: {
      readSurface: async () => { throw new Error('nope') },
      readSession: async () => { throw new Error('nope') },
    },
  }
  await assert.rejects(
    () => buildSnapshot(ctx, 'missing', OPTIONS),
    (error) => error.code === 'sidecar/session-unavailable',
  )
})

test('rejects an empty session id', async () => {
  const { ctx } = fixture()
  await assert.rejects(
    () => buildSnapshot(ctx, '   ', OPTIONS),
    (error) => error.code === 'sidecar/bad-session',
  )
})

test('marks a prepared (cold) lease as not live', async () => {
  const { ctx, lease } = fixture()
  lease.source = 'prepared'
  const snapshot = await buildSnapshot(ctx, 'session-1', OPTIONS)
  assert.equal(snapshot.summary.live, false)
  assert.match(snapshot.text, /persisted log/)
})
