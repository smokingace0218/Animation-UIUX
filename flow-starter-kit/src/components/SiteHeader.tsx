import { useEffect, useState } from "react";

import { FlowLogo } from "./FlowLogo";

const NAV = ["Features", "Pricing", "Download"];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const onResize = () => window.innerWidth > 820 && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className="site-header" data-open={open || undefined}>
      <FlowLogo />

      <nav className="nav-pill" aria-label="Primary">
        {NAV.map((item) => (
          <a key={item} href={`#${item.toLowerCase()}`}>
            {item}
          </a>
        ))}
      </nav>

      <div className="header-actions">
        <a className="sign-in" href="#sign-in">
          Sign in
        </a>
        <a className="btn-white cta-ring" href="#get-started">
          Get Started
        </a>
      </div>

      <button
        type="button"
        className="menu-toggle"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-sheet"
        onClick={() => setOpen((value) => !value)}
      >
        <span />
        <span />
      </button>

      <div className="sheet-backdrop" onClick={close} aria-hidden="true" />
      <div id="mobile-sheet" className="mobile-sheet">
        <nav aria-label="Mobile">
          {NAV.map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`} onClick={close}>
              {item}
            </a>
          ))}
        </nav>
        <div className="sheet-actions">
          <a className="sign-in" href="#sign-in" onClick={close}>
            Sign in
          </a>
          <a className="btn-white" href="#get-started" onClick={close}>
            Get Started
          </a>
        </div>
      </div>
    </header>
  );
}
