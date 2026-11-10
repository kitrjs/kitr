---
"@kitr/theme": patch
---

Theme transitions show again. `setTheme()` and `toggle()` changed React's state before the browser took the transition's first picture, so the provider's effect wrote the new theme to `<html>` early and both pictures showed it: the circle, diamond, wipe and fade ran over a page that had already changed. The state now changes inside the transition's update, after the first picture. Since 0.8.0 turned CSS transitions off during a theme change this was visible on every page; before, eased colours hid part of it.
