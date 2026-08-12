import { cn } from '@/lib/cn'
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
  focus: 'focus-visible:ring-2 focus-visible:ring-accent',
  transition: 'transition motion-reduce:transition-none',
  press: 'active:scale-[0.98]',
  hover: 'hover:bg-primary/4',
  selected: 'bg-primary/10 text-primary',
  // `/70`, not `/60`: at 60% the primary tone composites to roughly 4.16:1 on
  // the pane, under the 4.5:1 this text has to clear. It is the resting state
  // of every unselected row in the app, so it is the most-read tone here.
  unselected: 'text-primary/70 hover:bg-primary/4 hover:text-primary',
  // Data-attribute variants for rows that reflect selection via data-selected
  data: {
    hover: 'data-[selected=false]:hover:bg-primary/4',
    selected: 'data-[selected=true]:bg-primary/10',
    focus: 'data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-accent',
  },
} as const

function getItemClass(size: ListSize, isActive?: boolean) {
  return cn(
    'flex w-full items-center text-sm outline-none',
    listItemStyle.transition,
    listItemStyle.press,
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
