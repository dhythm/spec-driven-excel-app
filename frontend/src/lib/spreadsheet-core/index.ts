/**
 * Spreadsheet Core Library
 * スプレッドシートの基本操作を提供するライブラリ
 */

import {
  Spreadsheet,
  createSpreadsheet,
  setCellInSpreadsheet,
  getCellFromSpreadsheet,
  cellPositionToKey,
  keyToCellPosition,
  DEFAULT_SPREADSHEET_CONFIG,
  SpreadsheetConfig
} from '../spreadsheet';
import {
  Cell,
  CellPosition,
  createEmptyCell,
  updateCellValue,
  updateCellFormat,
  CellFormat,
  CellDataType
} from '../cell';

/**
 * スプレッドシートのメイン操作結果
 */
export interface SpreadsheetOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  spreadsheet: Spreadsheet;
}

/**
 * バッチ操作の結果
 */
export interface BatchOperationResult {
  success: boolean;
  successCount: number;
  totalCount: number;
  errors: { position: CellPosition; error: string }[];
  spreadsheet: Spreadsheet;
}

/**
 * セル更新操作の定義
 */
export interface CellUpdate {
  position: CellPosition;
  value: string;
  format?: Partial<CellFormat>;
}

/**
 * 新しいスプレッドシートを作成する
 */
export function createNewSpreadsheet(
  name?: string,
  config?: Partial<SpreadsheetConfig>
): SpreadsheetOperationResult<Spreadsheet> {
  try {
    const finalConfig = { ...DEFAULT_SPREADSHEET_CONFIG, ...config };
    const spreadsheet = createSpreadsheet(name, finalConfig);

    return {
      success: true,
      data: spreadsheet,
      spreadsheet
    };
  } catch (error) {
    const emptySpreadsheet = createSpreadsheet();
    return {
      success: false,
      error: error instanceof Error ? error.message : 'スプレッドシートの作成に失敗しました',
      spreadsheet: emptySpreadsheet
    };
  }
}

/**
 * セルの値を設定する
 */
export function setCellValue(
  spreadsheet: Spreadsheet,
  position: CellPosition,
  value: string
): SpreadsheetOperationResult<Cell> {
  try {
    // セル位置の妥当性を確認
    if (!isValidPosition(spreadsheet, position)) {
      return {
        success: false,
        error: 'セル位置が範囲外です',
        spreadsheet
      };
    }

    // 既存のセルを取得または新しいセルを作成
    let cell = getCellFromSpreadsheet(spreadsheet, position);
    if (!cell) {
      cell = createEmptyCell(position);
    }

    // セル値を更新
    const updatedCell = updateCellValue(cell, value);
    const updatedSpreadsheet = setCellInSpreadsheet(spreadsheet, position, updatedCell);

    return {
      success: true,
      data: updatedCell,
      spreadsheet: updatedSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'セル値の設定に失敗しました',
      spreadsheet
    };
  }
}

/**
 * セルの値を取得する
 */
export function getCellValue(
  spreadsheet: Spreadsheet,
  position: CellPosition
): SpreadsheetOperationResult<string> {
  try {
    if (!isValidPosition(spreadsheet, position)) {
      return {
        success: false,
        error: 'セル位置が範囲外です',
        spreadsheet
      };
    }

    const cell = getCellFromSpreadsheet(spreadsheet, position);
    const value = cell?.displayValue || '';

    return {
      success: true,
      data: value,
      spreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'セル値の取得に失敗しました',
      spreadsheet
    };
  }
}

/**
 * セルの書式を設定する
 */
export function setCellFormat(
  spreadsheet: Spreadsheet,
  position: CellPosition,
  format: Partial<CellFormat>
): SpreadsheetOperationResult<Cell> {
  try {
    if (!isValidPosition(spreadsheet, position)) {
      return {
        success: false,
        error: 'セル位置が範囲外です',
        spreadsheet
      };
    }

    // 既存のセルを取得または新しいセルを作成
    let cell = getCellFromSpreadsheet(spreadsheet, position);
    if (!cell) {
      cell = createEmptyCell(position);
    }

    // セル書式を更新
    const updatedCell = updateCellFormat(cell, format);
    const updatedSpreadsheet = setCellInSpreadsheet(spreadsheet, position, updatedCell);

    return {
      success: true,
      data: updatedCell,
      spreadsheet: updatedSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'セル書式の設定に失敗しました',
      spreadsheet
    };
  }
}

/**
 * セルを削除する（空のセルに戻す）
 */
export function deleteCell(
  spreadsheet: Spreadsheet,
  position: CellPosition
): SpreadsheetOperationResult<boolean> {
  try {
    if (!isValidPosition(spreadsheet, position)) {
      return {
        success: false,
        error: 'セル位置が範囲外です',
        spreadsheet
      };
    }

    const key = cellPositionToKey(position);
    const newCells = new Map(spreadsheet.cells);
    newCells.delete(key);

    const updatedSpreadsheet: Spreadsheet = {
      ...spreadsheet,
      cells: newCells,
      updatedAt: new Date()
    };

    return {
      success: true,
      data: true,
      spreadsheet: updatedSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'セルの削除に失敗しました',
      spreadsheet
    };
  }
}

/**
 * 複数のセルを一括で更新する
 */
