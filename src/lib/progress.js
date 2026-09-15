// Shared fetch helper used by extraction. Aborts if the model takes too long.
export async function fetchWithTimeout(url, options = {}, ms = 10000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...options, signal: options.signal ?? ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}
