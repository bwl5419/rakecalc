/**
 * Download the payout table as a CSV file.
 * rows: array of { nickname, role, agent, rakeTotal, rakebackPct, payout, paid }
 * periodLabel: string used for the filename
 */
export function exportPayoutCsv(rows, periodLabel) {
  const headers = ['Player', 'Role', 'Agent', 'Rake Generated', 'Rakeback %', 'Payout Owed', 'Paid']
  const escape = (v) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }

  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        escape(r.nickname),
        escape(r.role),
        escape(r.agent),
        r.rakeTotal.toFixed(2),
        r.rakebackPct.toFixed(2),
        r.payout.toFixed(2),
        r.paid ? 'Yes' : 'No',
      ].join(',')
    ),
  ]

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const safePeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_')
  a.href = url
  a.download = `rakecalc_${safePeriod}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
