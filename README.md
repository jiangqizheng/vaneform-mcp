# vaneform-mcp

[![CI](https://github.com/jiangqizheng/vaneform-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/jiangqizheng/vaneform-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Listed on mcpservers.org](https://mcpservers.org/badge.svg)](https://mcpservers.org/servers/jiangqizheng/vaneform-mcp)

Website traffic lookups for AI assistants and the terminal. This repo has an MCP server, a small CLI and an agent skill for [Vaneform](https://vaneform.com), a free website traffic checker.

Ask your assistant "how much traffic does notion.so get?" or "compare figma.com and canva.com" and it answers with estimated monthly visits, month-over-month change, rank, top countries, traffic sources and registry facts. Traffic figures are **third-party traffic estimates**; see the [Vaneform methodology](https://vaneform.com/methodology).

[中文说明](README.zh-CN.md)

## What's inside

| Piece | What it is |
| --- | --- |
| Hosted MCP server | `https://vaneform.com/mcp` (Streamable HTTP). Zero install, and the recommended option. |
| `vaneform-mcp` | Local stdio MCP server for clients that only run local commands. It proxies the hosted server, so tools never drift. |
| `vaneform` CLI | `vaneform notion.so`, `vaneform compare a.com b.com`, `vaneform tld name`. It shares the same client. |
| [`skills/website-traffic-lookup`](skills/website-traffic-lookup/SKILL.md) | Agent skill (Claude / Agent Skills format) that tells an assistant when to check traffic and how to read and cite the result. |

## Tools

These tool names and descriptions come from the hosted server's `tools/list`:

| Tool | What it does | Cost |
| --- | --- | --- |
| `lookup_domain` | Cached snapshot of a domain: visits (full-site or search), registry, site profile, link-rank popularity | 1 credit |
| `compare_bulk` | Side-by-side visits and registry for several domains; fetches traffic when it is missing | 1 credit per domain |
| `compare_tld` | One name across suffixes (default `com,ai,io`) | 1 credit per domain |
| `get_account` | Plan and remaining credits | free |
| `lookup_keyword` | US keyword brief: volume, difficulty, CPC, Google occupancy (Pro) | 60 credits |

Repeating a domain lookup within 24 hours is free. Site keyword rankings (Pro, 200 credits) are available through the [API](https://vaneform.com/docs/api) with `include=search`.

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| Credits per month | 100 | 10,000 |
| API key, MCP and CLI | ✓ | ✓ |
| Domain lookup and compare (1 credit per domain, repeats within 24h free) | ✓ | ✓ |
| Keyword brief (60 credits) | | ✓ |
| Site keyword rankings (200 credits) | | ✓ |

Each key allows 60 requests a minute and 5,000 a day (429 `lookup_rate_exceeded` above that). See [pricing](https://vaneform.com/pricing).

## Get a free API key

Discovery (`initialize`, `tools/list`) is open. **Tool calls need a Vaneform API key.**

1. Sign in at [vaneform.com](https://vaneform.com) and create a key at [vaneform.com/account/api](https://vaneform.com/account/api). A free account is enough.
2. Remote: send `Authorization: Bearer vf_live_…` or `X-API-Key: vf_live_…`. Local server and CLI: set `VANEFORM_API_KEY`.

Without a key, tools still list, and a call returns a sign-up link plus a browser link such as `https://vaneform.com/?q=notion.so`.

## Install

### Claude Code (remote)

```bash
claude mcp add --transport http --scope user vaneform https://vaneform.com/mcp \
  --header "Authorization: Bearer vf_live_…"
```

### Cursor (remote)

`~/.cursor/mcp.json` (or `.cursor/mcp.json` in a project):

```json
{
  "mcpServers": {
    "vaneform": {
      "url": "https://vaneform.com/mcp",
      "headers": { "Authorization": "Bearer vf_live_…" }
    }
  }
}
```

### Claude Desktop (local stdio)

The simplest Claude Desktop setup that passes your key is the local proxy. Edit `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/`, Windows: `%APPDATA%\Claude\`):

```json
{
  "mcpServers": {
    "vaneform": {
      "command": "npx",
      "args": ["-y", "github:jiangqizheng/vaneform-mcp"],
      "env": { "VANEFORM_API_KEY": "vf_live_…" }
    }
  }
}
```

The package isn't on npm yet, so `npx` installs it from GitHub. The first start takes a little longer because it builds once. If `npx` exits right away on an old system npm (Debian's packaged npm 9.2 does this with GitHub packages), run `npm install -g github:jiangqizheng/vaneform-mcp` and use `"command": "vaneform-mcp"` with no args.

### Codex

```bash
export VANEFORM_API_KEY=vf_live_…
codex mcp add vaneform --url https://vaneform.com/mcp --bearer-token-env-var VANEFORM_API_KEY
```

### Any other MCP client

- Remote: URL `https://vaneform.com/mcp`, transport Streamable HTTP, header `Authorization: Bearer vf_live_…` (or `X-API-Key: vf_live_…`)
- Local: command `npx -y github:jiangqizheng/vaneform-mcp`, env `VANEFORM_API_KEY`

## CLI

```bash
npx -p github:jiangqizheng/vaneform-mcp vaneform --help
# or clone, then: npm install && npm link
export VANEFORM_API_KEY=vf_live_…
vaneform notion.so                       # traffic overview
vaneform compare notion.so coda.io       # side by side
vaneform tld vaneform --suffixes com,ai,io
vaneform account                         # plan and remaining credits (free)
vaneform notion.so --json                # raw API JSON
```

Output with no key set:

```text
$ vaneform tools
lookup_domain   Read a cached Vaneform domain snapshot: scale (full-site or search visits), registry, site profile, and link-rank popularity.
get_account     Read the caller plan, website lookup allowance, and credit balance.
lookup_keyword  Read a US/EN keyword brief: monthly searches, difficulty, CPC, and Google occupancy.
compare_bulk    Compare domains side by side.
compare_tld     Compare the same registrable name across suffixes.

$ vaneform github.com
VANEFORM_API_KEY is not set, so this tool cannot call the Vaneform API.
Create a free API key at https://vaneform.com/account/api (100 credits a month; 1 credit per domain).
Check it in a browser instead: https://vaneform.com/?q=github.com
```

With a key, `vaneform <domain>` prints visits, MoM change, rank, top countries, sources, registry dates and the report link, followed by `Data: Vaneform (third-party traffic estimates)`.

## Talk to the hosted server directly

```bash
curl -s https://vaneform.com/mcp \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

The same key works for the REST API: [docs](https://vaneform.com/docs/api), [OpenAPI](https://vaneform.com/api/v1/openapi.json).

## Agent skill

Copy the skill so your assistant knows when to reach for traffic data and how to cite it:

```bash
# Claude Code (user-wide)
mkdir -p ~/.claude/skills/website-traffic-lookup
curl -fsSL https://raw.githubusercontent.com/jiangqizheng/vaneform-mcp/main/skills/website-traffic-lookup/SKILL.md \
  -o ~/.claude/skills/website-traffic-lookup/SKILL.md
```

For other agents that read `SKILL.md` folders, put it in that agent's skills directory (for example `.agents/skills/` in a project). Vaneform also serves a lower-level API skill at [vaneform.com/skill.md](https://vaneform.com/skill.md).

## Reading the numbers

- `status: "missing"` means Vaneform hasn't cached that domain yet. It does not mean zero traffic. `compare_bulk` fetches it.
- Every estimate carries its month (`as_of`) and a `confidence` label. Quote them.
- Cite results as "Vaneform (third-party traffic estimates)".

## Development

```bash
npm install        # also builds dist/
npm run lint       # biome + tsc
npm test           # unit tests + a stdio test with the official MCP SDK client
VANEFORM_MCP_URL=http://localhost:3000/mcp node dist/bin/vaneform.js tools   # point at another server
```

The runtime has no dependencies and needs Node 18 or newer. This repo contains only the client. No data collection code lives here.

## License

[MIT](LICENSE). The license covers this code only, not data returned by the API. Traffic figures are third-party estimates served by [Vaneform](https://vaneform.com).
