/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: { base: '#09090b', card: '#121214', line: '#1f1f22' }
    }
  },
  plugins: []
};
