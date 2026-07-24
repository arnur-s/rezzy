type Props = {
  onMouseDown: (e: React.MouseEvent) => void
}

/**
 * The gutter between the list and thread panes, and the drag affordance for
 * resizing the list. Transparent at rest so the canvas shows through as the
 * pane gap; a grip fades in on hover/drag.
 */
export function ResizeHandle({ onMouseDown }: Props) {
  return (
    <div
      className="group hidden h-full w-2 cursor-col-resize items-center justify-center md:flex"
      onMouseDown={onMouseDown}
    >
      <span
        aria-hidden
        className="bg-foreground/0 group-hover:bg-foreground/20 group-active:bg-foreground/30 h-8 w-0.5 rounded-full transition-colors motion-reduce:transition-none"
      />
    </div>
  )
}
