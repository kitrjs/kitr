import kitrPwa from 'kitr/pwa/vite';
import pwa from './config/pwa';
import { kitr } from 'kitr/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [kitr(), kitrPwa(pwa)],
})