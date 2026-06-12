import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import MatchCard from '../components/MatchCard'
import type { Match, MatchResult, Prediction } from '../lib/types'

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

export default function GroupStagePredictions() {
  const { user } = useAuth()
  const [matches, setMatches] = useState<Match[]>([])
  const [predictions, setPredictions] = useState<Record<number, MatchResult>>({})
  const [deadline, setDeadline] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(GROUPS))
  const [savingMatch, setSavingMatch] = useState<number | null>(null)

  useEffect(() => {
    loadData()
  }, [user])

  async function loadData() {
    const [matchesRes, predictionsRes, deadlineRes] = await Promise.all([
      supabase
        .from('matches')
        .select('*')
        .eq('stage', 'group')
        .order('match_date', { ascending: true }),
      supabase
        .from('predictions')
        .select('*')
        .eq('user_id', user!.id),
      supabase
        .from('deadlines')
        .select('*')
        .eq('stage', 'group')
        .single(),
    ])

    if (matchesRes.data) setMatches(matchesRes.data)
    if (predictionsRes.data) {
      const predMap: Record<number, MatchResult> = {}
      predictionsRes.data.forEach((p: Prediction) => {
        predMap[p.match_id] = p.predicted_result
      })
      setPredictions(predMap)
    }
    if (deadlineRes.data) {
      setDeadline(new Date(deadlineRes.data.deadline_time))
    }
    setLoading(false)
  }

  async function handlePredict(matchId: number, result: MatchResult) {
    if (!user) return
    const prev = predictions[matchId]
    setPredictions(p => ({ ...p, [matchId]: result }))
    setSavingMatch(matchId)

    const { error } = await supabase
      .from('predictions')
      .upsert(
        { user_id: user.id, match_id: matchId, predicted_result: result },
        { onConflict: 'user_id,match_id' }
      )

    if (error) {
      if (prev) {
        setPredictions(p => ({ ...p, [matchId]: prev }))
      } else {
        setPredictions(p => {
          const next = { ...p }
          delete next[matchId]
          return next
        })
      }
      alert(error.message)
    }
    setSavingMatch(null)
  }

  const isPastDeadline = deadline ? new Date() > deadline : false
  const predictedCount = matches.filter(m => predictions[m.id]).length

  function toggleGroup(group: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-white">Group Stage</h1>
        <span className="text-sm text-slate-400">
          {predictedCount}/{matches.length} predicted
        </span>
      </div>

      {deadline && (
        <div className={`rounded-lg px-4 py-2 mb-6 text-sm ${
          isPastDeadline
            ? 'bg-red-500/10 border border-red-500/30 text-red-400'
            : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
        }`}>
          {isPastDeadline
            ? 'Predictions are locked'
            : `Deadline: ${deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${deadline.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
          }
        </div>
      )}

      <div className="space-y-4">
        {GROUPS.map(group => {
          const groupMatches = matches.filter(m => m.group_label === group)
          const groupPredicted = groupMatches.filter(m => predictions[m.id]).length
          const isExpanded = expandedGroups.has(group)

          return (
            <div key={group} className="bg-slate-800 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleGroup(group)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-750 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-white font-semibold">Group {group}</span>
                  <span className="text-xs text-slate-400">
                    {groupPredicted}/{groupMatches.length} predicted
                  </span>
                </div>
                <svg
                  className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-2">
                  {groupMatches.map(match => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      prediction={predictions[match.id] || null}
                      onPredict={handlePredict}
                      disabled={isPastDeadline || match.is_completed || savingMatch === match.id}
                      showResult
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
