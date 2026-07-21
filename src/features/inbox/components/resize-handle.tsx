type Props = {
  onMouseDown: (e: React.MouseEvent) => void
}

export function ResizeHandle({ onMouseDown }: Props) {
  return (
    <div
      className="hidden h-full w-1 cursor-col-resize bg-border/60 transition-colors hover:bg-accent/40 md:block active:bg-accent/40"
      onMouseDown={onMouseDown}
    />
  )
}
