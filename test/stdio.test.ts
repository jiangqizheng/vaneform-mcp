import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { afterEach, describe, expect, it } from 'vitest'

import { type FakeRemote, startFakeRemote } from './fake-remote.js'

const serverPath = fileURLToPath(new URL('../dist/bin/vaneform-mcp.js', import.meta.url))

let remote: FakeRemote | undefined
let client: Client | undefined

afterEach(async () => {
  await client?.close()
  await remote?.close()
  client = undefined
  remote = undefined
})

async function connect(env: Record<string, string>) {
  remote = await startFakeRemote()
  client = new Client({ name: 'vaneform-mcp-test', version: '0.0.0' })
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [serverPath],
      env: { PATH: process.env.PATH ?? '', VANEFORM_MCP_URL: remote.url, ...env },
      stderr: 'ignore',
    }),
  )
  return client
}

describe.skipIf(!existsSync(serverPath))('stdio server (built)', () => {
  it('speaks MCP to the official SDK client: list, call and errors', async () => {
    const mcp = await connect({ VANEFORM_API_KEY: 'vf_live_test' })
    expect(mcp.getServerVersion()?.name).toBe('vaneform')
    const { tools } = await mcp.listTools()
    expect(tools.map((tool) => tool.name)).toEqual(['lookup_domain', 'get_account'])
    const result = await mcp.callTool({ name: 'lookup_domain', arguments: { domain: 'github.com' } })
    expect(result.isError).toBe(false)
    expect(JSON.parse((result.content as { text: string }[])[0]?.text ?? '')).toEqual({
      tool: 'lookup_domain',
      args: { domain: 'github.com' },
    })
    await expect(mcp.callTool({ name: 'nope', arguments: {} })).rejects.toThrow(/Unknown tool/)
  })

  it('lists tools without a key and answers calls with sign-up guidance', async () => {
    const mcp = await connect({})
    expect((await mcp.listTools()).tools).toHaveLength(2)
    const result = await mcp.callTool({ name: 'get_account', arguments: {} })
    expect(result.isError).toBe(true)
    expect((result.content as { text: string }[])[0]?.text).toContain('https://vaneform.com/account/api')
  })
})
