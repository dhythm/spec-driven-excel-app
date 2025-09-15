/**
 * Spreadsheet Grid Management Library
 * グリッド管理（行・列の追加・削除）を担当するライブラリ
 */

import { Spreadsheet, cellPositionToKey } from '../spreadsheet';
import { CellPosition, Cell, createEmptyCell } from '../cell';
import {
  Row,
  createRow,
  insertRows,
  deleteRows,
  resizeRow,
  hideRows,
  showRows,
  moveRow,
  DEFAULT_ROW_HEIGHT
} from '../row';
import {
  Column,
  createColumn,
  insertColumns,
  deleteColumns,
  resizeColumn,
  hideColumns,
  showColumns,
  moveColumn,
  DEFAULT_COLUMN_WIDTH,
  indexToColumnHeader
} from '../column';

/**
 * グリッド操作の結果
 */
export interface GridOperationResult {
  success: boolean;
  error?: string;
  affectedRows?: number[];
  affectedColumns?: number[];
  affectedCells?: CellPosition[];
  spreadsheet: Spreadsheet;
}

/**
 * 行挿入の結果（削除時の復元データを含む）
 */
export interface RowInsertResult extends GridOperationResult {
  insertedRows?: Row[];
}

/**
 * 行削除の結果（復元用データを含む）
 */
export interface RowDeleteResult extends GridOperationResult {
  deletedRows?: Row[];
  deletedCells?: { position: CellPosition; cell: Cell }[];
}

/**
 * 列挿入の結果
 */
export interface ColumnInsertResult extends GridOperationResult {
  insertedColumns?: Column[];
}

/**
 * 列削除の結果
 */
export interface ColumnDeleteResult extends GridOperationResult {
  deletedColumns?: Column[];
  deletedCells?: { position: CellPosition; cell: Cell }[];
}

/**
 * 指定位置に行を挿入する
 */
export function insertRowsAt(
  spreadsheet: Spreadsheet,
  index: number,
  count: number = 1
): RowInsertResult {
  try {
    if (index < 0 || index > spreadsheet.rowCount) {
      return {
        success: false,
        error: '挿入位置が無効です',
        spreadsheet
      };
    }

    // 新しい行を挿入
    const newRows = insertRows(spreadsheet.rows, index, count);

    // セルデータを再配置（挿入位置以降のセルを下にシフト）
    const newCells = new Map<string, Cell>();

    for (const [key, cell] of spreadsheet.cells) {
      const position = JSON.parse(`{"row":${key.split('-')[0]},"column":${key.split('-')[1]}}`);

      if (position.row >= index) {
        // 挿入位置以降のセルを下にシフト
        const newPosition = { ...position, row: position.row + count };
        const updatedCell = { ...cell, position: newPosition, lastModified: new Date() };
        newCells.set(cellPositionToKey(newPosition), updatedCell);
      } else {
        newCells.set(key, cell);
      }
    }

    const updatedSpreadsheet: Spreadsheet = {
      ...spreadsheet,
      rows: newRows,
      rowCount: spreadsheet.rowCount + count,
      cells: newCells,
      updatedAt: new Date()
    };

    return {
      success: true,
      affectedRows: Array.from({ length: count }, (_, i) => index + i),
      insertedRows: newRows.slice(index, index + count),
      spreadsheet: updatedSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '行の挿入に失敗しました',
      spreadsheet
    };
  }
}

/**
 * 指定位置の行を削除する
 */
