/**
 * 履歴エントリーモデル
 * ユーザーの操作履歴を管理し、元に戻す（Undo）・やり直す（Redo）機能を提供する
 */

import { CellPosition } from './cell';
import { CellSelection } from './selection';

export enum HistoryActionType {
  CELL_VALUE_CHANGE = 'cell_value_change',
  CELL_FORMAT_CHANGE = 'cell_format_change',
  ROW_INSERT = 'row_insert',
  ROW_DELETE = 'row_delete',
  ROW_RESIZE = 'row_resize',
  COLUMN_INSERT = 'column_insert',
  COLUMN_DELETE = 'column_delete',
  COLUMN_RESIZE = 'column_resize',
  PASTE_OPERATION = 'paste_operation',
  DELETE_OPERATION = 'delete_operation',
  BULK_OPERATION = 'bulk_operation',
}

export interface CellChange {
  position: CellPosition;
  oldValue: string;
  newValue: string;
  oldFormat?: any;
  newFormat?: any;
  oldDataType?: string;
  newDataType?: string;
}

export interface RowColumnOperation {
  type: 'row' | 'column';
  operation: 'insert' | 'delete' | 'resize';
  index: number;
  count?: number;
  oldSize?: number;
  newSize?: number;
  removedData?: any[];
}

export interface HistoryEntry {
  id: string;
  actionType: HistoryActionType;
  timestamp: Date;
  description: string;
  selection?: CellSelection;
  cellChanges: CellChange[];
  rowColumnOperations: RowColumnOperation[];
  metadata: {
    affectedCells: CellPosition[];
    affectedRows: number[];
    affectedColumns: number[];
  };
  isReversible: boolean;
}

export interface HistoryManager {
  entries: HistoryEntry[];
  currentIndex: number;
  maxEntries: number;
  canUndo: boolean;
  canRedo: boolean;
}

export const DEFAULT_MAX_HISTORY_ENTRIES = 100;

/**
 * 新しい履歴管理インスタンスを作成する関数
 */
export function createHistoryManager(maxEntries: number = DEFAULT_MAX_HISTORY_ENTRIES): HistoryManager {
  return {
    entries: [],
    currentIndex: -1,
    maxEntries,
    canUndo: false,
    canRedo: false,
  };
}

/**
 * セル値変更の履歴エントリーを作成する関数
 */
export function createCellValueChangeEntry(
  position: CellPosition,
  oldValue: string,
  newValue: string,
  oldDataType?: string,
  newDataType?: string
): HistoryEntry {
  const cellChange: CellChange = {
    position,
    oldValue,
    newValue,
    oldDataType,
    newDataType,
  };

  return {
    id: crypto.randomUUID(),
    actionType: HistoryActionType.CELL_VALUE_CHANGE,
    timestamp: new Date(),
    description: `セル ${position.row + 1}:${position.column + 1} の値を変更`,
    cellChanges: [cellChange],
    rowColumnOperations: [],
    metadata: {
      affectedCells: [position],
      affectedRows: [],
      affectedColumns: [],
    },
    isReversible: true,
  };
}

/**
 * セル書式変更の履歴エントリーを作成する関数
 */
export function createCellFormatChangeEntry(
  position: CellPosition,
  oldFormat: any,
  newFormat: any
): HistoryEntry {
  const cellChange: CellChange = {
    position,
    oldValue: '', // 書式変更では値は変わらない
    newValue: '',
    oldFormat,
    newFormat,
  };

  return {
    id: crypto.randomUUID(),
    actionType: HistoryActionType.CELL_FORMAT_CHANGE,
    timestamp: new Date(),
    description: `セル ${position.row + 1}:${position.column + 1} の書式を変更`,
    cellChanges: [cellChange],
    rowColumnOperations: [],
    metadata: {
      affectedCells: [position],
      affectedRows: [],
      affectedColumns: [],
    },
    isReversible: true,
  };
}

/**
 * 行操作の履歴エントリーを作成する関数
 */
export function createRowOperationEntry(
  operation: 'insert' | 'delete' | 'resize',
  index: number,
  count: number = 1,
  oldSize?: number,
  newSize?: number,
  removedData?: any[]
): HistoryEntry {
  let actionType: HistoryActionType;
  let description: string;

  switch (operation) {
    case 'insert':
      actionType = HistoryActionType.ROW_INSERT;
      description = `行 ${index + 1} に ${count} 行を挿入`;
      break;
    case 'delete':
      actionType = HistoryActionType.ROW_DELETE;
      description = `行 ${index + 1} から ${count} 行を削除`;
      break;
    case 'resize':
      actionType = HistoryActionType.ROW_RESIZE;
      description = `行 ${index + 1} のサイズを変更 (${oldSize}px → ${newSize}px)`;
      break;
  }

  const rowOperation: RowColumnOperation = {
    type: 'row',
    operation,
    index,
    count,
    oldSize,
    newSize,
    removedData,
  };

  return {
    id: crypto.randomUUID(),
    actionType,
    timestamp: new Date(),
    description,
    cellChanges: [],
    rowColumnOperations: [rowOperation],
    metadata: {
      affectedCells: [],
      affectedRows: Array.from({ length: count }, (_, i) => index + i),
      affectedColumns: [],
    },
    isReversible: operation !== 'delete' || !!removedData,
  };
}

