'use client'

/**
 * AboutSection.tsx
 * ─────────────────────────────────────────────────────────────
 * Scroll-triggered GSAP animations:
 *   • Section index label slides up + line extends
 *   • About headline: char-by-char per line, triggered on scroll
 *   • Stats: stagger up
 *   • Body copy: fade + rise
 *   • Tags: stagger fade
 *   • Pull-quote: slide in from left
 *
 * Uses IntersectionObserver so GSAP runs only when
 * the section enters the viewport — no ScrollTrigger plugin needed.
 */

import { useEffect, useRef } from 'react'

// ── Manual char splitter (same logic as HeroSection) ────────
function splitLineChars(line: HTMLElement): HTMLElement[] {
  const childNodes = Array.from(line.childNodes)
  line.innerHTML = ''
  const chars: HTMLElement[] = []

  childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      Array.from(node.textContent ?? '').forEach(c => {
        if (c === ' ') { line.appendChild(document.createTextNode(' ')); return }
        const sp = document.createElement('span')
        sp.className = 'ch'; sp.textContent = c
        line.appendChild(sp); chars.push(sp)
      })
    } else if (node instanceof HTMLElement) {
      // wrap <em> children
      const clone = node.cloneNode(false) as HTMLElement
      Array.from(node.textContent ?? '').forEach(c => {
        if (c === ' ') { clone.appendChild(document.createTextNode(' ')); return }
        const sp = document.createElement('span')
        sp.className = 'ch'; sp.textContent = c
        clone.appendChild(sp); chars.push(sp)
      })
      line.appendChild(clone)
    }
  })
  return chars
}

export default function AboutSection() {
  const sectionRef = useRef<HTMLElement>(null!)
  const animated   = useRef(false)

  useEffect(() => {
    const run = async () => {
      const { gsap } = await import('gsap')

      // Split about headline lines
      const hlLines = document.querySelectorAll<HTMLElement>('.ahl-line')
      if (hlLines[0]?.children.length > 0) return  // StrictMode guard
      const lineCharArrays: HTMLElement[][] = []
      hlLines.forEach(line => {
        lineCharArrays.push(splitLineChars(line))
      })

      // IntersectionObserver fires animations when section is visible
      const observer = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting && !animated.current) {
              animated.current = true
              observer.disconnect()

              const tl = gsap.timeline()

              // Section index label + line
              tl.to('#secIdx',  { y: '0%',   duration: 0.65, ease: 'power3.out' }, 0)
              tl.to('#secLine', { scaleX: 1,  duration: 0.9,  ease: 'power3.out' }, 0.1)

              // About headline: line by line, chars stagger
              lineCharArrays.forEach((chars, li) => {
                tl.to(chars, {
                  y: '0%',
                  duration: 0.65,
                  stagger: { each: 0.02 },
                  ease: 'power4.out',
                }, 0.15 + li * 0.14)
              })

              // Stats rows
              tl.to('.stat-row', {
                y: 0, opacity: 1, duration: 0.65,
                stagger: 0.12, ease: 'power3.out',
              }, 0.5)

              // Body copy
              tl.to('.about-body', {
                y: 0, opacity: 1, duration: 0.9,
                ease: 'power3.out',
              }, 0.55)

              // Pull-quote
              tl.to('.about-quote', {
                x: 0, opacity: 1, duration: 0.85,
                ease: 'power3.out',
              }, 0.7)

              // Tags
              tl.to('.tag', {
                opacity: 1, y: 0, duration: 0.4,
                stagger: 0.055, ease: 'power2.out',
              }, 0.85)
            }
          })
        },
        { threshold: 0.15 }
      )

      if (sectionRef.current) observer.observe(sectionRef.current)

      // Set initial hidden states
      gsap.set('.stat-row',    { y: 20, opacity: 0 })
      gsap.set('.about-body',  { y: 28, opacity: 0 })
      gsap.set('.about-quote', { x: -20, opacity: 0 })
      gsap.set('.tag',         { opacity: 0, y: 8 })
    }

    run()
  }, [])

  return (
    <section className="about" id="about" ref={sectionRef}>
      <span className="about-bg-word" aria-hidden="true">Ware.</span>

      {/* Section index */}
      <p className="sec-idx">
        <span className="sec-idx-clip">
          <span className="sec-idx-inner" id="secIdx">01 — Premise</span>
        </span>
        <span className="sec-idx-line" id="secLine" />
      </p>

      <div className="about-grid">

        {/* ── LEFT: Headline + Stats ── */}
        <div>
          <h2 className="about-hl">
            <span className="ahl-line">No center.</span>
            <span className="ahl-line">No single</span>
            <span className="ahl-line">
              point of <em>failure.</em>
            </span>
          </h2>

        </div>

        {/* ── RIGHT: Body + Quote + Tags ── */}
        <div>
          <div className="about-body">
            <p>
              Each robot runs an independent process with its own <strong>ERC-8004
              on-chain identity</strong>, a wallet holding testnet USDC, and a
              decision loop that polls for tasks, queries peer reputation, and
              delegates sub-tasks — all without a central controller.
            </p>

            <blockquote className="about-quote">
              "Robot A doesn't ask permission.<br />
              It checks the chain, pays Robot B, and moves on."
            </blockquote>

            <p>
              When a robot needs a peer, it reads{' '}
              <strong>on-chain reputation scores</strong> from the ERC-8004
              registry, selects the highest-trust available agent, and fires an{' '}
              <strong>x402 HTTP payment</strong> — a gasless EIP-3009 USDC
              transfer — before the sub-task executes. Every decision is logged
              immutably to <strong>Storacha / IPFS</strong>.
            </p>
          </div>

        </div>

      </div>
    </section>
  )
}
