import { ATTRIBUTION, SIGN_UP_URL, VaneformClient, VaneformError, VERSION } from './client.js'
import { formatAccount, formatCompare, formatDomain } from './format.js'

const HELP = `vaneform ${VERSION} — website traffic lookups from the terminal (${ATTRIBUTION})

Usage
  vaneform <domain>                     Traffic overview from the cached snapshot
  vaneform compare <domain> <domain>…   Compare sites side by side (fetches missing traffic)
  vaneform tld <name> [--suffixes com,ai,io]
                                        Compare one name across suffixes
  vaneform account                      Plan and remaining API points (free)
  vaneform tools                        List the hosted MCP tools

Options
  --json      Print the raw API JSON
  --help      Show this help
  --version   Show the version

Environment
  VANEFORM_API_KEY   API key (vf_live_…). Included with Pro: ${SIGN_UP_URL}
                     Without it, the CLI prints a browser link (3 free lookups a day, 999 signed in).`

type Out = { stdout: (text: string) => void; stderr: (text: string) => void }

const defaultOut: Out = {
  stdout: (text) => process.stdout.write(`${text}\n`),
  stderr: (text) => process.stderr.write(`${text}\n`),
}

export async function runCli(argv: string[], client: VaneformClient = VaneformClient.fromEnv(), out: Out = defaultOut): Promise<number> {
  const flags = new Set(argv.filter((arg) => arg.startsWith('--') && !arg.includes('=')))
  const suffixArg = argv.find((arg) => arg.startsWith('--suffixes='))?.slice('--suffixes='.length)
  const positional: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string
    if (arg === '--suffixes') {
      i++
      continue
    }
    if (!arg.startsWith('--')) positional.push(arg)
  }
  const suffixes = suffixArg ?? (argv.includes('--suffixes') ? argv[argv.indexOf('--suffixes') + 1] : undefined)
  const json = flags.has('--json')

  if (flags.has('--version')) {
    out.stdout(VERSION)
    return 0
  }
  const [command, ...rest] = positional
  if (flags.has('--help') || !command) {
    out.stdout(HELP)
    return command || flags.has('--help') ? 0 : 1
  }

  try {
    if (command === 'tools') {
      const tools = await client.listTools()
      out.stdout(
        json
          ? JSON.stringify(tools, null, 2)
          : tools.map((tool) => `${tool.name.padEnd(16)}${(tool.description ?? '').split('. ')[0]}.`).join('\n'),
      )
      return 0
    }
    if (command === 'account') {
      const body = await client.callJson('get_account')
      out.stdout(json ? JSON.stringify(body, null, 2) : formatAccount(body))
      return 0
    }
    if (command === 'compare') {
      if (rest.length === 0) {
        out.stderr('Usage: vaneform compare <domain> <domain>…')
        return 1
      }
      const body = await client.callJson('compare_bulk', { q: rest.join(',') })
      out.stdout(json ? JSON.stringify(body, null, 2) : formatCompare(body))
      return 0
    }
    if (command === 'tld') {
      const name = rest[0]
      if (!name) {
        out.stderr('Usage: vaneform tld <name> [--suffixes com,ai,io]')
        return 1
      }
      const body = await client.callJson('compare_tld', suffixes ? { q: name, s: suffixes } : { q: name })
      out.stdout(json ? JSON.stringify(body, null, 2) : formatCompare(body))
      return 0
    }
    const domain = command === 'lookup' ? rest[0] : command
    if (!domain) {
      out.stderr('Usage: vaneform <domain>')
      return 1
    }
    const body = await client.callJson('lookup_domain', { domain })
    out.stdout(json ? JSON.stringify(body, null, 2) : formatDomain(body))
    return 0
  } catch (error) {
    if (error instanceof VaneformError) {
      out.stderr(error.message)
      return error.code === 'missing_api_key' ? 2 : 1
    }
    throw error
  }
}
