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
        none: '0px',
        DEFAULT: 'var(--r-control)',
        sm: 'var(--r-control)',
        md: 'var(--r-control)',
        lg: 'var(--r-card)',
        xl: 'var(--r-composer)',
        '2xl': 'var(--r-composer)',
        full: 'var(--r-control)',
        control: 'var(--r-control)',
        card: 'var(--r-card)',
        composer: 'var(--r-composer)'
      },
      borderWidth: {
        DEFAULT: 'var(--bw-hairline)',
        8: 'var(--bw)'
      },
      maxWidth: {
        notes: 'var(--width-notes)',
        priorities: 'var(--width-priorities)',
        wide: 'var(--width-wide)',
        print: 'var(--width-print)',
        chat: 'var(--width-chat)',
        list: 'var(--width-list)',
        'notes-entry': 'var(--width-notes-entry)'
      },
      width: {
        history: 'var(--width-history)',
        'icon-sm': 'var(--icon-sm)',
        'icon-md': 'var(--icon-md)',
        'icon-lg': 'var(--icon-lg)',
        'notes-entry': 'var(--width-notes-entry)'
      },
      height: {
        'icon-sm': 'var(--icon-sm)',
        'icon-md': 'var(--icon-md)',
        'icon-lg': 'var(--icon-lg)',
        'notes-entry': 'var(--height-notes-entry)',
        create: 'var(--height-create)'
      },
      maxHeight: {
        composer: 'var(--height-composer-max)'
      },
      minWidth: {
        write: 'var(--width-write)',
        list: 'var(--width-list)',
        college: 'var(--col-college)',
        match: 'var(--col-match)',
        rate: 'var(--col-rate)',
        highlights: 'var(--col-highlights)'
      },
      letterSpacing: {
        label: 'var(--tracking-label)'
      },
      gridTemplateColumns: {
        list: '1fr var(--width-sidebar)'
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
        display: ['Geist', 'system-ui', 'sans-serif'],
        sans: ['Geist', 'system-ui', 'sans-serif']
      },
      fontSize: {
        12: 'var(--text-12)',
        14: 'var(--text-14)',
        15: 'var(--text-15)',
        16: 'var(--text-16)',
        18: 'var(--text-18)',
        22: 'var(--text-22)',
        28: 'var(--text-28)',
        40: 'var(--text-40)',
        caption: 'var(--text-caption)',
        'body-sm': 'var(--text-body-sm)',
        body: 'var(--text-body)',
        'body-lg': 'var(--text-body-lg)',
        subtitle: 'var(--text-subtitle)',
        title: 'var(--text-title)',
        display: 'var(--text-display)',
        'display-lg': 'var(--text-display-lg)'
      }
    }
  },
  plugins: []
}
