/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dayflow-red': '#E53935',
        'dayflow-dark': '#282828',
        'dayflow-green': '#4CAF50',
        'dayflow-pink': '#F8BBD0',
        'dayflow-blue': '#1976D2',
      }
    },
  },
  plugins: [],
}
