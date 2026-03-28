import type { Metadata } from 'next'
import { Playfair_Display, DM_Sans, Space_Mono } from 'next/font/google'
import './globals.css'
import Cursor from '@/components/ui/Cursor'

// ── Font definitions ──────────────────────────────────────────────
// Each font gets a CSS variable so globals.css can reference it.
const playfair = Playfair_Display({
  subsets:  ['latin'],
  weight:   ['400', '700', '900'],
  style:    ['normal', 'italic'],
  variable: '--font-playfair',
  display:  'swap',
})

const dmSans = DM_Sans({
  subsets:  ['latin'],
  weight:   ['300', '400', '500'],
  variable: '--font-dm-sans',
  display:  'swap',
})

const spaceMono = Space_Mono({
  subsets:  ['latin'],
  weight:   ['400', '700'],
  style:    ['normal', 'italic'],
  variable: '--font-space-mono',
  display:  'swap',
})

export const metadata: Metadata = {
  title:       'DeWare — Autonomous Decentralized Warehouse',
  description: 'Five robots. No humans. No master node. The warehouse runs itself.',
  openGraph: {
    title:       'DeWare',
    description: 'Five robots. No humans. No master node.',
    type:        'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${dmSans.variable} ${spaceMono.variable}`}
    >
      <body>
        <Cursor />
        {children}
      </body>
    </html>
  )
}
