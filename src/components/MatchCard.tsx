import { useState } from 'react'
import { getFlag } from '../lib/constants'
import type { Match, MatchResult } from '../lib/types'

export interface GroupPrediction {
  display_name: string
  predicted_result: MatchResult
  predicted_home_score?: number | null
  predicted_away_score?: number | null
}

interface MatchCardProps {
  match: Match
  prediction: MatchResult | null
  predictedScore?: { home: number | null; away: number | null }
  onPredict: (matchId: number, result: MatchResult) => void
  onPredictScore?: (matchId: number, homeScore: number | null, awayScore: number | null) => void
  disabled: boolean
  showResult?: boolean
  groupPredictions?: GroupPrediction[]
}

export default function MatchCard({ match, prediction, predictedScore, onPredict, onPredictScore, disabled, showResult, groupPredictions }: MatchCardProps) {
  const [showOthers, setShowOthers] = useState(false)
  const homeTeam = match.home_team_resolved || match.home_team
  const awayTeam = match.away_team_resolved || match.away_team
  const isKnockout = match.stage !== 'group'
  const isTBD = isKnockout && (!match.home_team_resolved || !match.away_team_resolved)
  const matchDate = new Date(match.match_date)

  function getResultLabel(): string | null {
    if (!match.is_completed || !match.result) return null
    if (match.home_score !== null && match.away_score !== null) {
      return `${homeTeam} ${match.home_score} - ${match.away_score} ${awayTeam}`
    }
    if (match.result === 'home') return homeTeam
    if (match.result === 'away') return awayTeam
    return 'Draw'
  }

  function pickLabel(result: MatchResult): string {
    if (result === 'home') return homeTeam
    if (result === 'away') return awayTeam
    return 'Draw'
  }

  function scoreLabel(homeScore: number | null | undefined, awayScore: number | null | undefined): string {
    if (homeScore != null && awayScore != null) return `(${homeScore}-${awayScore})`
    return ''
  }

  const isCorrect = match.is_completed && prediction === match.result
  const hasPredictions = groupPredictions && groupPredictions.length > 0

  function handleScoreChange(side: 'home' | 'away', value: string) {
    if (!onPredictScore) return
    const num = value === '' ? null : parseInt(value)
    if (num !== null && (isNaN(num) || num < 0 || num > 99)) return
    const home = side === 'home' ? num : (predictedScore?.home ?? null)
    const away = side === 'away' ? num : (predictedScore?.away ?? null)
    onPredictScore(match.id, home, away)
  }

  return (
    <div className={`bg-slate-700/50 rounded-lg p-3 ${match.is_completed ? 'border border-slate-600' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400">
          {matchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {' '}
          {matchDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </span>
        {match.venue && (
          <span className="text-xs text-slate-500 truncate ml-2">{match.venue}</span>
        )}
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

      {showResult && match.is_completed && (
        <div className="text-center mb-2">
          <span className="text-xs font-medium text-amber-400">
            {getResultLabel()}
          </span>
        </div>
      )}

      {isTBD ? (
        <div className="text-center">
          <span className="text-xs text-slate-500 italic">Teams TBD</span>
        </div>
      ) : (
        <>
          <div className="flex gap-1.5">
            <button
              onClick={() => onPredict(match.id, 'home')}
              disabled={disabled}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                prediction === 'home'
                  ? isCorrect
                    ? 'bg-green-600 text-white'
                    : match.is_completed
                      ? 'bg-red-600/70 text-white'
                      : 'bg-emerald-600 text-white'
                  : 'bg-slate-600 text-slate-300 hover:bg-slate-500 disabled:hover:bg-slate-600 disabled:opacity-50'
              } disabled:cursor-not-allowed`}
            >
              {homeTeam}
            </button>
            {!isKnockout && (
              <button
                onClick={() => onPredict(match.id, 'draw')}
                disabled={disabled}
                className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                  prediction === 'draw'
                    ? isCorrect
                      ? 'bg-green-600 text-white'
                      : match.is_completed
                        ? 'bg-red-600/70 text-white'
                        : 'bg-emerald-600 text-white'
                    : 'bg-slate-600 text-slate-300 hover:bg-slate-500 disabled:hover:bg-slate-600 disabled:opacity-50'
                } disabled:cursor-not-allowed`}
              >
                Draw
              </button>
            )}
            <button
              onClick={() => onPredict(match.id, 'away')}
              disabled={disabled}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                prediction === 'away'
                  ? isCorrect
                    ? 'bg-green-600 text-white'
                    : match.is_completed
                      ? 'bg-red-600/70 text-white'
                      : 'bg-emerald-600 text-white'
                  : 'bg-slate-600 text-slate-300 hover:bg-slate-500 disabled:hover:bg-slate-600 disabled:opacity-50'
                } disabled:cursor-not-allowed`}
            >
              {awayTeam}
            </button>
          </div>

          {/* Optional score prediction */}
          {prediction && !disabled && onPredictScore && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-xs text-slate-400">Score:</span>
              <input
                type="number"
                min="0"
                max="99"
                value={predictedScore?.home ?? ''}
                onChange={e => handleScoreChange('home', e.target.value)}
                placeholder="-"
                className="w-10 text-center px-1 py-0.5 bg-slate-600 border border-slate-500 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-xs text-slate-500">-</span>
              <input
                type="number"
                min="0"
                max="99"
                value={predictedScore?.away ?? ''}
                onChange={e => handleScoreChange('away', e.target.value)}
                placeholder="-"
                className="w-10 text-center px-1 py-0.5 bg-slate-600 border border-slate-500 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-xs text-slate-500 italic">(optional)</span>
            </div>
          )}

          {/* Show saved score when disabled */}
          {prediction && disabled && predictedScore?.home != null && predictedScore?.away != null && (
            <div className="text-center mt-1.5">
              <span className="text-xs text-slate-400">
                Your score: {predictedScore.home} - {predictedScore.away}
              </span>
            </div>
          )}
        </>
      )}

      {prediction && !match.is_completed && !disabled && !onPredictScore && (
        <div className="text-center mt-1.5">
          <span className="text-xs text-emerald-400">
            Your pick: {prediction === 'home' ? homeTeam : prediction === 'away' ? awayTeam : 'Draw'}
          </span>
        </div>
      )}

      {hasPredictions && (
        <div className="mt-2">
          <button
            onClick={() => setShowOthers(!showOthers)}
            className="text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showOthers ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {groupPredictions!.length} prediction{groupPredictions!.length !== 1 ? 's' : ''}
          </button>
          {showOthers && (
            <div className="mt-1.5 space-y-0.5">
              {groupPredictions!.map((gp, i) => {
                const isGpCorrect = match.is_completed && gp.predicted_result === match.result
                const gpScore = scoreLabel(gp.predicted_home_score, gp.predicted_away_score)
                return (
                  <div key={i} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-slate-600/30">
                    <span className="text-slate-300">{gp.display_name}</span>
                    <span className={
                      match.is_completed
                        ? isGpCorrect ? 'text-green-400' : 'text-red-400'
                        : 'text-slate-400'
                    }>
                      {pickLabel(gp.predicted_result)} {gpScore}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
