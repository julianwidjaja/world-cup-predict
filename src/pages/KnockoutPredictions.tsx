import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import MatchCard from '../components/MatchCard'
import { STAGE_LABELS } from '../lib/constants'
import type { Match, MatchResult, Prediction, Deadline, Stage } from '../lib/types'

const KNOCKOUT_STAGES: Stage[] = ['round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final']

interface ScorePrediction {
  home: number | null
  away: number | null
}

export default function KnockoutPredictions() {
  const { user } = useAuth()
  const [matches, setMatches] = useState<Match[]>([])
  const [predictions, setPredictions] = useState<Record<number, MatchResult>>({})
  const [scores, setScores] = useState<Record<number, ScorePrediction>>({})
  const [deadlines, setDeadlines] = useState<Record<string, Date>>({})
  const [loading, setLoading] = useState(true)
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(KNOCKOUT_STAGES))
  const [savingMatch, setSavingMatch] = useState<number | null>(null)
  const scoreTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    loadData()
    return () => {
      Object.values(scoreTimers.current).forEach(clearTimeout)
    }
  }, [user])

  async function loadData() {
    const [matchesRes, predictionsRes, deadlinesRes] = await Promise.all([
      supabase
        .from('matches')
        .select('*')
        .neq('stage', 'group')
        .order('match_date', { ascending: true }),
      supabase
        .from('predictions')
        .select('*')
        .eq('user_id', user!.id),
      supabase
        .from('deadlines')
        .select('*'),
    ])

    if (matchesRes.data) setMatches(matchesRes.data)
    if (predictionsRes.data) {
      const predMap: Record<number, MatchResult> = {}
      const scoreMap: Record<number, ScorePrediction> = {}
      predictionsRes.data.forEach((p: Prediction) => {
        predMap[p.match_id] = p.predicted_result
        if (p.predicted_home_score != null || p.predicted_away_score != null) {
          scoreMap[p.match_id] = {
            home: p.predicted_home_score,
            away: p.predicted_away_score,
          }
        }
      })
      setPredictions(predMap)
      setScores(scoreMap)
    }
    if (deadlinesRes.data) {
      const dlMap: Record<string, Date> = {}
      deadlinesRes.data.forEach((d: Deadline) => {
        dlMap[d.stage] = new Date(d.deadline_time)
      })
      setDeadlines(dlMap)
    }
    setLoading(false)
  }

  async function handlePredict(matchId: number, result: MatchResult) {
    if (!user) return
    const prev = predictions[matchId]
    setPredictions(p => ({ ...p, [matchId]: result }))
    setSavingMatch(matchId)

    const scoreData = scores[matchId]
    const { error } = await supabase
      .from('predictions')
      .upsert(
        {
          user_id: user.id,
          match_id: matchId,
          predicted_result: result,
          predicted_home_score: scoreData?.home ?? null,
          predicted_away_score: scoreData?.away ?? null,
        },
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

  const saveScore = useCallback(async (matchId: number, home: number | null, away: number | null) => {
    if (!user || !predictions[matchId]) return
    await supabase
      .from('predictions')
      .upsert(
        {
          user_id: user.id,
          match_id: matchId,
          predicted_result: predictions[matchId],
          predicted_home_score: home,
          predicted_away_score: away,
        },
        { onConflict: 'user_id,match_id' }
      )
  }, [user, predictions])

  function handleScoreChange(matchId: number, home: number | null, away: number | null) {
    setScores(s => ({ ...s, [matchId]: { home, away } }))
    if (scoreTimers.current[matchId]) clearTimeout(scoreTimers.current[matchId])
    scoreTimers.current[matchId] = setTimeout(() => saveScore(matchId, home, away), 800)
  }

  function toggleStage(stage: string) {
    setExpandedStages(prev => {
      const next = new Set(prev)
      if (next.has(stage)) next.delete(stage)
      else next.add(stage)
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
      <h1 className="text-2xl font-bold text-white mb-6">Knockout Stage</h1>

      <div className="space-y-4">
        {KNOCKOUT_STAGES.map(stage => {
          const stageMatches = matches.filter(m => m.stage === stage)
          if (stageMatches.length === 0) return null
          const dl = deadlines[stage]
          const isPast = dl ? new Date() > dl : false
          const isExpanded = expandedStages.has(stage)
          const predicted = stageMatches.filter(m => predictions[m.id]).length

          return (
            <div key={stage} className="bg-slate-800 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleStage(stage)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-750 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-white font-semibold">{STAGE_LABELS[stage]}</span>
                  <span className="text-xs text-slate-400">
                    {predicted}/{stageMatches.length} predicted
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {dl && (
                    <span className={`text-xs ${isPast ? 'text-red-400' : 'text-amber-400'}`}>
                      {isPast ? 'Locked' : `Due: ${dl.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                    </span>
                  )}
                  <svg
                    className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-2">
                  {stageMatches.map(match => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      prediction={predictions[match.id] || null}
                      predictedScore={scores[match.id]}
                      onPredict={handlePredict}
                      onPredictScore={handleScoreChange}
                      disabled={isPast || match.is_completed || savingMatch === match.id}
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
