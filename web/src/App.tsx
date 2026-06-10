import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Brain,
  ChartNoAxesColumnIncreasing,
  CheckCircle2,
  Cloud,
  HeartPulse,
  Loader2,
  Moon,
  Shield,
  Sparkles,
  Wind,
} from 'lucide-react'
import { Route, Routes } from 'react-router-dom'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { Shell } from './components/Shell.tsx'
import { useAuth } from './hooks/useAuth.ts'
import { db } from './lib/firebase.ts'

type Mood = 'heavy' | 'anxious' | 'flat' | 'steady' | 'bright'
type PracticeKind = 'breath' | 'grounding' | 'journal' | 'movement' | 'rest'

interface CheckInDraft {
  mood: Mood
  energy: number
  mentalSpeed: number
  tension: number
}

interface CheckIn extends CheckInDraft {
  id: string
  createdAt: string
  practiceId: string
  completed?: boolean
  completedAt?: string
  shifted?: 'better' | 'same' | 'worse'
}

interface Practice {
  id: string
  kind: PracticeKind
  title: string
  minutes: number
  summary: string
  steps: string[]
  bestFor: string
  energyRange: [number, number]
  speedRange: [number, number]
  tensionRange: [number, number]
  moods: Mood[]
  intensity: 'soft' | 'steady' | 'active'
  icon: typeof Wind
}

interface AgentResult {
  score: number
  state: string
  reason: string
  safety: string
  pattern: string
  practice: Practice
  alternatives: Practice[]
  cue: string
}

interface StoredState {
  entries: CheckIn[]
}

const STORAGE_KEY = 'slowdown-state-v1'
const CLOUD_DOC_ID = 'slowdown'

const MOODS: Array<{ id: Mood; label: string; tone: string }> = [
  { id: 'heavy', label: 'Heavy', tone: 'Low and burdened' },
  { id: 'anxious', label: 'Anxious', tone: 'Fast or unsettled' },
  { id: 'flat', label: 'Flat', tone: 'Numb or foggy' },
  { id: 'steady', label: 'Steady', tone: 'Okay enough' },
  { id: 'bright', label: 'Bright', tone: 'Open or clear' },
]

