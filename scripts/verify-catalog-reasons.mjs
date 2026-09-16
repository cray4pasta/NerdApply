import assert from 'node:assert/strict'
import {
  EMPTY_CATALOG_ERROR,
  catalogFromNoRequiredMajor,
  catalogFromUnavailable,
  catalogFromScorecardBody,
  scorecardResponseShape,
} from '../src/lib/catalog.js'

const snapshot = [{ id: 'demo-u' }]

assert.deepEqual(catalogFromNoRequiredMajor(snapshot), {
  schools: snapshot,
  source: 'snapshot',
  reason: 'no_required_major',
  vintage: null,
  error: null,
})

assert.deepEqual(catalogFromUnavailable(snapshot), {
  schools: snapshot,
  source: 'snapshot',
  reason: 'unavailable',
  vintage: null,
  error: null,
})

assert.deepEqual(catalogFromScorecardBody({ schools: [{ id: 'live-u' }], vintage: '2026-09-15' }), {
  schools: [{ id: 'live-u' }],
  source: 'live',
  reason: 'ok',
  vintage: '2026-09-15',
  error: null,
})

assert.deepEqual(catalogFromScorecardBody({ schools: [], vintage: '2026-09-15' }), {
  schools: [],
  source: 'live',
  reason: 'empty',
  vintage: '2026-09-15',
  error: EMPTY_CATALOG_ERROR,
})

assert.equal(catalogFromScorecardBody({ schools: 'not-an-array' }), null)
assert.equal(catalogFromScorecardBody({}), null)
assert.equal(catalogFromScorecardBody(null), null)

assert.match(scorecardResponseShape({ foo: 1, schools: 'string' }), /schools: string/)
assert.equal(scorecardResponseShape(null), 'null')

console.log('verify-catalog-reasons ok')
