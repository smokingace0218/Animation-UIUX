import { useMemo } from "react";

import dimensionalSource from "../shaders/neuform-isolated/sources/vanguard-dimensional.html?raw";

/* Dimensional Field, with liquid bubbles.

   The ThreeUI source document stays byte-for-byte as delivered; this file
   rewrites a copy of it at load time, the same way ThreeUI's own host adapts
   its documents. The authored spheres are rigid: they only bob, so their
   outlines stay perfect arcs. Here their surface flows instead. Slow waves
   ripple it all the time; near the cursor a bubble swells softly, grows a
   little and drifts away from the pointer, then floats back when it rests.
   The bubbles are clear, refracting the background through their curved
   surface with a thin-film rim and a highlight, like real bubbles.
   The beams keep a dim floor of light so the background never empties.
   The colours, camera parallax and timing are the authored effect. */

// the authored glass vertex shader, replaced whole
const GLASS_VERTEX = /varying vec3 vNormal;\s*void main\(\) \{\s*vNormal = normalize\(normalMatrix \* normal\);\s*gl_Position = projectionMatrix \* modelViewMatrix \* vec4\(position, 1\.0\);\s*\}/;

const LIQUID_VERTEX = `uniform float u_time;
                    uniform float u_order;
                    uniform vec3 u_pointer;
                    uniform float u_pull;
                    varying vec3 vNormal;

                    // three slow, crossing waves: never repeats visibly, never sharp
                    float wobble(vec3 p, float t) {
                        return 0.55 * sin(p.x * 2.1 + t * 0.9) * sin(p.y * 1.7 + t * 0.7) * sin(p.z * 2.3 + t * 0.8)
                             + 0.30 * sin(dot(p, vec3(3.1, 2.3, 1.9)) + t * 1.3)
                             + 0.15 * sin(dot(p, vec3(-1.7, 4.1, 2.7)) - t * 1.1);
                    }

                    void main() {
                        float t = u_time;
                        // a liquid surface: each point rides gently out and in along its
                        // normal, enough to keep the outline alive while it stays a round arc
                        float w = wobble(position, t * 0.8);
                        vec3 p = position + normal * 0.045 * (1.0 - 0.45 * u_order) * w;
                        vec4 world = modelMatrix * vec4(p, 1.0);

                        // drawn toward the pointer as a broad, soft swell: the surface moves
                        // outward along its own normal by a bell curve of distance from the
                        // cursor. Nothing here uses the direction to the cursor, which is
                        // undefined at the cursor itself and flips across it, creasing the
                        // surface into a point; distance alone stays smooth everywhere.
                        vec2 toPointer = u_pointer.xy - world.xy;
                        float swell = u_pull * exp(-dot(toPointer, toPointer) * 0.06);
                        vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
                        world.xyz += worldNormal * swell * 0.55;

                        // tilt the normal with the waves so the fresnel rim ripples too
                        vec3 n = normal + 0.12 * vec3(cos(position.x * 2.1 + t * 0.9), cos(position.y * 1.7 + t * 0.7), cos(position.z * 2.3 + t * 0.8));
                        vNormal = normalize(normalMatrix * n);
                        gl_Position = projectionMatrix * viewMatrix * world;
                    }`;

// two uniforms for the pointer, added after the authored palette
const UNIFORMS_ANCHOR = "u_color2: { value: new THREE.Color(0.4, 0.0, 0.9) }  // Deep Purple";
const UNIFORMS_ADDED = `${UNIFORMS_ANCHOR}
                ,u_pointer: { value: new THREE.Vector3(0, 0, 0) },
                u_pull: { value: 0 },
                u_order: { value: 0 }`;