export function deleteRowsAt(
  spreadsheet: Spreadsheet,
  index: number,
  count: number = 1
): RowDeleteResult {
  try {
    if (index < 0 || index >= spreadsheet.rowCount) {
      return {
        success: false,
        error: '削除位置が無効です',
        spreadsheet
      };
    }

    const actualCount = Math.min(count, spreadsheet.rowCount - index);

    // 削除される行の情報を保存
    const deletedRows = spreadsheet.rows.slice(index, index + actualCount);

    // 削除される行のセルデータを保存
    const deletedCells: { position: CellPosition; cell: Cell }[] = [];
    const newCells = new Map<string, Cell>();

    for (const [key, cell] of spreadsheet.cells) {
      const position = JSON.parse(`{"row":${key.split('-')[0]},"column":${key.split('-')[1]}}`);

      if (position.row >= index && position.row < index + actualCount) {
        // 削除される行のセル
        deletedCells.push({ position, cell });
      } else if (position.row >= index + actualCount) {
        // 削除位置より下の行のセルを上にシフト
        const newPosition = { ...position, row: position.row - actualCount };
        const updatedCell = { ...cell, position: newPosition, lastModified: new Date() };
        newCells.set(cellPositionToKey(newPosition), updatedCell);
      } else {
        // 削除位置より上の行のセルはそのまま
        newCells.set(key, cell);
      }
    }

    // 行を削除
    const newRows = deleteRows(spreadsheet.rows, index, actualCount);

    const updatedSpreadsheet: Spreadsheet = {
      ...spreadsheet,
      rows: newRows,
      rowCount: spreadsheet.rowCount - actualCount,
      cells: newCells,
      updatedAt: new Date()
    };

    return {
      success: true,
      affectedRows: Array.from({ length: actualCount }, (_, i) => index + i),
      deletedRows,
      deletedCells,
      spreadsheet: updatedSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '行の削除に失敗しました',
      spreadsheet
    };
  }
}

/**
 * 指定位置に列を挿入する
 */
export function insertColumnsAt(
  spreadsheet: Spreadsheet,
  index: number,
  count: number = 1
): ColumnInsertResult {
  try {
    if (index < 0 || index > spreadsheet.columnCount) {
      return {
        success: false,
        error: '挿入位置が無効です',
        spreadsheet
      };
    }

    // 新しい列を挿入
    const newColumns = insertColumns(spreadsheet.columns, index, count);

    // セルデータを再配置（挿入位置以降のセルを右にシフト）
    const newCells = new Map<string, Cell>();

    for (const [key, cell] of spreadsheet.cells) {
      const position = JSON.parse(`{"row":${key.split('-')[0]},"column":${key.split('-')[1]}}`);

      if (position.column >= index) {
        // 挿入位置以降のセルを右にシフト
        const newPosition = { ...position, column: position.column + count };
        const updatedCell = { ...cell, position: newPosition, lastModified: new Date() };
        newCells.set(cellPositionToKey(newPosition), updatedCell);
      } else {
        newCells.set(key, cell);
      }
    }

    const updatedSpreadsheet: Spreadsheet = {
      ...spreadsheet,
      columns: newColumns,
      columnCount: spreadsheet.columnCount + count,
      cells: newCells,
      updatedAt: new Date()
    };

    return {
      success: true,
      affectedColumns: Array.from({ length: count }, (_, i) => index + i),
      insertedColumns: newColumns.slice(index, index + count),
      spreadsheet: updatedSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '列の挿入に失敗しました',
      spreadsheet
    };
  }
}

/**
 * 指定位置の列を削除する
 */
