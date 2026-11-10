import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import Sidecar from '../lib/index.js'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const MARK = '@deepseek-ai/dsh-typert-protocol/remote-methods'

test('manifest declares both halves and the web client', () => {
  assert.equal(pkg.main, 'lib/index.js')
  assert.equal(pkg.exports['.'], './lib/index.js')
  assert.equal(pkg.exports['./client'], './lib/client.js')
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.ok(Array.isArray(pkg.dsh.client.inject))
})

test('host bundle exposes a Cordis service with a Remote marker', () => {
  assert.equal(typeof Sidecar, 'function')
  assert.ok(Array.isArray(Sidecar.inject))
  assert.deepEqual(Sidecar.inject, ['llm', 'sessionQuery'])
  const marker = Object.getOwnPropertyDescriptor(Sidecar.prototype, MARK)
  assert.ok(marker !== undefined)
  assert.equal(marker.value.version, 1)
  assert.deepEqual(
    marker.value.methods.map((entry) => entry.method).sort(),
    ['ask', 'cancel', 'poll', 'snapshot'],
  )
})

test('every Remote method keeps signal as the final literal parameter', () => {
  for (const method of ['ask', 'poll', 'cancel', 'snapshot']) {
    const source = Sidecar.prototype[method].toString()
    const open = source.indexOf('(')
    const close = source.indexOf(')', open)
    assert.ok(open > 0 && close > open, `${method} has no parameter list`)
    const parameters = source.slice(open + 1, close).split(',').map((value) => value.trim())
    assert.equal(parameters.at(-1), 'signal', `${method} must end with signal`)
    assert.ok(parameters.every((value) => /^[A-Za-z_$][\w$]*$/.test(value)), `${method} has a non-literal parameter`)
  }
})

test('client bundle is a self-registering factory with only platform requires', async () => {
  const code = await readFile(join(root, 'lib/client.js'), 'utf8')
  assert.ok(code.startsWith(`/* ${pkg.name} v${pkg.version}`))
  assert.match(code, /window\.__ModuleLoader__\.load\(\{/)
  assert.match(code, new RegExp(`id: "${pkg.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`))
  assert.match(code, /factory: \(require\) => \{/)
  assert.match(code, /return module\.exports/)
  const requires = new Set([...code.matchAll(/\brequire\("([^"]+)"\)/g)].map((match) => match[1]))
  const allowed = new Set([
    'react',
    'react-dom',
    'react/jsx-runtime',
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-client-store',
    '@deepseek-ai/dsh-client-ui-dockkit',
    '@deepseek-ai/dsh-client-ui-primitives',
    '@deepseek-ai/dsh-client-ui-slots',
  ])
  for (const spec of requires) assert.ok(allowed.has(spec), `unexpected client require: ${spec}`)
})

test('client bundle has no top-level import statements', async () => {
  const code = await readFile(join(root, 'lib/client.js'), 'utf8')
  assert.doesNotMatch(code, /^\s*import\s/m)
  assert.doesNotMatch(code, /^\s*export\s/m)
})
