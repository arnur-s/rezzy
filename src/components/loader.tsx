import type { SpinnerRootProps } from '@heroui/react'
import { Spinner } from '@heroui/react'

type Props = SpinnerRootProps

export function Loader({ size }: Props) {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner size={size} />
    </div>
  )
}
