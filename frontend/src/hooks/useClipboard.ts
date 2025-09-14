/**
 * useClipboard (T049) - クリップボード操作フック
 * セル範囲のコピー、切り取り、貼り付け、システムクリップボードとの連携機能を提供
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  ClipboardData,
  ClipboardCellData,
  PasteOptions,
  ClipboardOperation,
  copyToClipboard,
  cutToClipboard,
  executePaste,
  preparePasteData,
  clipboardToCSV,
  csvToClipboardData,
  isValidClipboardData,
  getClipboardInfo,
  DEFAULT_PASTE_OPTIONS,
  createEmptyClipboard
} from '../lib/clipboard';
import { CellSelection, CellPosition } from '../lib/selection';

interface UseClipboardOptions {
  enableSystemClipboard?: boolean;
  autoFormatDetection?: boolean;
  maxClipboardSize?: number;
  onClipboardChange?: (data: ClipboardData | null) => void;
  onPasteComplete?: (affectedCells: CellPosition[]) => void;
  onError?: (error: string) => void;
}

interface UseClipboardReturn {
  // 現在のクリップボード状態
  clipboardData: ClipboardData | null;
  isEmpty: boolean;
  operation: ClipboardOperation | null;
  cellCount: number;
  hasFormulas: boolean;
  hasFormatting: boolean;

  // 基本操作
  copy: (
    selection: CellSelection,
    getCellData: (position: CellPosition) => ClipboardCellData,
    spreadsheetId?: string
  ) => Promise<void>;
  cut: (
    selection: CellSelection,
    getCellData: (position: CellPosition) => ClipboardCellData,
    spreadsheetId?: string
  ) => Promise<void>;
  paste: (
    targetPosition: CellPosition,
    setCellData: (position: CellPosition, data: ClipboardCellData) => void,
    clearCell: (position: CellPosition) => void,
    options?: PasteOptions
  ) => Promise<{ success: boolean; affectedCells: CellPosition[]; errors: string[] }>;

  // システムクリップボード操作
  copyToSystemClipboard: () => Promise<void>;
  pasteFromSystemClipboard: (targetPosition: CellPosition) => Promise<void>;

  // 特殊貼り付け
  pasteSpecial: (
    targetPosition: CellPosition,
    setCellData: (position: CellPosition, data: ClipboardCellData) => void,
    clearCell: (position: CellPosition) => void,
    options: PasteOptions
  ) => Promise<{ success: boolean; affectedCells: CellPosition[]; errors: string[] }>;

  // クリップボード管理
  clearClipboard: () => void;
  isValidData: () => boolean;
  getClipboardStats: () => {
    isEmpty: boolean;
    operation: string;
    cellCount: number;
    size: string;
    hasFormulas: boolean;
    hasFormatting: boolean;
  };

  // フォーマット操作
  exportAsCSV: () => string;
  importFromCSV: (csv: string, sourcePosition: CellPosition) => void;

  // プレビュー機能
  getPreviewData: (rows?: number, columns?: number) => ClipboardCellData[][];
  canPaste: () => boolean;
}

const DEFAULT_OPTIONS: UseClipboardOptions = {
  enableSystemClipboard: true,
  autoFormatDetection: true,
  maxClipboardSize: 10000, // 最大10,000セル
};

export function useClipboard(options: UseClipboardOptions = {}): UseClipboardReturn {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  // 状態管理
  const [clipboardData, setClipboardData] = useState<ClipboardData | null>(null);
  const systemClipboardRef = useRef<string>('');

  // 計算されたプロパティ
  const isEmpty = useMemo(() => !clipboardData, [clipboardData]);
  const operation = useMemo(() => clipboardData?.operation || null, [clipboardData]);
  const cellCount = useMemo(() =>
    clipboardData ? clipboardData.metadata.rowCount * clipboardData.metadata.columnCount : 0,
    [clipboardData]
  );
  const hasFormulas = useMemo(() => clipboardData?.metadata.hasFormulas || false, [clipboardData]);
  const hasFormatting = useMemo(() => clipboardData?.metadata.hasFormatting || false, [clipboardData]);

  // コピー操作
  const copy = useCallback(async (
    selection: CellSelection,
    getCellData: (position: CellPosition) => ClipboardCellData,
    spreadsheetId?: string
  ) => {
    try {
      const data = copyToClipboard(selection, getCellData, spreadsheetId);

      // サイズ制限チェック
      if (data.metadata.rowCount * data.metadata.columnCount > (mergedOptions.maxClipboardSize || 10000)) {
        throw new Error(`クリップボードのサイズが上限（${mergedOptions.maxClipboardSize}セル）を超えています`);
      }

      setClipboardData(data);

      // システムクリップボードに書き込み
      if (mergedOptions.enableSystemClipboard) {
        const csvData = clipboardToCSV(data);
        systemClipboardRef.current = csvData;

        if (navigator.clipboard) {
          await navigator.clipboard.writeText(csvData);
        }
      }

      if (mergedOptions.onClipboardChange) {
        mergedOptions.onClipboardChange(data);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'コピーエラー';
      if (mergedOptions.onError) {
        mergedOptions.onError(errorMessage);
      }
      throw error;
    }
  }, [mergedOptions]);

  // 切り取り操作
  const cut = useCallback(async (
    selection: CellSelection,
    getCellData: (position: CellPosition) => ClipboardCellData,
    spreadsheetId?: string
  ) => {
    try {
      const data = cutToClipboard(selection, getCellData, spreadsheetId);

      // サイズ制限チェック
      if (data.metadata.rowCount * data.metadata.columnCount > (mergedOptions.maxClipboardSize || 10000)) {
        throw new Error(`クリップボードのサイズが上限（${mergedOptions.maxClipboardSize}セル）を超えています`);
      }

      setClipboardData(data);

      // システムクリップボードに書き込み
      if (mergedOptions.enableSystemClipboard) {
        const csvData = clipboardToCSV(data);
        systemClipboardRef.current = csvData;

        if (navigator.clipboard) {
          await navigator.clipboard.writeText(csvData);
        }
      }

      if (mergedOptions.onClipboardChange) {
        mergedOptions.onClipboardChange(data);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '切り取りエラー';
      if (mergedOptions.onError) {
        mergedOptions.onError(errorMessage);
      }
      throw error;
    }
  }, [mergedOptions]);

  // 貼り付け操作
  const paste = useCallback(async (
    targetPosition: CellPosition,
    setCellData: (position: CellPosition, data: ClipboardCellData) => void,
    clearCell: (position: CellPosition) => void,
    options: PasteOptions = DEFAULT_PASTE_OPTIONS
  ) => {
    if (!clipboardData) {
      return { success: false, affectedCells: [], errors: ['クリップボードが空です'] };
    }

    try {
      const result = executePaste(clipboardData, targetPosition, setCellData, clearCell, options);

      if (result.success && mergedOptions.onPasteComplete) {
        mergedOptions.onPasteComplete(result.affectedCells);
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '貼り付けエラー';
      if (mergedOptions.onError) {
        mergedOptions.onError(errorMessage);
      }
      return { success: false, affectedCells: [], errors: [errorMessage] };
    }
  }, [clipboardData, mergedOptions]);

  // システムクリップボードにコピー
  const copyToSystemClipboard = useCallback(async () => {
    if (!clipboardData || !mergedOptions.enableSystemClipboard) {
      return;
    }

    try {
      const csvData = clipboardToCSV(clipboardData);
      systemClipboardRef.current = csvData;

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(csvData);
      } else {
        // フォールバック: execCommandを使用
        const textArea = document.createElement('textarea');
        textArea.value = csvData;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'システムクリップボードへのコピーエラー';
      if (mergedOptions.onError) {
        mergedOptions.onError(errorMessage);
      }
      throw error;
    }
  }, [clipboardData, mergedOptions]);

  // システムクリップボードから貼り付け
  const pasteFromSystemClipboard = useCallback(async (targetPosition: CellPosition) => {
    if (!mergedOptions.enableSystemClipboard) {
      return;
    }

    try {
      let clipboardText = '';

      if (navigator.clipboard) {
        clipboardText = await navigator.clipboard.readText();
      } else {
        // フォールバック: 現在保存されているテキストを使用
        clipboardText = systemClipboardRef.current;
      }

      if (clipboardText) {
        const data = csvToClipboardData(clipboardText, targetPosition);
        setClipboardData(data);

        if (mergedOptions.onClipboardChange) {
          mergedOptions.onClipboardChange(data);
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'システムクリップボードからの貼り付けエラー';
      if (mergedOptions.onError) {
        mergedOptions.onError(errorMessage);
      }
      throw error;
    }
  }, [mergedOptions, targetPosition]);

  // 特殊貼り付け
  const pasteSpecial = useCallback(async (
    targetPosition: CellPosition,
    setCellData: (position: CellPosition, data: ClipboardCellData) => void,
    clearCell: (position: CellPosition) => void,
    options: PasteOptions
  ) => {
    return await paste(targetPosition, setCellData, clearCell, options);
  }, [paste]);

  // クリップボードをクリア
  const clearClipboard = useCallback(() => {
    setClipboardData(null);
    systemClipboardRef.current = '';

    if (mergedOptions.onClipboardChange) {
      mergedOptions.onClipboardChange(null);
    }
  }, [mergedOptions]);

  // データの妥当性確認
  const isValidData = useCallback(() => {
    return isValidClipboardData(clipboardData);
  }, [clipboardData]);

  // クリップボードの統計情報を取得
  const getClipboardStats = useCallback(() => {
    return getClipboardInfo(clipboardData);
  }, [clipboardData]);

  // CSVとしてエクスポート
  const exportAsCSV = useCallback(() => {
    if (!clipboardData) return '';
    return clipboardToCSV(clipboardData);
  }, [clipboardData]);

  // CSVからインポート
  const importFromCSV = useCallback((csv: string, sourcePosition: CellPosition) => {
    try {
      const data = csvToClipboardData(csv, sourcePosition);
      setClipboardData(data);

      if (mergedOptions.onClipboardChange) {
        mergedOptions.onClipboardChange(data);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'CSVインポートエラー';
      if (mergedOptions.onError) {
        mergedOptions.onError(errorMessage);
      }
      throw error;
    }
  }, [mergedOptions]);

  // プレビューデータを取得
  const getPreviewData = useCallback((rows: number = 5, columns: number = 5) => {
    if (!clipboardData) return [];

    const previewData: ClipboardCellData[][] = [];
    const maxRows = Math.min(rows, clipboardData.cellData.length);

    for (let i = 0; i < maxRows; i++) {
      const row = clipboardData.cellData[i];
      const maxCols = Math.min(columns, row.length);
      previewData.push(row.slice(0, maxCols));
    }

    return previewData;
  }, [clipboardData]);

  // 貼り付け可能かチェック
  const canPaste = useCallback(() => {
    return isValidData() && clipboardData !== null;
  }, [isValidData, clipboardData]);

  // クリップボードデータの有効期限チェック
  useEffect(() => {
    if (!clipboardData) return;

    const checkExpiration = () => {
      if (!isValidClipboardData(clipboardData)) {
        setClipboardData(null);
        if (mergedOptions.onClipboardChange) {
          mergedOptions.onClipboardChange(null);
        }
      }
    };

    // 5分ごとに有効期限をチェック
    const intervalId = setInterval(checkExpiration, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [clipboardData, mergedOptions]);

  // システムクリップボード監視（可能な場合）
  useEffect(() => {
    if (!mergedOptions.enableSystemClipboard) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && navigator.clipboard) {
        try {
          const text = await navigator.clipboard.readText();
          if (text !== systemClipboardRef.current) {
            // システムクリップボードが外部で変更された場合の処理
            systemClipboardRef.current = text;
          }
        } catch (error) {
          // クリップボードアクセス権限がない場合は無視
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [mergedOptions.enableSystemClipboard]);

  return {
    // 現在のクリップボード状態
    clipboardData,
    isEmpty,
    operation,
    cellCount,
    hasFormulas,
    hasFormatting,

    // 基本操作
    copy,
    cut,
    paste,

    // システムクリップボード操作
    copyToSystemClipboard,
    pasteFromSystemClipboard,

    // 特殊貼り付け
    pasteSpecial,

    // クリップボード管理
    clearClipboard,
    isValidData,
    getClipboardStats,

    // フォーマット操作
    exportAsCSV,
    importFromCSV,

    // プレビュー機能
    getPreviewData,
    canPaste,
  };
}