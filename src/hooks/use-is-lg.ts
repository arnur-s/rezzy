import { useEffect, useState } from 'react'

const LG_BREAKPOINT = 1024

export function useIsLg() {
  const [isLg, setIsLg] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`)
    const handleChange = () => setIsLg(query.matches)

    handleChange()
    query.addEventListener('change', handleChange)

    return () => query.removeEventListener('change', handleChange)
  }, [])

  return Boolean(isLg)
}
