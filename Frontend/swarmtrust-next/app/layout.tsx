import type { Metadata } from 'next'
import { Playfair_Display, DM_Sans, Space_Mono } from 'next/font/google'
import './globals.css'

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
  title:       'SwarmTrust — PL Genesis Hackathon 2026',
  description: 'Autonomous robots. Verified trust. Machine payments. No humans required.',
  openGraph: {
    title:       'SwarmTrust',
    description: 'No single point of failure.',
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
      <body>{children}</body>
    </html>
  )
}
