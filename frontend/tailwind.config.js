/** @type {import('tailwindcss').Config} */
// Tema terang teal-ivory: primary teal-600, background ivory #FFFDF7
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory: '#FFFDF7',
        primary: {
          DEFAULT: '#0d9488', // teal-600
          dark: '#0f766e',    // teal-700
          light: '#ccfbf1'    // teal-100
        }
      },
      minHeight: { tap: '44px' },
      minWidth: { tap: '44px' }
    }
  },
  plugins: []
};