// the pointer, carried into world units on the z = 0 plane the spheres sit around
const POINTER_ANCHOR = "const resize = () => {";
const POINTER_TRACKING = `// liquid: where the pointer is in the scene, and whether it is in play
            const liquidTarget = new THREE.Vector3();
            let liquidLastMove = -1e9;
            let liquidLastPost = -1e9;
            let liquidLastFrame = performance.now();
            document.addEventListener('mousemove', (event) => {
                const ray = new THREE.Vector3((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1, 0.5);
                ray.unproject(camera).sub(camera.position).normalize();
                const distance = -camera.position.z / ray.z;
                liquidTarget.copy(camera.position).add(ray.multiplyScalar(distance));
                liquidLastMove = performance.now();
                // tell the host page the pointer is moving, at most a few times a second
                if (liquidLastMove - liquidLastPost > 200 && window.parent !== window) {
                    liquidLastPost = liquidLastMove;
                    window.parent.postMessage({ flowPointer: true }, '*');
                }
            });
            document.documentElement.addEventListener('mouseleave', () => { liquidLastMove = -1e9; });

            // order: 0 is the noisy opening, 1 is the composed flow. The host page owns it.
            let liquidOrder = 0;
            let liquidOrderGoal = 0;
            let liquidClock = 0;
            window.addEventListener('message', (event) => {
                const order = event.data && event.data.flowOrder;
                if (typeof order === 'number') liquidOrderGoal = Math.min(1, Math.max(0, order));
            });
            if (window.parent !== window) window.parent.postMessage({ flowHello: true }, '*');

            ${POINTER_ANCHOR}`;

// each frame: ease the pull in while the pointer moves, let the liquid relax when it rests
const FRAME_ANCHOR = "uniforms.u_time.value = time;";
const FRAME_ADDED = `${FRAME_ANCHOR}

                const liquidNow = performance.now();
                const liquidDt = Math.min(0.1, (liquidNow - liquidLastFrame) / 1000);
                liquidLastFrame = liquidNow;
                const liquidGoal = liquidNow - liquidLastMove < 1200 ? 1 : 0;
                uniforms.u_pull.value += (liquidGoal - uniforms.u_pull.value) * (1 - Math.exp(-liquidDt / (liquidGoal ? 0.35 : 0.6)));
                uniforms.u_pointer.value.lerp(liquidTarget, 1 - Math.exp(-liquidDt / 0.12));

                // order eases in over most of a second, so the scene composes itself rather than snapping
                liquidOrder += (liquidOrderGoal - liquidOrder) * (1 - Math.exp(-liquidDt / 0.6));
                uniforms.u_order.value = liquidOrder;
                // the field runs on its own clock, which slows as order rises: calmer, never still
                liquidClock += liquidDt * (1 - 0.45 * liquidOrder);
                uniforms.u_time.value = liquidClock;`;

// the beams: authored, they fade fully out between passes, so the background
// empties and refills. A floor keeps a dim current of light always present,
// and the passes swell over it instead of appearing from nothing.
const BG_BEAM = "float beam = smoothstep(0.2, 0.9, snoise(vec2(st.x + st.y * 2.0 - u_time * 0.1, u_time * 0.03)));";
const BG_BEAM_STEADY = "float beam = 0.3 + 0.7 * smoothstep(-0.45, 0.9, snoise(vec2(st.x + st.y * 2.0 - u_time * 0.1, u_time * 0.03)));";

