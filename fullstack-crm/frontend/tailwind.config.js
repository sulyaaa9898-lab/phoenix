/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#101828',
        coral: '#ff6a3d',
        mint: '#def7ec',
        paper: '#fffaf4',
      },
      boxShadow: {
        panel: '0 10px 40px rgba(16, 24, 40, 0.08)',
      },
    },
  },
  plugins: [],
};
