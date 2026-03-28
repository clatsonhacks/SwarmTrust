'use client'

/**
 * page.tsx — Landing Page
 * ─────────────────────────────────────────────────────────────
 * The main landing page with:
 *   - Flying bee animation that follows scroll
 *   - Hero section with headlines
 *   - About section
 *   - CTA to warehouse simulation
 */

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import Loader from '@/components/ui/Loader'
import Nav from '@/components/ui/Nav'
import HeroSection from '@/components/ui/HeroSection'
import Ticker from '@/components/ui/Ticker'
import AboutSection from '@/components/ui/AboutSection'
import Footer from '@/components/ui/Footer'

const BeeScene = dynamic(() => import('@/components/scene/BeeScene'), { ssr: false })

export default function Home() {
  const [loaded, setLoaded] = useState(false)

  return (
    <>
      {!loaded && <Loader onComplete={() => setLoaded(true)} />}

      <Nav />

      {/* Bee flies in the background, following scroll */}
      <BeeScene />

      <main className="landing-content">
        <HeroSection />
        <Ticker />
        <AboutSection />

        {/* CTA Section to Warehouse */}
        <section className="section-fullheight" style={{ textAlign: 'center' }}>
          <div>
            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(32px, 5vw, 56px)',
              fontWeight: 700,
              marginBottom: '24px',
              color: 'var(--t-hi)',
            }}>
              See the Swarm in Action
            </h2>
            <p style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '16px',
              color: 'var(--t-mid)',
              maxWidth: '480px',
              margin: '0 auto 32px',
              lineHeight: 1.7,
            }}>
              Watch autonomous agents collaborate, negotiate, and build trust
              in real-time within our warehouse simulation.
            </p>
            <Link href="/warehouse" className="cta-warehouse">
              Enter Warehouse Simulation →
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
