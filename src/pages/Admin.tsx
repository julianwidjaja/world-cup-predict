import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { STAGE_LABELS, STAGE_ORDER, getFlag, TEAMS_2026 } from '../lib/constants'
import type { Match, MatchResult, Stage } from '../lib/types'

const DATA_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'
const FETCH_INTERVAL = 10 * 60 * 1000 // 10 minutes

interface OpenFootballMatch {
  round: string
  date: string
  time: string
  team1: string
  team2: string
  score?: { ft: [number, number] }
  group?: string
  num?: number
}

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
  const [fetching, setFetching] = useState(false)
  const [fetchLog, setFetchLog] = useState<string[]>([])
  const [autoFetch, setAutoFetch] = useState(false)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (autoFetch) {
      fetchResults()
      timerRef.current = setInterval(fetchResults, FETCH_INTERVAL)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [autoFetch])

  async function loadData() {
    const [matchesRes, winnerRes] = await Promise.all([
      supabase.from('matches').select('*').order('match_date'),
      supabase.from('tournament_winner').select('*').eq('id', 1).single(),
    ])
    if (matchesRes.data) setMatches(matchesRes.data)
    if (winnerRes.data) setCurrentWinner(winnerRes.data.team)
    setLoading(false)
  }

  async function fetchResults() {
    setFetching(true)
    const log: string[] = []

    try {
      const res = await fetch(DATA_URL)
      const data = await res.json()
      const apiMatches: OpenFootballMatch[] = data.matches

      const { data: dbMatches } = await supabase
        .from('matches')
        .select('*')
        .eq('is_completed', false)
        .order('match_date')

      if (!dbMatches || dbMatches.length === 0) {
        log.push('No pending matches in database')
        setFetchLog(log)
        setFetching(false)
        setLastFetch(new Date())
        return
      }

      let updated = 0
      let resolved = 0

      const isPlaceholder = (name: string) => /^\d/.test(name) || name.includes('/')

      for (const dbMatch of dbMatches) {
        const apiMatch = dbMatch.match_number
          ? apiMatches.find(am => am.num === dbMatch.match_number)
          : apiMatches.find(am => {
              const homeTeam = dbMatch.home_team_resolved || dbMatch.home_team
              const awayTeam = dbMatch.away_team_resolved || dbMatch.away_team
              return am.team1 === homeTeam && am.team2 === awayTeam
            })

        if (!apiMatch) continue

        // Resolve team names for knockout matches
        if (dbMatch.stage !== 'group') {
          const updates: Record<string, string> = {}
          if (!dbMatch.home_team_resolved && !isPlaceholder(apiMatch.team1)) {
            updates.home_team_resolved = apiMatch.team1
          }
          if (!dbMatch.away_team_resolved && !isPlaceholder(apiMatch.team2)) {
            updates.away_team_resolved = apiMatch.team2
          }
          if (Object.keys(updates).length > 0) {
            const { error } = await supabase
              .from('matches')
              .update(updates)
              .eq('id', dbMatch.id)
            if (!error) {
              resolved++
              log.push(`Resolved: ${updates.home_team_resolved || dbMatch.home_team} vs ${updates.away_team_resolved || dbMatch.away_team}`)
              setMatches(prev =>
                prev.map(m => m.id === dbMatch.id ? { ...m, ...updates } : m)
              )
            }
          }
        }

        // Update score if available
        if (!apiMatch.score?.ft) continue

        const [homeScore, awayScore] = apiMatch.score.ft
        const homeTeam = dbMatch.home_team_resolved || apiMatch.team1
        const awayTeam = dbMatch.away_team_resolved || apiMatch.team2
        let result: MatchResult
        if (homeScore > awayScore) result = 'home'
        else if (awayScore > homeScore) result = 'away'
        else result = 'draw'

        const { error } = await supabase
          .from('matches')
          .update({
            result,
            is_completed: true,
            home_score: homeScore,
            away_score: awayScore,
          })
          .eq('id', dbMatch.id)

        if (!error) {
          log.push(`${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`)
          updated++
          setMatches(prev =>
            prev.map(m => m.id === dbMatch.id
              ? { ...m, result, is_completed: true, home_score: homeScore, away_score: awayScore }
              : m
            )
          )
        } else {
          log.push(`Error updating ${homeTeam} vs ${awayTeam}: ${error.message}`)
        }
      }

      if (updated > 0) {
        await supabase.rpc('resolve_knockout_teams')
      }
      if (updated > 0 || resolved > 0) {
        log.push(`Updated ${updated} result(s), resolved ${resolved} team(s).`)
      } else {
        log.push('No new results found')
      }
    } catch (err) {
      log.push(`Fetch error: ${err}`)
    }

    setFetchLog(log)
    setFetching(false)
    setLastFetch(new Date())
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
      .update({ result: null, is_completed: false, home_score: null, away_score: null })
      .eq('id', matchId)

    if (!error) {
      setMatches(prev =>
        prev.map(m => m.id === matchId ? { ...m, result: null, is_completed: false, home_score: null, away_score: null } : m)
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

  function getPossibleTeams(placeholder: string): string[] {
    // W75, L101 → teams from that match number
    const matchRef = placeholder.match(/^[WL](\d+)$/)
    if (matchRef) {
      const num = parseInt(matchRef[1])
      const refMatch = matches.find(m => m.match_number === num)
      if (refMatch) {
        const teams: string[] = []
        const home = refMatch.home_team_resolved || refMatch.home_team
        const away = refMatch.away_team_resolved || refMatch.away_team
        if (home && !/^\d/.test(home) && !home.includes('/')) teams.push(home)
        if (away && !/^\d/.test(away) && !away.includes('/')) teams.push(away)
        return teams.sort()
      }
    }
    // 1F, 2F → teams in that group
    const groupPos = placeholder.match(/^[12]([A-L])$/)
    if (groupPos) {
      const groupLabel = groupPos[1]
      const groupTeams = new Set<string>()
      for (const m of matches) {
        if (m.stage === 'group' && m.group_label === groupLabel) {
          groupTeams.add(m.home_team)
          groupTeams.add(m.away_team)
        }
      }
      return [...groupTeams].sort()
    }
    // 3A/B/C/D/F → teams from those groups
    const thirdPlace = placeholder.match(/^3([A-L](?:\/[A-L])*)$/)
    if (thirdPlace) {
      const groups = thirdPlace[1].split('/')
      const groupTeams = new Set<string>()
      for (const m of matches) {
        if (m.stage === 'group' && groups.includes(m.group_label || '')) {
          groupTeams.add(m.home_team)
          groupTeams.add(m.away_team)
        }
      }
      return [...groupTeams].sort()
    }
    return TEAMS_2026
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

      {/* Auto-fetch results */}
      <div className="bg-slate-800 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Fetch Results</h2>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={autoFetch}
                onChange={e => setAutoFetch(e.target.checked)}
                className="rounded"
              />
              Auto (every 10 min)
            </label>
            <button
              onClick={fetchResults}
              disabled={fetching}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {fetching ? 'Fetching...' : 'Fetch Now'}
            </button>
          </div>
        </div>
        {lastFetch && (
          <p className="text-xs text-slate-500 mb-2">
            Last checked: {lastFetch.toLocaleTimeString()}
            {autoFetch && ' (next check in 10 min)'}
          </p>
        )}
        {fetchLog.length > 0 && (
          <div className="bg-slate-700/50 rounded-lg p-2 space-y-0.5">
            {fetchLog.map((line, i) => (
              <p key={i} className="text-xs text-slate-300">{line}</p>
            ))}
          </div>
        )}
      </div>

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

                {!match.is_completed && (
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

                {isKnockout && !match.is_completed && (
                  <div className="space-y-2 mb-3">
                    <p className="text-xs text-amber-400">Teams ({match.home_team} vs {match.away_team}):</p>
                    <div className="flex gap-2">
                      <select
                        value={match.home_team_resolved || ''}
                        onChange={e => resolveR32Team(match.id, 'home_team_resolved', e.target.value)}
                        className="flex-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                      >
                        <option value="">-- {match.home_team} --</option>
                        {getPossibleTeams(match.home_team).map(t => (
                          <option key={t} value={t}>{getFlag(t)} {t}</option>
                        ))}
                      </select>
                      <select
                        value={match.away_team_resolved || ''}
                        onChange={e => resolveR32Team(match.id, 'away_team_resolved', e.target.value)}
                        className="flex-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                      >
                        <option value="">-- {match.away_team} --</option>
                        {getPossibleTeams(match.away_team).map(t => (
                          <option key={t} value={t}>{getFlag(t)} {t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

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
