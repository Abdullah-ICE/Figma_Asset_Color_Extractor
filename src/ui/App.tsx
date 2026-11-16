import React, { useEffect, useRef, useState } from 'react';
import {
  ComponentCluster,
  DetectedIcon,
  DetectedMedia,
  ExportRequest,
  ExtractedColor,
  ExtractedTypography,
  PluginToUIMessage,
  ScanConfig,
  UIToPluginMessage,
} from '../main/types';
import { ColorExportTab } from './components/ColorExportTab';
import { ComponentInventoryTab } from './components/ComponentInventoryTab';
import { ExportProgressBar } from './components/ExportProgressBar';
import { IconExportTab } from './components/IconExportTab';
import { MediaExportTab } from './components/MediaExportTab';
import { TypographyExportTab } from './components/TypographyExportTab';
import { ZipArchiver } from './utils/zipArchiver';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'icons' | 'media' | 'colors' | 'typography' | 'components'>('icons');
  const [icons, setIcons] = useState<DetectedIcon[]>([]);
  const [media, setMedia] = useState<DetectedMedia[]>([]);
  const [colors, setColors] = useState<ExtractedColor[]>([]);
  const [typography, setTypography] = useState<ExtractedTypography[]>([]);
  const [components, setComponents] = useState<ComponentCluster[]>([]);
  const [selectionCount, setSelectionCount] = useState<number>(0);

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number; statusText: string }>({
    current: 0,
    total: 0,
    statusText: '',
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const archiverRef = useRef<ZipArchiver | null>(null);
  const mediaArchiverRef = useRef<ZipArchiver | null>(null);
  const currentFormatRef = useRef<ExportRequest['format']>('SVG');

  const postToPlugin = (msg: UIToPluginMessage) => {
    parent.postMessage({ pluginMessage: msg }, '*');
  };

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const msg: PluginToUIMessage = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === 'SELECTION_CHANGED') {
        setSelectionCount(msg.count);
      }

      if (msg.type === 'SCAN_COMPLETE') {
        setIcons(msg.icons);
        setColors(msg.colors);
        if ('typography' in msg && Array.isArray(msg.typography)) {
          setTypography(msg.typography);
        }
        if ('components' in msg && Array.isArray(msg.components)) {
          setComponents(msg.components);
        }
        if ('media' in msg && Array.isArray(msg.media)) {
          setMedia(msg.media);
        }
        setIsScanning(false);
        setErrorMessage(null);
      }

      if (msg.type === 'NODES_DELETED') {
        const deletedSet = new Set(msg.ids);
        setMedia(prev => prev.filter(m => !deletedSet.has(m.id)));
        setIcons(prev => prev.filter(i => !deletedSet.has(i.id)));
      }

      if (msg.type === 'ICON_PREVIEWS_CHUNK') {
        const previewMap = new Map<string, string>();
        for (const p of msg.previews) {
          previewMap.set(p.id, p.svg);
        }
        setIcons(prev =>
          prev.map(icon => {
            const svg = previewMap.get(icon.id);
            return svg ? { ...icon, svgPreview: svg } : icon;
          })
        );
      }

      if (msg.type === 'COMPONENT_PREVIEWS_CHUNK') {
        const previewMap = new Map<string, string>();
        for (const p of msg.previews) {
          previewMap.set(p.id, p.svg);
        }
        setComponents(prev =>
          prev.map(cluster => {
            const svg = previewMap.get(cluster.clusterId);
            return svg ? { ...cluster, svgPreview: svg } : cluster;
          })
        );
      }

      if (msg.type === 'EXPORT_CHUNK') {
        if (archiverRef.current) {
          archiverRef.current.addAsset(
            msg.item.relativePath,
            msg.item.bytes,
            currentFormatRef.current
          );
        }
        setProgress({
          current: msg.current,
          total: msg.total,
          statusText: `Exporting: ${msg.item.name}`,
        });
      }

      if (msg.type === 'EXPORT_COMPLETE') {
        if (archiverRef.current) {
          setProgress(prev => ({ ...prev, statusText: 'Creating ZIP archive...' }));
          await archiverRef.current.downloadZip(status => {
            setProgress(prev => ({ ...prev, statusText: status }));
          });
        }
        setIsExporting(false);
        archiverRef.current = null;
      }

      if (msg.type === 'MEDIA_EXPORT_CHUNK') {
        if (mediaArchiverRef.current) {
          mediaArchiverRef.current.addRawFile(msg.item.filename, msg.item.bytes);
        }
        setProgress({
          current: msg.current,
          total: msg.total,
          statusText: `Exporting media: ${msg.item.name}`,
        });
      }

      if (msg.type === 'MEDIA_EXPORT_COMPLETE') {
        if (mediaArchiverRef.current) {
          setProgress(prev => ({ ...prev, statusText: 'Creating Media ZIP archive...' }));
          await mediaArchiverRef.current.downloadZip(status => {
            setProgress(prev => ({ ...prev, statusText: status }));
          });
        }
        setIsExporting(false);
        mediaArchiverRef.current = null;
      }

      if (msg.type === 'ERROR') {
        setErrorMessage(msg.message);
        setIsScanning(false);
        setIsExporting(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleScan = (config: ScanConfig) => {
    setIsScanning(true);
    setErrorMessage(null);
    postToPlugin({ type: 'SCAN_PROJECT', config });
  };

  const handleExport = (request: ExportRequest) => {
    setIsExporting(true);
    currentFormatRef.current = request.format;
    archiverRef.current = new ZipArchiver(`figma-icons-${request.format.toLowerCase()}.zip`);
    setProgress({ current: 0, total: request.nodeIds.length, statusText: 'Initializing export...' });
    postToPlugin({ type: 'START_EXPORT', request });
  };

  const handleExportMedia = (ids: string[]) => {
    setIsExporting(true);
    mediaArchiverRef.current = new ZipArchiver('figma-media-assets.zip');
    setProgress({ current: 0, total: ids.length, statusText: 'Extracting media files...' });
    postToPlugin({ type: 'EXPORT_MEDIA', ids });
  };

  const handleDeleteNodes = (ids: string[]) => {
    postToPlugin({ type: 'DELETE_NODES', ids });
  };

  const handleSelectNode = (id: string) => {
    postToPlugin({ type: 'SELECT_NODE', id });
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = window.innerWidth;
    const startHeight = window.innerHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(520, startWidth + (moveEvent.clientX - startX));
      const newHeight = Math.max(520, startHeight + (moveEvent.clientY - startY));
      postToPlugin({ type: 'RESIZE_WINDOW', width: newWidth, height: newHeight });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="relative flex flex-col h-screen bg-[var(--figma-color-bg,#ffffff)] text-[var(--figma-color-text,#111827)] font-sans antialiased text-xs select-none overflow-hidden">
      {/* Header */}
      <header className="px-3.5 py-2 border-b border-[var(--figma-color-border,#e5e7eb)] flex items-center justify-between flex-shrink-0 bg-white">
        <div>
          <h1 className="font-bold text-sm tracking-tight text-[var(--figma-color-text,#111827)]">
            Asset, Color &amp; Media Extractor
          </h1>
          <p className="text-[10px] text-gray-500">
            Export Deduplicated Icons, MP4 Videos, Lottie, Colors &amp; Typography
          </p>
        </div>

        {/* 5-Tab Navigation Pill */}
        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button
            onClick={() => setActiveTab('icons')}
            className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors ${
              activeTab === 'icons'
                ? 'bg-[var(--figma-color-bg,#ffffff)] shadow-sm text-blue-600 font-bold'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Icons {icons.length > 0 && `(${icons.length})`}
          </button>
          <button
            onClick={() => setActiveTab('media')}
            className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors ${
              activeTab === 'media'
                ? 'bg-[var(--figma-color-bg,#ffffff)] shadow-sm text-blue-600 font-bold'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Media &amp; Files {media.length > 0 && `(${media.length})`}
          </button>
          <button
            onClick={() => setActiveTab('colors')}
            className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors ${
              activeTab === 'colors'
                ? 'bg-[var(--figma-color-bg,#ffffff)] shadow-sm text-blue-600 font-bold'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Colors {colors.length > 0 && `(${colors.length})`}
          </button>
          <button
            onClick={() => setActiveTab('typography')}
            className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors ${
              activeTab === 'typography'
                ? 'bg-[var(--figma-color-bg,#ffffff)] shadow-sm text-blue-600 font-bold'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Typography {typography.length > 0 && `(${typography.length})`}
          </button>
          <button
            onClick={() => setActiveTab('components')}
            className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors ${
              activeTab === 'components'
                ? 'bg-[var(--figma-color-bg,#ffffff)] shadow-sm text-blue-600 font-bold'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Components {components.length > 0 && `(${components.length})`}
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 overflow-y-auto p-3 flex flex-col min-h-0">
        {errorMessage && (
          <div className="p-2.5 mb-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex justify-between items-center">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-800 font-bold ml-2"
            >
              ×
            </button>
          </div>
        )}

        {isExporting && (
          <div className="mb-2">
            <ExportProgressBar
              current={progress.current}
              total={progress.total}
              statusText={progress.statusText}
            />
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0">
          {activeTab === 'icons' ? (
            <IconExportTab
              icons={icons}
              isScanning={isScanning}
              isExporting={isExporting}
              selectionCount={selectionCount}
              onScan={handleScan}
              onExport={handleExport}
              onSelectNode={handleSelectNode}
            />
          ) : activeTab === 'media' ? (
            <MediaExportTab
              media={media}
              isScanning={isScanning}
              onSelectNode={handleSelectNode}
              onDeleteNodes={handleDeleteNodes}
              onExportMedia={handleExportMedia}
            />
          ) : activeTab === 'colors' ? (
            <ColorExportTab colors={colors} isScanning={isScanning} />
          ) : activeTab === 'typography' ? (
            <TypographyExportTab typography={typography} isScanning={isScanning} />
          ) : (
            <ComponentInventoryTab
              components={components}
              isScanning={isScanning}
              onSelectNode={handleSelectNode}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-3 py-1.5 border-t border-[var(--figma-color-border,#e5e7eb)] flex justify-between items-center text-[10px] text-gray-400 bg-[var(--figma-color-bg-secondary,#fafafa)] flex-shrink-0">
        <span>Figma Asset, Media &amp; Component Extractor • Drag corner ↘ to resize</span>
        <button
          onClick={() => postToPlugin({ type: 'CLOSE_PLUGIN' })}
          className="hover:text-gray-700 underline pr-4"
        >
          Close
        </button>
      </footer>

      {/* Drag Resize Handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        title="Click and drag to freely resize the window"
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-50 flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors"
      >
        <span className="text-[11px] leading-none select-none font-mono">↘</span>
      </div>
    </div>
  );
};
