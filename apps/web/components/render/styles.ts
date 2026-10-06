/** Shared, self-contained CSS for preview, static publication and future canvas. */
export const SITE_CSS = `
.folyo-site { color: #16161d; background: #faf9f6; min-height: 100dvh; font-family: var(--site-body-font); font-size: 16px; line-height: 1.65; overflow-wrap: anywhere; }
.folyo-site *, .folyo-site *::before, .folyo-site *::after { box-sizing: border-box; }
.folyo-site a { color: var(--site-accent); text-decoration: none; }
.folyo-site a:hover { text-decoration: underline; }
.folyo-site a:focus-visible { outline: 2px solid var(--site-accent); outline-offset: 4px; }
.folyo-site .site-header, .folyo-site .site-main, .folyo-site .site-footer { width: min(100% - 40px, 820px); margin-inline: auto; }
.folyo-site .site-header { padding-top: 24px; }
.folyo-site .site-nav { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 24px; margin: 0; padding: 12px 0; }
.folyo-site .site-nav a { color: #4a4952; }
.folyo-site .site-nav a[aria-current="page"] { color: var(--site-accent); font-weight: 600; text-decoration: underline; text-underline-offset: 6px; }
.folyo-site .site-main { max-width: 820px; padding: 48px 0 64px; margin-top: 0; margin-bottom: 0; }
.folyo-site .site-main > * + * { margin-top: 24px; }
.folyo-site h1, .folyo-site h2, .folyo-site h3 { font-family: var(--site-heading-font); color: #16161d; line-height: 1.2; margin: 0; letter-spacing: -.035em; }
.folyo-site h1 { font-size: clamp(2rem, 5vw, 3.5rem); }
.folyo-site h2 { font-size: clamp(1.6rem, 4vw, 2.5rem); }
.folyo-site h3 { font-size: 1.5rem; }
.folyo-site p { margin: 0; }
.folyo-site .site-hero { text-align: center; padding: 24px 0 32px; margin: 0; border: 0; border-radius: 0; background: transparent; }
.folyo-site .site-hero-left { text-align: left; }
.folyo-site .site-hero-left .site-subtitle { margin-inline: 0; }
.folyo-site .site-hero > * + * { margin-top: 16px; }
.folyo-site .site-avatar { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; }
.folyo-site .site-profession { font-size: 1.25rem; font-weight: 500; }
.folyo-site .site-subtitle { max-width: 600px; margin-inline: auto; color: #4a4952; }
.folyo-site .site-text > * + * { margin-top: 16px; }
.folyo-site .site-text ul { margin-bottom: 0; padding-left: 24px; }
.folyo-site .site-text blockquote { margin-inline: 0; padding: 8px 20px; border-left: 3px solid var(--site-accent); color: #4a4952; }
.folyo-site .site-image { margin: 0; min-width: 0; }
.folyo-site .site-image img { display: block; width: 100%; height: auto; border-radius: 8px; }
.folyo-site figcaption { margin-top: 8px; font-size: .875rem; color: #4a4952; }
.folyo-site .site-gallery { display: grid; gap: 16px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.folyo-site .site-gallery-three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.folyo-site .site-gallery img { aspect-ratio: 4 / 3; object-fit: cover; }
.folyo-site .site-button { display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--site-accent); border-radius: 8px; padding: 12px 24px; font-weight: 600; text-decoration: none; }
.folyo-site .site-button-primary { background: var(--site-accent); color: var(--site-accent-text); }
.folyo-site .site-button-outline { color: var(--site-accent); background: transparent; }
.folyo-site .site-button:hover { opacity: .85; text-decoration: none; }
.folyo-site .site-social { display: flex; flex-wrap: wrap; gap: 12px; list-style: none; padding: 0; margin-bottom: 0; }
.folyo-site .site-social a { display: grid; place-items: center; padding: 8px; border-radius: 8px; }
.folyo-site .site-social a:hover { background: #f1efea; }
.folyo-site .site-divider { border: 0; border-top: 1px solid #e8e6e0; margin-bottom: 0; }
.folyo-site .site-spacer { margin-top: 0; }
.folyo-site .site-footer { padding: 24px 0; text-align: center; font-size: .8rem; border-top: 1px solid #e8e6e0; }
.folyo-site .site-footer a { color: #696773; }
.folyo-site .site-report { margin-left: 16px; }
@media (max-width: 560px) { .folyo-site .site-gallery { grid-template-columns: 1fr; } .folyo-site .site-main { padding-top: 32px; } }
/* Presets share the block contract, but each has its own art direction. */
.folyo-site { --site-paper: #faf9f6; --site-ink: #16161d; --site-muted: #56545c; --site-line: #e2dfd7; background: var(--site-paper); color: var(--site-ink); container-type: inline-size; }
.folyo-site a { color: color-mix(in srgb, var(--site-accent) 65%, var(--site-ink)); }
.folyo-site .site-nav a[aria-current="page"] { color: color-mix(in srgb, var(--site-accent) 65%, var(--site-ink)); }
.folyo-site .site-header, .folyo-site .site-main, .folyo-site .site-footer { width: min(100% - 64px, var(--site-content-width)); }
.folyo-site .site-header { padding-top: 20px; border-bottom: 1px solid var(--site-line); }
.folyo-site .site-nav { justify-content: flex-end; gap: 10px 28px; padding-block: 16px 22px; font-size: .82rem; letter-spacing: .02em; }
.folyo-site .site-nav a { color: var(--site-muted); }
.folyo-site .site-nav a[data-home] { margin-right: auto; color: var(--site-ink); font-weight: 700; }
.folyo-site .site-main { max-width: var(--site-content-width); padding-block: 64px 80px; }
.folyo-site .site-main > * + * { margin-top: var(--site-block-gap); }
.folyo-site h1, .folyo-site h2, .folyo-site h3 { color: var(--site-ink); text-wrap: balance; }
.folyo-site h1 { font-size: clamp(2.6rem, 7cqi, 5.5rem); line-height: 1.04; letter-spacing: -.055em; }
.folyo-site h2 { font-size: clamp(1.7rem, 3.8cqi, 3rem); }
.folyo-site h3 { font-size: clamp(1.35rem, 2.8cqi, 2rem); }
.folyo-site .site-hero { position: relative; padding: 36px 0 48px; }
.folyo-site .site-hero > * + * { margin-top: 22px; }
.folyo-site .site-profession { color: color-mix(in srgb, var(--site-accent) 65%, var(--site-ink)); font-size: .85rem; font-weight: 600; text-transform: uppercase; letter-spacing: .13em; }
.folyo-site .site-subtitle { color: var(--site-muted); font-size: clamp(1rem, 2cqi, 1.25rem); max-width: 54ch; line-height: 1.7; }
.folyo-site .site-text { color: var(--site-muted); max-width: 74ch; font-size: 1rem; line-height: 1.85; }
.folyo-site .site-text strong { color: var(--site-ink); font-weight: 600; }
.folyo-site .site-text ul { list-style: none; padding-left: 0; }
.folyo-site .site-text li { padding: 12px 0 12px 24px; border-bottom: 1px solid var(--site-line); position: relative; }
.folyo-site .site-text li::before { content: ''; position: absolute; left: 0; top: 24px; width: 6px; height: 6px; border-radius: 50%; background: var(--site-accent); }
.folyo-site .site-text blockquote { padding: 24px 28px; background: color-mix(in srgb, var(--site-accent) 5%, var(--site-paper)); color: var(--site-ink); font-family: var(--site-heading-font); font-size: 1.25rem; }
.folyo-site .site-image img { border-radius: 12px; border: 1px solid var(--site-line); }
.folyo-site figcaption { color: var(--site-muted); margin-top: 14px; font-size: .8rem; line-height: 1.6; }
.folyo-site .site-gallery { gap: 24px; }
.folyo-site .site-gallery img { aspect-ratio: 4 / 3; }
.folyo-site .site-button { gap: 24px; padding: 15px 24px; border-radius: 6px; font-size: .9rem; transition: box-shadow 160ms ease, transform 160ms ease; }
.folyo-site .site-button-primary { color: var(--site-accent-text); }
.folyo-site .site-button::after { content: '↗'; font-size: 1.15rem; line-height: 1; }
.folyo-site .site-button:hover { opacity: 1; transform: translateY(-2px); box-shadow: 0 6px 16px color-mix(in srgb, var(--site-accent) 18%, transparent); }
.folyo-site .site-social a { padding: 12px; border: 1px solid var(--site-line); border-radius: 50%; background: color-mix(in srgb, var(--site-paper) 85%, white); }
.folyo-site .site-social a:hover { background: color-mix(in srgb, var(--site-accent) 8%, var(--site-paper)); }
.folyo-site .site-divider { border-color: var(--site-line); }
.folyo-site .site-footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; text-align: left; padding-block: 28px; border-color: var(--site-line); }
.folyo-site .site-footer a { color: var(--site-muted); }
.folyo-site .site-report { margin-left: 0; }

/* Editorial profile: a warm, book-like reading experience. */
.folyo-site[data-preset="minimal"] { --site-paper: #f3ede3; --site-ink: #30291f; --site-muted: #655b4f; --site-line: #d9cdbc; }
.folyo-site[data-preset="minimal"] .site-main { max-width: var(--site-content-width); }
.folyo-site[data-preset="minimal"] .site-hero { padding-block: 60px; border-bottom: 1px solid var(--site-line); }
.folyo-site[data-preset="minimal"] .site-hero::before { content: ''; display: block; width: 48px; height: 3px; margin: 0 auto 32px; background: var(--site-accent); }
.folyo-site[data-preset="minimal"] .site-text { margin-inline: auto; }
.folyo-site[data-preset="minimal"] .site-social { padding-block: 16px; }
.folyo-site[data-preset="minimal"] .site-button { border-radius: 100px; }

/* Professional: a structured profile with a blue identity panel. */
.folyo-site[data-preset="professional"] { --site-paper: #f0f4f8; --site-line: #d4deea; --site-muted: #4d6075; }
.folyo-site[data-preset="professional"] .site-hero { padding: clamp(28px, 5cqi, 60px); border-radius: 16px; border: 1px solid var(--site-line); border-top: 5px solid var(--site-accent); background: linear-gradient(120deg, var(--site-surface) 50%, color-mix(in srgb, var(--site-accent) 10%, var(--site-paper))); box-shadow: 0 18px 50px #233e5b09; }
.folyo-site[data-preset="professional"] .site-hero h1 { max-width: 14ch; }
.folyo-site[data-preset="professional"] .site-heading { padding-bottom: 16px; border-bottom: 1px solid var(--site-line); }

/* Creative: generous poster typography and an asymmetric project grid. */
.folyo-site[data-preset="creative"] { --site-paper: #fff3e9; --site-ink: #3e241b; --site-muted: #71574d; --site-line: #ead4c5; }
.folyo-site[data-preset="creative"] .site-hero { padding-block: 40px 56px; }
.folyo-site[data-preset="creative"] .site-hero h1 { font-size: clamp(3rem, 9cqi, 7rem); }
.folyo-site[data-preset="creative"] .site-avatar { width: 84px; height: 84px; border: 5px solid white; box-shadow: 0 6px 24px #3e241b18; }
.folyo-site[data-preset="creative"] .site-gallery-three { grid-template-columns: 1.25fr 1fr; align-items: start; }
.folyo-site[data-preset="creative"] .site-gallery > :nth-child(3n + 1) { grid-row: span 2; }
.folyo-site[data-preset="creative"] .site-gallery > :nth-child(3n + 1) img { aspect-ratio: 4 / 5; }
.folyo-site[data-preset="creative"] .site-image img { border-radius: 4px; box-shadow: 0 12px 28px #3e241b0c; }
.folyo-site[data-preset="creative"] .site-button { border-radius: 100px; }

/* Executive: charcoal, parchment and an inset editorial cover. */
.folyo-site[data-preset="executive"] { --site-paper: #f1ece3; --site-ink: #302b24; --site-muted: #645d52; --site-line: #d7cdbd; }
.folyo-site[data-preset="executive"] .site-hero { padding: 48px 0 48px 36px; border-left: 3px solid var(--site-accent); }
.folyo-site[data-preset="executive"] .site-hero h1 { max-width: 13ch; }
.folyo-site[data-preset="executive"] .site-image img { border-radius: 2px; }
.folyo-site[data-preset="executive"] .site-gallery { gap: 32px; }
.folyo-site[data-preset="executive"] .site-heading { border-top: 1px solid var(--site-line); padding-top: 28px; }
.folyo-site[data-preset="executive"] .site-button { border-radius: 0; }

/* Studio: expressive type, violet accents and a full-width visual showcase. */
.folyo-site[data-preset="studio"] { --site-paper: #f6f1ff; --site-ink: #281c3e; --site-muted: #66577b; --site-line: #dfd2ee; }
.folyo-site[data-preset="studio"] .site-hero h1 { font-size: clamp(3.2rem, 10cqi, 8rem); }
.folyo-site[data-preset="studio"] .site-profession { display: inline-block; background: color-mix(in srgb, var(--site-accent) 8%, var(--site-paper)); border: 1px solid var(--site-line); padding: 8px 18px; border-radius: 100px; }
.folyo-site[data-preset="studio"] .site-image img { border-radius: 3px; }
.folyo-site[data-preset="studio"] .site-gallery-three { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.folyo-site[data-preset="studio"] .site-gallery > :first-child { grid-column: 1 / -1; }
.folyo-site[data-preset="studio"] .site-gallery > :first-child img { aspect-ratio: 2 / 1; }
.folyo-site[data-preset="studio"] .site-heading { display: flex; align-items: center; gap: 24px; }
.folyo-site[data-preset="studio"] .site-heading::after { content: ''; height: 1px; flex: 1; background: var(--site-line); }
.folyo-site[data-preset="studio"] .site-button { border-radius: 100px; }

/* Research: precise rules, indexed-looking cards and a quiet technical grid. */
.folyo-site[data-preset="scientist"] { --site-paper: #eff5f1; --site-ink: #173a30; --site-muted: #486458; --site-line: #ccded3; background-image: linear-gradient(#0f766e04 1px, transparent 1px), linear-gradient(90deg, #0f766e04 1px, transparent 1px); background-size: 32px 32px; }
.folyo-site[data-preset="scientist"] .site-hero { border-bottom: 2px solid var(--site-accent); }
.folyo-site[data-preset="scientist"] .site-profession { font-family: ui-monospace, monospace; letter-spacing: .06em; }
.folyo-site[data-preset="scientist"] .site-heading { padding-left: 20px; border-left: 3px solid var(--site-accent); }
.folyo-site[data-preset="scientist"] .site-gallery > * { background: var(--site-surface); border: 1px solid var(--site-line); border-radius: 8px; padding: 12px; }
.folyo-site[data-preset="scientist"] .site-gallery img { border: 0; border-radius: 3px; }
.folyo-site[data-preset="scientist"] figcaption { font-family: ui-monospace, monospace; font-size: .75rem; }

/* Developer: a product-like workspace, with distinct technical detailing. */
.folyo-site[data-preset="developer"] { --site-paper: #101c2e; --site-ink: #eff5ff; --site-muted: #b0c2da; --site-line: #314661; }
.folyo-site[data-preset="developer"] .site-hero { padding: clamp(28px, 5cqi, 56px); border: 1px solid var(--site-line); border-radius: 16px; background: radial-gradient(ellipse at top right, color-mix(in srgb, var(--site-accent) 24%, var(--site-paper)), var(--site-surface) 70%); }
.folyo-site[data-preset="developer"] .site-button-outline { color: var(--site-ink); border-color: var(--site-line); }
.folyo-site[data-preset="developer"] .site-profession { font-family: ui-monospace, monospace; font-size: .85rem; text-transform: none; letter-spacing: 0; }
.folyo-site[data-preset="developer"] .site-profession::before { content: '> '; }
.folyo-site[data-preset="developer"] .site-gallery > * { border: 1px solid var(--site-line); border-radius: 12px; background: var(--site-surface); overflow: hidden; }
.folyo-site[data-preset="developer"] .site-gallery img { border: 0; border-radius: 0; }
.folyo-site[data-preset="developer"] .site-gallery figcaption { margin: 0; padding: 16px; }
.folyo-site[data-preset="developer"] .site-heading { letter-spacing: -.045em; }

/* Explicit design controls override a preset without replacing any blocks. */
.folyo-site[data-hero-style="plain"] .site-hero { background: transparent; border: 0; border-radius: 0; box-shadow: none; padding: 36px 0 48px; }
.folyo-site[data-hero-style="panel"] .site-hero { background: var(--site-surface); border: 1px solid var(--site-line); border-radius: 16px; box-shadow: none; padding: clamp(24px, 5cqi, 56px); }
.folyo-site[data-hero-style="editorial"] .site-hero { background: transparent; border: 0; border-left: 3px solid var(--site-accent); border-radius: 0; box-shadow: none; padding: 36px 0 48px 32px; }
.folyo-site[data-hero-style]:not([data-hero-style="auto"]) .site-hero::before { display: none; }
.folyo-site[data-gallery="grid"] .site-gallery { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.folyo-site[data-gallery="two"] .site-gallery, .folyo-site[data-gallery="editorial"] .site-gallery, .folyo-site[data-gallery="featured"] .site-gallery { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.folyo-site[data-gallery]:not([data-gallery="auto"]) .site-gallery > :nth-child(n) { grid-column: auto; grid-row: auto; }
.folyo-site[data-gallery]:not([data-gallery="auto"]) .site-gallery > :nth-child(n) img { aspect-ratio: 4 / 3; }
.folyo-site[data-preset][data-gallery="featured"] .site-gallery > :first-child { grid-column: 1 / -1; }
.folyo-site[data-preset][data-gallery="featured"] .site-gallery > :first-child img { aspect-ratio: 2 / 1; }
.folyo-site[data-preset][data-gallery="editorial"] .site-gallery > :nth-child(3n + 1) { grid-row: span 2; }
.folyo-site[data-preset][data-gallery="editorial"] .site-gallery > :nth-child(3n + 1) img { aspect-ratio: 4 / 5; }
.folyo-site[data-corners="square"] { --site-corner: 0px; }
.folyo-site[data-corners="soft"] { --site-corner: 8px; }
.folyo-site[data-corners="rounded"] { --site-corner: 24px; }
.folyo-site[data-corners]:not([data-corners="auto"]) .site-image img,
.folyo-site[data-corners]:not([data-corners="auto"]) .site-gallery > :nth-child(n),
.folyo-site[data-corners]:not([data-corners="auto"]) .site-hero,
.folyo-site[data-corners]:not([data-corners="auto"]) .site-button { border-radius: var(--site-corner); }
.folyo-site .site-hero-left::before { margin-inline: 0; }
.folyo-site .site-button-outline { color: color-mix(in srgb, var(--site-accent) 65%, var(--site-ink)); }
@container (max-width: 600px) {
  .folyo-site .site-header, .folyo-site .site-main, .folyo-site .site-footer { width: calc(100% - 40px); }
  .folyo-site .site-main { padding-block: 32px 48px; }
  .folyo-site .site-nav { gap: 12px 18px; font-size: .78rem; justify-content: flex-start; }
  .folyo-site .site-nav a[data-home] { margin-right: 0; }
  .folyo-site .site-hero { padding-block: 28px 36px; }
  .folyo-site .site-profession { font-size: .75rem; letter-spacing: .07em; }
  .folyo-site .site-gallery, .folyo-site[data-preset] .site-gallery-three, .folyo-site[data-gallery] .site-gallery { grid-template-columns: 1fr; gap: 24px; }
  .folyo-site[data-preset][data-gallery] .site-gallery > :nth-child(n) { grid-column: auto; grid-row: auto; }
  .folyo-site[data-preset][data-gallery] .site-gallery > :nth-child(n) img { aspect-ratio: 4 / 3; }
  .folyo-site[data-preset="executive"] .site-hero { padding-left: 24px; }
  .folyo-site[data-preset="professional"] .site-hero, .folyo-site[data-preset="developer"] .site-hero { padding: 28px 24px; }
}
@media (prefers-reduced-motion: reduce) {
  .folyo-site .site-button { transition: none; }
  .folyo-site .site-button:hover { transform: none; }
}
`;
