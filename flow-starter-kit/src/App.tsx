import { LiquidDimensionalField } from "./components/LiquidDimensionalField";
import { SiteHeader } from "./components/SiteHeader";

export function App() {
  return (
    <section className="hero" aria-label="Flow">
      <div className="hero-field">
        <LiquidDimensionalField />
      </div>
      <SiteHeader />
    </section>
  );
}
