import React, { useState } from 'react';
import { ComponentCategory, ComponentCluster } from '../../main/types';

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

export const ComponentInventoryTab: React.FC<Props> = ({ components, isScanning, onSelectNode }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedClusterIds, setExpandedClusterIds] = useState<Set<string>>(new Set());

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

  const toggleExpand = (id: string) => {
    const next = new Set(expandedClusterIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedClusterIds(next);
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
              <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                Occurrences &ge; 2
              </span>
            </div>
          </div>

          {/* 2. Filter Bar & Search */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
              {/* Category Filter Chips */}
              <div className="flex items-center space-x-1 overflow-x-auto py-0.5 scrollbar-none">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
                    selectedCategory === 'all'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All ({categoryCounts.all || 0})
                </button>
                {(['button', 'card', 'input', 'badge', 'avatar', 'row_item'] as const).map(cat => {
                  const count = categoryCounts[cat] || 0;
                  if (count === 0) return null;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
                        selectedCategory === cat
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {CATEGORY_LABELS[cat]} ({count})
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                placeholder="Search exact components..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"
              />
            </div>

            {/* 3. Cluster Cards List */}
            <div className="space-y-3 max-h-[calc(100vh-270px)] overflow-y-auto pr-0.5">
              {filteredClusters.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 border border-dashed rounded-lg bg-white">
                  No matching components found.
                </div>
              ) : (
                filteredClusters.map(cluster => {
                  const badge = CATEGORY_BADGES[cluster.category] || CATEGORY_BADGES.other;
                  const isExpanded = expandedClusterIds.has(cluster.clusterId);
                  const firstItem = cluster.instances[0];
                  const props = firstItem.properties;

                  return (
                    <div
                      key={cluster.clusterId}
                      className="bg-white border border-gray-200 rounded-lg p-3 space-y-2.5 shadow-xs hover:border-gray-300 transition-all"
                    >
                      {/* Cluster Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-gray-100 flex-wrap gap-1">
                        <div className="flex items-center space-x-2">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${badge.bg} ${badge.text} ${badge.border}`}>
                            {CATEGORY_LABELS[cluster.category]}
                          </span>
                          <span className="font-bold text-gray-900 text-xs">
                            {cluster.representativeName}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                            {cluster.totalOccurrences} exact clones
                          </span>
                          <button
                            onClick={() => onSelectNode(cluster.representativeNodeId)}
                            title="Locate on Figma Canvas"
                            className="text-[10px] text-blue-600 hover:text-blue-800 font-medium underline flex items-center space-x-0.5"
                          >
                            <span>🔍 Locate</span>
                          </button>
                        </div>
                      </div>

                      {/* Main Body: Visual Thumbnail + Property Matrix */}
                      <div className="flex items-start space-x-3">
                        {/* Visual SVG Thumbnail */}
                        <div className="w-20 h-16 bg-gray-50 border border-gray-200 rounded-md p-1.5 flex items-center justify-center flex-shrink-0">
                          {cluster.svgPreview ? (
                            <div
                              className="w-full h-full flex items-center justify-center [&_svg]:max-w-full [&_svg]:max-h-full [&_svg]:w-auto [&_svg]:h-auto"
                              dangerouslySetInnerHTML={{ __html: cluster.svgPreview }}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded bg-gray-200 animate-pulse" />
                          )}
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

                                <div className="flex items-center space-x-2 flex-shrink-0">
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
