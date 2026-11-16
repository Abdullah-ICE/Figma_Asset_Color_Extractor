import { ExtractedColor, ColorRole } from './types';

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

function getTopLevelScreenName(node: SceneNode): string {
  let curr: BaseNode | null = node;
  let topScreen = node.name;
  while (curr && curr.parent && curr.parent.type !== 'PAGE' && curr.parent.type !== 'DOCUMENT') {
    // If parent is a section, the artboard/screen is this curr node
    if (curr.parent.type === 'SECTION') {
      if ('name' in curr) topScreen = (curr as SceneNode).name;
      break;
    }
    curr = curr.parent;
    if ('name' in curr) {
      topScreen = (curr as SceneNode).name;
    }
  }
  return topScreen ? topScreen.trim() : 'Screen';
}

/**
 * Checks if a node represents an icon or icon-like container whose internal vector children
 * should NOT have their fills/strokes extracted into the developer color palette.
 */
function isIconCandidateContainer(node: SceneNode): boolean {
  // Pure vector elements
  if (['VECTOR', 'STAR', 'POLYGON', 'BOOLEAN_OPERATION'].includes(node.type)) {
    return true;
  }

  const w = node.width;
  const h = node.height;
  const isSmall = w <= 48 && h <= 48 && w >= 8 && h >= 8;
  const nameSuggestsIcon = /icon|ic[-_]|glyph|symbol/i.test(node.name);

  if ((isSmall || nameSuggestsIcon) && 'children' in node) {
    const children = (node as ChildrenMixin).children;
    if (children.length > 0) {
      // If it contains only vector shapes and NO text, it is an icon container
      const hasText = children.some(c => c.type === 'TEXT');
      if (!hasText) {
        return true;
      }
    }
  }

  return false;
}

interface ColorAccumulator {
  hex: string;
  rgb: { r: number; g: number; b: number; a: number };
  name?: string;
  usageCount: number;
  source: 'style' | 'variable' | 'raw_node';
  roles: Set<ColorRole>;
  screenNames: Set<string>;
}

export function extractProjectColors(rootNodes: readonly SceneNode[]): ExtractedColor[] {
  const colorMap = new Map<string, ColorAccumulator>();

  // 1. Extract Local Paint Styles (Official Design Tokens)
  try {
    const localStyles = figma.getLocalPaintStyles();
    for (const style of localStyles) {
      for (const paint of style.paints) {
        if (paint.type === 'SOLID' && paint.visible !== false) {
          const alpha = paint.opacity ?? 1;
          const hex = figmaColorToHex(paint.color, alpha);
          const existing = colorMap.get(hex);
          if (existing) {
            existing.roles.add('token');
            if (!existing.name) existing.name = style.name;
            if (existing.source !== 'variable') existing.source = 'style';
          } else {
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
              roles: new Set(['token']),
              screenNames: new Set(),
            });
          }
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
          const existing = colorMap.get(hex);
          if (existing) {
            existing.roles.add('token');
            if (!existing.name) existing.name = variable.name;
            existing.source = 'variable';
          } else {
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
              roles: new Set(['token']),
              screenNames: new Set(),
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('Could not read local variables:', err);
  }

  // Helper to record a color with its semantic role
  function recordColor(
    paints: readonly Paint[] | PluginAPI['mixed'],
    role: ColorRole,
    screenName: string
  ) {
    if (!Array.isArray(paints)) return;
    for (const paint of paints) {
      if (paint.type === 'SOLID' && paint.visible !== false) {
        const alpha = paint.opacity ?? 1;
        if (alpha < 0.01) continue; // Skip completely invisible/transparent alpha
        const hex = figmaColorToHex(paint.color, alpha);
        const existing = colorMap.get(hex);

        if (existing) {
          existing.usageCount++;
          existing.roles.add(role);
          if (screenName) existing.screenNames.add(screenName);
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
            roles: new Set([role]),
            screenNames: new Set(screenName ? [screenName] : []),
          });
        }
      }
    }
  }

  // 3. Strict Developer Scene Graph Walk
  function walk(node: SceneNode) {
    if (!node.visible) return;

    const screenName = getTopLevelScreenName(node);

    // Case A: Text Nodes -> Role is strictly 'text'
    if (node.type === 'TEXT') {
      if ('fills' in node) {
        recordColor(node.fills, 'text', screenName);
      }
      return;
    }

    // Case B: Pure Vector Shapes (Standalone vector paths, illustrations)
    // Developers don't extract individual path colors from SVG illustrations/icons
    if (['VECTOR', 'STAR', 'POLYGON', 'BOOLEAN_OPERATION'].includes(node.type)) {
      return; // Skip vector paths completely
    }

    // Case C: Icon Container (e.g., Icon button or Icon component)
    // If it has a background fill (e.g. an icon button circle/rect), extract that as 'surface',
    // but DO NOT traverse into its internal vector children!
    if (isIconCandidateContainer(node)) {
      if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0) {
        recordColor(node.fills, 'surface', screenName);
      }
      if ('strokes' in node && Array.isArray(node.strokes) && node.strokes.length > 0) {
        recordColor(node.strokes, 'border', screenName);
      }
      return; // Stop here! Do not inspect internal icon vectors.
    }

    // Case D: UI Containers (Frames, Components, Instances, Rectangles, Ellipses, Lines)
    if ('fills' in node && Array.isArray(node.fills)) {
      // Large surfaces or containers = 'surface'
      recordColor(node.fills, 'surface', screenName);
    }

    if ('strokes' in node && Array.isArray(node.strokes)) {
      // Borders, dividers, outlines = 'border'
      recordColor(node.strokes, 'border', screenName);
    }

    // Recurse down children for UI components and nested containers
    if ('children' in node) {
      for (const child of (node as ChildrenMixin).children) {
        walk(child);
      }
    }
  }

  for (const root of rootNodes) {
    walk(root);
  }

  // Convert ColorAccumulator to ExtractedColor array
  const result: ExtractedColor[] = Array.from(colorMap.values()).map(item => ({
    hex: item.hex,
    rgb: item.rgb,
    name: item.name,
    usageCount: item.usageCount,
    source: item.source,
    roles: Array.from(item.roles),
    screenNames: Array.from(item.screenNames),
  }));

  // Sort: Design Tokens first, then by usage count descending
  return result.sort((a, b) => {
    const aIsToken = a.source === 'style' || a.source === 'variable';
    const bIsToken = b.source === 'style' || b.source === 'variable';
    if (aIsToken && !bIsToken) return -1;
    if (bIsToken && !aIsToken) return 1;
    return b.usageCount - a.usageCount;
  });
}
