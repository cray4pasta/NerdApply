import { basisText } from '../lib/listRows.js'

export default function BasisCard({
  rows,
  priorities,
  homeState,
  incomeBand,
  maxOop,
  programLabel,
  academic,
  onRebuild,
}) {
  const count = (band) => rows.filter((s) => s.band === band).length
  const summary = basisText({ programLabel, academic, homeState, maxOop, rows, priorities })
  const reachHeavy = count('Reach') > count('Likely')

  const balanceNote =
    rows.length === 0
      ? 'Nothing left on the list. Rebuild to start again.'
      : reachHeavy
        ? 'More reaches than likelies. Consider putting one back before you print.'
        : 'No balance concerns on this list.'

  return (
    <div className="card-in rounded-lg border border-rule bg-surface p-6">
      <p className="text-12 font-medium uppercase tracking-label text-ink-3">What put these schools on the list</p>

      <p className="mt-dock text-15 leading-relaxed text-ink">{summary.lead}</p>

      <div className="mt-4 flex flex-col gap-dock">
        {summary.items.map((b) => (
          <div key={b.kind} className="flex items-baseline gap-4 border-t border-rule pt-dock">
            <span className="w-basis-kind flex-shrink-0 text-12 font-medium uppercase tracking-label text-ink-3">{b.kind}</span>
            <span className="flex-1 text-14 leading-normal text-ink-2">{b.text}</span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-12 leading-normal text-ink-3">
        Admissions bands come from published mid-50% score ranges. Out-of-pocket figures are estimates from the {incomeBand}{' '}
        band, not a filed FAFSA. Figures on this sheet are plausible for the demo — confirm them before a family meeting.
      </p>

      <div className="mt-4 flex items-center justify-between gap-4">
        <span className="text-14 text-ink-2">{balanceNote}</span>
        <button type="button" onClick={onRebuild} className="rounded-lg border border-rule px-4 py-2 text-14 text-ink-2">
          Rebuild
        </button>
      </div>
    </div>
  )
}
