/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        slate: {
          750: '#2a3a4d',
          850: '#172234',
        },
      },
    },
  },
  plugins: [],
};
