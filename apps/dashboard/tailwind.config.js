/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        xhs: {
          red: '#ff2442',
          pink: '#fe2c55',
        }
      }
    },
  },
  plugins: [],
}
