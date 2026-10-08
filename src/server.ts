/**
 * Stdio MCP server that proxies to the hosted Vaneform MCP endpoint.
 * Tool definitions come from the hosted server; calls carry VANEFORM_API_KEY.
 */
import { createInterface } from 'node:readline'

import { ATTRIBUTION, VaneformClient, VERSION } from './client.js'

const SUPPORTED_PROTOCOL_VERSIONS = ['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25']
const LATEST_PROTOCOL_VERSION = '2025-06-18'

type JsonRpcId = string | number | null
type JsonRpcMessage = { jsonrpc?: unknown; id?: JsonRpcId; method?: unknown; params?: unknown }
type JsonRpcResponse = {
  jsonrpc: '2.0'
  id: JsonRpcId
  result?: unknown
  error?: { code: number; message: string }
}

const INSTRUCTIONS = [
  'Vaneform answers "how much traffic does this website get?" and "how do these sites compare?".',
  'lookup_domain reads a cached snapshot (status=missing means not cached yet, never zero traffic);',
  'compare_bulk and compare_tld fetch traffic when it is missing; get_account shows remaining points and spends none.',
  `Quote as_of and confidence, and attribute figures to ${ATTRIBUTION}.`,
].join(' ')

export function createHandler(client: VaneformClient) {
  return async function handle(message: JsonRpcMessage): Promise<JsonRpcResponse | null> {
    const id = message.id ?? null
    const isNotification = message.id === undefined
    if (message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
      return isNotification ? null : { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid request.' } }
    }
    if (isNotification) return null
    const params = (message.params && typeof message.params === 'object' ? message.params : {}) as Record<string, unknown>
    try {
      switch (message.method) {
        case 'initialize': {
          const requested = params.protocolVersion
          return {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion:
                typeof requested === 'string' && SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL_VERSION,
              capabilities: { tools: {} },
              serverInfo: { name: 'vaneform', version: VERSION },
              instructions: INSTRUCTIONS,
            },
          }
        }
        case 'ping':
          return { jsonrpc: '2.0', id, result: {} }
        case 'tools/list':
          return { jsonrpc: '2.0', id, result: { tools: await client.listTools() } }
        case 'tools/call': {
          const name = params.name
          if (typeof name !== 'string' || !name) {
            return { jsonrpc: '2.0', id, error: { code: -32602, message: 'tools/call needs a tool name.' } }
          }
          const tools = await client.listTools()
          if (!tools.some((tool) => tool.name === name)) {
            return { jsonrpc: '2.0', id, error: { code: -32602, message: `Unknown tool: ${name}` } }
          }
          const args =
            params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments)
              ? (params.arguments as Record<string, unknown>)
              : {}
          return { jsonrpc: '2.0', id, result: await client.callTool(name, args) }
        }
        case 'resources/list':
          return { jsonrpc: '2.0', id, result: { resources: [] } }
        case 'prompts/list':
          return { jsonrpc: '2.0', id, result: { prompts: [] } }
        default:
          return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown method: ${message.method}` } }
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: error instanceof Error ? error.message : 'Internal error.' },
      }
    }
  }
}

export function runStdioServer(client = VaneformClient.fromEnv()): void {
  const handle = createHandler(client)
  const write = (response: JsonRpcResponse) => process.stdout.write(`${JSON.stringify(response)}\n`)
  const lines = createInterface({ input: process.stdin, crlfDelay: Number.POSITIVE_INFINITY })
  lines.on('line', (line) => {
    if (!line.trim()) return
    let message: JsonRpcMessage
    try {
      message = JSON.parse(line) as JsonRpcMessage
    } catch {
      write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error.' } })
      return
    }
    void handle(message).then((response) => {
      if (response) write(response)
    })
  })
  if (!client.hasApiKey) {
    process.stderr.write('vaneform-mcp: VANEFORM_API_KEY is not set; tools will list but calls return sign-up guidance.\n')
  }
}