export function batchUpdateCells(
  spreadsheet: Spreadsheet,
  updates: CellUpdate[]
): BatchOperationResult {
  const errors: { position: CellPosition; error: string }[] = [];
  let currentSpreadsheet = spreadsheet;
  let successCount = 0;

  for (const update of updates) {
    try {
      // セル値を更新
      const valueResult = setCellValue(currentSpreadsheet, update.position, update.value);
      if (!valueResult.success) {
        errors.push({
          position: update.position,
          error: valueResult.error || 'セル値の更新に失敗しました'
        });
        continue;
      }
      currentSpreadsheet = valueResult.spreadsheet;

      // セル書式を更新（指定されている場合）
      if (update.format) {
        const formatResult = setCellFormat(currentSpreadsheet, update.position, update.format);
        if (!formatResult.success) {
          errors.push({
            position: update.position,
            error: formatResult.error || 'セル書式の更新に失敗しました'
          });
          continue;
        }
        currentSpreadsheet = formatResult.spreadsheet;
      }

      successCount++;
    } catch (error) {
      errors.push({
        position: update.position,
        error: error instanceof Error ? error.message : '予期しないエラーが発生しました'
      });
    }
  }

  return {
    success: errors.length === 0,
    successCount,
    totalCount: updates.length,
    errors,
    spreadsheet: currentSpreadsheet
  };
}

/**
 * セル範囲の値を取得する
 */
export function getCellRangeValues(
  spreadsheet: Spreadsheet,
  startPosition: CellPosition,
  endPosition: CellPosition
): SpreadsheetOperationResult<string[][]> {
  try {
    if (!isValidPosition(spreadsheet, startPosition) || !isValidPosition(spreadsheet, endPosition)) {
      return {
        success: false,
        error: 'セル範囲が範囲外です',
        spreadsheet
      };
    }

    const minRow = Math.min(startPosition.row, endPosition.row);
    const maxRow = Math.max(startPosition.row, endPosition.row);
    const minCol = Math.min(startPosition.column, endPosition.column);
    const maxCol = Math.max(startPosition.column, endPosition.column);

    const values: string[][] = [];

    for (let row = minRow; row <= maxRow; row++) {
      const rowValues: string[] = [];
      for (let col = minCol; col <= maxCol; col++) {
        const cell = getCellFromSpreadsheet(spreadsheet, { row, column: col });
        rowValues.push(cell?.displayValue || '');
      }
      values.push(rowValues);
    }

    return {
      success: true,
      data: values,
      spreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'セル範囲の取得に失敗しました',
      spreadsheet
    };
  }
}

/**
 * セル範囲をクリアする
 */
export function clearCellRange(
  spreadsheet: Spreadsheet,
  startPosition: CellPosition,
  endPosition: CellPosition
): SpreadsheetOperationResult<number> {
  try {
    if (!isValidPosition(spreadsheet, startPosition) || !isValidPosition(spreadsheet, endPosition)) {
      return {
        success: false,
        error: 'セル範囲が範囲外です',
        spreadsheet
      };
    }

    const minRow = Math.min(startPosition.row, endPosition.row);
    const maxRow = Math.max(startPosition.row, endPosition.row);
    const minCol = Math.min(startPosition.column, endPosition.column);
    const maxCol = Math.max(startPosition.column, endPosition.column);

    const newCells = new Map(spreadsheet.cells);
    let deletedCount = 0;

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const key = cellPositionToKey({ row, column: col });
        if (newCells.has(key)) {
          newCells.delete(key);
          deletedCount++;
        }
      }
    }

    const updatedSpreadsheet: Spreadsheet = {
      ...spreadsheet,
      cells: newCells,
      updatedAt: new Date()
    };

    return {
      success: true,
      data: deletedCount,
      spreadsheet: updatedSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'セル範囲のクリアに失敗しました',
      spreadsheet
    };
  }
}

/**
 * スプレッドシートの統計情報を取得する
 */
export function getSpreadsheetStats(spreadsheet: Spreadsheet): SpreadsheetOperationResult<{
  cellCount: number;
  nonEmptyCells: number;
  formulaCells: number;
  lastModified: Date;
}> {
  try {
    const cells = Array.from(spreadsheet.cells.values());
    const nonEmptyCells = cells.filter(cell => cell.dataType !== CellDataType.EMPTY).length;
    const formulaCells = cells.filter(cell => cell.dataType === CellDataType.FORMULA).length;

    const stats = {
      cellCount: cells.length,
      nonEmptyCells,
      formulaCells,
      lastModified: spreadsheet.updatedAt
    };

    return {
      success: true,
      data: stats,
      spreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '統計情報の取得に失敗しました',
      spreadsheet
    };
  }
}

/**
 * セル位置が有効かどうかを判定する
 */
function isValidPosition(spreadsheet: Spreadsheet, position: CellPosition): boolean {
  return position.row >= 0 &&
         position.row < spreadsheet.rowCount &&
         position.column >= 0 &&
         position.column < spreadsheet.columnCount;
}

/**
 * スプレッドシートを別の名前でコピーする
 */
export function copySpreadsheet(
  spreadsheet: Spreadsheet,
  newName: string
): SpreadsheetOperationResult<Spreadsheet> {
  try {
    const copiedSpreadsheet: Spreadsheet = {
      ...spreadsheet,
      id: crypto.randomUUID(),
      name: newName,
      createdAt: new Date(),
      updatedAt: new Date(),
      cells: new Map(spreadsheet.cells) // セルのディープコピー
    };

    return {
      success: true,
      data: copiedSpreadsheet,
      spreadsheet: copiedSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'スプレッドシートのコピーに失敗しました',
      spreadsheet
    };
  }
}

/**
 * スプレッドシートの名前を変更する
 */
export function renameSpreadsheet(
  spreadsheet: Spreadsheet,
  newName: string
): SpreadsheetOperationResult<Spreadsheet> {
  try {
    const updatedSpreadsheet: Spreadsheet = {
      ...spreadsheet,
      name: newName,
      updatedAt: new Date()
    };

    return {
      success: true,
      data: updatedSpreadsheet,
      spreadsheet: updatedSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'スプレッドシート名の変更に失敗しました',
      spreadsheet
    };
  }
}