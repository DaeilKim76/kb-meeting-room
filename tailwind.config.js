/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'kb-yellow': '#F5A623',
        'kb-gold':   '#C8930A',
        'kb-dark':   '#1A1A2E',
        'kb-navy':   '#16213E',
        'kb-accent': '#E94560',
      },
    },
  },
  plugins: [],
}
