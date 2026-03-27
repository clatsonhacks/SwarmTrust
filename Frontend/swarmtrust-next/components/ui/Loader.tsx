'use client'

/**
 * Loader.tsx
 * ─────────────────────────────────────────────────────────────
 * Game-style boot screen shown before the hero loads.
 * Counts 0 → 100%, shows contextual status messages,
 * then fades out and calls onComplete().
 *
 * Why this matters:
 *   R3F / Three.js scenes take a moment to initialise.
 *   This gives the GPU time to compile shaders while
 *   the user sees something intentional, not a blank screen.
 */

import { useEffect, useRef, useState, useCallback } from 'react'

interface LoaderProps {
  onComplete: () => void
}

const BOOT_STEPS = [
  { at: 5,   msg: 'Initialising swarm network…'  },
  { at: 22,  msg: 'Connecting to Base Sepolia…'  },
  { at: 45,  msg: 'Loading ERC-8004 registry…'   },
  { at: 68,  msg: 'Spawning 5 agents…'           },
  { at: 88,  msg: 'x402 payment layer ready…'    },
  { at: 100, msg: 'All systems nominal ◈'         },
]

export default function Loader({ onComplete }: LoaderProps) {
  const [progress, setProgress] = useState(0)
  const [visible,  setVisible]  = useState(true)
  const overlayRef = useRef<HTMLDivElement>(null!)

  const currentMsg = [...BOOT_STEPS]
    .reverse()
    .find(s => progress >= s.at)?.msg ?? ''

  const runComplete = useCallback(async () => {
    const { gsap } = await import('gsap')
    gsap.to(overlayRef.current, {
      opacity: 0,
      duration: 0.75,
      delay: 0.3,
      ease: 'power2.in',
      onComplete: () => {
        setVisible(false)
        onComplete()
      },
    })
  }, [onComplete])

  useEffect(() => {
    const run = async () => {
      const { gsap } = await import('gsap')
      const obj = { v: 0 }
      gsap.to(obj, {
        v: 100,
        duration: 2.6,
        ease: 'power2.inOut',
        onUpdate() {
          setProgress(Math.round(obj.v))
        },
        onComplete: () => { runComplete() },
      })
    }
    run()
  }, [runComplete])

  if (!visible) return null

  return (
    <div
      ref={overlayRef}
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         1000,
        background:     '#05060e',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        fontFamily:     'var(--font-mono, "Space Mono", monospace)',
      }}
    >
      {/* Subtle grid texture */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: `
          linear-gradient(rgba(197,255,43,0.015) 1px, transparent 1px),
          linear-gradient(90deg, rgba(197,255,43,0.015) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
      }} />

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>

        {/* Logo */}
        <div style={{
          fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase',
          color: '#2a2825', marginBottom: '16px',
        }}>
          PL Genesis · Frontiers of Collaboration · 2026
        </div>

        <div style={{
          fontSize: 'clamp(48px, 10vw, 96px)',
          letterSpacing: '-0.04em',
          color: '#ece8e0',
          fontFamily: 'var(--font-serif, "Playfair Display", serif)',
          fontWeight: 700,
          lineHeight: 1,
          marginBottom: '48px',
        }}>
          Swarm
          <span style={{
            color: '#c5ff2b',
            fontStyle: 'italic',
            fontWeight: 400,
          }}>
            Trust
          </span>
          <span style={{ color: '#c5ff2b' }}>.</span>
        </div>

        {/* Progress bar */}
        <div style={{ width: '320px', margin: '0 auto 16px' }}>
          <div style={{
            height: '1px',
            background: 'rgba(255,255,255,0.07)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0,
              height: '100%',
              background: 'linear-gradient(90deg, #3a6600, #c5ff2b)',
              width: `${progress}%`,
              transition: 'width 0.08s linear',
            }} />
          </div>
        </div>

        {/* Status row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '320px',
          margin: '0 auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '5px', height: '5px', borderRadius: '50%',
              background: '#c5ff2b',
              display: 'inline-block',
              animation: 'loaderPulse 1.4s ease-in-out infinite',
            }} />
            <span style={{
              fontSize: '9px', letterSpacing: '0.16em',
              textTransform: 'uppercase', color: '#3a3835',
            }}>
              {currentMsg}
            </span>
          </div>
          <span style={{
            fontSize: '11px', color: '#c5ff2b',
            letterSpacing: '0.06em', fontWeight: 700,
          }}>
            {progress}%
          </span>
        </div>

        {/* Agent colour dots */}
        <div style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'center',
          marginTop: '40px',
          opacity: progress > 60 ? 1 : 0,
          transition: 'opacity 0.5s',
        }}>
          {['#5cc8ff','#c5ff2b','#cc44ff','#ff9b2b','#ff4466'].map((c, i) => (
            <div key={i} style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: c,
              animation: `loaderPulse ${1.2 + i * 0.15}s ease-in-out infinite`,
              animationDelay: `${i * 0.12}s`,
            }} />
          ))}
        </div>

      </div>

      <style>{`
        @keyframes loaderPulse {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.25; }
        }
      `}</style>
    </div>
  )
}
