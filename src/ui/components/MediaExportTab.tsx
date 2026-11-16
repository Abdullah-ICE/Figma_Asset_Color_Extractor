import React, { useState } from 'react';
import { DetectedMedia, MediaType } from '../../main/types';

interface Props {
  media: DetectedMedia[];
  isScanning: boolean;
  onSelectNode: (id: string) => void;
  onDeleteNodes: (ids: string[]) => void;
  onExportMedia: (ids: string[]) => void;
}

const MEDIA_TYPE_BADGES: Record<MediaType, { label: string; icon: string; bg: string; text: string; border: string }> = {
  video_mp4: {
    label: 'MP4 Video',
    icon: '🎥',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
  },
  lottie_json: {
    label: 'Lottie JSON',
    icon: '✨',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  image: {
    label: 'Image / Graphic',
    icon: '🖼️',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
  },
  other: {
    label: 'Media File',
    icon: '📁',
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-200',
  },
};

export const MediaExportTab: React.FC<Props> = ({
  media,
  isScanning,
  onSelectNode,
  onDeleteNodes,
  onExportMedia,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [targetDeleteIds, setTargetDeleteIds] = useState<string[]>([]);

  // Count by media type
  const counts = React.useMemo(() => {
    const res: Record<string, number> = { all: media.length, video_mp4: 0, lottie_json: 0, image: 0 };
    for (const m of media) {
      res[m.mediaType] = (res[m.mediaType] || 0) + 1;
    }
    return res;
  }, [media]);

  const filteredMedia = media.filter(m => {
    if (selectedFilter !== 'all' && m.mediaType !== selectedFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = m.name.toLowerCase().includes(q);
      const matchScreen = m.screenName.toLowerCase().includes(q);
      const matchFormat = m.format.toLowerCase().includes(q);
      if (!matchName && !matchScreen && !matchFormat) return false;
    }
    return true;
  });

  const isAllFilteredSelected =
    filteredMedia.length > 0 && filteredMedia.every(m => selectedIds.has(m.id));

  const toggleSelectAll = () => {
    if (isAllFilteredSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        for (const m of filteredMedia) {
          next.delete(m.id);
        }
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        for (const m of filteredMedia) {
          next.add(m.id);
        }
        return next;
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const promptDelete = (ids: string[]) => {
    setTargetDeleteIds(ids);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (targetDeleteIds.length > 0) {
      onDeleteNodes(targetDeleteIds);
      setSelectedIds(prev => {
        const next = new Set(prev);
        for (const id of targetDeleteIds) {
          next.delete(id);
        }
        return next;
      });
    }
    setShowDeleteConfirm(false);
    setTargetDeleteIds([]);
  };

  const handleExportSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length > 0) {
      onExportMedia(ids);
    }
  };

  return (
    <div className="space-y-3">
      {media.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-[var(--figma-color-border,#e5e7eb)] rounded-lg text-xs text-gray-500 space-y-1">
          <p className="font-semibold text-gray-700">No Embedded Media Files Detected</p>
          <p className="text-[11px] text-gray-400">
            Click &quot;Scan for Icons&quot; on the Icons tab to scan for embedded MP4 videos, Lottie animations, and graphic files.
          </p>
        </div>
      ) : (
        <>
          {/* 1. Summary Bar & Bulk Actions */}
          <div className="bg-[var(--figma-color-bg-secondary,#f9fafb)] p-3 rounded-lg border border-[var(--figma-color-border,#e5e7eb)] flex items-center justify-between flex-wrap gap-2 text-xs">
            <div>
              <span className="font-bold text-gray-900 block text-sm">
                {media.length} Embedded Media Assets Found
              </span>
              <span className="text-[10px] text-gray-500">
                {counts.video_mp4} MP4 Videos • {counts.lottie_json} Lottie Animations • {counts.image} Images
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleExportSelected}
                disabled={selectedIds.size === 0}
                className={`px-3 py-1 text-xs rounded font-semibold flex items-center space-x-1 shadow-xs transition-all ${
                  selectedIds.size > 0
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <span>📥 Download Selected ({selectedIds.size})</span>
              </button>

              <button
                onClick={() => promptDelete(Array.from(selectedIds))}
                disabled={selectedIds.size === 0}
                className={`px-2.5 py-1 text-xs rounded font-medium flex items-center space-x-1 border transition-all ${
                  selectedIds.size > 0
                    ? 'border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700'
                    : 'border-gray-200 text-gray-300 cursor-not-allowed'
                }`}
              >
                <span>🗑️ Delete ({selectedIds.size})</span>
              </button>
            </div>
          </div>

          {/* 2. Filter Chips & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setSelectedFilter('all')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  selectedFilter === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All ({counts.all})
              </button>
              {counts.video_mp4 > 0 && (
                <button
                  onClick={() => setSelectedFilter('video_mp4')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors flex items-center space-x-1 ${
                    selectedFilter === 'video_mp4'
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  <span>🎥 MP4 Video ({counts.video_mp4})</span>
                </button>
              )}
              {counts.lottie_json > 0 && (
                <button
                  onClick={() => setSelectedFilter('lottie_json')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors flex items-center space-x-1 ${
                    selectedFilter === 'lottie_json'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  <span>✨ Lottie JSON ({counts.lottie_json})</span>
                </button>
              )}
              {counts.image > 0 && (
                <button
                  onClick={() => setSelectedFilter('image')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors flex items-center space-x-1 ${
                    selectedFilter === 'image'
                      ? 'bg-sky-600 text-white'
                      : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                  }`}
                >
                  <span>🖼️ Images ({counts.image})</span>
                </button>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Search file name, screen..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full sm:w-52 px-2.5 py-1 text-xs border border-gray-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500"
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

          {/* 3. Media Items List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500 px-1">
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isAllFilteredSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span className="font-medium text-gray-700">Select All Filtered</span>
              </label>

              <span>Showing {filteredMedia.length} media files</span>
            </div>

            <div className="border border-[var(--figma-color-border,#e5e7eb)] rounded-lg divide-y divide-gray-100 bg-white max-h-[460px] overflow-y-auto">
              {filteredMedia.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400">
                  No media matching your search criteria.
                </div>
              ) : (
                filteredMedia.map((m, idx) => {
                  const badge = MEDIA_TYPE_BADGES[m.mediaType] || MEDIA_TYPE_BADGES.other;
                  const isChecked = selectedIds.has(m.id);

                  return (
                    <div
                      key={m.id + idx}
                      className={`p-3 flex items-center justify-between gap-3 text-xs transition-colors hover:bg-gray-50 ${
                        isChecked ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      {/* Checkbox + Info */}
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(m.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 flex-shrink-0"
                        />

                        {/* Format Icon Avatar */}
                        <div className={`w-9 h-9 rounded-md border flex items-center justify-center flex-shrink-0 text-base ${badge.bg} ${badge.border}`}>
                          {badge.icon}
                        </div>

                        {/* Metadata */}
                        <div className="truncate min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-gray-900 truncate text-[12px]">
                              {m.name}
                            </span>
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${badge.bg} ${badge.text} ${badge.border}`}>
                              {m.format.toUpperCase()}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2 text-[10px] text-gray-400 mt-0.5 font-mono truncate">
                            <span>{m.width}x{m.height}px</span>
                            <span>•</span>
                            <span className="truncate">{m.pageName} &gt; {m.screenName}</span>
                            {m.sizeEstimate && (
                              <>
                                <span>•</span>
                                <span className="text-gray-500 font-semibold">{m.sizeEstimate}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-1.5 flex-shrink-0">
                        {/* Download Single */}
                        <button
                          onClick={() => onExportMedia([m.id])}
                          title={`Download ${m.format.toUpperCase()}`}
                          className="px-2 py-1 text-[11px] bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded font-medium transition-colors"
                        >
                          Download
                        </button>

                        {/* Locate on Canvas */}
                        <button
                          onClick={() => onSelectNode(m.id)}
                          title="Locate on Figma Canvas"
                          className="px-2 py-1 text-[11px] bg-white border border-gray-200 hover:border-blue-300 text-gray-600 hover:text-blue-600 rounded font-medium transition-colors"
                        >
                          Locate
                        </button>

                        {/* Delete from Canvas */}
                        <button
                          onClick={() => promptDelete([m.id])}
                          title="Permanently remove layer from Figma canvas"
                          className="px-1.5 py-1 text-[11px] text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition-colors"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-4 space-y-3 border border-gray-200">
                <div className="flex items-center space-x-2 text-rose-600 font-bold text-sm">
                  <span>⚠️ Confirm Canvas Deletion</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Are you sure you want to permanently delete <b>{targetDeleteIds.length}</b> media layer(s) from your Figma canvas? This helps clean up heavy files, but cannot be undone inside the plugin.
                </p>
                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="px-3 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded font-bold shadow-xs"
                  >
                    Yes, Delete from Canvas
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
