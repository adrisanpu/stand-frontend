import type { Config } from 'tailwindcss'
export default {
  content: ['./index.html','./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        neonMagenta: '#B026FF',
        neonCyan: '#22D3EE',
        neonRed: '#F02230',
        softRed: '#632727',
        standOrange: '#fb831b',
        // Theme colors using CSS variables for dynamic theming
        textMain: 'var(--color-text-main, #EAEAF2)',
        textSub: 'var(--color-text-sub, #9AA0A6)',
        surface: 'var(--color-surface, rgba(255,255,255,0.04))',
        bgDark: '#0B0A12',
        // Primary and accent colors using CSS variables
        primary: 'rgba(var(--color-primary-rgb, 176,38,255), <alpha-value>)',
        accent: 'var(--color-accent, #22D3EE)',
      },
      boxShadow: {
        neon: '0 0 20px rgba(176,38,255,0.35), 0 0 28px rgba(34,211,238,0.25)',
      },
      backdropBlur: { xs: '2px' },
      fontFamily: {
        digital: ['Segment7Standard', 'ui-monospace', 'monospace'],
      },
    },
    fontFamily: { sans: ['Inter','system-ui','sans-serif'] }
  },
  plugins: [],
} satisfies Config
