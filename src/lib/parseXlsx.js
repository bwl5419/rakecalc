import * as XLSX from 'xlsx'

const SKIP_NICKNAMES = new Set(['', null, undefined, 'Nickname', 'NaN'])

/**
 * Parse a ClubGG weekly .xlsx export.
 * Returns { periodLabel, rows }
 * Each row: { nickname, role, agent, rakeTotal }
 */
export function parseClubGGFile(arrayBuffer) {
  let workbook
  try {
    workbook = XLSX.read(arrayBuffer, { type: 'array' })
  } catch {
    throw new Error('Could not read the file. Make sure it is a valid .xlsx file.')
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('The file contains no sheets.')

  const sheet = workbook.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })

  if (!raw || raw.length < 7) {
    throw new Error('File does not appear to be a ClubGG export — not enough rows.')
  }

  // Period label is at row index 1, column index 0
  const periodLabel = raw[1]?.[0] ? String(raw[1][0]) : 'Unknown Period'

  const rows = []
  for (let i = 6; i < raw.length; i++) {
    const row = raw[i]
    if (!row) continue

    const nickname = row[9]
    const nicknameStr = nickname == null ? '' : String(nickname).trim()

    if (SKIP_NICKNAMES.has(nicknameStr) || nicknameStr === '') continue

    const role = row[7] != null ? String(row[7]).trim() : ''
    const agent = row[3] != null ? String(row[3]).trim() : ''
    const rakeRaw = row[64]
    const rakeTotal = rakeRaw != null && rakeRaw !== '' ? parseFloat(rakeRaw) : 0

    rows.push({
      nickname: nicknameStr,
      role,
      agent,
      rakeTotal: isNaN(rakeTotal) ? 0 : rakeTotal,
    })
  }

  if (rows.length === 0) {
    throw new Error('No player data found in the file. Check that this is the correct export.')
  }

  console.log(`[parseXlsx] parsed ${rows.length} rows. Nicknames (lowercase):`, rows.map((r) => r.nickname.toLowerCase()).sort())

  return { periodLabel, rows }
}
