import { defineConfig } from '@kitr/devtools'

export default defineConfig({
  // Default: development only. true also ships it in production builds.
  // enabled: true,
  trigger: 'auto', // 'auto' | 'hover' | 'hidden'
  position: 'bottom-left', // where the trigger starts; it can be dragged
  dock: 'bottom', // 'bottom' | 'right' on desktop
  theme: 'auto', // 'auto' | 'light' | 'dark'
  shortcut: 'k', // ctrl/cmd+shift+<key>, or a full combo such as ['Meta', 'Shift', 'K']
  touchGesture: true, // three-finger long press on touch screens
  urlFlag: 'kitr-devtools', // ?kitr-devtools opens it even when the trigger is hidden
  maxEntries: 500,
})