// the bubbles, as real bubbles. Authored, each one paints its own opaque beam
// pattern. Here a bubble is clear: it redraws the background field behind it,
// sampled through its curved surface so the scene bends and magnifies toward
// the rim like a lens, then adds a thin-film rim whose colours shift with the
// viewing angle and a soft window highlight. The field function is the
// background shader's own, so what shows through matches what is behind.
const GLASS_FRAGMENT = /varying vec3 vNormal;\s*\$\{snoiseLogic\}\s*void main\(\) \{[\s\S]*?gl_FragColor = vec4\(finalColor, 0\.95\);\s*\}/;
const GLASS_REFRACTION = `varying vec3 vNormal;
                    \${snoiseLogic}

                    // the background at a point on screen: the same steps as the background shader
                    vec3 fieldAt(vec2 screen) {
                        vec2 uv = screen;
                        uv.x *= u_resolution.x / u_resolution.y;
                        vec3 baseColor = vec3(0.02, 0.02, 0.03);
                        vec2 st = uv * 0.5;
                        st += vec2(snoise(st + u_time * 0.04), snoise(st - u_time * 0.04)) * (0.4 - 0.18 * u_order);
                        float beam = 0.3 + 0.7 * smoothstep(-0.45, 0.9, snoise(vec2(st.x + st.y * 2.0 - u_time * 0.1, u_time * 0.03)));
                        vec3 glow = mix(u_color1, u_color2, snoise(uv * 2.0 + u_time * 0.15) * 0.5 + 0.5);
                        float vignette = smoothstep(1.5, 0.1, distance(screen, vec2(0.5)));
                        return mix(vec3(0.01, 0.01, 0.015), mix(baseColor, glow, beam * 0.6), vignette);
                    }

                    void main() {
                        vec2 screen = gl_FragCoord.xy / u_resolution.xy;
                        vec3 n = normalize(vNormal);
                        float facing = clamp(n.z, 0.0, 1.0);
                        float fresnel = pow(1.0 - facing, 2.2);

                        // refraction: the view through the bubble bends, more toward the rim
                        vec2 bend = n.xy * (0.05 + 0.12 * fresnel) * (1.0 - 0.35 * u_order);
                        vec3 behind = fieldAt(screen - bend);

                        // thin film: colours that shift with the viewing angle and drift slowly
                        vec3 film = 0.5 + 0.5 * cos(6.2831 * (fresnel * 1.35 + u_time * 0.035 + vec3(0.0, 0.33, 0.67)));
                        film = mix(film, vec3(1.0), 0.2);
                        vec3 rim = film * fresnel * 0.38 + mix(u_color1, u_color2, 0.5) * fresnel * 0.16;

                        // a soft window highlight up and to the left, and a faint one opposite
                        float spec = pow(max(dot(n, normalize(vec3(-0.45, 0.55, 0.7))), 0.0), 220.0) * 0.75
                                   + pow(max(dot(n, normalize(vec3(0.5, -0.45, 0.75))), 0.0), 60.0) * 0.08;

                        // the clear centre lets the scene through almost untouched, a touch brighter
                        vec3 color = behind * (0.95 + 0.12 * facing) + rim + vec3(spec);
                        gl_FragColor = vec4(color, 1.0);
                    }`;

// the bubbles: with no order each bobs on its own authored rhythm; as order
// rises they blend into one shared current, rising, falling and swaying the
// same way at the same tempo. A bubble near the cursor also eases away from it
// and grows a little, then floats back. Springs are timed in seconds, so the
// motion is the same at any frame rate.
const RENDER_ANCHOR = "renderer.render(scene, camera);";
const RENDER_DRIFT = `spheres.forEach((s, index) => {
                    if (!s.liquid) s.liquid = { baseX: s.mesh.position.x, baseScale: s.mesh.scale.x, ox: 0, oy: 0, grow: 0 };
                    const L = s.liquid;
                    const radius = L.baseScale;

                    // the shared current every bubble joins as order rises
                    const sharedY = s.baseY + Math.sin(liquidClock * 0.55) * 0.5;
                    s.mesh.position.y += (sharedY - s.mesh.position.y) * liquidOrder;
                    const sway = Math.sin(liquidClock * 0.21) * liquidOrder;
                    const currentX = sway * 0.9;
                    const currentY = sway * 0.35;

                    const dx = (L.baseX + L.ox + currentX) - uniforms.u_pointer.value.x;
                    const dy = s.mesh.position.y - uniforms.u_pointer.value.y;
                    const distance = Math.max(0.001, Math.hypot(dx, dy));
                    // 1 with the cursor on or inside the bubble's edge, easing to 0 a little way out
                    const edge = (distance - radius) / (radius * 0.8 + 1.6);
                    const near = uniforms.u_pull.value * Math.max(0, Math.min(1, 1 - edge)) ** 2;
                    // strong enough to outweigh the swell toward the cursor, so the bubble reads as drifting away
                    const push = near * (0.8 + radius * 0.18);
                    const settle = 1 - Math.exp(-liquidDt / 0.7);
                    L.ox += ((dx / distance) * push - L.ox) * settle;
                    L.oy += ((dy / distance) * push - L.oy) * settle;
                    L.grow += (near - L.grow) * (1 - Math.exp(-liquidDt / 0.5));
                    s.mesh.position.x = L.baseX + L.ox + currentX;
                    s.mesh.position.y += L.oy + currentY;
                    // free movement: each visible bubble also wanders on its own, slowly and
                    // never quite repeating (unrelated frequencies), within a reach set by its
                    // size, so the large one sways gently and the small one roams furthest
                    const roam = [[0.9, 0.6, 1.0], [1.1, 0.8, 1.3], [1.9, 1.4, 1.7]][index];
                    if (roam) {
                        const w = liquidClock * 0.11 * roam[2] + index * 2.4;
                        s.mesh.position.x += (Math.sin(w) * 0.7 + Math.sin(w * 2.31 + 1.1) * 0.3) * roam[0];
                        s.mesh.position.y += (Math.cos(w * 0.83 + 0.4) * 0.7 + Math.sin(w * 1.73 + 2.2) * 0.3) * roam[1];
                    }
                    const size = radius * (1 + 0.07 * L.grow);
                    s.mesh.scale.set(size, size, size);
                });

                ${RENDER_ANCHOR}`;

