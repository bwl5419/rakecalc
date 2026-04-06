import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'

export function useRoster() {
  const [roster, setRoster] = useState([]) // [{ id, nickname, rakeback_pct, last_seen }]
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchRoster = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('roster')
      .select('*')
      .order('nickname', { ascending: true })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // --- Silent dedup on load ---
    // Find rows that share the same lowercase nickname, keep the one with the
    // most recent last_seen (or earliest created_at as tiebreak), delete the rest.
    const lowerMap = new Map()
    for (const p of data) {
      const key = p.nickname.toLowerCase()
      if (!lowerMap.has(key)) lowerMap.set(key, [])
      lowerMap.get(key).push(p)
    }
    const toDelete = []
    for (const group of lowerMap.values()) {
      if (group.length <= 1) continue
      const sorted = [...group].sort((a, b) => {
        // Most-recent last_seen first; nulls last
        if (!a.last_seen && !b.last_seen) return 0
        if (!a.last_seen) return 1
        if (!b.last_seen) return -1
        return b.last_seen.localeCompare(a.last_seen)
      })
      toDelete.push(...sorted.slice(1).map((p) => p.id))
    }
    if (toDelete.length > 0) {
      await supabase.from('roster').delete().in('id', toDelete)
      setRoster(data.filter((p) => !toDelete.includes(p.id)))
    } else {
      setRoster(data)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchRoster()
  }, [fetchRoster])

  // Case-insensitive lookup map built from current roster state
  const rosterLowerMap = useMemo(
    () => new Map(roster.map((p) => [p.nickname.toLowerCase(), p])),
    [roster]
  )

  // Upsert a single player: match case-insensitively, UPDATE existing or INSERT new.
  const upsertPlayer = useCallback(
    async (nickname, rakeback_pct, last_seen) => {
      const existing = rosterLowerMap.get(nickname.toLowerCase())
      let data
      if (existing) {
        const { data: d, error } = await supabase
          .from('roster')
          .update({ rakeback_pct, last_seen })
          .eq('id', existing.id)
          .select()
          .single()
        if (error) throw error
        data = d
      } else {
        const { data: d, error } = await supabase
          .from('roster')
          .insert({ nickname, rakeback_pct, last_seen })
          .select()
          .single()
        if (error) throw error
        data = d
      }
      setRoster((prev) => {
        const idx = prev.findIndex((p) => p.id === data.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = data
          return next
        }
        return [...prev, data].sort((a, b) => a.nickname.localeCompare(b.nickname))
      })
      return data
    },
    [rosterLowerMap]
  )

  const updatePct = useCallback(async (id, rakeback_pct) => {
    const { data, error } = await supabase
      .from('roster')
      .update({ rakeback_pct })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setRoster((prev) => prev.map((p) => (p.id === id ? data : p)))
  }, [])

  const addPlayer = useCallback(
    async (nickname, rakeback_pct) => {
      const today = new Date().toISOString().slice(0, 10)
      return upsertPlayer(nickname, rakeback_pct, today)
    },
    [upsertPlayer]
  )

  const removePlayer = useCallback(async (id) => {
    const { error } = await supabase.from('roster').delete().eq('id', id)
    if (error) throw error
    setRoster((prev) => prev.filter((p) => p.id !== id))
  }, [])

  // Bulk sync from a parsed xlsx file.
  // Case-insensitive match: UPDATE existing rows (preserve rakeback_pct, bump last_seen),
  // INSERT truly new players.
  const syncFromFile = useCallback(
    async (parsedRows, defaultPct) => {
      const today = new Date().toISOString().slice(0, 10)

      const toUpdate = [] // { id, nickname, rakeback_pct, last_seen }
      const toInsert = [] // { nickname, rakeback_pct, last_seen }

      for (const row of parsedRows) {
        const existing = rosterLowerMap.get(row.nickname.toLowerCase())
        if (existing) {
          toUpdate.push({
            id: existing.id,
            nickname: existing.nickname, // keep original casing
            rakeback_pct: existing.rakeback_pct, // preserve existing rate
            last_seen: today,
          })
        } else {
          toInsert.push({ nickname: row.nickname, rakeback_pct: defaultPct, last_seen: today })
        }
      }

      const results = []
      if (toUpdate.length > 0) {
        const { data, error } = await supabase
          .from('roster')
          .upsert(toUpdate, { onConflict: 'id' })
          .select()
        if (error) throw error
        results.push(...data)
      }
      if (toInsert.length > 0) {
        const { data, error } = await supabase
          .from('roster')
          .insert(toInsert)
          .select()
        if (error) throw error
        results.push(...data)
      }

      setRoster((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]))
        for (const p of results) map.set(p.id, p)
        return [...map.values()].sort((a, b) => a.nickname.localeCompare(b.nickname))
      })
      return results
    },
    [rosterLowerMap]
  )

  // Bulk import from CSV rows: [{ nickname, rakeback_pct }].
  // Case-insensitive match: UPDATE rakeback_pct for existing, INSERT new.
  // Returns { created, updated } counts.
  const importFromCsv = useCallback(
    async (csvRows) => {
      if (!csvRows.length) return { created: 0, updated: 0 }

      const toUpdate = []
      const toInsert = []

      for (const row of csvRows) {
        const existing = rosterLowerMap.get(row.nickname.toLowerCase())
        if (existing) {
          toUpdate.push({
            id: existing.id,
            nickname: existing.nickname,
            rakeback_pct: row.rakeback_pct,
            last_seen: existing.last_seen ?? null,
          })
        } else {
          toInsert.push({ nickname: row.nickname, rakeback_pct: row.rakeback_pct, last_seen: null })
        }
      }

      const results = []
      if (toUpdate.length > 0) {
        const { data, error } = await supabase
          .from('roster')
          .upsert(toUpdate, { onConflict: 'id' })
          .select()
        if (error) throw error
        results.push(...data)
      }
      if (toInsert.length > 0) {
        const { data, error } = await supabase
          .from('roster')
          .insert(toInsert)
          .select()
        if (error) throw error
        results.push(...data)
      }

      setRoster((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]))
        for (const p of results) map.set(p.id, p)
        return [...map.values()].sort((a, b) => a.nickname.localeCompare(b.nickname))
      })
      return { created: toInsert.length, updated: toUpdate.length }
    },
    [rosterLowerMap]
  )

  // Groups of players whose nicknames match case-insensitively with >1 entry.
  // After auto-dedup on load these should be rare, but shown if they appear
  // during a session before the next reload.
  const duplicateGroups = useMemo(() => {
    const map = new Map()
    for (const p of roster) {
      const key = p.nickname.toLowerCase()
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(p)
    }
    return [...map.values()].filter((g) => g.length > 1)
  }, [roster])

  const resolveGroup = useCallback(async (keepId, deleteIds) => {
    const { error } = await supabase.from('roster').delete().in('id', deleteIds)
    if (error) throw error
    setRoster((prev) => prev.filter((p) => !deleteIds.includes(p.id)))
  }, [])

  const bulkRemovePlayers = useCallback(async (ids) => {
    const { error } = await supabase.from('roster').delete().in('id', ids)
    if (error) throw error
    setRoster((prev) => prev.filter((p) => !ids.includes(p.id)))
  }, [])

  return {
    roster,
    loading,
    error,
    updatePct,
    addPlayer,
    removePlayer,
    bulkRemovePlayers,
    syncFromFile,
    importFromCsv,
    fetchRoster,
    duplicateGroups,
    resolveGroup,
  }
}
