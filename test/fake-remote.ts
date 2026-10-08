import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

export const FAKE_TOOLS = [
  {
    name: 'lookup_domain',
    description: 'Read a cached Vaneform domain snapshot.',
    inputSchema: { type: 'object', required: ['domain'], properties: { domain: { type: 'string' } } },
  },
  {
    name: 'get_account',
    description: 'Read the caller plan.',
    inputSchema: { type: 'object', properties: {} },
  },
]

export type FakeRemote = {
  url: string
  requests: { auth: string | undefined; body: { method: string; params?: Record<string, unknown> } }[]
  close: () => Promise<void>
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

/** A stand-in for https://vaneform.com/mcp with the same auth contract. */
export async function startFakeRemote(
  toolText: (name: string, args: Record<string, unknown>) => { text: string; isError: boolean } = (name, args) => ({
    text: JSON.stringify({ tool: name, args }),
    isError: false,
  }),
): Promise<FakeRemote> {
  const requests: FakeRemote['requests'] = []
  const server: Server = createServer(async (req, res) => {
    const body = JSON.parse(await readBody(req))
    const auth = req.headers.authorization
    requests.push({ auth, body })
    if (auth && auth !== 'Bearer vf_live_test') {
      res.writeHead(401, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { code: 'invalid_api_key', message: 'Invalid API key.' } }))
      return
    }
    let result: unknown
    if (body.method === 'tools/list') result = { tools: FAKE_TOOLS }
    else if (body.method === 'tools/call') {
      const out = toolText(body.params.name, body.params.arguments ?? {})
      result = { content: [{ type: 'text', text: out.text }], isError: out.isError }
    } else result = {}
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.end(`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: body.id, result })}\n\n`)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}/mcp`,
    requests,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}
