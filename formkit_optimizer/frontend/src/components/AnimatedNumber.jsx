import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'

export default function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0, duration = 1200, className = '' }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  const prevValue = useRef(0)

  useEffect(() => {
    if (value === undefined || value === null) return
    const start = prevValue.current
    const end = Number(value)
    const startTime = performance.now()

    function animate(now) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = start + (end - start) * eased
      setDisplay(current)
      if (progress < 1) {
        ref.current = requestAnimationFrame(animate)
      } else {
        prevValue.current = end
      }
    }

    ref.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(ref.current)
  }, [value, duration])

  const formatted = display.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return (
    <span className={clsx('tabular-nums', className)}>
      {prefix}{formatted}{suffix}
    </span>
  )
}
