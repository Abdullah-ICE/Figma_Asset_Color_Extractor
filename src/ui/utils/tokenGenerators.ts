import { ExtractedColor, ExtractedTypography } from '../../main/types';

function sanitizeTokenName(name: string, fallback: string): string {
  const clean = name
    .toLowerCase()
    .replace(/[/\\_.]/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return clean || fallback;
}

function getFallbackName(c: ExtractedColor, i: number): string {
  if (c.roles && c.roles.length > 0) {
    if (c.roles.includes('text')) return `text-${i + 1}`;
    if (c.roles.includes('surface')) return `surface-${i + 1}`;
    if (c.roles.includes('border')) return `border-${i + 1}`;
  }
  return `color-${i + 1}`;
}

export function generateCssVariables(colors: ExtractedColor[]): string {
  const lines = [':root {'];
  colors.forEach((c, i) => {
    const fallback = getFallbackName(c, i);
    const varName = sanitizeTokenName(c.name || fallback, fallback);
    const roleTag = c.roles && c.roles.length > 0 ? ` [${c.roles.join(', ')}]` : '';
    const comment = c.usageCount > 0 ? ` /* Used ${c.usageCount} times${roleTag} */` : '';
    lines.push(`  --${varName}: ${c.hex};${comment}`);
  });
  lines.push('}');
  return lines.join('\n');
}

export function generateScssVariables(colors: ExtractedColor[]): string {
  return colors
    .map((c, i) => {
      const fallback = getFallbackName(c, i);
      const varName = sanitizeTokenName(c.name || fallback, fallback);
      const roleTag = c.roles && c.roles.length > 0 ? ` [${c.roles.join(', ')}]` : '';
      const comment = c.usageCount > 0 ? ` // Used ${c.usageCount} times${roleTag}` : '';
      return `$${varName}: ${c.hex};${comment}`;
    })
    .join('\n');
}

export function generateTailwindConfig(colors: ExtractedColor[]): string {
  const colorObj: Record<string, string> = {};
  colors.forEach((c, i) => {
    const fallback = getFallbackName(c, i);
    const key = sanitizeTokenName(c.name || fallback, fallback);
    colorObj[key] = c.hex;
  });

  return `// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: ${JSON.stringify(
    colorObj,
    null,
    6
  )}\n    }\n  }\n};`;
}

export function generateDesignTokensJson(colors: ExtractedColor[]): string {
  const tokens: Record<string, any> = {};

  colors.forEach((c, i) => {
    const fallback = getFallbackName(c, i);
    const key = sanitizeTokenName(c.name || fallback, fallback);
    tokens[key] = {
      $value: c.hex,
      $type: 'color',
      $description: c.name ? `Figma token: ${c.name}` : `Extracted color (${(c.roles || []).join(', ')})`,
      $extensions: {
        figma: {
          source: c.source,
          usageCount: c.usageCount,
          roles: c.roles || [],
          rgb: c.rgb,
        },
      },
    };
  });

  return JSON.stringify({ color: tokens }, null, 2);
}

// ==========================================
// TYPOGRAPHY & FONT STYLE TOKEN GENERATORS
// ==========================================

export function generateTypographyCss(typoList: ExtractedTypography[]): string {
  const lines = [':root {'];

  // Font Families
  const families = Array.from(new Set(typoList.map(t => t.fontFamily)));
  families.forEach((f, i) => {
    const varName = i === 0 ? 'font-primary' : `font-secondary-${i}`;
    lines.push(`  --${varName}: '${f}', sans-serif;`);
  });

  lines.push('');

  // Font Sizes
  const sizes = Array.from(new Set(typoList.map(t => t.fontSize))).sort((a, b) => b - a);
  sizes.forEach(s => {
    lines.push(`  --font-size-${s}: ${s}px;`);
  });

  lines.push('');

  // Typography Styles
  typoList.slice(0, 20).forEach((t, i) => {
    const name = sanitizeTokenName(t.name || `text-${t.fontSize}-${t.fontStyle.toLowerCase()}`, `text-${i + 1}`);
    const comment = t.usageCount > 0 ? ` /* Used ${t.usageCount} times */` : '';
    lines.push(`  --typo-${name}: ${t.fontWeight} ${t.fontSize}px/${t.lineHeight} '${t.fontFamily}';${comment}`);
  });

  lines.push('}');
  return lines.join('\n');
}

export function generateTypographyTailwind(typoList: ExtractedTypography[]): string {
  const families = Array.from(new Set(typoList.map(t => t.fontFamily)));
  const fontFamilyObj: Record<string, string[]> = {};
  families.forEach((f, i) => {
    const key = i === 0 ? 'sans' : sanitizeTokenName(f, `font-${i}`);
    fontFamilyObj[key] = [f, 'sans-serif'];
  });

  const sizes = Array.from(new Set(typoList.map(t => t.fontSize))).sort((a, b) => a - b);
  const fontSizeObj: Record<string, string> = {};
  sizes.forEach(s => {
    fontSizeObj[`${s}`] = `${s}px`;
  });

  return `// tailwind.config.js - Typography\nmodule.exports = {\n  theme: {\n    extend: {\n      fontFamily: ${JSON.stringify(
    fontFamilyObj,
    null,
    8
  )},\n      fontSize: ${JSON.stringify(fontSizeObj, null, 8)}\n    }\n  }\n};`;
}

export function generateTypographyScss(typoList: ExtractedTypography[]): string {
  const lines: string[] = [];

  const families = Array.from(new Set(typoList.map(t => t.fontFamily)));
  families.forEach((f, i) => {
    const varName = i === 0 ? 'font-family-primary' : `font-family-${i}`;
    lines.push(`$${varName}: '${f}', sans-serif;`);
  });

  const sizes = Array.from(new Set(typoList.map(t => t.fontSize))).sort((a, b) => b - a);
  sizes.forEach(s => {
    lines.push(`$font-size-${s}: ${s}px;`);
  });

  return lines.join('\n');
}

export function generateTypographyJson(typoList: ExtractedTypography[]): string {
  const tokens: Record<string, any> = {};

  typoList.forEach((t, i) => {
    const key = sanitizeTokenName(t.name || `typography-${t.fontSize}-${t.fontStyle.toLowerCase()}`, `typo-${i + 1}`);
    tokens[key] = {
      $type: 'typography',
      $value: {
        fontFamily: t.fontFamily,
        fontSize: `${t.fontSize}px`,
        fontWeight: t.fontWeight,
        fontStyle: t.fontStyle,
        lineHeight: t.lineHeight,
        letterSpacing: t.letterSpacing,
      },
      $extensions: {
        figma: {
          styleName: t.name || null,
          usageCount: t.usageCount,
          source: t.source,
        },
      },
    };
  });

  return JSON.stringify({ typography: tokens }, null, 2);
}
