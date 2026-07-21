/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0B0F14",
        "bg-secondary": "#111827",
        primary: "#2563EB",
        "text-primary": "#F9FAFB",
        "text-secondary": "#9CA3AF",
        success: "#22C55E",
        error: "#EF4444",
      },
      borderRadius: {
        DEFAULT: "8px",
      },
      fontFamily: {
        sans: ["Inter", "Arial", "Helvetica", "sans-serif"],
      },
    },
  },
  plugins: [],
};