/**
 * 列操作の履歴エントリーを作成する関数
 */
export function createColumnOperationEntry(
  operation: 'insert' | 'delete' | 'resize',
  index: number,
  count: number = 1,
  oldSize?: number,
  newSize?: number,
  removedData?: any[]
): HistoryEntry {
  let actionType: HistoryActionType;
  let description: string;

  switch (operation) {
    case 'insert':
      actionType = HistoryActionType.COLUMN_INSERT;
      description = `列 ${String.fromCharCode(65 + index)} に ${count} 列を挿入`;
      break;
    case 'delete':
      actionType = HistoryActionType.COLUMN_DELETE;
      description = `列 ${String.fromCharCode(65 + index)} から ${count} 列を削除`;
      break;
    case 'resize':
      actionType = HistoryActionType.COLUMN_RESIZE;
      description = `列 ${String.fromCharCode(65 + index)} のサイズを変更 (${oldSize}px → ${newSize}px)`;
      break;
  }

  const columnOperation: RowColumnOperation = {
    type: 'column',
    operation,
    index,
    count,
    oldSize,
    newSize,
    removedData,
  };

  return {
    id: crypto.randomUUID(),
    actionType,
    timestamp: new Date(),
    description,
    cellChanges: [],
    rowColumnOperations: [columnOperation],
    metadata: {
      affectedCells: [],
      affectedRows: [],
      affectedColumns: Array.from({ length: count }, (_, i) => index + i),
    },
    isReversible: operation !== 'delete' || !!removedData,
  };
}

/**
 * 一括操作（貼り付け、削除など）の履歴エントリーを作成する関数
 */
export function createBulkOperationEntry(
  actionType: HistoryActionType,
  description: string,
  cellChanges: CellChange[],
  selection?: CellSelection
): HistoryEntry {
  const affectedCells = cellChanges.map(change => change.position);

  return {
    id: crypto.randomUUID(),
    actionType,
    timestamp: new Date(),
    description,
    selection,
    cellChanges,
    rowColumnOperations: [],
    metadata: {
      affectedCells,
      affectedRows: Array.from(new Set(affectedCells.map(pos => pos.row))),
      affectedColumns: Array.from(new Set(affectedCells.map(pos => pos.column))),
    },
    isReversible: true,
  };
}

/**
 * 履歴に新しいエントリーを追加する関数
 */
export function addHistoryEntry(manager: HistoryManager, entry: HistoryEntry): HistoryManager {
  // 現在のインデックス以降のエントリーを削除（分岐した履歴を破棄）
  const newEntries = manager.entries.slice(0, manager.currentIndex + 1);
  newEntries.push(entry);

  // 最大エントリー数を超えた場合、古いエントリーを削除
  while (newEntries.length > manager.maxEntries) {
    newEntries.shift();
  }

  const newCurrentIndex = newEntries.length - 1;

  return {
    ...manager,
    entries: newEntries,
    currentIndex: newCurrentIndex,
    canUndo: newCurrentIndex >= 0,
    canRedo: false, // 新しいエントリー追加後はRedoできない
  };
}

/**
 * 元に戻す（Undo）操作を実行する関数
 */
export function performUndo(manager: HistoryManager): {
  updatedManager: HistoryManager;
  entryToUndo: HistoryEntry | null;
} {
  if (!manager.canUndo || manager.currentIndex < 0) {
    return { updatedManager: manager, entryToUndo: null };
  }

  const entryToUndo = manager.entries[manager.currentIndex];
  const newCurrentIndex = manager.currentIndex - 1;

  const updatedManager: HistoryManager = {
    ...manager,
    currentIndex: newCurrentIndex,
    canUndo: newCurrentIndex >= 0,
    canRedo: true,
  };

  return { updatedManager, entryToUndo };
}

/**
 * やり直し（Redo）操作を実行する関数
 */
