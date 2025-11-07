import './globals.css'
import "react-day-picker/dist/style.css";
import React from 'react'
import { AuthProvider } from '@/app/contexts/AuthContext'
import ThemeProviderWrapper from './providers/ThemeProvider'

export const metadata = {
  title: 'Hantikaab',
  description: 'Manage your business',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white dark:bg-gray-800 min-h-screen font-sans">
        <ThemeProviderWrapper>
          <AuthProvider>
            <main>{children}</main>
          </AuthProvider>
        </ThemeProviderWrapper>
      </body>
    </html>
  )
}
