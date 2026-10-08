import { afterEach, describe, expect, it } from 'vitest'

import { guestLookupUrl, VaneformClient } from '../src/client.js'
import { type FakeRemote, startFakeRemote } from './fake-remote.js'

let remote: FakeRemote | undefined

afterEach(async () => {
  await remote?.close()
  remote = undefined
})

describe('VaneformClient', () => {
  it('answers a call without a key locally, with sign-up and browser links', async () => {
    remote = await startFakeRemote()
    const client = new VaneformClient({ endpoint: remote.url })
    const result = await client.callTool('lookup_domain', { domain: 'github.com' })
    expect(result.isError).toBe(true)
    const text = result.content[0]?.text ?? ''
    expect(text).toContain('https://vaneform.com/account/api')
    expect(text).toContain(guestLookupUrl('github.com'))
    expect(remote.requests).toHaveLength(0)
  })

  it('lists tools without sending the key and caches them', async () => {
    remote = await startFakeRemote()
    const client = new VaneformClient({ endpoint: remote.url, apiKey: 'vf_live_test' })
    expect((await client.listTools()).map((tool) => tool.name)).toEqual(['lookup_domain', 'get_account'])
    await client.listTools()
    expect(remote.requests).toHaveLength(1)
    expect(remote.requests[0]?.auth).toBeUndefined()
  })

  it('forwards calls with the bearer key and parses SSE', async () => {
    remote = await startFakeRemote()
    const client = new VaneformClient({ endpoint: remote.url, apiKey: ' vf_live_test ' })
    const body = await client.callJson<{ tool: string; args: unknown }>('lookup_domain', { domain: 'github.com' })
    expect(body).toEqual({ tool: 'lookup_domain', args: { domain: 'github.com' } })
    expect(remote.requests[0]?.auth).toBe('Bearer vf_live_test')
  })

  it('adds a hint when points run out', async () => {
    remote = await startFakeRemote(() => ({
      text: JSON.stringify({ error: { code: 'credits_exhausted', message: 'Points are used up for this billing period.' } }),
      isError: true,
    }))
    const client = new VaneformClient({ endpoint: remote.url, apiKey: 'vf_live_test' })
    const result = await client.callTool('compare_bulk', { q: 'a.com,b.com' })
    expect(result.isError).toBe(true)
    expect(result.content).toHaveLength(2)
    expect(result.content[1]?.text).toContain('https://vaneform.com/pricing')
    expect(result.content[1]?.text).toContain('https://vaneform.com/bulk?q=a.com%2Cb.com')
  })

  it('turns a rejected key into a tool error with a hint', async () => {
    remote = await startFakeRemote()
    const client = new VaneformClient({ endpoint: remote.url, apiKey: 'vf_live_wrong' })
    const result = await client.callTool('get_account')
    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain('Invalid API key.')
    expect(result.content[0]?.text).toContain('https://vaneform.com/account/api')
  })
})
