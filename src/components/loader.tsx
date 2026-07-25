import { Center } from '@astryxdesign/core/Center'
import { Spinner } from '@astryxdesign/core/Spinner'

type Props = {
  size?: 'sm' | 'md' | 'lg'
}

export function Loader({ size }: Props) {
  return (
    <Center height="100%">
      <Spinner size={size} />
    </Center>
  )
}
