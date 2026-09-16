// Lucide only, three sizes. Pair sm with caption/body-sm, md with body, lg with subtitle+.
// Admissions bands, evidence dots, and confidence dots stay custom — they are labels, not chrome.

const SIZE_CLASS = {
  sm: 'h-icon-sm w-icon-sm',
  md: 'h-icon-md w-icon-md',
  lg: 'h-icon-lg w-icon-lg',
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
