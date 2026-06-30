# SprintOps AI — UI Tokens

Use CSS custom properties as the visual source of truth. Components consume semantic tokens and must not contain raw hex values.

## Token Definition

Target location: `apps/desktop/src/renderer/styles/tokens.css` during migration. Until then, keep equivalent variables in the active renderer stylesheet.

```css
:root {
  color-scheme: light;

  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;

  --color-canvas: #f6f7fb;
  --color-surface: #ffffff;
  --color-surface-subtle: #f9fafb;
  --color-surface-muted: #f1f3f7;
  --color-overlay: rgba(15, 23, 42, 0.48);

  --color-border: #e2e7f0;
  --color-border-strong: #cfd6e3;

  --color-text: #101828;
  --color-text-secondary: #586174;
  --color-text-muted: #8b95a7;
  --color-text-inverse: #ffffff;

  --color-primary: #6f56e8;
  --color-primary-hover: #5e46d2;
  --color-primary-subtle: #f0edff;
  --color-focus: #7c5cfc;

  --color-info: #3478f6;
  --color-info-subtle: #eaf2ff;
  --color-success: #12805c;
  --color-success-subtle: #e7f7f0;
  --color-warning: #b65c00;
  --color-warning-subtle: #fff4df;
  --color-danger: #c63d4f;
  --color-danger-subtle: #ffedef;

  --color-ai: #6842d9;
  --color-ai-subtle: #f1edff;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 999px;

  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.06);
  --shadow-md: 0 8px 24px rgba(15, 23, 42, 0.10);

  --sidebar-width: 232px;
  --topbar-height: 56px;
  --control-height: 36px;
  --control-height-lg: 42px;

  --transition-fast: 120ms ease;
  --transition-normal: 180ms ease;
}
```

## Semantic Usage

| Purpose | Token |
| --- | --- |
| Application background | `--color-canvas` |
| Primary surface | `--color-surface` |
| Inputs and secondary areas | `--color-surface-subtle` |
| Primary text | `--color-text` |
| Labels and secondary text | `--color-text-secondary` |
| Timestamps and placeholders | `--color-text-muted` |
| Primary action | `--color-primary` |
| Keyboard focus | `--color-focus` |
| In progress/information | `--color-info` |
| Completed/healthy | `--color-success` |
| Attention/moderate risk | `--color-warning` |
| Blocked/failure/high risk | `--color-danger` |
| AI-generated content | `--color-ai` |

## Work-Item Status Mapping

| Status | Treatment |
| --- | --- |
| Backlog | muted neutral |
| Ready | info-subtle with info text |
| In progress | info |
| Review | primary/AI-purple distinction through label and icon |
| Done | success |

## Risk Mapping

| Severity | Treatment |
| --- | --- |
| Low | neutral/info |
| Medium | warning |
| High | danger |

Confidence is displayed as text (`High confidence`, `Medium confidence`, `Low confidence`) and optional meter. Do not map confidence to the same colors used for severity.

## Component Baselines

### Card

```css
background: var(--color-surface);
border: 1px solid var(--color-border);
border-radius: var(--radius-lg);
box-shadow: var(--shadow-sm);
```

### Primary button

```css
min-height: var(--control-height);
padding: 0 var(--space-4);
background: var(--color-primary);
color: var(--color-text-inverse);
border-radius: var(--radius-md);
```

### Input

```css
min-height: var(--control-height);
padding: 0 var(--space-3);
background: var(--color-surface);
color: var(--color-text);
border: 1px solid var(--color-border-strong);
border-radius: var(--radius-md);
```

### Focus

```css
outline: 2px solid var(--color-focus);
outline-offset: 2px;
```

## Token Invariants

- Raw values live only in the token stylesheet or data-visualization configuration derived from tokens.
- Status colors keep the same meaning across backlog, sprint, repository, and AI screens.
- AI purple does not override risk severity colors.
- Dark mode is deferred; do not add ad hoc dark variants.
- Any new reusable value must be named semantically and added here before component use.
