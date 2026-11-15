import React, { useState } from 'react';
import { ExtractedTypography } from '../../main/types';
import {
  generateTypographyCss,
  generateTypographyJson,
  generateTypographyScss,
  generateTypographyTailwind,
} from '../utils/tokenGenerators';

interface Props {
  typography: ExtractedTypography[];
  isScanning: boolean;
}

export const TypographyExportTab: React.FC<Props> = ({ typography, isScanning }) => {
  const [tokenFormat, setTokenFormat] = useState<'css' | 'tailwind' | 'scss' | 'json'>('css');
  const [copied, setCopied] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sampleText, setSampleText] = useState<string>('The quick brown fox jumps over the lazy dog');

  // Unique families
  const uniqueFamilies = Array.from(new Set(typography.map(t => t.fontFamily)));
  const uniqueSizes = Array.from(new Set(typography.map(t => t.fontSize))).sort((a, b) => b - a);

  const filteredTypography = typography.filter(t => {
    const q = searchQuery.toLowerCase();
    return (
      t.fontFamily.toLowerCase().includes(q) ||
      t.fontStyle.toLowerCase().includes(q) ||
      t.fontSize.toString().includes(q) ||
      (t.name && t.name.toLowerCase().includes(q))
    );
  });

  const getCode = () => {
    switch (tokenFormat) {
      case 'css':
        return generateTypographyCss(typography);
      case 'tailwind':
        return generateTypographyTailwind(typography);
      case 'scss':
        return generateTypographyScss(typography);
      case 'json':
        return generateTypographyJson(typography);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const code = getCode();
    const extensions = { css: 'css', tailwind: 'js', scss: 'scss', json: 'json' };
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `typography-tokens.${extensions[tokenFormat]}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {typography.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-[var(--figma-color-border,#e5e7eb)] rounded-lg text-xs text-gray-500 space-y-1">
          <p className="font-semibold text-gray-700">No Typography Extracted Yet</p>
          <p className="text-[11px] text-gray-400">
            Click &quot;Scan for Icons&quot; on the Icons tab to auto-scan and extract all font families, sizes &amp; styles.
          </p>
        </div>
      ) : (
        <>
          {/* 1. Typography Summary Card */}
          <div className="bg-[var(--figma-color-bg-secondary,#f9fafb)] p-3 rounded-lg border border-[var(--figma-color-border,#e5e7eb)] flex items-center justify-between flex-wrap gap-2 text-xs">
            <div>
              <span className="font-bold text-gray-900 block">
                {uniqueFamilies.join(', ')}
              </span>
              <span className="text-[10px] text-gray-500">
                {uniqueSizes.length} Unique Font Sizes • {typography.length} Style Variations Detected
              </span>
            </div>

            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] bg-purple-100 text-purple-800 font-semibold px-2 py-0.5 rounded-full border border-purple-200">
                {typography.filter(t => t.source === 'style').length} Figma Text Styles
              </span>
              <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                {typography.filter(t => t.source === 'raw_node').length} Canvas Layers
              </span>
            </div>
          </div>

          {/* 2. Interactive Font Size Scale & Style Showcase */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-gray-800">
                Font Scale &amp; Styles ({filteredTypography.length})
              </span>

              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Sample preview text..."
                  value={sampleText}
                  onChange={e => setSampleText(e.target.value)}
                  className="px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"
                />
                <input
                  type="text"
                  placeholder="Filter size or style..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 w-32"
                />
              </div>
            </div>

            {/* Typography List / Ladder */}
            <div className="border border-[var(--figma-color-border,#e5e7eb)] rounded-lg max-h-56 overflow-y-auto divide-y divide-gray-100 bg-white">
              {filteredTypography.map((t, idx) => (
                <div
                  key={`${t.fontFamily}-${t.fontSize}-${t.fontStyle}-${idx}`}
                  className="p-3 hover:bg-gray-50/80 transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 text-[11px]">
                        {t.fontSize}px
                      </span>
                      <span className="font-semibold text-gray-900">
                        {t.fontFamily} {t.fontStyle} ({t.fontWeight})
                      </span>
                      {t.name && (
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                          {t.name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 text-[10px] text-gray-500 font-mono">
                      <span>LH: {t.lineHeight}</span>
                      <span>•</span>
                      <span>LS: {t.letterSpacing}</span>
                      <span>•</span>
                      <span className="bg-gray-100 text-gray-700 font-semibold px-1.5 py-0.5 rounded">
                        {t.usageCount} uses
                      </span>
                    </div>
                  </div>

                  {/* Real-time styled visual preview */}
                  <div
                    style={{
                      fontFamily: `'${t.fontFamily}', sans-serif`,
                      fontSize: `${Math.min(28, Math.max(12, t.fontSize))}px`,
                      fontWeight: t.fontWeight,
                      lineHeight: 1.25,
                    }}
                    className="text-gray-800 truncate select-text"
                  >
                    {sampleText || 'The quick brown fox jumps over the lazy dog'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Typography Token Code Generator */}
          <div className="space-y-2 pt-1">
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
                  className="px-2.5 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors text-gray-700 font-medium"
                >
                  {copied ? 'Copied!' : 'Copy'}
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

