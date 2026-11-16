import React, { useState } from 'react';
import { ComponentCategory, ComponentCluster } from '../../main/types';
import { copyTextToClipboard } from '../utils/clipboard';

interface Props {
  components: ComponentCluster[];
  isScanning: boolean;
  onSelectNode: (id: string) => void;
}

const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  button: 'Buttons',
  card: 'Cards',
  input: 'Input Fields',
  badge: 'Badges / Chips',
  avatar: 'Avatars',
  row_item: 'Row Items',
  other: 'Other Elements',
};

const CATEGORY_BADGES: Record<ComponentCategory, { bg: string; text: string; border: string }> = {
  button: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  card: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  input: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  badge: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  avatar: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  row_item: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  other: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
};

function generateComponentCss(cluster: ComponentCluster): string {
  const p = cluster.instances[0].properties;
  const lines: string[] = [
    `/* ${cluster.representativeName} (${p.width}x${p.height}px) */`,
    `box-sizing: border-box;`,
    `width: ${p.width}px;`,
    `height: ${p.height}px;`,
  ];

  if (typeof p.cornerRadius === 'number') {
    if (p.cornerRadius > 0) {
      lines.push(`border-radius: ${p.cornerRadius}px;`);
    }
  } else if (p.cornerRadius) {
    const radParts = p.cornerRadius
      .split(',')
      .map(r => `${r.trim()}px`)
      .join(' ');
    lines.push(`border-radius: ${radParts};`);
  }

  if (p.fills.length > 0) {
    lines.push(`background: ${p.fills[0]};`);
  } else {
    lines.push(`background: transparent;`);
  }

  if (p.strokes.length > 0) {
    const s = p.strokes[0];
    lines.push(`border: ${s.weight}px solid ${s.color};`);
  }

  if (p.layoutMode !== 'NONE') {
    lines.push(`display: flex;`);
    lines.push(`flex-direction: ${p.layoutMode === 'VERTICAL' ? 'column' : 'row'};`);
    const { top, right, bottom, left } = p.padding;
    if (top || right || bottom || left) {
      if (top === bottom && right === left && top === right) {
        lines.push(`padding: ${top}px;`);
      } else if (top === bottom && right === left) {
        lines.push(`padding: ${top}px ${right}px;`);
      } else {
        lines.push(`padding: ${top}px ${right}px ${bottom}px ${left}px;`);
      }
    }
    if (p.gap > 0) {
      lines.push(`gap: ${p.gap}px;`);
    }
    lines.push(`align-items: center;`);
    lines.push(`justify-content: center;`);
  }

  if (p.typography) {
    lines.push(`font-family: '${p.typography.family}', sans-serif;`);
    lines.push(`font-size: ${p.typography.size}px;`);
    lines.push(`font-weight: ${p.typography.weight};`);
  }

  return lines.join('\n');
}

