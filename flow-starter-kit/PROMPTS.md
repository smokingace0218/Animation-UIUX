# Flow hero: prompts

Setup (before the session): upload the contents of the `starter/` kit to the root of a new repo. It contains `CLAUDE.md` and the background code. Then send these four prompts in order, one message each.

---

## Prompt 1: project, background, header and logo

```
Set up a Vite + React + TypeScript project per CLAUDE.md around the existing src/ files. Render <LiquidDimensionalField /> full-bleed behind a full-height hero section, in a wrapper with position:absolute, inset:0, z-index:-2 and pointer-events:auto.

Header: logo left; centre pill nav (Features, Pricing, Download); Sign in and a white Get Started on the right; a mobile menu sheet.

Logo: "Flow" in Mr Dafoe, white at rest.
- Hover: a drop glides through it F→w, 1.5 s per pass, looping while hovered. It's a drop and a lagging droplet fused by a goo filter (blur 1.6, alpha matrix 0 0 0 20 -8), riding at letter heights 0.2, 0.12, 0.46, 0.46.
- Each letter fills as the drop reaches it and stays filled while hovered: F #28d3ca, l #59c0ee, o #7297ff, w #7851ff, with a faint glow under the drop. On leave it drains back to white.
- Click: preventDefault, then location.reload(). Don't link to "/".
```

## Prompt 2: headline, copy and buttons

```
Hero content, left-aligned:
- "LET YOUR WORK" in tracked uppercase Geist.
- "Flow" in Mr Dafoe at clamp(7.5rem, 16.5vw, 19rem), as one SVG <text><textPath> on a baseline path so the joins never break, filled with the palette gradient. Fit the viewBox to the ink with canvas measureText.
- Pour: a bright copy (white → #63f2dc) clipped to a slanted, wavy stream runs F→w in 2.4 s. It plays 1.3 s after load, then every 3.2–5.2 s, and loops on hover. During a pour the baseline rolls as a gentle sine wave. The logo's drop (same goo, #5ff5df → #6fb7ff) rides just behind the front of the stream.
- The exact copy in Geist 300, max width 34ch, then the two CTAs.
- Get Started on hover and focus: a 1.5 px gradient ring 4 px outside it, plus a halo (blur 14 px, opacity 0.22).
```

## Prompt 3: noise → Flow, check and publish

```
Add an order value from 0 to 1 and send it to the background with postMessage({ flowOrder }). Answer flowHello with the current value.
- It rises over 2.4 s of pointer movement (page pointermove or flowPointer messages), sinks over 7 s when movement stops, and locks at 1. Ease it in and out.
- Set --order and data-state (noise / settling / flow) on the hero.
- Copy: an SVG filter (turbulence + displacement up to 16 + blur up to 1.4) scaled by (1 − order), removed entirely at 1. Copy opacity 0.42 → 1.
- At 1: Get Started scales to 1.06 with a teal/violet glow; See how it works fades to 0.62.
- Focus on a CTA, reduced motion, or touch (after 1.8 s) settles straight to 1.

Then run one headless check on the built bundle: first load, two reloads and a logo click each draw the canvas with a clean console. Publish the built page as an artifact and give me the link.
```

## Prompt 4: process document

```
Write docs/PROCESS.md in under 100 lines:
- the goal and the noise → Flow idea;
- the background's origin (sourced from ThreeUI, adapted by me in an earlier session);
- what each of the 4 prompts did;
- a short table of my design decisions;
- a 3–5 sentence reflection draft marked for me to rewrite.
```

---

**Corrections:** one message, one line per fix, naming the element and the value. For example: "Get Started halo opacity 0.15; drop on o and w at height 0.40."
