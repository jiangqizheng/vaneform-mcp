/**
 * Small client for the hosted Vaneform MCP endpoint (https://vaneform.com/mcp).
 * The CLI and the stdio server share it, so both see the same tools and errors.
 */

export const VANEFORM_ORIGIN = 'https://vaneform.com'
export const DEFAULT_MCP_URL = `${VANEFORM_ORIGIN}/mcp`
export const REMOTE_PROTOCOL_VERSION = '2025-03-26'
export const ATTRIBUTION = 'Vaneform (data: Similarweb estimates)'
export const VERSION = '0.1.0'

export type ToolDefinition = {
  name: string
  description?: string
  inputSchema: Record<string, unknown>
}

export type ToolContent = { type: 'text'; text: string }

export type ToolResult = {
  content: ToolContent[]
  isError: boolean
}

export type ClientOptions = {
  apiKey?: string
  endpoint?: string
  fetch?: typeof fetch
  userAgent?: string
}

export class VaneformError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'VaneformError'
  }
}

/** Browser report link. Guests get 3 lookups a day there and free accounts 30. */
export function guestLookupUrl(domain: string): string {
  return `${VANEFORM_ORIGIN}/?q=${encodeURIComponent(domain.trim())}`
}

export const SIGN_UP_URL = `${VANEFORM_ORIGIN}/account/api`
export const PRICING_URL = `${VANEFORM_ORIGIN}/pricing`

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** The vaneform.com page that shows the same answer in a browser, for the given tool call. */
export function browserUrl(tool: string, args: Record<string, unknown> = {}): string {
  const q = text(args.q)
  if (tool === 'compare_bulk' && q) {
    const domains = q
      .split(/[\s,]+/u)
      .filter(Boolean)
      .join(',')
    return `${VANEFORM_ORIGIN}/bulk?q=${encodeURIComponent(domains)}`
  }
  if (tool === 'compare_tld' && q) {
    const s = text(args.s)
    return `${VANEFORM_ORIGIN}/tld?q=${encodeURIComponent(q)}${s ? `&s=${encodeURIComponent(s)}` : ''}`
  }
  const domain = text(args.domain)
  return domain ? guestLookupUrl(domain) : VANEFORM_ORIGIN
}

function browserLine(tool: string, args: Record<string, unknown>): string {
  return `Check it in a browser instead: ${browserUrl(tool, args)} (3 free lookups a day without an account, 30 with a free account).`
}

export function missingKeyMessage(tool: string, args: Record<string, unknown> = {}): string {
  return [
    'VANEFORM_API_KEY is not set, so this tool cannot call the Vaneform API.',
    `Create a free account and an API key at ${SIGN_UP_URL} (the free plan includes 100 API points a month; a new domain costs 1 point).`,
    browserLine(tool, args),
  ].join('\n')
}

/** Extra guidance for error codes returned by the Vaneform API. */
export function hintForErrorCode(code: string, tool: string, args: Record<string, unknown> = {}): string | null {
  switch (code) {
    case 'unauthorized':
    case 'invalid_api_key':
      return `The API key was missing or rejected. Create or rotate a key at ${SIGN_UP_URL}. ${browserLine(tool, args)}`
    case 'credits_exhausted':
      return `API points are used up for this month. More points come with Pro: ${PRICING_URL}. ${browserLine(tool, args)}`
    case 'lookup_limit_exceeded':
    case 'lookup_rate_exceeded':
      return `Lookup limit reached; wait and retry. Higher limits: ${PRICING_URL}. ${browserLine(tool, args)}`
    case 'search_requires_pro':
    case 'pro_required':
      return `This is a Pro feature: ${PRICING_URL}`
    default:
      return null
  }
}

/** Reads `error.code` from a JSON tool payload, if the payload is an API error. */
export function errorCodeOf(text: string): string | null {
  try {
    const parsed = JSON.parse(text) as { error?: { code?: unknown } }
    return typeof parsed?.error?.code === 'string' ? parsed.error.code : null
  } catch {
    return null
  }
}

function parseRpcBody(text: string, contentType: string): unknown {
  if (contentType.includes('text/event-stream')) {
    const data = text
      .split(/\r?\n/u)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('')
    return JSON.parse(data)
  }
  return JSON.parse(text)
}

