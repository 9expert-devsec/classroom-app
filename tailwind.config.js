/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#66CCFF",
          primaryDark: "#0099CC",
          bgSoft: "#F5F8FB",
          text: "#0A1F33",
          textMuted: "#4B5363",
          danger: "#E53935",
          warning: "#FFB347",
          success: "#16C479",
          purple: "#BB9AF9",
          border: "#E3E8EF",
        },
        front: {
          bg: "#FFFFFF",
          bgSoft: "#F5F8FB",
          surface: "#FFFFFF",
          stepBg: "#F5F8FB",
          stepFuture: "#F5F8FB",
          stepDoneBorder: "#66CCFF",
          stepGradientFrom: "#66CCFF",
          stepGradientTo: "#BB9AF9",
          text: "#0A1F33",
          textMuted: "#4B5363",
        },
        admin: {
          bg: "#F5F8FB",
          surface: "#FFFFFF",
          surfaceMuted: "#F5F8FB",
          sidebarBg: "#0A1F33",
          sidebarText: "#F9FAFB",
          border: "#E3E8EF",
          text: "#0A1F33",
          textMuted: "#4B5363",
        },
      },
      boxShadow: {
        card: "0 18px 45px rgba(15, 23, 42, 0.06)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
