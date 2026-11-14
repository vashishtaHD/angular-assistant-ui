// @ts-check
const { join } = require('node:path');

/** Tailwind CSS v3 for the demo (picked up by the Angular application builder). */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [join(__dirname, 'src/**/*.{html,ts}')],
  theme: {
    extend: {},
  },
  plugins: [],
};
