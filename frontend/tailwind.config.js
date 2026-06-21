/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        coral: { 50: '#fff3ef', 100: '#ffe4dc', 500: '#ff7a61', 600: '#ed624a', 700: '#c94c38' },
        mint: { 50: '#effcf7', 100: '#d5f7ea', 500: '#53c9a5', 600: '#36a986' },
        skysoft: { 50: '#f0f8ff', 100: '#dcefff', 500: '#67b7e8' },
        cream: '#f8f7f3'
      },
      boxShadow: { card: '0 10px 32px rgba(67, 58, 45, 0.07)' },
      borderRadius: { '4xl': '2rem' },
    },
  },
  plugins: [],
}