export function deleteColumnsAt(
  spreadsheet: Spreadsheet,
  index: number,
  count: number = 1
): ColumnDeleteResult {
  try {
    if (index < 0 || index >= spreadsheet.columnCount) {
      return {
        success: false,
        error: '削除位置が無効です',
        spreadsheet
      };
    }

    const actualCount = Math.min(count, spreadsheet.columnCount - index);

    // 削除される列の情報を保存
    const deletedColumns = spreadsheet.columns.slice(index, index + actualCount);

    // 削除される列のセルデータを保存
    const deletedCells: { position: CellPosition; cell: Cell }[] = [];
    const newCells = new Map<string, Cell>();

    for (const [key, cell] of spreadsheet.cells) {
      const position = JSON.parse(`{"row":${key.split('-')[0]},"column":${key.split('-')[1]}}`);

      if (position.column >= index && position.column < index + actualCount) {
        // 削除される列のセル
        deletedCells.push({ position, cell });
      } else if (position.column >= index + actualCount) {
        // 削除位置より右の列のセルを左にシフト
        const newPosition = { ...position, column: position.column - actualCount };
        const updatedCell = { ...cell, position: newPosition, lastModified: new Date() };
        newCells.set(cellPositionToKey(newPosition), updatedCell);
      } else {
        // 削除位置より左の列のセルはそのまま
        newCells.set(key, cell);
      }
    }

    // 列を削除
    const newColumns = deleteColumns(spreadsheet.columns, index, actualCount);

    const updatedSpreadsheet: Spreadsheet = {
      ...spreadsheet,
      columns: newColumns,
      columnCount: spreadsheet.columnCount - actualCount,
      cells: newCells,
      updatedAt: new Date()
    };

    return {
      success: true,
      affectedColumns: Array.from({ length: actualCount }, (_, i) => index + i),
      deletedColumns,
      deletedCells,
      spreadsheet: updatedSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '列の削除に失敗しました',
      spreadsheet
    };
  }
}

/**
 * 行の高さを変更する
 */
export function resizeRowHeight(
  spreadsheet: Spreadsheet,
  index: number,
  newHeight: number
): GridOperationResult {
  try {
    if (index < 0 || index >= spreadsheet.rowCount) {
      return {
        success: false,
        error: '行のインデックスが無効です',
        spreadsheet
      };
    }

    const newRows = resizeRow(spreadsheet.rows, index, newHeight);
    const updatedSpreadsheet: Spreadsheet = {
      ...spreadsheet,
      rows: newRows,
      updatedAt: new Date()
    };

    return {
      success: true,
      affectedRows: [index],
      spreadsheet: updatedSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '行の高さ変更に失敗しました',
      spreadsheet
    };
  }
}

/**
 * 列の幅を変更する
 */
export function resizeColumnWidth(
  spreadsheet: Spreadsheet,
  index: number,
  newWidth: number
): GridOperationResult {
  try {
    if (index < 0 || index >= spreadsheet.columnCount) {
      return {
        success: false,
        error: '列のインデックスが無効です',
        spreadsheet
      };
    }

    const newColumns = resizeColumn(spreadsheet.columns, index, newWidth);
    const updatedSpreadsheet: Spreadsheet = {
      ...spreadsheet,
      columns: newColumns,
      updatedAt: new Date()
    };

    return {
      success: true,
      affectedColumns: [index],
      spreadsheet: updatedSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '列の幅変更に失敗しました',
      spreadsheet
    };
  }
}

/**
 * 行を非表示にする
 */
export function hideRowsAt(
  spreadsheet: Spreadsheet,
  startIndex: number,
  count: number = 1
): GridOperationResult {
  try {
    const newRows = hideRows(spreadsheet.rows, startIndex, count);
    const updatedSpreadsheet: Spreadsheet = {
      ...spreadsheet,
      rows: newRows,
      updatedAt: new Date()
    };

    return {
      success: true,
      affectedRows: Array.from({ length: count }, (_, i) => startIndex + i),
      spreadsheet: updatedSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '行の非表示に失敗しました',
      spreadsheet
    };
  }
}

/**
 * 行を表示する
 */
export function showRowsAt(
  spreadsheet: Spreadsheet,
  startIndex: number,
  count: number = 1
): GridOperationResult {
  try {
    const newRows = showRows(spreadsheet.rows, startIndex, count);
    const updatedSpreadsheet: Spreadsheet = {
      ...spreadsheet,
      rows: newRows,
      updatedAt: new Date()
    };

    return {
      success: true,
      affectedRows: Array.from({ length: count }, (_, i) => startIndex + i),
      spreadsheet: updatedSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '行の表示に失敗しました',
      spreadsheet
    };
  }
}

