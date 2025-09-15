/**
 * スプレッドシートモデル
 * 表全体を表すエンティティ。複数のセルを含み、名前、作成日時、最終更新日時を持つ
 */

import { Cell, CellPosition } from './cell';
import { Row } from './row';
import { Column } from './column';

export interface Spreadsheet {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  cells: Map<string, Cell>;
  rows: Row[];
  columns: Column[];
  rowCount: number;
  columnCount: number;
}

export interface SpreadsheetConfig {
  maxRows: number;
  maxColumns: number;
  defaultRowHeight: number;
  defaultColumnWidth: number;
}

export const DEFAULT_SPREADSHEET_CONFIG: SpreadsheetConfig = {
  maxRows: 1000,
  maxColumns: 26, // A-Z
  defaultRowHeight: 20,
  defaultColumnWidth: 100,
};

/**
 * セル位置をキー文字列に変換する関数
 */
export function cellPositionToKey(position: CellPosition): string {
  return `${position.row}-${position.column}`;
}

/**
 * キー文字列をセル位置に変換する関数
 */
export function keyToCellPosition(key: string): CellPosition {
  const [rowStr, columnStr] = key.split('-');
  return {
    row: parseInt(rowStr, 10),
    column: parseInt(columnStr, 10),
  };
}

/**
 * 新しいスプレッドシートを作成する関数
 */
export function createSpreadsheet(
  name: string = '無題のスプレッドシート',
  config: SpreadsheetConfig = DEFAULT_SPREADSHEET_CONFIG
): Spreadsheet {
  const now = new Date();
  const rows: Row[] = [];
  const columns: Column[] = [];

  // 初期行を作成
  for (let i = 0; i < config.maxRows; i++) {
    rows.push({
      index: i,
      height: config.defaultRowHeight,
      isVisible: true,
    });
  }

  // 初期列を作成
  for (let i = 0; i < config.maxColumns; i++) {
    columns.push({
      index: i,
      width: config.defaultColumnWidth,
      isVisible: true,
      header: String.fromCharCode(65 + i), // A, B, C, ...
    });
  }

  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    cells: new Map(),
    rows,
    columns,
    rowCount: config.maxRows,
    columnCount: config.maxColumns,
  };
}

/**
 * スプレッドシートにセルを設定する関数
 */
export function setCellInSpreadsheet(
  spreadsheet: Spreadsheet,
  position: CellPosition,
  cell: Cell
): Spreadsheet {
  if (position.row >= spreadsheet.rowCount || position.column >= spreadsheet.columnCount) {
    throw new Error('セル位置がスプレッドシートの範囲外です');
  }

  const key = cellPositionToKey(position);
  const newCells = new Map(spreadsheet.cells);
  newCells.set(key, cell);

  return {
    ...spreadsheet,
    cells: newCells,
    updatedAt: new Date(),
  };
}

/**
 * スプレッドシートからセルを取得する関数
 */
export function getCellFromSpreadsheet(
  spreadsheet: Spreadsheet,
  position: CellPosition
): Cell | undefined {
  const key = cellPositionToKey(position);
  return spreadsheet.cells.get(key);
}

/**
 * スプレッドシートのデータをCSV形式に変換する関数
 */
export function spreadsheetToCSV(spreadsheet: Spreadsheet): string {
  const csvRows: string[] = [];

  for (let rowIndex = 0; rowIndex < spreadsheet.rowCount; rowIndex++) {
    const csvCells: string[] = [];
    let hasData = false;

    for (let colIndex = 0; colIndex < spreadsheet.columnCount; colIndex++) {
      const cell = getCellFromSpreadsheet(spreadsheet, { row: rowIndex, column: colIndex });
      const cellValue = cell?.displayValue || '';

      if (cellValue) {
        hasData = true;
      }

      // CSV形式にエスケープ処理
      const escapedValue = cellValue.includes(',') || cellValue.includes('"') || cellValue.includes('\n')
        ? `"${cellValue.replace(/"/g, '""')}"`
        : cellValue;

      csvCells.push(escapedValue);
    }

    // データがある行のみ追加（最後の空行は除外）
    if (hasData) {
      csvRows.push(csvCells.join(','));
    } else if (csvRows.length > 0) {
      csvRows.push(csvCells.join(','));
    }
  }

  return csvRows.join('\n');
}

/**
 * スプレッドシートの妥当性を検証する関数
 */
export function validateSpreadsheet(spreadsheet: Spreadsheet): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!spreadsheet.id) {
    errors.push('スプレッドシートIDが必要です');
  }

  if (!spreadsheet.name) {
    errors.push('スプレッドシート名が必要です');
  }

  if (spreadsheet.rowCount <= 0) {
    errors.push('行数は1以上である必要があります');
  }

  if (spreadsheet.columnCount <= 0) {
    errors.push('列数は1以上である必要があります');
  }

  if (spreadsheet.rows.length !== spreadsheet.rowCount) {
    errors.push('行配列の長さが行数と一致しません');
  }

  if (spreadsheet.columns.length !== spreadsheet.columnCount) {
    errors.push('列配列の長さが列数と一致しません');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}