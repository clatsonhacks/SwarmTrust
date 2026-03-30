'use client'

import { useRef, useEffect } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface SpeechBubbleProps {
  message: string
  position: [number, number, number]
  color: string
  duration?: number
  onComplete?: () => void
}

export default function SpeechBubble({
  message,
  position,
  color,
  duration = 2000,
  onComplete
}: SpeechBubbleProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const startTime = useRef(Date.now())
  const opacity = useRef(1)

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.()
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onComplete])

  useFrame(({ clock }) => {
    if (!groupRef.current) return

    const elapsed = Date.now() - startTime.current
    const progress = elapsed / duration

    // Fade out in last 20% of duration
    if (progress > 0.8) {
      opacity.current = 1 - ((progress - 0.8) / 0.2)
    }

    // Float animation
    const t = clock.getElapsedTime()
    groupRef.current.position.y = position[1] + Math.sin(t * 2) * 0.1
  })

  return (
    <group ref={groupRef} position={position}>
      <Html
        center
        distanceFactor={10}
        style={{
          transition: 'all 0.2s',
          pointerEvents: 'none',
          opacity: opacity.current,
        }}
      >
        <div className="speech-bubble" style={{ borderColor: color }}>
          <div className="bubble-content">
            {message}
          </div>
          <div className="bubble-tail" style={{ borderTopColor: color }} />
        </div>

        <style jsx>{`
          .speech-bubble {
            background: rgba(10, 14, 26, 0.95);
            backdrop-filter: blur(12px);
            padding: 12px 16px;
            border-radius: 12px;
            border: 2px solid;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
            min-width: 150px;
            max-width: 250px;
            position: relative;
            animation: bubblePop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          }

          @keyframes bubblePop {
            from {
              transform: scale(0);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }

          .bubble-content {
            color: white;
            font-size: 13px;
            font-family: 'Rajdhani', sans-serif;
            font-weight: 600;
            line-height: 1.4;
            text-align: center;
          }

          .bubble-tail {
            position: absolute;
            bottom: -10px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 10px solid transparent;
            border-right: 10px solid transparent;
            border-top: 10px solid;
          }
        `}</style>
      </Html>
    </group>
  )
}