const PRACTICES: Practice[] = [
  {
    id: 'long-exhale',
    kind: 'breath',
    title: 'Long Exhale Reset',
    minutes: 2,
    summary: 'Slow the nervous system with a longer out-breath.',
    bestFor: 'high mental speed, anxiety, tension',
    energyRange: [1, 5],
    speedRange: [3, 5],
    tensionRange: [3, 5],
    moods: ['anxious', 'heavy', 'steady'],
    intensity: 'soft',
    icon: Wind,
    steps: ['Inhale for 3 counts.', 'Exhale for 6 counts.', 'Repeat 10 times with your shoulders loose.'],
  },
  {
    id: 'five-senses',
    kind: 'grounding',
    title: 'Five Senses Grounding',
    minutes: 3,
    summary: 'Move attention out of looping thoughts and back into the room.',
    bestFor: 'racing thoughts or emotional overload',
    energyRange: [2, 5],
    speedRange: [4, 5],
    tensionRange: [2, 5],
    moods: ['anxious', 'steady'],
    intensity: 'steady',
    icon: Shield,
    steps: ['Name 5 things you see.', 'Name 4 things you feel.', 'Name 3 sounds, 2 smells, and 1 thing you can taste.'],
  },
  {
    id: 'one-line-truth',
    kind: 'journal',
    title: 'One-Line Truth',
    minutes: 2,
    summary: 'Untangle the strongest thought without turning it into a diary session.',
    bestFor: 'heavy mood or unclear emotion',
    energyRange: [2, 5],
    speedRange: [1, 4],
    tensionRange: [1, 4],
    moods: ['heavy', 'flat', 'steady'],
    intensity: 'soft',
    icon: Brain,
    steps: ['Write: “Right now I am noticing...”', 'Write one sentence only.', 'Add: “The next kind step is...”'],
  },
  {
    id: 'wake-the-body',
    kind: 'movement',
    title: 'Wake the Body',
    minutes: 4,
    summary: 'Use gentle movement when energy is low and stillness feels like sinking.',
    bestFor: 'low energy, flat mood, body heaviness',
    energyRange: [1, 3],
    speedRange: [1, 3],
    tensionRange: [1, 4],
    moods: ['flat', 'heavy'],
    intensity: 'active',
    icon: Activity,
    steps: ['Roll your shoulders 8 times.', 'Press feet into the floor for 20 seconds.', 'Walk slowly for 2 minutes.'],
  },
  {
    id: 'soft-landing',
    kind: 'rest',
    title: 'Soft Landing',
    minutes: 5,
    summary: 'A low-effort pause for when doing more would be too much.',
    bestFor: 'exhaustion, high tension, end of day',
    energyRange: [1, 2],
    speedRange: [1, 5],
    tensionRange: [3, 5],
    moods: ['heavy', 'flat', 'anxious'],
    intensity: 'soft',
    icon: Moon,
    steps: ['Dim the screen or look away.', 'Unclench your jaw and hands.', 'Let one sound in the room be enough for 5 minutes.'],
  },
  {
    id: 'box-breath',
    kind: 'breath',
    title: 'Box Breath',
    minutes: 3,
    summary: 'Add structure when the mind feels scattered but you still have some energy.',
    bestFor: 'medium energy with scattered attention',
    energyRange: [2, 5],
    speedRange: [3, 5],
    tensionRange: [1, 4],
    moods: ['anxious', 'steady', 'bright'],
    intensity: 'steady',
    icon: Wind,
    steps: ['Inhale for 4 counts.', 'Hold for 4 counts.', 'Exhale for 4 counts, then hold for 4 counts. Repeat 5 rounds.'],
  },
  {
    id: 'name-the-need',
    kind: 'journal',
    title: 'Name the Need',
    minutes: 2,
    summary: 'Turn a vague mood into one practical need.',
    bestFor: 'mixed mood, unclear stress, decision fatigue',
    energyRange: [2, 5],
    speedRange: [2, 5],
    tensionRange: [2, 5],
    moods: ['heavy', 'anxious', 'steady'],
    intensity: 'soft',
    icon: Brain,
    steps: ['Write three words for the feeling.', 'Circle the strongest word.', 'Finish: “What I need next is...”'],
  },
  {
    id: 'shake-out',
    kind: 'movement',
    title: 'Shake Out',
    minutes: 1,
    summary: 'Discharge restless energy before trying to sit still.',
    bestFor: 'high energy, high tension, agitation',
    energyRange: [4, 5],
    speedRange: [3, 5],
    tensionRange: [3, 5],
    moods: ['anxious', 'bright'],
    intensity: 'active',
    icon: Activity,
    steps: ['Shake out both hands for 20 seconds.', 'Loosen shoulders and jaw.', 'Take one slow breath before choosing what to do next.'],
  },
  {
    id: 'tiny-savor',
    kind: 'grounding',
    title: 'Tiny Savor',
    minutes: 2,
    summary: 'Protect a good or steady mood by noticing one pleasant detail.',
    bestFor: 'steady or bright mood with usable energy',
    energyRange: [3, 5],
    speedRange: [1, 4],
    tensionRange: [1, 3],
    moods: ['steady', 'bright'],
    intensity: 'soft',
    icon: Sparkles,
    steps: ['Find one pleasant sight, sound, or sensation.', 'Stay with it for 30 seconds.', 'Name what made it pleasant.'],
  },
  {
    id: 'lower-the-room',
    kind: 'rest',
    title: 'Lower the Room',
    minutes: 3,
    summary: 'Reduce stimulation when the environment is feeding the feeling.',
    bestFor: 'sensory overload, late-day stress, screen fatigue',
    energyRange: [1, 4],
    speedRange: [3, 5],
    tensionRange: [3, 5],
    moods: ['anxious', 'heavy', 'flat'],
    intensity: 'soft',
    icon: Moon,
    steps: ['Lower brightness or look away from the screen.', 'Drop one source of noise if you can.', 'Sit with both feet planted for 10 breaths.'],
  },
]

