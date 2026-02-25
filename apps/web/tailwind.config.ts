import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        mist: '#e2e8f0',
        signal: '#0ea5e9',
        warn: '#f59e0b',
        danger: '#ef4444',
      },
    },
  },
  plugins: [],
} satisfies Config;