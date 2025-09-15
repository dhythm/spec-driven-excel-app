/**
 * 選択モデル
 * ユーザーが選択しているセル範囲や行・列の選択状態を管理する
 */

import { CellPosition, cellPositionToA1Notation } from './cell';

export enum SelectionType {
  SINGLE_CELL = 'single_cell',
  CELL_RANGE = 'cell_range',
  FULL_ROW = 'full_row',
  FULL_COLUMN = 'full_column',
  MULTIPLE_RANGES = 'multiple_ranges',
}

export interface CellSelection {
  start: CellPosition;
  end: CellPosition;
  type: SelectionType;
  isActive: boolean;
}

export interface Selection {
  primary: CellSelection;
  secondary: CellSelection[];
  activeCell: CellPosition;
  lastModified: Date;
}

export interface SelectionBounds {
  minRow: number;
  maxRow: number;
  minColumn: number;
  maxColumn: number;
}

/**
 * 新しい単一セル選択を作成する関数
 */
export function createSingleCellSelection(position: CellPosition): Selection {
  const selection: CellSelection = {
    start: position,
    end: position,
    type: SelectionType.SINGLE_CELL,
    isActive: true,
  };

  return {
    primary: selection,
    secondary: [],
    activeCell: position,
    lastModified: new Date(),
  };
}

/**
 * セル範囲選択を作成する関数
 */
export function createCellRangeSelection(start: CellPosition, end: CellPosition): Selection {
  const selection: CellSelection = {
    start,
    end,
    type: SelectionType.CELL_RANGE,
    isActive: true,
  };

  return {
    primary: selection,
    secondary: [],
    activeCell: start,
    lastModified: new Date(),
  };
}

/**
 * 行全体の選択を作成する関数
 */
export function createFullRowSelection(rowIndex: number, maxColumns: number): Selection {
  const selection: CellSelection = {
    start: { row: rowIndex, column: 0 },
    end: { row: rowIndex, column: maxColumns - 1 },
    type: SelectionType.FULL_ROW,
    isActive: true,
  };

  return {
    primary: selection,
    secondary: [],
    activeCell: { row: rowIndex, column: 0 },
    lastModified: new Date(),
  };
}

/**
 * 列全体の選択を作成する関数
 */
export function createFullColumnSelection(columnIndex: number, maxRows: number): Selection {
  const selection: CellSelection = {
    start: { row: 0, column: columnIndex },
    end: { row: maxRows - 1, column: columnIndex },
    type: SelectionType.FULL_COLUMN,
    isActive: true,
  };

  return {
    primary: selection,
    secondary: [],
    activeCell: { row: 0, column: columnIndex },
    lastModified: new Date(),
  };
}

/**
 * 選択範囲を拡張する関数
 */
export function extendSelection(selection: Selection, newEnd: CellPosition): Selection {
  if (selection.primary.type === SelectionType.FULL_ROW || selection.primary.type === SelectionType.FULL_COLUMN) {
    // 行・列全体選択の場合は拡張しない
    return selection;
  }

  const updatedPrimary: CellSelection = {
    ...selection.primary,
    end: newEnd,
    type: selection.primary.start.row === newEnd.row && selection.primary.start.column === newEnd.column
      ? SelectionType.SINGLE_CELL
      : SelectionType.CELL_RANGE,
  };

  return {
    ...selection,
    primary: updatedPrimary,
    lastModified: new Date(),
  };
}

/**
 * セカンダリ選択を追加する関数（Ctrlキー押下時の複数選択）
 */
export function addSecondarySelection(selection: Selection, newSelection: CellSelection): Selection {
  const updatedSecondary = [...selection.secondary, newSelection];

  return {
    ...selection,
    secondary: updatedSecondary,
    primary: {
      ...selection.primary,
      type: SelectionType.MULTIPLE_RANGES,
    },
    lastModified: new Date(),
  };
}

/**
 * アクティブセルを変更する関数
 */
