---
'@kitr/realtime': minor
'@kitr/cache': minor
'@kitr/jobs': minor
'@kitr/shield': minor
'@kitr/api': minor
'@kitr/uploads': minor
---

Run on more than one instance. Realtime servers take an `adapter`, and `createRedisRealtimeAdapter` carries emits (and SSE control POSTs) between instances. New Redis drivers: `createRedisCacheDriver`, `createRedisJobsDriver` (reserved pulls, a visibility timeout, and scheduled jobs queued once across workers through the new optional `claim`), and `createRedisRateLimitStore`, which `rateLimit()` from `kitr/api` now accepts as `store`. Uploads gain `createUnstorageUploadsDriver` for S3, R2 and other object storage. In-memory defaults are unchanged.
