import { useEffect, useRef, useState } from 'react'

export function useElementWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [metrics, setMetrics] = useState({ width: 320, fontSize: 18 })
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(() => {
      const width = Math.max(1, Math.floor(element.getBoundingClientRect().width))
      const fontSize = parseFloat(getComputedStyle(element).fontSize) || 18
      setMetrics((previous) => previous.width === width && previous.fontSize === fontSize
        ? previous : { width, fontSize })
    })
    observer.observe(element)
    observer.observe(document.documentElement)
    return () => observer.disconnect()
  }, [])
  return { ref, ...metrics }
}
