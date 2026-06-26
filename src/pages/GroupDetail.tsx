import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { STAGE_LABELS, getFlag } from '../lib/constants'
import type { LeaderboardEntry, Group, Match, Deadline } from '../lib/types'
import type { GroupPrediction } from '../components/MatchCard'

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfTomorrow(): Date {
  const d = startOfToday()
  d.setDate(d.getDate() + 1)
  return d
}

export default function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>()
  const { user } = useAuth()
  const [group, setGroup] = useState<Group | null>(null)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [deadlines, setDeadlines] = useState<Record<string, Date>>({})
  const [predictions, setPredictions] = useState<Record<number, GroupPrediction[]>>({})
  const [winnerPicks, setWinnerPicks] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    if (groupId) loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId])

  async function loadData() {
    const todayStart = startOfToday().toISOString()

    const [groupRes, leaderboardRes, matchesRes, deadlinesRes, membersRes] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId!).single(),
      supabase.rpc('get_leaderboard', { p_group_id: groupId }),
      supabase.from('matches').select('*').gte('match_date', todayStart).order('match_date'),
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

    if (membersRes.data && membersRes.data.length > 0) {
      const memberIds = membersRes.data.map(m => m.user_id)

      const { data: wPreds } = await supabase
        .from('winner_predictions')
        .select('user_id, predicted_team')
        .in('user_id', memberIds)

      if (wPreds) {
        const wMap: Record<string, string> = {}
        for (const wp of wPreds) wMap[wp.user_id] = wp.predicted_team
        setWinnerPicks(wMap)
      }
    }

    if (membersRes.data && matchesRes.data && matchesRes.data.length > 0) {
      const memberIds = membersRes.data.map(m => m.user_id)
      const matchIds = matchesRes.data.map(m => m.id)

      const { data: preds } = await supabase
        .from('predictions')
        .select('match_id, predicted_result, predicted_home_score, predicted_away_score, user_id, profiles(display_name)')
        .in('user_id', memberIds)
        .in('match_id', matchIds)

      if (preds) {
        const grouped: Record<number, GroupPrediction[]> = {}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const p of preds as any[]) {
          if (!grouped[p.match_id]) grouped[p.match_id] = []
          grouped[p.match_id].push({
            display_name: p.profiles?.display_name || 'Unknown',
            predicted_result: p.predicted_result,
            predicted_home_score: p.predicted_home_score,
            predicted_away_score: p.predicted_away_score,
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

  const tomorrow = startOfTomorrow()
  const todayMatches = matches.filter(m => new Date(m.match_date) < tomorrow)
  const upcomingMatches = matches.filter(m => new Date(m.match_date) >= tomorrow)
  const winnerDeadlinePassed = true

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

  function renderMatch(match: Match) {
    const homeTeam = match.home_team_resolved || match.home_team
    const awayTeam = match.away_team_resolved || match.away_team
    const matchDate = new Date(match.match_date)
    const deadlinePassed = isDeadlinePassed(match.stage)
    const matchPreds = predictions[match.id] || []
    const hasResult = match.is_completed && match.home_score != null && match.away_score != null

    return (
      <div key={match.id} className="bg-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400">
            {STAGE_LABELS[match.stage as keyof typeof STAGE_LABELS]}
            {match.group_label && ` | Group ${match.group_label}`}
          </span>
          <span className="text-xs text-slate-500">
            {matchDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex-1 text-right">
            <span className="text-sm font-medium text-white">
              {getFlag(homeTeam)} {homeTeam}
            </span>
          </div>
          {hasResult ? (
            <span className="text-sm font-bold text-amber-400 px-2">
              {match.home_score} - {match.away_score}
            </span>
          ) : (
            <span className="text-xs text-slate-500 font-medium px-2">vs</span>
          )}
          <div className="flex-1 text-left">
            <span className="text-sm font-medium text-white">
              {awayTeam} {getFlag(awayTeam)}
            </span>
          </div>
        </div>

        {!deadlinePassed ? (
          <p className="text-xs text-slate-500 italic text-center">Predictions hidden until deadline</p>
        ) : matchPreds.length === 0 ? (
          <p className="text-xs text-slate-500 italic text-center">No predictions</p>
        ) : (
          <div className="space-y-1">
            {matchPreds.map((gp, i) => {
              const pick = gp.predicted_result === 'home' ? homeTeam
                : gp.predicted_result === 'away' ? awayTeam
                : 'Draw'
              const hasScore = gp.predicted_home_score != null && gp.predicted_away_score != null
              const isCorrect = match.is_completed && gp.predicted_result === match.result
              return (
                <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-slate-700/50">
                  <span className="text-slate-300">{gp.display_name}</span>
                  <span className={
                    match.is_completed
                      ? isCorrect ? 'text-green-400 font-medium' : 'text-red-400'
                      : 'text-slate-400'
                  }>
                    {pick} {hasScore && <span className="opacity-75">({gp.predicted_home_score}-{gp.predicted_away_score})</span>}
                  </span>
                </div>
              )
            })}
          </div>
        )}
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
        <div className="overflow-x-auto">
        {entries.length === 0 ? (
          <p className="text-slate-400 text-sm px-4 pb-4">No predictions yet.</p>
        ) : (
          <table className="w-full whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2 w-12">#</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2">Player</th>
                <th className="text-right text-xs font-medium text-slate-400 px-4 py-2">Correct</th>
                <th className="text-right text-xs font-medium text-slate-400 px-4 py-2">Exact</th>
                {winnerDeadlinePassed && (
                  <th className="text-right text-xs font-medium text-slate-400 px-4 py-2">Winner Pick</th>
                )}
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
                    <span className="text-sm text-purple-400">{entry.exact_scores}</span>
                  </td>
                  {winnerDeadlinePassed && (
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-sm text-amber-400">
                        {winnerPicks[entry.user_id]
                          ? `${getFlag(winnerPicks[entry.user_id])} ${winnerPicks[entry.user_id]}`
                          : '-'}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right">
                    <span className="text-sm font-bold text-white">{entry.total_points}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </div>
      </div>

      {/* Today's Matches */}
      {todayMatches.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-white mb-3">Today</h2>
          <div className="space-y-3 mb-6">
            {todayMatches.map(renderMatch)}
          </div>
        </>
      )}

      {/* Upcoming Matches */}
      {upcomingMatches.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-white mb-3">Upcoming</h2>
          <div className="space-y-3">
            {upcomingMatches.map(renderMatch)}
          </div>
        </>
      )}

      {todayMatches.length === 0 && upcomingMatches.length === 0 && (
        <p className="text-slate-400 text-sm">No upcoming matches.</p>
      )}
    </div>
  )
}
