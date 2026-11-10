/**
 * dsh-sidecar — browser half.
 *
 * Registers one right-sidebar page type, its body, and a compact header
 * action that opens it. All session state comes from the slot framework; all
 * side-question state stays in this panel and in localStorage.
 */
import * as React from 'react'
import {
  Button,
  IconContextInjectionOutlineRegular,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { SidecarApp } from './App'
import { dictionaries, NS } from './locale'
import { createRpc } from './rpc'
import { injectStyles } from './styles'

const ID = 'dsh-sidecar'
const KIND = 'sidecar'

export const inject = ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight', 'connection']

export function apply(ctx: any): void {
  injectStyles()
  const t = ctx.locale.bind(NS)
  const rpc = createRpc(ctx)

  function Body(props: any): React.ReactElement {
    const sessionId = typeof props.sessionId === 'string' ? props.sessionId : ''
    return (
      <SidecarApp
        sessionId={sessionId}
        t={props.t ?? t}
        rpc={rpc}
        useSession={props.useSession}
      />
    )
  }

  function OpenButton(props: any): React.ReactElement {
    const translate = props.t ?? t
    const open = (): void => {
      try {
        ctx.sidebarRight.openTab(KIND)
      } catch {
        // No mounted session, or the right sidebar is unavailable in this
        // composition; the guide seat remains as the fallback entry.
      }
    }
    return (
      <Tooltip label={translate('open')} side="bottom">
        <Button
          size="sm"
          variant="ghost"
          className="dsh-sidecar-iconbtn"
          aria-label={translate('open')}
          onClick={open}
        >
          <IconContextInjectionOutlineRegular size={15} />
        </Button>
      </Tooltip>
    )
  }

  const guard = <T,>(label: string, run: () => T): T => {
    try {
      return run()
    } catch (error) {
      console.error(`[dsh-sidecar] ${label} failed`, error)
      throw error
    }
  }

  ctx.effect(() => guard('dictionaries', () => ctx.locale.register(NS, dictionaries)), 'sidecar: dictionaries')

  ctx.effect(() => guard('tab type', () => ctx.sidebarRightTabs.register({
    id: ID,
    kind: KIND,
    title: () => t('tabTitle'),
    keepMounted: true,
    guide: [{
      id: 'open',
      order: 40,
      title: () => t('guideTitle'),
      description: () => t('guideDesc'),
    }],
  })), 'sidecar: right-sidebar tab type')

  ctx.effect(() => guard('pane body', () => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: ID,
    locale: NS,
  }, Body))), 'sidecar: right-sidebar body')

  ctx.effect(() => guard('header action', () => ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions',
    id: 'dsh-sidecar-open',
    order: 40,
    locale: NS,
  }, OpenButton))), 'sidecar: header action')
}
