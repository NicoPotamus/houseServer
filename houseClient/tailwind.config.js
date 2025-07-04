/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",  // For React/TypeScript files
    "./public/index.html",          // HTML files
    "./pages/**/*.{js,jsx,ts,tsx}", // Next.js pages if using Next.js
    "./components/**/*.{js,jsx,ts,tsx}", // Component files
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

