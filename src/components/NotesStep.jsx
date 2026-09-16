// Screen 1 — Notes. See docs/03-DESIGN.md 4.1: single column, the emptiness is the point.
import { useState } from 'react'
import { SAMPLE_A, SAMPLE_B, SAMPLE_SHORT } from '../lib/samples.js'

export default function NotesStep({ notes, setNotes, onSubmit }) {
  const [loading, setLoading] = useState(false)

  async function handleBuild(text) {
    if (!text.trim()) return
    setLoading(true)
    await onSubmit(text)
    setLoading(false)
  }

  return (
    <div className="mx-auto max-w-notes px-6 py-12">
      <h1 className="font-display text-28 text-ink">Tell me about the student</h1>
      <p className="mt-2 text-15 text-ink-2">
        Paste what you know — grades, interests, what they're looking for. Nothing is saved.
      </p>

      <textarea
        className="mt-6 w-full rounded-card border border-rule bg-surface p-4 font-display text-16 leading-relaxed text-ink focus:border-brand focus:outline-none"
        rows={12}
        placeholder="John is a junior who loves programming and..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-control border border-rule px-4 py-2 text-14 text-ink-2 hover:border-ink-3 hover:text-ink"
          onClick={() => {
            setNotes(SAMPLE_A.notes)
            handleBuild(SAMPLE_A.notes)
          }}
        >
          {SAMPLE_A.label}
        </button>
        <button
          type="button"
          className="rounded-control border border-rule px-4 py-2 text-14 text-ink-2 hover:border-ink-3 hover:text-ink"
          onClick={() => {
            setNotes(SAMPLE_B.notes)
            handleBuild(SAMPLE_B.notes)
          }}
        >
          {SAMPLE_B.label}
        </button>
        <button
          type="button"
          className="rounded-control border border-rule px-4 py-2 text-14 text-ink-2 hover:border-ink-3 hover:text-ink"
          onClick={() => {
            setNotes(SAMPLE_SHORT.notes)
            handleBuild(SAMPLE_SHORT.notes)
          }}
        >
          {SAMPLE_SHORT.label}
        </button>
      </div>

      <div className="mt-8">
        <button
          type="button"
          disabled={!notes.trim() || loading}
          className="rounded-control bg-brand px-5 py-3 text-15 font-medium text-surface hover:bg-brand-hover disabled:opacity-40"
          onClick={() => handleBuild(notes)}
        >
          {loading ? 'Reading notes…' : 'Build the list'}
        </button>
      </div>
    </div>
  )
}
