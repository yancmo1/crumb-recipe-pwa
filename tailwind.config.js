/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
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
        // Legacy kitchen theme (kept for backward compatibility)
        oatmeal: '#F2EFEA',
        blueberry: '#7C8FB2',
        dough: '#E9D8A6',
        sage: '#A3B18A',

        // CrumbWorks LOCKED brand palette (from approved artwork — DO NOT modify)
        // Header bar gradient: #CB3002 → #F85F1E → #E77320 (top → bottom)
        rvOrangeTop: '#CB3002',     // Header gradient top
        rvOrangeMid: '#F85F1E',     // Header gradient mid / CTA start
        rvOrangeBottom: '#E77320',  // Header gradient bottom / accent
        // Sidebar/drawer background
        rvBlue: '#162841',          // Sidebar solid bg
        // Neutral page background
        rvPageBg: '#F7F3EE',        // Warm neutral page bg
        // Neutral text gray
        rvGray: '#53575E',          // Body/structural text
        // Accent/active indicator
        rvAccent: '#E77320',        // Active tab, indicator bar
        // CTA button gradient: #F85F1E → #CB3002 (left → right)
        rvCtaStart: '#F85F1E',      // CTA gradient start
        rvCtaEnd: '#CB3002',        // CTA gradient end
        // Cards
        rvCardBg: '#FFFFFF',        // Card surfaces
        rvInputBg: '#F8F8F8',       // Input field background
        // Backwards compat aliases (map old names to new)
        rvOrange: '#F85F1E',        // Alias for rvOrangeMid
        rvYellow: '#E77320',        // Map old yellow to accent
        rvOrangeEnd: '#CB3002'      // Alias for rvOrangeTop
      },
      boxShadow: {
        'rv-card': '0 2px 8px rgba(0,0,0,0.10)',
        'rv-cta': '0 4px 14px rgba(0,0,0,0.18)',
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [],
}