import React, { useMemo, useState } from 'react';
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

// Pastel theme palette for instant visual recognition of different groups
const GROUP_THEMES = [
  { bg: 'bg-blue-50/50', border: 'border-blue-200/80', badge: 'bg-blue-100 text-blue-800 border-blue-200', dot: 'bg-blue-500' },
  { bg: 'bg-indigo-50/50', border: 'border-indigo-200/80', badge: 'bg-indigo-100 text-indigo-800 border-indigo-200', dot: 'bg-indigo-500' },
  { bg: 'bg-emerald-50/50', border: 'border-emerald-200/80', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  { bg: 'bg-amber-50/50', border: 'border-amber-200/80', badge: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  { bg: 'bg-purple-50/50', border: 'border-purple-200/80', badge: 'bg-purple-100 text-purple-800 border-purple-200', dot: 'bg-purple-500' },
  { bg: 'bg-rose-50/50', border: 'border-rose-200/80', badge: 'bg-rose-100 text-rose-800 border-rose-200', dot: 'bg-rose-500' },
  { bg: 'bg-cyan-50/50', border: 'border-cyan-200/80', badge: 'bg-cyan-100 text-cyan-800 border-cyan-200', dot: 'bg-cyan-500' },
];

function getTopSectionName(parentPath: string): string {
  if (!parentPath) return 'Direct Assets';
  const parts = parentPath.split('/').map(p => p.trim()).filter(Boolean);
  return parts[0] || 'Direct Assets';
}

export const IconExportTab: React.FC<Props> = ({
  icons,
  isScanning,
  isExporting,
  selectionCount,
  onScan,
  onExport,
  onSelectNode,
}) => {
  const [scope, setScope] = useState<ScanConfig['scope']>('page');
  const [maxDimension, setMaxDimension] = useState<number>(48);
  const [onlyComponents, setOnlyComponents] = useState<boolean>(false);

  const [format, setFormat] = useState<ExportRequest['format']>('SVG');
  const [scale, setScale] = useState<number>(1);
  const [folderMode, setFolderMode] = useState<ExportRequest['folderMode']>('slash');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [groupBySections, setGroupBySections] = useState<boolean>(true); // Smart default: Grouped by Page & Frame!
  const [zoomLevel, setZoomLevel] = useState<number>(2);

  // Update selected IDs whenever new icons are scanned
  React.useEffect(() => {
    setSelectedIds(new Set(icons.map(i => i.id)));
  }, [icons]);

  const filteredIcons = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return icons.filter(
      icon =>
        icon.name.toLowerCase().includes(q) ||
        icon.parentPath.toLowerCase().includes(q) ||
        icon.slashPath.toLowerCase().includes(q) ||
        icon.pageName.toLowerCase().includes(q)
    );
  }, [icons, searchQuery]);

  // Group icons by Page, then by Frame/Group Section
  const groupedData = useMemo(() => {
    const pageMap = new Map<string, Map<string, DetectedIcon[]>>();

    for (const icon of filteredIcons) {
      const page = icon.pageName || 'Page 1';
      const section = getTopSectionName(icon.parentPath);

      if (!pageMap.has(page)) {
        pageMap.set(page, new Map());
      }
      const sectionMap = pageMap.get(page)!;
      if (!sectionMap.has(section)) {
        sectionMap.set(section, []);
      }
      sectionMap.get(section)!.push(icon);
    }

    return Array.from(pageMap.entries()).map(([pageName, sectionMap]) => ({
      pageName,
      sections: Array.from(sectionMap.entries()).map(([sectionName, sectionIcons]) => ({
        sectionName,
        icons: sectionIcons,
      })),
    }));
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

  const handleToggleGroup = (groupIcons: DetectedIcon[]) => {
    const allSelected = groupIcons.every(icon => selectedIds.has(icon.id));
    const next = new Set(selectedIds);
    if (allSelected) {
      groupIcons.forEach(icon => next.delete(icon.id));
    } else {
      groupIcons.forEach(icon => next.add(icon.id));
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

  const currentZoom = ZOOM_CONFIGS[zoomLevel] || ZOOM_CONFIGS[2];

  // Render an individual icon card
  const renderIconCard = (icon: DetectedIcon) => {
    const isSelected = selectedIds.has(icon.id);

    return (
      <div
        key={icon.id}
        onClick={() => handleToggleOne(icon.id)}
        className={`group relative flex flex-col items-center justify-between ${currentZoom.padding} rounded-md border cursor-pointer transition-all ${
          isSelected
            ? 'border-blue-500 bg-white shadow-xs ring-1 ring-blue-500'
            : 'border-gray-200/90 bg-white/80 opacity-60 hover:opacity-100 hover:border-gray-300'
        }`}
        style={{ width: `${currentZoom.minWidth}px` }}
        title={`${icon.name} (${icon.width}x${icon.height})\nPage: ${icon.pageName}\nGroup: ${icon.parentPath || 'Root'}`}
      >
        {/* Top: Checkbox + Locate */}
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
            title="Locate on Figma canvas"
            className="opacity-0 group-hover:opacity-100 text-[8px] text-blue-600 hover:text-blue-800 transition-opacity"
          >
            🔍
          </button>
        </div>

        {/* Thumbnail Preview */}
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

        {/* Label */}
        {currentZoom.showText && (
          <span
            className={`font-medium ${currentZoom.fontSize} text-[var(--figma-color-text,#111827)] truncate w-full text-center block leading-tight mt-0.5`}
          >
            {icon.name}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-2.5">
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
              <option value="page">Current Page</option>
              <option value="selection">
                Current Selection {selectionCount > 0 ? `(${selectionCount} selected)` : ''}
              </option>
              <option value="document">Entire Project (All Pages)</option>
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
              <span>Scanning Assets...</span>
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
              <option value="slash">Slash Naming (Category/Name)</option>
              <option value="hierarchy">Page / Frame Hierarchy</option>
              <option value="flat">Flat (Single Directory)</option>
            </select>
          </div>
        </div>
      )}

      {/* 3. Discovered Icons Toolbar */}
      {icons.length > 0 && (
        <div className="flex-1 flex flex-col min-h-0 space-y-2">
          {/* Subheader Toolbar */}
          <div className="flex items-center justify-between text-xs pt-0.5 flex-wrap gap-1.5">
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
              {/* Grouping Switcher Pill */}
              <button
                onClick={() => setGroupBySections(prev => !prev)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors flex items-center space-x-1 ${
                  groupBySections
                    ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold'
                    : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                }`}
                title="Toggle Group-wise & Page-wise clustering"
              >
                <span>🗂️ Groups:</span>
                <span>{groupBySections ? 'ON' : 'OFF'}</span>
              </button>

              {/* Ultra Zoom & Density Stepper / Slider */}
              {viewMode === 'grid' && (
                <div
                  className="flex items-center border border-gray-200 rounded px-1.5 py-0.5 bg-gray-100 space-x-1"
                  title={`Icon Density: ${currentZoom.label}`}
                >
                  <button
                    onClick={() => setZoomLevel(prev => Math.max(1, prev - 1))}
                    disabled={zoomLevel <= 1}
                    title="Make icons smaller (Show more icons)"
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
              )}

              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="px-2 py-1 text-xs border border-[var(--figma-color-border,#d1d5db)] rounded bg-[var(--figma-color-bg,#ffffff)] text-[var(--figma-color-text,#111827)] focus:outline-none focus:ring-1 focus:ring-blue-500 w-24"
              />

              {/* View Switcher Toggle */}
              <div className="flex border border-gray-200 rounded p-0.5 bg-gray-100">
                <button
                  onClick={() => setViewMode('grid')}
                  title="Grid Preview Mode"
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white shadow-xs text-blue-600 font-bold'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  title="List Details Mode"
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white shadow-xs text-blue-600 font-bold'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  List
                </button>
              </div>
            </div>
          </div>

          {/* DYNAMIC SCROLL GALLERY */}
          <div className="flex-1 min-h-[220px] max-h-[calc(100vh-270px)] border border-[var(--figma-color-border,#e5e7eb)] rounded-lg p-2.5 overflow-y-auto bg-[var(--figma-color-bg-secondary,#fafafa)] space-y-4">
            {viewMode === 'grid' ? (
              filteredIcons.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">No matching icons found.</div>
              ) : groupBySections ? (
                /* GROUPED CLUSTERS VIEW (Page-wise and Section-wise Dynamic Islands) */
                groupedData.map((pageGroup, pageIdx) => (
                  <div key={pageGroup.pageName} className="space-y-2">
                    {/* Page Header (Only if multiple pages or for clarity) */}
                    <div className="flex items-center space-x-2 pb-1 border-b border-gray-200">
                      <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center space-x-1.5">
                        <span>📄</span>
                        <span>{pageGroup.pageName}</span>
                      </span>
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.2 rounded-full font-mono">
                        {pageGroup.sections.reduce((acc, s) => acc + s.icons.length, 0)} assets
                      </span>
                    </div>

                    {/* Section Clusters (Naturally wrap and hug their contents!) */}
                    <div className="flex flex-wrap gap-2.5 items-start">
                      {pageGroup.sections.map((sec, secIdx) => {
                        const theme = GROUP_THEMES[(pageIdx * 3 + secIdx) % GROUP_THEMES.length];
                        const allSelected = sec.icons.every(i => selectedIds.has(i.id));
                        const someSelected = sec.icons.some(i => selectedIds.has(i.id));

                        return (
                          <div
                            key={sec.sectionName}
                            className={`inline-flex flex-col ${theme.bg} ${theme.border} border rounded-lg p-2 shadow-xs transition-all hover:shadow-md hover:border-gray-400/60`}
                            title={`Page: ${pageGroup.pageName}\nGroup: ${sec.sectionName}\nTotal: ${sec.icons.length} assets`}
                          >
                            {/* Group Cluster Header (Dynamic title, tooltip, and select-all-in-group) */}
                            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-gray-200/60 gap-2">
                              <label
                                className="flex items-center space-x-1.5 cursor-pointer select-none"
                                title={`Click to toggle all ${sec.icons.length} icons in "${sec.sectionName}"`}
                              >
                                <input
                                  type="checkbox"
                                  checked={allSelected}
                                  ref={el => {
                                    if (el) el.indeterminate = someSelected && !allSelected;
                                  }}
                                  onChange={() => handleToggleGroup(sec.icons)}
                                  className="rounded text-blue-600 focus:ring-blue-500 w-3 h-3"
                                />
                                <span className="font-bold text-[11px] text-gray-800 truncate max-w-[140px]">
                                  {sec.sectionName}
                                </span>
                              </label>

                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded-full border font-mono font-semibold ${theme.badge}`}
                              >
                                {sec.icons.length}
                              </span>
                            </div>

                            {/* Icons inside the group (Naturally hug width/height!) */}
                            <div className="flex flex-wrap gap-1.5 max-w-[420px]">
                              {sec.icons.map(icon => renderIconCard(icon))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                /* FLAT GRID VIEW (All icons in unified auto-fill grid) */
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(auto-fill, minmax(${currentZoom.minWidth}px, 1fr))`,
                    gap: zoomLevel <= 2 ? '4px' : '6px',
                  }}
                >
                  {filteredIcons.map(icon => renderIconCard(icon))}
                </div>
              )
            ) : (
              /* LIST VIEW */
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
                          📄 {icon.pageName} • {icon.parentPath || 'Root'}
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
    </div>
  );
};
