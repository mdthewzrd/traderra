/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Traderra-specific dark studio theme
        studio: {
          bg: '#0a0a0a',
          surface: '#111111',
          border: '#1a1a1a',
          text: '#e5e5e5',
          muted: '#666666',
          accent: '#3b82f6',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
        },
        trading: {
          profit: '#10b981',
          loss: '#ef4444',
          neutral: '#6b7280',
          volume: '#3b82f6',
        },
        // Traderra brand colors - aligned with CSS primary
        traderra: {
          gold: {
            DEFAULT: 'hsl(45, 93%, 35%)', // Matches CSS --primary
            dark: 'hsl(45, 93%, 30%)',    // Darker variant
            light: 'hsl(45, 93%, 40%)',   // Lighter variant
          }
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "fade-in": {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        "fade-out": {
          from: { opacity: 1 },
          to: { opacity: 0 },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.8 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "fade-out": "fade-out 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "slide-in-left": "slide-in-left 0.3s ease-out",
        "pulse-soft": "pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      backdropBlur: {
        xs: '2px',
      },
      // Typography customization for dark studio theme
      typography: {
        DEFAULT: {
          css: {
            // Base typography styles for dark theme
            '--tw-prose-body': '#e5e5e5',
            '--tw-prose-headings': '#e5e5e5',
            '--tw-prose-lead': '#a3a3a3',
            '--tw-prose-links': 'hsl(45, 93%, 35%)', // Primary gold color
            '--tw-prose-bold': '#e5e5e5',
            '--tw-prose-counters': '#666666',
            '--tw-prose-bullets': '#666666',
            '--tw-prose-hr': '#1a1a1a',
            '--tw-prose-quotes': '#e5e5e5',
            '--tw-prose-quote-borders': '#1a1a1a',
            '--tw-prose-captions': '#666666',
            '--tw-prose-kbd': '#e5e5e5',
            '--tw-prose-kbd-shadows': '#000000',
            '--tw-prose-code': '#e5e5e5',
            '--tw-prose-pre-code': '#a3a3a3',
            '--tw-prose-pre-bg': '#0a0a0a',
            '--tw-prose-th-borders': '#1a1a1a',
            '--tw-prose-td-borders': '#1a1a1a',

            // Enhanced typography settings
            maxWidth: 'none',
            color: 'var(--tw-prose-body)',
            lineHeight: '1.7',

            // Headings
            'h1, h2, h3, h4, h5, h6': {
              color: 'var(--tw-prose-headings)',
              fontWeight: '700',
              lineHeight: '1.4',
            },
            h1: {
              fontSize: '2.25em',
              marginTop: '0',
              marginBottom: '0.8888889em',
            },
            h2: {
              fontSize: '1.5em',
              marginTop: '2em',
              marginBottom: '1em',
            },
            h3: {
              fontSize: '1.25em',
              marginTop: '1.6em',
              marginBottom: '0.6em',
            },

            // Paragraphs
            p: {
              marginTop: '1.25em',
              marginBottom: '1.25em',
            },

            // Lists
            'ul, ol': {
              marginTop: '1.25em',
              marginBottom: '1.25em',
              paddingLeft: '1.625em',
            },
            li: {
              marginTop: '0.5em',
              marginBottom: '0.5em',
            },
            'ul > li': {
              paddingLeft: '0.375em',
            },
            'ul > li::marker': {
              color: 'var(--tw-prose-bullets)',
            },
            'ol > li::marker': {
              color: 'var(--tw-prose-counters)',
            },

            // Links
            a: {
              color: 'var(--tw-prose-links)',
              textDecoration: 'underline',
              fontWeight: '500',
              textDecorationColor: 'hsl(45, 93%, 35%, 0.3)',
              '&:hover': {
                textDecorationColor: 'hsl(45, 93%, 35%)',
              },
            },

            // Strong and emphasis
            strong: {
              color: 'var(--tw-prose-bold)',
              fontWeight: '600',
            },
            em: {
              color: 'var(--tw-prose-body)',
              fontStyle: 'italic',
            },

            // Code
            code: {
              color: 'var(--tw-prose-code)',
              backgroundColor: '#111111',
              paddingLeft: '0.375rem',
              paddingRight: '0.375rem',
              paddingTop: '0.125rem',
              paddingBottom: '0.125rem',
              borderRadius: '0.25rem',
              fontSize: '0.875em',
              fontWeight: '500',
            },
            'code::before': {
              content: 'none',
            },
            'code::after': {
              content: 'none',
            },

            // Pre-formatted code blocks
            pre: {
              color: 'var(--tw-prose-pre-code)',
              backgroundColor: 'var(--tw-prose-pre-bg)',
              overflowX: 'auto',
              fontSize: '0.875em',
              lineHeight: '1.7142857',
              marginTop: '1.7142857em',
              marginBottom: '1.7142857em',
              borderRadius: '0.375rem',
              paddingTop: '0.8571429em',
              paddingRight: '1.1428571em',
              paddingBottom: '0.8571429em',
              paddingLeft: '1.1428571em',
              border: '1px solid #1a1a1a',
            },
            'pre code': {
              backgroundColor: 'transparent',
              borderWidth: '0',
              borderRadius: '0',
              padding: '0',
              fontWeight: 'inherit',
              color: 'inherit',
              fontSize: 'inherit',
              fontFamily: 'inherit',
              lineHeight: 'inherit',
            },

            // Blockquotes
            blockquote: {
              fontWeight: '500',
              fontStyle: 'italic',
              color: 'var(--tw-prose-quotes)',
              borderLeftWidth: '0.25rem',
              borderLeftColor: 'var(--tw-prose-quote-borders)',
              quotes: '"\\201C""\\201D""\\2018""\\2019"',
              marginTop: '1.6em',
              marginBottom: '1.6em',
              paddingLeft: '1em',
            },

            // Horizontal rules
            hr: {
              borderColor: 'var(--tw-prose-hr)',
              borderTopWidth: '1px',
              marginTop: '3em',
              marginBottom: '3em',
            },

            // Tables
            table: {
              width: '100%',
              tableLayout: 'auto',
              textAlign: 'left',
              marginTop: '2em',
              marginBottom: '2em',
              fontSize: '0.875em',
              lineHeight: '1.7142857',
            },
            thead: {
              borderBottomWidth: '1px',
              borderBottomColor: 'var(--tw-prose-th-borders)',
            },
            'thead th': {
              color: 'var(--tw-prose-headings)',
              fontWeight: '600',
              verticalAlign: 'bottom',
              paddingRight: '0.5714286em',
              paddingBottom: '0.5714286em',
              paddingLeft: '0.5714286em',
            },
            'tbody tr': {
              borderBottomWidth: '1px',
              borderBottomColor: 'var(--tw-prose-td-borders)',
            },
            'tbody td': {
              verticalAlign: 'baseline',
              paddingTop: '0.5714286em',
              paddingRight: '0.5714286em',
              paddingBottom: '0.5714286em',
              paddingLeft: '0.5714286em',
            },
          },
        },

        // Studio-specific prose variant
        studio: {
          css: {
            '--tw-prose-body': '#e5e5e5',
            '--tw-prose-headings': '#e5e5e5',
            '--tw-prose-lead': '#a3a3a3',
            '--tw-prose-links': 'hsl(45, 93%, 35%)',
            '--tw-prose-bold': '#e5e5e5',
            '--tw-prose-counters': '#666666',
            '--tw-prose-bullets': '#666666',
            '--tw-prose-hr': '#1a1a1a',
            '--tw-prose-quotes': '#e5e5e5',
            '--tw-prose-quote-borders': 'hsl(45, 93%, 35%)',
            '--tw-prose-captions': '#666666',
            '--tw-prose-code': '#e5e5e5',
            '--tw-prose-pre-code': '#a3a3a3',
            '--tw-prose-pre-bg': '#0a0a0a',
            '--tw-prose-th-borders': '#1a1a1a',
            '--tw-prose-td-borders': '#1a1a1a',

            maxWidth: 'none',
            fontSize: '16px',
            lineHeight: '1.7',

            // Enhanced blockquotes for studio theme
            blockquote: {
              borderLeftColor: 'hsl(45, 93%, 35%)',
              backgroundColor: '#111111',
              padding: '1rem 1.5rem',
              borderRadius: '0.5rem',
              border: '1px solid #1a1a1a',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)',
            },

            // Enhanced code blocks
            pre: {
              backgroundColor: '#0a0a0a',
              border: '1px solid #1a1a1a',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3) inset, 0 1px 0px rgba(255, 255, 255, 0.05)',
            },

            // Enhanced tables
            table: {
              backgroundColor: '#111111',
              border: '1px solid #1a1a1a',
              borderRadius: '0.5rem',
              overflow: 'hidden',
            },
          },
        },

        // Compact variant for smaller spaces
        sm: {
          css: {
            fontSize: '14px',
            lineHeight: '1.6',
            h1: { fontSize: '1.875em' },
            h2: { fontSize: '1.25em' },
            h3: { fontSize: '1.125em' },
            'ul, ol': { paddingLeft: '1.25em' },
            p: { marginTop: '1em', marginBottom: '1em' },
          },
        },

        // Large variant for prominent content
        lg: {
          css: {
            fontSize: '18px',
            lineHeight: '1.8',
            h1: { fontSize: '2.5em' },
            h2: { fontSize: '1.75em' },
            h3: { fontSize: '1.375em' },
            'ul, ol': { paddingLeft: '1.75em' },
            p: { marginTop: '1.5em', marginBottom: '1.5em' },
          },
        },
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
  ],
}