const DEFAULT_DRAFT: CheckInDraft = {
  mood: 'anxious',
  energy: 3,
  mentalSpeed: 4,
  tension: 4,
}

function readState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { entries: [] }
    const parsed = JSON.parse(raw) as StoredState
    return { entries: Array.isArray(parsed.entries) ? parsed.entries : [] }
  } catch {
    return { entries: [] }
  }
}

function writeState(state: StoredState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.dispatchEvent(new Event('slowdown-state-change'))
}

function safetyAgent(draft: CheckInDraft): Pick<AgentResult, 'safety' | 'score'> {
  const strain = draft.tension + draft.mentalSpeed - draft.energy
  if (draft.mood === 'heavy' && draft.energy <= 1) {
    return {
      score: strain + 3,
      safety: 'Keep this gentle. If you feel at risk of hurting yourself or someone else, contact local emergency support now.',
    }
  }
  if (strain >= 7) {
    return { score: strain, safety: 'Use a short practice only. The goal is to reduce intensity, not solve the whole day.' }
  }
  return { score: strain, safety: 'General wellbeing support. This app does not diagnose or treat mental health conditions.' }
}

function patternAgent(draft: CheckInDraft, entries: CheckIn[]): string {
  const recent = entries.slice(0, 7)
  if (recent.length < 3) return 'Not enough history yet. The recommendation is based on this check-in only.'

  const lowEnergyCount = recent.filter((entry) => entry.energy <= 2).length
  const fastMindCount = recent.filter((entry) => entry.mentalSpeed >= 4).length
  const tenseCount = recent.filter((entry) => entry.tension >= 4).length

  if (draft.mentalSpeed >= 4 && fastMindCount >= 3) return 'Racing thoughts have shown up repeatedly this week.'
  if (draft.energy <= 2 && lowEnergyCount >= 3) return 'Low energy has been a recurring pattern lately.'
  if (draft.tension >= 4 && tenseCount >= 3) return 'Body tension has been the most consistent signal.'
  return 'Recent check-ins are mixed, so the app is prioritizing your current state.'
}

function rangeScore(value: number, [min, max]: [number, number]) {
  if (value >= min && value <= max) return 4
  const distance = value < min ? min - value : value - max
  return Math.max(0, 4 - distance * 1.5)
}

function moodScore(mood: Mood, practice: Practice) {
  return practice.moods.includes(mood) ? 5 : 0
}

function pastOutcomeScore(practice: Practice, entries: CheckIn[]) {
  const recentForPractice = entries.filter((entry) => entry.practiceId === practice.id).slice(0, 6)
  if (recentForPractice.length === 0) return 0
  return recentForPractice.reduce((sum, entry) => {
    if (entry.shifted === 'better') return sum + 2
    if (entry.shifted === 'worse') return sum - 2
    return sum
  }, 0)
}

function stateLabel(draft: CheckInDraft) {
  if (draft.energy <= 2 && draft.tension >= 4) return 'tired and tense'
  if (draft.mentalSpeed >= 4 && draft.tension >= 4) return 'activated'
  if (draft.energy <= 2 && draft.mentalSpeed <= 2) return 'low-power'
  if (draft.energy >= 4 && draft.mood === 'bright') return 'open'
  if (draft.mood === 'heavy') return 'heavy'
  if (draft.mood === 'flat') return 'flat'
  return 'available'
}

