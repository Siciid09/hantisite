/** @type {import('tailwindcss').Config} */
module.exports = {
  future: { 'disableColorOpacityUtilities': true },
  // This line is essential for next-themes to work
  darkMode: 'class',

  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
       // Using var() to link to CSS variables set by next-themes/RootLayout if needed,
       // or directly defining colors. Directly defining is simpler here.
      colors: {
        // --- Light Mode Colors ---
        'sidebar': '#FFFFFF',          // bg-sidebar
        'text': '#111827',             // text-text (gray-900)
        'primary': '#3B82F6',         // bg-primary (blue-500)
        'primary-light': '#EFF6FF',   // bg-primary-light (blue-50)
        'background': '#F9FAFB',     // bg-background (gray-50) - Changed from E4E9F7 for standard tailwind
        'card': '#FFFFFF',             // bg-card
        'muted': '#6B7280',            // text-muted (gray-500)
        'toggle': '#D1D5DB',           // bg-toggle (gray-300)
        'red-alert': '#EF4444',        // bg-red-alert (red-500)
        'red-alert-hover': '#DC2626', // bg-red-alert-hover (red-600)
        'border': '#E5E7EB',           // border color (gray-200)

        // --- Dark Mode Colors ---
        'sidebar-dark': '#111827',      // dark:bg-sidebar-dark (gray-900)
        'text-dark': '#F9FAFB',         // dark:text-text-dark (gray-50)
        'primary-dark': '#1F2937',      // dark:bg-primary-dark (gray-800) - Adjusted for contrast
        'primary-light-dark': '#374151', // dark:bg-primary-light-dark (gray-700) - Search/Mode bg
        'background-dark': '#000000',    // dark:bg-background-dark (black)
        'card-dark': '#1F2937',          // dark:bg-card (gray-800)
        'muted-dark': '#9CA3AF',         // dark:text-muted-dark (gray-400)
        'toggle-dark': '#4B5563',        // dark:bg-toggle-dark (gray-600)
        'red-alert-dark': '#F87171',    // dark:bg-red-alert-dark (red-400)
        'red-alert-hover-dark': '#EF4444',// dark:bg-red-alert-hover-dark (red-500)
        'border-dark': '#374151',        // dark:border-dark (gray-700)
      },
       fontFamily: {
         // Assuming you set up Roboto in app/layout.tsx using next/font
         sans: ['var(--font-roboto)', 'sans-serif'],
       },
       transitionProperty: {
         'width': 'width',
         'margin': 'margin-left',
       },
    },
  },
  plugins: [],
}

