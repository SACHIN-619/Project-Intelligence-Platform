import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ── Exact colours from DESIGN.md ─────────────────────────────────────
      colors: {
        // Surface layers (dark blue-black palette)
        'surface':                    '#0c1322',
        'surface-dim':                '#0c1322',
        'surface-bright':             '#323949',
        'surface-container-lowest':   '#070e1d',
        'surface-container-low':      '#141b2b',
        'surface-container':          '#191f2f',
        'surface-container-high':     '#232a3a',
        'surface-container-highest':  '#2e3545',
        'surface-variant':            '#2e3545',
        'background':                 '#0c1322',

        // Text
        'on-surface':         '#dce2f7',
        'on-surface-variant': '#c2c6d6',
        'on-background':      '#dce2f7',
        'outline':            '#8c909f',
        'outline-variant':    '#424754',

        // Primary — Electric Blue
        'primary':              '#adc6ff',
        'primary-container':    '#4d8eff',
        'on-primary':           '#002e6a',
        'on-primary-container': '#00285d',
        'inverse-primary':      '#005ac2',

        // Secondary — Teal (AI accent)
        'secondary':              '#4fdbc8',
        'secondary-container':    '#04b4a2',
        'on-secondary':           '#003731',
        'on-secondary-container': '#003f38',

        // Tertiary — Purple (confidence)
        'tertiary':              '#d0bcff',
        'tertiary-container':    '#a078ff',
        'on-tertiary':           '#3c0091',
        'on-tertiary-container': '#340080',

        // Semantic — used throughout for risk levels
        'error':              '#ffb4ab',
        'error-container':    '#93000a',
        'on-error':           '#690005',

        // ── Custom semantic shortcuts ─────────────────────────────────────
        'risk-critical': '#EF4444',
        'risk-high':     '#F97316',
        'risk-medium':   '#EAB308',
        'risk-low':      '#22C55E',
        'metric-purple': '#A855F7',
        'metric-teal':   '#14B8A6',
        'metric-cyan':   '#06B6D4',
      },

      // ── Typography from DESIGN.md ─────────────────────────────────────────
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        mono:  ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'display-metrics': ['52px', { lineHeight: '1.1', fontWeight: '800', letterSpacing: '-0.02em' }],
        'display-metrics-mobile': ['36px', { lineHeight: '1.2', fontWeight: '700' }],
        'headline-lg':    ['30px', { lineHeight: '36px', fontWeight: '600', letterSpacing: '-0.01em' }],
        'headline-md':    ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'body-lg':        ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-md':        ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'label-caps':     ['11px', { lineHeight: '16px', fontWeight: '600', letterSpacing: '0.05em' }],
        'technical-code': ['13px', { lineHeight: '18px', fontWeight: '500' }],
      },

      // ── Spacing ───────────────────────────────────────────────────────────
      spacing: {
        'sidebar-width':  '240px',
        'gutter':         '1.5rem',
        'margin-page':    '2rem',
        'container-gap':  '1rem',
        'stack-tight':    '0.5rem',
      },

      // ── Border radius ─────────────────────────────────────────────────────
      borderRadius: {
        'sm':      '0.125rem',
        DEFAULT:   '0.25rem',
        'md':      '0.375rem',
        'lg':      '0.5rem',
        'xl':      '0.75rem',
        'full':    '9999px',
      },

      // ── Animations ────────────────────────────────────────────────────────
      keyframes: {
        pulse_dot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':      { opacity: '0.4', transform: 'scale(1.3)' },
        },
        count_up: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slide_in_right: {
          '0%':   { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slide_in_left: {
          '0%':   { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slide_in_up: {
          '0%':   { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fade_in: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        check_pop: {
          '0%':   { transform: 'scale(0)' },
          '60%':  { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'pulse-dot':      'pulse_dot 1.2s ease-in-out infinite',
        'pulse-fast':     'pulse_dot 0.8s ease-in-out infinite',
        'count-up':       'count_up 0.4s ease-out forwards',
        'slide-in-right': 'slide_in_right 0.25s ease-out forwards',
        'slide-in-left':  'slide_in_left 0.25s ease-out forwards',
        'slide-in-up':    'slide_in_up 0.3s ease-out forwards',
        'fade-in':        'fade_in 0.3s ease-out forwards',
        'check-pop':      'check_pop 0.2s ease-out forwards',
        'shimmer':        'shimmer 1.5s infinite linear',
      },
    },
  },
  plugins: [],
}

export default config
