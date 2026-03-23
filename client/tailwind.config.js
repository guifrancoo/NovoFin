/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1a1a2e',
          light:   '#22223d',
          dark:    '#12121f',
        },
        brand: {
          50:  '#e8f4fd',
          100: '#b5d4f4',
          500: '#378ADD',
          600: '#185FA5',
          700: '#0C447C',
        },
        success: '#27ae60',
        danger:  '#c0392b',
        warning: '#f39c12',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
