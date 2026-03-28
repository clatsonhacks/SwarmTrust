'use client'

import { useEffect, useRef } from 'react'

/**
 * Cursor.tsx
 * ─────────────────────────────────────────────────────────────
 * Custom cursor: a small dot that follows immediately,
 * and a larger ring that lags behind (GSAP lerp).
 *
 * Expands on hover over interactive elements.
 * Injected once at the root layout level.
 */
export default function Cursor() {
  const ringRef = useRef<HTMLDivElement>(null!)
  const dotRef  = useRef<HTMLDivElement>(null!)

  useEffect(() => {
    const ring = ringRef.current
    const dot  = dotRef.current
    if (!ring || !dot) return

    let mouseX = window.innerWidth  / 2
    let mouseY = window.innerHeight / 2
    let ringX  = mouseX
    let ringY  = mouseY
    let rafId  = 0

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
      dot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`
    }

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t

    const loop = () => {
      ringX = lerp(ringX, mouseX, 0.1)
      ringY = lerp(ringY, mouseY, 0.1)
      ring.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`
      rafId = requestAnimationFrame(loop)
    }

    const onEnter = () => document.body.classList.add('cursor-hover')
    const onLeave = () => document.body.classList.remove('cursor-hover')

    document.addEventListener('mousemove', onMove)
    document.querySelectorAll('a, button').forEach(el => {
      el.addEventListener('mouseenter', onEnter)
      el.addEventListener('mouseleave', onLeave)
    })

    loop()

    return () => {
      document.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <>
      <div ref={ringRef} className="c-ring" aria-hidden="true" />
      <div ref={dotRef}  className="c-dot"  aria-hidden="true" />
    </>
  )
}
