/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  safelist: [
    'bg-desk',
    'bg-rail',
    'hover:bg-rail',
    'z-preview',
    'z-sticky',
    'z-ask',
    'z-menu',
    'z-row',
    'z-ask-row',
    'grid-cols-32',
    'shadow-sticky',
    'shadow-popover',
    'shadow-sheet',
    'shadow-drag',
    'w-sheet',
    'w-oop',
    'w-ask',
    'w-add-menu',
    'w-basis-kind'
  ],
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
        },
        rail: 'var(--rail)',
        desk: 'var(--desk)',
        target: 'var(--band-target)',
        reach: 'var(--band-reach)',
        'cost-over': 'var(--cost-over)'
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
        'notes-entry': 'var(--width-notes-entry)',
        you: 'var(--width-you)',
        sheet: 'var(--width-sheet)'
      },
      width: {
        history: 'var(--width-history)',
        'icon-sm': 'var(--icon-sm)',
        'icon-md': 'var(--icon-md)',
        'icon-lg': 'var(--icon-lg)',
        'notes-entry': 'var(--width-notes-entry)',
        phrase: 'var(--col-phrase)',
        actions: 'var(--col-actions)',
        pencil: 'var(--icon-pencil)',
        oop: 'var(--width-oop)',
        ask: 'var(--width-ask)',
        'add-menu': 'var(--width-add-menu)',
        sheet: 'var(--width-sheet)',
        'icon-xs': 'var(--icon-xs)',
        'icon-compact': 'var(--icon-compact)',
        prose: 'var(--space-prose)',
        'basis-kind': 'var(--col-basis-kind)'
      },
      height: {
        'icon-sm': 'var(--icon-sm)',
        'icon-md': 'var(--icon-md)',
        'icon-lg': 'var(--icon-lg)',
        'notes-entry': 'var(--height-notes-entry)',
        create: 'var(--height-create)',
        pencil: 'var(--icon-pencil)',
        'icon-xs': 'var(--icon-xs)',
        'icon-compact': 'var(--icon-compact)'
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
        highlights: 'var(--col-highlights)',
        'list-name': 'var(--col-list-name)',
        'list-band': 'var(--col-list-band)',
        'list-cost': 'var(--col-list-cost)',
        'list-distance': 'var(--col-list-distance)',
        'list-rate': 'var(--col-list-rate)',
        'list-rationale': 'var(--col-list-rationale)',
        'list-extra': 'var(--col-list-extra)'
      },
      letterSpacing: {
        label: 'var(--tracking-label)'
      },
      gridTemplateColumns: {
        list: '1fr var(--width-sidebar)',
        32: 'repeat(32, minmax(0, 1fr))'
      },
      boxShadow: {
        drag: 'var(--shadow-drag)',
        sticky: 'var(--shadow-sticky)',
        popover: 'var(--shadow-popover)',
        sheet: 'var(--shadow-sheet)'
      },
      opacity: {
        dimmed: 'var(--opacity-dimmed)'
      },
      zIndex: {
        row: 'var(--z-row)',
        'ask-row': 'var(--z-ask-row)',
        sticky: 'var(--z-sticky)',
        ask: 'var(--z-ask)',
        menu: 'var(--z-menu)',
        preview: 'var(--z-preview)'
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
        12: 'var(--space-12)',
        dock: 'var(--space-dock)',
        hit: 'var(--space-hit)',
        dot: 'var(--space-dot)',
        prose: 'var(--space-prose)',
        'sheet-x': 'var(--sheet-pad-x)',
        'sheet-y': 'var(--sheet-pad-y)',
        'select-pad': 'var(--width-select-pad)'
      },
      fontFamily: {
        display: ['Geist', 'system-ui', 'sans-serif'],
        sans: ['Geist', 'system-ui', 'sans-serif']
      },
      fontSize: {
        11: 'var(--text-11)',
        12: 'var(--text-12)',
        13: 'var(--text-13)',
        14: 'var(--text-14)',
        15: 'var(--text-15)',
        16: 'var(--text-16)',
        18: 'var(--text-18)',
        20: 'var(--text-20)',
        22: 'var(--text-22)',
        24: 'var(--text-24)',
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