export function setActiveCell(selection: Selection, activeCell: CellPosition): Selection {
  return {
    ...selection,
    activeCell,
    lastModified: new Date(),
  };
}

/**
 * 選択範囲をクリアする関数
 */
export function clearSelection(): Selection {
  return {
    primary: {
      start: { row: 0, column: 0 },
      end: { row: 0, column: 0 },
      type: SelectionType.SINGLE_CELL,
      isActive: false,
    },
    secondary: [],
    activeCell: { row: 0, column: 0 },
    lastModified: new Date(),
  };
}

/**
 * 指定されたセルが選択範囲に含まれるかチェックする関数
 */
export function isCellSelected(selection: Selection, position: CellPosition): boolean {
  // プライマリ選択をチェック
  if (isCellInRange(position, selection.primary)) {
    return true;
  }

  // セカンダリ選択をチェック
  return selection.secondary.some(range => isCellInRange(position, range));
}

/**
 * セルが指定された範囲内にあるかチェックする関数
 */
export function isCellInRange(position: CellPosition, range: CellSelection): boolean {
  const minRow = Math.min(range.start.row, range.end.row);
  const maxRow = Math.max(range.start.row, range.end.row);
  const minColumn = Math.min(range.start.column, range.end.column);
  const maxColumn = Math.max(range.start.column, range.end.column);

  return position.row >= minRow &&
         position.row <= maxRow &&
         position.column >= minColumn &&
         position.column <= maxColumn;
}

/**
 * 選択範囲の境界を取得する関数
 */
export function getSelectionBounds(selection: Selection): SelectionBounds {
  let minRow = selection.primary.start.row;
  let maxRow = selection.primary.end.row;
  let minColumn = selection.primary.start.column;
  let maxColumn = selection.primary.end.column;

  // プライマリ選択の正規化
  minRow = Math.min(minRow, selection.primary.end.row);
  maxRow = Math.max(maxRow, selection.primary.end.row);
  minColumn = Math.min(minColumn, selection.primary.end.column);
  maxColumn = Math.max(maxColumn, selection.primary.end.column);

  // セカンダリ選択も考慮
  for (const range of selection.secondary) {
    minRow = Math.min(minRow, range.start.row, range.end.row);
    maxRow = Math.max(maxRow, range.start.row, range.end.row);
    minColumn = Math.min(minColumn, range.start.column, range.end.column);
    maxColumn = Math.max(maxColumn, range.start.column, range.end.column);
  }

  return { minRow, maxRow, minColumn, maxColumn };
}

/**
 * 選択されているセルの総数を取得する関数
 */
export function getSelectedCellCount(selection: Selection): number {
  let count = 0;

  // プライマリ選択
  count += calculateRangeCellCount(selection.primary);

  // セカンダリ選択
  for (const range of selection.secondary) {
    count += calculateRangeCellCount(range);
  }

  return count;
}

/**
 * 選択範囲のセル数を計算する関数
 */
function calculateRangeCellCount(range: CellSelection): number {
  const rowCount = Math.abs(range.end.row - range.start.row) + 1;
  const columnCount = Math.abs(range.end.column - range.start.column) + 1;
  return rowCount * columnCount;
}

/**
 * 選択範囲内の全セル位置を取得する関数
 */
export function getAllSelectedCellPositions(selection: Selection): CellPosition[] {
  const positions: CellPosition[] = [];

  // プライマリ選択
  positions.push(...getRangeCellPositions(selection.primary));

  // セカンダリ選択
  for (const range of selection.secondary) {
    positions.push(...getRangeCellPositions(range));
  }

  // 重複を除去
  const uniquePositions = positions.filter((pos, index, array) =>
    index === array.findIndex(p => p.row === pos.row && p.column === pos.column)
  );

  return uniquePositions;
}

/**
 * 選択範囲内の全セル位置を取得する関数
 */
