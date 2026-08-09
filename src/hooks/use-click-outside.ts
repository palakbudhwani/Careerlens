import { useEffect, type RefObject } from 'react'

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onOutsideClick: () => void,
) {
  useEffect(() => {
    const handler = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (ref.current && !ref.current.contains(target)) {
        onOutsideClick()
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [ref, onOutsideClick])
}