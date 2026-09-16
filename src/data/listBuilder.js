// Post-criteria flow — canned directory, columns, and print copy.
// Shape is what the UI renders; it never computes a band or an affordability verdict.

export const PRIORITY_LABELS = [
  'Affordability',
  'Academic programme strength',
  'Closeness to home',
  'Admissions realism',
  'Campus environment and fit',
  'Student support services',
]

export const DEFAULT_SETTINGS = {
  order: [...PRIORITY_LABELS],
  homeState: '',
  incomeBand: '$75,001 – $110,000',
  maxOop: '$25,000',
}

export const BUILD_STAGES = [
  { label: 'Read the college directory', target: 2412, keep: 256, note: 'every four-year school with a computer science major' },
  { label: 'Matched the required criteria', target: 340, keep: 36, note: 'computer science, scores in range, within ~300 miles' },
  { label: 'Checked affordability', target: 24, keep: 3, note: 'estimated under the out-of-pocket cap you set' },
  { label: 'Balanced likely, target, and reach', target: 8, keep: 1, note: 'kept for your review' },
]

export const SCHOOLS = [
  { id: 'wcu', name: 'West Chester University of Pennsylvania', meta: 'West Chester, PA · public', band: 'Likely', residency: 'In-state', inState: 9024, outState: 22648, oop: 14900, distance: 'About a 2-hour drive', rate: '82%', midSat: 'Mid-50% SAT 1050–1220', rationale: 'In-state public, computer science, inside the distance you set.' },
  { id: 'tem', name: 'Temple University', meta: 'Philadelphia, PA · public', band: 'Likely', residency: 'In-state', inState: 20080, outState: 35630, oop: 21500, distance: 'About a 2-hour drive', rate: '69%', midSat: 'Mid-50% SAT 1080–1280', rationale: 'In-state public with a co-op heavy CS track.' },
  { id: 'mil', name: 'Millersville University', meta: 'Millersville, PA · public', band: 'Likely', residency: 'In-state', inState: 12530, outState: 24290, oop: 13800, distance: 'About a 1-hour drive', rate: '85%', midSat: 'Mid-50% SAT 990–1160', rationale: 'Closest school on the list, and the cheapest.' },
  { id: 'rut', name: 'Rutgers University–New Brunswick', meta: 'New Brunswick, NJ · public', band: 'Target', residency: 'Out-of-state', inState: 17100, outState: 34550, oop: 32400, distance: 'About a 2-hour drive', rate: '66%', midSat: 'Mid-50% SAT 1200–1420', rationale: 'Out-of-state tuition — check aid before you send this.' },
  { id: 'pit', name: 'University of Pittsburgh', meta: 'Pittsburgh, PA · public', band: 'Reach', residency: 'In-state', inState: 21000, outState: 38000, oop: 26800, distance: 'About a 4-hour drive', rate: '49%', midSat: 'Mid-50% SAT 1230–1420', rationale: 'Scores sit at the bottom of the band; strong CS.' },
  { id: 'psu', name: 'Penn State University Park', meta: 'University Park, PA · public', band: 'Target', residency: 'In-state', inState: 20660, outState: 40000, oop: 27900, distance: 'About a 3-hour drive', rate: '55%', midSat: 'Mid-50% SAT 1180–1360', rationale: 'In-state, but sticker price runs above your cap.' },
  { id: 'leh', name: 'Lehigh University', meta: 'Bethlehem, PA · private', band: 'Reach', residency: 'Private', inState: 62180, outState: 62180, oop: 24200, distance: 'About a 2-hour drive', rate: '34%', midSat: 'Mid-50% SAT 1290–1460', rationale: 'Private, close to home, generous with need-based aid.' },
  { id: 'cmu', name: 'Carnegie Mellon University', meta: 'Pittsburgh, PA · private', band: 'Reach', residency: 'Private', inState: 65000, outState: 65000, oop: 38500, distance: 'About a 4-hour drive', rate: '11%', midSat: 'Mid-50% SAT 1460–1560', rationale: 'A long reach, kept because CS is the whole point.' },
]