// both fragment shaders include the shared noise source, so declaring the
// order uniform there gives it to each of them
const NOISE_ANCHOR = "vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }";
const NOISE_WITH_ORDER = `uniform float u_order;
                ${NOISE_ANCHOR}`;

// the background field: its turbulence quietens as order rises
const BG_DISTORT = "st += vec2(snoise(st + u_time * 0.04), snoise(st - u_time * 0.04)) * 0.4;";
const BG_DISTORT_ORDERED = "st += vec2(snoise(st + u_time * 0.04), snoise(st - u_time * 0.04)) * (0.4 - 0.18 * u_order);";

// only the canvas shows; the authored page around it is hidden but left in place
const ISOLATE_STYLE = `<style>
html, body { margin: 0 !important; width: 100%; height: 100%; overflow: hidden !important; background: #050608 !important; }
body > *:not(#webgl-canvas) { display: none !important; }
#webgl-canvas { position: fixed !important; inset: 0 !important; width: 100% !important; height: 100% !important; z-index: 0 !important; }
</style>`;

function liquefy(source: string) {
  const steps: [string | RegExp, string][] = [
    [UNIFORMS_ANCHOR, UNIFORMS_ADDED],
    [GLASS_VERTEX, LIQUID_VERTEX],
    [POINTER_ANCHOR, POINTER_TRACKING],
    [FRAME_ANCHOR, FRAME_ADDED],
    [BG_BEAM, BG_BEAM_STEADY],
    [NOISE_ANCHOR, NOISE_WITH_ORDER],
    [BG_DISTORT, BG_DISTORT_ORDERED],
    [GLASS_FRAGMENT, GLASS_REFRACTION],
    [RENDER_ANCHOR, RENDER_DRIFT],
  ];
  let out = source;
  for (const [anchor, replacement] of steps) {
    const matched = typeof anchor === "string" ? out.includes(anchor) : anchor.test(out);
    if (!matched) {
      // if the source ever changes, fall back to the authored effect rather than a broken one
      console.warn("LiquidDimensionalField: source anchor not found, showing the authored effect", anchor);
      return source;
    }
    out = out.replace(anchor, replacement);
  }
  return out.replace(/<\/head>/i, `${ISOLATE_STYLE}</head>`);
}

export function LiquidDimensionalField({ className }: { className?: string }) {
  const document = useMemo(() => liquefy(dimensionalSource), []);
  return (
    <iframe
      className={className}
      title="Liquid dimensional field"
      srcDoc={document}
      sandbox="allow-scripts"
      loading="eager"
      style={{ display: "block", width: "100%", height: "100%", border: 0, background: "#050608" }}
    />
  );
}
