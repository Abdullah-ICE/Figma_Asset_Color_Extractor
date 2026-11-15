import { DetectedIcon, ScanConfig } from './types';

/**
 * Checks if a SceneNode meets the criteria of an icon
 */
export function isIconCandidate(node: SceneNode, config: ScanConfig): boolean {
  if (!node.visible) return false;

  // Filter by component types if enabled
  if (config.onlyComponents) {
    if (node.type !== 'COMPONENT' && node.type !== 'INSTANCE') {
      return false;
    }
  }

  // Allow frames, components, instances, boolean operations, or groups
  const allowedContainers = ['COMPONENT', 'INSTANCE', 'FRAME', 'GROUP', 'BOOLEAN_OPERATION'];
  if (!allowedContainers.includes(node.type)) {
    return false;
  }

  // Dimensions check
  const w = node.width;
  const h = node.height;
  if (w < config.minDimension || h < config.minDimension) return false;
  if (w > config.maxDimension || h > config.maxDimension) return false;

  // Aspect ratio check: icons are generally 1:1 square-ish (allow 20% variance)
  const ratio = w / h;
  if (ratio < 0.75 || ratio > 1.33) return false;

  // Vector density: Must contain vector elements and NO text layers
  if ('children' in node) {
    const children = (node as ChildrenMixin).children;
    if (children.length === 0 && node.type !== 'BOOLEAN_OPERATION') return false;

    if (hasTextLayer(node as ChildrenMixin)) return false;
    if (!hasAnyVectorLayer(node as ChildrenMixin)) return false;
  }

  return true;
}

function hasTextLayer(container: ChildrenMixin): boolean {
  for (const child of container.children) {
    if (child.type === 'TEXT') return true;
    if ('children' in child) {
      if (hasTextLayer(child as ChildrenMixin)) return true;
    }
  }
  return false;
}

function hasAnyVectorLayer(container: ChildrenMixin): boolean {
  const vectorTypes = ['VECTOR', 'BOOLEAN_OPERATION', 'ELLIPSE', 'LINE', 'POLYGON', 'STAR', 'RECTANGLE'];
  for (const child of container.children) {
    if (vectorTypes.includes(child.type)) return true;
    if ('children' in child) {
      if (hasAnyVectorLayer(child as ChildrenMixin)) return true;
    }
  }
  return false;
}

function buildHierarchyPath(node: SceneNode): string {
  const parts: string[] = [];
  let curr = node.parent;
  while (curr && curr.type !== 'PAGE' && curr.type !== 'DOCUMENT') {
    parts.unshift(curr.name.trim());
    curr = curr.parent;
  }
  return parts.join(' / ');
}

export function scanForIcons(rootNodes: readonly SceneNode[], pageName: string, config: ScanConfig): DetectedIcon[] {
  const icons: DetectedIcon[] = [];
  const visited = new Set<string>();

  function traverse(node: SceneNode) {
    if (visited.has(node.id)) return;
    visited.add(node.id);

    if (isIconCandidate(node, config)) {
      icons.push({
        id: node.id,
        name: node.name,
        width: Math.round(node.width),
        height: Math.round(node.height),
        pageName,
        parentPath: buildHierarchyPath(node),
        slashPath: node.name.includes('/') ? node.name : '',
        type: node.type,
      });
      // Once a container is classified as an icon, don't descend into its inner vector layers
      return;
    }

    if ('children' in node && node.type !== 'BOOLEAN_OPERATION') {
      for (const child of (node as ChildrenMixin).children) {
        traverse(child);
      }
    }
  }

  for (const root of rootNodes) {
    traverse(root);
  }

  return icons;
}

