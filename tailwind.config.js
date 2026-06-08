/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:    '#060d1a',
        bg2:   '#0c1628',
        s1:    '#111d33',
        s2:    '#192840',
        s3:    '#1e3050',
        bd:    '#1e3a5f',
        bd2:   '#2a4f7c',
        cy:    '#00d4ff',
        am:    '#f59e0b',
        gn:    '#10b981',
        rd:    '#ef4444',
        t1:    '#e2e8f0',
        t2:    '#8fa3bf',
        t3:    '#4a6380',
      },
      fontFamily: { sora: ['Sora', 'system-ui', 'sans-serif'], bebas: ['Bebas Neue', 'impact', 'sans-serif'] },
    },
  },
  plugins: [],
}
