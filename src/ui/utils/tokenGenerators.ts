import { ExtractedColor } from '../../main/types';

function sanitizeTokenName(name: string, fallback: string): string {
  const clean = name
    .toLowerCase()
    .replace(/[/\\_.]/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return clean || fallback;
}

export function generateCssVariables(colors: ExtractedColor[]): string {
  const lines = [':root {'];
  colors.forEach((c, i) => {
    const varName = sanitizeTokenName(c.name || `color-${i + 1}`, `color-${i + 1}`);
    const comment = c.usageCount > 0 ? ` /* Used ${c.usageCount} times */` : '';
    lines.push(`  --${varName}: ${c.hex};${comment}`);
  });
  lines.push('}');
  return lines.join('\n');
}

export function generateScssVariables(colors: ExtractedColor[]): string {
  return colors
    .map((c, i) => {
      const varName = sanitizeTokenName(c.name || `color-${i + 1}`, `color-${i + 1}`);
      const comment = c.usageCount > 0 ? ` // Used ${c.usageCount} times` : '';
      return `$${varName}: ${c.hex};${comment}`;
    })
    .join('\n');
}

export function generateTailwindConfig(colors: ExtractedColor[]): string {
  const colorObj: Record<string, string> = {};
  colors.forEach((c, i) => {
    const key = sanitizeTokenName(c.name || `color-${i + 1}`, `color-${i + 1}`);
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
    const key = sanitizeTokenName(c.name || `color-${i + 1}`, `color-${i + 1}`);
    tokens[key] = {
      $value: c.hex,
      $type: 'color',
      $description: c.name ? `Figma style: ${c.name}` : `Extracted color (usage count: ${c.usageCount})`,
      $extensions: {
        figma: {
          source: c.source,
          usageCount: c.usageCount,
          rgb: c.rgb,
        },
      },
    };
  });

  return JSON.stringify({ color: tokens }, null, 2);
}

