import defaultTheme from "tailwindcss/defaultTheme";
import typographyPlugin from "@tailwindcss/typography";
import formsPlugin from "@tailwindcss/forms";
import headlessuiPlugin from "@headlessui/tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "brand-primary": "rgb(37, 99, 235)",
      },
      fontFamily: {
        sans: ["Inter var", ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [formsPlugin, typographyPlugin, headlessuiPlugin],
};
