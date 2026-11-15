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
  svgPreview?: string;
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
    }
  | {
      type: 'ICON_PREVIEWS_CHUNK';
      previews: { id: string; svg: string }[];
    }
  | {
      type: 'EXPORT_CHUNK';
      current: number;
      total: number;
      item: { id: string; name: string; relativePath: string; bytes: number[] };
    }
  | { type: 'EXPORT_COMPLETE' }
  | { type: 'ERROR'; message: string }
  | { type: 'SELECTION_CHANGED'; count: number };

export type UIToPluginMessage =
  | { type: 'SCAN_PROJECT'; config: ScanConfig }
  | { type: 'START_EXPORT'; request: ExportRequest }
  | { type: 'CLOSE_PLUGIN' }
  | { type: 'SELECT_NODE'; id: string }
  | { type: 'RESIZE_WINDOW'; width: number; height: number };
