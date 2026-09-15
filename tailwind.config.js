/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        surface: 'var(--surface)',
        ink: {
          DEFAULT: 'var(--ink)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)'
        },
        rule: 'var(--rule)',
        brand: {
          DEFAULT: 'var(--brand)',
          hover: 'var(--brand-hover)',
          tint: 'var(--brand-tint)'
        },
        flag: {
          DEFAULT: 'var(--flag)',
          bg: 'var(--flag-bg)'
        }
      },
      borderRadius: {
        control: 'var(--r-control)',
        card: 'var(--r-card)'
      },
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        5: 'var(--space-5)',
        6: 'var(--space-6)',
        8: 'var(--space-8)',
        10: 'var(--space-10)',
        12: 'var(--space-12)'
      },
      fontFamily: {
        display: ['Libre Baskerville', 'Georgia', 'serif'],
        sans: ['Albert Sans', 'system-ui', 'sans-serif']
      },
      fontSize: {
        12: 'var(--text-12)',
        14: 'var(--text-14)',
        15: 'var(--text-15)',
        16: 'var(--text-16)',
        18: 'var(--text-18)',
        22: 'var(--text-22)',
        28: 'var(--text-28)',
        40: 'var(--text-40)'
      }
    }
  },
  plugins: []
}
