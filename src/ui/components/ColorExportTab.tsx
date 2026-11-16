import React, { useState } from 'react';
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

export const ColorExportTab: React.FC<Props> = ({ colors, isScanning }) => {
  const [tokenFormat, setTokenFormat] = useState<'css' | 'tailwind' | 'scss' | 'json'>('css');
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const getCode = () => {
    switch (tokenFormat) {
      case 'css':
        return generateCssVariables(colors);
      case 'tailwind':
        return generateTailwindConfig(colors);
      case 'scss':
        return generateScssVariables(colors);
      case 'json':
        return generateDesignTokensJson(colors);
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
    <div className="space-y-4">
      {colors.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-[var(--figma-color-border,#e5e7eb)] rounded-lg text-xs text-gray-500 space-y-1">
          <p className="font-medium">No project colors extracted yet</p>
          <p className="text-[11px] text-gray-400">
            Click &quot;Scan for Icons&quot; on the Icons tab to automatically extract color palettes as well.
          </p>
        </div>
      ) : (
        <>
          {/* 1. Overview Bar */}
          <div className="flex items-center justify-between text-xs bg-[var(--figma-color-bg-secondary,#f9fafb)] p-3 rounded-lg border border-[var(--figma-color-border,#e5e7eb)]">
            <span className="font-medium text-[var(--figma-color-text,#111827)]">
              {colors.length} Unique Colors Extracted
            </span>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] bg-blue-100 text-blue-700 font-medium px-2 py-0.5 rounded-full">
                {colors.filter(c => c.source === 'style').length} Local Styles
              </span>
              <span className="text-[10px] bg-purple-100 text-purple-700 font-medium px-2 py-0.5 rounded-full">
                {colors.filter(c => c.source === 'variable').length} Variables
              </span>
            </div>
          </div>

          {/* 2. Color Swatch Grid */}
          <div className="border border-[var(--figma-color-border,#e5e7eb)] rounded-lg p-2 max-h-44 overflow-y-auto bg-[var(--figma-color-bg,#ffffff)]">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {colors.map((c, idx) => {
                const isItemCopied = copiedHex === c.hex;
                return (
                  <div
                    key={`${c.hex}-${idx}`}
                    onClick={() => handleCopySingleColor(c.hex)}
                    title="Click to copy hex code to clipboard"
                    className="flex items-center space-x-2.5 p-1.5 rounded border border-gray-100 hover:bg-gray-50 hover:border-blue-300 transition-all cursor-pointer group"
                  >
                    <div
                      className="w-7 h-7 rounded border border-gray-300 shadow-inner flex-shrink-0"
                      style={{ backgroundColor: c.hex }}
                    />
                    <div className="truncate flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-[11px] text-[var(--figma-color-text,#111827)]">
                          {c.hex}
                        </span>
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded transition-opacity ${
                            isItemCopied
                              ? 'bg-emerald-100 text-emerald-800 font-bold opacity-100'
                              : 'text-gray-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          {isItemCopied ? '✓ Copied' : 'Copy'}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 block truncate">
                        {c.name || (c.usageCount > 0 ? `${c.usageCount} uses` : 'Unused')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Token Code Generator */}
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
                  title="Copy full tokens code to clipboard"
                  className={`px-3 py-1 text-xs rounded transition-all font-semibold flex items-center space-x-1 shadow-xs ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <span>{copied ? '✓' : '📋'}</span>
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
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
