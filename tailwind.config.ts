import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0A0A',
        surface: '#111111',
        'surface-elevated': '#1A1A1A',
        border: '#2A2A2A',
        'text-primary': '#FFFFFF',
        'text-secondary': '#888888',
        gold: '#C9A84C',
        'gold-muted': 'rgba(201,168,76,0.10)',
        danger: '#EF4444',
        success: '#22C55E',
        warning: '#F59E0B',
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['72px', { lineHeight: '1', fontWeight: '700' }],
        'display-lg': ['48px', { lineHeight: '1.1', fontWeight: '700' }],
        'display-md': ['36px', { lineHeight: '1.2', fontWeight: '600' }],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        gold: '0 0 0 1px rgba(201,168,76,0.3)',
        'gold-glow': '0 4px 24px rgba(201,168,76,0.15)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-in': 'slide-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
}

export default config
