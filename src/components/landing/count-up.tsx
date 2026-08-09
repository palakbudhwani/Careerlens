import { animate, useInView, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

export function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduced = useReducedMotion()
  const [display, setDisplay] = useState(() => (reduced ? value : 0))

  useEffect(() => {
    if (!inView) return
    if (reduced) {
      setDisplay(value)
      return
    }
    const controls = animate(0, value, {
      duration: 1,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    })
    return () => controls.stop()
  }, [inView, value, reduced])

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  )
}