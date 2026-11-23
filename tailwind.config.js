/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./js/**/*.js"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        '2xs': '0 1px 2px rgba(15, 23, 42, 0.03)',
        'xs': '0 1px 2px rgba(15, 23, 42, 0.035), 0 4px 12px -2px rgba(15, 23, 42, 0.04)',
        'editorial': '0 1px 2px rgba(15, 23, 42, 0.03), 0 8px 24px rgba(15, 23, 42, 0.04)',
      }
    },
  },
  plugins: [],
};
