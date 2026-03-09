import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'oracle-green': '#00ff88',
        'oracle-red': '#ff3366',
        'oracle-blue': '#00aaff',
        'oracle-yellow': '#ffcc00',
        'oracle-bg': '#0a0d14',
        'oracle-surface': '#111520',
        'oracle-border': '#1e2535',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
