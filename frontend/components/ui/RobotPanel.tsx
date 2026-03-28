'use client'

import { Suspense, lazy } from 'react'

const Spline = lazy(() => import('@splinetool/react-spline'))

export default function RobotPanel() {
  return (
    <div className="dept-robot-panel">
      <Suspense
        fallback={
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="dept-robot-loader" />
          </div>
        }
      >
        <Spline
          scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
          style={{ width: '100%', height: '100%' }}
        />
      </Suspense>
    </div>
  )
}
