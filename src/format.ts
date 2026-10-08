/** Plain-text views of Vaneform API payloads for the CLI. */
import { ATTRIBUTION } from './client.js'

type Obj = Record<string, unknown>

const asObj = (value: unknown): Obj | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Obj) : undefined
const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)
const str = (value: unknown): string | undefined => (typeof value === 'string' && value ? value : undefined)

export function compactNumber(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e9) return `${(value / 1e9).toFixed(abs >= 1e10 ? 1 : 2)}B`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(abs >= 1e7 ? 1 : 2)}M`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`
  return String(Math.round(value))
}

const pct = (share: number) => `${(share * 100).toFixed(1)}%`

function row(label: string, value: string | undefined): string | null {
  return value ? `  ${label.padEnd(16)}${value}` : null
}

function visitsLine(scale: Obj | undefined): string | undefined {
  const visits = num(scale?.visits)
  if (visits == null) return undefined
  const parts = [`${compactNumber(visits)} / month`]
  const mom = num(scale?.visits_mom_change_pct)
  if (mom != null) parts.push(`${mom >= 0 ? '+' : ''}${mom.toFixed(1)}% MoM`)
  const meta = [
    str(scale?.month),
    str(scale?.estimate) && `${scale?.estimate} estimate`,
    str(scale?.confidence) && `confidence ${scale?.confidence}`,
  ]
    .filter(Boolean)
    .join(', ')
  return meta ? `${parts.join('  ')}  (${meta})` : parts.join('  ')
}

function regionsLine(scale: Obj | undefined): string | undefined {
  const regions = Array.isArray(scale?.top_regions) ? (scale.top_regions as Obj[]) : []
  const items = regions
    .slice(0, 5)
    .flatMap((item) => (str(item.country) && num(item.share) != null ? [`${item.country} ${pct(num(item.share) as number)}`] : []))
  return items.length ? items.join(' · ') : undefined
}

function sourcesLine(scale: Obj | undefined): string | undefined {
  const sources = asObj(scale?.sources)
  if (!sources) return undefined
  const items = Object.entries(sources)
    .flatMap(([channel, share]) => (num(share) != null ? [[channel, num(share) as number] as const] : []))
    .sort((a, b) => b[1] - a[1])
    .map(([channel, share]) => `${channel} ${pct(share)}`)
  return items.length ? items.join(' · ') : undefined
}

function registryLine(registry: Obj | undefined): string | undefined {
  if (!registry) return undefined
  const created = str(registry.created_at)?.slice(0, 10)
  const expires = str(registry.expires_at)?.slice(0, 10)
  const parts = [created && `created ${created}`, expires && `expires ${expires}`, str(registry.registrar)].filter(Boolean)
  return parts.length ? parts.join(' · ') : undefined
}

function rankLine(scale: Obj | undefined): string | undefined {
  const global = num(scale?.global_rank)
  const country = asObj(scale?.country_rank)
  const parts = [
    global != null ? `#${global.toLocaleString('en-US')} global` : undefined,
    country && num(country.rank) != null
      ? `#${(num(country.rank) as number).toLocaleString('en-US')} in ${str(country.country) ?? '?'}`
      : undefined,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : undefined
}

export function formatDomain(payload: unknown): string {
  const body = asObj(payload) ?? {}
  const scale = asObj(body.scale)
  const lines: (string | null)[] = [`${str(body.domain) ?? '?'}  [${str(body.status) ?? 'unknown'}]`]
  if (body.status === 'missing') {
    lines.push('  Not cached yet (this is not zero traffic).')
    lines.push(`  Run \`vaneform compare ${str(body.domain) ?? '<domain>'}\` to fetch traffic (1 point), or open it on vaneform.com.`)
  }
  lines.push(
    row('Visits', visitsLine(scale)),
    row('Rank', rankLine(scale)),
    row('Top countries', regionsLine(scale)),
    row('Sources', sourcesLine(scale)),
    row('Category', str(scale?.category)),
    row('Registry', registryLine(asObj(body.registry))),
    row('Report', str(body.report_url)),
    `Data: ${ATTRIBUTION}`,
  )
  return lines.filter((line): line is string => line !== null).join('\n')
}

export function formatCompare(payload: unknown): string {
  const body = asObj(payload) ?? {}
  const items = Array.isArray(body.items) ? (body.items as Obj[]) : []
  const header = ['Domain', 'Visits/mo', 'MoM', 'Global rank', 'Month', 'Created']
  const rows = items.map((item) => {
    const scale = asObj(item.scale)
    const visits = num(scale?.visits)
    const mom = num(scale?.visits_mom_change_pct)
    const rank = num(scale?.global_rank)
    return [
      str(item.domain) ?? '?',
      visits != null ? compactNumber(visits) : (str(scale?.status) ?? '-'),
      mom != null ? `${mom >= 0 ? '+' : ''}${mom.toFixed(1)}%` : '-',
      rank != null ? `#${rank.toLocaleString('en-US')}` : '-',
      str(scale?.month) ?? '-',
      str(asObj(item.registry)?.created_at)?.slice(0, 10) ?? '-',
    ]
  })
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)))
  const render = (cells: string[]) =>
    cells
      .map((cell, i) => cell.padEnd(widths[i] ?? 0))
      .join('  ')
      .trimEnd()
  return [render(header), ...rows.map(render), `Data: ${ATTRIBUTION}`].join('\n')
}

export function formatAccount(payload: unknown): string {
  const body = asObj(payload) ?? {}
  const credits = asObj(body.credits)
  const lookup = asObj(body.lookup)
  return [
    `Plan: ${str(body.plan) ?? '?'}`,
    credits
      ? `API points: ${num(credits.remaining) ?? '?'} left of ${num(credits.limit) ?? '?'} (resets ${str(credits.resets_at) ?? '?'})`
      : null,
    lookup ? `Website lookups today: ${num(lookup.remaining) ?? 'unlimited'} left` : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n')
}
