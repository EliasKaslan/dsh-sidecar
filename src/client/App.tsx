import * as React from 'react'
import {
  Button,
  IconChevronDownOutlineRegular,
  IconChevronRightOutlineRegular,
  IconContextInjectionOutlineRegular,
  IconCopyOutlineRegular,
  IconPauseOutlineRegular,
  IconPaperPlaneOutlineRegular,
  IconRefreshOutlineRegular,
  IconEnhanceOutlineRegular,
  IconShieldOutlineRegular,
  IconTrashOutlineRegular,
  IconWarningTriangleOutlineRegular,
  MarkdownText,
  Tooltip,
  writeClipboard,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { SidecarErrorBody, SidecarRpc, SidecarSummary } from './rpc'
import { useSidecarThread, type ThreadItem } from './thread'

type Translate = (key: string, params?: Record<string, unknown>) => string

export interface AppProps {
  sessionId: string
  t: Translate
  rpc: SidecarRpc
  useSession?: (selector: (snapshot: any) => unknown) => unknown
}

const SUGGESTIONS = ['suggestion1', 'suggestion2', 'suggestion3', 'suggestion4'] as const

function formatCompact(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`
  return String(Math.round(value))
}

function relativeTime(t: Translate, at: number): string {
  const delta = Math.max(0, Date.now() - at)
  const minutes = Math.floor(delta / 60_000)
  if (minutes < 1) return t('justNow')
  if (minutes < 60) return t('minutesAgo', { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('hoursAgo', { n: hours })
  return t('daysAgo', { n: Math.floor(hours / 24) })
}

function localizeError(t: Translate, error: SidecarErrorBody | null): string {
  if (error === null) return t('askFailed')
  switch (error.code) {
    case 'sidecar/no-model':
      return t('errorNoModel')
    case 'sidecar/session-unavailable':
    case 'sidecar/bad-session':
      return t('errorNoSession')
    case 'sidecar/job-missing':
      return t('errorJobMissing')
    case 'NO_ADAPTER':
      return t('errorNoAdapter')
    case 'MISSING_CREDENTIAL':
    case 'INVALID_CREDENTIAL':
      return t('errorCredential')
    case 'AUTH':
      return t('errorAuth')
    case 'CONTEXT_WINDOW_EXCEEDED':
      return t('errorContext')
    case 'RATE_LIMIT':
    case 'QUOTA':
    case 'ACCOUNT_QUOTA':
      return t('errorRate')
    case 'sidecar/transport':
    case 'sidecar/no-connection':
      return t('errorTransport')
    default:
      return error.message.length > 0 ? error.message : t('askFailed')
  }
}

function copyText(text: string): void {
  void (async () => {
    try {
      await writeClipboard(text)
      return
    } catch {
      // writeClipboard may be unavailable outside a secure context.
    }
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // ignore
    }
  })()
}

function ContextCard(props: {
  t: Translate
  summary: SidecarSummary | null
  state: 'loading' | 'ready' | 'error'
  error: string | null
  onRefresh: () => void
}): React.ReactElement {
  const { t, summary, state, error, onRefresh } = props
  const [expanded, setExpanded] = React.useState(false)
  const total = summary === null
    ? 0
    : summary.userMessages + summary.assistantMessages + summary.toolResults + summary.developerMessages
  const model = summary?.model === null || summary?.model === undefined ? '—' : summary.model
  const modelTitle = summary?.provider === null || summary?.provider === undefined
    ? model
    : `${summary.provider}/${summary.model}`
  const detailId = React.useId()

  return (
    <div className="dsh-sidecar-context" role="group">
      <button
        type="button"
        className="dsh-sidecar-context-toggle"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={() => { setExpanded((value) => !value) }}
      >
        <div className="dsh-sidecar-context-row">
          <span className="dsh-sidecar-dot" data-live={summary?.live === true ? 'true' : 'false'} />
          <span className="dsh-sidecar-model" title={modelTitle}>{model}</span>
          <span className="dsh-sidecar-counts">
            {state === 'loading' && summary === null
              ? t('thinking')
              : `${total} ${t('messages')} · ${formatCompact(summary?.contextChars ?? 0)} ${t('chars')}`}
          </span>
          {expanded
            ? <IconChevronDownOutlineRegular size={13} />
            : <IconChevronRightOutlineRegular size={13} />}
        </div>
        {summary?.truncated === true && (
          <div className="dsh-sidecar-warn">
            <IconWarningTriangleOutlineRegular size={12} />
            <span>{t('truncated')} · {summary.omittedMessages} {t('messages')}</span>
          </div>
        )}
      </button>
      {expanded && (
        <div className="dsh-sidecar-context-detail" id={detailId}>
          {state === 'error' && (
            <div className="dsh-sidecar-warn">
              <IconWarningTriangleOutlineRegular size={12} />
              <span>{t('contextUnavailable')}{error === null ? '' : ` (${error})`}</span>
              <button type="button" className="dsh-sidecar-linkbtn" onClick={onRefresh}>{t('refresh')}</button>
            </div>
          )}
          <dl>
            <dt>{t('context')}</dt>
            <dd>{summary?.live === true ? t('live') : t('archived')}</dd>
            <dt>{t('model')}</dt>
            <dd title={modelTitle}>{modelTitle}</dd>
            <dt>{t('systemPrompt')}</dt>
            <dd>{formatCompact(summary?.systemChars ?? 0)} {t('chars')}</dd>
            <dt>{t('messageBreakdown')}</dt>
            <dd>
              {summary === null ? '—' : `${summary.userMessages} / ${summary.assistantMessages} / ${summary.toolResults}`}
            </dd>
            <dt>{t('captured')}</dt>
            <dd>{summary?.capturedThroughSeq ?? '—'}</dd>
            <dt>{t('todos')}</dt>
            <dd>
              {summary === null || summary.todos.total === 0
                ? '—'
                : `${summary.todos.completed}/${summary.todos.total} (${summary.todos.inProgress} in progress)`}
            </dd>
            {summary?.goal !== null && summary?.goal !== undefined && (
              <React.Fragment>
                <dt>{t('goal')}</dt>
                <dd className="sc-wrap">{summary.goal}</dd>
              </React.Fragment>
            )}
            {summary?.cwd !== null && summary?.cwd !== undefined && (
              <React.Fragment>
                <dt>cwd</dt>
                <dd className="sc-wrap" title={summary.cwd}>{summary.cwd}</dd>
              </React.Fragment>
            )}
            {summary?.tokens !== null && summary?.tokens !== undefined && (
              <React.Fragment>
                <dt>{t('tokenUsage')}</dt>
                <dd>
                  {t('usageIn')} {formatCompact(summary.tokens.uncachedInputTokens ?? 0)} · {t('usageOut')} {formatCompact(summary.tokens.outputTokens ?? 0)}
                </dd>
              </React.Fragment>
            )}
          </dl>
        </div>
      )}
    </div>
  )
}

function EmptyState(props: { t: Translate; onPick: (text: string) => void }): React.ReactElement {
  const { t, onPick } = props
  return (
    <div className="dsh-sidecar-empty">
      <span className="dsh-sidecar-empty-icon">
        <IconContextInjectionOutlineRegular size={22} />
      </span>
      <div className="dsh-sidecar-empty-title">{t('emptyTitle')}</div>
      <div className="dsh-sidecar-empty-body">{t('emptyBody')}</div>
      <div className="dsh-sidecar-suggestions">
        {SUGGESTIONS.map((key) => {
          const text = t(key)
          return (
            <button
              key={key}
              type="button"
              className="dsh-sidecar-suggestion"
              onClick={() => { onPick(text) }}
            >
              <IconEnhanceOutlineRegular size={13} />
              <span>{text}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ResultMeta(props: { t: Translate; item: ThreadItem }): React.ReactElement | null {
  const { t, item } = props
  const usage = item.usage as { uncachedInputTokens?: number; outputTokens?: number } | null
  if (item.state === 'running' && item.answer.length === 0) return null
  const parts: string[] = []
  if (item.model !== null) parts.push(item.model)
  if (usage !== null && typeof usage === 'object') {
    if (Number.isFinite(usage.uncachedInputTokens)) parts.push(`${t('usageIn')} ${formatCompact(usage.uncachedInputTokens ?? 0)}`)
    if (Number.isFinite(usage.outputTokens)) parts.push(`${t('usageOut')} ${formatCompact(usage.outputTokens ?? 0)}`)
  }
  if (item.endedAt !== null) parts.push(relativeTime(t, item.endedAt))
  if (parts.length === 0) return null
  return <div className="dsh-sidecar-result-meta">{parts.map((part, index) => <span key={index}>{part}</span>)}</div>
}

function Turn(props: {
  t: Translate
  item: ThreadItem
  markdownLabels: { code: { copyLabel: string; copiedLabel: string }; footnotes: string }
  onRetry: () => void
}): React.ReactElement {
  const { t, item, markdownLabels, onRetry } = props
  const [copied, setCopied] = React.useState(false)
  const running = item.state === 'running'
  const failed = item.state === 'error'

  const copy = (): void => {
    copyText(item.answer)
    setCopied(true)
    setTimeout(() => { setCopied(false) }, 1600)
  }

  return (
    <div className="dsh-sidecar-turn">
      <div className="dsh-sidecar-q">
        <span className="dsh-sidecar-q-label">{t('you')}</span>
        <div className="dsh-sidecar-q-text">{item.question}</div>
      </div>
      <div className="dsh-sidecar-a">
        <div className="dsh-sidecar-a-head">
          <span className="dsh-sidecar-a-mark"><IconContextInjectionOutlineRegular size={11} /></span>
          <span>{t('assistant')}</span>
          <span className="dsh-sidecar-a-time">{relativeTime(t, item.createdAt)}</span>
          {item.answer.length > 0 && !running && (
            <span className="dsh-sidecar-a-actions">
              <Tooltip label={copied ? t('copied') : t('copyAnswer')} side="top">
                <Button size="sm" variant="ghost" className="dsh-sidecar-iconbtn" aria-label={t('copyAnswer')} onClick={copy}>
                  <IconCopyOutlineRegular size={13} />
                </Button>
              </Tooltip>
            </span>
          )}
        </div>
        {failed ? (
          <div className="dsh-sidecar-error">
            <IconWarningTriangleOutlineRegular size={14} />
            <div className="dsh-sidecar-error-text">
              <div>{localizeError(t, item.error)}</div>
              <div className="dsh-sidecar-error-code">{item.error?.code ?? 'sidecar/failed'}</div>
              <div className="dsh-sidecar-error-actions">
                <Button size="sm" variant="outline" onClick={onRetry}>{t('retry')}</Button>
              </div>
            </div>
          </div>
        ) : running && item.answer.length === 0 ? (
          <div className="dsh-sidecar-thinking" aria-live="polite">
            <i /><i /><i /><span>{t('thinking')}</span>
          </div>
        ) : item.state === 'cancelled' && item.answer.length === 0 ? (
          <div className="dsh-sidecar-thinking">{t('cancelled')}</div>
        ) : (
          <div className="dsh-sidecar-body" aria-live={running ? 'polite' : 'off'}>
            <MarkdownText text={item.answer} labels={markdownLabels} streaming={running} />
            {running && <span className="dsh-sidecar-caret" aria-hidden="true" />}
          </div>
        )}
        {item.state === 'cancelled' && (
          <div className="dsh-sidecar-error-actions">
            {item.answer.length > 0 && <span className="dsh-sidecar-result-meta">{t('cancelled')}</span>}
            <Button size="sm" variant="ghost" onClick={onRetry}>{t('retry')}</Button>
          </div>
        )}
        <ResultMeta t={t} item={item} />
      </div>
    </div>
  )
}

export function SidecarApp(props: AppProps): React.ReactElement {
  const { sessionId, t, rpc, useSession } = props
  const running = useSession?.((snapshot: any) => snapshot?.running === true) === true
  const thread = useSidecarThread(sessionId, rpc)
  const [summary, setSummary] = React.useState<SidecarSummary | null>(null)
  const [summaryState, setSummaryState] = React.useState<'loading' | 'ready' | 'error'>('loading')
  const [summaryError, setSummaryError] = React.useState<string | null>(null)
  const [refreshing, setRefreshing] = React.useState(false)
  const [draft, setDraft] = React.useState('')
  const [focused, setFocused] = React.useState(false)
  const [clearArmed, setClearArmed] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const stickToBottom = React.useRef(true)
  const clearTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const summaryGeneration = React.useRef(0)

  const refresh = React.useCallback(() => {
    const generation = ++summaryGeneration.current
    setRefreshing(true)
    setSummaryState((previous) => (previous === 'ready' ? previous : 'loading'))
    void rpc.snapshot(sessionId).then(
      (result) => {
        if (summaryGeneration.current !== generation) return
        setSummary(result.summary)
        setSummaryError(null)
        setSummaryState('ready')
        setRefreshing(false)
      },
      (error: unknown) => {
        if (summaryGeneration.current !== generation) return
        const message = error !== null && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
          ? String((error as { message: string }).message)
          : String(error)
        setSummaryError(message)
        setSummaryState((previous) => (previous === 'ready' ? 'ready' : 'error'))
        setRefreshing(false)
      },
    )
  }, [rpc, sessionId])

  React.useEffect(() => {
    setSummary(null)
    setSummaryState('loading')
    setSummaryError(null)
    refresh()
    return () => { summaryGeneration.current += 1 }
  }, [refresh])

  const completed = thread.items.filter((item) => item.state === 'done').length
  React.useEffect(() => {
    if (completed > 0) refresh()
  }, [completed, refresh])

  const busy = thread.activeId !== null
  const canSend = draft.trim().length > 0 && !busy && sessionId.length > 0

  React.useEffect(() => {
    const element = textareaRef.current
    if (element === null) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(160, Math.max(38, element.scrollHeight))}px`
  }, [draft])

  const submit = (): void => {
    if (!canSend) return
    thread.ask(draft)
    setDraft('')
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
      return
    }
    if (event.key === 'Escape' && busy) {
      event.preventDefault()
      thread.stop()
    }
  }

  const onScroll = (): void => {
    const element = scrollRef.current
    if (element === null) return
    stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48
  }

  React.useEffect(() => {
    if (!stickToBottom.current) return
    const element = scrollRef.current
    if (element === null) return
    const handle = requestAnimationFrame(() => { element.scrollTop = element.scrollHeight })
    return () => cancelAnimationFrame(handle)
  }, [thread.items])

  const pickSuggestion = (text: string): void => {
    setDraft(text)
    requestAnimationFrame(() => {
      const element = textareaRef.current
      if (element !== null) {
        element.focus()
        const length = element.value.length
        element.setSelectionRange(length, length)
      }
    })
  }

  const armClear = (): void => {
    if (busy) thread.stop()
    if (!clearArmed) {
      setClearArmed(true)
      if (clearTimer.current !== null) clearTimeout(clearTimer.current)
      clearTimer.current = setTimeout(() => { setClearArmed(false) }, 4000)
      return
    }
    if (clearTimer.current !== null) clearTimeout(clearTimer.current)
    setClearArmed(false)
    thread.clear()
  }

  React.useEffect(() => () => {
    if (clearTimer.current !== null) clearTimeout(clearTimer.current)
  }, [])

  const markdownLabels = React.useMemo(() => ({
    code: { copyLabel: t('copy'), copiedLabel: t('copied') },
    footnotes: '',
  }), [t])

  return (
    <div className="dsh-sidecar-root" role="region" aria-label={t('title')} data-sidecar-root="true">
      <header className="dsh-sidecar-head">
        <div className="dsh-sidecar-brand">
          <span className="dsh-sidecar-mark"><IconContextInjectionOutlineRegular size={16} /></span>
          <div className="dsh-sidecar-titles">
            <div className="dsh-sidecar-title">{t('title')}</div>
            <div
              className="dsh-sidecar-subtitle"
              data-armed={clearArmed ? 'true' : 'false'}
              title={clearArmed ? t('clearConfirm') : running ? t('running') : t('subtitle')}
            >
              {clearArmed ? t('clearConfirm') : running ? t('running') : t('subtitle')}
            </div>
          </div>
        </div>
        <div className="dsh-sidecar-head-actions">
          <Tooltip label={t('refreshTitle')} side="bottom">
            <Button
              size="sm"
              variant="ghost"
              className="dsh-sidecar-iconbtn"
              aria-label={t('refreshTitle')}
              disabled={refreshing}
              onClick={refresh}
            >
              <IconRefreshOutlineRegular size={15} className={refreshing ? 'dsh-sidecar-spin' : undefined} />
            </Button>
          </Tooltip>
          <Tooltip label={clearArmed ? t('clearConfirm') : t('clearThread')} side="bottom">
            <Button
              size="sm"
              variant="ghost"
              className="dsh-sidecar-iconbtn"
              data-armed={clearArmed ? 'true' : 'false'}
              aria-label={clearThreadLabel(t, clearArmed)}
              onClick={armClear}
            >
              <IconTrashOutlineRegular size={15} />
            </Button>
          </Tooltip>
        </div>
      </header>


      <ContextCard
        t={t}
        summary={summary}
        state={summaryState}
        error={summaryError}
        onRefresh={refresh}
      />

      <div className="dsh-sidecar-scroll" ref={scrollRef} onScroll={onScroll}>
        {thread.items.length === 0 ? (
          <EmptyState t={t} onPick={pickSuggestion} />
        ) : (
          <div className="dsh-sidecar-thread" role="log" aria-live="polite">
            {thread.items.map((item) => (
              <Turn
                key={item.id}
                t={t}
                item={item}
                markdownLabels={markdownLabels}
                onRetry={() => { thread.retry(item) }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="dsh-sidecar-composer-wrap">
        <div className="dsh-sidecar-composer" data-focus={focused ? 'true' : 'false'} data-busy={busy ? 'true' : 'false'}>
          <textarea
            ref={textareaRef}
            className="dsh-sidecar-input"
            rows={1}
            value={draft}
            placeholder={t('placeholder')}
            disabled={sessionId.length === 0}
            onChange={(event) => { setDraft(event.target.value) }}
            onKeyDown={onKeyDown}
            onFocus={() => { setFocused(true) }}
            onBlur={() => { setFocused(false) }}
            aria-label={t('placeholder')}
          />
          <div className="dsh-sidecar-composer-bar">
            <span className="dsh-sidecar-hint" title={t('readonlyHint')}>
              <IconShieldOutlineRegular size={11} />
              {t('readonlyHint')}
            </span>
            <div className="dsh-sidecar-composer-actions">
              {busy && (
                <Button size="sm" variant="ghost" icon={<IconPauseOutlineRegular size={14} />} onClick={() => { thread.stop() }}>
                  {t('stop')}
                </Button>
              )}
              <Button
                size="sm"
                variant="primary"
                icon={<IconPaperPlaneOutlineRegular size={14} />}
                disabled={!canSend}
                onClick={submit}
              >
                {t('send')}
              </Button>
            </div>
          </div>
        </div>
        <div className="dsh-sidecar-footnote">{t('localOnly')}</div>
      </div>
    </div>
  )
}

function clearThreadLabel(t: Translate, armed: boolean): string {
  return armed ? t('clearConfirm') : t('clearThread')
}
