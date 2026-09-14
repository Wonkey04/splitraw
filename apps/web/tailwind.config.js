/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bgPrimary: "var(--bg-primary)",
        bgSecondary: "var(--bg-secondary)",
        bgTertiary: "var(--bg-tertiary)",
        textPrimary: "var(--text-primary)",
        textSecondary: "var(--text-secondary)",
        border: "var(--border)",
        accent: "var(--accent)",
        accentHover: "var(--accent-hover)",
        success: "var(--success)",
        error: "var(--error)",
        warning: "var(--warning)",
      },
      borderRadius: {
        DEFAULT: "6px",
        md: "6px",
        lg: "6px",
        xl: "6px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        h1: ["32px", { lineHeight: "1.2", fontWeight: "700" }],
        h2: ["24px", { lineHeight: "1.3", fontWeight: "600" }],
        h3: ["18px", { lineHeight: "1.4", fontWeight: "600" }],
        body: ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        small: ["12px", { lineHeight: "1.4", fontWeight: "400" }],
        label: ["12px", { lineHeight: "1.3", fontWeight: "500" }],
      },
      spacing: {
        1: "4px",
        2: "8px",
        4: "16px",
        6: "24px",
        8: "32px",
        12: "48px",
      },
      boxShadow: {
        none: "none",
      },
    },
  },
  plugins: [],
};
