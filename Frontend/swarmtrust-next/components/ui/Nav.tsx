'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

export default function Nav() {
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return

    let hidden = false

    const onScroll = () => {
      const pastHero = window.scrollY > window.innerHeight * 0.85
      if (pastHero && !hidden) {
        hidden = true
        nav.style.opacity       = '0'
        nav.style.pointerEvents = 'none'
        nav.style.transform     = 'translateY(-12px)'
      } else if (!pastHero && hidden) {
        hidden = false
        nav.style.opacity       = '1'
        nav.style.pointerEvents = ''
        nav.style.transform     = 'translateY(0)'
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      ref={navRef}
      className="nav"
      id="nav"
      aria-label="Main navigation"
      style={{ transition: 'opacity 0.4s ease, transform 0.4s ease' }}
    >
      <Link className="nav-logo" href="/">
        De<b>Ware</b>
      </Link>

      <ul className="nav-links text-bold">
        <li><a href="#about">Premise</a></li>
        <li><Link href="/warehouse">Simulation</Link></li>
        <li><a href="#">Tracks</a></li>
      </ul>

      <button className="nav-pill" type="button">
        Apply Now
      </button>
    </nav>
  )
}
