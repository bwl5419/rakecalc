import { useState } from 'react'

export function HistoryView({ history, loading, groups, groupMemberMap, activeGroupId, onGroupFilterChange }) {
  const [expanded, setExpanded] = useState(null)

  if (loading) {
    return <div className="text-center text-gray-400 py-16 text-sm">Loading history…</div>
  }

  if (history.length === 0) {
    return (
      <div className="text-center text-gray-400 py-16">
        <div className="text-4xl mb-3">📋</div>
        <p className="text-sm">No history yet. Upload a file and click "Save this week".</p>
      </div>
    )
  }

  const activeMembers = activeGroupId ? groupMemberMap?.get(activeGroupId) : null
  const activeGroupName = activeGroupId ? groups?.find((g) => g.id === activeGroupId)?.name : null

  return (
    <div>
      {/* Group filter bar */}
      {groups && groups.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Filter by group:</span>
          <button
            onClick={() => onGroupFilterChange(null)}
            className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
              !activeGroupId
                ? 'bg-gray-800 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            All players
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => onGroupFilterChange(activeGroupId === g.id ? null : g.id)}
              className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                activeGroupId === g.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {history.map((entry) => {
          const isOpen = expanded === entry.id

          // When a group is active, filter rows for display
          const displayRows = activeMembers
            ? (entry.rows ?? []).filter((r) => activeMembers.has(r.nickname))
            : (entry.rows ?? [])

          const groupPayout = displayRows.reduce((s, r) => s + Number(r.payout), 0)

          return (
            <div key={entry.id} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Summary row */}
              <button
                onClick={() => setExpanded(isOpen ? null : entry.id)}
                className="w-full flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white hover:bg-gray-50 text-left transition-colors"
              >
                <div className="font-medium text-gray-900 text-sm">{entry.period_label}</div>
                <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                  <span>
                    Uploaded:{' '}
                    <span className="text-gray-700">
                      {new Date(entry.uploaded_at).toLocaleDateString()}
                    </span>
                  </span>
                  <span>
                    Rake:{' '}
                    <span className="text-gray-700">${Number(entry.total_rake).toFixed(2)}</span>
                  </span>
                  <span>
                    Payout:{' '}
                    <span className="font-semibold text-gray-900">
                      {activeMembers ? (
                        <>
                          <span className="text-blue-600">${groupPayout.toFixed(2)}</span>
                          <span className="text-gray-400 font-normal text-xs ml-1">
                            / ${Number(entry.total_payout).toFixed(2)} total
                          </span>
                        </>
                      ) : (
                        `$${Number(entry.total_payout).toFixed(2)}`
                      )}
                    </span>
                  </span>
                  {entry.settled_at && (
                    <span className="text-emerald-600 font-medium">
                      Settled {new Date(entry.settled_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
              </button>

              {/* Expanded breakdown */}
              {isOpen && displayRows.length > 0 && (
                <div className="border-t border-gray-100 overflow-x-auto">
                  {activeGroupName && (
                    <div className="px-4 py-2 bg-blue-50 text-xs text-blue-600 font-medium">
                      Showing {displayRows.length} player{displayRows.length === 1 ? '' : 's'} in "{activeGroupName}" · Payout: ${groupPayout.toFixed(2)}
                    </div>
                  )}
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-400 uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-2 text-left">Player</th>
                        <th className="px-4 py-2 text-left">Role</th>
                        <th className="px-4 py-2 text-left">Agent</th>
                        <th className="px-4 py-2 text-right">Rake</th>
                        <th className="px-4 py-2 text-right">%</th>
                        <th className="px-4 py-2 text-right">Payout</th>
                        <th className="px-4 py-2 text-center">Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {displayRows.map((r) => (
                        <tr key={r.nickname} className={r.paid ? 'opacity-50' : ''}>
                          <td className="px-4 py-2 font-medium text-gray-800">{r.nickname}</td>
                          <td className="px-4 py-2 text-gray-400">{r.role || '—'}</td>
                          <td className="px-4 py-2 text-gray-400">{r.agent || '—'}</td>
                          <td className="px-4 py-2 text-right text-gray-600">${Number(r.rakeTotal).toFixed(2)}</td>
                          <td className="px-4 py-2 text-right text-gray-500">{Number(r.rakebackPct).toFixed(1)}%</td>
                          <td className="px-4 py-2 text-right font-medium text-gray-900">${Number(r.payout).toFixed(2)}</td>
                          <td className="px-4 py-2 text-center">{r.paid ? '✓' : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {isOpen && displayRows.length === 0 && (
                <div className="border-t border-gray-100 px-4 py-4 text-center text-xs text-gray-400">
                  {activeGroupName
                    ? `No players from "${activeGroupName}" in this week.`
                    : 'No data for this entry.'}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
