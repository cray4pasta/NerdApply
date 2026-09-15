import { SAMPLE_A, SAMPLE_B, SAMPLE_LAW, SAMPLE_SHORT } from '../lib/samples.js'

export default function NotesStep({ notes, setNotes, onSubmit, busy }) {
  return (
    <div className="mx-auto max-w-notes">
      <h1 className="font-display text-28 text-ink">Student notes</h1>
      <p className="mt-2 font-sans text-15 text-ink-2">
        Paste what you know. I will extract criteria for you to confirm before any school is chosen.
      </p>
      <textarea
        className="mt-6 min-h-[12rem] w-full rounded-card border border-rule bg-surface p-4 font-display text-16 leading-relaxed text-ink focus:border-brand focus:outline-none"
        value={notes}
        disabled={busy}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="SAT, home state, interests, how far from home, what money can look like…"
      />
      <div className="mt-4 flex flex-wrap gap-3">
        {[SAMPLE_A, SAMPLE_B, SAMPLE_SHORT, SAMPLE_LAW].map((sample) => (
          <button
            key={sample.label}
            type="button"
            className="rounded-control border border-rule bg-surface px-3 py-2 font-sans text-14 text-ink hover:border-brand"
            disabled={busy}
            onClick={() => setNotes(sample.notes)}
          >
            {sample.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="mt-6 rounded-control bg-brand px-5 py-3 font-sans text-15 font-medium text-surface hover:bg-brand-hover disabled:opacity-50"
        disabled={busy || !notes.trim()}
        onClick={onSubmit}
      >
        {busy ? 'Reading the notes…' : 'Build the list'}
      </button>
    </div>
  )
}
