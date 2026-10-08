import { describe, expect, it } from 'vitest'

import { runCli } from '../src/cli.js'
import { VaneformClient } from '../src/client.js'

function capture() {
  const out = { stdout: [] as string[], stderr: [] as string[] }
  return {
    out,
    io: { stdout: (text: string) => out.stdout.push(text), stderr: (text: string) => out.stderr.push(text) },
  }
}

describe('cli', () => {
  it('prints a browser link and exits 2 without a key', async () => {
    const { out, io } = capture()
    const code = await runCli(['github.com'], new VaneformClient({ endpoint: 'http://127.0.0.1:9/mcp' }), io)
    expect(code).toBe(2)
    expect(out.stderr.join('\n')).toContain('https://vaneform.com/?q=github.com')
  })

  it('shows help', async () => {
    const { out, io } = capture()
    expect(await runCli(['--help'], new VaneformClient(), io)).toBe(0)
    expect(out.stdout[0]).toContain('vaneform compare')
  })
})
