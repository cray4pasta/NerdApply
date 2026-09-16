// Highlights are the student's intended program, plus named undergraduate courses
// copied from published catalogs — never the school's unrelated tag list.
import { PROGRAM_CHOICES } from './extract.js'

const PROGRAM_LABEL = Object.fromEntries(PROGRAM_CHOICES.map((p) => [p.value, p.label]))

export function highlightCourses(school, criteria) {
  const interests = (criteria ?? []).filter(
    (c) => c.category === 'academic_interest' && typeof c.value === 'string' && c.value
  )
  const tagged = new Set(school.programs ?? [])

  if (interests.length === 0) {
    return (school.programs ?? []).map((value) => ({
      key: value,
      label: school.program_names?.[value] ?? PROGRAM_LABEL[value] ?? value.replaceAll('_', ' '),
      courses: school.courses?.[value]?.slice(0, 4) ?? [],
      kind: 'catalog',
      awards: school.program_awards?.[value] ?? null,
    }))
  }

  return interests.flatMap((c) => {
    const offered = tagged.has(c.value)
    if (!offered) {
      if (school.source === 'College Scorecard (live)') return []
      return [{
        key: c.id ?? c.value,
        label: `${c.label} is not in this snapshot`,
        courses: [],
        kind: 'missing',
        awards: null,
      }]
    }

    const programName = school.program_names?.[c.value] ?? PROGRAM_LABEL[c.value] ?? c.label
    const named = school.courses?.[c.value]

    return [{
      key: c.id ?? c.value,
      label: programName,
      courses: Array.isArray(named) ? named.slice(0, 4) : [],
      kind: 'matched',
      awards: school.program_awards?.[c.value] ?? null,
    }]
  })
}
