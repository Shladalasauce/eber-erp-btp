/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        petrol: '#2c3e50',
        emerald: '#27ae60',
        amber: '#f39c12',
      }
    },
  },
  plugins: [],
}
