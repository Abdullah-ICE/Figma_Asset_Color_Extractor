export interface DetectedIcon {
  id: string;
  name: string;
  width: number;
  height: number;
  pageName: string;
  screenName: string; // Top-level artboard/screen/frame name
  parentPath: string; // Hierarchical path (e.g., "Icons / Action")
  slashPath: string;  // Extracted from slash naming (e.g., "Action / Delete")
  type: string;       // COMPONENT, INSTANCE, FRAME, etc.
  componentKey?: string; // If instance, the master component key/id
  dedupKey?: string;     // Unique identifier for clustering identical icons
  svgPreview?: string;
}

export interface DeduplicatedIconGroup {
  dedupKey: string;
  canonicalName: string;
  representativeId: string;
  width: number;
  height: number;
  totalOccurrences: number;
  instances: DetectedIcon[];
  svgPreview?: string;
}

export type MediaType = 'video_mp4' | 'lottie_json' | 'image' | 'audio' | '3d_model' | 'document' | 'other';

export interface DetectedMedia {
  id: string;
  name: string;
  mediaType: MediaType;
  format: string; // 'mp4', 'json', 'png', 'jpg', 'gif', etc.
  width: number;
  height: number;
  pageName: string;
  screenName: string;
  sizeEstimate?: string;
  videoHash?: string;
  imageHash?: string;
  lottieJsonString?: string;
}

export interface ExtractedColor {
  hex: string;
  rgb: { r: number; g: number; b: number; a: number };
  name?: string;
  usageCount: number;
  source: 'style' | 'variable' | 'raw_node';
}

export interface ExtractedTypography {
  id: string;
  name?: string;
  fontFamily: string;
  fontStyle: string;
  fontWeight: number;
  fontSize: number;
  lineHeight: string;
  letterSpacing: string;
  usageCount: number;
  source: 'style' | 'raw_node';
}

export type ComponentCategory = 'button' | 'card' | 'input' | 'badge' | 'avatar' | 'row_item' | 'other';

export interface ComponentProperties {
  width: number;
  height: number;
  cornerRadius: number | string;
  fills: string[];
  strokes: { color: string; weight: number }[];
  padding: { top: number; right: number; bottom: number; left: number };
  gap: number;
  layoutMode: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  typography?: {
    family: string;
    size: number;
    weight: number;
    text: string;
  };
}

export interface ComponentInstanceItem {
  nodeId: string;
  name: string;
  pageName: string;
  screenName: string;
  properties: ComponentProperties;
}

export interface ComponentCluster {
  clusterId: string;
  category: ComponentCategory;
  representativeName: string;
  totalOccurrences: number;
  representativeNodeId: string;
  sharedDimensions: { width: number; height: number };
  sharedRadius: number | string;
  sharedFills: string[];
  instances: ComponentInstanceItem[];
  svgPreview?: string;
  inconsistencies: {
    hasRadiusMismatch: boolean;
    hasColorMismatch: boolean;
    hasDimensionMismatch: boolean;
    details: string[];
  };
}

export interface ScanConfig {
  scope: 'selection' | 'page' | 'document';
  maxDimension: number;
  minDimension: number;
  onlyComponents: boolean;
}

export interface ExportRequest {
  nodeIds: string[];
  format: 'SVG' | 'PNG' | 'PDF';
  scale: number;
  folderMode: 'slash' | 'hierarchy' | 'flat';
}

export type PluginToUIMessage =
  | {
      type: 'SCAN_COMPLETE';
      icons: DetectedIcon[];
      colors: ExtractedColor[];
      typography: ExtractedTypography[];
      components: ComponentCluster[];
      media: DetectedMedia[];
    }
  | {
      type: 'ICON_PREVIEWS_CHUNK';
      previews: { id: string; svg: string }[];
    }
  | {
      type: 'COMPONENT_PREVIEWS_CHUNK';
      previews: { id: string; svg: string }[];
    }
  | {
      type: 'EXPORT_CHUNK';
      current: number;
      total: number;
      item: { id: string; name: string; relativePath: string; bytes: number[] };
    }
  | { type: 'EXPORT_COMPLETE' }
  | {
      type: 'MEDIA_EXPORT_CHUNK';
      current: number;
      total: number;
      item: { id: string; name: string; filename: string; bytes: number[] };
    }
  | { type: 'MEDIA_EXPORT_COMPLETE' }
  | { type: 'NODES_DELETED'; ids: string[] }
  | { type: 'ERROR'; message: string }
  | { type: 'SELECTION_CHANGED'; count: number };

export type UIToPluginMessage =
  | { type: 'SCAN_PROJECT'; config: ScanConfig }
  | { type: 'START_EXPORT'; request: ExportRequest }
  | { type: 'EXPORT_MEDIA'; ids: string[] }
  | { type: 'DELETE_NODES'; ids: string[] }
  | { type: 'CLOSE_PLUGIN' }
  | { type: 'SELECT_NODE'; id: string }
  | { type: 'COPY_NODE_TO_CANVAS'; id: string }
  | { type: 'RESIZE_WINDOW'; width: number; height: number };
