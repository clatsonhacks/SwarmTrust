'use client'

import Link from 'next/link'

export default function Nav() {
  return (
    <nav className="nav" id="nav" aria-label="Main navigation">
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
