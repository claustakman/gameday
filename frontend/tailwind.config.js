/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        green:        '#1D9E75',
        'green-light': '#E1F5EE',
        'green-dark':  '#0F6E56',
        blue:         '#185FA5',
        'blue-light':  '#E6F1FB',
        'blue-dark':   '#0C447C',
        purple:       '#7F77DD',
        'purple-light':'#EEEDFE',
        'amber-light': '#FFF3CD',
        'amber-text':  '#854F0B',
        red:          '#A32D2D',
        bg:           '#ffffff',
        bg2:          '#f5f5f5',
        text1:        '#1a1a1a',
        text2:        '#666666',
        text3:        '#999999',
        border:       'rgba(0,0,0,0.10)',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
