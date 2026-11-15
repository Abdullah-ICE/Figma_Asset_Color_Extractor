import React, { useState } from 'react';
import { DetectedIcon, ExportRequest, ScanConfig } from '../../main/types';

interface Props {
  icons: DetectedIcon[];
  isScanning: boolean;
  isExporting: boolean;
  selectionCount: number;
  onScan: (config: ScanConfig) => void;
  onExport: (request: ExportRequest) => void;
  onSelectNode: (id: string) => void;
}

const ZOOM_CONFIGS: Record<
  number,
  {
    label: string;
    minWidth: number;
    iconBoxSize: string;
    fontSize: string;
    showText: boolean;
    padding: string;
  }
> = {
  1: {
    label: 'Micro (4x Smaller)',
    minWidth: 38,
    iconBoxSize: 'w-5 h-5',
    fontSize: 'text-[7px]',
    showText: false,
    padding: 'p-1',
  },
  2: {
    label: 'Tiny (3x Smaller)',
    minWidth: 48,
    iconBoxSize: 'w-6 h-6',
    fontSize: 'text-[8px]',
    showText: true,
    padding: 'p-1',
  },
  3: {
    label: 'XS (2x Smaller)',
    minWidth: 62,
    iconBoxSize: 'w-7 h-7',
    fontSize: 'text-[9px]',
    showText: true,
    padding: 'p-1.5',
  },
  4: {
    label: 'Small (1x)',
    minWidth: 78,
    iconBoxSize: 'w-8 h-8',
    fontSize: 'text-[10px]',
    showText: true,
    padding: 'p-1.5',
  },
  5: {
    label: 'Medium',
    minWidth: 98,
    iconBoxSize: 'w-10 h-10',
    fontSize: 'text-[11px]',
    showText: true,
    padding: 'p-2',
  },
  6: {
    label: 'Large',
    minWidth: 124,
    iconBoxSize: 'w-12 h-12',
    fontSize: 'text-xs',
    showText: true,
    padding: 'p-2.5',
  },
};

// Vibrant territory themes with polygon contour accents
const POLYGON_THEMES = [
  { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.04)', border: 'border-blue-500', badge: 'bg-blue-100 text-blue-900 border-blue-300' },
  { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.04)', border: 'border-emerald-500', badge: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  { stroke: '#8b5cf6', fill: 'rgba(139, 92, 246, 0.04)', border: 'border-purple-500', badge: 'bg-purple-100 text-purple-900 border-purple-300' },
  { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.04)', border: 'border-amber-500', badge: 'bg-amber-100 text-amber-900 border-amber-300' },
  { stroke: '#ec4899', fill: 'rgba(236, 72, 153, 0.04)', border: 'border-pink-500', badge: 'bg-pink-100 text-pink-900 border-pink-300' },
  { stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.04)', border: 'border-cyan-500', badge: 'bg-cyan-100 text-cyan-900 border-cyan-300' },
];

