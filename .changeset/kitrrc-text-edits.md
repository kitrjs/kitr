---
"@kitr/cli": patch
---

`kitr add`, `kitr remove`, `kitr platforms` and `kitr config` edit `kitrrc.ts` as text instead of reprinting it, so comments, quote style, tabs, the order of providers and renamed platform imports (`web as webPlatform`) stay as you wrote them. Removing a platform no longer drops a provider another platform still uses when its factory is imported under another name.
