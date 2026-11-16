import { ComponentCategory, ComponentCluster, ComponentInstanceItem, ComponentProperties } from './types';

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
  return 400;
}

function getTopLevelScreenName(node: SceneNode): string {
  let curr: BaseNode | null = node;
  let topScreen = node.name;
  while (curr && curr.parent && curr.parent.type !== 'PAGE' && curr.parent.type !== 'DOCUMENT') {
    curr = curr.parent;
    if ('name' in curr) {
      topScreen = (curr as SceneNode).name;
    }
  }
  return topScreen;
}

function extractNodeProperties(node: FrameNode | ComponentNode | InstanceNode): ComponentProperties {
  const width = Math.round(node.width);
  const height = Math.round(node.height);

  // Exact Corner radius
  let cornerRadius: number | string = 0;
  if ('cornerRadius' in node && node.cornerRadius !== figma.mixed) {
    cornerRadius = Math.round(node.cornerRadius as number);
  } else if ('topLeftRadius' in node) {
    const tl = Math.round(node.topLeftRadius);
    const tr = Math.round(node.topRightRadius);
    const br = Math.round(node.bottomRightRadius);
    const bl = Math.round(node.bottomLeftRadius);
    if (tl === tr && tr === br && br === bl) {
      cornerRadius = tl;
    } else {
      cornerRadius = `${tl}, ${tr}, ${br}, ${bl}`;
    }
  }

  // Exact Fills
  const fills: string[] = [];
  if (Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (fill.type === 'SOLID' && fill.visible !== false) {
        fills.push(figmaColorToHex(fill.color, fill.opacity ?? 1));
      }
    }
  }

  // Exact Strokes
  const strokes: { color: string; weight: number }[] = [];
  if (Array.isArray(node.strokes)) {
    const weight = typeof node.strokeWeight === 'number' ? Math.round(node.strokeWeight) : 1;
    for (const stroke of node.strokes) {
      if (stroke.type === 'SOLID' && stroke.visible !== false) {
        strokes.push({
          color: figmaColorToHex(stroke.color, stroke.opacity ?? 1),
          weight,
        });
      }
    }
  }

  // Exact AutoLayout & Spacing
  const padding = {
    top: typeof node.paddingTop === 'number' ? Math.round(node.paddingTop) : 0,
    right: typeof node.paddingRight === 'number' ? Math.round(node.paddingRight) : 0,
    bottom: typeof node.paddingBottom === 'number' ? Math.round(node.paddingBottom) : 0,
    left: typeof node.paddingLeft === 'number' ? Math.round(node.paddingLeft) : 0,
  };
  const gap = typeof node.itemSpacing === 'number' ? Math.round(node.itemSpacing) : 0;
  const layoutMode = node.layoutMode || 'NONE';

  // Typography (first text child)
  let typography: ComponentProperties['typography'] = undefined;
  for (const child of node.children) {
    if (child.type === 'TEXT') {
      const textNode = child as TextNode;
      const fn = textNode.fontName !== figma.mixed ? (textNode.fontName as FontName) : null;
      const fs = textNode.fontSize !== figma.mixed ? Math.round(textNode.fontSize as number) : 14;
      if (fn && fn.family) {
        typography = {
          family: fn.family,
          size: fs,
          weight: parseFontWeight(fn.style),
          text: textNode.characters.slice(0, 30),
        };
        break;
      }
    }
  }

  return {
    width,
    height,
    cornerRadius,
    fills,
    strokes,
    padding,
    gap,
    layoutMode,
    typography,
  };
}

function detectCategory(node: SceneNode, props: ComponentProperties): ComponentCategory {
  const name = node.name.toLowerCase();
  const w = props.width;
  const h = props.height;
  const ratio = w / Math.max(1, h);

  // Avatar / Profile icon
  if (Math.abs(w - h) <= 2 && w >= 20 && w <= 96 && (typeof props.cornerRadius === 'number' && props.cornerRadius >= w / 2 - 2)) {
    return 'avatar';
  }
  if (name.includes('avatar') || name.includes('profile-pic') || name.includes('user-img')) {
    return 'avatar';
  }

  // Button
  if (
    name.includes('btn') ||
    name.includes('button') ||
    name.includes('cta') ||
    name.includes('submit') ||
    name.includes('action') ||
    name.includes('login') ||
    name.includes('signup')
  ) {
    return 'button';
  }
  if (h >= 24 && h <= 64 && w >= 48 && w <= 360 && ratio >= 1.5 && ratio <= 7 && props.typography) {
    return 'button';
  }

  // Input Field
  if (name.includes('input') || name.includes('field') || name.includes('search') || name.includes('textbox') || name.includes('form')) {
    return 'input';
  }
  if (h >= 32 && h <= 58 && w >= 140 && w <= 460 && ratio >= 2.5) {
    return 'input';
  }

  // Badge / Chip
  if (name.includes('badge') || name.includes('chip') || name.includes('tag') || name.includes('pill') || name.includes('status')) {
    return 'badge';
  }
  if (h >= 16 && h <= 32 && w >= 28 && w <= 160 && (typeof props.cornerRadius === 'number' && props.cornerRadius >= 8)) {
    return 'badge';
  }

  // Card
  if (name.includes('card') || name.includes('tile') || name.includes('panel') || name.includes('box') || name.includes('item-card')) {
    return 'card';
  }
  if (w >= 140 && h >= 90) {
    return 'card';
  }

  // Row item
  if (h >= 32 && h <= 88 && w >= 200 && ratio >= 3.5) {
    return 'row_item';
  }

  return 'other';
}

