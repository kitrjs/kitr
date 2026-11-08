---
'@kitr/jobs': minor
---

`size()` of the memory and Redis jobs drivers counts reserved jobs (pulled, not yet acked) as well as queued ones, so a worker that dies mid-job no longer reads as an empty queue. The memory driver reserves what it hands out and returns a job nobody acked to the queue after `visibilityTimeout` (new option of `createMemoryJobsDriver`, default 30 000 ms), as the Redis driver already did with 300 000 ms.
