import { useState, useCallback, useMemo } from 'react'

const GROUPS_KEY = 'rakecalc_groups'
const MEMBERS_KEY = 'rakecalc_group_members'

function loadGroups() {
  try {
    return JSON.parse(localStorage.getItem(GROUPS_KEY) ?? '[]')
  } catch {
    return []
  }
}

function loadMembers() {
  try {
    return JSON.parse(localStorage.getItem(MEMBERS_KEY) ?? '[]')
  } catch {
    return []
  }
}

function persist(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function makeId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function useGroups() {
  const [groups, setGroups] = useState(loadGroups)
  const [groupMembers, setGroupMembers] = useState(loadMembers)

  const createGroupWithMembers = useCallback((name, nicknames) => {
    const group = {
      id: makeId(),
      name: name.trim(),
      created_at: new Date().toISOString(),
    }
    const unique = [...new Set(nicknames.map((n) => n.trim().toLowerCase()).filter(Boolean))]
    const rows = unique.map((n) => ({ group_id: group.id, player_nickname: n }))

    setGroups((prev) => {
      const next = [...prev, group]
      persist(GROUPS_KEY, next)
      return next
    })
    setGroupMembers((prev) => {
      const next = [...prev, ...rows]
      persist(MEMBERS_KEY, next)
      return next
    })
    return group
  }, [])

  const deleteGroup = useCallback((id) => {
    setGroups((prev) => {
      const next = prev.filter((g) => g.id !== id)
      persist(GROUPS_KEY, next)
      return next
    })
    setGroupMembers((prev) => {
      const next = prev.filter((m) => m.group_id !== id)
      persist(MEMBERS_KEY, next)
      return next
    })
  }, [])

  const renameGroup = useCallback((id, newName) => {
    setGroups((prev) => {
      const next = prev.map((g) => (g.id === id ? { ...g, name: newName.trim() } : g))
      persist(GROUPS_KEY, next)
      return next
    })
  }, [])

  const addPlayerToGroup = useCallback((groupId, nickname) => {
    const lc = nickname.trim().toLowerCase()
    setGroupMembers((prev) => {
      if (prev.some((m) => m.group_id === groupId && m.player_nickname === lc)) return prev
      const next = [...prev, { group_id: groupId, player_nickname: lc }]
      persist(MEMBERS_KEY, next)
      return next
    })
  }, [])

  const removePlayerFromGroup = useCallback((groupId, nickname) => {
    const lc = nickname.trim().toLowerCase()
    setGroupMembers((prev) => {
      const next = prev.filter((m) => !(m.group_id === groupId && m.player_nickname === lc))
      persist(MEMBERS_KEY, next)
      return next
    })
  }, [])

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
    loading: false,
    createGroupWithMembers,
    deleteGroup,
    renameGroup,
    addPlayerToGroup,
    removePlayerFromGroup,
  }
}