function cleanClusterName(name: string): string {
  return name
    .replace(/[/\\_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function auditProjectComponents(rootNodes: readonly SceneNode[]): ComponentCluster[] {
  const candidateInstances: {
    item: ComponentInstanceItem;
    category: ComponentCategory;
    node: FrameNode | ComponentNode | InstanceNode;
  }[] = [];

  const visited = new Set<string>();

  function traverse(node: SceneNode, pageName: string) {
    if (!node.visible || visited.has(node.id)) return;
    visited.add(node.id);

    // Identify candidate component nodes
    const isFrameLike = node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE';

    if (isFrameLike) {
      const frame = node as FrameNode | ComponentNode | InstanceNode;
      const w = frame.width;
      const h = frame.height;

      // Skip entire giant artboards / screens (> 800w and > 600h)
      const isGiantScreen = w >= 800 && h >= 600;
      // Skip pure tiny icons (<= 44x44 with 0 text layers)
      const isPureTinyIcon = w <= 44 && h <= 44;

      if (!isGiantScreen && !isPureTinyIcon && (frame.children && frame.children.length > 0)) {
        const props = extractNodeProperties(frame);
        const category = detectCategory(frame, props);

        candidateInstances.push({
          item: {
            nodeId: frame.id,
            name: frame.name,
            pageName,
            screenName: getTopLevelScreenName(frame),
            properties: props,
          },
          category,
          node: frame,
        });
      }
    }

    if ('children' in node && node.type !== 'BOOLEAN_OPERATION') {
      for (const child of (node as ChildrenMixin).children) {
        traverse(child, pageName);
      }
    }
  }

  for (const root of rootNodes) {
    let pageName = 'Page 1';
    let curr: BaseNode | null = root;
    while (curr) {
      if (curr.type === 'PAGE') {
        pageName = curr.name;
        break;
      }
      curr = curr.parent;
    }
    traverse(root, pageName);
  }

  // =========================================================================
  // STRICT EXACT MATCHING (100% SAME TO SAME)
  // No fuzzy tolerances. Width, Height, Radius, Colors, Strokes, & Padding
  // must match 100% exactly across instances!
  // =========================================================================
  const clusterBuckets = new Map<
    string,
    {
      category: ComponentCategory;
      representativeName: string;
      representativeNodeId: string;
      instances: ComponentInstanceItem[];
    }
  >();

  for (const { item, category, node } of candidateInstances) {
    const props = item.properties;

    // Build strict exact property fingerprint
    const fillsKey = props.fills.slice().sort().join(',');
    const strokesKey = props.strokes.map(s => `${s.color}:${s.weight}`).sort().join(',');
    const pad = props.padding;
    const padKey = `${pad.top}_${pad.right}_${pad.bottom}_${pad.left}`;

    // Exact fingerprint string: Size, Radius, Fills, Strokes, Layout, Padding
    const exactFingerprint = [
      category,
      `${props.width}x${props.height}`,
      `r:${props.cornerRadius}`,
      `f:${fillsKey}`,
      `s:${strokesKey}`,
      `l:${props.layoutMode}`,
      `p:${padKey}`,
    ].join('|');

    if (!clusterBuckets.has(exactFingerprint)) {
      clusterBuckets.set(exactFingerprint, {
        category,
        representativeName: cleanClusterName(item.name),
        representativeNodeId: node.id,
        instances: [],
      });
    }

    clusterBuckets.get(exactFingerprint)!.instances.push(item);
  }

  // =========================================================================
  // FILTERING: Keep ONLY clusters that appear 2 or more times (exact clones)
  // =========================================================================
  const clusters: ComponentCluster[] = [];

  for (const [clusterId, bucket] of clusterBuckets.entries()) {
    if (bucket.instances.length < 2) continue; // Must be repeated >= 2 times!

    const instances = bucket.instances;
    const totalOccurrences = instances.length;

    const firstProps = instances[0].properties;
    const sharedDimensions = { width: firstProps.width, height: firstProps.height };
    const sharedRadius = firstProps.cornerRadius;
    const sharedFills = firstProps.fills;

    // Pick the most common or clean name among the exact clones
    const nameCountMap = new Map<string, number>();
    for (const inst of instances) {
      const clean = cleanClusterName(inst.name);
      nameCountMap.set(clean, (nameCountMap.get(clean) || 0) + 1);
    }
    let topName = bucket.representativeName;
    let maxCount = 0;
    for (const [n, count] of nameCountMap.entries()) {
      if (count > maxCount) {
        maxCount = count;
        topName = n;
      }
    }

    clusters.push({
      clusterId,
      category: bucket.category,
      representativeName: topName,
      totalOccurrences,
      representativeNodeId: bucket.representativeNodeId,
      sharedDimensions,
      sharedRadius,
      sharedFills,
      instances,
      inconsistencies: {
        hasRadiusMismatch: false,
        hasColorMismatch: false,
        hasDimensionMismatch: false,
        details: [],
      },
    });
  }

  // Sort clusters by number of occurrences descending (most repeated clones first)
  return clusters.sort((a, b) => b.totalOccurrences - a.totalOccurrences);
}
