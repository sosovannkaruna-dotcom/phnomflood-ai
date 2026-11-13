/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      // Type scale: 11 / 12 / 13 / 14 / 16 / 18 / 20. Nothing smaller than 11px.
      fontSize: {
        '2xs': ['0.6875rem', '1rem'],
        compact: ['0.8125rem', '1.125rem'],
      },
      colors: {
        // Design tokens
        canvas: '#F8FAFC', // app surface
        hairline: '#E2E8F0', // 1px borders
        ink: '#0F172A', // primary text
        muted: '#475569', // secondary text (WCAG AA on white and canvas)
        accent: '#0284C7', // the single accent: active states, primary CTAs, selected markers
        // Semantic road-status colours, used for nothing else
        clear: '#10B981',
        caution: '#F59E0B',
        danger: '#EF4444',
      },
      boxShadow: {
        sheet: '0 -1px 3px rgba(15, 23, 42, 0.08)',
        device: '0 12px 32px -16px rgba(15, 23, 42, 0.3)',
      },
      keyframes: {
        'slide-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        toast: { from: { transform: 'translateY(-120%)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        'slide-up': 'slide-up 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        // Overshooting curve gives the toast a spring settle
        toast: 'toast 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'fade-in': 'fade-in 180ms ease-out both',
      },
    },
  },
  plugins: [],
}
