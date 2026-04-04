import { useState } from 'react'
import { exportPayoutCsv } from '../lib/exportCsv'

const LOW_PAYOUT_THRESHOLD = 1.00

export function PayoutTable({ rows, periodLabel, onTogglePaid, onSaveWeek, onSettleWeek, savedWeekId }) {
  const [sortDir, setSortDir] = useState('desc') // 'desc' | 'asc'
  const [hideLow, setHideLow] = useState(false)
  const [newOnly, setNewOnly] = useState(false)

  if (!rows || rows.length === 0) return null

  const totalRake = rows.reduce((s, r) => s + r.rakeTotal, 0)
  const totalPayout = rows.reduce((s, r) => s + r.payout, 0)
  const allPaid = rows.every((r) => r.paid)
  const lowCount = rows.filter((r) => r.payout < LOW_PAYOUT_THRESHOLD).length
  const newCount = rows.filter((r) => r.isNew).length

  const sorted = [...rows].sort((a, b) =>
    sortDir === 'desc' ? b.payout - a.payout : a.payout - b.payout
  )
  const afterLow = hideLow ? sorted.filter((r) => r.payout >= LOW_PAYOUT_THRESHOLD) : sorted
  const displayed = newOnly ? afterLow.filter((r) => r.isNew) : afterLow

  return (
    <div className="mt-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-4 bg-gray-900 text-white rounded-xl">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Period</p>
          <p className="font-semibold">{periodLabel}</p>
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
            onClick={() => exportPayoutCsv(rows, periodLabel)}
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

      {/* Filter toggles */}
      {(lowCount > 0 || newCount > 0) && (
        <div className="flex items-center justify-between mb-2 px-1 gap-2 flex-wrap">
          <div className="flex items-center gap-3">
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
      )}

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
              <th
                className="px-4 py-3 text-right cursor-pointer select-none hover:text-gray-800 group"
                onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                title="Click to toggle sort order"
              >
                <span className="inline-flex items-center gap-1 justify-end">
                  Payout Owed
                  <span className="text-gray-400 group-hover:text-gray-600">
                    {sortDir === 'desc' ? '↓' : '↑'}
                  </span>
                </span>
              </th>
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
