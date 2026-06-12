import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Group, GroupMember, Profile } from '../lib/types'

export default function Groups() {
  const { user } = useAuth()
  const [groups, setGroups] = useState<(Group & { members: (GroupMember & { profile: Profile })[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [createName, setCreateName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadGroups()
  }, [user])

  async function loadGroups() {
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user!.id)

    if (!memberships || memberships.length === 0) {
      setGroups([])
      setLoading(false)
      return
    }

    const groupIds = memberships.map(m => m.group_id)
    const { data: groupsData } = await supabase
      .from('groups')
      .select('*')
      .in('id', groupIds)

    if (!groupsData) {
      setLoading(false)
      return
    }

    const { data: allMembers } = await supabase
      .from('group_members')
      .select('*, profile:profiles(*)')
      .in('group_id', groupIds)

    const enriched = groupsData.map(g => ({
      ...g,
      members: (allMembers || []).filter(m => m.group_id === g.id),
    }))

    setGroups(enriched)
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!createName.trim()) {
      setError('Group name is required')
      return
    }

    const { data: group, error: createErr } = await supabase
      .from('groups')
      .insert({ name: createName.trim(), created_by: user!.id })
      .select()
      .single()

    if (createErr) {
      setError(createErr.message)
      return
    }

    await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: user!.id })

    setCreateName('')
    setSuccess(`Group created! Invite code: ${group.invite_code}`)
    loadGroups()
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const code = joinCode.trim().toLowerCase()
    if (!code) {
      setError('Invite code is required')
      return
    }

    const { data: group } = await supabase
      .from('groups')
      .select('*')
      .eq('invite_code', code)
      .single()

    if (!group) {
      setError('Invalid invite code')
      return
    }

    const { error: joinErr } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: user!.id })

    if (joinErr) {
      if (joinErr.message.includes('duplicate')) {
        setError('You are already in this group')
      } else {
        setError(joinErr.message)
      }
      return
    }

    setJoinCode('')
    setSuccess(`Joined "${group.name}"!`)
    loadGroups()
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setSuccess('Invite code copied!')
    setTimeout(() => setSuccess(''), 2000)
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
      <h1 className="text-2xl font-bold text-white mb-6">Groups</h1>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-lg text-sm mb-4">
          {success}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <form onSubmit={handleCreate} className="bg-slate-800 rounded-xl p-4">
          <h2 className="text-lg font-semibold text-white mb-3">Create Group</h2>
          <input
            type="text"
            value={createName}
            onChange={e => setCreateName(e.target.value)}
            placeholder="Group name"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent mb-3"
          />
          <button
            type="submit"
            className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors"
          >
            Create
          </button>
        </form>

        <form onSubmit={handleJoin} className="bg-slate-800 rounded-xl p-4">
          <h2 className="text-lg font-semibold text-white mb-3">Join Group</h2>
          <input
            type="text"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value)}
            placeholder="Enter invite code"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent mb-3"
          />
          <button
            type="submit"
            className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors"
          >
            Join
          </button>
        </form>
      </div>

      <h2 className="text-lg font-semibold text-white mb-3">Your Groups</h2>
      {groups.length === 0 ? (
        <p className="text-slate-400 text-sm">You haven't joined any groups yet.</p>
      ) : (
        <div className="space-y-3">
          {groups.map(group => (
            <div key={group.id} className="bg-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-semibold">{group.name}</h3>
                <Link
                  to={`/groups/${group.id}`}
                  className="text-sm text-emerald-400 hover:text-emerald-300"
                >
                  View Details
                </Link>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-slate-400">Code:</span>
                <code className="text-xs text-amber-400 bg-slate-700 px-2 py-0.5 rounded">{group.invite_code}</code>
                <button
                  onClick={() => copyCode(group.invite_code)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Copy
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {group.members.map(m => (
                  <span
                    key={m.id}
                    className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-full"
                  >
                    {(m as any).profile?.display_name || 'Unknown'}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
