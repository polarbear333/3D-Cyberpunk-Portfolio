/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          // Cyberpunk color palette
          neon: {
            pink: "#FF10F0",
            blue: "#00FFFF",
            purple: "#7B68EE",
            yellow: "#FFFF00",
            green: "#39FF14",
          },
          cyber: {
            black: "#0a0a0a",
            darkgray: "#1a1a1a",
            gray: "#2a2a2a",
            lightgray: "#3a3a3a",
          }
        },
        fontFamily: {
          'cyberpunk': ['Orbitron', 'sans-serif'],
          'mono': ['Share Tech Mono', 'monospace'],
        },
        animation: {
          'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          'glitch': 'glitch 1s linear infinite',
          'scanline': 'scanline 6s linear infinite',
        },
        keyframes: {
          glitch: {
            '0%, 100%': { transform: 'translate(0)' },
            '20%': { transform: 'translate(-2px, 2px)' },
            '40%': { transform: 'translate(-2px, -2px)' },
            '60%': { transform: 'translate(2px, 2px)' },
            '80%': { transform: 'translate(2px, -2px)' },
          },
          scanline: {
            '0%': { transform: 'translateY(-100%)' },
            '100%': { transform: 'translateY(100%)' },
          },
        },
        boxShadow: {
          'neon-pink': '0 0 5px #FF10F0, 0 0 10px #FF10F0',
          'neon-blue': '0 0 5px #00FFFF, 0 0 10px #00FFFF',
          'neon-purple': '0 0 5px #7B68EE, 0 0 10px #7B68EE',
          'neon-yellow': '0 0 5px #FFFF00, 0 0 10px #FFFF00',
          'neon-green': '0 0 5px #39FF14, 0 0 10px #39FF14',
        },
      },
    },
    plugins: [],
  }