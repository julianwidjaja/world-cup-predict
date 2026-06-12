import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const DATA_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'

interface RawMatch {
  round: string
  date: string
  time: string
  team1: string
  team2: string
  group?: string
  ground?: string
  num?: number
}

function parseStage(round: string): string {
  if (round.startsWith('Matchday')) return 'group'
  if (round === 'Round of 32') return 'round_of_32'
  if (round === 'Round of 16') return 'round_of_16'
  if (round.includes('Quarter')) return 'quarter_final'
  if (round.includes('Semi')) return 'semi_final'
  if (round.includes('third') || round.includes('Third')) return 'third_place'
  if (round === 'Final') return 'final'
  return 'group'
}

function parseMatchday(round: string): number | null {
  const match = round.match(/Matchday (\d+)/)
  return match ? parseInt(match[1]) : null
}

function parseGroupLabel(group?: string): string | null {
  if (!group) return null
  return group.replace('Group ', '')
}

function parseDateTime(date: string, time: string): string {
  // time format: "13:00 UTC-6" — offset is negative, meaning local = UTC + offset
  const [timePart, offsetPart] = time.split(' ')
  const offsetHours = parseInt(offsetPart.replace('UTC', '')) || 0
  const [hours, minutes] = timePart.split(':').map(Number)

  const totalMinutes = hours * 60 + minutes - offsetHours * 60
  const utcDate = new Date(`${date}T00:00:00Z`)
  utcDate.setUTCMinutes(utcDate.getUTCMinutes() + totalMinutes)

  return utcDate.toISOString()
}

async function main() {
  console.log('Fetching match data...')
  const res = await fetch(DATA_URL)
  const data = await res.json()

  const rawMatches: RawMatch[] = data.matches
  console.log(`Found ${rawMatches.length} matches`)

  const matches = rawMatches.map(m => {
    const stage = parseStage(m.round)
    const isGroup = stage === 'group'

    return {
      match_number: m.num || null,
      stage,
      group_label: parseGroupLabel(m.group),
      home_team: m.team1,
      away_team: m.team2,
      home_team_resolved: isGroup ? m.team1 : null,
      away_team_resolved: isGroup ? m.team2 : null,
      match_date: parseDateTime(m.date, m.time),
      venue: m.ground || null,
    }
  })

  // Clear existing matches
  console.log('Clearing existing matches...')
  await supabase.from('matches').delete().neq('id', 0)

  // Insert matches in batches
  console.log('Inserting matches...')
  const batchSize = 50
  for (let i = 0; i < matches.length; i += batchSize) {
    const batch = matches.slice(i, i + batchSize)
    const { error } = await supabase.from('matches').insert(batch)
    if (error) {
      console.error(`Error inserting batch ${i}:`, error)
      process.exit(1)
    }
    console.log(`  Inserted ${Math.min(i + batchSize, matches.length)}/${matches.length}`)
  }

  // Seed deadlines
  console.log('Seeding deadlines...')

  const stageFirstMatch: Record<string, string> = {}
  for (const m of matches) {
    if (!stageFirstMatch[m.stage] || m.match_date < stageFirstMatch[m.stage]) {
      stageFirstMatch[m.stage] = m.match_date
    }
  }

  const deadlines = [
    { stage: 'group', deadline_time: '2026-06-12T19:00:00Z' }, // Jun 12, 12 PM PDT
    { stage: 'tournament_winner', deadline_time: '2026-06-12T19:00:00Z' },
    { stage: 'round_of_32', deadline_time: stageFirstMatch['round_of_32'] },
    { stage: 'round_of_16', deadline_time: stageFirstMatch['round_of_16'] },
    { stage: 'quarter_final', deadline_time: stageFirstMatch['quarter_final'] },
    { stage: 'semi_final', deadline_time: stageFirstMatch['semi_final'] },
    { stage: 'third_place', deadline_time: stageFirstMatch['third_place'] || stageFirstMatch['final'] },
    { stage: 'final', deadline_time: stageFirstMatch['final'] },
  ].filter(d => d.deadline_time)

  await supabase.from('deadlines').delete().neq('stage', '')
  const { error: dlErr } = await supabase.from('deadlines').insert(deadlines)
  if (dlErr) {
    console.error('Error seeding deadlines:', dlErr)
    process.exit(1)
  }

  console.log(`Seeded ${deadlines.length} deadlines`)
  console.log('Done!')

  // Print summary
  const stageCounts: Record<string, number> = {}
  for (const m of matches) {
    stageCounts[m.stage] = (stageCounts[m.stage] || 0) + 1
  }
  console.log('\nMatch counts by stage:')
  for (const [stage, count] of Object.entries(stageCounts)) {
    console.log(`  ${stage}: ${count}`)
  }

  console.log('\nDeadlines:')
  for (const d of deadlines) {
    console.log(`  ${d.stage}: ${new Date(d.deadline_time).toLocaleString()}`)
  }
}

main().catch(console.error)
