import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { LeaderboardEntry, Group } from '../lib/types'

export default function Leaderboard() {
  const { groupId } = useParams<{ groupId: string }>()
  const { user } = useAuth()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [group, setGroup] = useState<Group | null>(null)
  const [userGroups, setUserGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUserGroups()
  }, [user])

  useEffect(() => {
    if (groupId) loadLeaderboard(groupId)
  }, [groupId])

  async function loadUserGroups() {
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user!.id)

    if (memberships && memberships.length > 0) {
      const { data: groups } = await supabase
        .from('groups')
        .select('*')
        .in('id', memberships.map(m => m.group_id))
      setUserGroups(groups || [])
    }
  }

  async function loadLeaderboard(gId: string) {
    setLoading(true)
    const [leaderboardRes, groupRes] = await Promise.all([
      supabase.rpc('get_leaderboard', { p_group_id: gId }),
      supabase.from('groups').select('*').eq('id', gId).single(),
    ])

    if (leaderboardRes.data) setEntries(leaderboardRes.data)
    if (groupRes.data) setGroup(groupRes.data)
    setLoading(false)
  }

  if (!groupId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-white mb-6">Leaderboard</h1>
        {userGroups.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 mb-4">Join a group to see the leaderboard.</p>
            <Link to="/groups" className="text-emerald-400 hover:text-emerald-300">
              Go to Groups
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-slate-400 text-sm mb-3">Select a group:</p>
            {userGroups.map(g => (
              <Link
                key={g.id}
                to={`/leaderboard/${g.id}`}
                className="block bg-slate-800 rounded-xl p-4 hover:bg-slate-750 transition-colors"
              >
                <span className="text-white font-semibold">{g.name}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
          {group && <p className="text-slate-400 text-sm">{group.name}</p>}
        </div>
        {userGroups.length > 1 && (
          <select
            value={groupId}
            onChange={e => window.location.href = `/leaderboard/${e.target.value}`}
            className="bg-slate-700 border border-slate-600 rounded-lg text-white text-sm px-3 py-1.5"
          >
            {userGroups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-slate-400 text-center py-8">No predictions yet.</p>
      ) : (
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 w-12">#</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Player</th>
                <th className="text-right text-xs font-medium text-slate-400 px-4 py-3">Correct</th>
                <th className="text-right text-xs font-medium text-slate-400 px-4 py-3">Points</th>
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
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {i === 0 ? '1' : i === 1 ? '2' : i === 2 ? '3' : i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-white">
                      {entry.display_name}
                      {entry.user_id === user!.id && (
                        <span className="text-emerald-400 text-xs ml-1">(you)</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-slate-400">
                      {entry.correct_predictions}/{entry.total_predictions}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-bold text-white">{entry.total_points}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
