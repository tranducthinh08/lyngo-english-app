import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      boxShadow: {
        '2xs': '0 1px 2px 0 rgba(67, 20, 7, 0.05)',
        'xs': '0 1px 3px 0 rgba(67, 20, 7, 0.08), 0 1px 2px -1px rgba(67, 20, 7, 0.08)',
        'subtle': '0 2px 8px -2px rgba(67, 20, 7, 0.08), 0 1px 4px -1px rgba(67, 20, 7, 0.04)',
        'card': '0 10px 25px -5px rgba(67, 20, 7, 0.08), 0 8px 10px -6px rgba(67, 20, 7, 0.04)',
        'modal': '0 25px 50px -12px rgba(67, 20, 7, 0.25), 0 0 0 1px rgba(251, 146, 60, 0.15)',
      },
      backdropBlur: {
        'xs': '2px',
      },
    },
  },
  plugins: [],
};
export default config;
