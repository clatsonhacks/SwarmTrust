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
        <section className="cta-section">
          <div className="cta-grid">

            {/* LEFT */}
            <div className="cta-inner">
              <p className="cta-eyebrow">Live simulation — Base Sepolia</p>

              <h2 className="cta-hl">
                The warehouse is<br /><em>running right now.</em>
              </h2>

              <div className="cta-stats">
                <div className="cta-stat">
                  <span className="cta-stat-num">5</span>
                  <span className="cta-stat-label">Agents online</span>
                </div>
                <div className="cta-stat">
                  <span className="cta-stat-num" style={{ color: 'var(--accent)' }}>x402</span>
                  <span className="cta-stat-label">Payment protocol</span>
                </div>
                <div className="cta-stat">
                  <span className="cta-stat-num">0</span>
                  <span className="cta-stat-label">Humans required</span>
                </div>
              </div>

              <Link href="/warehouse" className="cta-warehouse">
                Enter Simulation →
              </Link>
            </div>

            {/* RIGHT — execution flow */}
            <ol className="flow-list">
              <li className="flow-row">
                <span className="flow-num">01</span>
                <div className="flow-body">
                  <span className="flow-title">Task queued</span>
                  <span className="flow-desc">Orchestrator pushes task to Redis. Robot agent claims it and sends to Groq LLM for decomposition into sub-tasks.</span>
                </div>
              </li>
              <li className="flow-row">
                <span className="flow-num">02</span>
                <div className="flow-body">
                  <span className="flow-title">Peer discovery</span>
                  <span className="flow-desc">Agent queries the ERC-8004 registry on Base Sepolia. Reads reputation scores. Selects the highest-trust available peer above threshold.</span>
                </div>
              </li>
              <li className="flow-row">
                <span className="flow-num">03</span>
                <div className="flow-body">
                  <span className="flow-title">x402 payment</span>
                  <span className="flow-desc">Agent fires HTTP request to peer endpoint. Receives 402. Signs gasless EIP-3009 USDC transfer. Peer verifies settlement and executes.</span>
                </div>
              </li>
              <li className="flow-row">
                <span className="flow-num">04</span>
                <div className="flow-body">
                  <span className="flow-title">Reputation update</span>
                  <span className="flow-desc">On completion, delegating robot writes success or failure signal on-chain. Full decision log uploaded immutably to Storacha / IPFS.</span>
                </div>
              </li>
            </ol>

          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
