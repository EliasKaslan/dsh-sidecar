#!/usr/bin/env node
/** Parse both built halves with Node and assert the client wrapper contract. */
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))

for (const file of ['lib/index.js', 'lib/client.js']) {
  execFileSync(process.execPath, ['--check', join(root, file)], { stdio: 'inherit' })
}

const client = await readFile(join(root, 'lib/client.js'), 'utf8')
if (!client.startsWith(`/* ${pkg.name}`)) throw new Error('client bundle banner missing')
if (!client.includes('window.__ModuleLoader__.load({')) throw new Error('client bundle is not a ModuleLoader factory')
if (!client.includes(`id: ${JSON.stringify(pkg.name)},`)) throw new Error('client bundle id does not match the package name')
if (/\bimport\s+[^\s("']+\s+from\s+["']/.test(client)) throw new Error('client bundle contains an ESM import')

const host = await readFile(join(root, 'lib/index.js'), 'utf8')
if (!host.includes('export {')) throw new Error('host bundle has no exports')

console.log(`syntax ok: lib/index.js ${host.length}B, lib/client.js ${client.length}B`)
