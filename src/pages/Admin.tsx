import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { STAGE_LABELS, STAGE_ORDER, getFlag } from '../lib/constants'
import type { Match, MatchResult, Stage } from '../lib/types'

export default function Admin() {
  const { profile } = useAuth()
  const [matches, setMatches] = useState<Match[]>([])
  const [selectedStage, setSelectedStage] = useState<Stage>('group')
  const [showCompleted, setShowCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const [winnerTeam, setWinnerTeam] = useState('')
  const [currentWinner, setCurrentWinner] = useState<string | null>(null)
  const [matchScores, setMatchScores] = useState<Record<number, { home: string; away: string }>>({})

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [matchesRes, winnerRes] = await Promise.all([
      supabase.from('matches').select('*').order('match_date'),
      supabase.from('tournament_winner').select('*').eq('id', 1).single(),
    ])
    if (matchesRes.data) setMatches(matchesRes.data)
    if (winnerRes.data) setCurrentWinner(winnerRes.data.team)
    setLoading(false)
  }

  async function setResult(matchId: number, result: MatchResult) {
    setSaving(matchId)
    const scoreInput = matchScores[matchId]
    const homeScore = scoreInput?.home ? parseInt(scoreInput.home) : null
    const awayScore = scoreInput?.away ? parseInt(scoreInput.away) : null

    const { error } = await supabase
      .from('matches')
      .update({
        result,
        is_completed: true,
        home_score: isNaN(homeScore as number) ? null : homeScore,
        away_score: isNaN(awayScore as number) ? null : awayScore,
      })
      .eq('id', matchId)

    if (!error) {
      await supabase.rpc('resolve_knockout_teams')
      setMatches(prev =>
        prev.map(m => m.id === matchId ? { ...m, result, is_completed: true, home_score: homeScore, away_score: awayScore } : m)
      )
    } else {
      alert(error.message)
    }
    setSaving(null)
  }

  async function clearResult(matchId: number) {
    setSaving(matchId)
    const { error } = await supabase
      .from('matches')
      .update({ result: null, is_completed: false })
      .eq('id', matchId)

    if (!error) {
      setMatches(prev =>
        prev.map(m => m.id === matchId ? { ...m, result: null, is_completed: false } : m)
      )
    } else {
      alert(error.message)
    }
    setSaving(null)
  }

  async function resolveR32Team(matchId: number, field: 'home_team_resolved' | 'away_team_resolved', team: string) {
    const { error } = await supabase
      .from('matches')
      .update({ [field]: team })
      .eq('id', matchId)

    if (!error) {
      setMatches(prev =>
        prev.map(m => m.id === matchId ? { ...m, [field]: team } : m)
      )
    } else {
      alert(error.message)
    }
  }

  async function setTournamentWinner() {
    if (!winnerTeam.trim()) return
    const { error } = await supabase
      .from('tournament_winner')
      .update({ team: winnerTeam.trim(), decided_at: new Date().toISOString() })
      .eq('id', 1)

    if (!error) {
      setCurrentWinner(winnerTeam.trim())
      setWinnerTeam('')
    } else {
      alert(error.message)
    }
  }

  if (!profile?.is_admin) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-red-400">Access denied. Admin only.</p>
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

  const stageMatches = matches
    .filter(m => m.stage === selectedStage)
    .filter(m => showCompleted || !m.is_completed)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">Admin Panel</h1>

      {/* Stage selector */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {STAGE_ORDER.map(stage => (
          <button
            key={stage}
            onClick={() => setSelectedStage(stage)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              selectedStage === stage
                ? 'bg-amber-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {STAGE_LABELS[stage]}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-400 mb-4">
        <input
          type="checkbox"
          checked={showCompleted}
          onChange={e => setShowCompleted(e.target.checked)}
          className="rounded"
        />
        Show completed matches
      </label>

      {/* Match result entry */}
      <div className="space-y-3 mb-8">
        {stageMatches.length === 0 ? (
          <p className="text-slate-400 text-sm">No {showCompleted ? '' : 'pending '}matches for this stage.</p>
        ) : (
          stageMatches.map(match => {
            const homeTeam = match.home_team_resolved || match.home_team
            const awayTeam = match.away_team_resolved || match.away_team
            const isKnockout = match.stage !== 'group'
            const needsResolution = isKnockout && (!match.home_team_resolved || !match.away_team_resolved)

            return (
              <div key={match.id} className="bg-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">
                    {new Date(match.match_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {match.group_label && ` | Group ${match.group_label}`}
                    {match.match_number && ` | Match #${match.match_number}`}
                  </span>
                  {match.is_completed && (
                    <button
                      onClick={() => clearResult(match.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Clear Result
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-white">
                    {getFlag(homeTeam)} {homeTeam}
                  </span>
                  <span className="text-xs text-slate-500 px-2">vs</span>
                  <span className="text-sm font-medium text-white">
                    {awayTeam} {getFlag(awayTeam)}
                  </span>
                </div>

                {!needsResolution && !match.is_completed && (
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <span className="text-xs text-slate-400">Score:</span>
                    <input
                      type="number"
                      min="0"
                      placeholder={homeTeam}
                      value={matchScores[match.id]?.home ?? (match.home_score?.toString() || '')}
                      onChange={e => setMatchScores(s => ({ ...s, [match.id]: { home: e.target.value, away: s[match.id]?.away || '' } }))}
                      className="w-14 text-center px-1 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                    />
                    <span className="text-slate-500">-</span>
                    <input
                      type="number"
                      min="0"
                      placeholder={awayTeam}
                      value={matchScores[match.id]?.away ?? (match.away_score?.toString() || '')}
                      onChange={e => setMatchScores(s => ({ ...s, [match.id]: { home: s[match.id]?.home || '', away: e.target.value } }))}
                      className="w-14 text-center px-1 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                    />
                  </div>
                )}

                {match.is_completed && match.home_score != null && match.away_score != null && (
                  <div className="text-center mb-3">
                    <span className="text-xs text-amber-400">
                      Score: {match.home_score} - {match.away_score}
                    </span>
                  </div>
                )}

                {needsResolution ? (
                  <div className="space-y-2">
                    <p className="text-xs text-amber-400">Resolve teams:</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder={`Home: ${match.home_team}`}
                        defaultValue={match.home_team_resolved || ''}
                        onBlur={e => resolveR32Team(match.id, 'home_team_resolved', e.target.value)}
                        className="flex-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                      />
                      <input
                        type="text"
                        placeholder={`Away: ${match.away_team}`}
                        defaultValue={match.away_team_resolved || ''}
                        onBlur={e => resolveR32Team(match.id, 'away_team_resolved', e.target.value)}
                        className="flex-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setResult(match.id, 'home')}
                      disabled={saving === match.id}
                      className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                        match.result === 'home'
                          ? 'bg-green-600 text-white'
                          : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                      }`}
                    >
                      {homeTeam} wins
                    </button>
                    {!isKnockout && (
                      <button
                        onClick={() => setResult(match.id, 'draw')}
                        disabled={saving === match.id}
                        className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                          match.result === 'draw'
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                        }`}
                      >
                        Draw
                      </button>
                    )}
                    <button
                      onClick={() => setResult(match.id, 'away')}
                      disabled={saving === match.id}
                      className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                        match.result === 'away'
                          ? 'bg-green-600 text-white'
                          : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                      }`}
                    >
                      {awayTeam} wins
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Tournament Winner */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h2 className="text-lg font-semibold text-white mb-3">Tournament Winner</h2>
        {currentWinner && (
          <p className="text-emerald-400 text-sm mb-2">
            Current: {getFlag(currentWinner)} {currentWinner}
          </p>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={winnerTeam}
            onChange={e => setWinnerTeam(e.target.value)}
            placeholder="Team name"
            className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 text-sm"
          />
          <button
            onClick={setTournamentWinner}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg"
          >
            Set Winner
          </button>
        </div>
      </div>
    </div>
  )
}
