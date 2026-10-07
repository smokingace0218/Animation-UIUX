import { useEffect, useRef, useState } from "react";

/* The headline "Flow": one <text><textPath> on a baseline path, so the
   script's joins never break. The viewBox is fitted to the ink with canvas
   measureText. A pour sweeps through it now and then: a bright copy clipped
   to a slanted, wavy stream runs F→w while the baseline rolls as a gentle
   sine, and the logo's drop rides just behind the stream's front. */

const UNITS = 200; // font size in viewBox units
const WORD = "Flow";
const HEIGHTS = [0.2, 0.12, 0.46, 0.46]; // drop height per letter, top → bottom of the ink
const POUR_MS = 2400;
const FIRST_POUR_MS = 1300;
const GAP_MIN_MS = 3200;
const GAP_SPREAD_MS = 2000;
const ROLL = 0.035 * UNITS; // baseline wave amplitude at the pour's peak
const SLANT = 0.32 * UNITS; // how far the stream's top leads its bottom
const BAND = 0.62 * UNITS; // stream width
const BEHIND = 0.07 * UNITS; // drop distance behind the front
const DROP_R = 0.045 * UNITS;
const DROPLET_R = 0.028 * UNITS;
const SAMPLES = 72;

type Geo = {
  x: number;
  y: number;
  w: number;
  h: number;
  inkLeft: number;
  inkRight: number;
  ascent: number;
  descent: number;
  advance: number;
  centres: number[];
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);
const glide = (v: number) => 0.5 - 0.5 * Math.cos(Math.PI * v);

function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

function measure(): Geo {
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.font = `${UNITS}px "Mr Dafoe"`;
  const m = ctx.measureText(WORD);
  const inkLeft = -m.actualBoundingBoxLeft;
  const inkRight = m.actualBoundingBoxRight;
  const ascent = m.actualBoundingBoxAscent;
  const descent = m.actualBoundingBoxDescent;
  const centres = [...WORD].map((ch, i) => ctx.measureText(WORD.slice(0, i)).width + ctx.measureText(ch).width / 2);
  const padX = 0.04 * UNITS;
  const padY = ROLL + 0.03 * UNITS;
  return {
    x: inkLeft - padX,
    y: -ascent - padY,
    w: inkRight - inkLeft + 2 * padX,
    h: ascent + descent + 2 * padY,
    inkLeft,
    inkRight,
    ascent,
    descent,
    advance: m.width,
    centres,
  };
}