export function performRedo(manager: HistoryManager): {
  updatedManager: HistoryManager;
  entryToRedo: HistoryEntry | null;
} {
  if (!manager.canRedo || manager.currentIndex >= manager.entries.length - 1) {
    return { updatedManager: manager, entryToRedo: null };
  }

  const newCurrentIndex = manager.currentIndex + 1;
  const entryToRedo = manager.entries[newCurrentIndex];

  const updatedManager: HistoryManager = {
    ...manager,
    currentIndex: newCurrentIndex,
    canUndo: true,
    canRedo: newCurrentIndex < manager.entries.length - 1,
  };

  return { updatedManager, entryToRedo };
}

/**
 * 履歴をクリアする関数
 */
export function clearHistory(manager: HistoryManager): HistoryManager {
  return {
    ...manager,
    entries: [],
    currentIndex: -1,
    canUndo: false,
    canRedo: false,
  };
}

/**
 * 履歴エントリーを元に戻すための逆操作データを生成する関数
 */
export function createUndoOperation(entry: HistoryEntry): {
  cellChanges: CellChange[];
  rowColumnOperations: RowColumnOperation[];
} {
  const undoCellChanges: CellChange[] = entry.cellChanges.map(change => ({
    ...change,
    oldValue: change.newValue,
    newValue: change.oldValue,
    oldFormat: change.newFormat,
    newFormat: change.oldFormat,
    oldDataType: change.newDataType,
    newDataType: change.oldDataType,
  }));

  const undoRowColumnOperations: RowColumnOperation[] = entry.rowColumnOperations.map(operation => {
    switch (operation.operation) {
      case 'insert':
        return { ...operation, operation: 'delete' };
      case 'delete':
        return { ...operation, operation: 'insert' };
      case 'resize':
        return {
          ...operation,
          oldSize: operation.newSize,
          newSize: operation.oldSize,
        };
      default:
        return operation;
    }
  });

  return {
    cellChanges: undoCellChanges,
    rowColumnOperations: undoRowColumnOperations,
  };
}

/**
 * 履歴の統計情報を取得する関数
 */
export function getHistoryStats(manager: HistoryManager): {
  totalEntries: number;
  currentPosition: number;
  undoCount: number;
  redoCount: number;
  memoryUsage: number;
  oldestEntry?: Date;
  newestEntry?: Date;
} {
  const totalEntries = manager.entries.length;
  const undoCount = manager.currentIndex + 1;
  const redoCount = totalEntries - undoCount;

  // メモリ使用量の概算（簡易実装）
  const memoryUsage = manager.entries.reduce((total, entry) => {
    return total + JSON.stringify(entry).length;
  }, 0);

  return {
    totalEntries,
    currentPosition: manager.currentIndex + 1,
    undoCount,
    redoCount,
    memoryUsage,
    oldestEntry: manager.entries[0]?.timestamp,
    newestEntry: manager.entries[totalEntries - 1]?.timestamp,
  };
}

/**
 * 特定の期間より古い履歴エントリーを削除する関数
 */
export function pruneOldEntries(manager: HistoryManager, olderThanHours: number = 24): HistoryManager {
  const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  const filteredEntries = manager.entries.filter(entry => entry.timestamp > cutoffTime);

  // 現在のインデックスを調整
  const removedCount = manager.entries.length - filteredEntries.length;
  const newCurrentIndex = Math.max(-1, manager.currentIndex - removedCount);

  return {
    ...manager,
    entries: filteredEntries,
    currentIndex: newCurrentIndex,
    canUndo: newCurrentIndex >= 0,
    canRedo: newCurrentIndex < filteredEntries.length - 1,
  };
}

/**
 * 履歴エントリーの詳細情報を取得する関数
 */
export function getEntryDetails(entry: HistoryEntry): {
  summary: string;
  details: string[];
  impactLevel: 'low' | 'medium' | 'high';
} {
  const details: string[] = [];
  let impactLevel: 'low' | 'medium' | 'high' = 'low';

  // セル変更の詳細
  if (entry.cellChanges.length > 0) {
    details.push(`${entry.cellChanges.length} 個のセルが変更されました`);
    if (entry.cellChanges.length > 10) {
      impactLevel = 'high';
    } else if (entry.cellChanges.length > 3) {
      impactLevel = 'medium';
    }
  }

  // 行・列操作の詳細
  if (entry.rowColumnOperations.length > 0) {
    entry.rowColumnOperations.forEach(operation => {
      const type = operation.type === 'row' ? '行' : '列';
      const action = operation.operation === 'insert' ? '挿入' :
                    operation.operation === 'delete' ? '削除' : 'サイズ変更';
      details.push(`${type}の${action}: ${operation.count || 1} 個`);
    });
    impactLevel = 'high'; // 行・列操作は常に高影響
  }

  return {
    summary: entry.description,
    details,
    impactLevel,
  };
}