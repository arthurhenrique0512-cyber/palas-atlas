/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./*.html",
    "./js/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          light: '#e0c97f',
          DEFAULT: '#d4af37',
          dark: '#c8ad5f'
        }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['var(--font-merriweather)', 'Merriweather', 'serif'],
        mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
