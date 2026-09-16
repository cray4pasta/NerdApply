import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
assert.match(
  appSource,
  /generate recover used local snapshot[\s\S]*catalogSource: 'snapshot',[\s\S]*catalogNote: 'College data is the local snapshot\. Scorecard was unavailable\.'/,
  'expected stuck generation recovery to replace prior live catalog provenance'
)

const familyDocumentSource = readFileSync(
  new URL('../src/components/FamilyDocument.jsx', import.meta.url),
  'utf8'
)
assert.match(
  familyDocumentSource,
  /school\.size == null \? 'enrollment unknown'/,
  'expected printed enrollment to handle missing size'
)

console.log('verify-catalog-reasons ok')
