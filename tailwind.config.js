/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
    },
    extend: {
      colors: {
        ink: '#1D1D1F',
        mist: '#F5F5F7',
        graphite: '#6E6E73',
        accent: {
          DEFAULT: '#0071E3',
          dark: '#0059B3',
          light: '#2B9EFF',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          dark: '#0B0B0D',
        },
        brand: {
          DEFAULT: '#FF5A1F',
          50: '#FFF1EA',
          100: '#FFE1D0',
          500: '#FF5A1F',
          600: '#EA4A11',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          'Inter',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        'display-xl': ['clamp(3rem, 6vw, 6.5rem)', { lineHeight: '1.02', letterSpacing: '-0.03em', fontWeight: '600' }],
        'display-lg': ['clamp(2.5rem, 5vw, 4.5rem)', { lineHeight: '1.04', letterSpacing: '-0.03em', fontWeight: '600' }],
        'display-md': ['clamp(2rem, 3.4vw, 3rem)', { lineHeight: '1.08', letterSpacing: '-0.02em', fontWeight: '600' }],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -6px rgba(0,0,0,0.08)',
        card: '0 2px 8px rgba(0,0,0,0.04), 0 20px 40px -12px rgba(0,0,0,0.12)',
        floaty: '0 30px 60px -20px rgba(0,0,0,0.25)',
      },
      backgroundImage: {
        'mesh-orange': 'radial-gradient(60% 60% at 20% 20%, rgba(255,90,31,0.16) 0%, rgba(255,90,31,0) 60%), radial-gradient(50% 50% at 85% 30%, rgba(0,113,227,0.14) 0%, rgba(0,113,227,0) 60%)',
      },
      animation: {
        'fade-up': 'fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in': 'fadeIn 0.6s ease both',
        float: 'float 6s ease-in-out infinite',
        marquee: 'marquee 30s linear infinite',
        'marquee-slow': 'marquee 55s linear infinite',
        'draw-line': 'drawLine 2.6s cubic-bezier(0.16,1,0.3,1) forwards',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        shimmer: 'shimmer 2.4s ease-in-out infinite',
        'scan-x': 'scanX 3.2s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        drawLine: {
          '0%': { strokeDashoffset: '600' },
          '100%': { strokeDashoffset: '0' },
        },
        pulseDot: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.6)', opacity: '0.35' },
        },
        shimmer: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        scanX: {
          '0%': { transform: 'translateX(-10%)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translateX(110%)', opacity: '0' },
        },
      },
      transitionTimingFunction: {
        apple: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
