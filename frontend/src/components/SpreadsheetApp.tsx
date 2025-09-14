'use client'

import React, { useState, useCallback, useEffect } from 'react';
import { Grid } from './Grid/Grid';
import { FormulaBar } from './FormulaBar/FormulaBar';
import { Toolbar } from './Toolbar/Toolbar';
import { StatusBar } from './StatusBar/StatusBar';
import {
  Spreadsheet,
  createSpreadsheet,
  DEFAULT_SPREADSHEET_CONFIG,
} from '../lib/spreadsheet';
import {
  createNewSpreadsheet,
  setCellValue,
  getCellValue,
  SpreadsheetOperationResult,
} from '../lib/spreadsheet-core';
import {
  Selection,
  createSingleCellSelection,
  moveSelection,
} from '../lib/selection';
import { CellPosition, Cell } from '../lib/cell';

export interface SpreadsheetAppProps {
  initialName?: string;
  maxRows?: number;
  maxColumns?: number;
}

export function SpreadsheetApp({
  initialName = '新しいスプレッドシート',
  maxRows = 100,
  maxColumns = 26,
}: SpreadsheetAppProps) {
  // スプレッドシートの状態
  const [spreadsheet, setSpreadsheet] = useState<Spreadsheet>(() => {
    const result = createNewSpreadsheet(initialName, {
      ...DEFAULT_SPREADSHEET_CONFIG,
      maxRows,
      maxColumns,
    });
    return result.spreadsheet;
  });

  // 選択状態
  const [selection, setSelection] = useState<Selection>(() =>
    createSingleCellSelection({ row: 0, column: 0 })
  );

  // 編集状態
  const [isEditing, setIsEditing] = useState(false);
  const [editingValue, setEditingValue] = useState('');

  // フォーミュラバーの値
  const [formulaBarValue, setFormulaBarValue] = useState('');

  // アクティブセルの値を取得してフォーミュラバーに設定
  useEffect(() => {
    const result = getCellValue(spreadsheet, selection.activeCell);
    if (result.success && result.data !== undefined) {
      setFormulaBarValue(result.data);
    } else {
      setFormulaBarValue('');
    }
  }, [spreadsheet, selection.activeCell]);

  // セル値の更新
  const handleCellValueChange = useCallback(
    (position: CellPosition, value: string) => {
      const result = setCellValue(spreadsheet, position, value);
      if (result.success) {
        setSpreadsheet(result.spreadsheet);
      }
    },
    [spreadsheet]
  );

  // セル選択の処理
  const handleCellSelect = useCallback((position: CellPosition) => {
    setSelection(createSingleCellSelection(position));
    setIsEditing(false);
    setEditingValue('');
  }, []);

  // セル編集開始
  const handleCellEditStart = useCallback(
    (position: CellPosition, value: string) => {
      setSelection(createSingleCellSelection(position));
      setIsEditing(true);
      setEditingValue(value);
    },
    []
  );

  // セル編集完了
  const handleCellEditComplete = useCallback(
    (position: CellPosition, value: string) => {
      handleCellValueChange(position, value);
      setIsEditing(false);
      setEditingValue('');
    },
    [handleCellValueChange]
  );

  // セル編集キャンセル
  const handleCellEditCancel = useCallback(() => {
    setIsEditing(false);
    setEditingValue('');
  }, []);

  // キーボードナビゲーション
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (isEditing) return;

      const { key, shiftKey } = event;
      let direction: 'up' | 'down' | 'left' | 'right' | null = null;

      switch (key) {
        case 'ArrowUp':
          direction = 'up';
          break;
        case 'ArrowDown':
          direction = 'down';
          break;
        case 'ArrowLeft':
          direction = 'left';
          break;
        case 'ArrowRight':
          direction = 'right';
          break;
        case 'Enter':
          direction = 'down';
          break;
        case 'Tab':
          direction = shiftKey ? 'left' : 'right';
          event.preventDefault();
          break;
      }

      if (direction) {
        const newSelection = moveSelection(
          selection,
          direction,
          shiftKey && key.startsWith('Arrow'),
          maxRows,
          maxColumns
        );
        setSelection(newSelection);
        event.preventDefault();
      }
    },
    [isEditing, selection, maxRows, maxColumns]
  );

  // フォーミュラバーの値変更
  const handleFormulaBarChange = useCallback((value: string) => {
    setFormulaBarValue(value);
    if (!isEditing) {
      // フォーミュラバーから直接編集開始
      setIsEditing(true);
      setEditingValue(value);
    }
  }, [isEditing]);

  // フォーミュラバーでの確定
  const handleFormulaBarSubmit = useCallback(() => {
    if (isEditing) {
      handleCellValueChange(selection.activeCell, formulaBarValue);
      setIsEditing(false);
      setEditingValue('');
    }
  }, [isEditing, formulaBarValue, selection.activeCell, handleCellValueChange]);

  // 統計情報の取得
  const cellCount = spreadsheet.cells.size;
  const selectedRange = `${String.fromCharCode(65 + selection.activeCell.column)}${
    selection.activeCell.row + 1
  }`;

  return (
    <div
      className="h-screen flex flex-col bg-gray-50"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{ outline: 'none' }}
    >
      {/* ツールバー */}
      <Toolbar
        spreadsheet={spreadsheet}
        selection={selection}
        onAction={(action) => {
          console.log('Toolbar action:', action);
          // ここで各種アクションを処理
        }}
      />

      {/* フォーミュラバー */}
      <FormulaBar
        value={formulaBarValue}
        activeCell={selection.activeCell}
        onChange={handleFormulaBarChange}
        onSubmit={handleFormulaBarSubmit}
      />

      {/* グリッド */}
      <div className="flex-1 overflow-hidden">
        <Grid
          spreadsheet={spreadsheet}
          selection={selection}
          isEditing={isEditing}
          editingValue={editingValue}
          onCellSelect={handleCellSelect}
          onCellEditStart={handleCellEditStart}
          onCellEditComplete={handleCellEditComplete}
          onCellEditCancel={handleCellEditCancel}
        />
      </div>

      {/* ステータスバー */}
      <StatusBar
        cellCount={cellCount}
        selectedRange={selectedRange}
        spreadsheetName={spreadsheet.name}
        lastModified={spreadsheet.updatedAt}
      />
    </div>
  );
}