---
"@kitr/content": patch
"@kitr/kit-tauri": patch
---

`search()` ranks a whole word above one that only matches inside a longer word, counts a page's title less on each of its sections than on the page itself, and puts a query of several words that appears as typed above pages that only contain those words. Searching `kitr remove` now finds the command instead of every page that mentions kitr. The tauri kit's description points at `platforms/app/src-tauri/src/lib.rs`, where its Rust commands are.
