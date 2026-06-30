import { tokens, shadowToCss } from './tokens.js';
import { statusColors } from './status.js';

/** camelCase / Pascal_Snake → kebab-case for CSS variable names. */
function kebab(name: string): string {
  return name
    .replace(/_/g, '-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Build the design-token CSS custom properties as a `:root` rule.
 */
export function toCss(): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(':root {');

  lines.push('  /* color */');
  for (const [name, value] of Object.entries(tokens.colors)) {
    lines.push(`  --color-${kebab(name)}: ${value};`);
  }

  lines.push('  /* typography */');
  lines.push(`  --font-sans: ${tokens.typography.fontSans};`);
  lines.push(`  --font-mono: ${tokens.typography.fontMono};`);
  for (const [name, value] of Object.entries(tokens.typography.fontSize)) {
    lines.push(`  --font-size-${kebab(name)}: ${value}px;`);
  }
  for (const [name, value] of Object.entries(tokens.typography.fontWeight)) {
    lines.push(`  --font-weight-${kebab(name)}: ${value};`);
  }
  for (const [name, value] of Object.entries(tokens.typography.lineHeight)) {
    lines.push(`  --line-height-${kebab(name)}: ${value};`);
  }

  lines.push('  /* spacing */');
  for (const [name, value] of Object.entries(tokens.spacing)) {
    lines.push(`  --space-${name}: ${value}px;`);
  }

  lines.push('  /* radius */');
  for (const [name, value] of Object.entries(tokens.radius)) {
    lines.push(`  --radius-${kebab(name)}: ${value}px;`);
  }

  lines.push('  /* shadow */');
  for (const [name, value] of Object.entries(tokens.shadows)) {
    lines.push(`  --shadow-${kebab(name)}: ${shadowToCss(value)};`);
  }

  lines.push('  /* status colors (reference the semantic color tokens) */');
  for (const [status, token] of Object.entries(statusColors.driver)) {
    lines.push(`  --status-driver-${kebab(status)}: var(--color-${kebab(token)});`);
  }
  for (const [status, token] of Object.entries(statusColors.delivery)) {
    lines.push(`  --status-delivery-${kebab(status)}: var(--color-${kebab(token)});`);
  }

  lines.push('}');
  lines.push('');
  return lines.join('\n');
}
