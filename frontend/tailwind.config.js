/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        coral: { 50: '#fff3ef', 100: '#ffe4dc', 200: '#ffc9bb', 300: '#ffa991', 400: '#ff8d72', 500: '#ff7a61', 600: '#ed624a', 700: '#c94c38' },
        mint: { 50: '#effcf7', 100: '#d5f7ea', 500: '#53c9a5', 600: '#36a986' },
        skysoft: { 50: '#f0f8ff', 100: '#dcefff', 500: '#67b7e8' },
        cream: '#f7f5ef'
      },
      boxShadow: {
        card: '0 18px 48px -26px rgba(52, 43, 34, 0.28), 0 3px 12px rgba(52, 43, 34, 0.05)',
        float: '0 18px 45px -18px rgba(47, 40, 31, 0.28)',
        coral: '0 12px 28px -12px rgba(255, 122, 97, 0.7)'
      },
      borderRadius: { '4xl': '2rem' },
    },
  },
  plugins: [],
}
