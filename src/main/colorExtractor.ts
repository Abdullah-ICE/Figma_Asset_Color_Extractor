import { ExtractedColor } from './types';

function figmaColorToHex(color: RGB, opacity = 1): string {
  const r = Math.min(255, Math.max(0, Math.round(color.r * 255)));
  const g = Math.min(255, Math.max(0, Math.round(color.g * 255)));
  const b = Math.min(255, Math.max(0, Math.round(color.b * 255)));
  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();

  if (opacity < 0.999) {
    const a = Math.min(255, Math.max(0, Math.round(opacity * 255)));
    return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a)}`;
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function extractProjectColors(rootNodes: readonly SceneNode[]): ExtractedColor[] {
  const colorMap = new Map<string, ExtractedColor>();

  // 1. Extract Local Paint Styles
  try {
    const localStyles = figma.getLocalPaintStyles();
    for (const style of localStyles) {
      for (const paint of style.paints) {
        if (paint.type === 'SOLID' && paint.visible !== false) {
          const alpha = paint.opacity ?? 1;
          const hex = figmaColorToHex(paint.color, alpha);
          colorMap.set(hex, {
            hex,
            rgb: {
              r: Math.round(paint.color.r * 255),
              g: Math.round(paint.color.g * 255),
              b: Math.round(paint.color.b * 255),
              a: Number(alpha.toFixed(2)),
            },
            name: style.name,
            usageCount: 0,
            source: 'style',
          });
        }
      }
    }
  } catch (err) {
    console.warn('Could not read local paint styles:', err);
  }

  // 2. Extract Local Variables (Figma Variables API)
  try {
    if (figma.variables && typeof figma.variables.getLocalVariables === 'function') {
      const colorVariables = figma.variables.getLocalVariables('COLOR');
      for (const variable of colorVariables) {
        const defaultModeId = Object.keys(variable.valuesByMode)[0];
        const val = variable.valuesByMode[defaultModeId];
        if (val && typeof val === 'object' && 'r' in val) {
          const colorVal = val as RGBA;
          const alpha = colorVal.a ?? 1;
          const hex = figmaColorToHex(colorVal, alpha);
          if (!colorMap.has(hex)) {
            colorMap.set(hex, {
              hex,
              rgb: {
                r: Math.round(colorVal.r * 255),
                g: Math.round(colorVal.g * 255),
                b: Math.round(colorVal.b * 255),
                a: Number(alpha.toFixed(2)),
              },
              name: variable.name,
              usageCount: 0,
              source: 'variable',
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('Could not read local variables:', err);
  }

  // 3. Recursive Scene Graph Walk for Raw Node Colors & Frequency
  function inspectPaints(paints: readonly Paint[] | PluginAPI['mixed']) {
    if (!Array.isArray(paints)) return;
    for (const paint of paints) {
      if (paint.type === 'SOLID' && paint.visible !== false) {
        const alpha = paint.opacity ?? 1;
        const hex = figmaColorToHex(paint.color, alpha);
        const existing = colorMap.get(hex);
        if (existing) {
          existing.usageCount++;
        } else {
          colorMap.set(hex, {
            hex,
            rgb: {
              r: Math.round(paint.color.r * 255),
              g: Math.round(paint.color.g * 255),
              b: Math.round(paint.color.b * 255),
              a: Number(alpha.toFixed(2)),
            },
            usageCount: 1,
            source: 'raw_node',
          });
        }
      }
    }
  }

  function walk(node: SceneNode) {
    if (!node.visible) return;

    if ('fills' in node) {
      inspectPaints(node.fills);
    }
    if ('strokes' in node) {
      inspectPaints(node.strokes);
    }

    if ('children' in node) {
      for (const child of (node as ChildrenMixin).children) {
        walk(child);
      }
    }
  }

  for (const root of rootNodes) {
    walk(root);
  }

  // Return sorted by usageCount descending (most frequently used colors first)
  return Array.from(colorMap.values()).sort((a, b) => {
    if (a.source === 'style' && b.source !== 'style') return -1;
    if (b.source === 'style' && a.source !== 'style') return 1;
    return b.usageCount - a.usageCount;
  });
}

