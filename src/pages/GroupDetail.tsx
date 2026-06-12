import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { STAGE_LABELS, getFlag } from '../lib/constants'
import type { LeaderboardEntry, Group, Match, Deadline } from '../lib/types'
import type { GroupPrediction } from '../components/MatchCard'

export default function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>()
  const { user } = useAuth()
  const [group, setGroup] = useState<Group | null>(null)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [deadlines, setDeadlines] = useState<Record<string, Date>>({})
  const [predictions, setPredictions] = useState<Record<number, GroupPrediction[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (groupId) loadData()
  }, [groupId])

  async function loadData() {
    const now = new Date().toISOString()

    const [groupRes, leaderboardRes, matchesRes, deadlinesRes, membersRes] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId!).single(),
      supabase.rpc('get_leaderboard', { p_group_id: groupId }),
      supabase.from('matches').select('*').gte('match_date', now).order('match_date'),
      supabase.from('deadlines').select('*'),
      supabase.from('group_members').select('user_id').eq('group_id', groupId!),
    ])

    if (groupRes.data) setGroup(groupRes.data)
    if (leaderboardRes.data) setEntries(leaderboardRes.data)
    if (matchesRes.data) setMatches(matchesRes.data)
    if (deadlinesRes.data) {
      const dlMap: Record<string, Date> = {}
      deadlinesRes.data.forEach((d: Deadline) => {
        dlMap[d.stage] = new Date(d.deadline_time)
      })
      setDeadlines(dlMap)
    }

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

  function isDeadlinePassed(stage: string): boolean {
    const dl = deadlines[stage]
    return dl ? new Date() > dl : false
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-400">Group not found.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{group.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-slate-400">Code:</span>
            <code className="text-xs text-amber-400 bg-slate-700 px-2 py-0.5 rounded">{group.invite_code}</code>
          </div>
        </div>
        <Link
          to={`/groups/${groupId}/past`}
          className="text-sm text-emerald-400 hover:text-emerald-300"
        >
          Past Predictions
        </Link>
      </div>

      {/* Leaderboard */}
      <div className="bg-slate-800 rounded-xl overflow-hidden mb-8">
        <h2 className="text-lg font-semibold text-white px-4 pt-4 pb-2">Leaderboard</h2>
        {entries.length === 0 ? (
          <p className="text-slate-400 text-sm px-4 pb-4">No predictions yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2 w-12">#</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2">Player</th>
                <th className="text-right text-xs font-medium text-slate-400 px-4 py-2">Correct</th>
                <th className="text-right text-xs font-medium text-slate-400 px-4 py-2">Points</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr
                  key={entry.user_id}
                  className={`border-b border-slate-700/50 ${
                    entry.user_id === user!.id ? 'bg-emerald-500/10' : ''
                  }`}
                >
                  <td className="px-4 py-2.5 text-sm text-slate-400">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-sm font-medium text-white">
                      {entry.display_name}
                      {entry.user_id === user!.id && (
                        <span className="text-emerald-400 text-xs ml-1">(you)</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="text-sm text-slate-400">
                      {entry.correct_predictions}/{entry.total_completed}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="text-sm font-bold text-white">{entry.total_points}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Upcoming Matches */}
      <h2 className="text-lg font-semibold text-white mb-3">Upcoming Matches</h2>
      {matches.length === 0 ? (
        <p className="text-slate-400 text-sm">No upcoming matches.</p>
      ) : (
        <div className="space-y-3">
          {matches.map(match => {
            const homeTeam = match.home_team_resolved || match.home_team
            const awayTeam = match.away_team_resolved || match.away_team
            const matchDate = new Date(match.match_date)
            const deadlinePassed = isDeadlinePassed(match.stage)
            const matchPreds = predictions[match.id] || []
            const isKnockout = match.stage !== 'group'
            const isTBD = isKnockout && (!match.home_team_resolved || !match.away_team_resolved)

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

                <div className="flex items-center justify-between gap-2 mb-3">
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

                {isTBD ? (
                  <p className="text-xs text-slate-500 italic text-center">Teams TBD</p>
                ) : !deadlinePassed ? (
                  <p className="text-xs text-slate-500 italic text-center">Predictions hidden until deadline</p>
                ) : matchPreds.length === 0 ? (
                  <p className="text-xs text-slate-500 italic text-center">No predictions</p>
                ) : (
                  <div className="space-y-1">
                    {matchPreds.map((gp, i) => (
                      <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-slate-700/50">
                        <span className="text-slate-300">{gp.display_name}</span>
                        <span className="text-slate-400">
                          {gp.predicted_result === 'home' ? homeTeam
                            : gp.predicted_result === 'away' ? awayTeam
                            : 'Draw'}
                        </span>
                      </div>
                    ))}
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