export class VaneformClient {
  readonly endpoint: string
  readonly hasApiKey: boolean
  readonly #apiKey: string | undefined
  readonly #fetch: typeof fetch
  readonly #userAgent: string
  #nextId = 1
  #tools: ToolDefinition[] | null = null

  constructor(options: ClientOptions = {}) {
    const key = options.apiKey?.trim()
    this.#apiKey = key ? key : undefined
    this.hasApiKey = Boolean(this.#apiKey)
    this.endpoint = options.endpoint?.trim() || DEFAULT_MCP_URL
    this.#fetch = options.fetch ?? globalThis.fetch
    this.#userAgent = options.userAgent ?? `vaneform-mcp/${VERSION}`
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env, extra: Omit<ClientOptions, 'apiKey' | 'endpoint'> = {}) {
    return new VaneformClient({
      ...extra,
      apiKey: env.VANEFORM_API_KEY,
      endpoint: env.VANEFORM_MCP_URL,
    })
  }

  async rpc(method: string, params?: Record<string, unknown>, withKey = this.hasApiKey): Promise<unknown> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': REMOTE_PROTOCOL_VERSION,
      'User-Agent': this.#userAgent,
    }
    if (withKey && this.#apiKey) headers.Authorization = `Bearer ${this.#apiKey}`
    const id = this.#nextId++
    let response: Response
    try {
      response = await this.#fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) }),
      })
    } catch (error) {
      throw new VaneformError(
        `Could not reach ${this.endpoint}: ${error instanceof Error ? error.message : String(error)}`,
        'network_error',
      )
    }
    const text = await response.text()
    let body: { result?: unknown; error?: { code?: unknown; message?: unknown } }
    try {
      body = parseRpcBody(text, response.headers.get('content-type') ?? '') as typeof body
    } catch {
      throw new VaneformError(`Unexpected response from ${this.endpoint} (HTTP ${response.status}).`, 'bad_response', response.status)
    }
    if (!response.ok) {
      const apiError = body?.error as { code?: unknown; message?: unknown } | undefined
      const code = typeof apiError?.code === 'string' ? apiError.code : 'http_error'
      const message = typeof apiError?.message === 'string' ? apiError.message : `HTTP ${response.status}`
      throw new VaneformError(message, code, response.status)
    }
    if (body?.error) {
      throw new VaneformError(String(body.error.message ?? 'JSON-RPC error'), `jsonrpc_${String(body.error.code)}`)
    }
    return body?.result
  }

  /** Tool definitions straight from the hosted server, so they never drift. Discovery needs no key. */
  async listTools(): Promise<ToolDefinition[]> {
    if (this.#tools) return this.#tools
    const result = (await this.rpc('tools/list', undefined, false)) as { tools?: ToolDefinition[] }
    if (!Array.isArray(result?.tools)) throw new VaneformError('tools/list returned no tools.', 'bad_response')
    this.#tools = result.tools
    return this.#tools
  }

  /** Calls a hosted tool. Never throws for API errors: they come back as `isError` results with a hint. */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
    if (!this.hasApiKey) {
      return { content: [{ type: 'text', text: missingKeyMessage(name, args) }], isError: true }
    }
    let result: ToolResult
    try {
      result = (await this.rpc('tools/call', { name, arguments: args })) as ToolResult
    } catch (error) {
      const code = error instanceof VaneformError ? error.code : 'internal_error'
      const message = error instanceof Error ? error.message : String(error)
      const hint = hintForErrorCode(code, name, args)
      return {
        content: [{ type: 'text', text: hint ? `${message}\n${hint}` : message }],
        isError: true,
      }
    }
    const content = Array.isArray(result?.content) ? result.content : []
    if (result?.isError) {
      const code = content[0] ? errorCodeOf(content[0].text) : null
      const hint = code ? hintForErrorCode(code, name, args) : null
      if (hint) return { content: [...content, { type: 'text', text: hint }], isError: true }
    }
    return { content, isError: Boolean(result?.isError) }
  }

  /** Calls a tool and parses its JSON payload. Throws VaneformError on tool errors. */
  async callJson<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const result = await this.callTool(name, args)
    const text = result.content.map((item) => item.text).join('\n')
    if (result.isError) {
      throw new VaneformError(text, errorCodeOf(result.content[0]?.text ?? '') ?? (this.hasApiKey ? 'tool_error' : 'missing_api_key'))
    }
    return JSON.parse(result.content[0]?.text ?? 'null') as T
  }
}
