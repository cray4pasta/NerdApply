import { useEffect, useMemo, useRef, useState } from 'react'
import { BUILD_STAGES } from '../data/listBuilder.js'

const DOTS = 256
const PER_STAGE = 6

function tokenDurationMs(name, fallback) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n)) return fallback
  if (raw.endsWith('ms')) return n
  if (raw.endsWith('s')) return n * 1000
  return n
}

export default function BuildProgress({ onDone, stages }) {
  const list = stages?.length ? stages : BUILD_STAGES
  const [tick, setTick] = useState(0)
  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  const ranks = useMemo(() => {
    let seed = 7
    return Array.from({ length: DOTS }, () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    })
  }, [])

  useEffect(() => {
    const total = list.length * PER_STAGE
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTick(total)
      if (!doneRef.current) {
        doneRef.current = true
        onDoneRef.current?.()
      }
      return undefined
    }
    const wait = tokenDurationMs('--duration-build-tick', 150)
    const hold = tokenDurationMs('--duration-build-loop', 5000)
    const startedAt = Date.now()
    const id = setInterval(() => {
      if (Date.now() - startedAt >= hold) {
        setTick(total)
        if (!doneRef.current) {
          doneRef.current = true
          onDoneRef.current?.()
        }
        clearInterval(id)
        return
      }
      setTick((t) => (t >= total ? 0 : t + 1))
    }, wait)
    return () => clearInterval(id)
  }, [list.length])

  const idx = Math.min(list.length - 1, Math.floor(tick / PER_STAGE))
  const stage = list[idx]
  const local = Math.max(0, Math.min(PER_STAGE, tick - idx * PER_STAGE))
  const progress = local / PER_STAGE

  const prevKeep = idx === 0 ? DOTS : list[idx - 1].keep
  const cutoff = (prevKeep + (stage.keep - prevKeep) * progress) / DOTS

  const prevTarget = idx === 0 ? 0 : list[idx - 1].target
  const count = Math.round(prevTarget + (stage.target - prevTarget) * progress)

  const isFinal = idx === list.length - 1 && progress === 1

  return (
    <article className="mb-8">
      <p className="text-12 font-medium uppercase tracking-label text-ink-3">List builder</p>
      <p className="mt-2 text-15 leading-relaxed text-ink-2">
        Building the list. Each dot is a school in the directory — code does the deciding, not the model.
      </p>

      <div className="mt-4 rounded-lg border border-rule bg-surface p-6">
        <div className="grid grid-cols-32 gap-dot">
          {ranks.map((r, i) => {
            const on = r < cutoff
            return (
              <span
                key={i}
                className="build-dot block"
                style={{
                  backgroundColor: on ? (isFinal ? 'var(--ink)' : 'var(--ink-2)') : 'var(--rail)',
                  transform: on ? 'scale(1)' : 'scale(var(--dot-scale-off))',
                }}
              />
            )
          })}
        </div>

        <div className="mt-6 flex items-baseline justify-between gap-4">
          <span className="text-15 text-ink">{stage.label}</span>
          <span className="text-24 tabular-nums text-ink">{count.toLocaleString()}</span>
        </div>
        <p className="mt-2 text-12 text-ink-3">{stage.note}</p>
      </div>
    </article>
  )
}