function actionCue(draft: CheckInDraft, practice: Practice) {
  if (draft.energy <= 2 && practice.intensity === 'active') return 'Keep the movement tiny; stopping is allowed.'
  if (draft.mentalSpeed >= 4) return 'Do this before making another decision.'
  if (draft.tension >= 4) return 'Start with your jaw, shoulders, and hands.'
  if (draft.mood === 'bright') return 'Use this to preserve the good state, not chase more.'
  return 'One round is enough.'
}

function recommendationAgent(draft: CheckInDraft, entries: CheckIn[]): AgentResult {
  const safety = safetyAgent(draft)
  const pattern = patternAgent(draft, entries)
  const ranked = [...PRACTICES]
    .map((practice) => {
      const score =
        moodScore(draft.mood, practice) +
        rangeScore(draft.energy, practice.energyRange) +
        rangeScore(draft.mentalSpeed, practice.speedRange) +
        rangeScore(draft.tension, practice.tensionRange) +
        pastOutcomeScore(practice, entries)

      const safetyPenalty = safety.score >= 7 && practice.intensity === 'active' ? 3 : 0
      const lowEnergyPenalty = draft.energy <= 1 && practice.minutes > 3 ? 2 : 0
      return { practice, score: score - safetyPenalty - lowEnergyPenalty }
    })
    .sort((a, b) => b.score - a.score)

  const practice = ranked[0]!.practice
  const alternatives = ranked.slice(1, 3).map((item) => item.practice)
  const state = stateLabel(draft)

  return {
    score: safety.score,
    state,
    reason: `${practice.title} scored highest for ${state} state: mood ${draft.mood}, energy ${draft.energy}, speed ${draft.mentalSpeed}, tension ${draft.tension}.`,
    safety: safety.safety,
    pattern,
    practice,
    alternatives,
    cue: actionCue(draft, practice),
  }
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function moodValue(mood: Mood) {
  return {
    heavy: 1,
    flat: 2,
    anxious: 2.5,
    steady: 4,
    bright: 5,
  }[mood]
}

function balanceScore(entry: CheckIn) {
  const calm = 6 - Math.max(entry.mentalSpeed, entry.tension)
  return Math.max(1, Math.min(5, (moodValue(entry.mood) + entry.energy + calm) / 3))
}

function Sparkline({
  label,
  values,
  color,
}: {
  label: string
  values: number[]
  color: string
}) {
  const points = values.length > 1
    ? values.map((value, index) => {
      const x = (index / (values.length - 1)) * 100
      const y = 100 - ((value - 1) / 4) * 100
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
    : ''

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--glass-soft)] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
        <p className="text-sm font-black text-[var(--ink)]">{values.at(-1)?.toFixed(1) ?? '-'}</p>
      </div>
      <svg viewBox="0 0 100 42" role="img" aria-label={`${label} trend`} className="mt-2 h-16 w-full overflow-visible">
        <line x1="0" x2="100" y1="20" y2="20" stroke="var(--line-strong)" strokeWidth="1" />
        {points ? (
          <polyline points={points} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <circle cx="50" cy="20" r="4" fill={color} />
        )}
      </svg>
    </div>
  )
}

