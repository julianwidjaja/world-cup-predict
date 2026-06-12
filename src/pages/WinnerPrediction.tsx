import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getFlag } from '../lib/constants'

const TEAMS_2026 = [
  'Albania', 'Argentina', 'Australia', 'Austria', 'Belgium', 'Bolivia', 'Brazil',
  'Cameroon', 'Canada', 'Chile', 'Colombia', 'Costa Rica', 'Croatia', 'Czech Republic',
  'Denmark', 'DR Congo', 'Ecuador', 'Egypt', 'England', 'Finland', 'France',
  'Georgia', 'Germany', 'Honduras', 'Hungary', 'Indonesia', 'Iran', 'Italy',
  'Jamaica', 'Japan', 'Mexico', 'Morocco', 'Netherlands', 'New Zealand', 'Nigeria',
  'Norway', 'Panama', 'Paraguay', 'Peru', 'Poland', 'Portugal', 'Qatar',
  'Romania', 'Saudi Arabia', 'Senegal', 'Serbia', 'Slovenia', 'South Africa',
  'South Korea', 'Spain', 'Switzerland', 'Türkiye', 'Ukraine', 'United States',
  'Uruguay', 'Uzbekistan', 'Venezuela', 'Wales',
].sort()

export default function WinnerPrediction() {
  const { user } = useAuth()
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [savedTeam, setSavedTeam] = useState<string | null>(null)
  const [deadline, setDeadline] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadData()
  }, [user])

  async function loadData() {
    const [predRes, dlRes] = await Promise.all([
      supabase
        .from('winner_predictions')
        .select('*')
        .eq('user_id', user!.id)
        .single(),
      supabase
        .from('deadlines')
        .select('*')
        .eq('stage', 'tournament_winner')
        .single(),
    ])

    if (predRes.data) {
      setSelectedTeam(predRes.data.predicted_team)
      setSavedTeam(predRes.data.predicted_team)
    }
    if (dlRes.data) {
      setDeadline(new Date(dlRes.data.deadline_time))
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!user || !selectedTeam) return
    setSaving(true)

    const { error } = await supabase
      .from('winner_predictions')
      .upsert(
        { user_id: user.id, predicted_team: selectedTeam },
        { onConflict: 'user_id' }
      )

    if (error) {
      alert(error.message)
    } else {
      setSavedTeam(selectedTeam)
    }
    setSaving(false)
  }

  const isPastDeadline = deadline ? new Date() > deadline : false
  const filteredTeams = search
    ? TEAMS_2026.filter(t => t.toLowerCase().includes(search.toLowerCase()))
    : TEAMS_2026
  const hasChanges = selectedTeam !== savedTeam

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-2">Tournament Winner</h1>
      <p className="text-slate-400 text-sm mb-4">
        Predict which team will win the 2026 World Cup. Worth 250 points!
      </p>

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

      {savedTeam && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 mb-6">
          <div className="text-sm text-emerald-400">Your prediction</div>
          <div className="text-xl text-white font-semibold mt-1">
            {getFlag(savedTeam)} {savedTeam}
          </div>
        </div>
      )}

      {!isPastDeadline && (
        <div className="bg-slate-800 rounded-xl p-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search teams..."
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent mb-3"
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-80 overflow-y-auto">
            {filteredTeams.map(team => (
              <button
                key={team}
                onClick={() => setSelectedTeam(team)}
                className={`px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors ${
                  selectedTeam === team
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {getFlag(team)} {team}
              </button>
            ))}
          </div>

          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full mt-4 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : `Save: ${getFlag(selectedTeam!)} ${selectedTeam}`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
