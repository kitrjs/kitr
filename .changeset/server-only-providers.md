---
'@kitr/core': minor
'@kitr/vite': minor
'@kitr/cli': patch
'@kitr/analytics': patch
'@kitr/auth': patch
'@kitr/http': patch
'@kitr/monitoring': patch
'@kitr/platform': patch
'@kitr/query': patch
'@kitr/storage': patch
'@kitr/cache': patch
'@kitr/jobs': patch
'@kitr/shield': patch
'@kitr/uploads': patch
---

Smaller browser bundles. A package can mark its provider `provider: { client: false }` and `@kitr/vite` leaves it out of the browser's provider list (cache, jobs, shield and uploads do); the devtools panels of every provider are dropped from production builds that do not ship `@kitr/devtools`. `kitr dev` names the generated type files it wrote with paths relative to the project.
