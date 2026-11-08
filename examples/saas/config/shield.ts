import { defineConfig } from '@kitr/shield'

export default defineConfig({
  headers: {}, // sensible security headers; set contentSecurityPolicy to tighten
  cors: false, // { origin: ['https://app.example.com'], credentials: true } for a separate front end
  rateLimit: { max: 300, windowMs: 60_000 }, // per IP per minute
  csrf: {}, // double-submit cookie; @kitr/http sends the token on every non-GET request
})
