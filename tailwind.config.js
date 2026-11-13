/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Design tokens. Semantic colours are reserved for road status.
        canvas: '#F8FAFC',
        hairline: '#E2E8F0',
        ink: '#0F172A',
        muted: '#64748B',
        clear: '#10B981',
        caution: '#F59E0B',
        danger: '#EF4444',
        tg: '#3390EC', // Telegram link blue, used only inside the Mini App chrome
      },
      boxShadow: {
        sheet: '0 -4px 16px -6px rgba(15, 23, 42, 0.14)',
        float: '0 2px 8px -2px rgba(15, 23, 42, 0.14)',
        device: '0 24px 48px -24px rgba(15, 23, 42, 0.35)',
      },
      keyframes: {
        'slide-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'slide-down': { from: { transform: 'translateY(-10px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        scan: { '0%': { top: '0%' }, '50%': { top: '100%' }, '100%': { top: '0%' } },
      },
      animation: {
        'slide-up': 'slide-up 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'slide-down': 'slide-down 200ms ease-out both',
        'fade-in': 'fade-in 180ms ease-out both',
        scan: 'scan 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
