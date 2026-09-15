import { extractFallback } from '../src/lib/extract.js'
import { buildList } from '../src/lib/engine.js'
import { getColleges } from '../src/lib/colleges.js'
import { SAMPLE_A, SAMPLE_LAW } from '../src/lib/samples.js'

const order = ['affordability', 'program', 'proximity', 'admissions_realism', 'environment', 'support']

function run(label, notes) {
  const extraction = extractFallback(notes)
  const list = buildList({
    schools: getColleges(),
    criteria: extraction.criteria,
    income_band: '75001-110000',
    max_out_of_pocket: 25000,
    home_state: extraction.home_state,
    academic: extraction.academic,
    priorityOrder: order,
  })
  console.log(
    label,
    list.length,
    list.map((s) => `${s.name} [${s.admissions.band}/${s.affordability.band}]`)
  )
  if (!list.length) throw new Error(`${label} produced an empty list`)
}

run('A', SAMPLE_A.notes)
run('law', SAMPLE_LAW.notes)
console.log('ok-list')
