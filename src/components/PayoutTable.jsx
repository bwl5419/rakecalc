import { useState } from 'react'
import { exportPayoutCsv } from '../lib/exportCsv'

const LOW_PAYOUT_THRESHOLD = 1.00

const SORT_OPTIONS = [
  { value: 'file',        label: 'File order' },
  { value: 'payout-desc', label: 'Payout high → low' },
  { value: 'payout-asc',  label: 'Payout low → high' },
  { value: 'rake-desc',   label: 'Rake high → low' },
  { value: 'rake-asc',    label: 'Rake low → high' },
  { value: 'name-asc',    label: 'Name A → Z' },
]

function applySort(rows, sortMode) {
  const r = [...rows]
  switch (sortMode) {
    case 'file':
      return r.sort((a, b) => a.fileIndex - b.fileIndex)
    case 'payout-desc':
      return r.sort((a, b) => b.payout - a.payout)
    case 'payout-asc':
      return r.sort((a, b) => a.payout - b.payout)
    case 'rake-desc':
      return r.sort((a, b) => b.rakeTotal - a.rakeTotal)
    case 'rake-asc':
      return r.sort((a, b) => a.rakeTotal - b.rakeTotal)
    case 'name-asc':
      return r.sort((a, b) => a.nickname.localeCompare(b.nickname))
    default:
      return r
  }
}

export function PayoutTable({ rows, activeGroupMembers, periodLabel, onTogglePaid, onSaveWeek, onSettleWeek, savedWeekId }) {
  const [sortMode, setSortMode] = useState('file')
  const [hideLow, setHideLow] = useState(false)
  const [newOnly, setNewOnly] = useState(false)

  if (!rows || rows.length === 0) return null

  // --- Group filter (case-insensitive) with debug logging ---
  let filteredRows
  if (activeGroupMembers) {
    filteredRows = rows.filter((r) => {
      const lc = r.nickname.toLowerCase()
      const match = activeGroupMembers.has(lc)
      return match
    })
    console.log(
      `[GroupFilter] active group has ${activeGroupMembers.size} members | xlsx has ${rows.length} rows | matched ${filteredRows.length}`,
      '\nGroup members (lowercase):', [...activeGroupMembers].sort(),
      '\nXlsx nicknames (lowercase):', rows.map((r) => r.nickname.toLowerCase()).sort()
    )
  } else {
    filteredRows = rows
  }

  const totalRake = filteredRows.reduce((s, r) => s + r.rakeTotal, 0)
  const totalPayout = filteredRows.reduce((s, r) => s + r.payout, 0)
  const allPaid = filteredRows.every((r) => r.paid)
  const lowCount = filteredRows.filter((r) => r.payout < LOW_PAYOUT_THRESHOLD).length
  const newCount = filteredRows.filter((r) => r.isNew).length

  const sorted = applySort(filteredRows, sortMode)
  const afterLow = hideLow ? sorted.filter((r) => r.payout >= LOW_PAYOUT_THRESHOLD) : sorted
  const displayed = newOnly ? afterLow.filter((r) => r.isNew) : afterLow

  return (
    <div className="mt-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-4 bg-gray-900 text-white rounded-xl">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Period</p>
          <p className="font-semibold">{periodLabel}</p>
          {activeGroupMembers && (
            <p className="text-xs text-blue-400 mt-0.5">{filteredRows.length} players in group</p>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Rake</p>
          <p className="font-semibold">${totalRake.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Rakeback Owed</p>
          <p className="text-2xl font-bold text-green-400">${totalPayout.toFixed(2)}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportPayoutCsv(filteredRows, periodLabel)}
            className="px-3 py-1.5 text-sm bg-white text-gray-900 rounded-lg hover:bg-gray-100 font-medium"
          >
            Export CSV
          </button>
          {!savedWeekId && (
            <button
              onClick={onSaveWeek}
              className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 rounded-lg font-medium"
            >
              Save this week
            </button>
          )}
          {savedWeekId && !allPaid && (
            <button
              onClick={onSettleWeek}
              className="px-3 py-1.5 text-sm bg-emerald-500 hover:bg-emerald-600 rounded-lg font-medium"
            >
              Settle week
            </button>
          )}
          {savedWeekId && allPaid && (
            <span className="px-3 py-1.5 text-sm bg-emerald-700 rounded-lg font-medium opacity-70">
              All paid ✓
            </span>
          )}
        </div>
      </div>

      {/* No group matches */}
      {activeGroupMembers && filteredRows.length === 0 && (
        <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
          No players from this group found in the uploaded file. Check the browser console for a nickname comparison.
        </div>
      )}

      {/* Sort + filter controls */}
      <div className="flex items-center justify-between mb-2 px-1 gap-2 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Sort select */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-400">Sort:</label>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {newCount > 0 && (
            <button
              onClick={() => setNewOnly((v) => !v)}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors whitespace-nowrap ${
                newOnly
                  ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500'
                  : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
              }`}
            >
              {newOnly ? `Showing ${newCount} new` : `New players only (${newCount})`}
            </button>
          )}
        </div>

        {lowCount > 0 && (
          <div className="flex items-center gap-2">
            <p className="text-xs text-red-500">
              Rows in red are under $1.00 and are typically not paid out.
            </p>
            <button
              onClick={() => setHideLow((v) => !v)}
              className="text-xs text-gray-400 hover:text-gray-600 underline whitespace-nowrap"
            >
              {hideLow ? `Show ${lowCount} hidden` : `Hide ${lowCount} under $1`}
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Player</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Agent</th>
              <th className="px-4 py-3 text-right">Rake Generated</th>
              <th className="px-4 py-3 text-right">Rakeback %</th>
              <th className="px-4 py-3 text-right">Payout Owed</th>
              <th className="px-4 py-3 text-center">Paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayed.map((row) => {
              const isLow = row.payout < LOW_PAYOUT_THRESHOLD
              return (
                <tr
                  key={row.nickname}
                  className={`
                    ${isLow ? 'bg-red-50' : row.isNew ? 'bg-yellow-50' : 'bg-white'}
                    ${row.paid ? 'opacity-50' : ''}
                    hover:brightness-95 transition-colors
                  `}
                >
                  <td className={`px-4 py-3 font-medium ${isLow ? 'text-red-700' : 'text-gray-900'}`}>
                    {row.nickname}
                    {row.isNew && (
                      <span className="ml-2 text-xs bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded font-normal">
                        New — set rate
                      </span>
                    )}
                  </td>
                  <td className={`px-4 py-3 ${isLow ? 'text-red-400' : 'text-gray-500'}`}>{row.role || '—'}</td>
                  <td className={`px-4 py-3 ${isLow ? 'text-red-400' : 'text-gray-500'}`}>{row.agent || '—'}</td>
                  <td className={`px-4 py-3 text-right ${isLow ? 'text-red-600' : 'text-gray-700'}`}>${row.rakeTotal.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right ${isLow ? 'text-red-600' : 'text-gray-700'}`}>{row.rakebackPct.toFixed(1)}%</td>
                  <td className={`px-4 py-3 text-right font-semibold ${isLow ? 'text-red-700' : 'text-gray-900'}`}>
                    ${row.payout.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {savedWeekId ? (
                      <input
                        type="checkbox"
                        checked={row.paid}
                        onChange={() => onTogglePaid(row.nickname)}
                        className="w-4 h-4 accent-emerald-500 cursor-pointer"
                      />
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
