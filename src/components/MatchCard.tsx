import { getFlag } from '../lib/constants'
import type { Match, MatchResult } from '../lib/types'

interface MatchCardProps {
  match: Match
  prediction: MatchResult | null
  onPredict: (matchId: number, result: MatchResult) => void
  disabled: boolean
  showResult?: boolean
}

export default function MatchCard({ match, prediction, onPredict, disabled, showResult }: MatchCardProps) {
  const homeTeam = match.home_team_resolved || match.home_team
  const awayTeam = match.away_team_resolved || match.away_team
  const isKnockout = match.stage !== 'group'
  const isTBD = isKnockout && (!match.home_team_resolved || !match.away_team_resolved)
  const matchDate = new Date(match.match_date)

  function getResultLabel(): string | null {
    if (!match.is_completed || !match.result) return null
    if (match.result === 'home') return homeTeam
    if (match.result === 'away') return awayTeam
    return 'Draw'
  }

  const isCorrect = match.is_completed && prediction === match.result

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
            Result: {getResultLabel()}
          </span>
        </div>
      )}

      {isTBD ? (
        <div className="text-center">
          <span className="text-xs text-slate-500 italic">Teams TBD</span>
        </div>
      ) : (
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
      )}

      {prediction && !match.is_completed && !disabled && (
        <div className="text-center mt-1.5">
          <span className="text-xs text-emerald-400">
            Your pick: {prediction === 'home' ? homeTeam : prediction === 'away' ? awayTeam : 'Draw'}
          </span>
        </div>
      )}
    </div>
  )
}
