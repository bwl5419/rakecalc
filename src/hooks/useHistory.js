import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useHistory() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('payout_history')
      .select('*')
      .order('uploaded_at', { ascending: false })
    if (!error) setHistory(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const saveWeek = useCallback(async ({ periodLabel, rows, totalRake, totalPayout }) => {
    const { data, error } = await supabase
      .from('payout_history')
      .insert({
        period_label: periodLabel,
        uploaded_at: new Date().toISOString(),
        total_rake: totalRake,
        total_payout: totalPayout,
        rows,
      })
      .select()
      .single()
    if (error) throw error
    setHistory((prev) => [data, ...prev])
    return data
  }, [])

  const settleWeek = useCallback(async (id) => {
    const { data, error } = await supabase
      .from('payout_history')
      .update({ settled_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setHistory((prev) => prev.map((h) => (h.id === id ? data : h)))
    return data
  }, [])

  return { history, loading, saveWeek, settleWeek }
}
