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
    } else {
      setRoster(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchRoster()
  }, [fetchRoster])

  const upsertPlayer = useCallback(async (nickname, rakeback_pct, last_seen) => {
    const { data, error } = await supabase
      .from('roster')
      .upsert(
        { nickname, rakeback_pct, last_seen },
        { onConflict: 'nickname', ignoreDuplicates: false }
      )
      .select()
      .single()
    if (error) throw error
    setRoster((prev) => {
      const idx = prev.findIndex((p) => p.nickname === nickname)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = data
        return next
      }
      return [...prev, data].sort((a, b) => a.nickname.localeCompare(b.nickname))
    })
    return data
  }, [])

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

  const addPlayer = useCallback(async (nickname, rakeback_pct) => {
    const today = new Date().toISOString().slice(0, 10)
    return upsertPlayer(nickname, rakeback_pct, today)
  }, [upsertPlayer])

  const removePlayer = useCallback(async (id) => {
    const { error } = await supabase.from('roster').delete().eq('id', id)
    if (error) throw error
    setRoster((prev) => prev.filter((p) => p.id !== id))
  }, [])

  // Called after parsing a file: upsert all players found, updating last_seen
  const syncFromFile = useCallback(
    async (parsedRows, defaultPct) => {
      const today = new Date().toISOString().slice(0, 10)
      // Build current roster map for quick lookup
      const rosterMap = new Map(roster.map((p) => [p.nickname, p]))

      const upserts = parsedRows.map((row) => {
        const existing = rosterMap.get(row.nickname)
        return {
          nickname: row.nickname,
          rakeback_pct: existing ? existing.rakeback_pct : defaultPct,
          last_seen: today,
        }
      })

      const { data, error } = await supabase
        .from('roster')
        .upsert(upserts, { onConflict: 'nickname', ignoreDuplicates: false })
        .select()
      if (error) throw error

      // Merge into local state (don't drop players not in this file)
      setRoster((prev) => {
        const map = new Map(prev.map((p) => [p.nickname, p]))
        for (const p of data) map.set(p.nickname, p)
        return [...map.values()].sort((a, b) => a.nickname.localeCompare(b.nickname))
      })

      return data
    },
    [roster]
  )

  // Import from a parsed CSV: [{ nickname, rakeback_pct }]
  // Returns { created, updated } counts
  const importFromCsv = useCallback(async (csvRows) => {
    if (!csvRows.length) return { created: 0, updated: 0 }
    const rosterMap = new Map(roster.map((p) => [p.nickname, p]))

    const upserts = csvRows.map((row) => ({
      nickname: row.nickname,
      rakeback_pct: row.rakeback_pct,
      last_seen: rosterMap.get(row.nickname)?.last_seen ?? null,
    }))

    const created = csvRows.filter((r) => !rosterMap.has(r.nickname)).length
    const updated = csvRows.length - created

    const { data, error } = await supabase
      .from('roster')
      .upsert(upserts, { onConflict: 'nickname', ignoreDuplicates: false })
      .select()
    if (error) throw error

    setRoster((prev) => {
      const map = new Map(prev.map((p) => [p.nickname, p]))
      for (const p of data) map.set(p.nickname, p)
      return [...map.values()].sort((a, b) => a.nickname.localeCompare(b.nickname))
    })

    return { created, updated }
  }, [roster])

  // Groups of players whose nicknames match case-insensitively, with >1 entry each
  const duplicateGroups = useMemo(() => {
    const map = new Map()
    for (const p of roster) {
      const key = p.nickname.toLowerCase()
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(p)
    }
    return [...map.values()].filter((g) => g.length > 1)
  }, [roster])

  // Keep one entry, delete the rest from Supabase
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

  return { roster, loading, error, updatePct, addPlayer, removePlayer, bulkRemovePlayers, syncFromFile, importFromCsv, fetchRoster, duplicateGroups, resolveGroup }
}
