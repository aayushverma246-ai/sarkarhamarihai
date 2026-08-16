'use client'

import { Suspense, lazy, useState, useEffect } from 'react'

const Spline = lazy(() => import('@splinetool/react-spline'))

interface SplineSceneProps {
  scene: string
  className?: string
  emotion?: 'neutral' | 'happy' | 'wow'
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Mobile: bypass heavy WebGL entirely — no fallback, no canvas, zero GPU cost
  if (isMobile) return null

  return (
    <div className="relative w-full h-full min-h-[300px] flex items-center justify-center overflow-hidden">
      <div 
        className={`w-full h-full transition-opacity duration-700 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <Suspense fallback={null}>
          <Spline
            scene={scene}
            className={className}
            onLoad={() => setIsLoaded(true)}
          />
        </Suspense>
      </div>
    </div>
  )
}
