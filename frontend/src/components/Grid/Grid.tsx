'use client'

import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { VirtualizedRows } from './VirtualizedRows';
import { Spreadsheet } from '../../lib/spreadsheet';
import { Selection, isCellSelected } from '../../lib/selection';
import { CellPosition } from '../../lib/cell';

export interface GridProps {
  spreadsheet: Spreadsheet;
  selection: Selection;
  isEditing: boolean;
  editingValue: string;
  onCellSelect: (position: CellPosition) => void;
  onCellEditStart: (position: CellPosition, value: string) => void;
  onCellEditComplete: (position: CellPosition, value: string) => void;
  onCellEditCancel: () => void;
}

const ROW_HEIGHT = 24;
const COLUMN_WIDTH = 100;
const HEADER_ROW_HEIGHT = 32;
const HEADER_COLUMN_WIDTH = 50;

export function Grid({
  spreadsheet,
  selection,
  isEditing,
  editingValue,
  onCellSelect,
  onCellEditStart,
  onCellEditComplete,
  onCellEditCancel,
}: GridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  // 行の仮想化
  const rowVirtualizer = useVirtualizer({
    count: spreadsheet.rowCount,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  // 列の仮想化
  const columnVirtualizer = useVirtualizer({
    count: spreadsheet.columnCount,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => COLUMN_WIDTH,
    horizontal: true,
    overscan: 5,
  });

  // 仮想化されたアイテム
  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualColumns = columnVirtualizer.getVirtualItems();

  // スクロール位置の同期
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollLeft } = event.currentTarget;
    rowVirtualizer.scrollToOffset(scrollTop, { align: 'start' });
    columnVirtualizer.scrollToOffset(scrollLeft, { align: 'start' });
  }, [rowVirtualizer, columnVirtualizer]);

  // アクティブセルを表示範囲に入れる
  useEffect(() => {
    const activeCell = selection.activeCell;

    // 行をスクロール
    const activeRowIndex = activeCell.row;
    const activeRowVisible = virtualRows.some(row => row.index === activeRowIndex);
    if (!activeRowVisible) {
      rowVirtualizer.scrollToIndex(activeRowIndex, { align: 'center' });
    }

    // 列をスクロール
    const activeColumnIndex = activeCell.column;
    const activeColumnVisible = virtualColumns.some(col => col.index === activeColumnIndex);
    if (!activeColumnVisible) {
      columnVirtualizer.scrollToIndex(activeColumnIndex, { align: 'center' });
    }
  }, [selection.activeCell, virtualRows, virtualColumns, rowVirtualizer, columnVirtualizer]);

  // セル選択のハンドラー
  const handleCellClick = useCallback(
    (rowIndex: number, columnIndex: number, event: React.MouseEvent) => {
      event.stopPropagation();
      const position: CellPosition = { row: rowIndex, column: columnIndex };

      if (isEditing) {
        // 編集中の場合は現在の編集を完了
        onCellEditComplete(selection.activeCell, editingValue);
      }

      onCellSelect(position);
    },
    [isEditing, editingValue, selection.activeCell, onCellSelect, onCellEditComplete]
  );

  // セルダブルクリック
  const handleCellDoubleClick = useCallback(
    (rowIndex: number, columnIndex: number) => {
      const position: CellPosition = { row: rowIndex, column: columnIndex };
      const cell = spreadsheet.cells.get(`${rowIndex}-${columnIndex}`);
      const value = cell?.rawValue || '';
      onCellEditStart(position, value);
    },
    [spreadsheet.cells, onCellEditStart]
  );

  // 行ヘッダーのクリック
  const handleRowHeaderClick = useCallback(
    (rowIndex: number) => {
      // 行全体の選択（実装を簡素化）
      const position: CellPosition = { row: rowIndex, column: 0 };
      onCellSelect(position);
    },
    [onCellSelect]
  );

  // 列ヘッダーのクリック
  const handleColumnHeaderClick = useCallback(
    (columnIndex: number) => {
      // 列全体の選択（実装を簡素化）
      const position: CellPosition = { row: 0, column: columnIndex };
      onCellSelect(position);
    },
    [onCellSelect]
  );

  // 列ヘッダーを生成
  const renderColumnHeaders = useMemo(() => {
    return (
      <div
        className="sticky top-0 left-0 z-20 flex bg-gray-100 border-b border-gray-300"
        style={{
          height: HEADER_ROW_HEIGHT,
          width: columnVirtualizer.getTotalSize() + HEADER_COLUMN_WIDTH,
        }}
      >
        {/* 左上の角 */}
        <div
          className="flex-shrink-0 border-r border-gray-300 bg-gray-200"
          style={{ width: HEADER_COLUMN_WIDTH, height: HEADER_ROW_HEIGHT }}
        />

        {/* 列ヘッダー */}
        <div
          className="relative"
          style={{
            width: columnVirtualizer.getTotalSize(),
            height: HEADER_ROW_HEIGHT,
          }}
        >
          {virtualColumns.map((column) => {
            const columnLetter = String.fromCharCode(65 + column.index);
            return (
              <div
                key={column.key}
                className="absolute top-0 flex items-center justify-center text-sm font-medium text-gray-700 bg-gray-100 border-r border-gray-300 cursor-pointer hover:bg-gray-200"
                style={{
                  left: column.start,
                  width: column.size,
                  height: HEADER_ROW_HEIGHT,
                }}
                onClick={() => handleColumnHeaderClick(column.index)}
              >
                {columnLetter}
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [virtualColumns, columnVirtualizer, handleColumnHeaderClick]);

  return (
    <div ref={parentRef} className="h-full w-full overflow-hidden">
      {/* 列ヘッダー */}
      {renderColumnHeaders}

      {/* スクロール可能なコンテナ */}
      <div
        ref={scrollElementRef}
        className="h-full w-full overflow-auto"
        style={{ height: 'calc(100% - 32px)' }}
        onScroll={handleScroll}
      >
        <div
          className="relative"
          style={{
            height: rowVirtualizer.getTotalSize(),
            width: columnVirtualizer.getTotalSize() + HEADER_COLUMN_WIDTH,
          }}
        >
          {/* 仮想化された行 */}
          <VirtualizedRows
            virtualRows={virtualRows}
            virtualColumns={virtualColumns}
            spreadsheet={spreadsheet}
            selection={selection}
            isEditing={isEditing}
            editingValue={editingValue}
            onCellClick={handleCellClick}
            onCellDoubleClick={handleCellDoubleClick}
            onRowHeaderClick={handleRowHeaderClick}
            onCellEditComplete={onCellEditComplete}
            onCellEditCancel={onCellEditCancel}
          />
        </div>
      </div>
    </div>
  );
}