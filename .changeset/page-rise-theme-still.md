---
"@kitr/animation": minor
"@kitr/theme": patch
---

`pageTransitions({ style: 'rise' })`: the old page lifts away and is gone before the new one settles in from just below, and back mirrors it. The two pictures don't blend, so on text-heavy pages, phones especially, the change reads as a move instead of a brief double exposure.

A theme change turns off CSS `transition`s while it runs. The new picture is the live page, so controls with `transition: background-color` (buttons, nav links) faded from the old theme's colours on their own after the rest of the page had changed, and a header full of them looked like it animated separately.
