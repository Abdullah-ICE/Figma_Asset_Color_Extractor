import React from 'react';

interface Props {
  current: number;
  total: number;
  statusText?: string;
}

export const ExportProgressBar: React.FC<Props> = ({ current, total, statusText }) => {
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div className="w-full bg-[var(--figma-color-bg-secondary,#f3f4f6)] p-3 rounded-lg border border-[var(--figma-color-border,#e5e7eb)] shadow-sm space-y-2">
      <div className="flex justify-between items-center text-xs font-medium text-[var(--figma-color-text,#1f2937)]">
        <span>{statusText || 'Exporting assets...'}</span>
        <span className="font-mono">
          {current} / {total} ({percent}%)
        </span>
      </div>

      <div className="w-full bg-[var(--figma-color-bg-tertiary,#e5e7eb)] h-2 rounded-full overflow-hidden">
        <div
          className="bg-blue-600 h-full transition-all duration-200 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

