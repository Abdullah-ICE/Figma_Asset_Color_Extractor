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
  const [minUsage, setMinUsage] = useState<number>(1); // 1 = keep all real colors, 2 = exclude 1-offs
  const [includeTokens, setIncludeTokens] = useState<boolean>(true); // keep global design tokens in screen view
  const [searchQuery, setSearchQuery] = useState<string>('');
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

  // Strict & Safe Filter: Guaranteed NO accidental drops of essential colors
  const filteredColors = useMemo(() => {
    return colors.filter(c => {
      // 1. Search Query Filter (hex, name, or role)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchHex = c.hex.toLowerCase().includes(q);
        const matchName = c.name ? c.name.toLowerCase().includes(q) : false;
        const matchRole = c.roles ? c.roles.some(r => r.toLowerCase().includes(q)) : false;
        if (!matchHex && !matchName && !matchRole) return false;
      }

      // 2. Minimum Usage Threshold:
      // If minUsage > 1, only apply to raw un-named nodes; NEVER drop official tokens!
      const isToken = c.source === 'style' || c.source === 'variable' || (c.roles && c.roles.includes('token'));
      if (!isToken && c.usageCount < minUsage && !c.name) {
        return false;
      }

      // 3. Screen Scope Filter:
      if (selectedScreen !== 'all') {
        const appearsOnScreen = c.screenNames && c.screenNames.includes(selectedScreen);
        // If it's a global design token and includeTokens is enabled, keep it available
        if (!appearsOnScreen) {
          if (isToken && includeTokens) {
            // Keep token
          } else {
            return false;
          }
        }
      }

      // 4. Role Filter:
      if (selectedRole !== 'all') {
        if (!c.roles || !c.roles.includes(selectedRole as ColorRole)) {
          return false;
        }
      }

      return true;
    });
  }, [colors, selectedScreen, selectedRole, minUsage, includeTokens, searchQuery]);

  // Role Counts based on current screen & usage filter
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0, token: 0, surface: 0, text: 0, border: 0 };
    for (const c of colors) {
      const isToken = c.source === 'style' || c.source === 'variable' || (c.roles && c.roles.includes('token'));
      if (!isToken && c.usageCount < minUsage && !c.name) {
        continue;
      }
      if (selectedScreen !== 'all') {
        const appearsOnScreen = c.screenNames && c.screenNames.includes(selectedScreen);
        if (!appearsOnScreen && !(isToken && includeTokens)) {
          continue;
        }
      }
      counts.all++;
      if (c.roles) {
        for (const r of c.roles) {
          if (counts[r] !== undefined) counts[r]++;
        }
      }
    }
    return counts;
  }, [colors, selectedScreen, minUsage, includeTokens]);

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
          {/* 1. Header Toolbar: Scope, Search & Usage Filter */}
          <div className="bg-[var(--figma-color-bg-secondary,#f9fafb)] p-3 rounded-lg border border-[var(--figma-color-border,#e5e7eb)] space-y-2.5 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="font-bold text-gray-900 block text-sm">
                  {filteredColors.length} Verified Developer Colors
                  {selectedScreen !== 'all' && (
                    <span className="font-semibold text-blue-600 ml-1 text-xs">
                      on &quot;{selectedScreen}&quot;
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-gray-500">
                  Zero icon vector clutter. Every real button background, text color &amp; design token is preserved.
                </span>
              </div>

              {/* Usage Threshold Filter */}
              <div className="flex items-center space-x-1.5 bg-white border border-gray-200 rounded px-2 py-0.5 shadow-2xs">
                <span className="text-[10px] text-gray-500 font-medium">Min Usage:</span>
                <button
                  onClick={() => setMinUsage(1)}
                  className={`px-1.5 py-0.2 rounded text-[10px] font-semibold transition-colors ${
                    minUsage === 1 ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title="Include all used colors (even 1-off CTA buttons or single error texts)"
                >
                  All (≥1)
                </button>
                <button
                  onClick={() => setMinUsage(2)}
                  className={`px-1.5 py-0.2 rounded text-[10px] font-semibold transition-colors ${
                    minUsage === 2 ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title="Exclude 1-off accidental canvas colors"
                >
                  Frequent (≥2)
                </button>
              </div>
            </div>

            {/* Scope / Screen Selector & Search Bar */}
            <div className="flex items-center gap-2 pt-1 border-t border-gray-200 flex-wrap">
              {allScreens.length > 0 && (
                <div className="flex items-center space-x-1.5 flex-1 min-w-[200px]">
                  <span className="text-[11px] font-semibold text-gray-600 flex-shrink-0">
                    🎯 Screen:
                  </span>
                  <select
                    value={selectedScreen}
                    onChange={e => setSelectedScreen(e.target.value)}
                    className="bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-800 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none flex-1"
                  >
                    <option value="all">🌐 All Screens ({allScreens.length} total)</option>
                    {allScreens.map(scr => (
                      <option key={scr} value={scr}>
                        {scr}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quick Search */}
              <div className="relative w-36 sm:w-44">
                <input
                  type="text"
                  placeholder="Search hex, name..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded pl-6 pr-2 py-1 text-xs placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="absolute left-1.5 top-1.5 text-gray-400 text-[10px]">🔍</span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-1.5 top-1 text-gray-400 hover:text-gray-600 font-bold text-xs"
                  >
                    ×
                  </button>
                )}
              </div>

              {selectedScreen !== 'all' && (
                <label className="flex items-center space-x-1 text-[10px] text-gray-600 cursor-pointer ml-auto">
                  <input
                    type="checkbox"
                    checked={includeTokens}
                    onChange={e => setIncludeTokens(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-0"
                  />
                  <span>Show Tokens</span>
                </label>
              )}
            </div>
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
                No colors match the current search or filter.
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
