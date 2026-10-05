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
import type { Dictionary } from '../lib/i18n';
import { buildTemplate } from '../lib/templates';
import { Button, ButtonLink } from './ui/button';
import { Select } from './ui/select';
export function TemplateThumbnail({ id }: { id: TemplateId }) {
  if (
    id === 'executive' ||
    id === 'studio' ||
    id === 'scientist' ||
    id === 'developer'
  )
    return <ShowcaseThumbnail id={id} />;
  const accent = {
    blank: '#16161D',
    minimal: '#16161D',
    professional: '#1E5AA8',
    creative: '#FF5C38',
  }[id];
  const x = id === 'professional' ? 28 : 100;
  return (
    <svg
      className="template-thumbnail"
      viewBox="0 0 240 160"
      aria-hidden="true"
    >
      <rect width="240" height="160" rx="8" fill="#faf9f6" />
      {id !== 'blank' && (
        <g fill="#d7d5ce">
          <rect x="84" y="14" width="20" height="3" rx="1" />
          <rect x="111" y="14" width="20" height="3" rx="1" />
          <rect x="138" y="14" width="20" height="3" rx="1" />
        </g>
      )}
      {id === 'creative' && <circle cx="120" cy="38" r="12" fill="#ffe5dc" />}
      <rect
        x={id === 'creative' ? 85 : x - (id === 'professional' ? 0 : 20)}
        y={id === 'creative' ? 58 : 48}
        width="80"
        height={id === 'minimal' ? 8 : 7}
        rx="2"
        fill={accent}
      />
      <rect
        x={id === 'professional' ? 28 : 94}
        y="73"
        width="52"
        height="3"
        rx="1"
        fill="#8a8894"
      />
      {id !== 'blank' && (
        <>
          {id === 'creative' ? (
            <g>
              {['#ffe5dc', '#dde8fa', '#ddf0e8'].map((fill, i) => (
                <rect
                  key={fill}
                  x={28 + i * 64}
                  y="90"
                  width="56"
                  height="42"
                  rx="3"
                  fill={fill}
                />
              ))}
            </g>
          ) : (
            <g fill="#d7d5ce">
              {[92, 101, 110].map((y) => (
                <rect
                  key={y}
                  x="28"
                  y={y}
                  width={y === 110 ? 136 : 184}
                  height="3"
                  rx="1"
                />
              ))}
            </g>
          )}
          {id === 'professional' ? (
            <rect x="28" y="128" width="50" height="14" rx="3" fill={accent} />
          ) : (
            <g fill={accent}>
              {[110, 120, 130].map((cx) => (
                <circle key={cx} cx={cx} cy="146" r="2" />
              ))}
            </g>
          )}
        </>
      )}
    </svg>
  );
}
function ShowcaseThumbnail({
  id,
}: {
  id: 'executive' | 'studio' | 'scientist' | 'developer';
}) {
  const colors = {
    executive: '#16161D',
    studio: '#7C3AED',
    scientist: '#0F766E',
    developer: '#1E5AA8',
  };
  const color = colors[id];
  return (
    <svg
      className="template-thumbnail"
      viewBox="0 0 240 160"
      aria-hidden="true"
    >
      <rect width="240" height="160" rx="8" fill="#faf9f6" />
      <g fill="#d7d5ce">
        {[124, 146, 168, 190, 212].map((x) => (
          <rect key={x} x={x} y="12" width="14" height="2" rx="1" />
        ))}
      </g>
      <rect
        x={id === 'studio' ? 62 : 18}
        y="32"
        width={id === 'executive' ? 148 : 116}
        height={id === 'executive' ? 10 : 8}
        rx="1"
        fill={color}
      />
      <rect
        x={id === 'studio' ? 88 : 18}
        y="48"
        width="64"
        height="3"
        rx="1"
        fill="#8a8894"
      />
      <rect
        x={id === 'studio' ? 30 : 18}
        y="62"
        width={id === 'studio' ? 180 : 162}
        height="2"
        rx="1"
        fill="#d7d5ce"
      />
      <rect
        x={id === 'studio' ? 86 : 18}
        y="72"
        width="68"
        height="8"
        rx="2"
        fill={color}
      />
      <rect
        x="18"
        y="92"
        width="204"
        height="51"
        rx="3"
        fill={
          id === 'studio'
            ? '#7C3AED'
            : id === 'scientist'
              ? '#EAF2EE'
              : id === 'developer'
                ? '#E5EDF8'
                : '#EEEAE1'
        }
      />
      {id === 'executive' && (
        <>
          <rect x="148" y="99" width="31" height="44" fill="#B3A68E" />
          <rect x="123" y="114" width="31" height="29" fill="#16161D" />
          <circle cx="106" cy="108" r="8" fill="#C59C62" />
          <rect x="72" y="129" width="42" height="14" fill="#D5C8AA" />
        </>
      )}
      {id === 'studio' && (
        <>
          <circle cx="168" cy="117" r="22" fill="#FF5C38" />
          <circle cx="168" cy="117" r="11" fill="#D5EC6B" />
          <rect x="33" y="100" width="16" height="35" fill="#D5EC6B" />
          <rect x="56" y="100" width="16" height="35" fill="#FAF9F6" />
          <rect x="79" y="100" width="16" height="35" fill="#FF5C38" />
        </>
      )}
      {id === 'scientist' && (
        <>
          <g stroke="#C1DACE" strokeWidth=".5">
            {[103, 114, 125, 136].map((y) => (
              <path key={y} d={`M32 ${y}H210`} />
            ))}
          </g>
          <path
            d="M32 130L54 116L78 122L99 105L123 112L147 102L171 110L207 99"
            fill="none"
            stroke={color}
            strokeWidth="2"
          />
        </>
      )}
      {id === 'developer' && (
        <>
          <rect x="42" y="98" width="158" height="39" rx="2" fill="#FAFCFF" />
          <rect x="42" y="98" width="158" height="5" rx="2" fill="#161E30" />
          <rect x="42" y="103" width="25" height="34" fill="#D8E1EE" />
          {[76, 116, 156].map((x) => (
            <g key={x}>
              <rect x={x} y="108" width="32" height="8" rx="1" fill="#E5EDF8" />
              <rect
                x={x}
                y="121"
                width="32"
                height="9"
                rx="1"
                fill="#1E5AA8"
                opacity=".7"
              />
            </g>
          ))}
        </>
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
        {TEMPLATE_IDS.map((id) => (
          <article className="template-card" key={id}>
            <TemplateThumbnail id={id} />
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
