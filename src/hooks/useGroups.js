import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'

export function useGroups() {
  const [groups, setGroups] = useState([])
  const [groupMembers, setGroupMembers] = useState([]) // [{ group_id, player_nickname }]
  const [loading, setLoading] = useState(true)

  const fetchGroups = useCallback(async () => {
    setLoading(true)
    const [{ data: groupsData, error: groupsErr }, { data: membersData, error: membersErr }] =
      await Promise.all([
        supabase.from('player_groups').select('*').order('created_at', { ascending: true }),
        supabase.from('player_group_members').select('*'),
      ])
    if (!groupsErr) setGroups(groupsData ?? [])
    if (!membersErr) setGroupMembers(membersData ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  const createGroup = useCallback(async (name) => {
    const { data, error } = await supabase
      .from('player_groups')
      .insert({ name: name.trim() })
      .select()
      .single()
    if (error) throw error
    setGroups((prev) => [...prev, data])
    return data
  }, [])

  const deleteGroup = useCallback(async (id) => {
    const { error } = await supabase.from('player_groups').delete().eq('id', id)
    if (error) throw error
    setGroups((prev) => prev.filter((g) => g.id !== id))
    setGroupMembers((prev) => prev.filter((m) => m.group_id !== id))
  }, [])

  const addPlayersToGroup = useCallback(async (groupId, nicknames) => {
    if (!nicknames.length) return
    const rows = nicknames.map((n) => ({ group_id: groupId, player_nickname: n }))
    const { error } = await supabase
      .from('player_group_members')
      .upsert(rows, { onConflict: 'group_id,player_nickname', ignoreDuplicates: true })
    if (error) throw error
    setGroupMembers((prev) => {
      const existing = new Set(
        prev.filter((m) => m.group_id === groupId).map((m) => m.player_nickname)
      )
      const newEntries = nicknames
        .filter((n) => !existing.has(n))
        .map((n) => ({ group_id: groupId, player_nickname: n }))
      return [...prev, ...newEntries]
    })
  }, [])

  const removePlayerFromGroup = useCallback(async (groupId, nickname) => {
    const { error } = await supabase
      .from('player_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('player_nickname', nickname)
    if (error) throw error
    setGroupMembers((prev) =>
      prev.filter((m) => !(m.group_id === groupId && m.player_nickname === nickname))
    )
  }, [])

  // groupId -> Set<nickname>
  const groupMemberMap = useMemo(() => {
    const map = new Map()
    for (const m of groupMembers) {
      if (!map.has(m.group_id)) map.set(m.group_id, new Set())
      map.get(m.group_id).add(m.player_nickname)
    }
    return map
  }, [groupMembers])

  return {
    groups,
    groupMembers,
    groupMemberMap,
    loading: loading,
    createGroup,
    deleteGroup,
    addPlayersToGroup,
    removePlayerFromGroup,
  }
}
