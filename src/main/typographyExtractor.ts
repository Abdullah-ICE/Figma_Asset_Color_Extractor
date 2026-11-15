import { ExtractedTypography } from './types';

function parseFontWeight(style: string): number {
  const s = style.toLowerCase();
  if (s.includes('thin') || s.includes('hairline')) return 100;
  if (s.includes('extralight') || s.includes('ultra light') || s.includes('extra light')) return 200;
  if (s.includes('light')) return 300;
  if (s.includes('medium')) return 500;
  if (s.includes('semibold') || s.includes('semi bold') || s.includes('demibold')) return 600;
  if (s.includes('extrabold') || s.includes('ultra bold') || s.includes('extra bold')) return 800;
  if (s.includes('black') || s.includes('heavy')) return 900;
  if (s.includes('bold')) return 700;
  return 400; // Regular / Normal default
}

function formatLineHeight(lh: LineHeight | typeof figma.mixed): string {
  if (!lh || lh === figma.mixed) return 'normal';
  if (lh.unit === 'AUTO') return 'normal';
  if (lh.unit === 'PERCENT') return `${Math.round(lh.value)}%`;
  return `${Math.round(lh.value)}px`;
}

function formatLetterSpacing(ls: LetterSpacing | typeof figma.mixed): string {
  if (!ls || ls === figma.mixed) return 'normal';
  if (ls.unit === 'PERCENT') return `${Math.round(ls.value)}%`;
  return `${Number(ls.value.toFixed(2))}px`;
}

export function extractProjectTypography(rootNodes: readonly SceneNode[]): ExtractedTypography[] {
  const typoMap = new Map<string, ExtractedTypography>();

  // 1. Extract from Figma Local Text Styles
  try {
    const textStyles = figma.getLocalTextStyles();
    for (const style of textStyles) {
      if (style.fontName && typeof style.fontName === 'object' && 'family' in style.fontName) {
        const fontName = style.fontName as FontName;
        const fontSize = Math.round(style.fontSize);
        const key = `${fontName.family}-${fontName.style}-${fontSize}`;

        typoMap.set(key, {
          id: style.id,
          name: style.name,
          fontFamily: fontName.family,
          fontStyle: fontName.style,
          fontWeight: parseFontWeight(fontName.style),
          fontSize,
          lineHeight: formatLineHeight(style.lineHeight),
          letterSpacing: formatLetterSpacing(style.letterSpacing),
          usageCount: 0,
          source: 'style',
        });
      }
    }
  } catch (err) {
    console.warn('Could not read local text styles:', err);
  }

  // 2. Recursive Scene Graph Walk for Raw Text Layers & Usage Counts
  function walk(node: SceneNode) {
    if (!node.visible) return;

    if (node.type === 'TEXT') {
      const textNode = node as TextNode;
      // Handle single font or check first character if mixed
      let fontName: FontName | null = null;
      let fontSize: number = 16;

      if (textNode.fontName !== figma.mixed) {
        fontName = textNode.fontName as FontName;
      } else if (textNode.characters.length > 0) {
        try {
          const fn = textNode.getRangeFontName(0, 1);
          if (fn !== figma.mixed) fontName = fn as FontName;
        } catch {}
      }

      if (textNode.fontSize !== figma.mixed) {
        fontSize = Math.round(textNode.fontSize as number);
      } else if (textNode.characters.length > 0) {
        try {
          const fs = textNode.getRangeFontSize(0, 1);
          if (typeof fs === 'number') fontSize = Math.round(fs);
        } catch {}
      }

      if (fontName && typeof fontName === 'object' && fontName.family) {
        const key = `${fontName.family}-${fontName.style}-${fontSize}`;
        const existing = typoMap.get(key);

        if (existing) {
          existing.usageCount++;
        } else {
          typoMap.set(key, {
            id: textNode.id,
            fontFamily: fontName.family,
            fontStyle: fontName.style,
            fontWeight: parseFontWeight(fontName.style),
            fontSize,
            lineHeight: formatLineHeight(textNode.lineHeight),
            letterSpacing: formatLetterSpacing(textNode.letterSpacing),
            usageCount: 1,
            source: 'raw_node',
          });
        }
      }
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

  // Return sorted by font size descending, then usage count descending
  return Array.from(typoMap.values()).sort((a, b) => {
    if (b.fontSize !== a.fontSize) return b.fontSize - a.fontSize;
    return b.usageCount - a.usageCount;
  });
}

