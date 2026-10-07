# Flow hero

Landing-page hero for "Flow", a fictional productivity app. The page acts out
its tagline: it opens busy (noise) and settles as the visitor moves (Flow),
ending with the copy sharp and Get Started as the clear action.

## Fixed decisions
- Copy, exact: "Everything you need to get your work done, without the noise."
- CTAs: Get Started (primary, white), See how it works (glass). Nothing below them.
- Hero only. No dashboards, cards, icons or invented features.
- Fonts (Google): Mr Dafoe for the logo and "Flow"; Geist for everything else.
- Palette: #19d9bf → #6fb7ff → #7a3cff on #050608.
- Motion glides, never bounces. Respect prefers-reduced-motion.

## Background (already in the repo; use as given, don't modify)
- src/shaders/neuform-isolated/sources/vanguard-dimensional.html: the ThreeUI
  "Dimensional Field" effect, as sourced.
- src/components/LiquidDimensionalField.tsx: my adaptation of it from an earlier
  session. It renders the effect in an iframe and adds liquid glass bubbles,
  cursor response and free drift. It listens for postMessage({ flowOrder: 0..1 })
  and sends { flowPointer } on pointer moves and { flowHello } on load.

## How to work
- Build exactly what the prompt specifies. Don't offer options or ask questions.
- Vite + React + TypeScript, base './', one JS + one CSS bundle.
- Quiet builds (npm run build 2>&1 | tail -3). No screenshots.
- Read only the files you change. Reply in at most 3 lines. Commit each prompt.
