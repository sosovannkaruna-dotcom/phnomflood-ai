/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    // Industrial geometry: every corner is 90 degrees. Only dots and pucks stay round.
    borderRadius: {
      none: '0',
      sm: '0',
      DEFAULT: '0',
      md: '0',
      lg: '0',
      xl: '0',
      '2xl': '0',
      '3xl': '0',
      full: '9999px',
    },
    extend: {
      fontFamily: {
        sans: ['"Geist Variable"', '"Noto Sans Khmer Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Archivo Variable"', '"Geist Variable"', '"Noto Sans Khmer Variable"', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono Variable"', '"Noto Sans Khmer Variable"', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      // Type scale: 11 / 12 / 13 / 14 / 16 / 18 / 20. Nothing smaller than 11px in the tools.
      fontSize: {
        '2xs': ['0.6875rem', '1rem'],
        compact: ['0.8125rem', '1.125rem'],
      },
      colors: {
        // Single brand accent: hazard red. Also the "impassable" signal, so brand and danger agree.
        signal: '#E8301C',
        // Same hue, lifted for text on dark (AA contrast at 12px)
        flare: '#FF6A55',
        // Secondary: storm-dusk violet. The "touch" colour: hover and pointer feedback, and quiet
        // tinted surfaces. Never an action (that is signal) and never road status.
        dusk: '#9C98D6',
        'dusk-mid': '#5D5AA6',
        'dusk-deep': '#131226',
        // Neutral substrate (one zinc family, never pure black)
        void: '#0A0A0B',
        slab: '#111113',
        // Semantic road-status colours, used for data and nothing else
        clear: '#10B981',
        caution: '#F59E0B',
        danger: '#EF4444',
        water: '#38BDF8',
      },
      transitionTimingFunction: {
        // Strong ease-out: instant start, long settle
        punch: 'cubic-bezier(0.23, 1, 0.32, 1)',
        drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        'slide-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        toast: { from: { transform: 'translateY(-120%)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        'slide-up': 'slide-up 260ms cubic-bezier(0.32, 0.72, 0, 1) both',
        toast: 'toast 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'fade-in': 'fade-in 180ms ease-out both',
      },
    },
  },
  plugins: [],
}
