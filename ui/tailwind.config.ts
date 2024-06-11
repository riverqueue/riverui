import defaultTheme from "tailwindcss/defaultTheme";
import typographyPlugin from "@tailwindcss/typography";
import formsPlugin from "@tailwindcss/forms";
import headlessuiPlugin from "@headlessui/tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      animation: {
        "spin-slow": "spin 3s linear infinite",
        "spin-50-50": "pausingSpin 10s linear infinite",
      },
      colors: {
        "brand-primary": "rgb(37, 99, 235)",
      },
      fontFamily: {
        sans: ["Inter var", ...defaultTheme.fontFamily.sans],
      },
      keyframes: {
        pausingSpin: {
          "0%": {
            transform: "rotate(0)",
            animationTimingFunction: "ease-in-out",
          },
          "15%,50%": { transform: "rotate(180deg)" },
          "50%": {
            transform: "rotate(180deg)",
            animationTimingFunction: "ease-in-out",
          },
          "65%,100%": { transform: "rotate(360deg)" },
        },
      },
    },
  },
  plugins: [formsPlugin, typographyPlugin, headlessuiPlugin],
};
