/**
 * useSelection (T048) - 選択管理フック
 * セル範囲選択、複数選択、キーボード操作による選択管理機能を提供
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Selection,
  CellSelection,
  SelectionType,
  CellPosition,
  createSingleCellSelection,
  createCellRangeSelection,
  createFullRowSelection,
  createFullColumnSelection,
  extendSelection,
  addSecondarySelection,
  setActiveCell,
  clearSelection,
  isCellSelected,
  getSelectionBounds,
  getSelectedCellCount,
  getAllSelectedCellPositions,
  moveSelection,
  validateSelection
} from '../lib/selection';

interface UseSelectionOptions {
  maxRows: number;
  maxColumns: number;
  onSelectionChange?: (selection: Selection) => void;
  onActiveCellChange?: (activeCell: CellPosition) => void;
  enableMultipleSelection?: boolean;
  enableKeyboardNavigation?: boolean;
}

interface UseSelectionReturn {
  // 現在の選択状態
  selection: Selection;
  activeCell: CellPosition;
  selectedCells: CellPosition[];
  selectionBounds: { minRow: number; maxRow: number; minColumn: number; maxColumn: number };
  selectedCellCount: number;

  // 選択操作
  selectCell: (position: CellPosition) => void;
  selectRange: (start: CellPosition, end: CellPosition) => void;
  selectRow: (rowIndex: number) => void;
  selectColumn: (columnIndex: number) => void;
  extendSelectionTo: (position: CellPosition) => void;
  addToSelection: (start: CellPosition, end?: CellPosition) => void;

  // アクティブセル操作
  setActiveCellPosition: (position: CellPosition) => void;
  moveActiveCell: (direction: 'up' | 'down' | 'left' | 'right', extend?: boolean) => void;

  // 選択状態の確認
  isCellInSelection: (position: CellPosition) => boolean;
  isRangeSelected: () => boolean;
  isMultipleSelection: () => boolean;

  // キーボード操作
  handleKeyDown: (event: KeyboardEvent) => void;

  // その他の操作
  clearSelectionState: () => void;
  selectAll: () => void;
  getSelectionA1Notation: () => string;

  // バリデーション
  validateCurrentSelection: () => { isValid: boolean; errors: string[] };

  // 状態管理
  reset: () => void;
}

const DEFAULT_OPTIONS: UseSelectionOptions = {
  maxRows: 1000,
  maxColumns: 26,
  enableMultipleSelection: true,
  enableKeyboardNavigation: true,
};

export function useSelection(options: UseSelectionOptions): UseSelectionReturn {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  // 状態管理
  const [selection, setSelection] = useState<Selection>(() =>
    createSingleCellSelection({ row: 0, column: 0 })
  );
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  // 計算されたプロパティ
  const activeCell = selection.activeCell;
  const selectedCells = useMemo(() => getAllSelectedCellPositions(selection), [selection]);
  const selectionBounds = useMemo(() => getSelectionBounds(selection), [selection]);
  const selectedCellCount = useMemo(() => getSelectedCellCount(selection), [selection]);

  // 単一セル選択
  const selectCell = useCallback((position: CellPosition) => {
    const newSelection = createSingleCellSelection(position);
    setSelection(newSelection);

    if (mergedOptions.onSelectionChange) {
      mergedOptions.onSelectionChange(newSelection);
    }
    if (mergedOptions.onActiveCellChange) {
      mergedOptions.onActiveCellChange(position);
    }
  }, [mergedOptions]);

  // 範囲選択
  const selectRange = useCallback((start: CellPosition, end: CellPosition) => {
    const newSelection = createCellRangeSelection(start, end);
    setSelection(newSelection);

    if (mergedOptions.onSelectionChange) {
      mergedOptions.onSelectionChange(newSelection);
    }
  }, [mergedOptions]);

  // 行全体を選択
  const selectRow = useCallback((rowIndex: number) => {
    const newSelection = createFullRowSelection(rowIndex, mergedOptions.maxColumns);
    setSelection(newSelection);

    if (mergedOptions.onSelectionChange) {
      mergedOptions.onSelectionChange(newSelection);
    }
  }, [mergedOptions]);

  // 列全体を選択
  const selectColumn = useCallback((columnIndex: number) => {
    const newSelection = createFullColumnSelection(columnIndex, mergedOptions.maxRows);
    setSelection(newSelection);

    if (mergedOptions.onSelectionChange) {
      mergedOptions.onSelectionChange(newSelection);
    }
  }, [mergedOptions]);

  // 選択範囲を拡張
  const extendSelectionTo = useCallback((position: CellPosition) => {
    const newSelection = extendSelection(selection, position);
    setSelection(newSelection);

    if (mergedOptions.onSelectionChange) {
      mergedOptions.onSelectionChange(newSelection);
    }
  }, [selection, mergedOptions]);

  // 複数選択に追加
  const addToSelection = useCallback((start: CellPosition, end?: CellPosition) => {
    if (!mergedOptions.enableMultipleSelection) return;

    const newCellSelection: CellSelection = {
      start,
      end: end || start,
      type: end ? SelectionType.CELL_RANGE : SelectionType.SINGLE_CELL,
      isActive: true,
    };

    const newSelection = addSecondarySelection(selection, newCellSelection);
    setSelection(newSelection);

    if (mergedOptions.onSelectionChange) {
      mergedOptions.onSelectionChange(newSelection);
    }
  }, [selection, mergedOptions]);

  // アクティブセル位置を設定
  const setActiveCellPosition = useCallback((position: CellPosition) => {
    const newSelection = setActiveCell(selection, position);
    setSelection(newSelection);

    if (mergedOptions.onActiveCellChange) {
      mergedOptions.onActiveCellChange(position);
    }
  }, [selection, mergedOptions]);

  // アクティブセルを移動
  const moveActiveCell = useCallback((
    direction: 'up' | 'down' | 'left' | 'right',
    extend: boolean = false
  ) => {
    const newSelection = moveSelection(
      selection,
      direction,
      extend,
      mergedOptions.maxRows,
      mergedOptions.maxColumns
    );

    setSelection(newSelection);

    if (mergedOptions.onSelectionChange) {
      mergedOptions.onSelectionChange(newSelection);
    }
    if (mergedOptions.onActiveCellChange) {
      mergedOptions.onActiveCellChange(newSelection.activeCell);
    }
  }, [selection, mergedOptions]);

  // セルが選択されているかチェック
  const isCellInSelection = useCallback((position: CellPosition) => {
    return isCellSelected(selection, position);
  }, [selection]);

  // 範囲選択されているかチェック
  const isRangeSelected = useCallback(() => {
    return selection.primary.type === SelectionType.CELL_RANGE ||
           selection.primary.type === SelectionType.FULL_ROW ||
           selection.primary.type === SelectionType.FULL_COLUMN;
  }, [selection]);

  // 複数選択されているかチェック
  const isMultipleSelection = useCallback(() => {
    return selection.secondary.length > 0 ||
           selection.primary.type === SelectionType.MULTIPLE_RANGES;
  }, [selection]);

  // キーボードイベント処理
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!mergedOptions.enableKeyboardNavigation) return;

    const { key, shiftKey, ctrlKey, metaKey } = event;
    const isCommandKey = ctrlKey || metaKey;

    setIsShiftPressed(shiftKey);
    setIsCtrlPressed(isCommandKey);

    switch (key) {
      case 'ArrowUp':
        event.preventDefault();
        moveActiveCell('up', shiftKey);
        break;

      case 'ArrowDown':
        event.preventDefault();
        moveActiveCell('down', shiftKey);
        break;

      case 'ArrowLeft':
        event.preventDefault();
        moveActiveCell('left', shiftKey);
        break;

      case 'ArrowRight':
        event.preventDefault();
        moveActiveCell('right', shiftKey);
        break;

      case 'Home':
        event.preventDefault();
        if (isCommandKey) {
          // Ctrl+Home: 全体の先頭へ
          selectCell({ row: 0, column: 0 });
        } else {
          // Home: 行の先頭へ
          selectCell({ row: activeCell.row, column: 0 });
        }
        break;

      case 'End':
        event.preventDefault();
        if (isCommandKey) {
          // Ctrl+End: 全体の末尾へ
          selectCell({
            row: mergedOptions.maxRows - 1,
            column: mergedOptions.maxColumns - 1
          });
        } else {
          // End: 行の末尾へ
          selectCell({
            row: activeCell.row,
            column: mergedOptions.maxColumns - 1
          });
        }
        break;

      case 'a':
        if (isCommandKey) {
          event.preventDefault();
          selectAll();
        }
        break;

      case 'Escape':
        event.preventDefault();
        clearSelectionState();
        break;
    }
  }, [
    mergedOptions.enableKeyboardNavigation,
    moveActiveCell,
    selectCell,
    activeCell,
    mergedOptions.maxRows,
    mergedOptions.maxColumns
  ]);

  // 選択をクリア
  const clearSelectionState = useCallback(() => {
    const newSelection = clearSelection();
    setSelection(newSelection);

    if (mergedOptions.onSelectionChange) {
      mergedOptions.onSelectionChange(newSelection);
    }
  }, [mergedOptions]);

  // 全選択
  const selectAll = useCallback(() => {
    const newSelection = createCellRangeSelection(
      { row: 0, column: 0 },
      { row: mergedOptions.maxRows - 1, column: mergedOptions.maxColumns - 1 }
    );
    setSelection(newSelection);

    if (mergedOptions.onSelectionChange) {
      mergedOptions.onSelectionChange(newSelection);
    }
  }, [mergedOptions]);

  // A1記法での選択範囲を取得
  const getSelectionA1Notation = useCallback(() => {
    // 簡易実装: より詳細な実装はlibのselectionToA1Notation関数を使用
    const bounds = selectionBounds;
    if (bounds.minRow === bounds.maxRow && bounds.minColumn === bounds.maxColumn) {
      // 単一セル
      const col = String.fromCharCode(65 + bounds.minColumn);
      return `${col}${bounds.minRow + 1}`;
    } else {
      // 範囲
      const startCol = String.fromCharCode(65 + bounds.minColumn);
      const endCol = String.fromCharCode(65 + bounds.maxColumn);
      return `${startCol}${bounds.minRow + 1}:${endCol}${bounds.maxRow + 1}`;
    }
  }, [selectionBounds]);

  // バリデーション
  const validateCurrentSelection = useCallback(() => {
    return validateSelection(selection, mergedOptions.maxRows, mergedOptions.maxColumns);
  }, [selection, mergedOptions.maxRows, mergedOptions.maxColumns]);

  // リセット
  const reset = useCallback(() => {
    const newSelection = createSingleCellSelection({ row: 0, column: 0 });
    setSelection(newSelection);
    setIsShiftPressed(false);
    setIsCtrlPressed(false);

    if (mergedOptions.onSelectionChange) {
      mergedOptions.onSelectionChange(newSelection);
    }
    if (mergedOptions.onActiveCellChange) {
      mergedOptions.onActiveCellChange({ row: 0, column: 0 });
    }
  }, [mergedOptions]);

  // キーボードイベントリスナーの設定
  useEffect(() => {
    if (mergedOptions.enableKeyboardNavigation) {
      const handleKeyUp = (event: KeyboardEvent) => {
        if (event.key === 'Shift') {
          setIsShiftPressed(false);
        }
        if (event.key === 'Control' || event.key === 'Meta') {
          setIsCtrlPressed(false);
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keyup', handleKeyUp);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keyup', handleKeyUp);
      };
    }
  }, [handleKeyDown, mergedOptions.enableKeyboardNavigation]);

  return {
    // 現在の選択状態
    selection,
    activeCell,
    selectedCells,
    selectionBounds,
    selectedCellCount,

    // 選択操作
    selectCell,
    selectRange,
    selectRow,
    selectColumn,
    extendSelectionTo,
    addToSelection,

    // アクティブセル操作
    setActiveCellPosition,
    moveActiveCell,

    // 選択状態の確認
    isCellInSelection,
    isRangeSelected,
    isMultipleSelection,

    // キーボード操作
    handleKeyDown,

    // その他の操作
    clearSelectionState,
    selectAll,
    getSelectionA1Notation,

    // バリデーション
    validateCurrentSelection,

    // 状態管理
    reset,
  };
}