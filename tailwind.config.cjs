/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#fbe8c5',
        mint: '#a7f3d0',
        'pastel-purple': '#d8b4fe',
        'soft-pink': '#fbcfe8',
        'background-dark': '#181511',
        'cyber-cyan': '#13c8ec',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      animation: {
        glitch: 'glitch 0.5s infinite alternate',
        float: 'float 6s ease-in-out infinite',
        crawl: 'crawl 60s linear infinite',
      },
      keyframes: {
        glitch: {
          '0%': { opacity: '0.8', transform: 'skewX(1deg)' },
          '50%': { opacity: '1', transform: 'skewX(-1deg)' },
          '100%': { opacity: '0.9', transform: 'skewX(0.5deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        crawl: {
          '0%': { top: '100%', transform: 'rotateX(20deg) translateZ(0)', opacity: '1' },
          '100%': {
            top: '-200%',
            transform: 'rotateX(25deg) translateZ(-2500px)',
            opacity: '0',
          },
        },
      },
    },
  },
  plugins: [],
};
