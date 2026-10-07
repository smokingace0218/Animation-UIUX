import { useRef } from "react";

import { FlowWord } from "./components/FlowWord";
import { LiquidDimensionalField } from "./components/LiquidDimensionalField";
import { SiteHeader } from "./components/SiteHeader";
import { useFlowOrder } from "./components/useFlowOrder";

export function App() {
  const hero = useRef<HTMLElement>(null);
  const turbulence = useRef<SVGFETurbulenceElement>(null);
  const displace = useRef<SVGFEDisplacementMapElement>(null);
  const blur = useRef<SVGFEGaussianBlurElement>(null);
  useFlowOrder({ hero, turbulence, displace, blur });

  return (
    <section ref={hero} className="hero" aria-label="Flow" data-state="noise">
      <div className="hero-field">
        <LiquidDimensionalField />
      </div>
      <SiteHeader />

      <svg className="noise-defs" aria-hidden="true" focusable="false">
        <filter id="copy-noise" x="-5%" y="-30%" width="110%" height="160%" colorInterpolationFilters="sRGB">
          <feTurbulence ref={turbulence} type="fractalNoise" baseFrequency="0.012 0.019" numOctaves={2} seed={7} result="noise" />
          <feDisplacementMap ref={displace} in="SourceGraphic" in2="noise" scale={16} xChannelSelector="R" yChannelSelector="G" result="displaced" />
          <feGaussianBlur ref={blur} in="displaced" stdDeviation={1.4} />
        </filter>
      </svg>

      <div className="hero-content">
        <h1 className="hero-title">
          <span className="hero-eyebrow">Let your work</span>
          <span className="visually-hidden"> </span>
          <FlowWord />
          <span className="visually-hidden">Flow</span>
        </h1>
        <p className="hero-copy">Everything you need to get your work done, without the noise.</p>
        <div className="hero-ctas">
          <a className="btn-white cta-ring cta-primary" href="#get-started">
            Get Started
          </a>
          <a className="btn-glass cta-secondary" href="#how-it-works">
            See how it works
          </a>
        </div>
      </div>
    </section>
  );
}
