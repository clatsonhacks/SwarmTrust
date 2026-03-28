'use client'

import { useEffect } from 'react'

function splitChars(el: HTMLElement): HTMLElement[] {
  const nodes = Array.from(el.childNodes)
  el.innerHTML = ''
  const chars: HTMLElement[] = []
  nodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      Array.from(node.textContent ?? '').forEach(c => {
        if (c === ' ') { el.appendChild(document.createTextNode('\u00a0')); return }
        const sp = document.createElement('span')
        sp.className = 'ch'; sp.textContent = c
        el.appendChild(sp); chars.push(sp)
      })
    } else if (node instanceof HTMLElement) {
      const clone = node.cloneNode(false) as HTMLElement
      Array.from(node.textContent ?? '').forEach(c => {
        const sp = document.createElement('span')
        sp.className = 'ch'; sp.textContent = c
        clone.appendChild(sp); chars.push(sp)
      })
      el.appendChild(clone)
    }
  })
  return chars
}

function wrapWords(el: HTMLElement): HTMLElement[] {
  if (el.querySelector('.wi')) return Array.from(el.querySelectorAll<HTMLElement>('.wi'))
  const words = (el.textContent ?? '').trim().split(/\s+/)
  el.innerHTML = words.map(w =>
    `<span style="display:inline-block;overflow:hidden;margin-right:.3em">` +
    `<span class="wi" style="display:inline-block;transform:translateY(100%)">${w}</span></span>`
  ).join('')
  return Array.from(el.querySelectorAll<HTMLElement>('.wi'))
}

export default function HeroSection() {
  useEffect(() => {
    const run = async () => {
      const { gsap } = await import('gsap')

      const hw1 = document.getElementById('hw1')
      const hw2 = document.getElementById('hw2')
      if (!hw1 || !hw2) return
      if (hw1.children.length > 0) return  // StrictMode guard: already processed

      const hw1Chars = splitChars(hw1)

      const dot = hw2.querySelector<HTMLElement>('.hl-dot')!
      const txt = hw2.firstChild?.textContent ?? ''
      if (hw2.firstChild) hw2.removeChild(hw2.firstChild)
      const hw2Chars: HTMLElement[] = txt.split('').map(c => {
        const sp = document.createElement('span')
        sp.className = 'ch'; sp.textContent = c
        hw2.insertBefore(sp, dot); return sp
      })
      dot.classList.add('ch'); hw2Chars.push(dot)

      const tagEl    = document.getElementById('heroTag')
      const tagWords = tagEl ? wrapWords(tagEl) : []

      const tl = gsap.timeline({ delay: 0.3 })

      tl.to('#nav',       { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, 0.65)
      tl.to('#liveBadge', { opacity: 1, duration: 0.6 }, 1.0)
      tl.to('#eyeLine',   { scaleX: 1,  duration: 0.55, ease: 'power3.out' }, 1.0)
      tl.to('#eyeText',   { y: '0%',    duration: 0.55, ease: 'power3.out' }, 1.12)

      tl.to(hw1Chars, {
        y: '0%', duration: 0.7,
        stagger: { each: 0.042 }, ease: 'power4.out',
      }, 1.45)

      tl.to(hw2Chars, {
        y: '0%', duration: 0.7,
        stagger: { each: 0.038 }, ease: 'power4.out',
      }, 1.70)

      tl.to('#heroFoot', { opacity: 1, duration: 0.6 }, 2.3)
      tl.to(tagWords, {
        y: '0%', duration: 0.55,
        stagger: { each: 0.032 }, ease: 'power3.out',
      }, 2.45)
      tl.to('#heroCta',    { opacity: 1, y: 0, duration: 0.65, ease: 'power3.out' }, 2.75)
      tl.to('#heroScroll', { opacity: 1, duration: 0.8 }, 2.9)
      tl.to(['#cTL', '#cTR'], { opacity: 1, duration: 0.8, stagger: 0.1 }, 3.1)
    }
    run()
  }, [])

  return (
    <section className="hero" id="hero">

      {/* Bee scene is rendered at page level */}
      <div className="hero-canvas-wrap" />
      <div className="hero-vignette" aria-hidden="true" />

      <div className="hero-ui">

        <p className="eyebrow" aria-hidden="true">
          <span className="eyebrow-line" id="eyeLine" />
          <span className="eyebrow-clip">
            <span className="eyebrow-inner" id="eyeText">Autonomous Warehouse — Base Sepolia</span>
          </span>
        </p>

        <h1 className="hero-hl">
          <span className="hl-row"><span className="hl-word italic" id="hw1">DE</span></span>
          <span className="hl-row">
            <span className="hl-word" id="hw2">WARE<span className="hl-dot">.</span></span>
          </span>
        </h1>

        <div className="hero-foot" id="heroFoot" style={{ opacity: 0 }}>
          <p className="hero-tagline" id="heroTag">
            The warehouse runs itself. Five robots coordinate, pay each other, and earn trust on-chain — no human in the loop.
          </p>
          <div className="hero-actions" id="heroCta"
            style={{ opacity: 0, transform: 'translateY(12px)' }}>
            <button className="btn-fill" type="button">Enter Simulation →</button>
            <div className="live-badge-inline" id="liveBadge">
              <span className="live-dot" />5 agents live
            </div>
          </div>
        </div>

      </div>

      <div className="hero-scroll" id="heroScroll" aria-hidden="true">
        <span className="scroll-lbl">Scroll</span>
        <div className="scroll-track" />
      </div>

    </section>
  )
}