export const ComponentInventoryTab: React.FC<Props> = ({
  components,
  isScanning,
  onSelectNode,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedClusterIds, setExpandedClusterIds] = useState<Set<string>>(new Set());
  const [copiedCssId, setCopiedCssId] = useState<string | null>(null);

  // Category counts
  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: components.length };
    components.forEach(c => {
      counts[c.category] = (counts[c.category] || 0) + 1;
    });
    return counts;
  }, [components]);

  const totalInstances = components.reduce((acc, c) => acc + c.totalOccurrences, 0);

  const filteredClusters = components.filter(c => {
    if (selectedCategory !== 'all' && c.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.representativeName.toLowerCase().includes(q);
      const matchInstance = c.instances.some(
        i => i.name.toLowerCase().includes(q) || i.screenName.toLowerCase().includes(q) || i.pageName.toLowerCase().includes(q)
      );
      if (!matchName && !matchInstance) return false;
    }
    return true;
  });

  const toggleExpand = (clusterId: string) => {
    setExpandedClusterIds(prev => {
      const next = new Set(prev);
      if (next.has(clusterId)) next.delete(clusterId);
      else next.add(clusterId);
      return next;
    });
  };

  const handleCopyCss = async (cluster: ComponentCluster) => {
    const css = generateComponentCss(cluster);
    const ok = await copyTextToClipboard(css);
    if (ok) {
      setCopiedCssId(cluster.clusterId);
      setTimeout(() => setCopiedCssId(null), 2000);
    }
  };

  return (
    <div className="space-y-3">
      {components.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-[var(--figma-color-border,#e5e7eb)] rounded-lg text-xs text-gray-500 space-y-1">
          <p className="font-semibold text-gray-700">No 100% Identical Repeating Components Found</p>
          <p className="text-[11px] text-gray-400">
            Click &quot;Scan for Icons&quot; on the Icons tab to scan the project. Only components that appear 2 or more times with 100% identical size, radius, color, and properties will be grouped here.
          </p>
        </div>
      ) : (
        <>
          {/* 1. Summary Header Card */}
          <div className="bg-[var(--figma-color-bg-secondary,#f9fafb)] p-3 rounded-lg border border-[var(--figma-color-border,#e5e7eb)] flex items-center justify-between flex-wrap gap-2 text-xs">
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-gray-900 text-sm">
                  {components.length} Exact Component Groups
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                  ✓ 100% Same to Same
                </span>
              </div>
              <span className="text-[10px] text-gray-500 block mt-0.5">
                {totalInstances} total identical cloned instances found across your screens
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-gray-500">
                Click <b className="text-blue-600 font-semibold">Copy as CSS</b> to copy exact component CSS styling to clipboard.
              </span>
            </div>
          </div>

          {/* 2. Category Filter Chips + Search Input */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-1 overflow-x-auto pb-1 scrollbar-thin text-xs">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
                  selectedCategory === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All ({categoryCounts.all || 0})
              </button>
              {(Object.keys(CATEGORY_LABELS) as ComponentCategory[]).map(cat => {
                const count = categoryCounts[cat] || 0;
                if (count === 0) return null;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
                      selectedCategory === cat
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {CATEGORY_LABELS[cat]} ({count})
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Search components or screens..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full sm:w-56 px-2.5 py-1 text-xs border border-gray-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 3. Component Groups List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-500 px-0.5">
              <span>Showing {filteredClusters.length} matching identical component groups</span>
            </div>

            <div className="space-y-2.5">
              {filteredClusters.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg text-xs text-gray-400">
                  No matching components found.
                </div>
              ) : (
                filteredClusters.map(cluster => {
                  const badge = CATEGORY_BADGES[cluster.category] || CATEGORY_BADGES.other;
                  const isExpanded = expandedClusterIds.has(cluster.clusterId);
                  const firstItem = cluster.instances[0];
                  const props = firstItem.properties;
                  const isCopied = copiedCssId === cluster.clusterId;

                  return (
                    <div
                      key={cluster.clusterId}
                      className="bg-white border border-gray-200 rounded-lg p-3 space-y-2.5 shadow-xs hover:border-gray-300 transition-all"
                    >
                      {/* Cluster Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-gray-100 flex-wrap gap-2">
                        <div className="flex items-center space-x-2">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${badge.bg} ${badge.text} ${badge.border}`}>
                            {CATEGORY_LABELS[cluster.category]}
                          </span>
                          <span className="font-bold text-gray-900 text-xs">
                            {cluster.representativeName}
                          </span>
                        </div>

                        {/* Actions: Copy as CSS + Locate */}
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                            {cluster.totalOccurrences} exact clones
                          </span>

                          {/* Copy as CSS Button */}
                          <button
                            onClick={() => handleCopyCss(cluster)}
                            title="Copy component styles as CSS to clipboard"
                            className={`text-[11px] font-semibold px-2.5 py-1 rounded shadow-xs flex items-center space-x-1.5 transition-all ${
                              isCopied
                                ? 'bg-emerald-600 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            <span>{isCopied ? '✓' : '📋'}</span>
                            <span>{isCopied ? 'CSS Copied!' : 'Copy as CSS'}</span>
                          </button>

                          {/* Locate on Figma Canvas */}
                          <button
                            onClick={() => onSelectNode(cluster.representativeNodeId)}
                            title="Locate and zoom into component on Figma canvas"
                            className="text-[10px] text-gray-600 hover:text-blue-600 font-medium px-2 py-1 rounded border border-gray-200 hover:border-blue-300 bg-white"
                          >
                            <span>🔍 Locate</span>
                          </button>
                        </div>
                      </div>

                      {/* Main Body: Visual Thumbnail + Property Matrix */}
                      <div className="flex items-start space-x-3">
                        {/* Visual SVG Thumbnail */}
                        <div
                          onClick={() => handleCopyCss(cluster)}
                          title="Click to Copy as CSS"
                          className="w-20 h-16 bg-gray-50 border border-gray-200 rounded-md p-1.5 flex items-center justify-center flex-shrink-0 cursor-pointer hover:border-blue-400 group relative transition-colors"
                        >
                          {cluster.svgPreview ? (
                            <div
                              className="w-full h-full flex items-center justify-center [&_svg]:max-w-full [&_svg]:max-h-full [&_svg]:w-auto [&_svg]:h-auto"
                              dangerouslySetInnerHTML={{ __html: cluster.svgPreview }}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded bg-gray-200 animate-pulse" />
                          )}
                          <span className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 rounded-md flex items-center justify-center text-[9px] font-bold text-blue-700 transition-opacity">
                            Copy CSS
                          </span>
                        </div>

                        {/* Property Details Grid (100% Identical across all instances) */}
                        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                          {/* Dimensions */}
                          <div className="bg-gray-50/70 p-1.5 rounded border border-gray-100">
                            <span className="text-gray-400 block text-[9px] uppercase font-semibold">Exact Size</span>
                            <span className="font-mono font-bold text-gray-800">
                              {props.width} x {props.height}px
                            </span>
                          </div>

                          {/* Corner Radius */}
                          <div className="bg-gray-50/70 p-1.5 rounded border border-gray-100">
                            <span className="text-gray-400 block text-[9px] uppercase font-semibold">Exact Radius</span>
                            <span className="font-mono font-bold text-gray-800">
                              {typeof props.cornerRadius === 'number' ? `${props.cornerRadius}px` : props.cornerRadius}
                            </span>
                          </div>

                          {/* Fill Background */}
                          <div className="bg-gray-50/70 p-1.5 rounded border border-gray-100">
                            <span className="text-gray-400 block text-[9px] uppercase font-semibold">Exact Fill</span>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              {props.fills.length > 0 ? (
                                props.fills.slice(0, 2).map((hex, i) => (
                                  <div key={i} className="flex items-center space-x-1">
                                    <div
                                      className="w-3.5 h-3.5 rounded-sm border border-gray-300 shadow-xs"
                                      style={{ backgroundColor: hex }}
                                    />
                                    <span className="font-mono text-[10px] text-gray-700">{hex}</span>
                                  </div>
                                ))
                              ) : (
                                <span className="text-gray-400 text-[10px]">Transparent</span>
                              )}
                            </div>
                          </div>

                          {/* Border / Stroke */}
                          <div className="bg-gray-50/70 p-1.5 rounded border border-gray-100">
                            <span className="text-gray-400 block text-[9px] uppercase font-semibold">Exact Border</span>
                            {props.strokes.length > 0 ? (
                              <div className="flex items-center space-x-1 mt-0.5">
                                <div
                                  className="w-3.5 h-3.5 rounded-sm border border-gray-300"
                                  style={{ backgroundColor: props.strokes[0].color }}
                                />
                                <span className="font-mono text-[10px] text-gray-700">
                                  {props.strokes[0].color} ({props.strokes[0].weight}px)
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-[10px]">None</span>
                            )}
                          </div>

                          {/* AutoLayout & Padding */}
                          <div className="bg-gray-50/70 p-1.5 rounded border border-gray-100">
                            <span className="text-gray-400 block text-[9px] uppercase font-semibold">Padding &amp; Layout</span>
                            <span className="font-mono text-[10px] text-gray-700 truncate block">
                              {props.layoutMode !== 'NONE'
                                ? `${props.layoutMode[0]} (${props.padding.top},${props.padding.right},${props.padding.bottom},${props.padding.left})`
                                : 'Fixed Frame'}
                            </span>
                          </div>

                          {/* Typography */}
                          <div className="bg-gray-50/70 p-1.5 rounded border border-gray-100">
                            <span className="text-gray-400 block text-[9px] uppercase font-semibold">Typography</span>
                            {props.typography ? (
                              <span className="font-mono text-[10px] text-gray-700 truncate block">
                                {props.typography.family} {props.typography.size}px ({props.typography.weight})
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[10px]">No direct text</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Collapsible Exact Clones List */}
                      <div className="pt-1">
                        <button
                          onClick={() => toggleExpand(cluster.clusterId)}
                          className="text-[11px] text-gray-600 hover:text-gray-900 font-medium flex items-center space-x-1"
                        >
                          <span>{isExpanded ? '▼ Hide' : '▶ Show'} all {cluster.instances.length} exact clone locations</span>
                        </button>

                        {isExpanded && (
                          <div className="mt-2 border border-gray-100 rounded divide-y divide-gray-100 bg-gray-50/50 max-h-40 overflow-y-auto">
                            {cluster.instances.map((inst, iIdx) => (
                              <div
                                key={inst.nodeId + iIdx}
                                className="px-2.5 py-1.5 flex items-center justify-between text-[11px] hover:bg-white transition-colors"
                              >
                                <div className="truncate flex-1 min-w-0 pr-2">
                                  <span className="font-semibold text-gray-800 block truncate">
                                    {inst.name}
                                  </span>
                                  <span className="text-[10px] text-gray-400 block truncate">
                                    {inst.pageName} &gt; {inst.screenName}
                                  </span>
                                </div>

                                <div className="flex items-center space-x-1.5 flex-shrink-0">
                                  <span className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-gray-200 text-gray-600">
                                    {inst.properties.width}x{inst.properties.height}
                                  </span>
                                  <span className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-gray-200 text-gray-600">
                                    R: {inst.properties.cornerRadius}
                                  </span>
                                  <button
                                    onClick={() => onSelectNode(inst.nodeId)}
                                    title="Locate exact instance on canvas"
                                    className="text-[10px] text-blue-600 hover:text-blue-800 underline font-medium ml-1"
                                  >
                                    Locate
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
