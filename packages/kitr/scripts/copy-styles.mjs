import { copyFileSync, mkdirSync } from 'node:fs'

mkdirSync('styles', { recursive: true })
copyFileSync('../theme/styles.css', 'styles/theme.css')
copyFileSync('../tailwind/preset.css', 'styles/tailwind-preset.css')
