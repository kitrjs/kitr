import { copyFileSync, mkdirSync } from 'node:fs'

mkdirSync('styles', { recursive: true })
copyFileSync('../ui/styles.css', 'styles/ui.css')
copyFileSync('../tailwind/preset.css', 'styles/tailwind-preset.css')
