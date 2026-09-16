// Visible work the counselor can watch. Copy is honest: the model reads notes and writes
// sentences; engine.js still picks every school (files/02-ENGINEERING.md section 2).

export const EXTRACT_STEPS = [
  'Reading the student profile',
  'Finding interests, geography, and constraints',
  'Preparing the criteria for you to review',
]

export const BUILD_STEPS = [
  'Reading the confirmed criteria',
  'Looking up colleges that offer this program',
  'Building the list according to your ranking',
  'Writing a sentence for each school',
]

export const STEP_MS = 700
export const LLM_MS = 4000
export const SCORECARD_MS = 12000

export function wait(ms) {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return Promise.resolve()
  }
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchWithTimeout(url, options = {}, ms = LLM_MS) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await Promise.race([
      fetch(url, { ...options, signal: ctrl.signal }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('llm timed out')), ms)
      }),
    ])
  } finally {
    clearTimeout(timer)
    try {
      ctrl.abort()
    } catch (err) {
      console.warn('[progress] abort failed', err)
    }
  }
}

export async function holdForSteps(startedAt, stepCount) {
  const remain = STEP_MS * stepCount - (Date.now() - startedAt)
  if (remain > 0) await wait(remain)
}
