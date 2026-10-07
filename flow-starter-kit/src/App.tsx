import { FlowWord } from "./components/FlowWord";
import { LiquidDimensionalField } from "./components/LiquidDimensionalField";
import { SiteHeader } from "./components/SiteHeader";

export function App() {
  return (
    <section className="hero" aria-label="Flow">
      <div className="hero-field">
        <LiquidDimensionalField />
      </div>
      <SiteHeader />

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
          <a className="btn-glass" href="#how-it-works">
            See how it works
          </a>
        </div>
      </div>
    </section>
  );
}
