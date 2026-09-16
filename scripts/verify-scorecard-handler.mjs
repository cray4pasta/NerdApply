import assert from 'node:assert/strict'
import handler from '../api/scorecard.js'

const sampleRow = {
  id: 166027,
  'school.name': 'Harvard University',
  'latest.programs.cip_4_digit.code': '5004',
}

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
  }
  return res
}

process.env.SCORECARD_API_KEY = 'test-key'

let fetchCalls = 0
const originalNow = Date.now
let now = originalNow()
Date.now = () => now

globalThis.fetch = async () => {
  fetchCalls += 1
  if (fetchCalls === 1) {
    return {
      ok: true,
      json: async () => {
        now += 9000
        return {
          results: [sampleRow],
          metadata: { page: 0, per_page: 100, total: 500 },
        }
      },
    }
  }
  throw new Error('fetch should stop after deadline expiry')
}

const originalError = console.error
const errorLogs = []
console.error = (...args) => {
  errorLogs.push(args)
}

try {
  const res = mockRes()
  await handler({ method: 'POST', body: { programs: ['design'] } }, res)
  assert.equal(res.statusCode, 502)
  assert.deepEqual(res.body, { error: 'upstream_failed' })
  assert.equal(fetchCalls, 1, 'expected no fetch after deadline expiry')
  assert.ok(
    errorLogs.some((args) => String(args[1]).includes('catalog completed')),
    'expected deadline expiry log before 502'
  )
  console.log('verify-scorecard-handler ok')
} finally {
  Date.now = originalNow
  console.error = originalError
  delete process.env.SCORECARD_API_KEY
  delete globalThis.fetch
}
