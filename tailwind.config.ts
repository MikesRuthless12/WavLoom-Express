import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#39FF14',
          hover: '#32E612',
          muted: '#39FF1433',
        },
        bg: '#0A0A0A',
        surface: {
          DEFAULT: '#141414',
          elevated: '#1E1E1E',
        },
        border: '#2A2A2A',
        text: {
          DEFAULT: '#E8E8E8',
          secondary: '#888888',
          muted: '#555555',
        },
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
        '16': '64px',
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        full: '9999px',
      },
    },
  },
  plugins: [],
} satisfies Config