export const COLUMN_LIBRARY = [
  {
    id: 'freeze',
    label: 'Tuition freeze',
    prompt: 'Four-year tuition freeze policy',
    values: {
      wcu: 'Guaranteed flat rate for 4 years',
      tem: 'Fixed-tuition plan, opt in at entry',
      mil: 'Guaranteed flat rate for 4 years',
      rut: 'No freeze — annual increases ~2-4%',
      pit: 'Guaranteed rate for 4 years',
      psu: 'No freeze — set yearly by trustees',
      leh: 'No freeze — aid rescaled each year',
      cmu: 'No freeze — annual increases ~4%',
    },
  },
  {
    id: 'coop',
    label: 'Co-op / internship',
    prompt: 'Required co-op or internship in CS',
    values: {
      wcu: 'Internship required for the major',
      tem: 'Optional paid co-op, 1-3 terms',
      mil: 'Capstone with industry partner',
      rut: 'Optional, strong recruiting pipeline',
      pit: 'Optional co-op, 1 or 2 terms',
      psu: 'Optional, large career fair pipeline',
      leh: 'Optional, high placement rate',
      cmu: 'Optional, summer internships typical',
    },
  },
  {
    id: 'merit',
    label: 'Merit aid at 1230',
    prompt: 'Merit scholarships available at a 1230 SAT',
    values: {
      wcu: 'Up to $4,000/yr, automatic',
      tem: 'Up to $8,000/yr, automatic',
      mil: 'Up to $5,500/yr, automatic',
      rut: 'Limited, competitive only',
      pit: 'Competitive, by application',
      psu: 'Small awards, campus-dependent',
      leh: 'Need-based only',
      cmu: 'Need-based only',
    },
  },
  {
    id: 'major',
    label: 'Direct CS admit',
    prompt: 'Is CS a direct admit or a secondary application?',
    values: {
      wcu: 'Direct admit to the major',
      tem: 'Direct admit to the major',
      mil: 'Direct admit to the major',
      rut: 'Direct admit, school of arts & sciences',
      pit: 'Secondary application after year 1',
      psu: 'Entrance-to-major GPA gate',
      leh: 'Direct admit to the major',
      cmu: 'Direct admit, separate CS application',
    },
  },
]

export const STUDENT_COLUMNS = [
  {
    id: 'life',
    label: 'Campus life',
    values: {
      wcu: 'Suburban campus, 60% live on campus first year, big weekend scene in town',
      tem: 'Urban campus in North Philly, most students commute after year one',
      mil: 'Small-town campus, tight-knit, quiet weekends',
      rut: 'Large campus spread over 5 sub-campuses, bus system between them',
      pit: 'Urban campus in Oakland, blends into the city, strong sports culture',
      psu: 'Classic college town, football weekends define the calendar',
      leh: 'Hillside campus, Greek life is a large part of social life',
      cmu: 'Compact urban campus, studio and lab culture, intense workload',
    },
  },
  {
    id: 'clubs',
    label: 'Clubs worth a look',
    values: {
      wcu: 'Competitive programming club, robotics, App Dev Club',
      tem: 'Hackathon team (OwlHacks), Game Dev, ACM chapter',
      mil: 'Cybersecurity team, Maker Space, ACM chapter',
      rut: 'HackRU, USACS, Formula SAE electric team',
      pit: 'SteelHacks, Panther Robotics, Game Making Club',
      psu: 'HackPSU, Nittany AI Alliance, Robotics Club',
      leh: 'HackLehigh, Formula SAE, Entrepreneurship incubator',
      cmu: 'ScottyLabs, Roboclub, Game Creation Society',
    },
  },
  {
    id: 'rank',
    label: 'CS ranking',
    values: {
      wcu: 'Regional top 30 (North, public)',
      tem: 'National top 125 overall',
      mil: 'Regional top 40 (North, public)',
      rut: 'National top 40 in CS',
      pit: 'National top 60 in CS',
      psu: 'National top 30 in CS',
      leh: 'National top 50 overall',
      cmu: 'National top 1 in CS',
    },
  },
  {
    id: 'jobs',
    label: 'CS grads employed',
    values: {
      wcu: '88% within 6 months · median $72k',
      tem: '91% within 6 months · median $78k',
      mil: '86% within 6 months · median $68k',
      rut: '93% within 6 months · median $88k',
      pit: '92% within 6 months · median $85k',
      psu: '94% within 6 months · median $92k',
      leh: '95% within 6 months · median $96k',
      cmu: '98% within 6 months · median $135k',
    },
  },
]

export const DEADLINES = {
  wcu: { ea: 'Rolling from Aug 1', rd: 'Priority Feb 15', aid: 'FAFSA by Feb 15' },
  tem: { ea: 'Early action Nov 1', rd: 'Regular Feb 1', aid: 'FAFSA by Mar 1' },
  mil: { ea: 'Rolling from Aug 15', rd: 'Priority Apr 1', aid: 'FAFSA by Mar 1' },
  rut: { ea: 'Early action Nov 1', rd: 'Regular Dec 1', aid: 'FAFSA by Feb 1' },
  pit: { ea: 'Early action Nov 1', rd: 'Rolling to Apr 1', aid: 'FAFSA by Feb 15' },
  psu: { ea: 'Early action Nov 1', rd: 'Regular Jan 15', aid: 'FAFSA by Feb 15' },
  leh: { ea: 'Early decision Nov 1', rd: 'Regular Jan 1', aid: 'CSS Profile by Jan 1' },
  cmu: { ea: 'Early decision Nov 1', rd: 'Regular Jan 3', aid: 'CSS Profile by Jan 3' },
}

export const VISIT_QUESTIONS = [
  'Who teaches the intro CS courses — faculty or graduate students?',
  'How do students find their first internship, and when?',
  'What happens to my aid package if family income changes?',
  'Can I see a first-year student’s weekly schedule?',
]

