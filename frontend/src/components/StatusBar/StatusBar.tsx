'use client'

import React, { useMemo } from 'react';

export interface StatusBarProps {
  cellCount: number;
  selectedRange: string;
  spreadsheetName: string;
  lastModified: Date;
  mode?: 'ready' | 'edit' | 'calculating';
  additionalInfo?: string;
}

export function StatusBar({
  cellCount,
  selectedRange,
  spreadsheetName,
  lastModified,
  mode = 'ready',
  additionalInfo,
}: StatusBarProps) {
  // モード表示の文言
  const getModeText = useMemo(() => {
    switch (mode) {
      case 'edit':
        return '編集中';
      case 'calculating':
        return '計算中...';
      case 'ready':
      default:
        return '準備完了';
    }
  }, [mode]);

  // モードの色クラス
  const getModeColorClass = useMemo(() => {
    switch (mode) {
      case 'edit':
        return 'text-blue-600';
      case 'calculating':
        return 'text-yellow-600';
      case 'ready':
      default:
        return 'text-green-600';
    }
  }, [mode]);

  // 最終更新時刻のフォーマット
  const formatLastModified = useMemo(() => {
    const now = new Date();
    const diff = now.getTime() - lastModified.getTime();
    const diffMinutes = Math.floor(diff / (1000 * 60));
    const diffHours = Math.floor(diff / (1000 * 60 * 60));
    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return 'たった今';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}分前`;
    } else if (diffHours < 24) {
      return `${diffHours}時間前`;
    } else if (diffDays < 7) {
      return `${diffDays}日前`;
    } else {
      return lastModified.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }, [lastModified]);

  return (
    <div className="flex items-center justify-between bg-gray-100 border-t border-gray-300 px-3 py-1 text-sm text-gray-600 min-h-[24px]">
      {/* 左側: モードとステータス情報 */}
      <div className="flex items-center space-x-4">
        {/* モード表示 */}
        <div className="flex items-center space-x-1">
          <div className={`w-2 h-2 rounded-full ${mode === 'ready' ? 'bg-green-500' : mode === 'edit' ? 'bg-blue-500' : 'bg-yellow-500'}`} />
          <span className={`font-medium ${getModeColorClass}`}>
            {getModeText}
          </span>
        </div>

        {/* 追加情報 */}
        {additionalInfo && (
          <span className="text-gray-500">
            {additionalInfo}
          </span>
        )}

        {/* セル数 */}
        <span>
          セル数: <span className="font-mono">{cellCount.toLocaleString()}</span>
        </span>

        {/* 選択範囲 */}
        <span>
          選択: <span className="font-mono font-medium">{selectedRange}</span>
        </span>
      </div>

      {/* 右側: ファイル情報 */}
      <div className="flex items-center space-x-4">
        {/* スプレッドシート名 */}
        <span className="font-medium text-gray-700" title={spreadsheetName}>
          {spreadsheetName.length > 30 ? `${spreadsheetName.substring(0, 30)}...` : spreadsheetName}
        </span>

        {/* 最終更新時刻 */}
        <span title={lastModified.toLocaleString('ja-JP')}>
          更新: {formatLastModified}
        </span>
      </div>
    </div>
  );
}