export const IconExportTab: React.FC<Props> = ({
  icons,
  isScanning,
  isExporting,
  selectionCount,
  onScan,
  onExport,
  onSelectNode,
}) => {
  const [scope, setScope] = useState<ScanConfig['scope']>('document');
  const [maxDimension, setMaxDimension] = useState<number>(48);
  const [onlyComponents, setOnlyComponents] = useState<boolean>(false);

  const [format, setFormat] = useState<ExportRequest['format']>('SVG');
  const [scale, setScale] = useState<number>(1);
  const [folderMode, setFolderMode] = useState<ExportRequest['folderMode']>('hierarchy');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'map' | 'grid' | 'list'>('map');
  const [zoomLevel, setZoomLevel] = useState<number>(2);

  // Real-time mouse-following floating tooltip
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredCluster, setHoveredCluster] = useState<{
    pageName: string;
    screenName: string;
    count: number;
  } | null>(null);

  // Update selected IDs whenever new icons are scanned
  React.useEffect(() => {
    setSelectedIds(new Set(icons.map(i => i.id)));
  }, [icons]);

  const filteredIcons = icons.filter(icon => {
    const q = searchQuery.toLowerCase();
    return (
      icon.name.toLowerCase().includes(q) ||
      icon.parentPath.toLowerCase().includes(q) ||
      icon.slashPath.toLowerCase().includes(q) ||
      icon.screenName?.toLowerCase().includes(q) ||
      icon.pageName.toLowerCase().includes(q)
    );
  });

  // Group icons by Page -> then by Screen/Frame
  const pageGroups = React.useMemo(() => {
    const pMap = new Map<string, Map<string, DetectedIcon[]>>();
    filteredIcons.forEach(icon => {
      const p = icon.pageName || 'Default Page';
      const s = icon.screenName || 'General Assets';
      if (!pMap.has(p)) {
        pMap.set(p, new Map());
      }
      const sMap = pMap.get(p)!;
      if (!sMap.has(s)) {
        sMap.set(s, []);
      }
      sMap.get(s)!.push(icon);
    });
    return pMap;
  }, [filteredIcons]);

  const handleToggleAll = () => {
    if (selectedIds.size === filteredIcons.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredIcons.map(i => i.id)));
    }
  };

  const handleInvertSelection = () => {
    const next = new Set<string>();
    filteredIcons.forEach(icon => {
      if (!selectedIds.has(icon.id)) {
        next.add(icon.id);
      }
    });
    setSelectedIds(next);
  };

  const handleToggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleToggleCluster = (clusterIcons: DetectedIcon[]) => {
    const allSelected = clusterIcons.every(i => selectedIds.has(i.id));
    const next = new Set(selectedIds);
    if (allSelected) {
      clusterIcons.forEach(i => next.delete(i.id));
    } else {
      clusterIcons.forEach(i => next.add(i.id));
    }
    setSelectedIds(next);
  };

  const handleStartScan = () => {
    onScan({
      scope,
      maxDimension,
      minDimension: 10,
      onlyComponents,
    });
  };

  const handleStartExport = () => {
    if (selectedIds.size === 0) return;
    onExport({
      nodeIds: Array.from(selectedIds),
      format,
      scale,
      folderMode,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setCursorPos({ x: e.clientX, y: e.clientY });
  };

  const currentZoom = ZOOM_CONFIGS[zoomLevel] || ZOOM_CONFIGS[2];

  return (
    <div
      onMouseMove={handleMouseMove}
      className="relative flex flex-col h-full space-y-2.5"
    >
      {/* 1. Scan Configuration Bar */}
      <div className="bg-[var(--figma-color-bg-secondary,#f9fafb)] p-2.5 rounded-lg border border-[var(--figma-color-border,#e5e7eb)] space-y-2">
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div>
            <label className="block font-medium text-[var(--figma-color-text-secondary,#4b5563)] mb-1">
              Scan Target:
            </label>
            <select
              value={scope}
              onChange={e => setScope(e.target.value as any)}
              className="w-full bg-[var(--figma-color-bg,#ffffff)] text-[var(--figma-color-text,#111827)] border border-[var(--figma-color-border,#d1d5db)] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="document">Entire Project (All Pages - Multi-Page Scan)</option>
              <option value="page">Current Page Only</option>
              <option value="selection">
                Current Selection {selectionCount > 0 ? `(${selectionCount} selected)` : ''}
              </option>
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block font-medium text-[var(--figma-color-text-secondary,#4b5563)]">
                Max Dimension:
              </label>
              <span className="font-mono font-semibold text-blue-600">{maxDimension}px</span>
            </div>
            <input
              type="range"
              min={16}
              max={64}
              step={4}
              value={maxDimension}
              onChange={e => setMaxDimension(Number(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-lg cursor-pointer accent-blue-600 mt-1"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <label className="flex items-center space-x-1.5 text-xs text-[var(--figma-color-text,#374151)] cursor-pointer">
            <input
              type="checkbox"
              checked={onlyComponents}
              onChange={e => setOnlyComponents(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>Only Components &amp; Instances</span>
          </label>

          <button
            onClick={handleStartScan}
            disabled={isScanning || isExporting}
            className="px-3.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow-xs transition-colors flex items-center space-x-1.5"
          >
            {isScanning ? (
              <span>Scanning Project...</span>
            ) : (
              <span>Scan for Icons</span>
            )}
          </button>
        </div>
      </div>

      {/* 2. Export Settings */}
      {icons.length > 0 && (
        <div className="bg-[var(--figma-color-bg-secondary,#f9fafb)] p-2 rounded-lg border border-[var(--figma-color-border,#e5e7eb)] grid grid-cols-3 gap-2 text-xs">
          <div>
            <label className="block font-medium text-[var(--figma-color-text-secondary,#4b5563)] mb-0.5">
              Format:
            </label>
            <select
              value={format}
              onChange={e => setFormat(e.target.value as any)}
              className="w-full bg-[var(--figma-color-bg,#ffffff)] text-[var(--figma-color-text,#111827)] border border-[var(--figma-color-border,#d1d5db)] rounded px-1.5 py-1"
            >
              <option value="SVG">SVG (Vector)</option>
              <option value="PNG">PNG (Raster)</option>
              <option value="PDF">PDF</option>
            </select>
          </div>

          {format === 'PNG' ? (
            <div>
              <label className="block font-medium text-[var(--figma-color-text-secondary,#4b5563)] mb-0.5">
                Scale:
              </label>
              <select
                value={scale}
                onChange={e => setScale(Number(e.target.value))}
                className="w-full bg-[var(--figma-color-bg,#ffffff)] text-[var(--figma-color-text,#111827)] border border-[var(--figma-color-border,#d1d5db)] rounded px-1.5 py-1"
              >
                <option value={1}>1x</option>
                <option value={2}>2x (@2x)</option>
                <option value={3}>3x (@3x)</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="block font-medium text-[var(--figma-color-text-secondary,#4b5563)] mb-0.5">
                Optimization:
              </label>
              <span className="block text-gray-500 py-1 text-[11px]">Clean Outlines</span>
            </div>
          )}

          <div>
            <label className="block font-medium text-[var(--figma-color-text-secondary,#4b5563)] mb-0.5">
              Folder Structure:
            </label>
            <select
              value={folderMode}
              onChange={e => setFolderMode(e.target.value as any)}
              className="w-full bg-[var(--figma-color-bg,#ffffff)] text-[var(--figma-color-text,#111827)] border border-[var(--figma-color-border,#d1d5db)] rounded px-1.5 py-1"
            >
              <option value="hierarchy">Page / Frame Hierarchy (Recommended)</option>
              <option value="slash">Slash Naming (Category/Name)</option>
              <option value="flat">Flat (Single Directory)</option>
            </select>
          </div>
        </div>
      )}

      {/* 3. Discovered Icons Toolbar */}
      {icons.length > 0 && (
        <div className="flex-1 flex flex-col min-h-0 space-y-2">
          {/* Subheader Toolbar */}
          <div className="flex items-center justify-between text-xs pt-0.5 flex-wrap gap-1">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-[var(--figma-color-text,#111827)] whitespace-nowrap">
                {selectedIds.size} of {icons.length} selected
              </span>

              <div className="flex items-center space-x-1 pl-2 border-l border-gray-200">
                <button
                  onClick={handleToggleAll}
                  className="px-2 py-0.5 text-[11px] bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                >
                  {selectedIds.size === filteredIcons.length ? 'None' : 'All'}
                </button>
                <button
                  onClick={handleInvertSelection}
                  className="px-2 py-0.5 text-[11px] bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                >
                  Invert
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Density Zoom Stepper */}
              <div
                className="flex items-center border border-gray-200 rounded px-1.5 py-0.5 bg-gray-100 space-x-1"
                title={`Density: ${currentZoom.label}`}
              >
                <button
                  onClick={() => setZoomLevel(prev => Math.max(1, prev - 1))}
                  disabled={zoomLevel <= 1}
                  title="Make icons smaller"
                  className="w-4 h-4 flex items-center justify-center text-xs font-bold text-gray-600 hover:text-black disabled:opacity-30 rounded bg-white shadow-xs"
                >
                  −
                </button>

                <input
                  type="range"
                  min={1}
                  max={6}
                  step={1}
                  value={zoomLevel}
                  onChange={e => setZoomLevel(Number(e.target.value))}
                  className="w-12 h-1 bg-gray-300 rounded cursor-pointer accent-blue-600"
                />

                <button
                  onClick={() => setZoomLevel(prev => Math.min(6, prev + 1))}
                  disabled={zoomLevel >= 6}
                  title="Make icons larger"
                  className="w-4 h-4 flex items-center justify-center text-xs font-bold text-gray-600 hover:text-black disabled:opacity-30 rounded bg-white shadow-xs"
                >
                  +
                </button>

                <span className="font-mono text-[9px] text-gray-600 font-semibold px-0.5">
                  {zoomLevel === 1 ? 'Micro' : zoomLevel === 2 ? 'Tiny' : zoomLevel === 3 ? 'XS' : zoomLevel === 4 ? 'S' : zoomLevel === 5 ? 'M' : 'L'}
                </span>
              </div>

              <input
                type="text"
                placeholder="Search screen or icon..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="px-2 py-1 text-xs border border-[var(--figma-color-border,#d1d5db)] rounded bg-[var(--figma-color-bg,#ffffff)] text-[var(--figma-color-text,#111827)] focus:outline-none focus:ring-1 focus:ring-blue-500 w-28"
              />

              {/* View Switcher Toggle: MAP vs GRID vs LIST */}
              <div className="flex border border-gray-200 rounded p-0.5 bg-gray-100">
                <button
                  onClick={() => setViewMode('map')}
                  title="Map View: Unified Full-Width Grid Presentation with Polygon Contour Boundaries & Tooltip"
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    viewMode === 'map'
                      ? 'bg-white shadow-xs text-blue-600 font-bold'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  🗺️ Map
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  title="Flat Grid View"
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white shadow-xs text-blue-600 font-bold'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  🔲 Grid
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  title="List Table Mode"
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white shadow-xs text-blue-600 font-bold'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  📋 List
                </button>
              </div>
            </div>
          </div>

          {/* DYNAMIC SCROLL CONTAINER */}
          <div className="flex-1 min-h-[240px] max-h-[calc(100vh-270px)] border border-[var(--figma-color-border,#e5e7eb)] rounded-lg p-2.5 overflow-y-auto bg-[var(--figma-color-bg-secondary,#fafafa)]">
            {filteredIcons.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">No matching assets found.</div>
            ) : viewMode === 'map' ? (
              /* ========================================================= */
              /* 🗺️ MAP VIEW: UNIFIED GRID PRESENTATION WITH POLYGON LINES */
              /* ========================================================= */
              <div className="space-y-4">
                {Array.from(pageGroups.entries()).map(([pageName, screenMap], pageIdx) => (
                  <div key={pageName} className="space-y-3">
                    {/* Page Region Bar */}
                    <div className="flex items-center space-x-2 border-b border-gray-200 pb-1 pt-0.5">
                      <span className="text-xs font-bold text-gray-800 flex items-center space-x-1">
                        <span>📄 Page:</span>
                        <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-mono">
                          {pageName}
                        </span>
                      </span>
                      <span className="text-[10px] text-gray-400">
                        ({Array.from(screenMap.values()).flat().length} icons across {screenMap.size} screens)
                      </span>
                    </div>

                    {/* Unified Full-Width Groups with Polygon Boundaries */}
                    <div className="space-y-3">
                      {Array.from(screenMap.entries()).map(([screenName, clusterIcons], screenIdx) => {
                        const theme = POLYGON_THEMES[(pageIdx + screenIdx) % POLYGON_THEMES.length];
                        const isAllSelected = clusterIcons.every(i => selectedIds.has(i.id));
                        const isSomeSelected = clusterIcons.some(i => selectedIds.has(i.id));

                        return (
                          <div
                            key={screenName}
                            onMouseEnter={() =>
                              setHoveredCluster({
                                pageName,
                                screenName,
                                count: clusterIcons.length,
                              })
                            }
                            onMouseLeave={() => setHoveredCluster(null)}
                            style={{
                              // Chamfered / polygonal contour cut on corners (বহুভুজাকৃতির লাইন)
                              clipPath:
                                'polygon(12px 0%, calc(100% - 12px) 0%, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0% calc(100% - 12px), 0% 12px)',
                            }}
                            className={`w-full relative border-2 border-dashed ${theme.border} p-3 transition-all duration-150 hover:shadow-md`}
                            style-bg={{ backgroundColor: theme.fill }}
                          >
                            {/* Polygonal Header Toolbar */}
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200/70">
                              <label
                                onClick={e => e.stopPropagation()}
                                className="flex items-center space-x-2 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={isAllSelected}
                                  ref={el => {
                                    if (el) el.indeterminate = !isAllSelected && isSomeSelected;
                                  }}
                                  onChange={() => handleToggleCluster(clusterIcons)}
                                  className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                />
                                <span
                                  className={`text-[11px] font-bold px-2 py-0.5 rounded border ${theme.badge} flex items-center space-x-1.5`}
                                  style={{
                                    clipPath: 'polygon(6px 0%, calc(100% - 6px) 0%, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0% calc(100% - 6px), 0% 6px)',
                                  }}
                                >
                                  <span>🖥️ {screenName}</span>
                                </span>
                              </label>

                              <span className="text-[10px] font-mono text-gray-500 font-semibold bg-white/80 px-2 py-0.5 rounded border border-gray-200">
                                {clusterIcons.length} assets
                              </span>
                            </div>

                            {/* UNIFIED FULL-WIDTH GRID PRESENTATION (Grid view er motoi) */}
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(auto-fill, minmax(${currentZoom.minWidth}px, 1fr))`,
                                gap: zoomLevel <= 2 ? '4px' : '6px',
                                width: '100%',
                              }}
                            >
                              {clusterIcons.map(icon => {
                                const isSelected = selectedIds.has(icon.id);

                                return (
                                  <div
                                    key={icon.id}
                                    onClick={() => handleToggleOne(icon.id)}
                                    className={`group relative flex flex-col items-center justify-between ${currentZoom.padding} rounded-md border cursor-pointer transition-all ${
                                      isSelected
                                        ? 'border-blue-500 bg-white shadow-xs ring-1 ring-blue-500'
                                        : 'border-gray-200 bg-white/80 opacity-60 hover:opacity-100 hover:border-gray-300'
                                    }`}
                                    title={`${icon.name} (${icon.width}x${icon.height})`}
                                  >
                                    <div className="w-full flex justify-between items-center leading-none">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => {}}
                                        className={`rounded text-blue-600 focus:ring-blue-500 pointer-events-none ${
                                          zoomLevel <= 2 ? 'w-2.5 h-2.5' : 'w-3 h-3'
                                        }`}
                                      />
                                      <button
                                        onClick={e => {
                                          e.stopPropagation();
                                          onSelectNode(icon.id);
                                        }}
                                        title="Locate on canvas"
                                        className="opacity-0 group-hover:opacity-100 text-[8px] text-blue-600 hover:text-blue-800 transition-opacity"
                                      >
                                        🔍
                                      </button>
                                    </div>

                                    <div className={`${currentZoom.iconBoxSize} flex items-center justify-center my-0.5`}>
                                      {icon.svgPreview ? (
                                        <div
                                          className="w-full h-full flex items-center justify-center text-gray-800 [&_svg]:max-w-full [&_svg]:max-h-full [&_svg]:w-auto [&_svg]:h-auto [&_svg]:mx-auto"
                                          dangerouslySetInnerHTML={{ __html: icon.svgPreview }}
                                        />
                                      ) : (
                                        <div className="w-4 h-4 rounded bg-gray-100 animate-pulse" />
                                      )}
                                    </div>

                                    {currentZoom.showText && (
                                      <span
                                        className={`font-medium ${currentZoom.fontSize} text-[var(--figma-color-text,#111827)] truncate w-full text-center block leading-tight mt-0.5`}
                                      >
                                        {icon.name}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : viewMode === 'grid' ? (
              /* ========================================================= */
              /* 🔲 FLAT GRID VIEW                                         */
              /* ========================================================= */
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(auto-fill, minmax(${currentZoom.minWidth}px, 1fr))`,
                  gap: zoomLevel <= 2 ? '4px' : '6px',
                  width: '100%',
                }}
              >
                {filteredIcons.map(icon => {
                  const isSelected = selectedIds.has(icon.id);

                  return (
                    <div
                      key={icon.id}
                      onClick={() => handleToggleOne(icon.id)}
                      className={`group relative flex flex-col items-center justify-between ${currentZoom.padding} rounded-md border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-white shadow-xs ring-1 ring-blue-500'
                          : 'border-gray-200 bg-white/70 opacity-60 hover:opacity-100 hover:border-gray-300'
                      }`}
                      title={`${icon.name} (${icon.width}x${icon.height})\nScreen: ${icon.screenName || 'Unknown'}\nPage: ${icon.pageName}`}
                    >
                      <div className="w-full flex justify-between items-center leading-none">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className={`rounded text-blue-600 focus:ring-blue-500 pointer-events-none ${
                            zoomLevel <= 2 ? 'w-2.5 h-2.5' : 'w-3 h-3'
                          }`}
                        />
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onSelectNode(icon.id);
                          }}
                          title="Locate on canvas"
                          className="opacity-0 group-hover:opacity-100 text-[8px] text-blue-600 hover:text-blue-800 transition-opacity"
                        >
                          🔍
                        </button>
                      </div>

                      <div className={`${currentZoom.iconBoxSize} flex items-center justify-center my-0.5`}>
                        {icon.svgPreview ? (
                          <div
                            className="w-full h-full flex items-center justify-center text-gray-800 [&_svg]:max-w-full [&_svg]:max-h-full [&_svg]:w-auto [&_svg]:h-auto [&_svg]:mx-auto"
                            dangerouslySetInnerHTML={{ __html: icon.svgPreview }}
                          />
                        ) : (
                          <div className="w-4 h-4 rounded bg-gray-100 animate-pulse" />
                        )}
                      </div>

                      {currentZoom.showText && (
                        <span
                          className={`font-medium ${currentZoom.fontSize} text-[var(--figma-color-text,#111827)] truncate w-full text-center block leading-tight mt-0.5`}
                        >
                          {icon.name}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ========================================================= */
              /* 📋 LIST TABLE VIEW                                        */
              /* ========================================================= */
              <div className="divide-y divide-[var(--figma-color-border,#f3f4f6)] bg-[var(--figma-color-bg,#ffffff)]">
                {filteredIcons.map(icon => (
                  <div
                    key={icon.id}
                    className="px-2.5 py-1.5 flex items-center justify-between text-xs hover:bg-[var(--figma-color-bg-hover,#f9fafb)] transition-colors"
                  >
                    <label className="flex items-center space-x-2.5 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(icon.id)}
                        onChange={() => handleToggleOne(icon.id)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 bg-gray-50 border border-gray-200 rounded p-0.5">
                        {icon.svgPreview ? (
                          <div
                            className="w-full h-full flex items-center justify-center [&_svg]:max-w-full [&_svg]:max-h-full"
                            dangerouslySetInnerHTML={{ __html: icon.svgPreview }}
                          />
                        ) : (
                          <span className="text-[8px] text-gray-400">...</span>
                        )}
                      </div>
                      <div className="truncate">
                        <span className="font-medium text-[var(--figma-color-text,#111827)]">
                          {icon.name}
                        </span>
                        <span className="text-[10px] text-gray-400 block truncate">
                          {icon.pageName} &gt; {icon.screenName}
                        </span>
                      </div>
                    </label>

                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {icon.width}x{icon.height}
                      </span>
                      <button
                        onClick={() => onSelectNode(icon.id)}
                        title="Focus in Figma"
                        className="text-[10px] text-blue-600 hover:text-blue-800 underline ml-1"
                      >
                        Locate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Export Action CTA Button */}
          <div className="pt-0.5">
            <button
              onClick={handleStartExport}
              disabled={selectedIds.size === 0 || isExporting}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow-sm transition-colors flex items-center justify-center space-x-2"
            >
              <span>
                Export {selectedIds.size} Icons ({format}) into ZIP
              </span>
            </button>
          </div>
        </div>
      )}

      {icons.length === 0 && !isScanning && (
        <div className="text-center py-10 border-2 border-dashed border-[var(--figma-color-border,#e5e7eb)] rounded-lg text-xs text-gray-500 space-y-1">
          <p className="font-medium">No icons scanned yet</p>
          <p className="text-[11px] text-gray-400">
            Select a target scope above and click &quot;Scan for Icons&quot; to auto-detect all vectors.
          </p>
        </div>
      )}

      {/* ========================================================= */}
      {/* 🪟 REAL-TIME FLOATING MOUSE TOOLTIP (Tool Text)           */}
      {/* ========================================================= */}
      {hoveredCluster && cursorPos && (
        <div
          style={{
            position: 'fixed',
            left: `${cursorPos.x + 14}px`,
            top: `${cursorPos.y + 14}px`,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
          className="bg-gray-900/95 text-white backdrop-blur-md px-2.5 py-1.5 rounded-lg shadow-xl border border-gray-700 text-[11px] space-y-0.5 animate-in fade-in zoom-in-95 duration-100 max-w-xs"
        >
          <div className="flex items-center space-x-1.5 font-bold text-white tracking-wide">
            <span>🗺️</span>
            <span className="truncate">{hoveredCluster.screenName}</span>
          </div>
          <div className="text-[10px] text-gray-300 flex items-center space-x-2">
            <span>📄 Page: {hoveredCluster.pageName}</span>
            <span>•</span>
            <span className="text-blue-400 font-mono font-semibold">
              {hoveredCluster.count} assets
            </span>
          </div>
          <div className="text-[9px] text-gray-400 italic pt-0.5">
            Click cluster checkbox to toggle screen
          </div>
        </div>
      )}
    </div>
  );
};
