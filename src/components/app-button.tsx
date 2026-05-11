import { Button, Spinner } from '@heroui/react'
import type { ButtonProps } from '@heroui/react'

type Props = ButtonProps & {
  isLoading?: boolean
}

export const AppButton = ({ children, isLoading, ...props }: Props) => {
  return (
    <Button {...props} isPending={isLoading}>
      {({ isPending }) => (
        <>
          {isPending && <Spinner color="current" size="sm" />}
          {children}
        </>
      )}
    </Button>
  )
}
