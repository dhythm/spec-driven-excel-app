/**
 * useHistory (T050) - アンドゥ/リドゥ機能フック
 * 操作履歴の管理、元に戻す、やり直し機能を提供
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  HistoryManager,
  HistoryEntry,
  HistoryActionType,
  CellChange,
  RowColumnOperation,
  createHistoryManager,
  createCellValueChangeEntry,
  createCellFormatChangeEntry,
  createRowOperationEntry,
  createColumnOperationEntry,
  createBulkOperationEntry,
  addHistoryEntry,
  performUndo,
  performRedo,
  clearHistory,
  createUndoOperation,
  getHistoryStats,
  pruneOldEntries,
  getEntryDetails,
  DEFAULT_MAX_HISTORY_ENTRIES
} from '../lib/history';
import { CellPosition } from '../lib/cell';
import { CellSelection } from '../lib/selection';

interface UseHistoryOptions {
  maxEntries?: number;
  autoPrune?: boolean;
  pruneIntervalHours?: number;
  onUndo?: (entry: HistoryEntry) => void;
  onRedo?: (entry: HistoryEntry) => void;
  onHistoryChange?: (manager: HistoryManager) => void;
  enableKeyboardShortcuts?: boolean;
}

interface UseHistoryReturn {
  // 現在の状態
  historyManager: HistoryManager;
  canUndo: boolean;
  canRedo: boolean;
  currentIndex: number;
  totalEntries: number;

  // 基本操作
  undo: () => Promise<HistoryEntry | null>;
  redo: () => Promise<HistoryEntry | null>;
  clear: () => void;

  // エントリー追加
  addCellValueChange: (
    position: CellPosition,
    oldValue: string,
    newValue: string,
    oldDataType?: string,
    newDataType?: string
  ) => void;
  addCellFormatChange: (position: CellPosition, oldFormat: any, newFormat: any) => void;
  addRowOperation: (
    operation: 'insert' | 'delete' | 'resize',
    index: number,
    count?: number,
    oldSize?: number,
    newSize?: number,
    removedData?: any[]
  ) => void;
  addColumnOperation: (
    operation: 'insert' | 'delete' | 'resize',
    index: number,
    count?: number,
    oldSize?: number,
    newSize?: number,
    removedData?: any[]
  ) => void;
  addBulkOperation: (
    actionType: HistoryActionType,
    description: string,
    cellChanges: CellChange[],
    selection?: CellSelection
  ) => void;

  // 情報取得
  getStats: () => {
    totalEntries: number;
    currentPosition: number;
    undoCount: number;
    redoCount: number;
    memoryUsage: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  };
  getEntryInfo: (index: number) => {
    summary: string;
    details: string[];
    impactLevel: 'low' | 'medium' | 'high';
  } | null;
  getAllEntries: () => HistoryEntry[];
  getCurrentEntry: () => HistoryEntry | null;

  // キーボードハンドリング
  handleKeyDown: (event: KeyboardEvent) => void;

  // メンテナンス
  pruneOldEntries: (olderThanHours?: number) => void;
  getMemoryUsage: () => number;

  // バッチ操作
  startBatch: () => void;
  endBatch: (description: string) => void;
  isBatching: boolean;
}

const DEFAULT_OPTIONS: UseHistoryOptions = {
  maxEntries: DEFAULT_MAX_HISTORY_ENTRIES,
  autoPrune: true,
  pruneIntervalHours: 24,
  enableKeyboardShortcuts: true,
};

export function useHistory(options: UseHistoryOptions = {}): UseHistoryReturn {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  // 状態管理
  const [historyManager, setHistoryManager] = useState<HistoryManager>(() =>
    createHistoryManager(mergedOptions.maxEntries)
  );
  const [batchChanges, setBatchChanges] = useState<CellChange[]>([]);
  const [isBatching, setIsBatching] = useState(false);
  const lastPruneTime = useRef(Date.now());

  // 計算されたプロパティ
  const canUndo = historyManager.canUndo;
  const canRedo = historyManager.canRedo;
  const currentIndex = historyManager.currentIndex;
  const totalEntries = historyManager.entries.length;

  // エントリー追加の共通処理
  const addEntry = useCallback((entry: HistoryEntry) => {
    // バッチ処理中の場合は蓄積
    if (isBatching && entry.actionType === HistoryActionType.CELL_VALUE_CHANGE) {
      setBatchChanges(prev => [...prev, ...entry.cellChanges]);
      return;
    }

    const newManager = addHistoryEntry(historyManager, entry);
    setHistoryManager(newManager);

    if (mergedOptions.onHistoryChange) {
      mergedOptions.onHistoryChange(newManager);
    }
  }, [historyManager, isBatching, mergedOptions]);

  // アンドゥ実行
  const undo = useCallback(async (): Promise<HistoryEntry | null> => {
    const { updatedManager, entryToUndo } = performUndo(historyManager);

    if (entryToUndo) {
      setHistoryManager(updatedManager);

      if (mergedOptions.onUndo) {
        mergedOptions.onUndo(entryToUndo);
      }

      if (mergedOptions.onHistoryChange) {
        mergedOptions.onHistoryChange(updatedManager);
      }
    }

    return entryToUndo;
  }, [historyManager, mergedOptions]);

  // リドゥ実行
  const redo = useCallback(async (): Promise<HistoryEntry | null> => {
    const { updatedManager, entryToRedo } = performRedo(historyManager);

    if (entryToRedo) {
      setHistoryManager(updatedManager);

      if (mergedOptions.onRedo) {
        mergedOptions.onRedo(entryToRedo);
      }

      if (mergedOptions.onHistoryChange) {
        mergedOptions.onHistoryChange(updatedManager);
      }
    }

    return entryToRedo;
  }, [historyManager, mergedOptions]);

  // 履歴をクリア
  const clear = useCallback(() => {
    const newManager = clearHistory(historyManager);
    setHistoryManager(newManager);

    if (mergedOptions.onHistoryChange) {
      mergedOptions.onHistoryChange(newManager);
    }
  }, [historyManager, mergedOptions]);

  // セル値変更エントリー追加
  const addCellValueChange = useCallback((
    position: CellPosition,
    oldValue: string,
    newValue: string,
    oldDataType?: string,
    newDataType?: string
  ) => {
    const entry = createCellValueChangeEntry(position, oldValue, newValue, oldDataType, newDataType);
    addEntry(entry);
  }, [addEntry]);

  // セル書式変更エントリー追加
  const addCellFormatChange = useCallback((
    position: CellPosition,
    oldFormat: any,
    newFormat: any
  ) => {
    const entry = createCellFormatChangeEntry(position, oldFormat, newFormat);
    addEntry(entry);
  }, [addEntry]);

  // 行操作エントリー追加
  const addRowOperation = useCallback((
    operation: 'insert' | 'delete' | 'resize',
    index: number,
    count: number = 1,
    oldSize?: number,
    newSize?: number,
    removedData?: any[]
  ) => {
    const entry = createRowOperationEntry(operation, index, count, oldSize, newSize, removedData);
    addEntry(entry);
  }, [addEntry]);

  // 列操作エントリー追加
  const addColumnOperation = useCallback((
    operation: 'insert' | 'delete' | 'resize',
    index: number,
    count: number = 1,
    oldSize?: number,
    newSize?: number,
    removedData?: any[]
  ) => {
    const entry = createColumnOperationEntry(operation, index, count, oldSize, newSize, removedData);
    addEntry(entry);
  }, [addEntry]);

  // 一括操作エントリー追加
  const addBulkOperation = useCallback((
    actionType: HistoryActionType,
    description: string,
    cellChanges: CellChange[],
    selection?: CellSelection
  ) => {
    const entry = createBulkOperationEntry(actionType, description, cellChanges, selection);
    addEntry(entry);
  }, [addEntry]);

  // 統計情報取得
  const getStats = useCallback(() => {
    return getHistoryStats(historyManager);
  }, [historyManager]);

  // エントリー詳細情報取得
  const getEntryInfo = useCallback((index: number) => {
    if (index < 0 || index >= historyManager.entries.length) {
      return null;
    }
    return getEntryDetails(historyManager.entries[index]);
  }, [historyManager]);

  // 全エントリー取得
  const getAllEntries = useCallback(() => {
    return [...historyManager.entries];
  }, [historyManager]);

  // 現在のエントリー取得
  const getCurrentEntry = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < historyManager.entries.length) {
      return historyManager.entries[currentIndex];
    }
    return null;
  }, [currentIndex, historyManager]);

  // キーボードイベント処理
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!mergedOptions.enableKeyboardShortcuts) return;

    const { key, ctrlKey, metaKey } = event;
    const isCommandKey = ctrlKey || metaKey;

    if (isCommandKey) {
      switch (key.toLowerCase()) {
        case 'z':
          event.preventDefault();
          if (event.shiftKey) {
            // Ctrl+Shift+Z: Redo
            redo();
          } else {
            // Ctrl+Z: Undo
            undo();
          }
          break;

        case 'y':
          // Ctrl+Y: Redo (Windowsスタイル)
          event.preventDefault();
          redo();
          break;
      }
    }
  }, [mergedOptions.enableKeyboardShortcuts, undo, redo]);

  // 古いエントリーの削除
  const pruneOldEntriesManually = useCallback((olderThanHours: number = 24) => {
    const newManager = pruneOldEntries(historyManager, olderThanHours);
    if (newManager.entries.length !== historyManager.entries.length) {
      setHistoryManager(newManager);

      if (mergedOptions.onHistoryChange) {
        mergedOptions.onHistoryChange(newManager);
      }
    }
  }, [historyManager, mergedOptions]);

  // メモリ使用量取得
  const getMemoryUsage = useCallback(() => {
    return getStats().memoryUsage;
  }, [getStats]);

  // バッチ処理開始
  const startBatch = useCallback(() => {
    setIsBatching(true);
    setBatchChanges([]);
  }, []);

  // バッチ処理終了
  const endBatch = useCallback((description: string) => {
    if (isBatching && batchChanges.length > 0) {
      const entry = createBulkOperationEntry(
        HistoryActionType.BULK_OPERATION,
        description,
        batchChanges
      );

      const newManager = addHistoryEntry(historyManager, entry);
      setHistoryManager(newManager);

      if (mergedOptions.onHistoryChange) {
        mergedOptions.onHistoryChange(newManager);
      }
    }

    setIsBatching(false);
    setBatchChanges([]);
  }, [isBatching, batchChanges, historyManager, mergedOptions]);

  // キーボードイベントリスナー
  useEffect(() => {
    if (mergedOptions.enableKeyboardShortcuts) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, mergedOptions.enableKeyboardShortcuts]);

  // 自動プルーニング
  useEffect(() => {
    if (!mergedOptions.autoPrune) return;

    const now = Date.now();
    const intervalMs = (mergedOptions.pruneIntervalHours || 24) * 60 * 60 * 1000;

    if (now - lastPruneTime.current > intervalMs) {
      pruneOldEntriesManually(mergedOptions.pruneIntervalHours);
      lastPruneTime.current = now;
    }

    // 定期的なプルーニングタイマー
    const timerId = setInterval(() => {
      pruneOldEntriesManually(mergedOptions.pruneIntervalHours);
      lastPruneTime.current = Date.now();
    }, intervalMs);

    return () => clearInterval(timerId);
  }, [mergedOptions.autoPrune, mergedOptions.pruneIntervalHours, pruneOldEntriesManually]);

  return {
    // 現在の状態
    historyManager,
    canUndo,
    canRedo,
    currentIndex,
    totalEntries,

    // 基本操作
    undo,
    redo,
    clear,

    // エントリー追加
    addCellValueChange,
    addCellFormatChange,
    addRowOperation,
    addColumnOperation,
    addBulkOperation,

    // 情報取得
    getStats,
    getEntryInfo,
    getAllEntries,
    getCurrentEntry,

    // キーボードハンドリング
    handleKeyDown,

    // メンテナンス
    pruneOldEntries: pruneOldEntriesManually,
    getMemoryUsage,

    // バッチ操作
    startBatch,
    endBatch,
    isBatching,
  };
}