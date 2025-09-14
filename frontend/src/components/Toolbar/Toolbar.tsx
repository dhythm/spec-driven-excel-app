'use client'

import React, { useCallback } from 'react';
import { Spreadsheet } from '../../lib/spreadsheet';
import { Selection, selectionToA1Notation } from '../../lib/selection';

export interface ToolbarAction {
  type: string;
  payload?: any;
}

export interface ToolbarProps {
  spreadsheet: Spreadsheet;
  selection: Selection;
  onAction: (action: ToolbarAction) => void;
}

export function Toolbar({ spreadsheet, selection, onAction }: ToolbarProps) {
  // アクション実行のヘルパー関数
  const handleAction = useCallback(
    (type: string, payload?: any) => {
      onAction({ type, payload });
    },
    [onAction]
  );

  // ファイル操作
  const handleNew = useCallback(() => handleAction('file:new'), [handleAction]);
  const handleOpen = useCallback(() => handleAction('file:open'), [handleAction]);
  const handleSave = useCallback(() => handleAction('file:save'), [handleAction]);
  const handleExport = useCallback(() => handleAction('file:export'), [handleAction]);

  // 編集操作
  const handleUndo = useCallback(() => handleAction('edit:undo'), [handleAction]);
  const handleRedo = useCallback(() => handleAction('edit:redo'), [handleAction]);
  const handleCut = useCallback(() => handleAction('edit:cut'), [handleAction]);
  const handleCopy = useCallback(() => handleAction('edit:copy'), [handleAction]);
  const handlePaste = useCallback(() => handleAction('edit:paste'), [handleAction]);
  const handleDelete = useCallback(() => handleAction('edit:delete'), [handleAction]);

  // 書式設定
  const handleBold = useCallback(() => handleAction('format:bold'), [handleAction]);
  const handleItalic = useCallback(() => handleAction('format:italic'), [handleAction]);
  const handleUnderline = useCallback(() => handleAction('format:underline'), [handleAction]);

  // 配置設定
  const handleAlignLeft = useCallback(() => handleAction('format:align:left'), [handleAction]);
  const handleAlignCenter = useCallback(() => handleAction('format:align:center'), [handleAction]);
  const handleAlignRight = useCallback(() => handleAction('format:align:right'), [handleAction]);

  // 行・列操作
  const handleInsertRow = useCallback(() => handleAction('insert:row'), [handleAction]);
  const handleInsertColumn = useCallback(() => handleAction('insert:column'), [handleAction]);
  const handleDeleteRow = useCallback(() => handleAction('delete:row'), [handleAction]);
  const handleDeleteColumn = useCallback(() => handleAction('delete:column'), [handleAction]);

  return (
    <div className="flex items-center bg-gray-50 border-b border-gray-300 px-2 py-1 min-h-[40px]">
      {/* ファイル操作 */}
      <div className="flex items-center space-x-1 px-2 border-r border-gray-300">
        <ToolbarButton
          onClick={handleNew}
          title="新規作成 (Ctrl+N)"
          icon="📄"
          label="新規"
        />
        <ToolbarButton
          onClick={handleOpen}
          title="開く (Ctrl+O)"
          icon="📁"
          label="開く"
        />
        <ToolbarButton
          onClick={handleSave}
          title="保存 (Ctrl+S)"
          icon="💾"
          label="保存"
        />
        <ToolbarButton
          onClick={handleExport}
          title="エクスポート"
          icon="📤"
          label="エクスポート"
        />
      </div>

      {/* 編集操作 */}
      <div className="flex items-center space-x-1 px-2 border-r border-gray-300">
        <ToolbarButton
          onClick={handleUndo}
          title="元に戻す (Ctrl+Z)"
          icon="↶"
          label="元に戻す"
        />
        <ToolbarButton
          onClick={handleRedo}
          title="やり直し (Ctrl+Y)"
          icon="↷"
          label="やり直し"
        />
      </div>

      {/* クリップボード操作 */}
      <div className="flex items-center space-x-1 px-2 border-r border-gray-300">
        <ToolbarButton
          onClick={handleCut}
          title="切り取り (Ctrl+X)"
          icon="✂"
          label="切り取り"
        />
        <ToolbarButton
          onClick={handleCopy}
          title="コピー (Ctrl+C)"
          icon="📋"
          label="コピー"
        />
        <ToolbarButton
          onClick={handlePaste}
          title="貼り付け (Ctrl+V)"
          icon="📄"
          label="貼り付け"
        />
        <ToolbarButton
          onClick={handleDelete}
          title="削除 (Delete)"
          icon="🗑"
          label="削除"
        />
      </div>

      {/* 書式設定 */}
      <div className="flex items-center space-x-1 px-2 border-r border-gray-300">
        <ToolbarButton
          onClick={handleBold}
          title="太字 (Ctrl+B)"
          icon="B"
          label="太字"
          active={false} // TODO: 実際の状態を反映
        />
        <ToolbarButton
          onClick={handleItalic}
          title="斜体 (Ctrl+I)"
          icon="I"
          label="斜体"
          active={false} // TODO: 実際の状態を反映
        />
        <ToolbarButton
          onClick={handleUnderline}
          title="下線 (Ctrl+U)"
          icon="U"
          label="下線"
          active={false} // TODO: 実際の状態を反映
        />
      </div>

      {/* 配置設定 */}
      <div className="flex items-center space-x-1 px-2 border-r border-gray-300">
        <ToolbarButton
          onClick={handleAlignLeft}
          title="左揃え"
          icon="⫷"
          label="左揃え"
        />
        <ToolbarButton
          onClick={handleAlignCenter}
          title="中央揃え"
          icon="⫸"
          label="中央揃え"
        />
        <ToolbarButton
          onClick={handleAlignRight}
          title="右揃え"
          icon="⫹"
          label="右揃え"
        />
      </div>

      {/* 行・列操作 */}
      <div className="flex items-center space-x-1 px-2">
        <ToolbarButton
          onClick={handleInsertRow}
          title="行を挿入"
          icon="⬇"
          label="行挿入"
        />
        <ToolbarButton
          onClick={handleInsertColumn}
          title="列を挿入"
          icon="➡"
          label="列挿入"
        />
        <ToolbarButton
          onClick={handleDeleteRow}
          title="行を削除"
          icon="⬇"
          label="行削除"
          variant="danger"
        />
        <ToolbarButton
          onClick={handleDeleteColumn}
          title="列を削除"
          icon="➡"
          label="列削除"
          variant="danger"
        />
      </div>

      {/* スペーサー */}
      <div className="flex-1" />

      {/* 選択情報 */}
      <div className="flex items-center text-sm text-gray-600 px-2">
        選択: {selectionToA1Notation(selection)}
      </div>
    </div>
  );
}

interface ToolbarButtonProps {
  onClick: () => void;
  title: string;
  icon: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'danger';
}

function ToolbarButton({
  onClick,
  title,
  icon,
  label,
  active = false,
  disabled = false,
  variant = 'default',
}: ToolbarButtonProps) {
  const getButtonClasses = () => {
    const baseClasses = 'flex flex-col items-center justify-center px-2 py-1 rounded text-xs transition-colors min-w-[48px] h-12';

    if (disabled) {
      return `${baseClasses} text-gray-400 cursor-not-allowed`;
    }

    if (active) {
      return `${baseClasses} bg-blue-100 text-blue-700 border border-blue-300`;
    }

    if (variant === 'danger') {
      return `${baseClasses} text-red-600 hover:bg-red-50 hover:text-red-800`;
    }

    return `${baseClasses} text-gray-700 hover:bg-gray-200 hover:text-gray-900`;
  };

  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={getButtonClasses()}
      type="button"
    >
      <span className="text-base leading-none mb-1">{icon}</span>
      <span className="leading-none">{label}</span>
    </button>
  );
}