import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { IonicApp } from '@/components/IonicApp'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Money Tracker',
  description: 'Track your finances with ease',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <IonicApp>
          {children}
        </IonicApp>
      </body>
    </html>
  )
}