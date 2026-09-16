export const CIP_BY_SLUG = {
  design: ['5004'],
  art: ['5007', '5001'],
  performing_arts: ['5005', '5006', '5010'],
  computer_science: ['1107'],
  nursing: ['5138'],
  engineering: ['1401', '1408', '1409', '1410', '1419'],
  biology: ['2601'],
  marine_biology: ['2613'],
  business: ['5202', '5201'],
  education: ['1301'],
  environmental_science: ['0301'],
  agriculture: ['0100'],
  law: ['2200', '4504'],
  political_science: ['4510', '4509'],
}

const SLUG_BY_CIP = Object.fromEntries(
  Object.entries(CIP_BY_SLUG).flatMap(([slug, codes]) => codes.map((code) => [code, slug]))
)

export function cipsForSlugs(slugs) {
  return [...new Set((slugs ?? []).flatMap((slug) => CIP_BY_SLUG[slug] ?? []))]
}

export function slugForCip(code) {
  if (code == null) return null
  const digits = String(code).replace(/\D/g, '').padStart(4, '0').slice(-4)
  return SLUG_BY_CIP[digits] ?? null
}

export function requiredProgramSlugs(criteria) {
  return (criteria ?? [])
    .filter(
      (c) =>
        c.category === 'academic_interest' &&
        c.strength === 'required' &&
        typeof c.value === 'string' &&
        CIP_BY_SLUG[c.value]
    )
    .map((c) => c.value)
}
