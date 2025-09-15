'use client'

import React, { memo, useRef, useEffect } from 'react';
import { CellEditor } from './CellEditor';
import { Cell as CellData, CellPosition } from '../../lib/cell';

export interface CellProps {
  position: CellPosition;
  cell?: CellData;
  isSelected: boolean;
  isActive: boolean;
  isEditing: boolean;
  editingValue: string;
  style?: React.CSSProperties;
  onClick: (event: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onEditComplete: (value: string) => void;
  onEditCancel: () => void;
}

export const Cell = memo(function Cell({
  position,
  cell,
  isSelected,
  isActive,
  isEditing,
  editingValue,
  style,
  onClick,
  onDoubleClick,
  onEditComplete,
  onEditCancel,
}: CellProps) {
  const cellRef = useRef<HTMLDivElement>(null);

  // 表示値を取得
  const displayValue = cell?.displayValue || '';
  const rawValue = cell?.rawValue || '';

  // セルのスタイルを生成
  const getCellStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      ...style,
      boxSizing: 'border-box',
      border: '1px solid #e5e7eb',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      cursor: 'cell',
      userSelect: 'none',
    };

    // セルの書式設定を適用
    if (cell?.format) {
      const format = cell.format;
      baseStyle.fontSize = `${format.fontSize}px`;
      baseStyle.fontFamily = format.fontFamily;
      baseStyle.fontWeight = format.fontWeight;
      baseStyle.fontStyle = format.fontStyle;
      baseStyle.textAlign = format.textAlign;
      baseStyle.color = format.textColor;
      baseStyle.backgroundColor = format.backgroundColor;
    } else {
      // デフォルトスタイル
      baseStyle.fontSize = '12px';
      baseStyle.fontFamily = 'Arial, sans-serif';
      baseStyle.color = '#000000';
      baseStyle.backgroundColor = '#ffffff';
      baseStyle.textAlign = 'left';
    }

    // 選択状態のスタイル
    if (isSelected && !isActive) {
      baseStyle.backgroundColor = '#e6f3ff';
    }

    // アクティブ状態のスタイル
    if (isActive) {
      baseStyle.outline = '2px solid #1976d2';
      baseStyle.outlineOffset = '-1px';
      baseStyle.zIndex = 10;
    }

    return baseStyle;
  };

  // アクティブセルにフォーカスを設定
  useEffect(() => {
    if (isActive && !isEditing && cellRef.current) {
      cellRef.current.focus();
    }
  }, [isActive, isEditing]);

  // 編集中の場合はエディターを表示
  if (isEditing) {
    return (
      <CellEditor
        position={position}
        initialValue={rawValue}
        value={editingValue}
        style={style}
        onComplete={onEditComplete}
        onCancel={onEditCancel}
      />
    );
  }

  // 通常のセル表示
  return (
    <div
      ref={cellRef}
      style={getCellStyle()}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      tabIndex={isActive ? 0 : -1}
      role="gridcell"
      aria-selected={isSelected}
      aria-label={`セル ${String.fromCharCode(65 + position.column)}${position.row + 1}: ${displayValue}`}
      title={displayValue}
    >
      <div
        style={{
          padding: '2px 4px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          minHeight: 0,
        }}
      >
        {displayValue}
      </div>
    </div>
  );
});

// パフォーマンス最適化のための比較関数
Cell.displayName = 'Cell';