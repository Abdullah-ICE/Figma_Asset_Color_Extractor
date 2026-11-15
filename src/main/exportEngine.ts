import { ExportRequest, PluginToUIMessage } from './types';

function sanitizePathSegment(segment: string): string {
  return segment
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function getMeaningfulParentFolder(node: SceneNode): string {
  const meaningfulNames: string[] = [];
  let curr = node.parent;
  while (curr && curr.type !== 'PAGE' && curr.type !== 'DOCUMENT') {
    const name = sanitizePathSegment(curr.name);
    if (name && !/^Frame\s*\d+$/i.test(name)) {
      meaningfulNames.unshift(name);
    }
    curr = curr.parent;
  }
  return meaningfulNames.slice(-2).join('/');
}

function resolveRelativePath(node: SceneNode, pageName: string, folderMode: ExportRequest['folderMode']): string {
  const cleanName = sanitizePathSegment(node.name);

  if (folderMode === 'slash') {
    if (node.name.includes('/')) {
      const parts = node.name.split('/').map(p => sanitizePathSegment(p)).filter(Boolean);
      return parts.join('/');
    }
    // Fallback: organize by parent frame so icons with generic names don't clash
    const parentFolder = getMeaningfulParentFolder(node);
    return parentFolder ? `${parentFolder}/${cleanName}` : cleanName;
  }

  if (folderMode === 'hierarchy') {
    const ancestors: string[] = [];
    let curr = node.parent;
    while (curr && curr.type !== 'PAGE' && curr.type !== 'DOCUMENT') {
      const parentName = sanitizePathSegment(curr.name);
      if (parentName) {
        ancestors.unshift(parentName);
      }
      curr = curr.parent;
    }
    const folder = ancestors.filter(Boolean).join('/');
    const safePage = sanitizePathSegment(pageName);
    return folder ? `${safePage}/${folder}/${cleanName}` : `${safePage}/${cleanName}`;
  }

  // Default: flat
  return cleanName;
}

export async function processBatchExport(request: ExportRequest) {
  const { nodeIds, format, scale, folderMode } = request;
  const total = nodeIds.length;
  const CHUNK_SIZE = 12;

  let processedCount = 0;

  for (let i = 0; i < total; i += CHUNK_SIZE) {
    const chunkIds = nodeIds.slice(i, i + CHUNK_SIZE);

    for (const id of chunkIds) {
      const node = figma.getNodeById(id) as SceneNode | null;
      if (!node) {
        processedCount++;
        continue;
      }

      try {
        const page = getPageOfNode(node);
        const pageName = page ? page.name : 'Icons';
        const relativePath = resolveRelativePath(node, pageName, folderMode);

        const exportSettings: ExportSettings =
          format === 'SVG'
            ? {
                format: 'SVG',
                svgIdAttribute: false,
                svgOutlineText: true,
                svgSimplifyStroke: true,
              }
            : format === 'PDF'
            ? {
                format: 'PDF',
              }
            : {
                format: 'PNG',
                constraint: { type: 'SCALE', value: scale },
              };

        const bytes = await node.exportAsync(exportSettings);

        processedCount++;

        // Send chunk to UI thread (convert Uint8Array to regular Array for postMessage transport)
        const msg: PluginToUIMessage = {
          type: 'EXPORT_CHUNK',
          current: processedCount,
          total,
          item: {
            id: node.id,
            name: sanitizePathSegment(node.name),
            relativePath,
            bytes: Array.from(bytes),
          },
        };
        figma.ui.postMessage(msg);
      } catch (err: any) {
        console.error(`Failed to export node ${node.name} (${node.id}):`, err);
        processedCount++;
      }
    }

    // Small delay to prevent UI freezing
    await new Promise(resolve => setTimeout(resolve, 25));
  }

  const completeMsg: PluginToUIMessage = { type: 'EXPORT_COMPLETE' };
  figma.ui.postMessage(completeMsg);
}

function getPageOfNode(node: BaseNode): PageNode | null {
  let curr: BaseNode | null = node;
  while (curr) {
    if (curr.type === 'PAGE') return curr as PageNode;
    curr = curr.parent;
  }
  return null;
}
