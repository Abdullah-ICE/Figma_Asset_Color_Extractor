import React, { useState, useMemo } from 'react';
import { ExtractedColor, ColorRole } from '../../main/types';
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

const ROLE_BADGES: Record<ColorRole, { label: string; bg: string; text: string }> = {
  token: { label: 'Token', bg: 'bg-purple-100', text: 'text-purple-700' },
  surface: { label: 'Surface', bg: 'bg-blue-100', text: 'text-blue-700' },
  text: { label: 'Text', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  border: { label: 'Border', bg: 'bg-amber-100', text: 'text-amber-700' },
};

export const ColorExportTab: React.FC<Props> = ({ colors, isScanning }) => {
  const [tokenFormat, setTokenFormat] = useState<'css' | 'tailwind' | 'scss' | 'json'>('css');
  const [selectedScreen, setSelectedScreen] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [strictMode, setStrictMode] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  // Extract all unique screens across detected colors
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

  // Filtered colors based on Strict Mode, Screen Scope, and Role
  const filteredColors = useMemo(() => {
    return colors.filter(c => {
      // 1. Strict Developer Mode Filter:
      // Exclude raw one-off noise colors with usageCount < 2 and no style/variable name
      if (strictMode) {
        if (c.source === 'raw_node' && c.usageCount < 2 && !c.name) {
          return false;
        }
        if (!c.roles || c.roles.length === 0) {
          return false;
        }
      }

      // 2. Screen Scope Filter:
      if (selectedScreen !== 'all') {
        const appearsOnScreen = c.screenNames && c.screenNames.includes(selectedScreen);
        if (!appearsOnScreen) {
          return false;
        }
      }

      // 3. Role Filter:
      if (selectedRole !== 'all') {
        if (!c.roles || !c.roles.includes(selectedRole as ColorRole)) {
          return false;
        }
      }

      return true;
    });
  }, [colors, strictMode, selectedScreen, selectedRole]);

  // Role Counts (based on current strictMode and screen filter)
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0, token: 0, surface: 0, text: 0, border: 0 };
    for (const c of colors) {
      if (strictMode && c.source === 'raw_node' && c.usageCount < 2 && !c.name) {
        continue;
      }
      if (selectedScreen !== 'all' && (!c.screenNames || !c.screenNames.includes(selectedScreen))) {
        continue;
      }
      counts.all++;
      if (c.roles) {
        for (const r of c.roles) {
          if (counts[r] !== undefined) counts[r]++;
        }
      }
    }
    return counts;
  }, [colors, strictMode, selectedScreen]);

  const getCode = () => {
    switch (tokenFormat) {
      case 'css':
        return generateCssVariables(filteredColors);
      case 'tailwind':
        return generateTailwindConfig(filteredColors);
      case 'scss':
        return generateScssVariables(filteredColors);
      case 'json':
        return generateDesignTokensJson(filteredColors);
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

  const handleDownload = () => {
    const code = getCode();
    const extensions = { css: 'css', tailwind: 'js', scss: 'scss', json: 'json' };
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `design-tokens.${extensions[tokenFormat]}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3.5">
      {colors.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-[var(--figma-color-border,#e5e7eb)] rounded-lg text-xs text-gray-500 space-y-1">
          <p className="font-semibold text-gray-700">No Project Colors Extracted Yet</p>
          <p className="text-[11px] text-gray-400">
            Click &quot;Scan for Icons&quot; on the Icons tab to automatically extract clean developer colors.
          </p>
        </div>
      ) : (
        <>
          {/* 1. Header Toolbar: Developer Scope & Strict Mode */}
          <div className="bg-[var(--figma-color-bg-secondary,#f9fafb)] p-3 rounded-lg border border-[var(--figma-color-border,#e5e7eb)] space-y-2.5 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="font-bold text-gray-900 block text-sm">
                  {filteredColors.length} Developer Colors
                  {selectedScreen !== 'all' && (
                    <span className="font-normal text-gray-500 ml-1 text-xs">
                      on &quot;{selectedScreen}&quot;
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-gray-500">
                  Strictly filtered: Text colors, Button &amp; Surface backgrounds, Borders &amp; Design Tokens (No Icon/Vector clutter)
                </span>
              </div>

              {/* Strict Dev Mode Toggle */}
              <button
                onClick={() => setStrictMode(!strictMode)}
                className={`px-2.5 py-1 text-[11px] rounded-md font-semibold flex items-center space-x-1.5 transition-all border ${
                  strictMode
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs'
                    : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
                }`}
                title="When ON: Excludes 1-off noise colors and non-developer vector colors"
              >
                <span>{strictMode ? '🛡️ Strict Dev Mode: ON' : '⚙️ Strict Dev Mode: OFF'}</span>
              </button>
            </div>

            {/* Scope / Screen Selector Dropdown */}
            {allScreens.length > 0 && (
              <div className="flex items-center space-x-2 pt-1 border-t border-gray-200">
                <span className="text-[11px] font-semibold text-gray-600 flex-shrink-0">
                  🎯 Screen Scope:
                </span>
                <select
                  value={selectedScreen}
                  onChange={e => setSelectedScreen(e.target.value)}
                  className="bg-white border border-gray-300 rounded px-2 py-0.5 text-xs text-gray-800 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none flex-1 max-w-xs"
                >
                  <option value="all">🌐 All Screens ({allScreens.length} artboards)</option>
                  {allScreens.map(scr => (
                    <option key={scr} value={scr}>
                      {scr}
                    </option>
                  ))}
                </select>
                {selectedScreen !== 'all' && (
                  <button
                    onClick={() => setSelectedScreen('all')}
                    className="text-[10px] text-blue-600 hover:underline font-medium"
                  >
                    Reset Scope
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 2. Role Filter Chips */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 text-xs">
            <button
              onClick={() => setSelectedRole('all')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
                selectedRole === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Roles ({roleCounts.all})
            </button>
            <button
              onClick={() => setSelectedRole('surface')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap flex items-center space-x-1 ${
                selectedRole === 'surface'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              <span>🖼️ Surfaces &amp; BG ({roleCounts.surface})</span>
            </button>
            <button
              onClick={() => setSelectedRole('text')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap flex items-center space-x-1 ${
                selectedRole === 'text'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              <span>🔤 Text ({roleCounts.text})</span>
            </button>
            <button
              onClick={() => setSelectedRole('border')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap flex items-center space-x-1 ${
                selectedRole === 'border'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              <span>📏 Borders ({roleCounts.border})</span>
            </button>
            <button
              onClick={() => setSelectedRole('token')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap flex items-center space-x-1 ${
                selectedRole === 'token'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
            >
              <span>💎 Design Tokens ({roleCounts.token})</span>
            </button>
          </div>

          {/* 3. Color Swatch Grid */}
          <div className="border border-[var(--figma-color-border,#e5e7eb)] rounded-lg p-2 max-h-48 overflow-y-auto bg-[var(--figma-color-bg,#ffffff)]">
            {filteredColors.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-xs">
                No colors match the current filter or screen.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-xs">
                {filteredColors.map((c, idx) => {
                  const isItemCopied = copiedHex === c.hex;
                  return (
                    <div
                      key={`${c.hex}-${idx}`}
                      onClick={() => handleCopySingleColor(c.hex)}
                      title={`Click to copy ${c.hex}\nRoles: ${(c.roles || []).join(', ')}\nScreens: ${(c.screenNames || []).join(', ') || 'Global'}`}
                      className="flex items-center space-x-2.5 p-1.5 rounded border border-gray-100 hover:bg-gray-50 hover:border-blue-300 transition-all cursor-pointer group"
                    >
                      <div
                        className="w-8 h-8 rounded border border-gray-300 shadow-inner flex-shrink-0"
                        style={{ backgroundColor: c.hex }}
                      />
                      <div className="truncate flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-[11px] text-[var(--figma-color-text,#111827)]">
                            {c.hex}
                          </span>
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-medium transition-opacity ${
                              isItemCopied
                                ? 'bg-emerald-100 text-emerald-800 font-bold opacity-100'
                                : 'text-gray-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            {isItemCopied ? '✓ Copied' : 'Copy'}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1 mt-0.5 truncate">
                          {c.roles && c.roles.map(r => {
                            const b = ROLE_BADGES[r];
                            if (!b) return null;
                            return (
                              <span
                                key={r}
                                className={`text-[8.5px] px-1 py-0.2 rounded font-semibold ${b.bg} ${b.text}`}
                              >
                                {b.label}
                              </span>
                            );
                          })}
                          <span className="text-[10px] text-gray-400 truncate">
                            {c.name || `${c.usageCount} uses`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Token Code Generator */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-1">
                {(['css', 'tailwind', 'scss', 'json'] as const).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => setTokenFormat(fmt)}
                    className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                      tokenFormat === fmt
                        ? 'bg-blue-600 text-white font-semibold'
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
                  title="Copy filtered tokens code to clipboard"
                  className={`px-3 py-1 text-xs rounded transition-all font-semibold flex items-center space-x-1 shadow-xs ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <span>{copied ? '✓' : '📋'}</span>
                  <span>{copied ? 'Copied Tokens!' : 'Copy Code'}</span>
                </button>
                <button
                  onClick={handleDownload}
                  className="px-2.5 py-1 text-xs bg-gray-900 text-white rounded hover:bg-black transition-colors font-medium"
                >
                  Download File
                </button>
              </div>
            </div>

            <pre className="p-3 bg-gray-900 text-gray-100 rounded-lg text-[11px] font-mono max-h-48 overflow-auto border border-gray-800 leading-relaxed select-text">
              <code>{getCode()}</code>
            </pre>
          </div>
        </>
      )}
    </div>
  );
};
