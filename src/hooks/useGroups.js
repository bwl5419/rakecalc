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

  // Create a group and populate it with members in one shot
  const createGroupWithMembers = useCallback(async (name, nicknames) => {
    // Insert the group
    const { data: group, error: groupErr } = await supabase
      .from('player_groups')
      .insert({ name: name.trim() })
      .select()
      .single()
    if (groupErr) throw groupErr

    // Insert members (deduplicated, lowercased for consistent storage)
    const unique = [...new Set(nicknames.map((n) => n.trim()).filter(Boolean))]
    if (unique.length > 0) {
      const rows = unique.map((n) => ({ group_id: group.id, player_nickname: n }))
      const { error: membersErr } = await supabase
        .from('player_group_members')
        .insert(rows)
      if (membersErr) throw membersErr
      setGroupMembers((prev) => [...prev, ...rows])
    }

    setGroups((prev) => [...prev, group])
    return group
  }, [])

  const deleteGroup = useCallback(async (id) => {
    const { error } = await supabase.from('player_groups').delete().eq('id', id)
    if (error) throw error
    setGroups((prev) => prev.filter((g) => g.id !== id))
    setGroupMembers((prev) => prev.filter((m) => m.group_id !== id))
  }, [])

  // groupId -> Set<lowercase nickname> for case-insensitive matching
  const groupMemberMap = useMemo(() => {
    const map = new Map()
    for (const m of groupMembers) {
      if (!map.has(m.group_id)) map.set(m.group_id, new Set())
      map.get(m.group_id).add(m.player_nickname.toLowerCase())
    }
    return map
  }, [groupMembers])

  return {
    groups,
    groupMemberMap,
    loading,
    createGroupWithMembers,
    deleteGroup,
  }
}
