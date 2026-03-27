import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:     '#070810',
        panel:  '#0c0e18',
        accent: '#c5ff2b',
        cyan:   '#5cc8ff',
        't-hi':  '#ece7de',
        'border': 'rgba(255,255,255,0.07)',
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
        sans:  ['var(--font-dm-sans)',  'system-ui', 'sans-serif'],
        mono:  ['var(--font-space-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
