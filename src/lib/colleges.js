// Adapter boundary. Every screen imports getColleges() — nothing else reads the snapshot.
import { colleges } from '../data/colleges.js'

export function getColleges() {
  return colleges.map((c) => ({ ...c }))
}
