export function assertList(list) {
  for (const s of list) {
    if (s.admissions.band === 'Likely' && s.admit_rate != null && s.admit_rate < 0.2) {
      throw new Error(`G3 violated: ${s.name} labelled Likely at ${s.admit_rate} admit rate`)
    }
    if (s.affordability.band !== 'Unknown' && s.affordability.net == null) {
      throw new Error(`G4 violated: ${s.name} has an affordability label with no net price`)
    }
  }
  return list
}
