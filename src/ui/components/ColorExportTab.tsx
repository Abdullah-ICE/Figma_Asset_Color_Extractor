import React, { useState, useMemo } from 'react';
import { ExtractedColor } from '../../main/types';
import { copyTextToClipboard } from '../utils/clipboard';
import {
  generateCssVariables,
  generateDesignTokensJson,
  generateScssVariables,
  generateTailwindConfig,
} from '../utils/tokenGenerators';

interface Props {
  colors: ExtractedColor[];
  isScanning: boolean;
}

export const ColorExportTab: React.FC<Props> = ({ colors }) => {
  const [selectedScreen, setSelectedScreen] = useState<string>('all');
  const [tokenFormat, setTokenFormat] = useState<'css' | 'tailwind' | 'scss' | 'json'>('css');
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  // Extract all unique screens
  const allScreens = useMemo(() => {
    const screens = new Set<string>();
    for (const c of colors) {
      if (c.screenNames) {
        for (const s of c.screenNames) {
          if (s && s.trim()) screens.add(s.trim());
        }
      }
    }
    return Array.from(screens).sort();
  }, [colors]);

  // Clean, strictly filtered colors:
  const displayColors = useMemo(() => {
    if (selectedScreen !== 'all') {
      // Single Screen: Show ONLY the colors used on this exact screen
      return colors.filter(c => c.screenNames && c.screenNames.includes(selectedScreen));
    }
    return colors;
  }, [colors, selectedScreen]);

  // Group into clean, simple sections: Surfaces, Text, Borders
  const groupedColors = useMemo(() => {
    const text: ExtractedColor[] = [];
    const surface: ExtractedColor[] = [];
    const border: ExtractedColor[] = [];
    const other: ExtractedColor[] = [];

    for (const c of displayColors) {
      if (c.roles && c.roles.includes('text')) {
        text.push(c);
      } else if (c.roles && c.roles.includes('surface')) {
        surface.push(c);
      } else if (c.roles && c.roles.includes('border')) {
        border.push(c);
      } else {
        other.push(c);
      }
    }

    return { text, surface, border, other };
  }, [displayColors]);

  const getCode = () => {
    switch (tokenFormat) {
      case 'css':
        return generateCssVariables(displayColors);
      case 'tailwind':
        return generateTailwindConfig(displayColors);
      case 'scss':
        return generateScssVariables(displayColors);
      case 'json':
        return generateDesignTokensJson(displayColors);
    }
  };

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(getCode());
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopySingleColor = async (hex: string) => {
    const ok = await copyTextToClipboard(hex);
    if (ok) {
      setCopiedHex(hex);
      setTimeout(() => setCopiedHex(null), 1500);
    }
  };

  const renderColorCard = (c: ExtractedColor, idx: number) => {
    const isItemCopied = copiedHex === c.hex;
    return (
      <div
        key={`${c.hex}-${idx}`}
        onClick={() => handleCopySingleColor(c.hex)}
        title={`Click to copy ${c.hex}`}
        className="flex items-center space-x-2.5 p-2 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer bg-white group"
      >
        <div
          className="w-7 h-7 rounded-md border border-gray-300 shadow-xs flex-shrink-0"
          style={{ backgroundColor: c.hex }}
        />
        <div className="truncate flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="font-mono font-bold text-xs text-gray-900">{c.hex}</span>
            <span
              className={`text-[9px] px-1 py-0.2 rounded font-semibold transition-opacity ${
                isItemCopied
                  ? 'bg-emerald-100 text-emerald-800 opacity-100'
                  : 'text-gray-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100'
              }`}
            >
              {isItemCopied ? '✓ Copied' : 'Copy'}
            </span>
          </div>
          <span className="text-[10px] text-gray-500 truncate block">
            {c.name || `${c.usageCount} uses`}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {colors.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-lg text-xs text-gray-500 space-y-1">
          <p className="font-semibold text-gray-700">No Colors Extracted</p>
          <p className="text-[11px] text-gray-400">
            Click &quot;Scan for Icons&quot; on the Icons tab to auto-extract colors.
          </p>
        </div>
      ) : (
        <>
          {/* Top Bar: Clean Screen Selector */}
          <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 flex items-center justify-between gap-2 text-xs flex-wrap">
            <span className="font-bold text-gray-900 text-xs">
              🎨 {displayColors.length} Colors {selectedScreen !== 'all' ? `on "${selectedScreen}"` : 'in Project'}
            </span>

            {allScreens.length > 0 && (
              <div className="flex items-center space-x-1.5 flex-1 max-w-xs ml-auto">
                <span className="text-[11px] font-medium text-gray-500 flex-shrink-0">Screen:</span>
                <select
                  value={selectedScreen}
                  onChange={e => setSelectedScreen(e.target.value)}
                  className="bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-800 font-semibold focus:ring-1 focus:ring-blue-500 focus:outline-none w-full"
                >
                  <option value="all">🌐 All Screens ({allScreens.length})</option>
                  {allScreens.map(scr => (
                    <option key={scr} value={scr}>
                      {scr}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Clean Color Lists Grouped by Role */}
          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {displayColors.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-xs">
                No colors found for this screen.
              </div>
            ) : (
              <>
                {/* 1. Surfaces & Backgrounds */}
                {groupedColors.surface.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-gray-700 px-1">
                      <span>🖼️ Surfaces &amp; Backgrounds ({groupedColors.surface.length})</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {groupedColors.surface.map((c, i) => renderColorCard(c, i))}
                    </div>
                  </div>
                )}

                {/* 2. Text & Typography */}
                {groupedColors.text.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-gray-700 px-1">
                      <span>🔤 Text Colors ({groupedColors.text.length})</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {groupedColors.text.map((c, i) => renderColorCard(c, i))}
                    </div>
                  </div>
                )}

                {/* 3. Borders & Lines */}
                {groupedColors.border.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-gray-700 px-1">
                      <span>📏 Borders &amp; Lines ({groupedColors.border.length})</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {groupedColors.border.map((c, i) => renderColorCard(c, i))}
                    </div>
                  </div>
                )}

                {/* 4. Other / Tokens */}
                {groupedColors.other.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-gray-700 px-1">
                      <span>💎 Design Tokens ({groupedColors.other.length})</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {groupedColors.other.map((c, i) => renderColorCard(c, i))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Simple Code Generator */}
          <div className="space-y-2 pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-1">
                {(['css', 'tailwind', 'scss', 'json'] as const).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => setTokenFormat(fmt)}
                    className={`px-2 py-0.5 text-xs rounded font-medium transition-colors ${
                      tokenFormat === fmt
                        ? 'bg-gray-900 text-white font-bold'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  onClick={handleCopy}
                  className={`px-3 py-1 text-xs rounded font-semibold flex items-center space-x-1 shadow-xs transition-all ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <span>{copied ? '✓' : '📋'}</span>
                  <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>
            </div>

            <pre className="p-3 bg-gray-900 text-gray-100 rounded-lg text-[11px] font-mono max-h-40 overflow-auto border border-gray-800 leading-relaxed select-text">
              <code>{getCode()}</code>
            </pre>
          </div>
        </>
      )}
    </div>
  );
};
