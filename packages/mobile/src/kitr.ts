import { definePackage } from '@kitr/core/package'
import { mobile } from './index'

/** The mobile platform as a package: `kitr add mobile phone --targets ios,android`. */
export default definePackage({
  name: 'mobile',
  kind: 'platform',
  client: true,
  requires: ['vite', 'router', 'platform', 'storage'],
  platform: { factory: mobile, export: 'mobile', from: '@kitr/mobile', defaultName: 'phone' },
  eject: { '@kitr/mobile': '@capacitor/core + @capacitor/app + @capacitor/preferences' },
})