export function FlowWord() {
  const [geo, setGeo] = useState<Geo | null>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const streamRef = useRef<SVGPathElement>(null);
  const brightRef = useRef<SVGGElement>(null);
  const gooRef = useRef<SVGGElement>(null);
  const dropRef = useRef<SVGCircleElement>(null);
  const dropletRef = useRef<SVGCircleElement>(null);
  const hoverRef = useRef<(on: boolean) => void>(() => {});

  useEffect(() => {
    let live = true;
    const fit = () => live && setGeo(measure());
    const fonts = document.fonts;
    if (fonts) fonts.load(`${UNITS}px "Mr Dafoe"`).then(fit, fit);
    else fit();
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!geo) return;
    const path = pathRef.current!;
    const stream = streamRef.current!;
    const bright = brightRef.current!;
    const goo = gooRef.current!;
    const drop = dropRef.current!;
    const droplet = dropletRef.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const pathStart = 0;
    const pathEnd = geo.advance + 0.5 * UNITS;
    const wavelength = 0.9 * UNITS;
    const top = geo.y;
    const bottom = geo.y + geo.h;
    const inkTop = -geo.ascent;
    const inkH = geo.ascent + geo.descent;
    const reach = DROP_R + DROPLET_R - 0.008 * UNITS;

    let hovered = false;
    let pouring = false;
    let start = 0;
    let frame = 0;
    let timer = 0;
    let last = 0;
    const lag = { x: 0, y: 0 };

    const roll = (x: number, amp: number, t: number) =>
      amp * Math.sin(((x - pathStart) / wavelength) * Math.PI * 2 - t * 0.0042);

    const baseline = (amp: number, t: number) => {
      let d = "";
      for (let i = 0; i <= SAMPLES; i++) {
        const x = pathStart + ((pathEnd - pathStart) * i) / SAMPLES;
        d += `${i ? "L" : "M"}${x.toFixed(2)} ${roll(x, amp, t).toFixed(2)}`;
      }
      return d;
    };

    const heightAt = (x: number) => {
      const c = geo.centres;
      if (x <= c[0]) return HEIGHTS[0];
      for (let i = 0; i < c.length - 1; i++) {
        if (x <= c[i + 1]) return HEIGHTS[i] + (HEIGHTS[i + 1] - HEIGHTS[i]) * smooth((x - c[i]) / (c[i + 1] - c[i]));
      }
      return HEIGHTS[HEIGHTS.length - 1];
    };

    // the stream: a slanted band whose top leads, both edges rippling
    const streamShape = (front: number, t: number) => {
      const steps = 14;
      const edge = (offset: number, phase: number, k: number, amp: number) => {
        const pts: string[] = [];
        for (let i = 0; i <= steps; i++) {
          const y = top + ((bottom - top) * i) / steps;
          const x = front + offset - SLANT * ((y - top) / (bottom - top)) + amp * Math.sin(y * k + t * 0.006 + phase);
          pts.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
        }
        return pts;
      };
      const lead = edge(0, 0, 0.07, 0.03 * UNITS);
      const tail = edge(-BAND, 1.7, 0.05, 0.04 * UNITS).reverse();
      return `M${lead.join("L")}L${tail.join("L")}Z`;
    };

    const rest = () => {
      path.setAttribute("d", baseline(0, 0));
      stream.setAttribute("d", "M0 0Z");
      bright.style.visibility = "hidden";
      goo.style.opacity = "0";
    };

    const tick = (now: number) => {
      const dt = Math.min(64, now - (last || now));
      last = now;
      const p = (now - start) / POUR_MS;
      if (p >= 1) {
        pouring = false;
        frame = 0;
        last = 0;
        rest();
        schedule(hovered ? 0 : GAP_MIN_MS + Math.random() * GAP_SPREAD_MS);
        return;
      }

      const t = now - start;
      const amp = ROLL * Math.sin(Math.PI * p);
      path.setAttribute("d", baseline(amp, t));

      const from = geo.inkLeft - 0.05 * UNITS;
      const to = geo.inkRight + BAND + SLANT + 0.05 * UNITS;
      const front = from + (to - from) * glide(p);
      stream.setAttribute("d", streamShape(front, t));

      // the drop rides just behind the front, at its letter's height, on the rolled baseline
      const x = front - BEHIND - SLANT * 0.5;
      const y = inkTop + heightAt(x) * inkH + roll(x, amp, t);
      if (lag.x === 0 && lag.y === 0) {
        lag.x = x;
        lag.y = y;
      }
      const k = 1 - Math.exp(-dt / 55);
      lag.x += (x - lag.x) * k;
      lag.y += (y - lag.y) * k;
      const dx = lag.x - x;
      const dy = lag.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist > reach) {
        lag.x = x + (dx / dist) * reach;
        lag.y = y + (dy / dist) * reach;
      }
      const span = geo.inkRight - geo.inkLeft;
      const along = clamp01((x - geo.inkLeft) / span);
      const visible = Math.min(clamp01(along / 0.06), clamp01((1 - along) / 0.06));
      drop.setAttribute("cx", x.toFixed(2));
      drop.setAttribute("cy", y.toFixed(2));
      droplet.setAttribute("cx", lag.x.toFixed(2));
      droplet.setAttribute("cy", lag.y.toFixed(2));
      goo.setAttribute("fill", mix("#5ff5df", "#6fb7ff", along));
      goo.style.opacity = visible.toFixed(3);

      frame = requestAnimationFrame(tick);
    };

    const pour = () => {
      if (pouring || reduced.matches) return;
      window.clearTimeout(timer);
      pouring = true;
      start = performance.now();
      last = 0;
      lag.x = lag.y = 0;
      bright.style.visibility = "visible";
      frame = requestAnimationFrame(tick);
    };

    const schedule = (delay: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(pour, delay);
    };

    hoverRef.current = (on: boolean) => {
      hovered = on;
      if (on) pour();
    };

    rest();
    schedule(FIRST_POUR_MS);

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      hoverRef.current = () => {};
    };
  }, [geo]);

  const box = geo ?? { x: 0, y: -0.8 * UNITS, w: 1.6 * UNITS, h: 1.1 * UNITS };

  return (
    <span
      className="flow-word"
      onPointerEnter={() => hoverRef.current(true)}
      onPointerLeave={() => hoverRef.current(false)}
    >
      <svg
        viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
        style={{ width: `${box.w / UNITS}em`, opacity: geo ? 1 : 0 }}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <path id="flow-word-baseline" ref={pathRef} d={`M0 0L${2 * UNITS} 0`} />
          <linearGradient id="flow-word-ink" gradientUnits="userSpaceOnUse" x1={box.x} y1="0" x2={box.x + box.w} y2="0">
            <stop offset="0" stopColor="#19d9bf" />
            <stop offset="0.5" stopColor="#6fb7ff" />
            <stop offset="1" stopColor="#7a3cff" />
          </linearGradient>
          <linearGradient id="flow-word-bright" gradientUnits="userSpaceOnUse" x1="0" y1={box.y} x2="0" y2={box.y + box.h}>
            <stop offset="0.15" stopColor="#ffffff" />
            <stop offset="0.9" stopColor="#63f2dc" />
          </linearGradient>
          <clipPath id="flow-word-stream">
            <path ref={streamRef} d="M0 0Z" />
          </clipPath>
          <filter id="flow-word-goo" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.6" />
            <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" />
          </filter>
        </defs>
        <text className="flow-word-text" fontSize={UNITS} fill="url(#flow-word-ink)">
          <textPath href="#flow-word-baseline">{WORD}</textPath>
        </text>
        <g ref={brightRef} clipPath="url(#flow-word-stream)" style={{ visibility: "hidden" }}>
          <text className="flow-word-text" fontSize={UNITS} fill="url(#flow-word-bright)">
            <textPath href="#flow-word-baseline">{WORD}</textPath>
          </text>
        </g>
        <g ref={gooRef} filter="url(#flow-word-goo)" style={{ opacity: 0 }}>
          <circle ref={dropletRef} r={DROPLET_R} />
          <circle ref={dropRef} r={DROP_R} />
        </g>
      </svg>
    </span>
  );
}
