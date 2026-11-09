---
"@kitr/theme": patch
"@kitr/animation": patch
"@kitr/analytics": patch
---

Theme change animations run at their own speed. `@kitr/animation/page-transitions.css` cut every root view transition to 180ms, theme changes included; its fallback now skips a theme change. The default theme transition `duration` is `600`, and `circle` and `diamond` grow only as far as the viewport corner farthest from where they start (`--kitr-theme-transition-radius` and `--kitr-theme-transition-reach`), so the whole animation happens on screen.

`googleAnalytics()` sends what `gtag.js` reads. It pushed arrays to `dataLayer`, which `gtag.js` ignores, so no hits reached Google; it now pushes the `arguments` object the way Google's snippet does. It also sets the Consent Mode v2 default first: `analytics_storage` granted, and the ad signals denied unless you pass `ads: true`.
