import { DetectedMedia } from './types';

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

export function scanForMedia(rootNodes: readonly SceneNode[], pageName: string): DetectedMedia[] {
  const mediaList: DetectedMedia[] = [];
  const visited = new Set<string>();

  function traverse(node: SceneNode) {
    if (!node.visible || visited.has(node.id)) return;
    visited.add(node.id);

    let detectedAsMedia = false;

    // 1. Check for Video Fills (MP4)
    if ('fills' in node && Array.isArray(node.fills)) {
      for (const fill of node.fills) {
        if (fill.type === 'VIDEO' && fill.visible !== false && fill.videoHash) {
          mediaList.push({
            id: node.id,
            name: node.name || 'Video',
            mediaType: 'video_mp4',
            format: 'mp4',
            width: Math.round(node.width),
            height: Math.round(node.height),
            pageName,
            screenName: getTopLevelScreenName(node),
            videoHash: fill.videoHash,
            sizeEstimate: 'MP4 Video',
          });
          detectedAsMedia = true;
          break;
        }
      }
    }

    // 2. Check for Lottie / JSON Animations
    if (!detectedAsMedia) {
      let isLottie = false;
      let lottieJsonStr = '';

      try {
        const keys = node.getPluginDataKeys();
        for (const key of keys) {
          const lk = key.toLowerCase();
          if (lk.includes('lottie') || lk.includes('animation') || lk.includes('json')) {
            const val = node.getPluginData(key);
            if (val && val.startsWith('{')) {
              isLottie = true;
              lottieJsonStr = val;
              break;
            }
          }
        }
      } catch {}

      const lowerName = node.name.toLowerCase();
      if (!isLottie && (lowerName.endsWith('.json') || lowerName.includes('lottie'))) {
        isLottie = true;
      }

      if (isLottie) {
        mediaList.push({
          id: node.id,
          name: node.name.replace(/\.json$/i, ''),
          mediaType: 'lottie_json',
          format: 'json',
          width: Math.round(node.width),
          height: Math.round(node.height),
          pageName,
          screenName: getTopLevelScreenName(node),
          lottieJsonString: lottieJsonStr || undefined,
          sizeEstimate: 'Lottie JSON',
        });
        detectedAsMedia = true;
      }
    }

    // 3. Check for Standalone Images / Photos (PNG / JPG / WebP)
    // Only capture if not an icon (< 56px) and not already captured
    if (!detectedAsMedia && 'fills' in node && Array.isArray(node.fills)) {
      const isLargeEnough = node.width >= 56 && node.height >= 56;
      for (const fill of node.fills) {
        if (fill.type === 'IMAGE' && fill.visible !== false && fill.imageHash && isLargeEnough) {
          mediaList.push({
            id: node.id,
            name: node.name || 'Image',
            mediaType: 'image',
            format: 'png',
            width: Math.round(node.width),
            height: Math.round(node.height),
            pageName,
            screenName: getTopLevelScreenName(node),
            imageHash: fill.imageHash,
            sizeEstimate: `${Math.round(node.width)}x${Math.round(node.height)}px`,
          });
          detectedAsMedia = true;
          break;
        }
      }
    }

    // Recurse children
    if ('children' in node && node.type !== 'BOOLEAN_OPERATION') {
      for (const child of (node as ChildrenMixin).children) {
        traverse(child);
      }
    }
  }

  for (const root of rootNodes) {
    traverse(root);
  }

  return mediaList;
}
