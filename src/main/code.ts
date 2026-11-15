import { scanForIcons } from './iconDetector';
import { extractProjectColors } from './colorExtractor';
import { extractProjectTypography } from './typographyExtractor';
import { processBatchExport } from './exportEngine';
import { DetectedIcon, PluginToUIMessage, UIToPluginMessage } from './types';

// Show the plugin dialog with comfortable size
figma.showUI(__html__, {
  width: 720,
  height: 740,
  themeColors: true,
  title: 'Asset, Color & Typography Extractor',
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

    if (msg.type === 'SCAN_PROJECT') {
      currentScanSessionId++;
      const thisSessionId = currentScanSessionId;

      const { config } = msg;
      let targetNodes: SceneNode[] = [];
      const allIcons: DetectedIcon[] = [];

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
      } else if (config.scope === 'page') {
        targetNodes = [...figma.currentPage.children];
        allIcons.push(...scanForIcons(targetNodes, figma.currentPage.name, config));
      } else if (config.scope === 'document') {
        for (const page of figma.root.children) {
          const pageIcons = scanForIcons(page.children, page.name, config);
          allIcons.push(...pageIcons);
          targetNodes.push(...page.children);
        }
      }

      // Extract colors & typography from scanned nodes
      const colors = extractProjectColors(targetNodes);
      const typography = extractProjectTypography(targetNodes);

      const response: PluginToUIMessage = {
        type: 'SCAN_COMPLETE',
        icons: allIcons,
        colors,
        typography,
      };
      figma.ui.postMessage(response);

      // Start streaming visual SVG thumbnails in background
      streamIconPreviews(allIcons, thisSessionId);
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