function TrendGraph({ entries }: { entries: CheckIn[] }) {
  const ordered = [...entries].reverse().slice(-14)
  const energy = ordered.map((entry) => entry.energy)
  const balance = ordered.map(balanceScore)
  const speed = ordered.map((entry) => entry.mentalSpeed)
  const tension = ordered.map((entry) => entry.tension)
  const latest = ordered.at(-1)
  const previous = ordered.at(-2)
  const delta = latest && previous ? balanceScore(latest) - balanceScore(previous) : 0

  return (
    <Panel className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-deep)]">
            <ChartNoAxesColumnIncreasing className="h-4 w-4" />
            Lately
          </div>
          <h2 className="mt-2 text-xl font-black text-[var(--ink)]">Last {ordered.length || 0} check-ins</h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${delta >= 0 ? 'bg-[var(--mint-soft)] text-[var(--mint-deep)]' : 'bg-[var(--accent-soft)] text-[var(--accent-deep)]'}`}>
          {delta >= 0 ? 'Stable or up' : 'Needs care'}
        </span>
      </div>

      {ordered.length === 0 ? (
        <p className="text-sm font-semibold text-[var(--muted)]">Save a few resets to build your trend graph.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <Sparkline label="Balance" values={balance} color="var(--mint)" />
          <Sparkline label="Energy" values={energy} color="var(--sky)" />
          <Sparkline label="Mental speed" values={speed} color="var(--warning)" />
          <Sparkline label="Tension" values={tension} color="var(--accent)" />
        </div>
      )}
    </Panel>
  )
}

function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
}: {
  children: React.ReactNode
  onClick: () => void
  variant?: 'primary' | 'quiet'
  disabled?: boolean
}) {
  const className = variant === 'primary'
    ? 'bg-[var(--ink)] text-[var(--paper)] shadow-[var(--shadow-card)] hover:opacity-90'
    : 'border border-[var(--line)] bg-[var(--glass)] text-[var(--ink)] hover:bg-[var(--glass-hover)]'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  )
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-4 shadow-[var(--shadow-card)] backdrop-blur-xl sm:p-5 ${className}`}>
      {children}
    </section>
  )
}

function Slider({
  label,
  value,
  low,
  high,
  onChange,
}: {
  label: string
  value: number
  low: string
  high: string
  onChange: (value: number) => void
}) {
  return (
    <label className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--glass-soft)] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-[var(--ink)]">{label}</span>
        <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-[var(--paper)] px-2 text-sm font-black text-[var(--ink)]">
          {value}
        </span>
      </div>
      <input
        type="range"
        min="1"
        max="5"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full accent-[var(--accent)]"
      />
      <div className="flex justify-between text-xs font-semibold text-[var(--muted)]">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </label>
  )
}

