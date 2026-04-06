import { useState, useMemo, useCallback } from 'react'
import { parseClubGGFile } from './lib/parseXlsx'
import { useRoster } from './hooks/useRoster'
import { useHistory } from './hooks/useHistory'
import { useGroups } from './hooks/useGroups'
import { UploadZone } from './components/UploadZone'
import { PayoutTable } from './components/PayoutTable'
import { RosterPanel } from './components/RosterPanel'
import { HistoryView } from './components/HistoryView'

const DEFAULT_PCT_STORAGE_KEY = 'rakecalc_default_pct'

function getStoredDefaultPct() {
  const v = localStorage.getItem(DEFAULT_PCT_STORAGE_KEY)
  const n = parseFloat(v)
  return isNaN(n) ? 30 : n
}

export default function App() {
  const [tab, setTab] = useState('main') // 'main' | 'history'
  const [parseError, setParseError] = useState(null)
  const [parsedFile, setParsedFile] = useState(null) // { periodLabel, rows }
  const [paidSet, setPaidSet] = useState(new Set()) // Set of nicknames paid this session
  const [defaultPct, setDefaultPct] = useState(getStoredDefaultPct)
  const [savedWeekId, setSavedWeekId] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [activeGroupId, setActiveGroupId] = useState(null)

  const { roster, loading: rosterLoading, updatePct, addPlayer, removePlayer, bulkRemovePlayers, syncFromFile, importFromCsv, duplicateGroups, resolveGroup } = useRoster()
  const { history, loading: historyLoading, saveWeek, settleWeek } = useHistory()
  const { groups, groupMemberMap, createGroup, deleteGroup, addPlayersToGroup, removePlayerFromGroup } = useGroups()

  // Build a fast lookup map from roster
  const rosterMap = useMemo(
    () => new Map(roster.map((p) => [p.nickname, p])),
    [roster]
  )

  // Set of nicknames in the most recently uploaded file — for "this week" filter
  const thisWeekNicknames = useMemo(
    () => parsedFile ? new Set(parsedFile.rows.map((r) => r.nickname)) : null,
    [parsedFile]
  )

  // Active group name for display
  const activeGroupName = useMemo(
    () => (activeGroupId ? (groups.find((g) => g.id === activeGroupId)?.name ?? null) : null),
    [activeGroupId, groups]
  )

  // Compute payout rows by cross-referencing parsed file with roster
  const payoutRows = useMemo(() => {
    if (!parsedFile) return []
    return parsedFile.rows.map((row) => {
      const player = rosterMap.get(row.nickname)
      const rakebackPct = player ? player.rakeback_pct : defaultPct
      const isNew = !player
      return {
        ...row,
        rakebackPct,
        payout: row.rakeTotal * (rakebackPct / 100),
        isNew,
        paid: paidSet.has(row.nickname),
      }
    })
  }, [parsedFile, rosterMap, defaultPct, paidSet])

  // Filter payout rows by active group
  const filteredPayoutRows = useMemo(() => {
    if (!activeGroupId) return payoutRows
    const members = groupMemberMap.get(activeGroupId)
    if (!members) return []
    return payoutRows.filter((r) => members.has(r.nickname))
  }, [payoutRows, activeGroupId, groupMemberMap])

  const handleFile = useCallback(
    async (arrayBuffer, err) => {
      setParseError(null)
      setParsedFile(null)
      setPaidSet(new Set())
      setSavedWeekId(null)

      if (err) {
        setParseError(err)
        return
      }

      let parsed
      try {
        parsed = parseClubGGFile(arrayBuffer)
      } catch (e) {
        setParseError(e.message)
        return
      }

      setSyncing(true)
      try {
        await syncFromFile(parsed.rows, defaultPct)
      } catch (e) {
        setParseError('File parsed OK, but failed to sync roster: ' + e.message)
      } finally {
        setSyncing(false)
      }

      setParsedFile(parsed)
    },
    [syncFromFile, defaultPct]
  )

  const handleTogglePaid = useCallback((nickname) => {
    setPaidSet((prev) => {
      const next = new Set(prev)
      if (next.has(nickname)) next.delete(nickname)
      else next.add(nickname)
      return next
    })
  }, [])

  const handleSaveWeek = useCallback(async () => {
    if (!parsedFile || savedWeekId) return
    const totalRake = payoutRows.reduce((s, r) => s + r.rakeTotal, 0)
    const totalPayout = payoutRows.reduce((s, r) => s + r.payout, 0)
    try {
      const entry = await saveWeek({
        periodLabel: parsedFile.periodLabel,
        rows: payoutRows.map(({ nickname, role, agent, rakeTotal, rakebackPct, payout, paid }) => ({
          nickname, role, agent, rakeTotal, rakebackPct, payout, paid,
        })),
        totalRake,
        totalPayout,
      })
      setSavedWeekId(entry.id)
    } catch (e) {
      setParseError('Failed to save week: ' + e.message)
    }
  }, [parsedFile, payoutRows, saveWeek, savedWeekId])

  const handleSettleWeek = useCallback(async () => {
    if (!savedWeekId) return
    try {
      await settleWeek(savedWeekId)
    } catch (e) {
      setParseError('Failed to settle week: ' + e.message)
    }
  }, [savedWeekId, settleWeek])

  const handleDefaultPctChange = useCallback((val) => {
    setDefaultPct(val)
    localStorage.setItem(DEFAULT_PCT_STORAGE_KEY, String(val))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">♠</span>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">RakeCalc</h1>
            <span className="text-xs text-gray-400 hidden sm:block">ClubGG Rakeback Calculator</span>
          </div>
          <nav className="flex gap-1">
            {['main', 'history'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === t
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {t === 'main' ? 'Calculator' : 'History'}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-screen-xl mx-auto px-4 py-6">
        {tab === 'history' ? (
          <HistoryView
            history={history}
            loading={historyLoading}
            groups={groups}
            groupMemberMap={groupMemberMap}
            activeGroupId={activeGroupId}
            onGroupFilterChange={setActiveGroupId}
          />
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left panel — upload + payout */}
            <div className="flex-1 min-w-0">
              <UploadZone onFile={handleFile} disabled={syncing} />

              {syncing && (
                <p className="text-sm text-blue-500 mt-3 text-center">Syncing roster…</p>
              )}

              {parseError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {parseError}
                </div>
              )}

              {parsedFile && (
                <PayoutTable
                  rows={filteredPayoutRows}
                  periodLabel={parsedFile.periodLabel}
                  onTogglePaid={handleTogglePaid}
                  onSaveWeek={handleSaveWeek}
                  onSettleWeek={handleSettleWeek}
                  savedWeekId={savedWeekId}
                  activeGroupName={activeGroupName}
                />
              )}

              {!parsedFile && !parseError && !syncing && (
                <div className="mt-8 text-center text-gray-300 text-sm">
                  Upload a file to see this week's payouts
                </div>
              )}
            </div>

            {/* Right panel — roster */}
            <div className="w-full lg:w-96 xl:w-[420px]">
              <div className="bg-white rounded-xl border border-gray-200 p-4 lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] overflow-hidden flex flex-col">
                {rosterLoading ? (
                  <p className="text-sm text-gray-400 text-center py-8">Loading roster…</p>
                ) : (
                  <RosterPanel
                    roster={roster}
                    defaultPct={defaultPct}
                    onDefaultPctChange={handleDefaultPctChange}
                    onUpdatePct={updatePct}
                    onAddPlayer={addPlayer}
                    onRemovePlayer={removePlayer}
                    onBulkRemove={bulkRemovePlayers}
                    onImportCsv={importFromCsv}
                    thisWeekNicknames={thisWeekNicknames}
                    duplicateGroups={duplicateGroups}
                    onResolveGroup={resolveGroup}
                    groups={groups}
                    groupMemberMap={groupMemberMap}
                    onCreateGroup={createGroup}
                    onDeleteGroup={deleteGroup}
                    onAddPlayersToGroup={addPlayersToGroup}
                    onRemovePlayerFromGroup={removePlayerFromGroup}
                    activeGroupId={activeGroupId}
                    onGroupFilterChange={setActiveGroupId}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