function getRangeCellPositions(range: CellSelection): CellPosition[] {
  const positions: CellPosition[] = [];
  const minRow = Math.min(range.start.row, range.end.row);
  const maxRow = Math.max(range.start.row, range.end.row);
  const minColumn = Math.min(range.start.column, range.end.column);
  const maxColumn = Math.max(range.start.column, range.end.column);

  for (let row = minRow; row <= maxRow; row++) {
    for (let column = minColumn; column <= maxColumn; column++) {
      positions.push({ row, column });
    }
  }

  return positions;
}

/**
 * 選択範囲をA1記法の文字列で表現する関数
 */
export function selectionToA1Notation(selection: Selection): string {
  const parts: string[] = [];

  // プライマリ選択
  parts.push(cellSelectionToA1Notation(selection.primary));

  // セカンダリ選択
  for (const range of selection.secondary) {
    parts.push(cellSelectionToA1Notation(range));
  }

  return parts.join(', ');
}

/**
 * 単一の選択範囲をA1記法の文字列で表現する関数
 */
function cellSelectionToA1Notation(range: CellSelection): string {
  if (range.type === SelectionType.SINGLE_CELL) {
    return cellPositionToA1Notation(range.start);
  }

  const startA1 = cellPositionToA1Notation(range.start);
  const endA1 = cellPositionToA1Notation(range.end);
  return `${startA1}:${endA1}`;
}

/**
 * キーボード操作による選択移動を処理する関数
 */
export function moveSelection(
  selection: Selection,
  direction: 'up' | 'down' | 'left' | 'right',
  extend: boolean = false,
  maxRows: number,
  maxColumns: number
): Selection {
  const currentActive = selection.activeCell;
  let newActive = { ...currentActive };

  switch (direction) {
    case 'up':
      newActive.row = Math.max(0, currentActive.row - 1);
      break;
    case 'down':
      newActive.row = Math.min(maxRows - 1, currentActive.row + 1);
      break;
    case 'left':
      newActive.column = Math.max(0, currentActive.column - 1);
      break;
    case 'right':
      newActive.column = Math.min(maxColumns - 1, currentActive.column + 1);
      break;
  }

  if (extend) {
    // Shiftキーが押されている場合は選択範囲を拡張
    return extendSelection(selection, newActive);
  } else {
    // 新しい単一セル選択
    return createSingleCellSelection(newActive);
  }
}

/**
 * 選択の妥当性を検証する関数
 */
export function validateSelection(
  selection: Selection,
  maxRows: number,
  maxColumns: number
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // プライマリ選択の検証
  const primaryErrors = validateCellSelection(selection.primary, maxRows, maxColumns);
  errors.push(...primaryErrors);

  // セカンダリ選択の検証
  for (let i = 0; i < selection.secondary.length; i++) {
    const secondaryErrors = validateCellSelection(selection.secondary[i], maxRows, maxColumns);
    errors.push(...secondaryErrors.map(err => `セカンダリ選択${i + 1}: ${err}`));
  }

  // アクティブセルの検証
  if (selection.activeCell.row < 0 || selection.activeCell.row >= maxRows) {
    errors.push('アクティブセルの行が範囲外です');
  }
  if (selection.activeCell.column < 0 || selection.activeCell.column >= maxColumns) {
    errors.push('アクティブセルの列が範囲外です');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 単一の選択範囲の妥当性を検証する関数
 */
function validateCellSelection(
  selection: CellSelection,
  maxRows: number,
  maxColumns: number
): string[] {
  const errors: string[] = [];

  if (selection.start.row < 0 || selection.start.row >= maxRows) {
    errors.push('選択開始行が範囲外です');
  }
  if (selection.start.column < 0 || selection.start.column >= maxColumns) {
    errors.push('選択開始列が範囲外です');
  }
  if (selection.end.row < 0 || selection.end.row >= maxRows) {
    errors.push('選択終了行が範囲外です');
  }
  if (selection.end.column < 0 || selection.end.column >= maxColumns) {
    errors.push('選択終了列が範囲外です');
  }

  return errors;
}