function PracticeView({ result }: { result: AgentResult }) {
  const Icon = result.practice.icon

  return (
    <Panel className="grid gap-5">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--mint-soft)] text-[var(--mint-deep)]">
          <Icon className="h-6 w-6" strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--accent-deep)]">One reset</p>
          <h2 className="display-font mt-1 text-3xl font-bold text-[var(--ink)]">{result.practice.title}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{result.practice.summary}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-[var(--paper)] p-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Time</p>
          <p className="mt-1 text-lg font-black text-[var(--ink)]">{result.practice.minutes} min</p>
        </div>
        <div className="rounded-xl bg-[var(--paper)] p-3 sm:col-span-2">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Agent match</p>
          <p className="mt-1 text-sm font-semibold leading-5 text-[var(--ink)]">{result.reason}</p>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--mint-gradient)] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Cue</p>
        <p className="mt-1 text-sm font-black leading-6 text-[var(--ink)]">{result.cue}</p>
      </div>

      <ol className="grid gap-2">
        {result.practice.steps.map((step, index) => (
          <li key={step} className="flex gap-3 rounded-xl border border-[var(--line)] bg-[var(--glass-soft)] p-3 text-sm font-semibold leading-6 text-[var(--ink)]">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--sky-soft)] text-xs font-black text-[var(--sky-deep)]">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--cool-gradient)] p-4 text-sm leading-6 text-[var(--ink)]">
        <p className="font-bold">Agent notes</p>
        <p className="mt-1 text-[var(--muted)]">{result.pattern}</p>
        <p className="mt-1 text-[var(--muted)]">{result.safety}</p>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">If this does not fit</p>
        <div className="mt-2 grid gap-2">
          {result.alternatives.map((practice) => (
            <div key={practice.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--glass-soft)] p-3">
              <div>
                <p className="text-sm font-black text-[var(--ink)]">{practice.title}</p>
                <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{practice.bestFor}</p>
              </div>
              <span className="rounded-lg bg-[var(--paper)] px-2 py-1 text-xs font-black text-[var(--ink)]">{practice.minutes}m</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}

function ResetPage() {
  const { user } = useAuth()
  const [draft, setDraft] = useState<CheckInDraft>(DEFAULT_DRAFT)
  const [entries, setEntries] = useState<CheckIn[]>(() => readState().entries)
  const [agentStatus, setAgentStatus] = useState<'idle' | 'running'>('running')
  const [result, setResult] = useState<AgentResult>(() => recommendationAgent(DEFAULT_DRAFT, readState().entries))
  const [syncStatus, setSyncStatus] = useState('Local')
  const [lastSavedId, setLastSavedId] = useState<string | null>(null)

  useEffect(() => {
    setAgentStatus('running')
    const handle = window.setTimeout(() => {
      setResult(recommendationAgent(draft, entries))
      setAgentStatus('idle')
    }, 360)
    return () => window.clearTimeout(handle)
  }, [draft, entries])

  useEffect(() => {
    writeState({ entries })
  }, [entries])

  useEffect(() => {
    if (!user || !db) return
    let active = true
    getDoc(doc(db, 'users', user.uid, 'apps', CLOUD_DOC_ID))
      .then((snapshot) => {
        if (!active || !snapshot.exists()) return
        const data = snapshot.data() as StoredState
        if (Array.isArray(data.entries) && data.entries.length > entries.length) {
          setEntries(data.entries)
          setSyncStatus('Synced')
        }
      })
      .catch(() => setSyncStatus('Local'))
    return () => {
      active = false
    }
  }, [entries.length, user])

  async function saveCloud(nextEntries: CheckIn[]) {
    if (!user || !db) {
      setSyncStatus('Local')
      return
    }
    setSyncStatus('Syncing')
    try {
      await setDoc(doc(db, 'users', user.uid, 'apps', CLOUD_DOC_ID), {
        entries: nextEntries,
        updatedAt: serverTimestamp(),
      })
      setSyncStatus('Synced')
    } catch {
      setSyncStatus('Local')
    }
  }

  function saveCheckIn() {
    const nextEntry: CheckIn = {
      ...draft,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      practiceId: result.practice.id,
    }
    const nextEntries = [nextEntry, ...entries].slice(0, 60)
    setEntries(nextEntries)
    setLastSavedId(nextEntry.id)
    void saveCloud(nextEntries)
  }

  function markOutcome(shifted: NonNullable<CheckIn['shifted']>) {
    if (!lastSavedId) return
    const nextEntries = entries.map((entry) => entry.id === lastSavedId ? { ...entry, shifted } : entry)
    setEntries(nextEntries)
    void saveCloud(nextEntries)
  }

  function markCompleted(completed: boolean) {
    if (!lastSavedId) return
    const nextEntries = entries.map((entry) => entry.id === lastSavedId
      ? { ...entry, completed, completedAt: completed ? new Date().toISOString() : undefined }
      : entry)
    setEntries(nextEntries)
    void saveCloud(nextEntries)
  }

  return (
    <div className="grid gap-5 pb-20 lg:pb-0">
      <header className="grid gap-4 rounded-b-3xl border-b border-[var(--line)] bg-[var(--glass)] px-4 py-5 backdrop-blur-xl sm:rounded-3xl sm:border sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--accent-deep)]">Slowdown</p>
            <h1 className="display-font mt-2 text-4xl font-bold text-[var(--ink)] sm:text-5xl">One small reset.</h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-xs font-bold text-[var(--muted)]">
            {agentStatus === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Agents {agentStatus === 'running' ? 'reading state' : 'ready'}
          </div>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Check mood, energy, and tension. The app picks one practice instead of making you search a library.
        </p>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(22rem,0.65fr)]">
        <Panel className="grid gap-5">
          <div>
            <h2 className="text-lg font-black text-[var(--ink)]">Check in</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">No diagnosis. Just enough signal to choose the next useful minute.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-5">
            {MOODS.map((mood) => (
              <button
                key={mood.id}
                type="button"
                onClick={() => setDraft((current) => ({ ...current, mood: mood.id }))}
                className={`min-h-24 rounded-xl border p-3 text-left ${
                  draft.mood === mood.id
                    ? 'border-[var(--accent)] bg-[var(--warm-gradient)] shadow-[var(--shadow-card)]'
                    : 'border-[var(--line)] bg-[var(--glass-soft)] hover:bg-[var(--glass-hover)]'
                }`}
              >
                <span className="block text-sm font-black text-[var(--ink)]">{mood.label}</span>
                <span className="mt-2 block text-xs font-semibold leading-5 text-[var(--muted)]">{mood.tone}</span>
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Slider label="Energy" value={draft.energy} low="Drained" high="Charged" onChange={(energy) => setDraft((current) => ({ ...current, energy }))} />
            <Slider label="Mental speed" value={draft.mentalSpeed} low="Slow" high="Racing" onChange={(mentalSpeed) => setDraft((current) => ({ ...current, mentalSpeed }))} />
            <Slider label="Body tension" value={draft.tension} low="Loose" high="Tight" onChange={(tension) => setDraft((current) => ({ ...current, tension }))} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={saveCheckIn}>
              <CheckCircle2 className="h-4 w-4" />
              Save this reset
            </Button>
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[var(--muted)]">
              <Cloud className="h-4 w-4" />
              {user ? syncStatus : 'Local until sign-in'}
            </div>
          </div>

          {lastSavedId ? (
            <div className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--glass-soft)] p-4">
              <p className="text-sm font-black text-[var(--ink)]">After the recommendation</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => markCompleted(true)}
                  className="min-h-10 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-2 text-xs font-black text-[var(--ink)] hover:bg-[var(--glass-hover)]"
                >
                  I did it
                </button>
                <button
                  type="button"
                  onClick={() => markCompleted(false)}
                  className="min-h-10 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-2 text-xs font-black text-[var(--ink)] hover:bg-[var(--glass-hover)]"
                >
                  Skipped
                </button>
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Did your state shift?</p>
              <div className="grid grid-cols-3 gap-2">
                {(['better', 'same', 'worse'] as const).map((outcome) => (
                  <button
                    key={outcome}
                    type="button"
                    onClick={() => markOutcome(outcome)}
                    className="min-h-10 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-2 text-xs font-black capitalize text-[var(--ink)] hover:bg-[var(--glass-hover)]"
                  >
                    {outcome}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </Panel>

        <PracticeView result={result} />
      </div>
    </div>
  )
}

function HistoryPage() {
  const [entries, setEntries] = useState<CheckIn[]>(() => readState().entries)
  const practiceMap = useMemo(() => new Map(PRACTICES.map((practice) => [practice.id, practice])), [])
  const averageEnergy = entries.length
    ? (entries.reduce((sum, entry) => sum + entry.energy, 0) / entries.length).toFixed(1)
    : '0.0'

  useEffect(() => {
    const sync = () => setEntries(readState().entries)
    window.addEventListener('storage', sync)
    window.addEventListener('slowdown-state-change', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('slowdown-state-change', sync)
    }
  }, [])

  function clearHistory() {
    writeState({ entries: [] })
    setEntries([])
  }

  return (
    <div className="grid gap-5 pb-20 lg:pb-0">
      <header className="flex flex-wrap items-end justify-between gap-4 px-4 py-5 sm:px-0">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--accent-deep)]">History</p>
          <h1 className="display-font mt-2 text-4xl font-bold text-[var(--ink)]">What helps.</h1>
        </div>
        <Button onClick={clearHistory} variant="quiet" disabled={entries.length === 0}>
          Clear
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Panel>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">Check-ins</p>
          <p className="mt-2 text-3xl font-black text-[var(--ink)]">{entries.length}</p>
        </Panel>
        <Panel>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">Avg energy</p>
          <p className="mt-2 text-3xl font-black text-[var(--ink)]">{averageEnergy}</p>
        </Panel>
        <Panel>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">Most recent</p>
          <p className="mt-2 text-sm font-black text-[var(--ink)]">{entries[0] ? formatTime(entries[0].createdAt) : 'No entries yet'}</p>
        </Panel>
      </div>

      <TrendGraph entries={entries} />

      <div className="grid gap-3">
        {entries.length === 0 ? (
          <Panel>
            <p className="text-sm font-semibold text-[var(--muted)]">Your saved resets will appear here.</p>
          </Panel>
        ) : entries.map((entry) => {
          const practice = practiceMap.get(entry.practiceId)
          return (
            <article key={entry.id} className="rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-4 shadow-[var(--shadow-card)] backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[var(--ink)]">{formatTime(entry.createdAt)}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                    {entry.mood} mood · energy {entry.energy} · speed {entry.mentalSpeed} · tension {entry.tension}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--mint-soft)] px-3 py-1 text-xs font-black text-[var(--mint-deep)]">
                  {practice?.title ?? 'Practice'}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-black ${
                  entry.completed
                    ? 'bg-[var(--mint-soft)] text-[var(--mint-deep)]'
                    : entry.completed === false
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-deep)]'
                      : 'bg-[var(--paper)] text-[var(--muted)]'
                }`}>
                  {entry.completed ? 'Did it' : entry.completed === false ? 'Skipped' : 'Not marked'}
                </span>
                {entry.shifted ? (
                  <span className="rounded-full bg-[var(--sky-soft)] px-3 py-1 text-xs font-black capitalize text-[var(--sky-deep)]">
                    Felt {entry.shifted}
                  </span>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function AccountPage() {
  const { user, loading, isMockMode, signInWithGoogle, signOut } = useAuth()

  return (
    <div className="grid max-w-3xl gap-5 pb-20 lg:pb-0">
      <header className="px-4 py-5 sm:px-0">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--accent-deep)]">Account</p>
        <h1 className="display-font mt-2 text-4xl font-bold text-[var(--ink)]">Private first.</h1>
      </header>

      <Panel className="grid gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--sky-soft)] text-[var(--sky-deep)]">
            <HeartPulse className="h-6 w-6" strokeWidth={1.8} />
          </div>
          <div>
            <h2 className="text-lg font-black text-[var(--ink)]">Your mood data stays local by default.</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Sign in only if Firebase is configured and you want device sync. Recommendations are generated in the browser by small rule-based agents.
            </p>
          </div>
        </div>

        {isMockMode ? (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--cool-gradient)] p-4 text-sm font-semibold leading-6 text-[var(--ink)]">
            Cloud sign-in is not configured in this local build. The app is fully usable with local storage.
          </div>
        ) : loading ? (
          <div className="inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking account
          </div>
        ) : user ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--glass-soft)] p-4">
            <div>
              <p className="text-sm font-black text-[var(--ink)]">{user.displayName ?? user.email ?? 'Signed in'}</p>
              <p className="mt-1 text-xs font-semibold text-[var(--muted)]">Cloud sync available for saved resets.</p>
            </div>
            <Button onClick={() => void signOut()} variant="quiet">Sign out</Button>
          </div>
        ) : (
          <Button onClick={() => void signInWithGoogle()}>
            <Cloud className="h-4 w-4" />
            Sign in for sync
          </Button>
        )}
      </Panel>

      <Panel>
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-deep)]" />
          <p className="text-sm leading-6 text-[var(--muted)]">
            Slowdown is a wellbeing tool, not a medical device or crisis service. If you are in immediate danger, contact emergency services or a trusted local crisis line.
          </p>
        </div>
      </Panel>
    </div>
  )
}

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<ResetPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/account" element={<AccountPage />} />
      </Routes>
    </Shell>
  )
}
