import { DetectedMedia, MediaType } from './types';

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

// Known file extension maps
const EXTENSION_MAP: Record<string, { type: MediaType; label: string }> = {
  // Video
  mp4: { type: 'video_mp4', label: 'MP4 Video' },
  mov: { type: 'video_mp4', label: 'QuickTime Video' },
  webm: { type: 'video_mp4', label: 'WebM Video' },

  // Animations
  json: { type: 'lottie_json', label: 'Lottie JSON' },
  riv: { type: 'lottie_json', label: 'Rive Animation' },
  gif: { type: 'image', label: 'Animated GIF' },

  // Audio
  mp3: { type: 'audio', label: 'MP3 Audio' },
  wav: { type: 'audio', label: 'WAV Audio' },
  ogg: { type: 'audio', label: 'OGG Audio' },
  m4a: { type: 'audio', label: 'M4A Audio' },

  // 3D
  gltf: { type: '3d_model', label: 'glTF 3D Model' },
  glb: { type: '3d_model', label: 'GLB 3D Binary' },
  obj: { type: '3d_model', label: 'OBJ 3D Model' },
  usdz: { type: '3d_model', label: 'USDZ 3D Model' },

  // Documents & Data
  pdf: { type: 'document', label: 'PDF Document' },
  csv: { type: 'document', label: 'CSV Spreadsheet' },
  xml: { type: 'document', label: 'XML Data' },
  txt: { type: 'document', label: 'Text File' },
  zip: { type: 'document', label: 'ZIP Archive' },
  xlsx: { type: 'document', label: 'Excel Sheet' },
  docx: { type: 'document', label: 'Word Document' },

  // Images
  png: { type: 'image', label: 'PNG Image' },
  jpg: { type: 'image', label: 'JPEG Image' },
  jpeg: { type: 'image', label: 'JPEG Image' },
  webp: { type: 'image', label: 'WebP Image' },
  svg: { type: 'image', label: 'SVG Vector' },
};

export function scanForMedia(rootNodes: readonly SceneNode[], pageName: string): DetectedMedia[] {
  const mediaList: DetectedMedia[] = [];
  const visited = new Set<string>();

  function traverse(node: SceneNode) {
    if (!node.visible || visited.has(node.id)) return;
    visited.add(node.id);

    let detectedAsMedia = false;
    const cleanName = node.name.trim();

    // 1. Check for Video Fills (Native MP4 / MOV)
    if ('fills' in node && Array.isArray(node.fills)) {
      for (const fill of node.fills) {
        if (fill.type === 'VIDEO' && fill.visible !== false && fill.videoHash) {
          mediaList.push({
            id: node.id,
            name: cleanName || 'Video',
            mediaType: 'video_mp4',
            format: 'mp4',
            width: Math.round(node.width),
            height: Math.round(node.height),
            pageName,
            screenName: getTopLevelScreenName(node),
            videoHash: fill.videoHash,
            sizeEstimate: 'Video Poster Frame',
          });
          detectedAsMedia = true;
          break;
        }
      }
    }

    // 2. Check for Lottie / JSON Animations in Plugin Data
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

      if (isLottie) {
        mediaList.push({
          id: node.id,
          name: cleanName.replace(/\.json$/i, ''),
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

    // 3. Check for Named File Extensions (e.g. Terms.pdf, sound.mp3, avatar.gltf, dataset.csv)
    if (!detectedAsMedia) {
      const matchExt = cleanName.match(/\.([a-zA-Z0-9]{2,5})$/);
      if (matchExt) {
        const ext = matchExt[1].toLowerCase();
        const info = EXTENSION_MAP[ext] || { type: 'other', label: `${ext.toUpperCase()} File` };

        mediaList.push({
          id: node.id,
          name: cleanName,
          mediaType: info.type,
          format: ext,
          width: Math.round(node.width),
          height: Math.round(node.height),
          pageName,
          screenName: getTopLevelScreenName(node),
          sizeEstimate: info.label,
        });
        detectedAsMedia = true;
      }
    }

    // 4. Check for Standalone Images / Graphics (PNG, JPG, WebP)
    // Only capture if not an icon (< 56px) and not already captured
    if (!detectedAsMedia && 'fills' in node && Array.isArray(node.fills)) {
      const isLargeEnough = node.width >= 56 && node.height >= 56;
      for (const fill of node.fills) {
        if (fill.type === 'IMAGE' && fill.visible !== false && fill.imageHash && isLargeEnough) {
          mediaList.push({
            id: node.id,
            name: cleanName || 'Image',
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
