import { cn } from '@heroui/styles'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
}

export function TypographyHeading1({ children }: Props) {
  return (
    <h1 className="scroll-m-20 text-center text-4xl font-extrabold tracking-tight text-balance">
      {children}
    </h1>
  )
}

export function TypographyHeading2({ children }: Props) {
  return (
    <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
      {children}
    </h2>
  )
}

export function TypographyHeading3({ children }: Props) {
  return (
    <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
      {children}
    </h3>
  )
}

export function TypographyHeading4({ children, className }: Props) {
  return (
    <h4
      className={cn(
        'scroll-m-20 text-xl font-semibold tracking-tight',
        className,
      )}
    >
      {children}
    </h4>
  )
}

export function TypographyHeading5({ children, className }: Props) {
  return (
    <h5 className={cn('text-sm font-semibold tracking-tight', className)}>
      {children}
    </h5>
  )
}

export function TypographyHeading6({ children }: Props) {
  return <h6 className="text-xs font-semibold tracking-tight">{children}</h6>
}

export function TypographyParagraph({ children }: Props) {
  return <p className="leading-7 not-first:mt-6">{children}</p>
}

export function TypographyBlockquote({ children }: Props) {
  return (
    <blockquote className="mt-6 border-l-2 pl-6 italic">{children}</blockquote>
  )
}

export function TypographyList({ children }: Props) {
  return <ul className="my-6 ml-6 list-disc [&>li]:mt-2">{children}</ul>
}

export function TypographyInlineCode({ children }: Props) {
  return (
    <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold">
      {children}
    </code>
  )
}

export function TypographyLead({ children }: Props) {
  return <p className="text-xl text-muted-foreground">{children}</p>
}

export function TypographyLarge({ children }: Props) {
  return <div className="text-lg font-semibold">{children}</div>
}

export function TypographySmall({ children }: Props) {
  return <small className="text-sm leading-none font-medium">{children}</small>
}

export function TypographyMuted({ children, className }: Props) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)}>{children}</p>
  )
}
