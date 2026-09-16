// The adapter boundary. Every other file imports getColleges() — nothing else touches the
// JSON directly. To go live, change the inside of this one function.
// See docs/02-ENGINEERING.md section 5.4.
import data from '../data/colleges.json'
import tags from '../data/program-tags.json'

export function getColleges() {
  return data.map((c) => ({ ...c, ...(tags[c.id] ?? { programs: [], tags: [] }) }))
}
