// Lucide only. Pair sm with caption/body-sm, md with body, lg with subtitle+.
// pencil is the 13px criteria-header exception from the notes-entry design.
// Admissions bands, evidence dots, and confidence dots stay custom — they are labels, not chrome.

const SIZE_CLASS = {
  xs: 'h-icon-xs w-icon-xs',
  compact: 'h-icon-compact w-icon-compact',
  sm: 'h-icon-sm w-icon-sm',
  md: 'h-icon-md w-icon-md',
  lg: 'h-icon-lg w-icon-lg',
  pencil: 'h-pencil w-pencil',
}

export default function Icon({ icon: Svg, size = 'sm', className = '', ...props }) {
  return (
    <Svg
      aria-hidden="true"
      className={`${SIZE_CLASS[size] ?? SIZE_CLASS.sm} shrink-0 ${className}`.trim()}
      style={{ strokeWidth: 'var(--icon-stroke)' }}
      {...props}
    />
  )
}
