import { useState, useRef, useMemo, useEffect } from 'react'
import { DuplicateWarner } from './DuplicateWarner'

const PAGE_SIZE = 25

function parseCsvRoster(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const rows = []
  for (const line of lines) {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    const nickname = cols[0]
    const pct = parseFloat(cols[1])
    if (!nickname || isNaN(pct)) continue
    if (nickname.toLowerCase() === 'nickname' || nickname.toLowerCase() === 'player') continue
    rows.push({ nickname, rakeback_pct: pct })
  }
  return rows
}

function SortHeader({ label, colKey, sortKey, sortDir, onSort, className = '' }) {
  const active = sortKey === colKey
  return (
    <th
      className={`py-2 text-xs uppercase text-gray-500 tracking-wide cursor-pointer select-none hover:text-gray-800 group ${className}`}
      onClick={() => onSort(colKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={active ? 'text-gray-700' : 'text-gray-300 group-hover:text-gray-400'}>
          {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </span>
    </th>
  )
}

export function RosterPanel({
  roster,
  defaultPct,
  onDefaultPctChange,
  onUpdatePct,
  onAddPlayer,
  onRemovePlayer,
  onBulkRemove,
  onImportCsv,
  thisWeekNicknames,
  duplicateGroups,
  onResolveGroup,
}) {
  const [addName, setAddName] = useState('')
  const [addPct, setAddPct] = useState('')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState({})
  const [importStatus, setImportStatus] = useState(null)
  const [importing, setImporting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Filter / sort / paginate state
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('last_seen')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [thisWeekOnly, setThisWeekOnly] = useState(false)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState(new Set())

  const debounceTimers = useRef({})
  const importInputRef = useRef(null)
  const searchRef = useRef(null)
  const selectAllRef = useRef(null)

  const handlePctChange = (id, value) => {
    const num = parseFloat(value)
    if (isNaN(num) || num < 0 || num > 100) return
    clearTimeout(debounceTimers.current[id])
    debounceTimers.current[id] = setTimeout(async () => {
      setSaving((s) => ({ ...s, [id]: true }))
      try {
        await onUpdatePct(id, num)
      } finally {
        setSaving((s) => ({ ...s, [id]: false }))
      }
    }, 400)
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    const name = addName.trim()
    const pct = parseFloat(addPct)
    if (!name || isNaN(pct)) return
    setAdding(true)
    try {
      await onAddPlayer(name, pct)
      setAddName('')
      setAddPct('')
    } finally {
      setAdding(false)
    }
  }

  const handleImportFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setImportStatus({ error: 'Please select a .csv file.' })
      return
    }
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = ev.target.result
      let rows
      try {
        rows = parseCsvRoster(text)
      } catch {
        setImportStatus({ error: 'Failed to parse CSV.' })
        return
      }
      if (rows.length === 0) {
        setImportStatus({ error: 'No valid rows found. Expected: Nickname, Rakeback%' })
        return
      }
      setImporting(true)
      try {
        const result = await onImportCsv(rows)
        setImportStatus(result)
        setTimeout(() => setImportStatus(null), 5000)
      } catch (err) {
        setImportStatus({ error: err.message })
      } finally {
        setImporting(false)
      }
    }
    reader.readAsText(file)
  }

  const handleSort = (col) => {
    if (sortKey === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(col)
      setSortDir(col === 'last_seen' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  const handleSearch = (val) => {
    setSearch(val)
    setPage(1)
  }

  const handleThisWeekToggle = () => {
    if (!thisWeekNicknames) return
    setThisWeekOnly((v) => !v)
    setPage(1)
  }

  const handleSelectAll = () => {
    const pageIds = pageSlice.map((p) => p.id)
    const allSelected = pageIds.every((id) => selectedIds.has(id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id))
      } else {
        pageIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const handleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkDelete = async () => {
    const count = selectedIds.size
    if (!window.confirm(`Delete ${count} player${count === 1 ? '' : 's'} from the roster? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await onBulkRemove([...selectedIds])
      setSelectedIds(new Set())
    } finally {
      setDeleting(false)
    }
  }

  // Derived: filter → sort → paginate
  const filtered = useMemo(() => {
    let result = roster
    if (thisWeekOnly && thisWeekNicknames) {
      result = result.filter((p) => thisWeekNicknames.has(p.nickname))
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((p) => p.nickname.toLowerCase().includes(q))
    }
    return result
  }, [roster, search, thisWeekOnly, thisWeekNicknames])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'nickname') {
        cmp = a.nickname.localeCompare(b.nickname)
      } else if (sortKey === 'rakeback_pct') {
        cmp = a.rakeback_pct - b.rakeback_pct
      } else {
        // last_seen: nulls always last
        if (!a.last_seen && !b.last_seen) cmp = 0
        else if (!a.last_seen) cmp = 1
        else if (!b.last_seen) cmp = -1
        else cmp = a.last_seen < b.last_seen ? -1 : a.last_seen > b.last_seen ? 1 : 0
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageSlice = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const pageIds = pageSlice.map((p) => p.id)
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))
  const somePageSelected = pageIds.some((id) => selectedIds.has(id))

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = somePageSelected && !allPageSelected
    }
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900">Player Roster</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{roster.length} players</span>
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-medium transition-colors disabled:opacity-40"
            title="Import roster from CSV (col A: nickname, col B: rakeback %)"
          >
            {importing ? 'Importing…' : 'Import CSV'}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>
      </div>

      {/* Import status */}
      {importStatus && (
        <div className={`mb-3 px-3 py-2 rounded-lg text-xs font-medium ${
          importStatus.error
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {importStatus.error
            ? `Import failed: ${importStatus.error}`
            : `Import complete — ${importStatus.created} created, ${importStatus.updated} updated`}
        </div>
      )}

      {/* Duplicate warning */}
      <DuplicateWarner duplicateGroups={duplicateGroups} onResolve={onResolveGroup} />

      {/* Default % */}
      <div className="flex items-center gap-2 mb-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <label className="text-sm text-blue-800 font-medium whitespace-nowrap">Default rakeback %</label>
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          defaultValue={defaultPct}
          onChange={(e) => onDefaultPctChange(parseFloat(e.target.value) || 0)}
          className="w-20 text-sm border border-blue-200 rounded px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <span className="text-sm text-blue-700">%</span>
        <span className="text-xs text-blue-500 ml-1">applied to new players</span>
      </div>

      {/* Search + This week toggle */}
      <div className="flex gap-2 mb-2">
        <div className="relative flex-1">
          <input
            ref={searchRef}
            type="text"
            placeholder="Search players…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg pl-3 pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {search && (
            <button
              onClick={() => { handleSearch(''); searchRef.current?.focus() }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600 text-base leading-none"
              tabIndex={-1}
            >
              ×
            </button>
          )}
        </div>
        <button
          onClick={handleThisWeekToggle}
          disabled={!thisWeekNicknames}
          title={thisWeekNicknames ? 'Filter to players in the current upload' : 'Upload a file first'}
          className={`px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors whitespace-nowrap ${
            thisWeekOnly
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : thisWeekNicknames
              ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              : 'bg-gray-50 text-gray-300 cursor-not-allowed'
          }`}
        >
          This week only
        </button>
      </div>

      {/* Bulk delete bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs text-gray-500">{selectedIds.size} selected</span>
          <button
            onClick={handleBulkDelete}
            disabled={deleting}
            className="px-3 py-1 text-xs bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white rounded-lg font-medium transition-colors"
          >
            {deleting ? 'Deleting…' : `Delete selected (${selectedIds.size})`}
          </button>
        </div>
      )}

      {/* Roster table */}
      <div className="flex-1 overflow-y-auto rounded-lg border border-gray-200 min-h-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 tracking-wide sticky top-0">
            <tr>
              <th className="pl-3 pr-1 py-2 w-6">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={handleSelectAll}
                  disabled={pageIds.length === 0}
                  className="w-3.5 h-3.5 accent-blue-500 cursor-pointer disabled:cursor-default"
                  title="Select all on this page"
                />
              </th>
              <SortHeader label="Nickname" colKey="nickname" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="px-3 text-left" />
              <SortHeader label="%" colKey="rakeback_pct" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="px-3 text-right" />
              <SortHeader label="Last Seen" colKey="last_seen" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="px-3 text-center" />
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageSlice.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-400 text-xs">
                  {roster.length === 0
                    ? 'No players yet — upload a file or add one below.'
                    : 'No players match your filters.'}
                </td>
              </tr>
            )}
            {pageSlice.map((player) => (
              <tr
                key={player.id}
                className={`hover:bg-gray-50 ${selectedIds.has(player.id) ? 'bg-blue-50' : ''}`}
              >
                <td className="pl-3 pr-1 py-2 w-6">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(player.id)}
                    onChange={() => handleSelectOne(player.id)}
                    className="w-3.5 h-3.5 accent-blue-500 cursor-pointer"
                  />
                </td>
                <td className="px-3 py-2 font-medium text-gray-800">{player.nickname}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      defaultValue={player.rakeback_pct}
                      key={`${player.id}-${player.rakeback_pct}`}
                      onChange={(e) => handlePctChange(player.id, e.target.value)}
                      className="w-16 text-sm border border-gray-200 rounded px-2 py-0.5 text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <span className="text-gray-400 text-xs">%</span>
                    {saving[player.id] && (
                      <span className="text-blue-400 text-xs">•</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-center text-gray-400 text-xs">
                  {player.last_seen || '—'}
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => onRemovePlayer(player.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors text-base leading-none"
                    title="Remove player"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-2 px-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-30 rounded-lg font-medium transition-colors"
          >
            ← Prev
          </button>
          <span className="text-xs text-gray-400">
            Page {safePage} of {totalPages}
            {filtered.length !== roster.length && (
              <span className="ml-1 text-gray-300">({filtered.length} shown)</span>
            )}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-30 rounded-lg font-medium transition-colors"
          >
            Next →
          </button>
        </div>
      )}

      {/* Add player form */}
      <form onSubmit={handleAdd} className="mt-3 flex gap-2">
        <input
          type="text"
          placeholder="Nickname"
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          type="number"
          placeholder="%"
          min="0"
          max="100"
          step="0.1"
          value={addPct}
          onChange={(e) => setAddPct(e.target.value)}
          className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-2 text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          type="submit"
          disabled={adding || !addName.trim() || addPct === ''}
          className="px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white rounded-lg font-medium transition-colors"
        >
          {adding ? '…' : 'Add'}
        </button>
      </form>
    </div>
  )
}
