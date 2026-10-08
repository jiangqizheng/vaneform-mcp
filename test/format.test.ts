import { describe, expect, it } from 'vitest'

import { compactNumber, formatCompare, formatDomain } from '../src/format.js'

describe('format', () => {
  it('abbreviates large numbers', () => {
    expect(compactNumber(1_234_567_890)).toBe('1.23B')
    expect(compactNumber(45_600_000)).toBe('45.6M')
    expect(compactNumber(8_900)).toBe('8.9K')
    expect(compactNumber(512)).toBe('512')
  })

  it('renders a domain snapshot with attribution', () => {
    const text = formatDomain({
      domain: 'example.com',
      status: 'ready',
      scale: {
        month: '2026-08',
        estimate: 'site',
        confidence: 'medium',
        visits: 1_500_000,
        visits_mom_change_pct: -2.5,
        global_rank: 12345,
        top_regions: [{ country: 'United States', share: 0.42 }],
        sources: { search: 0.3, direct: 0.6 },
      },
      registry: { created_at: '1995-08-14T04:00:00Z', registrar: 'Example Registrar' },
      report_url: 'https://vaneform.com/e/abc',
    })
    expect(text).toContain('1.50M / month')
    expect(text).toContain('-2.5% MoM')
    expect(text).toContain('United States 42.0%')
    expect(text).toMatch(/direct 60\.0% · search 30\.0%/)
    expect(text).toContain('created 1995-08-14')
    expect(text).toContain('Data: Vaneform (data: Similarweb estimates)')
  })

  it('explains a missing snapshot', () => {
    expect(formatDomain({ domain: 'new.example', status: 'missing' })).toContain('not zero traffic')
  })

  it('renders a compare table', () => {
    const text = formatCompare({
      items: [
        { domain: 'a.com', scale: { visits: 2_000_000, month: '2026-08' } },
        { domain: 'b.com', scale: { status: 'missing' } },
      ],
    })
    expect(text.split('\n')[1]).toMatch(/^a\.com\s+2\.00M/)
    expect(text.split('\n')[2]).toMatch(/^b\.com\s+missing/)
  })
})
