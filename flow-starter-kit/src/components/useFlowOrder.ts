import { useEffect, type RefObject } from "react";

/* Order: 0 is the noisy opening, 1 is the composed flow. It rises over 2.4 s
   of pointer movement, sinks over 7 s once movement stops, and locks at 1.
   The value is eased in and out, mirrored onto the hero as --order and
   data-state, and sent to the background iframe as { flowOrder }. */

const RISE_MS = 2400;
const SINK_MS = 7000;
const SETTLE_MS = 900; // a CTA focus or touch glides the rest of the way
const MOVING_MS = 260; // the background reports moves at most every 200 ms
const TOUCH_SETTLE_AT = 1800;

const ease = (v: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, v)));

export type FlowOrderRefs = {
  hero: RefObject<HTMLElement>;
  displace: RefObject<SVGFEDisplacementMapElement>;
  blur: RefObject<SVGFEGaussianBlurElement>;
  turbulence: RefObject<SVGFETurbulenceElement>;
};

export function useFlowOrder({ hero, displace, blur, turbulence }: FlowOrderRefs) {
  useEffect(() => {
    const heroEl = hero.current!;
    const displaceEl = displace.current!;
    const blurEl = blur.current!;
    const turbulenceEl = turbulence.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const loadedAt = performance.now();

    let raw = 0;
    let order = 0;
    let sent = -1;
    let locked = false;
    let settling = false;
    let lastMove = -1e9;
    let frame = 0;
    let last = 0;
    let touchTimer = 0;

    const background = () => heroEl.querySelector<HTMLIFrameElement>(".hero-field iframe")?.contentWindow ?? null;

    const send = (force = false) => {
      if (!force && Math.abs(order - sent) < 0.002 && !(order === 1 && sent !== 1)) return;
      sent = order;
      background()?.postMessage({ flowOrder: order }, "*");
    };

    const apply = (now: number) => {
      const rest = 1 - order;
      heroEl.style.setProperty("--order", order.toFixed(4));
      heroEl.dataset.state = locked ? "flow" : order > 0.001 ? "settling" : "noise";
      displaceEl.setAttribute("scale", (16 * rest).toFixed(3));
      blurEl.setAttribute("stdDeviation", (1.4 * rest).toFixed(3));
      // the noise itself keeps shifting a little while it is there
      const drift = 0.012 + 0.004 * Math.sin(now * 0.0011);
      turbulenceEl.setAttribute("baseFrequency", `${drift.toFixed(4)} 0.05`);
      send();
    };

    const tick = (now: number) => {
      const dt = Math.min(64, now - (last || now));
      last = now;
      if (settling) raw += dt / SETTLE_MS;
      else if (now - lastMove < MOVING_MS) raw += dt / RISE_MS;
      else raw -= dt / SINK_MS;
      raw = Math.min(1, Math.max(0, raw));
      if (raw >= 1) locked = true;
      order = locked ? 1 : ease(raw);
      apply(now);

      const idle = !settling && raw === 0 && now - lastMove >= MOVING_MS;
      if (locked || idle) {
        frame = 0;
        last = 0;
      } else {
        frame = requestAnimationFrame(tick);
      }
    };

    const wake = () => {
      if (!locked && !frame) frame = requestAnimationFrame(tick);
    };

    const moved = () => {
      lastMove = performance.now();
      wake();
    };

    const settle = (instant = false) => {
      if (locked) return;
      if (instant) {
        raw = 1;
        locked = true;
        order = 1;
        cancelAnimationFrame(frame);
        frame = 0;
        apply(performance.now());
        return;
      }
      settling = true;
      wake();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return onTouch();
      moved();
    };

    const onTouch = () => {
      if (locked || touchTimer) return;
      touchTimer = window.setTimeout(() => settle(), Math.max(0, TOUCH_SETTLE_AT - (performance.now() - loadedAt)));
    };

    const onMessage = (event: MessageEvent) => {
      const frameWindow = background();
      if (!frameWindow || event.source !== frameWindow || !event.data) return;
      if (event.data.flowHello) send(true);
      if (event.data.flowPointer) moved();
    };

    const onFocus = (event: FocusEvent) => {
      if ((event.target as Element | null)?.closest?.(".hero-ctas a")) settle();
    };

    const onMotionPref = () => reduced.matches && settle(true);

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("message", onMessage);
    heroEl.addEventListener("focusin", onFocus);
    reduced.addEventListener?.("change", onMotionPref);

    apply(performance.now());
    if (reduced.matches) settle(true);
    else if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) onTouch();

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(touchTimer);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("message", onMessage);
      heroEl.removeEventListener("focusin", onFocus);
      reduced.removeEventListener?.("change", onMotionPref);
    };
  }, [hero, displace, blur, turbulence]);
}
