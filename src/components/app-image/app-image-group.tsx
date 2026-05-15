import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react'
import { AppImagePreview } from './app-image-preview'

export type RegisteredImage = {
  src: string
  alt: string
  downloadable?: boolean
}

export type AppImageGroupContextValue = {
  register: (id: string, image: RegisteredImage) => void
  unregister: (id: string) => void
  openPreview: (
    id: string,
    triggerRef: React.RefObject<HTMLButtonElement | null>,
  ) => void
}

export const AppImageGroupContext =
  createContext<AppImageGroupContextValue | null>(null)

export function useAppImageGroup() {
  return useContext(AppImageGroupContext)
}

type Props = {
  children: React.ReactNode
  downloadable?: boolean
}

export function AppImagePreviewGroup({ children, downloadable = true }: Props) {
  const [images, setImages] = useState<Map<string, RegisteredImage>>(new Map())
  const [previewState, setPreviewState] = useState({
    isOpen: false,
    activeIndex: 0,
  })
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const register = useCallback((id: string, image: RegisteredImage) => {
    setImages((prev) => new Map(prev).set(id, image))
  }, [])

  const unregister = useCallback((id: string) => {
    setImages((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  const openPreview = useCallback(
    (id: string, ref: React.RefObject<HTMLButtonElement | null>) => {
      const keys = Array.from(images.keys())
      const index = keys.indexOf(id)
      if (index === -1) return
      triggerRef.current = ref.current
      setPreviewState({ isOpen: true, activeIndex: index })
    },
    [images],
  )

  const handleClose = useCallback(() => {
    setPreviewState((prev) => ({ ...prev, isOpen: false }))
    triggerRef.current?.focus()
  }, [])

  const handleNavigate = useCallback((index: number) => {
    setPreviewState((prev) => ({ ...prev, activeIndex: index }))
  }, [])

  const imageArray = Array.from(images.values())
  const effectiveDownloadable =
    imageArray.length > 0
      ? (imageArray[previewState.activeIndex]?.downloadable ?? downloadable)
      : downloadable

  return (
    <AppImageGroupContext.Provider value={{ register, unregister, openPreview }}>
      {children}
      <AppImagePreview
        images={imageArray}
        activeIndex={previewState.activeIndex}
        isOpen={previewState.isOpen}
        onClose={handleClose}
        onNavigate={handleNavigate}
        downloadable={effectiveDownloadable}
      />
    </AppImageGroupContext.Provider>
  )
}
