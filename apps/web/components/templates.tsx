'use client';
import { TemplatePreviewModal } from './template-preview-modal';
import { z } from 'zod';
import { themeSchema } from '@folyo/core';
import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  TEMPLATE_IDS,
  ACCENT_PALETTE,
  resolveTheme,
  themeToStyle,
  type TemplateId,
  type Theme,
  type ThemePatch,
} from '@folyo/core';
import { getDictionary, type Dictionary } from '../lib/i18n';
import { buildTemplate } from '../lib/templates';
import { Button, ButtonLink } from './ui/button';
import { Select } from './ui/select';
// Compact compositions mirror the rendered presets and reuse their project artwork.
export function TemplateThumbnail({
  id,
  locale = 'en',
}: {
  id: TemplateId;
  locale?: string;
}) {
  const d = getDictionary(locale);
  const example = buildTemplate(id, locale);
  const hero = example.pages[0]?.blocks[0];
  const palettes = {
    blank: ['#faf9f6', '#16161d', '#e8e6e0'],
    minimal: ['#f3ede3', '#30291f', '#d5c5ad'],
    professional: ['#edf2f7', '#1e5aa8', '#d3e1f2'],
    creative: ['#fff1e7', '#b93d22', '#ffd7bc'],
    executive: ['#f1ece3', '#30291f', '#c7b89d'],
    studio: ['#f3edff', '#7c3aed', '#e1d3fc'],
    scientist: ['#edf5f0', '#0f766e', '#c7e4d9'],
    developer: ['#101c2e', '#b5ceef', '#314661'],
  };
  const [paper, ink, tint] = palettes[id];
  const family =
    id === 'creative' ? 'studio' : id === 'professional' ? 'developer' : id;
  const illustrated = !['blank', 'minimal', 'professional'].includes(id);
  const centered = ['minimal', 'creative', 'studio'].includes(id);
  const name =
    hero?.type === 'hero' ? hero.content.name : d.templates.names[id];
  const portuguese = locale === 'pt-BR';
  return (
    <svg
      className="template-thumbnail"
      viewBox="0 0 320 224"
      aria-hidden="true"
    >
      <rect width="320" height="224" fill={paper} />
      <path d="M20 30H300" stroke={tint} />
      <text
        x="20"
        y="20"
        fill={ink}
        fontSize="8"
        fontFamily="sans-serif"
        fontWeight="700"
      >
        {id === 'studio' ? 'LUME®' : 'PORTFOLIO'}
      </text>
      {id !== 'blank' && (
        <text x="209" y="20" fill={ink} fontSize="6" fontFamily="sans-serif">
          {portuguese ? 'TRABALHOS  SOBRE  CONTATO' : 'WORK  ABOUT  CONTACT'}
        </text>
      )}
      <text
        x={centered ? 160 : 22}
        y="64"
        textAnchor={centered ? 'middle' : 'start'}
        fill={ink}
        fontSize={id === 'studio' ? 29 : 25}
        fontFamily={
          ['minimal', 'executive', 'creative', 'studio'].includes(id)
            ? 'Georgia, serif'
            : 'sans-serif'
        }
        letterSpacing="-1"
      >
        {name}
      </text>
      <text
        x={centered ? 160 : 22}
        y="79"
        textAnchor={centered ? 'middle' : 'start'}
        fill={ink}
        fontSize="7"
        fontFamily="sans-serif"
      >
        {id === 'blank'
          ? d.templates.intro
          : hero?.type === 'hero'
            ? hero.content.title
            : d.templates.intro}
      </text>
      {illustrated ? (
        <>
          <image
            href={`/template-assets/${family}-cover.svg`}
            x="20"
            y="95"
            width="280"
            height="99"
            preserveAspectRatio="xMidYMid slice"
          />
          <text x="20" y="211" fill={ink} fontSize="7" fontFamily="sans-serif">
            {d.templates.showcase.selected.toUpperCase()}
          </text>
          <text x="288" y="211" fill={ink} fontSize="10">
            ↗
          </text>
        </>
      ) : id === 'professional' ? (
        <>
          <rect x="20" y="95" width="280" height="99" rx="5" fill="white" />
          <path d="M20 95H300" stroke={ink} strokeWidth="3" />
          {[115, 127, 139].map((y) => (
            <rect
              key={y}
              x="34"
              y={y}
              width={y === 139 ? 164 : 237}
              height="3"
              rx="1"
              fill={tint}
            />
          ))}
          <rect x="34" y="156" width="92" height="24" rx="4" fill={ink} />
          <text
            x="80"
            y="172"
            textAnchor="middle"
            fill="white"
            fontSize="7"
            fontFamily="sans-serif"
          >
            {d.templates.content.cv} ↗
          </text>
        </>
      ) : id === 'minimal' ? (
        <>
          <path d="M136 96h48" stroke={ink} />
          {[114, 125, 136].map((y) => (
            <rect
              key={y}
              x="63"
              y={y}
              width="194"
              height="3"
              rx="1"
              fill={tint}
            />
          ))}
          <rect x="108" y="160" width="104" height="25" rx="13" fill={ink} />
          <text
            x="160"
            y="176"
            textAnchor="middle"
            fill={paper}
            fontSize="7"
            fontFamily="sans-serif"
          >
            {portuguese ? 'VAMOS CONVERSAR ↗' : 'LET’S CONNECT ↗'}
          </text>
        </>
      ) : (
        <path d="M160 120v32m-16-16h32" stroke={tint} strokeWidth="2" />
      )}
    </svg>
  );
}
async function mutate(path: string, method: string, input: unknown) {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const parsed = z
    .object({
      theme: themeSchema,
      appliedTheme: z.boolean().optional(),
      contentSkipped: z.boolean().optional(),
    })
    .safeParse(await response.json());
  if (
    !parsed.success ||
    (!response.ok &&
      !(
        response.status === 409 &&
        parsed.data.appliedTheme === true &&
        parsed.data.contentSkipped === true
      ))
  )
    throw new Error('unavailable');
  return parsed.data;
}
export function TemplateGallery({
  d,
  locale,
  onboarding = false,
  settings = false,
  virgin = false,
  onTheme,
}: {
  d: Dictionary;
  locale: string;
  onboarding?: boolean;
  settings?: boolean;
  virgin?: boolean;
  onTheme?: (theme: Theme) => void;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<TemplateId | null>(null);
  const [busy, setBusy] = useState<TemplateId | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [canApplyContent, setCanApplyContent] = useState(virgin);
  async function apply(id: TemplateId, styleOnly = false) {
    setBusy(id);
    setError('');
    setMessage('');
    try {
      const result = styleOnly
        ? await mutate('/api/site/template/style', 'POST', { templateId: id })
        : await mutate('/api/site/template', 'POST', { templateId: id });
      onTheme?.(resolveTheme(result.theme));
      const toast = styleOnly
        ? d.templates.styleApplied
        : result.contentSkipped
          ? d.templates.contentSkipped
          : d.templates.created.replace('{name}', d.templates.names[id]);
      setMessage(toast);
      if (!styleOnly && (id !== 'blank' || result.contentSkipped))
        setCanApplyContent(false);
      if (!settings) {
        sessionStorage.setItem('folyo-template-toast', toast);
        router.replace('/dashboard');
      }
      setPreview(null);
      router.refresh();
    } catch {
      setError(d.errors.unavailable);
    } finally {
      setBusy(null);
    }
  }
  return (
    <div>
      <div className="template-grid" aria-busy={busy !== null}>
        {TEMPLATE_IDS.map((id, index) => (
          <article className="template-card" key={id} data-template={id}>
            <TemplateThumbnail id={id} locale={locale} />
            <div className="template-card-meta">
              <span aria-hidden="true">
                {String(index + 1).padStart(2, '0')} / FOLYO
              </span>
              <span>
                {buildTemplate(id, locale).pages.length} {d.dashboardHub.pages}
              </span>
            </div>
            <h3>{d.templates.names[id]}</h3>
            <p>{d.templates.descriptions[id]}</p>
            <Button
              variant="ghost"
              disabled={busy !== null}
              onClick={() => {
                setError('');
                setPreview(id);
              }}
            >
              {d.templates.viewExample}
            </Button>
            {settings ? (
              <>
                <Button
                  disabled={busy !== null}
                  onClick={() => void apply(id, true)}
                >
                  {d.templates.applyStyle}
                </Button>
                <span
                  tabIndex={canApplyContent ? undefined : 0}
                  title={
                    canApplyContent ? undefined : d.templates.contentDisabled
                  }
                >
                  <Button
                    disabled={busy !== null || !canApplyContent}
                    aria-describedby={`template-note-${id}`}
                    onClick={() => void apply(id)}
                  >
                    {d.templates.applyContent}
                  </Button>
                </span>
                <small id={`template-note-${id}`}>
                  {canApplyContent
                    ? d.templates.contentNote.replace(
                        '{count}',
                        String(buildTemplate(id, locale).pages.length),
                      )
                    : d.templates.contentDisabled}
                </small>
              </>
            ) : (
              <Button
                variant="primary"
                disabled={busy !== null}
                onClick={() => void apply(id)}
              >
                {busy === id ? d.busy : d.templates.choose}
              </Button>
            )}
          </article>
        ))}
      </div>
      {preview && (
        <TemplatePreviewModal
          templateId={preview}
          locale={locale}
          d={d}
          onClose={() => setPreview(null)}
          onUse={() => void apply(preview)}
          busy={busy !== null}
          error={error}
        />
      )}
      <p role="status" className="appearance-status">
        {message}
      </p>
      <p role="alert">{error}</p>
      {onboarding && <p>{d.templates.intro}</p>}
    </div>
  );
}
const fontPairs = [
  { value: 'inter', label: 'Inter · Inter', body: 'inter' },
  { value: 'playfair', label: 'Playfair · Inter', body: 'inter' },
  { value: 'space-grotesk', label: 'Space Grotesk · Inter', body: 'inter' },
  { value: 'lora', label: 'Lora · Source Sans', body: 'source-sans' },
] as const;
export function AppearanceSettings({
  d,
  siteId,
  initialTheme,
}: {
  d: Dictionary;
  siteId: string;
  initialTheme: unknown;
}) {
  const router = useRouter();
  const [theme, setTheme] = useState(() => resolveTheme(initialTheme));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function save(patch: ThemePatch) {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const result = await mutate('/api/site/theme', 'PATCH', patch);
      setTheme(resolveTheme(result.theme));
      setMessage(d.templates.saved);
      router.refresh();
    } catch {
      setError(d.errors.unavailable);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="appearance-section">
        <div className="appearance-heading">
          <h2>{d.templates.appearance}</h2>
          <ButtonLink
            href={`/p/${siteId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {d.preview}
          </ButtonLink>
        </div>
        <fieldset disabled={busy} className="accent-picker">
          <legend>{d.templates.accent}</legend>
          <div
            className="accent-swatches"
            role="radiogroup"
            aria-label={d.templates.accent}
          >
            {ACCENT_PALETTE.map((accent) => (
              <label
                key={accent}
                className="accent-swatch"
                style={{ '--swatch': accent } as CSSProperties}
              >
                <input
                  type="radio"
                  name="accent"
                  value={accent}
                  aria-label={accent}
                  checked={theme.accent === accent}
                  onChange={() => void save({ accent })}
                />
                <span aria-hidden="true">
                  {theme.accent === accent ? '✓' : ''}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="appearance-control">
          <span>{d.templates.typography}</span>
          <Select
            aria-label={d.templates.typography}
            disabled={busy}
            value={theme.headingFont}
            options={fontPairs.map((pair) => ({
              value: pair.value,
              label: pair.label,
              icon: (
                <span
                  className="font-option-preview"
                  style={
                    themeToStyle({
                      ...theme,
                      headingFont: pair.value,
                      bodyFont: pair.body,
                    }) as CSSProperties
                  }
                >
                  <strong>Aa</strong>
                  <small>Aa</small>
                </span>
              ),
            }))}
            onValueChange={(value) => {
              const pair = fontPairs.find((pair) => pair.value === value);
              if (pair)
                void save({ headingFont: pair.value, bodyFont: pair.body });
            }}
          />
        </div>
        <div
          className="font-pair-preview"
          style={themeToStyle(theme) as CSSProperties}
        >
          <strong>{d.templates.fontSample}</strong>
          <p>{d.templates.intro}</p>
        </div>
        <div className="appearance-control">
          <span>{d.templates.heroLayout}</span>
          <Select
            aria-label={d.templates.heroLayout}
            disabled={busy}
            value={theme.heroLayout}
            options={[
              { value: 'center', label: d.templates.center },
              { value: 'left', label: d.templates.left },
            ]}
            onValueChange={(value) => {
              if (value === 'center' || value === 'left')
                void save({ heroLayout: value });
            }}
          />
        </div>
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
      </section>
    </>
  );
}
