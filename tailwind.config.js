/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['JetBrains Mono', 'monospace'],
        body: ['IBM Plex Sans', 'sans-serif'],
      },
      colors: {
        bg: { primary: 'var(--bg-primary)', secondary: 'var(--bg-secondary)', tertiary: 'var(--bg-tertiary)' },
        accent: { green: '#00ff87', red: '#ff3366', amber: '#ffaa00', blue: '#00aaff', muted: '#555570' },
        text: { primary: 'var(--text-primary)', secondary: 'var(--text-secondary)', dim: 'var(--text-dim)' },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
