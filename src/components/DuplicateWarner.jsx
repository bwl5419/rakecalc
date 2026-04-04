import { useState } from 'react'

export function DuplicateWarner({ duplicateGroups, onResolve }) {
  const [open, setOpen] = useState(false)
  const [resolving, setResolving] = useState(null) // id being resolved
  const [error, setError] = useState(null)

  if (!duplicateGroups || duplicateGroups.length === 0) return null

  const handleKeep = async (keepId, group) => {
    const deleteIds = group.map((p) => p.id).filter((id) => id !== keepId)
    setResolving(keepId)
    setError(null)
    try {
      await onResolve(keepId, deleteIds)
    } catch (e) {
      setError(e.message)
      setResolving(null)
    }
    setResolving(null)
    // If this was the last group, close the modal
    if (duplicateGroups.length === 1) setOpen(false)
  }

  return (
    <>
      {/* Warning banner */}
      <div className="mb-3 flex items-center justify-between px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-amber-500 text-sm">⚠</span>
          <span className="text-xs font-medium text-amber-800">
            {duplicateGroups.length} duplicate {duplicateGroups.length === 1 ? 'player' : 'players'} detected
          </span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline"
        >
          Review
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 max-h-[80vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Duplicate Players</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Choose which entry to keep for each group. The others will be deleted.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-300 hover:text-gray-600 text-xl leading-none ml-4"
              >
                ×
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              {error && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  Error: {error}
                </div>
              )}

              {duplicateGroups.map((group) => (
                <div key={group[0].nickname.toLowerCase()} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    "{group[0].nickname.toLowerCase()}" — {group.length} entries
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-t border-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs text-gray-400 font-normal">Nickname (exact)</th>
                        <th className="px-4 py-2 text-right text-xs text-gray-400 font-normal">Rakeback %</th>
                        <th className="px-4 py-2 text-center text-xs text-gray-400 font-normal">Last Seen</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {group.map((player) => (
                        <tr key={player.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium text-gray-800">{player.nickname}</td>
                          <td className="px-4 py-2.5 text-right text-gray-600">{Number(player.rakeback_pct).toFixed(1)}%</td>
                          <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{player.last_seen || '—'}</td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => handleKeep(player.id, group)}
                              disabled={resolving === player.id}
                              className="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white rounded-lg font-medium transition-colors"
                            >
                              {resolving === player.id ? '…' : 'Keep'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            {/* Modal footer */}
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
