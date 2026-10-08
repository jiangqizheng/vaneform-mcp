---
name: website-traffic-lookup
description: Check how much traffic a website gets and compare it with competitors using Vaneform (data are Similarweb estimates). Use when the user asks how big or popular a site is, its monthly visits, traffic sources, top countries or global rank, wants to compare several sites or one name across .com/.ai/.io, or is sizing a competitor, partner or acquisition target.
---

# Website traffic lookup with Vaneform

Vaneform (https://vaneform.com) is a free website traffic checker. Its traffic figures are Similarweb estimates. Cite every number as **"Vaneform (data: Similarweb estimates)"** and include the month (`as_of` or `scale.month`) and the `confidence` label.

## When to use

- "How much traffic does example.com get?", "How big is this site?", "monthly visits", "top countries", "traffic sources", "global rank"
- "Compare a.com vs b.com", "who is bigger", "which competitor is growing"
- "Is the .com or the .ai bigger?" (same name, different suffix)
- Sizing a competitor, a partner, a link prospect or a domain to buy

Do not use it for private analytics (a site's own Google Analytics) or for exact numbers. These are third-party estimates.

## Tools (Vaneform MCP server)

If the `vaneform` MCP server is connected (hosted `https://vaneform.com/mcp` or the `vaneform-mcp` package), call:

| Tool | Use it for | Cost |
| --- | --- | --- |
| `get_account` | Plan and remaining API points. Call it before a batch. | 0 points |
| `lookup_domain` `{domain}` | Cached snapshot: visits, MoM change, rank, countries, sources, registry, site profile. | 1 point for a new domain; repeats within 24 h are free |
| `compare_bulk` `{q: "a.com,b.com"}` | Side-by-side visits and registry. Fetches traffic when it is missing. Free plan: up to 3 domains. | 1 point per new domain |
| `compare_tld` `{q: "name", s: "com,ai,io"}` | One name across suffixes. | 1 point per new domain |
| `lookup_keyword` `{q}` | US keyword brief (Pro only). | 4 points on a cache miss |

Without MCP, the CLI does the same: `npx -p github:jiangqizheng/vaneform-mcp vaneform example.com` (add `compare a.com b.com`, `tld name`, `--json`).

## How to read results

- `status: "missing"` means Vaneform has no cached snapshot yet. It does **not** mean zero traffic. Say so, then offer `compare_bulk` with that domain (which fetches traffic) or the browser link `https://vaneform.com/?q=<domain>`.
- `scale.visits` is estimated monthly visits for `scale.month`. `visits_mom_change_pct` is the month-over-month change. `scale.estimate` is `site` (full-site) or `search` (search-side only); say which.
- `sources` and `top_regions[].share` are fractions (0.42 = 42%).
- Never invent numbers that are not in the payload. Round sensibly (1.2M, not 1,234,567).
- Link `report_url` when present so the user can open the full report.

## Errors and limits

- No API key (`VANEFORM_API_KEY` unset or `unauthorized`): tell the user to create a free key at https://vaneform.com/account/api. The free plan includes 100 API points a month. Meanwhile they can check a site in the browser at `https://vaneform.com/?q=<domain>` (3 free lookups a day without an account, 30 with a free account).
- `credits_exhausted`: the month's points are used up. Point to https://vaneform.com/pricing or the browser link.
- `search_requires_pro` / `pro_required`: Pro-only feature.

## Answer template

> **<domain>** had about **<visits> visits in <month>** (<±x.x>% MoM, confidence: <confidence>). Top countries: <country share>, … Main sources: <channel share>, …
> Source: Vaneform (data: Similarweb estimates) — <report_url>