export const ADVISING = {
  wcu: {
    stats: ['Admit rate 82% · in-state 85%', 'Yield 21% · 1,410 enrolled from 8,900 admits', 'CS major: no secondary application', '1230 sits above the 75th percentile (1220)'],
    gap: 'None on scores. GPA 3.5 is at the median, so nothing here needs shoring up.',
    advise: 'Frame this as the anchor. If the family wants certainty by December, apply here first — rolling admission returns a decision in 2-3 weeks.',
    improve: 'Nothing academic. Push on the essay only if he wants the honors college, which needs a 3.6.',
  },
  tem: {
    stats: ['Admit rate 69% · in-state 72%', 'Yield 19% · CS admits average 1240', 'Fixed-tuition plan must be elected at deposit', '1230 sits at the 62nd percentile'],
    gap: 'Scores are mid-range. Nothing disqualifying, but no merit cushion either.',
    advise: 'Apply early action — Temple releases merit with the admit letter, and the $8,000 automatic award at 1230 is the difference between this and Millersville on cost.',
    improve: 'A 1270 would move him into the next automatic merit tier. One retake in October is worth it.',
  },
  mil: {
    stats: ['Admit rate 85% · in-state 88%', 'Yield 24% · smallest CS cohort on the list', 'Guaranteed flat tuition for 4 years', '1230 sits above the 90th percentile (1160)'],
    gap: 'None. He is well above the band.',
    advise: 'Use this as the cost floor in the conversation with the family. Also the strongest automatic-merit case relative to his scores.',
    improve: 'Nothing. He is a merit candidate here, not an admissions question.',
  },
  rut: {
    stats: ['Admit rate 66% · out-of-state 61%', 'Yield 28% · CS is the largest major', 'No tuition freeze — budget 2-4% annual increases', '1230 sits at the 22nd percentile (1200–1420)'],
    gap: 'Scores are in the bottom quarter of the admitted band, and he pays out-of-state tuition.',
    advise: 'Be direct with the family: this is the weakest value on the list. Keep it only if he visits and prefers it to Temple.',
    improve: 'A 1300 plus a strong senior-year math grade would make this a genuine target rather than a coin flip.',
  },
  pit: {
    stats: ['Admit rate 49% · in-state 54%', 'Yield 22% · CS is a secondary application after year 1', 'Rolling — decisions come faster if he applies by Oct', '1230 sits at the 25th percentile (1230–1420)'],
    gap: 'He is at the floor of the band, and CS is not a direct admit — a second gate after freshman year.',
    advise: 'Explain the two-step admission clearly. Students who assume CS is guaranteed here are the ones who transfer out.',
    improve: 'Raise the SAT to 1300 and keep calculus at an A. The internal CS GPA cutoff is the real hurdle, so first-semester study habits matter more than the application.',
  },
  psu: {
    stats: ['Admit rate 55% · University Park is the most selective campus', 'Yield 25% · entrance-to-major GPA gate for CS', 'Sticker above the family cap — aid is need-based only', '1230 sits at the 30th percentile (1180–1360)'],
    gap: 'Cost is the real gap, not scores: about $2,900 a year over the cap even after aid.',
    advise: 'Offer the branch-campus route — two years at a commonwealth campus then the 2+2 transfer to University Park cuts roughly $20,000 with the same degree.',
    improve: 'A 1290 would put him mid-band. The bigger lever is the aid appeal once the package arrives.',
  },
  leh: {
    stats: ['Admit rate 34% · 48% for early decision', 'Yield 27% · meets 100% of demonstrated need', 'CSS Profile required — more paperwork than FAFSA alone', '1230 sits below the 25th percentile (1290–1460)'],
    gap: 'Scores are below the band. The Congressional App Challenge win is what makes the file readable.',
    advise: 'Worth applying because the aid is genuinely generous, but only with the app-challenge work front and centre. Do not let the family read "private" as "unaffordable" before the package arrives.',
    improve: 'Lead the application with the state-winning project — a portfolio link and a recommendation from the CS teacher do more here than 40 SAT points.',
  },
  cmu: {
    stats: ['Admit rate 11% · School of Computer Science admits ~7%', 'Yield 50% · nearly every admit enrolls', 'No merit aid — need-based only, CSS Profile required', '1230 is far below the band (1460–1560)'],
    gap: 'Scores are roughly 230 points below the 25th percentile, and CS is the most selective unit on campus.',
    advise: 'Keep it as the one long shot, but say plainly that this is unlikely and should not carry any of the family’s planning. The cost is also the highest on the list even after aid.',
    improve: 'Realistically out of reach for fall admission. A stronger version of this ambition is a strong CS record at Pitt or Temple, then a graduate application here.',
  },
}

export const BAND_INK = {
  Likely: 'var(--ink)',
  Target: 'var(--band-target)',
  Reach: 'var(--band-reach)',
}

export const money = (n) => `$${Number(n).toLocaleString()}`
export const parseCap = (s) => Number(String(s).replace(/[^0-9]/g, '')) || 25000
