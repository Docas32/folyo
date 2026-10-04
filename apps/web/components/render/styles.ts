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
.folyo-site .site-footer a { color: #8a8894; }
@media (max-width: 560px) { .folyo-site .site-gallery { grid-template-columns: 1fr; } .folyo-site .site-main { padding-top: 32px; } }
`;
