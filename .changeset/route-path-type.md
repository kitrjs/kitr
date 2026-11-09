---
"@kitr/router": patch
---

`RoutePath<typeof routes>` is the union of a route table's page paths, as `<Link to>` takes them, so a nav list from data can be typed instead of widened to `string`. The router guide has a "Links from data" section on why a list of concrete paths such as `/docs/agents` does not type-check against `to`, and how `kitr make:page 'docs/$slug'` names its file.