/**
 * 列を非表示にする
 */
export function hideColumnsAt(
  spreadsheet: Spreadsheet,
  startIndex: number,
  count: number = 1
): GridOperationResult {
  try {
    const newColumns = hideColumns(spreadsheet.columns, startIndex, count);
    const updatedSpreadsheet: Spreadsheet = {
      ...spreadsheet,
      columns: newColumns,
      updatedAt: new Date()
    };

    return {
      success: true,
      affectedColumns: Array.from({ length: count }, (_, i) => startIndex + i),
      spreadsheet: updatedSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '列の非表示に失敗しました',
      spreadsheet
    };
  }
}

/**
 * 列を表示する
 */
export function showColumnsAt(
  spreadsheet: Spreadsheet,
  startIndex: number,
  count: number = 1
): GridOperationResult {
  try {
    const newColumns = showColumns(spreadsheet.columns, startIndex, count);
    const updatedSpreadsheet: Spreadsheet = {
      ...spreadsheet,
      columns: newColumns,
      updatedAt: new Date()
    };

    return {
      success: true,
      affectedColumns: Array.from({ length: count }, (_, i) => startIndex + i),
      spreadsheet: updatedSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '列の表示に失敗しました',
      spreadsheet
    };
  }
}

/**
 * スプレッドシートのサイズを変更する（行数・列数の変更）
 */
export function resizeSpreadsheet(
  spreadsheet: Spreadsheet,
  newRowCount: number,
  newColumnCount: number
): GridOperationResult {
  try {
    if (newRowCount <= 0 || newColumnCount <= 0) {
      return {
        success: false,
        error: '行数・列数は1以上である必要があります',
        spreadsheet
      };
    }

    let newRows = [...spreadsheet.rows];
    let newColumns = [...spreadsheet.columns];
    const newCells = new Map<string, Cell>();

    // 行の調整
    if (newRowCount > spreadsheet.rowCount) {
      // 行を追加
      for (let i = spreadsheet.rowCount; i < newRowCount; i++) {
        newRows.push(createRow(i));
      }
    } else if (newRowCount < spreadsheet.rowCount) {
      // 行を削除（削除される行のセルも削除）
      newRows = newRows.slice(0, newRowCount);
    }

    // 列の調整
    if (newColumnCount > spreadsheet.columnCount) {
      // 列を追加
      for (let i = spreadsheet.columnCount; i < newColumnCount; i++) {
        newColumns.push(createColumn(i));
      }
    } else if (newColumnCount < spreadsheet.columnCount) {
      // 列を削除（削除される列のセルも削除）
      newColumns = newColumns.slice(0, newColumnCount);
    }

    // セルデータの調整（範囲外のセルを削除）
    for (const [key, cell] of spreadsheet.cells) {
      const position = JSON.parse(`{"row":${key.split('-')[0]},"column":${key.split('-')[1]}}`);

      if (position.row < newRowCount && position.column < newColumnCount) {
        newCells.set(key, cell);
      }
    }

    const updatedSpreadsheet: Spreadsheet = {
      ...spreadsheet,
      rows: newRows,
      columns: newColumns,
      rowCount: newRowCount,
      columnCount: newColumnCount,
      cells: newCells,
      updatedAt: new Date()
    };

    return {
      success: true,
      affectedRows: newRowCount !== spreadsheet.rowCount ?
        Array.from({ length: Math.abs(newRowCount - spreadsheet.rowCount) }, (_, i) =>
          Math.min(spreadsheet.rowCount, newRowCount) + i) : undefined,
      affectedColumns: newColumnCount !== spreadsheet.columnCount ?
        Array.from({ length: Math.abs(newColumnCount - spreadsheet.columnCount) }, (_, i) =>
          Math.min(spreadsheet.columnCount, newColumnCount) + i) : undefined,
      spreadsheet: updatedSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'スプレッドシートのサイズ変更に失敗しました',
      spreadsheet
    };
  }
}

