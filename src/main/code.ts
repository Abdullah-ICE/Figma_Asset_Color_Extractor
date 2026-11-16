import { scanForIcons } from './iconDetector';
import { scanForMedia } from './mediaDetector';
import { extractProjectColors } from './colorExtractor';
import { extractProjectTypography } from './typographyExtractor';
import { auditProjectComponents } from './componentAuditor';
import { processBatchExport } from './exportEngine';
import { ComponentCluster, DetectedIcon, DetectedMedia, PluginToUIMessage, UIToPluginMessage } from './types';

// Show the plugin dialog with comfortable size
figma.showUI(__html__, {
  width: 740,
  height: 760,
  themeColors: true,
  title: 'Asset, Color & Component Extractor',
});

// Broadcast selection changes to UI
figma.on('selectionchange', () => {
  const count = figma.currentPage.selection.length;
  const msg: PluginToUIMessage = {
    type: 'SELECTION_CHANGED',
    count,
  };
  figma.ui.postMessage(msg);
});

let currentScanSessionId = 0;

function bytesToSvgString(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    let str = '';
    for (let i = 0; i < bytes.length; i++) {
      str += String.fromCharCode(bytes[i]);
    }
    return str;
  }
}

async function streamIconPreviews(icons: DetectedIcon[], sessionId: number) {
  const PREVIEW_CHUNK_SIZE = 18;
  for (let i = 0; i < icons.length; i += PREVIEW_CHUNK_SIZE) {
    if (sessionId !== currentScanSessionId) return;

    const chunk = icons.slice(i, i + PREVIEW_CHUNK_SIZE);
    const previews: { id: string; svg: string }[] = [];

    await Promise.all(
      chunk.map(async (item) => {
        try {
          const node = figma.getNodeById(item.id) as SceneNode | null;
          if (node) {
            const bytes = await node.exportAsync({
              format: 'SVG',
              svgIdAttribute: false,
              svgOutlineText: true,
              svgSimplifyStroke: true,
            });
            previews.push({
              id: item.id,
              svg: bytesToSvgString(bytes),
            });
          }
        } catch {
          // Ignore individual node preview errors
        }
      })
    );

    if (sessionId !== currentScanSessionId) return;

    if (previews.length > 0) {
      figma.ui.postMessage({
        type: 'ICON_PREVIEWS_CHUNK',
        previews,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 15));
  }
}

async function streamComponentPreviews(components: ComponentCluster[], sessionId: number) {
  const CHUNK_SIZE = 6;
  for (let i = 0; i < components.length; i += CHUNK_SIZE) {
    if (sessionId !== currentScanSessionId) return;

    const chunk = components.slice(i, i + CHUNK_SIZE);
    const previews: { id: string; svg: string }[] = [];

    await Promise.all(
      chunk.map(async (cluster) => {
        try {
          const node = figma.getNodeById(cluster.representativeNodeId) as SceneNode | null;
          if (node) {
            const bytes = await node.exportAsync({
              format: 'SVG',
              svgIdAttribute: false,
              svgOutlineText: true,
              svgSimplifyStroke: true,
            });
            previews.push({
              id: cluster.clusterId,
              svg: bytesToSvgString(bytes),
            });
          }
        } catch {}
      })
    );

    if (sessionId !== currentScanSessionId) return;

    if (previews.length > 0) {
      figma.ui.postMessage({
        type: 'COMPONENT_PREVIEWS_CHUNK',
        previews,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

// Listen to UI requests
figma.ui.onmessage = async (msg: UIToPluginMessage) => {
  try {
    if (msg.type === 'CLOSE_PLUGIN') {
      figma.closePlugin();
      return;
    }

    if (msg.type === 'RESIZE_WINDOW') {
      const w = Math.max(500, Math.min(2400, Math.round(msg.width)));
      const h = Math.max(500, Math.min(1800, Math.round(msg.height)));
      figma.ui.resize(w, h);
      return;
    }

    if (msg.type === 'SELECT_NODE') {
      const node = figma.getNodeById(msg.id) as SceneNode | null;
      if (node) {
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
      }
      return;
    }

    if (msg.type === 'COPY_NODE_TO_CANVAS') {
      const node = figma.getNodeById(msg.id) as SceneNode | null;
      if (node) {
        try {
          // Identify the page where node resides
          let p: BaseNode | null = node.parent;
          while (p && p.type !== 'PAGE') {
            p = p.parent;
          }
          const nodePage = p as PageNode | null;
          const originalPage = figma.currentPage;

          let clone: SceneNode;
          if (nodePage && nodePage.id !== originalPage.id) {
            figma.currentPage = nodePage;
            clone = node.clone();
            originalPage.appendChild(clone);
            figma.currentPage = originalPage;
          } else {
            clone = node.clone();
            figma.currentPage.appendChild(clone);
          }

          // Center clone in current viewport
          const center = figma.viewport.center;
          clone.x = Math.round(center.x - clone.width / 2);
          clone.y = Math.round(center.y - clone.height / 2);

          figma.currentPage.selection = [clone];
          figma.viewport.scrollAndZoomIntoView([clone]);
          figma.notify(`✓ Copied "${node.name}" to canvas!`, { timeout: 2500 });
        } catch (err: any) {
          figma.notify(`Error copying component: ${err?.message || err}`, { error: true });
        }
      } else {
        figma.notify('Node not found on canvas', { error: true });
      }
      return;
    }

    if (msg.type === 'DELETE_NODES') {
      let count = 0;
      for (const id of msg.ids) {
        const node = figma.getNodeById(id);
        if (node && !node.removed) {
          try {
            node.remove();
            count++;
          } catch {}
        }
      }
      figma.notify(`🗑️ Deleted ${count} item(s) from canvas!`, { timeout: 2500 });
      figma.ui.postMessage({ type: 'NODES_DELETED', ids: msg.ids });
      return;
    }

    if (msg.type === 'EXPORT_MEDIA') {
      const ids = msg.ids;
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        try {
          const node = figma.getNodeById(id) as (GeometryMixin & SceneNode) | null;
          if (!node) continue;

          let bytes: Uint8Array | null = null;
          let filename = `${node.name || 'media'}.png`;

          // 1. Check fills for image or video
          if ('fills' in node && Array.isArray(node.fills)) {
            for (const fill of node.fills) {
              if (fill.type === 'IMAGE' && fill.imageHash) {
                try {
                  const image = figma.getImageByHash(fill.imageHash);
                  if (image) {
                    bytes = await image.getBytesAsync();
                    filename = `${node.name || 'image'}.png`;
                    break;
                  }
                } catch {}
              } else if (fill.type === 'VIDEO' && fill.videoHash) {
                if (typeof (figma as any).getVideoByHash === 'function') {
                  try {
                    const video = (figma as any).getVideoByHash(fill.videoHash);
                    if (video) {
                      bytes = await video.getBytesAsync();
                      filename = `${node.name || 'video'}.mp4`;
                      break;
                    }
                  } catch {}
                }

                if (!bytes) {
                  try {
                    bytes = await (node as any).exportAsync({ format: 'MP4' });
                    filename = `${node.name || 'video'}.mp4`;
                    break;
                  } catch {}
                }
              }
            }
          }

          // 2. Check for Lottie JSON in plugin data
          if (!bytes) {
            try {
              const keys = node.getPluginDataKeys();
              for (const key of keys) {
                const val = node.getPluginData(key);
                if (val && val.startsWith('{')) {
                  bytes = new TextEncoder().encode(val);
                  filename = `${node.name || 'animation'}.json`;
                  break;
                }
              }
            } catch {}
          }

          // 3. Fallback: export node as high-res PNG
          if (!bytes) {
            try {
              bytes = await node.exportAsync({
                format: 'PNG',
                constraint: { type: 'SCALE', value: 2 },
              });
              filename = `${node.name || 'asset'}.png`;
            } catch (err: any) {
              console.warn(`Could not export node ${node.name}:`, err);
            }
          }

          if (bytes) {
            figma.ui.postMessage({
              type: 'MEDIA_EXPORT_CHUNK',
              current: i + 1,
              total: ids.length,
              item: {
                id,
                name: node.name,
                filename: filename.replace(/[/\\?%*:|"<>]/g, '-'),
                bytes: Array.from(bytes),
              },
            });
          }
        } catch (itemErr) {
          console.warn(`Error processing media item ${id}:`, itemErr);
        }

        await new Promise((r) => setTimeout(r, 20));
      }

      figma.ui.postMessage({ type: 'MEDIA_EXPORT_COMPLETE' });
      return;
    }

    if (msg.type === 'SCAN_PROJECT') {
      currentScanSessionId++;
      const thisSessionId = currentScanSessionId;

      const { config } = msg;
      let targetNodes: SceneNode[] = [];
      const allIcons: DetectedIcon[] = [];
      const allMedia: DetectedMedia[] = [];

      if (config.scope === 'selection') {
        targetNodes = [...figma.currentPage.selection];
        if (targetNodes.length === 0) {
          figma.ui.postMessage({
            type: 'ERROR',
            message: 'No layers selected. Please select frames or components to scan.',
          });
          return;
        }
        allIcons.push(...scanForIcons(targetNodes, figma.currentPage.name, config));
        allMedia.push(...scanForMedia(targetNodes, figma.currentPage.name));
      } else if (config.scope === 'page') {
        targetNodes = [...figma.currentPage.children];
        allIcons.push(...scanForIcons(targetNodes, figma.currentPage.name, config));
        allMedia.push(...scanForMedia(targetNodes, figma.currentPage.name));
      } else if (config.scope === 'document') {
        for (const page of figma.root.children) {
          const pageIcons = scanForIcons(page.children, page.name, config);
          allIcons.push(...pageIcons);
          allMedia.push(...scanForMedia(page.children, page.name));
          targetNodes.push(...page.children);
        }
      }

      // Extract colors, typography & similar components from scanned nodes
      const colors = extractProjectColors(targetNodes);
      const typography = extractProjectTypography(targetNodes);
      const components = auditProjectComponents(targetNodes);

      const response: PluginToUIMessage = {
        type: 'SCAN_COMPLETE',
        icons: allIcons,
        colors,
        typography,
        components,
        media: allMedia,
      };
      figma.ui.postMessage(response);

      // Start streaming visual SVG thumbnails in background
      streamIconPreviews(allIcons, thisSessionId);
      streamComponentPreviews(components, thisSessionId);
    }

    if (msg.type === 'START_EXPORT') {
      await processBatchExport(msg.request);
    }
  } catch (error: any) {
    console.error('Plugin runtime error:', error);
    figma.ui.postMessage({
      type: 'ERROR',
      message: error?.message || 'An unexpected error occurred during execution.',
    });
  }
};
