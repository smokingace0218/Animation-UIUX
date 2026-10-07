import { useEffect, useRef, type MouseEvent } from "react";

/* The "Flow" wordmark. At rest it is plain white script. On hover a drop
   glides through it F→w, one pass every 1.5 s, looping while the pointer
   stays: a drop and a lagging droplet fused by a goo filter, riding at each
   letter's own height. Every letter fills with its colour as the drop reaches
   it and stays filled while hovered; on leave the colour drains back out. */

const LETTERS = [
  { ch: "F", color: "#28d3ca", height: 0.2 },
  { ch: "l", color: "#59c0ee", height: 0.12 },
  { ch: "o", color: "#7297ff", height: 0.46 },
  { ch: "w", color: "#7851ff", height: 0.46 },
];

const PASS_MS = 1500;
const DRAIN_MS = 650;
const EDGE = 0.08; // fill edge softness, as a fraction of a letter

type Box = { left: number; width: number; centre: number };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);
const glide = (v: number) => 0.5 - 0.5 * Math.cos(Math.PI * v);

function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

export function FlowLogo() {
  const rootRef = useRef<HTMLAnchorElement>(null);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const gooRef = useRef<SVGGElement>(null);
  const dropRef = useRef<SVGCircleElement>(null);
  const dropletRef = useRef<SVGCircleElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);
  const hoverRef = useRef<(on: boolean) => void>(() => {});

  useEffect(() => {
    const root = rootRef.current!;
    const svg = svgRef.current!;
    const goo = gooRef.current!;
    const drop = dropRef.current!;
    const droplet = dropletRef.current!;
    const glow = glowRef.current!;
    const spans = letterRefs.current as HTMLSpanElement[];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    let boxes: Box[] = [];
    let boxH = 0;
    let fontPx = 32;
    const fill = LETTERS.map(() => 0);
    let hovered = false;
    let passStart = 0;
    let lastPass = -1;
    let alpha = 0;
    let frame = 0;
    let last = 0;
    const lag = { x: 0, y: 0 };

    const measure = () => {
      boxH = root.clientHeight;
      fontPx = parseFloat(getComputedStyle(root).fontSize) || 32;
      boxes = spans.map((span) => ({
        left: span.offsetLeft,
        width: span.offsetWidth,
        centre: span.offsetLeft + span.offsetWidth / 2,
      }));
      svg.setAttribute("viewBox", `0 0 ${root.clientWidth} ${boxH}`);
      drop.setAttribute("r", (fontPx * 0.11).toFixed(2));
      droplet.setAttribute("r", (fontPx * 0.065).toFixed(2));
    };

    // the drop's height at x: each letter's own height, eased between centres
    const heightAt = (x: number) => {
      if (x <= boxes[0].centre) return LETTERS[0].height;
      for (let i = 0; i < boxes.length - 1; i++) {
        if (x <= boxes[i + 1].centre) {
          const t = smooth((x - boxes[i].centre) / (boxes[i + 1].centre - boxes[i].centre));
          return LETTERS[i].height + (LETTERS[i + 1].height - LETTERS[i].height) * t;
        }
      }
      return LETTERS[LETTERS.length - 1].height;
    };

    const colourAt = (x: number) => {
      if (x <= boxes[0].centre) return LETTERS[0].color;
      for (let i = 0; i < boxes.length - 1; i++) {
        if (x <= boxes[i + 1].centre) {
          return mix(LETTERS[i].color, LETTERS[i + 1].color, (x - boxes[i].centre) / (boxes[i + 1].centre - boxes[i].centre));
        }
      }
      return LETTERS[LETTERS.length - 1].color;
    };

    const paintLetters = () => {
      spans.forEach((span, i) => {
        // the colour front sweeps left to right across the letter, a little soft
        const front = -EDGE + fill[i] * (1 + 2 * EDGE);
        span.style.setProperty("--fill", `${(front * 100).toFixed(2)}%`);
      });
    };

    const tick = (now: number) => {
      const dt = Math.min(64, now - (last || now));
      last = now;
      if (!boxes.length) measure();

      if (hovered && !reduced.matches) {
        const elapsed = now - passStart;
        const pass = Math.floor(elapsed / PASS_MS);
        const t = (elapsed % PASS_MS) / PASS_MS;
        const start = boxes[0].left;
        const end = boxes[boxes.length - 1].left + boxes[boxes.length - 1].width;
        const x = start + (end - start) * glide(t);
        const y = heightAt(x) * boxH;

        // each pass the droplet starts tucked into the drop, then trails it
        if (pass !== lastPass) {
          lastPass = pass;
          lag.x = x;
          lag.y = y;
        }
        const k = 1 - Math.exp(-dt / 55);
        lag.x += (x - lag.x) * k;
        lag.y += (y - lag.y) * k;
        const dx = lag.x - x;
        const dy = lag.y - y;
        const reach = fontPx * 0.2;
        const dist = Math.hypot(dx, dy);
        if (dist > reach) {
          lag.x = x + (dx / dist) * reach;
          lag.y = y + (dy / dist) * reach;
        }

        boxes.forEach((box, i) => {
          fill[i] = Math.max(fill[i], clamp01((x - box.left) / box.width));
        });

        // fade in at the start of each pass and out at its end
        const edge = Math.min(clamp01(t / 0.08), clamp01((1 - t) / 0.08));
        alpha += (edge - alpha) * (1 - Math.exp(-dt / 40));

        const colour = colourAt(x);
        drop.setAttribute("cx", x.toFixed(2));
        drop.setAttribute("cy", y.toFixed(2));
        droplet.setAttribute("cx", lag.x.toFixed(2));
        droplet.setAttribute("cy", lag.y.toFixed(2));
        goo.setAttribute("fill", colour);
        glow.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
        glow.style.background = `radial-gradient(closest-side, ${colour}, transparent)`;
      } else {
        const step = dt / (hovered ? 260 : DRAIN_MS);
        for (let i = 0; i < fill.length; i++) {
          // reduced motion: letters fill in place without the drop
          fill[i] = hovered ? Math.min(1, fill[i] + step) : Math.max(0, fill[i] - step);
        }
        alpha += (0 - alpha) * (1 - Math.exp(-dt / 60));
      }

      goo.style.opacity = alpha.toFixed(3);
      glow.style.opacity = (alpha * 0.35).toFixed(3);
      paintLetters();

      const settled = !hovered && alpha < 0.002 && fill.every((f) => f === 0);
      if (settled) {
        alpha = 0;
        goo.style.opacity = "0";
        glow.style.opacity = "0";
        frame = 0;
        last = 0;
      } else {
        frame = requestAnimationFrame(tick);
      }
    };

    hoverRef.current = (on: boolean) => {
      if (on === hovered) return;
      hovered = on;
      if (on) {
        passStart = performance.now();
        lastPass = -1;
      }
      if (!frame) frame = requestAnimationFrame(tick);
    };

    measure();
    document.fonts?.ready.then(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    paintLetters();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      hoverRef.current = () => {};
    };
  }, []);

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    location.reload();
  };

  return (
    <a
      ref={rootRef}
      className="flow-logo"
      href="./"
      aria-label="Flow, reload page"
      onClick={onClick}
      onPointerEnter={() => hoverRef.current(true)}
      onPointerLeave={() => hoverRef.current(false)}
      onFocus={() => hoverRef.current(true)}
      onBlur={() => hoverRef.current(false)}
    >
      <span ref={glowRef} className="flow-logo-glow" aria-hidden="true" />
      <span className="flow-logo-word" aria-hidden="true">
        {LETTERS.map((letter, i) => (
          <span
            key={letter.ch}
            ref={(el) => {
              letterRefs.current[i] = el;
            }}
            className="flow-logo-letter"
            style={{ ["--ink" as string]: letter.color }}
          >
            {letter.ch}
          </span>
        ))}
      </span>
      <svg ref={svgRef} className="flow-logo-drop" aria-hidden="true" focusable="false">
        <defs>
          <filter id="flow-logo-goo" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.6" />
            <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" />
          </filter>
        </defs>
        <g ref={gooRef} filter="url(#flow-logo-goo)" style={{ opacity: 0 }}>
          <circle ref={dropletRef} r="2" />
          <circle ref={dropRef} r="3.5" />
        </g>
      </svg>
    </a>
  );
}
