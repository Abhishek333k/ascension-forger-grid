/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        industrial: {
          950: '#0a0a0a',
          900: '#121212',
          800: '#1a1a1a',
          700: '#262626',
          600: '#3a3a3a',
          500: '#525252',
          400: '#a3a3a3',
          300: '#d4d4d4',
          100: '#f5f5f5',
        },
        grid: {
          green: '#00ff66',
          darkgreen: '#003311',
          orange: '#ff5500',
          red: '#ff2233',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
        mono: ['Fira Code', 'JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'grid-glow': '0 0 15px rgba(0, 255, 102, 0.15)',
        'grid-glow-strong': '0 0 25px rgba(0, 255, 102, 0.4)',
        'grid-glow-red': '0 0 15px rgba(255, 34, 51, 0.25)',
      }
    },
  },
  plugins: [],
}
