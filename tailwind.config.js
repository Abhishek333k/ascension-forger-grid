/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cpRed: '#ff003c',
        cpCyan: '#00f0ff',
        cpYellow: '#fce100',
        cpEmerald: '#10b981',
        cpDark: 'rgba(20, 2, 5, 0.85)',
      },
      fontFamily: {
        rajdhani: ['Rajdhani', 'sans-serif'],
        mono: ['Share Tech Mono', 'monospace'],
      },
      boxShadow: {
        'cp-glow': '0 0 15px rgba(255, 0, 60, 0.25)',
        'cp-glow-strong': '0 0 25px rgba(255, 0, 60, 0.5)',
        'cyan-glow': '0 0 15px rgba(0, 240, 255, 0.25)',
      }
    },
  },
  plugins: [],
}
