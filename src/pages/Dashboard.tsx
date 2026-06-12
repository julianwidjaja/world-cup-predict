import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { STAGE_LABELS, STAGE_POINTS, TOURNAMENT_WINNER_POINTS } from '../lib/constants'
import type { Deadline, Match } from '../lib/types'

export default function Dashboard() {
  const { profile, user } = useAuth()
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [totalMatches, setTotalMatches] = useState(0)
  const [predictedCount, setPredictedCount] = useState(0)
  const [winnerPredicted, setWinnerPredicted] = useState(false)
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [user])

  async function loadDashboard() {
    const [dlRes, matchRes, predRes, winnerRes, memberRes] = await Promise.all([
      supabase.from('deadlines').select('*').order('deadline_time'),
      supabase.from('matches').select('id', { count: 'exact' }),
      supabase.from('predictions').select('id', { count: 'exact' }).eq('user_id', user!.id),
      supabase.from('winner_predictions').select('id').eq('user_id', user!.id),
      supabase.from('group_members').select('group_id').eq('user_id', user!.id),
    ])

    if (dlRes.data) setDeadlines(dlRes.data)
    setTotalMatches(matchRes.count || 0)
    setPredictedCount(predRes.count || 0)
    setWinnerPredicted((winnerRes.data?.length || 0) > 0)

    if (memberRes.data && memberRes.data.length > 0) {
      const { data: grps } = await supabase
        .from('groups')
        .select('id, name')
        .in('id', memberRes.data.map(m => m.group_id))
      setGroups(grps || [])
    }
    setLoading(false)
  }

  const now = new Date()
  const nextDeadline = deadlines.find(d => new Date(d.deadline_time) > now)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-2">
        Welcome, {profile?.display_name}!
      </h1>
      <p className="text-slate-400 text-sm mb-6">World Cup 2026 Predictions</p>

      {nextDeadline && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 mb-6">
          <div className="text-xs text-amber-400 mb-1">Next Deadline</div>
          <div className="text-white font-semibold">
            {STAGE_LABELS[nextDeadline.stage as keyof typeof STAGE_LABELS] || nextDeadline.stage}
          </div>
          <div className="text-sm text-amber-300">
            {new Date(nextDeadline.deadline_time).toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric',
            })}{' '}
            at{' '}
            {new Date(nextDeadline.deadline_time).toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit',
            })}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-sm text-slate-400">Matches Predicted</div>
          <div className="text-2xl font-bold text-white">{predictedCount}/{totalMatches}</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-sm text-slate-400">Winner Predicted</div>
          <div className="text-2xl font-bold text-white">{winnerPredicted ? 'Yes' : 'No'}</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-sm text-slate-400">Groups</div>
          <div className="text-2xl font-bold text-white">{groups.length}</div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <Link
          to="/predictions/group"
          className="bg-slate-800 rounded-xl p-4 hover:bg-slate-750 transition-colors block"
        >
          <div className="text-white font-semibold mb-1">Group Stage</div>
          <div className="text-sm text-slate-400">Predict all 72 group matches</div>
        </Link>
        <Link
          to="/predictions/knockout"
          className="bg-slate-800 rounded-xl p-4 hover:bg-slate-750 transition-colors block"
        >
          <div className="text-white font-semibold mb-1">Knockout Stage</div>
          <div className="text-sm text-slate-400">R32, R16, QF, Semi, Final</div>
        </Link>
        <Link
          to="/predictions/winner"
          className="bg-slate-800 rounded-xl p-4 hover:bg-slate-750 transition-colors block"
        >
          <div className="text-white font-semibold mb-1">Tournament Winner</div>
          <div className="text-sm text-slate-400">250 bonus points!</div>
        </Link>
        <Link
          to="/groups"
          className="bg-slate-800 rounded-xl p-4 hover:bg-slate-750 transition-colors block"
        >
          <div className="text-white font-semibold mb-1">Groups</div>
          <div className="text-sm text-slate-400">Create or join a group</div>
        </Link>
      </div>

      {groups.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-white mb-3">Your Groups</h2>
          <div className="space-y-2">
            {groups.map(g => (
              <Link
                key={g.id}
                to={`/leaderboard/${g.id}`}
                className="flex items-center justify-between bg-slate-800 rounded-xl p-4 hover:bg-slate-750 transition-colors"
              >
                <span className="text-white font-medium">{g.name}</span>
                <span className="text-sm text-emerald-400">View Leaderboard</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="mt-8 bg-slate-800 rounded-xl p-4">
        <h2 className="text-lg font-semibold text-white mb-3">Scoring</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {Object.entries(STAGE_POINTS).map(([stage, points]) => (
            <div key={stage} className="flex justify-between text-slate-300">
              <span>{STAGE_LABELS[stage as keyof typeof STAGE_LABELS]}</span>
              <span className="font-medium text-white">{points} pts</span>
            </div>
          ))}
          <div className="flex justify-between text-slate-300">
            <span>Tournament Winner</span>
            <span className="font-medium text-amber-400">{TOURNAMENT_WINNER_POINTS} pts</span>
          </div>
        </div>
      </div>
    </div>
  )
}
