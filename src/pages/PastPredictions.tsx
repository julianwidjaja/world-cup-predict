import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { STAGE_LABELS, getFlag } from '../lib/constants'
import type { Group, Match, MatchResult } from '../lib/types'
import type { GroupPrediction } from '../components/MatchCard'

export default function PastPredictions() {
  const { groupId } = useParams<{ groupId: string }>()
  const [group, setGroup] = useState<Group | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [predictions, setPredictions] = useState<Record<number, GroupPrediction[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (groupId) loadData()
  }, [groupId])

  async function loadData() {
    const now = new Date().toISOString()

    const [groupRes, matchesRes, membersRes] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId!).single(),
      supabase.from('matches').select('*').lt('match_date', now).order('match_date', { ascending: false }),
      supabase.from('group_members').select('user_id').eq('group_id', groupId!),
    ])

    if (groupRes.data) setGroup(groupRes.data)
    if (matchesRes.data) setMatches(matchesRes.data)

    if (membersRes.data && matchesRes.data && matchesRes.data.length > 0) {
      const memberIds = membersRes.data.map(m => m.user_id)
      const matchIds = matchesRes.data.map(m => m.id)

      const { data: preds } = await supabase
        .from('predictions')
        .select('match_id, predicted_result, user_id, profiles(display_name)')
        .in('user_id', memberIds)
        .in('match_id', matchIds)

      if (preds) {
        const grouped: Record<number, GroupPrediction[]> = {}
        for (const p of preds as any[]) {
          if (!grouped[p.match_id]) grouped[p.match_id] = []
          grouped[p.match_id].push({
            display_name: p.profiles?.display_name || 'Unknown',
            predicted_result: p.predicted_result,
          })
        }
        setPredictions(grouped)
      }
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Past Predictions</h1>
          {group && <p className="text-slate-400 text-sm">{group.name}</p>}
        </div>
        <Link
          to={`/groups/${groupId}`}
          className="text-sm text-emerald-400 hover:text-emerald-300"
        >
          Back to Group
        </Link>
      </div>

      {matches.length === 0 ? (
        <p className="text-slate-400 text-sm">No past matches yet.</p>
      ) : (
        <div className="space-y-3">
          {matches.map(match => {
            const homeTeam = match.home_team_resolved || match.home_team
            const awayTeam = match.away_team_resolved || match.away_team
            const matchDate = new Date(match.match_date)
            const matchPreds = predictions[match.id] || []

            function resultLabel(): string | null {
              if (!match.is_completed || !match.result) return null
              if (match.result === 'home') return homeTeam
              if (match.result === 'away') return awayTeam
              return 'Draw'
            }

            return (
              <div key={match.id} className="bg-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">
                    {STAGE_LABELS[match.stage as keyof typeof STAGE_LABELS]}
                    {match.group_label && ` | Group ${match.group_label}`}
                  </span>
                  <span className="text-xs text-slate-500">
                    {matchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {' '}
                    {matchDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex-1 text-right">
                    <span className="text-sm font-medium text-white">
                      {getFlag(homeTeam)} {homeTeam}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-medium px-2">vs</span>
                  <div className="flex-1 text-left">
                    <span className="text-sm font-medium text-white">
                      {awayTeam} {getFlag(awayTeam)}
                    </span>
                  </div>
                </div>

                {match.is_completed && (
                  <div className="text-center mb-3">
                    <span className="text-xs font-medium text-amber-400">
                      Result: {resultLabel()}
                    </span>
                  </div>
                )}

                {matchPreds.length === 0 ? (
                  <p className="text-xs text-slate-500 italic text-center">No predictions</p>
                ) : (
                  <div className="space-y-1">
                    {matchPreds.map((gp, i) => {
                      const isCorrect = match.is_completed && gp.predicted_result === match.result
                      const pickText = gp.predicted_result === 'home' ? homeTeam
                        : gp.predicted_result === 'away' ? awayTeam
                        : 'Draw'

                      return (
                        <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-slate-700/50">
                          <span className="text-slate-300">{gp.display_name}</span>
                          <span className={
                            match.is_completed
                              ? isCorrect ? 'text-green-400 font-medium' : 'text-red-400'
                              : 'text-slate-400'
                          }>
                            {pickText}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
