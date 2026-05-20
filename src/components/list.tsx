import { cn } from '@heroui/styles'
import { Children, cloneElement, createContext, isValidElement, useContext } from 'react'
import type { ReactElement, ReactNode } from 'react'

type ListSize = 'sm' | 'md'

const ListContext = createContext<{ size: ListSize }>({ size: 'sm' })

interface ListProps {
  children: ReactNode
  size?: ListSize
  className?: string
}

interface ListItemProps {
  children: ReactNode
  isActive?: boolean
  className?: string
}

export const listItemStyle = {
  sm: 'gap-2 rounded-md px-2 py-1.5',
  md: 'gap-3 rounded-lg px-2 py-2',
  focus: 'focus-visible:ring-2 focus-visible:ring-ring',
  transition: 'transition-colors motion-reduce:transition-none',
  hover: 'hover:bg-foreground/4',
  selected: 'bg-foreground/10 text-foreground',
  unselected: 'text-foreground/60 hover:bg-foreground/4 hover:text-foreground',
  // Data-attribute variants for HeroUI ListBox
  data: {
    hover: 'data-[selected=false]:hover:bg-foreground/4',
    selected: 'data-[selected=true]:bg-foreground/10',
    focus: 'data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-ring',
  },
} as const

function getItemClass(size: ListSize, isActive?: boolean) {
  return cn(
    'flex w-full items-center text-sm outline-none',
    listItemStyle.transition,
    listItemStyle.focus,
    listItemStyle[size],
    isActive === true && listItemStyle.selected,
    isActive === false && listItemStyle.unselected,
    isActive === undefined && listItemStyle.hover,
  )
}

function ListItem({ children, isActive, className }: ListItemProps) {
  const { size } = useContext(ListContext)
  const itemClass = getItemClass(size, isActive)
  const childArray = Children.toArray(children)
  const first = childArray[0]

  if (isValidElement(first)) {
    const typed = first as ReactElement<{ className?: string }>
    return (
      <li className={className}>
        {cloneElement(typed, {
          className: cn(itemClass, typed.props.className),
        })}
        {childArray.slice(1)}
      </li>
    )
  }

  return <li className={cn(itemClass, className)}>{children}</li>
}

export function List({ children, size = 'sm', className }: ListProps) {
  return (
    <ListContext.Provider value={{ size }}>
      <ul className={cn('flex flex-col gap-0.5', className)}>{children}</ul>
    </ListContext.Provider>
  )
}

List.Item = ListItem
