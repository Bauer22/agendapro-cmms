/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:  '#0c1628', bg2: '#111e35',
        s1:  '#162540', s2:  '#1c2f50', s3: '#243a60',
        bd:  '#1e3a5f', bd2: '#2a4f7c',
        cy:  '#f97316', cy2: '#fb923c',
        am:  '#eab308', gn:  '#22c55e',
        rd:  '#ef4444', pu:  '#a78bfa',
        bl:  '#1e3a6e',
        t1:  '#e8edf5', t2:  '#8fa3bf', t3: '#4a6380',
      },
      fontFamily: {
        sora:  ['Sora', 'system-ui', 'sans-serif'],
        bebas: ['Bebas Neue', 'impact', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