/**
 * 行を移動する
 */
export function moveRowToPosition(
  spreadsheet: Spreadsheet,
  fromIndex: number,
  toIndex: number
): GridOperationResult {
  try {
    if (fromIndex < 0 || fromIndex >= spreadsheet.rowCount ||
        toIndex < 0 || toIndex >= spreadsheet.rowCount) {
      return {
        success: false,
        error: '移動インデックスが無効です',
        spreadsheet
      };
    }

    if (fromIndex === toIndex) {
      return {
        success: true,
        affectedRows: [],
        spreadsheet
      };
    }

    const newRows = moveRow(spreadsheet.rows, fromIndex, toIndex);

    // セルデータの移動処理
    const newCells = new Map<string, Cell>();

    for (const [key, cell] of spreadsheet.cells) {
      const position = JSON.parse(`{"row":${key.split('-')[0]},"column":${key.split('-')[1]}}`);
      let newRowIndex = position.row;

      if (position.row === fromIndex) {
        newRowIndex = toIndex;
      } else if (fromIndex < toIndex && position.row > fromIndex && position.row <= toIndex) {
        newRowIndex = position.row - 1;
      } else if (fromIndex > toIndex && position.row < fromIndex && position.row >= toIndex) {
        newRowIndex = position.row + 1;
      }

      const newPosition = { ...position, row: newRowIndex };
      const updatedCell = { ...cell, position: newPosition, lastModified: new Date() };
      newCells.set(cellPositionToKey(newPosition), updatedCell);
    }

    const updatedSpreadsheet: Spreadsheet = {
      ...spreadsheet,
      rows: newRows,
      cells: newCells,
      updatedAt: new Date()
    };

    return {
      success: true,
      affectedRows: [fromIndex, toIndex],
      spreadsheet: updatedSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '行の移動に失敗しました',
      spreadsheet
    };
  }
}

/**
 * 列を移動する
 */
export function moveColumnToPosition(
  spreadsheet: Spreadsheet,
  fromIndex: number,
  toIndex: number
): GridOperationResult {
  try {
    if (fromIndex < 0 || fromIndex >= spreadsheet.columnCount ||
        toIndex < 0 || toIndex >= spreadsheet.columnCount) {
      return {
        success: false,
        error: '移動インデックスが無効です',
        spreadsheet
      };
    }

    if (fromIndex === toIndex) {
      return {
        success: true,
        affectedColumns: [],
        spreadsheet
      };
    }

    const newColumns = moveColumn(spreadsheet.columns, fromIndex, toIndex);

    // セルデータの移動処理
    const newCells = new Map<string, Cell>();

    for (const [key, cell] of spreadsheet.cells) {
      const position = JSON.parse(`{"row":${key.split('-')[0]},"column":${key.split('-')[1]}}`);
      let newColumnIndex = position.column;

      if (position.column === fromIndex) {
        newColumnIndex = toIndex;
      } else if (fromIndex < toIndex && position.column > fromIndex && position.column <= toIndex) {
        newColumnIndex = position.column - 1;
      } else if (fromIndex > toIndex && position.column < fromIndex && position.column >= toIndex) {
        newColumnIndex = position.column + 1;
      }

      const newPosition = { ...position, column: newColumnIndex };
      const updatedCell = { ...cell, position: newPosition, lastModified: new Date() };
      newCells.set(cellPositionToKey(newPosition), updatedCell);
    }

    const updatedSpreadsheet: Spreadsheet = {
      ...spreadsheet,
      columns: newColumns,
      cells: newCells,
      updatedAt: new Date()
    };

    return {
      success: true,
      affectedColumns: [fromIndex, toIndex],
      spreadsheet: updatedSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '列の移動に失敗しました',
      spreadsheet
    };
  }
}