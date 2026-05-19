import { Image as ImageBase } from './image'
import { ImagePreviewGroup } from './image-group'

export const Image = Object.assign(ImageBase, {
  PreviewGroup: ImagePreviewGroup,
})

export type { ImageProps } from './image'
export type { RegisteredImage } from './image-group'
