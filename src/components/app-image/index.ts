import { AppImagePreviewGroup } from './app-image-group'
import { AppImage as AppImageBase } from './app-image'

export const AppImage = Object.assign(AppImageBase, {
  PreviewGroup: AppImagePreviewGroup,
})

export type { AppImageProps } from './app-image'
export type { RegisteredImage } from './app-image-group'
