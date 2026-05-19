import type { ButtonProps } from '@heroui/react'
import { Button as ButtonBase, Spinner } from '@heroui/react'

type Props = ButtonProps & {
  isLoading?: boolean
}

export const Button = ({ children, isLoading, ...props }: Props) => {
  return (
    <ButtonBase {...props} isPending={isLoading}>
      {({ isPending }) => (
        <>
          {isPending && <Spinner color="current" size="sm" />}
          {children}
        </>
      )}
    </ButtonBase>
  )
}
