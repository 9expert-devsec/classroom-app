/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class", "class"],
  content: [
    "./src/app/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			brand: {
  				primary: '#66CCFF',
  				primaryDark: '#0099CC',
  				bgSoft: '#F5F8FB',
  				text: '#0A1F33',
  				textMuted: '#4B5363',
  				danger: '#E53935',
  				warning: '#FFB347',
  				success: '#16C479',
  				purple: '#BB9AF9',
  				border: '#E3E8EF'
  			},
  			front: {
  				bg: '#FFFFFF',
  				bgSoft: '#F5F8FB',
  				surface: '#FFFFFF',
  				stepBg: '#F5F8FB',
  				stepFuture: '#F5F8FB',
  				stepDoneBorder: '#66CCFF',
  				stepGradientFrom: '#66CCFF',
  				stepGradientTo: '#BB9AF9',
  				text: '#0A1F33',
  				textMuted: '#4B5363'
  			},
  			admin: {
  				bg: '#F5F8FB',
  				surface: '#FFFFFF',
  				surfaceMuted: '#F5F8FB',
  				sidebarBg: '#0A1F33',
  				sidebarText: '#F9FAFB',
  				border: '#E3E8EF',
  				text: '#0A1F33',
  				textMuted: '#4B5363'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		boxShadow: {
  			card: '0 18px 45px rgba(15, 23, 42, 0.06)'
  		},
  		borderRadius: {
  			'2xl': '1rem',
  			'3xl': '1.5rem',
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
