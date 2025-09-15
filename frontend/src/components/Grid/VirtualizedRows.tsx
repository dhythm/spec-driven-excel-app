'use client'

import React, { memo } from 'react';
import { VirtualItem } from '@tanstack/react-virtual';
import { Cell } from '../Cell/Cell';
import { Spreadsheet } from '../../lib/spreadsheet';
import { Selection, isCellSelected } from '../../lib/selection';
import { CellPosition } from '../../lib/cell';

export interface VirtualizedRowsProps {
  virtualRows: VirtualItem[];
  virtualColumns: VirtualItem[];
  spreadsheet: Spreadsheet;
  selection: Selection;
  isEditing: boolean;
  editingValue: string;
  onCellClick: (rowIndex: number, columnIndex: number, event: React.MouseEvent) => void;
  onCellDoubleClick: (rowIndex: number, columnIndex: number) => void;
  onRowHeaderClick: (rowIndex: number) => void;
  onCellEditComplete: (position: CellPosition, value: string) => void;
  onCellEditCancel: () => void;
  onContextMenu?: (event: React.MouseEvent, position: CellPosition) => void;
}

const ROW_HEIGHT = 24;
const COLUMN_WIDTH = 100;
const HEADER_COLUMN_WIDTH = 50;

export const VirtualizedRows = memo(function VirtualizedRows({
  virtualRows,
  virtualColumns,
  spreadsheet,
  selection,
  isEditing,
  editingValue,
  onCellClick,
  onCellDoubleClick,
  onRowHeaderClick,
  onCellEditComplete,
  onCellEditCancel,
  onContextMenu,
}: VirtualizedRowsProps) {
  return (
    <>
      {virtualRows.map((row) => (
        <VirtualizedRow
          key={row.key}
          row={row}
          virtualColumns={virtualColumns}
          spreadsheet={spreadsheet}
          selection={selection}
          isEditing={isEditing}
          editingValue={editingValue}
          onCellClick={onCellClick}
          onCellDoubleClick={onCellDoubleClick}
          onRowHeaderClick={onRowHeaderClick}
          onCellEditComplete={onCellEditComplete}
          onCellEditCancel={onCellEditCancel}
          onContextMenu={onContextMenu}
        />
      ))}
    </>
  );
});

interface VirtualizedRowProps {
  row: VirtualItem;
  virtualColumns: VirtualItem[];
  spreadsheet: Spreadsheet;
  selection: Selection;
  isEditing: boolean;
  editingValue: string;
  onCellClick: (rowIndex: number, columnIndex: number, event: React.MouseEvent) => void;
  onCellDoubleClick: (rowIndex: number, columnIndex: number) => void;
  onRowHeaderClick: (rowIndex: number) => void;
  onCellEditComplete: (position: CellPosition, value: string) => void;
  onCellEditCancel: () => void;
  onContextMenu?: (event: React.MouseEvent, position: CellPosition) => void;
}

const VirtualizedRow = memo(function VirtualizedRow({
  row,
  virtualColumns,
  spreadsheet,
  selection,
  isEditing,
  editingValue,
  onCellClick,
  onCellDoubleClick,
  onRowHeaderClick,
  onCellEditComplete,
  onCellEditCancel,
  onContextMenu,
}: VirtualizedRowProps) {
  const rowIndex = row.index;

  return (
    <div
      className="absolute left-0 flex"
      style={{
        top: row.start,
        height: row.size,
        width: '100%',
      }}
    >
      {/* 行ヘッダー */}
      <div
        className="flex-shrink-0 flex items-center justify-center text-sm text-gray-600 bg-gray-100 border-r border-b border-gray-300 cursor-pointer hover:bg-gray-200"
        style={{
          width: HEADER_COLUMN_WIDTH,
          height: row.size,
        }}
        onClick={() => onRowHeaderClick(rowIndex)}
      >
        {rowIndex + 1}
      </div>

      {/* 行のセル */}
      <div
        className="relative"
        style={{
          width: virtualColumns.reduce((total, col) => total + col.size, 0),
          height: row.size,
        }}
      >
        {virtualColumns.map((column) => {
          const columnIndex = column.index;
          const position: CellPosition = { row: rowIndex, column: columnIndex };
          const cellKey = `${rowIndex}-${columnIndex}`;
          const cell = spreadsheet.cells.get(cellKey);

          const isSelected = isCellSelected(selection, position);
          const isActive =
            selection.activeCell.row === rowIndex &&
            selection.activeCell.column === columnIndex;
          const isCurrentlyEditing = isEditing && isActive;

          return (
            <Cell
              key={column.key}
              position={position}
              cell={cell}
              isSelected={isSelected}
              isActive={isActive}
              isEditing={isCurrentlyEditing}
              editingValue={editingValue}
              style={{
                position: 'absolute',
                left: column.start,
                top: 0,
                width: column.size,
                height: row.size,
              }}
              onClick={(event) => onCellClick(rowIndex, columnIndex, event)}
              onDoubleClick={() => onCellDoubleClick(rowIndex, columnIndex)}
              onEditComplete={(value) => onCellEditComplete(position, value)}
              onEditCancel={onCellEditCancel}
              onContextMenu={(event) => onContextMenu?.(event, position)}
            />
          );
        })}
      </div>
    </div>
  );
});