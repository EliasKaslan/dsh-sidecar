export const STYLE_ID = 'dsh-sidecar-styles'

export const CSS = String.raw`
.dsh-sidecar-root {
  --sc-text: var(--dsw-alias-label-primary, #1d2129);
  --sc-text-2: var(--dsw-alias-label-secondary, #4e5969);
  --sc-text-3: var(--dsw-alias-label-tertiary, #86909c);
  --sc-text-4: var(--dsw-alias-label-quaternary, #c9cdd4);
  --sc-bg: var(--dsw-alias-bg-base, #ffffff);
  --sc-fill-1: var(--dsw-alias-bg-layer-1, #f7f8fa);
  --sc-fill-2: var(--dsw-alias-bg-layer-2, #f2f3f5);
  --sc-fill-3: var(--dsw-alias-bg-layer-3, #e5e6eb);
  --sc-line: var(--dsw-alias-border-l1, #e5e6eb);
  --sc-line-2: var(--dsw-alias-border-l2, #f2f3f5);
  --sc-accent: var(--dsw-alias-brand-primary, #4d6bfe);
  --sc-hover: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05));
  --sc-danger: var(--dsw-alias-state-error-primary, #f53f3f);
  --sc-warn: var(--dsw-alias-state-warn-primary, #ff7d00);
  --sc-ok: var(--dsw-alias-state-success-primary, #00b42a);
  --sc-radius: var(--dsw-radius-lg, 12px);
  --sc-radius-sm: var(--dsw-radius-md, 8px);
  --sc-mono: var(--dsw-font-mono, ui-monospace, "SFMono-Regular", Consolas, monospace);
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--sc-text);
  background: transparent;
  font-family: var(--dsw-font-family, var(--dsw-font, inherit));
  font-size: 13px;
  line-height: 1.55;
}

.dsh-sidecar-root * { box-sizing: border-box; }

.dsh-sidecar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 10px 8px 12px;
  flex: none;
}

.dsh-sidecar-brand { display: flex; align-items: center; gap: 9px; min-width: 0; }

.dsh-sidecar-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex: none;
  border-radius: 8px;
  color: var(--sc-accent);
  background: color-mix(in srgb, var(--sc-accent) 10%, transparent);
}

.dsh-sidecar-titles { min-width: 0; }
.dsh-sidecar-title { font-size: 13px; font-weight: 600; letter-spacing: .01em; line-height: 18px; }
.dsh-sidecar-subtitle {
  font-size: 11px;
  line-height: 15px;
  color: var(--sc-text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dsh-sidecar-subtitle[data-armed="true"] { color: var(--sc-danger); font-weight: 600; }

.dsh-sidecar-head-actions { display: flex; align-items: center; gap: 2px; flex: none; }

.dsh-sidecar-iconbtn {
  width: 28px;
  min-width: 28px;
  padding: 0 !important;
  color: var(--sc-text-2);
}
.dsh-sidecar-iconbtn:hover { color: var(--sc-text); }
.dsh-sidecar-iconbtn[data-armed="true"] {
  color: var(--sc-danger);
  background: color-mix(in srgb, var(--sc-danger) 10%, transparent);
}

.dsh-sidecar-spin { animation: dsh-sidecar-spin 900ms linear infinite; }
@keyframes dsh-sidecar-spin { to { transform: rotate(360deg); } }

.dsh-sidecar-context {
  margin: 0 10px 8px;
  padding: 8px 10px;
  flex: none;
  border: 1px solid var(--sc-line);
  border-radius: var(--sc-radius-sm);
  background: var(--sc-fill-1);
  text-align: left;
  font: inherit;
  color: inherit;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}
.dsh-sidecar-context:hover { background: var(--sc-fill-2); }
.dsh-sidecar-context-toggle {
  appearance: none;
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.dsh-sidecar-context-toggle:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--sc-accent));
  outline-offset: 2px;
  border-radius: 4px;
}
.dsh-sidecar-linkbtn {
  appearance: none;
  margin-left: 2px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--sc-accent);
  font: inherit;
  font-size: 11px;
  text-decoration: underline;
  cursor: pointer;
}

.dsh-sidecar-context-row { display: flex; align-items: center; gap: 7px; min-width: 0; }

.dsh-sidecar-dot {
  width: 6px; height: 6px; border-radius: 50%;
  flex: none; background: var(--sc-ok);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--sc-ok) 14%, transparent);
}
.dsh-sidecar-dot[data-live="false"] {
  background: var(--sc-text-4);
  box-shadow: none;
}

.dsh-sidecar-model {
  font-family: var(--sc-mono);
  font-size: 11px;
  color: var(--sc-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.dsh-sidecar-counts { margin-left: auto; font-size: 11px; color: var(--sc-text-3); white-space: nowrap; flex: none; }

.dsh-sidecar-context-detail {
  margin-top: 7px;
  padding-top: 7px;
  border-top: 1px dashed var(--sc-line);
  display: grid;
  gap: 4px;
  font-size: 11px;
  color: var(--sc-text-2);
}
.dsh-sidecar-context-detail dl { margin: 0; display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 3px 8px; }
.dsh-sidecar-context-detail dt { color: var(--sc-text-3); }
.dsh-sidecar-context-detail dd { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-sidecar-context-detail dd.sc-wrap { white-space: normal; overflow-wrap: anywhere; }

.dsh-sidecar-warn {
  display: flex; align-items: center; gap: 5px;
  color: var(--sc-warn); font-size: 11px; margin-top: 2px;
}

.dsh-sidecar-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--sc-line-2) transparent;
  padding: 2px 10px 10px;
}
.dsh-sidecar-scroll::-webkit-scrollbar { width: 8px; }
.dsh-sidecar-scroll::-webkit-scrollbar-thumb {
  background: var(--sc-line); border-radius: 8px; border: 2px solid transparent; background-clip: content-box;
}

.dsh-sidecar-thread { display: flex; flex-direction: column; gap: 16px; padding: 2px 2px 6px; }

.dsh-sidecar-turn { animation: dsh-sidecar-in 180ms ease both; }
@keyframes dsh-sidecar-in { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }

.dsh-sidecar-q { display: flex; flex-direction: column; gap: 3px; align-items: flex-end; }
.dsh-sidecar-q-label { font-size: 11px; color: var(--sc-text-3); padding-right: 2px; }
.dsh-sidecar-q-text {
  max-width: 92%;
  padding: 7px 11px;
  border-radius: 13px 13px 4px 13px;
  background: var(--sc-fill-2);
  color: var(--sc-text);
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.dsh-sidecar-a { display: flex; flex-direction: column; gap: 5px; }
.dsh-sidecar-a-head {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: var(--sc-text-3);
  min-height: 18px;
}
.dsh-sidecar-a-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; border-radius: 5px;
  color: var(--sc-accent);
  background: color-mix(in srgb, var(--sc-accent) 10%, transparent);
}
.dsh-sidecar-a-time { color: var(--sc-text-4); }
.dsh-sidecar-a-actions { margin-left: auto; display: flex; gap: 1px; opacity: 0; transition: opacity 120ms ease; }
.dsh-sidecar-a:hover .dsh-sidecar-a-actions,
.dsh-sidecar-a:focus-within .dsh-sidecar-a-actions { opacity: 1; }

.dsh-sidecar-body {
  font-size: 13px;
  line-height: 1.66;
  overflow-wrap: anywhere;
}
.dsh-sidecar-body > :first-child { margin-top: 0; }
.dsh-sidecar-body > :last-child { margin-bottom: 0; }
.dsh-sidecar-body p { margin: 0 0 8px; }
.dsh-sidecar-body ul, .dsh-sidecar-body ol { margin: 0 0 8px; padding-left: 20px; }
.dsh-sidecar-body li { margin: 2px 0; }
.dsh-sidecar-body pre { max-width: 100%; overflow-x: auto; }
.dsh-sidecar-body code { font-family: var(--sc-mono); font-size: 12px; }
.dsh-sidecar-body .katex-display { overflow-x: auto; overflow-y: hidden; padding-bottom: 2px; }

.dsh-sidecar-caret {
  display: inline-block;
  width: 6px; height: 13px;
  margin-left: 2px;
  vertical-align: -2px;
  border-radius: 1px;
  background: var(--sc-accent);
  animation: dsh-sidecar-blink 1s steps(2, start) infinite;
}
@keyframes dsh-sidecar-blink { 50% { opacity: 0; } }

.dsh-sidecar-thinking {
  display: inline-flex; align-items: center; gap: 6px;
  color: var(--sc-text-3); font-size: 12px;
}
.dsh-sidecar-thinking i {
  width: 4px; height: 4px; border-radius: 50%; background: var(--sc-text-3);
  animation: dsh-sidecar-pulse 1.2s ease-in-out infinite;
}
.dsh-sidecar-thinking i:nth-child(2) { animation-delay: .15s; }
.dsh-sidecar-thinking i:nth-child(3) { animation-delay: .3s; }
@keyframes dsh-sidecar-pulse { 0%, 80%, 100% { opacity: .25; transform: scale(.9); } 40% { opacity: 1; transform: scale(1.1); } }

.dsh-sidecar-result-meta {
  display: flex; align-items: center; gap: 8px;
  font-size: 11px; color: var(--sc-text-4);
  font-family: var(--sc-mono);
}

.dsh-sidecar-error {
  display: flex; align-items: flex-start; gap: 7px;
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--sc-danger) 28%, var(--sc-line));
  border-radius: var(--sc-radius-sm);
  background: color-mix(in srgb, var(--sc-danger) 6%, transparent);
  color: var(--sc-danger);
  font-size: 12px;
}
.dsh-sidecar-error-text { min-width: 0; overflow-wrap: anywhere; }
.dsh-sidecar-error-code { font-family: var(--sc-mono); font-size: 10px; opacity: .8; }
.dsh-sidecar-error-actions { display: flex; gap: 4px; margin-top: 6px; }

.dsh-sidecar-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center;
  gap: 10px;
  min-height: 100%;
  padding: 28px 12px 18px;
  animation: dsh-sidecar-in 220ms ease both;
}
.dsh-sidecar-empty-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 44px; height: 44px; border-radius: 14px;
  color: var(--sc-accent);
  background: color-mix(in srgb, var(--sc-accent) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--sc-accent) 14%, transparent);
}
.dsh-sidecar-empty-title { font-size: 14px; font-weight: 600; }
.dsh-sidecar-empty-body { font-size: 12px; color: var(--sc-text-3); max-width: 290px; line-height: 1.6; }

.dsh-sidecar-suggestions { display: grid; gap: 6px; width: 100%; max-width: 320px; margin-top: 4px; }
.dsh-sidecar-suggestion {
  appearance: none;
  display: flex; align-items: center; gap: 7px;
  padding: 7px 10px;
  border: 1px solid var(--sc-line);
  border-radius: var(--sc-radius-sm);
  background: transparent;
  color: var(--sc-text-2);
  font: inherit; font-size: 12px; text-align: left;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
}
.dsh-sidecar-suggestion:hover { background: var(--sc-fill-1); border-color: var(--sc-line-2); color: var(--sc-text); }
.dsh-sidecar-suggestion:focus-visible { outline: 2px solid var(--dsw-focus-ring-color, var(--sc-accent)); outline-offset: 1px; }
.dsh-sidecar-suggestion svg { flex: none; color: var(--sc-text-3); }

.dsh-sidecar-composer-wrap {
  flex: none;
  padding: 8px 10px 10px;
  background: linear-gradient(to top, var(--sc-bg) 72%, transparent);
}
.dsh-sidecar-composer {
  border: 1px solid var(--sc-line);
  border-radius: var(--sc-radius);
  background: var(--sc-fill-1);
  transition: border-color 140ms ease, background 140ms ease, box-shadow 140ms ease;
}
.dsh-sidecar-composer[data-focus="true"] {
  border-color: color-mix(in srgb, var(--sc-accent) 32%, var(--sc-line));
  background: var(--sc-bg);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--sc-accent) 7%, transparent);
}
.dsh-sidecar-composer[data-busy="true"] { opacity: .92; }

.dsh-sidecar-input {
  display: block;
  width: 100%;
  min-height: 38px;
  max-height: 160px;
  padding: 9px 11px 3px;
  border: 0;
  outline: 0;
  resize: none;
  background: transparent;
  color: var(--sc-text);
  font: inherit;
  font-size: 13px;
  line-height: 1.55;
  scrollbar-width: thin;
}
.dsh-sidecar-input::placeholder { color: var(--sc-text-4); }
.dsh-sidecar-input:disabled { cursor: not-allowed; }

.dsh-sidecar-composer-bar {
  display: flex; align-items: center; gap: 6px;
  padding: 3px 6px 6px 10px;
}
.dsh-sidecar-hint {
  display: inline-flex; align-items: center; gap: 4px;
  min-width: 0;
  font-size: 10px; color: var(--sc-text-4);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dsh-sidecar-composer-actions { margin-left: auto; display: flex; align-items: center; gap: 4px; flex: none; }

.dsh-sidecar-footnote {
  margin-top: 5px;
  font-size: 10px;
  color: var(--sc-text-4);
  text-align: center;
}

.dsh-sidecar-sr {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .dsh-sidecar-root *, .dsh-sidecar-root *::before, .dsh-sidecar-root *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
  }
}
`

export function injectStyles(doc: Document = document): void {
  const existing = doc.getElementById(STYLE_ID)
  if (existing !== null) {
    existing.textContent = CSS
    return
  }
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  doc.head.appendChild(style)
}
