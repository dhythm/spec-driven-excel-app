/**
 * useSpreadsheet (T045) - スプレッドシート状態管理フック
 * スプレッドシート全体の状態管理、作成、更新、保存機能を提供
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Spreadsheet,
  SpreadsheetConfig,
  createSpreadsheet,
  setCellInSpreadsheet,
  getCellFromSpreadsheet,
  validateSpreadsheet,
  DEFAULT_SPREADSHEET_CONFIG
} from '../lib/spreadsheet';
import { Cell, CellPosition, createEmptyCell } from '../lib/cell';
import { StorageManager } from '../lib/storage-manager';
import { initializeFormulaEngine, evaluateFormula, updateFormulaValue } from '../lib/formula-engine';

interface UseSpreadsheetOptions {
  config?: SpreadsheetConfig;
  autoSave?: boolean;
  autoSaveInterval?: number;
  storageKey?: string;
}

interface UseSpreadsheetReturn {
  // 状態
  spreadsheet: Spreadsheet;
  isLoading: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  validationErrors: string[];

  // 基本操作
  createNew: (name?: string) => Promise<void>;
  loadSpreadsheet: (id: string) => Promise<void>;
  saveSpreadsheet: () => Promise<void>;

  // セル操作
  setCell: (position: CellPosition, cell: Cell) => void;
  getCell: (position: CellPosition) => Cell | undefined;
  getCellValue: (position: CellPosition) => string;

  // メタデータ操作
  updateName: (name: string) => void;
  addRow: (index?: number) => void;
  removeRow: (index: number) => void;
  addColumn: (index?: number) => void;
  removeColumn: (index: number) => void;

  // その他
  validate: () => boolean;
  exportToCsv: () => string;
  reset: () => void;
}

const DEFAULT_OPTIONS: UseSpreadsheetOptions = {
  config: DEFAULT_SPREADSHEET_CONFIG,
  autoSave: true,
  autoSaveInterval: 30000, // 30秒
  storageKey: 'current-spreadsheet',
};

export function useSpreadsheet(options: UseSpreadsheetOptions = {}): UseSpreadsheetReturn {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const storageManager = useMemo(() => new StorageManager(), []);
  const [formulaEngine, setFormulaEngine] = useState<any>(null);

  // 状態管理
  const [spreadsheet, setSpreadsheet] = useState<Spreadsheet>(() =>
    createSpreadsheet('新規スプレッドシート', mergedOptions.config)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // バリデーション実行
  const validate = useCallback(() => {
    const result = validateSpreadsheet(spreadsheet);
    setValidationErrors(result.errors);
    return result.isValid;
  }, [spreadsheet]);

  // 新しいスプレッドシートを作成
  const createNew = useCallback(async (name?: string) => {
    setIsLoading(true);
    try {
      const newSpreadsheet = createSpreadsheet(
        name || '新規スプレッドシート',
        mergedOptions.config
      );
      setSpreadsheet(newSpreadsheet);
      setHasUnsavedChanges(false);
      setValidationErrors([]);
    } catch (error) {
      console.error('スプレッドシート作成エラー:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [mergedOptions.config]);

  // スプレッドシートを読み込み
  const loadSpreadsheet = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const loadedSpreadsheet = await storageManager.loadSpreadsheet(id);
      if (loadedSpreadsheet) {
        setSpreadsheet(loadedSpreadsheet);
        setHasUnsavedChanges(false);
        setValidationErrors([]);
      } else {
        throw new Error('スプレッドシートが見つかりません');
      }
    } catch (error) {
      console.error('スプレッドシート読み込みエラー:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [storageManager]);

  // スプレッドシートを保存
  const saveSpreadsheet = useCallback(async () => {
    if (!validate()) {
      throw new Error('バリデーションエラーがあるため保存できません');
    }

    setIsSaving(true);
    try {
      await storageManager.saveSpreadsheet(spreadsheet);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('スプレッドシート保存エラー:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [spreadsheet, validate, storageManager]);

  // セルを設定（数式対応）
  const setCell = useCallback(async (position: CellPosition, cell: Cell) => {
    try {
      let finalCell = { ...cell };

      // 数式の場合は計算結果を取得
      if (cell.rawValue && typeof cell.rawValue === 'string' && cell.rawValue.startsWith('=')) {
        if (formulaEngine) {
          const evalResult = await evaluateFormula(cell.rawValue, spreadsheet);
          if (evalResult.success && evalResult.data) {
            finalCell.displayValue = String(evalResult.data.value);
            finalCell.dataType = evalResult.data.dataType;
            // rawValueは数式のまま保持
          }
        }
      }

      const updatedSpreadsheet = setCellInSpreadsheet(spreadsheet, position, finalCell);
      setSpreadsheet(updatedSpreadsheet);
      setHasUnsavedChanges(true);

      // 数式エンジンを更新
      if (formulaEngine && cell.rawValue && typeof cell.rawValue === 'string' && cell.rawValue.startsWith('=')) {
        const address = `${String.fromCharCode(65 + position.column)}${position.row + 1}`;
        await updateFormulaValue(address, cell.rawValue, updatedSpreadsheet);
      }
    } catch (error) {
      console.error('セル設定エラー:', error);
      throw error;
    }
  }, [spreadsheet, formulaEngine]);

  // セルを取得
  const getCell = useCallback((position: CellPosition) => {
    return getCellFromSpreadsheet(spreadsheet, position);
  }, [spreadsheet]);

  // セルの値を取得
  const getCellValue = useCallback((position: CellPosition) => {
    const cell = getCellFromSpreadsheet(spreadsheet, position);
    return cell?.displayValue || '';
  }, [spreadsheet]);

  // スプレッドシート名を更新
  const updateName = useCallback((name: string) => {
    setSpreadsheet(prev => ({
      ...prev,
      name,
      updatedAt: new Date()
    }));
    setHasUnsavedChanges(true);
  }, []);

  // 行を追加
  const addRow = useCallback((index?: number) => {
    setSpreadsheet(prev => {
      const insertIndex = index ?? prev.rowCount;
      const newRows = [...prev.rows];

      // 新しい行を挿入
      newRows.splice(insertIndex, 0, {
        index: insertIndex,
        height: mergedOptions.config?.defaultRowHeight || 20,
        isVisible: true,
      });

      // インデックスを更新
      for (let i = insertIndex + 1; i < newRows.length; i++) {
        newRows[i] = { ...newRows[i], index: i };
      }

      return {
        ...prev,
        rows: newRows,
        rowCount: newRows.length,
        updatedAt: new Date()
      };
    });
    setHasUnsavedChanges(true);
  }, [mergedOptions.config]);

  // 行を削除
  const removeRow = useCallback((index: number) => {
    setSpreadsheet(prev => {
      if (index < 0 || index >= prev.rowCount) {
        throw new Error('無効な行インデックスです');
      }

      const newRows = prev.rows.filter((_, i) => i !== index);
      const newCells = new Map(prev.cells);

      // 削除された行のセルを除去
      for (const [key, cell] of prev.cells) {
        if (cell.position.row === index) {
          newCells.delete(key);
        } else if (cell.position.row > index) {
          // 行インデックスを調整
          newCells.delete(key);
          const updatedCell = {
            ...cell,
            position: { ...cell.position, row: cell.position.row - 1 }
          };
          const newKey = `${updatedCell.position.row}-${updatedCell.position.column}`;
          newCells.set(newKey, updatedCell);
        }
      }

      // インデックスを更新
      for (let i = 0; i < newRows.length; i++) {
        newRows[i] = { ...newRows[i], index: i };
      }

      return {
        ...prev,
        rows: newRows,
        cells: newCells,
        rowCount: newRows.length,
        updatedAt: new Date()
      };
    });
    setHasUnsavedChanges(true);
  }, []);

  // 列を追加
  const addColumn = useCallback((index?: number) => {
    setSpreadsheet(prev => {
      const insertIndex = index ?? prev.columnCount;
      const newColumns = [...prev.columns];

      // 新しい列を挿入
      newColumns.splice(insertIndex, 0, {
        index: insertIndex,
        width: mergedOptions.config?.defaultColumnWidth || 100,
        isVisible: true,
        header: String.fromCharCode(65 + insertIndex), // A, B, C, ...
      });

      // インデックスとヘッダーを更新
      for (let i = insertIndex + 1; i < newColumns.length; i++) {
        newColumns[i] = {
          ...newColumns[i],
          index: i,
          header: String.fromCharCode(65 + i)
        };
      }

      return {
        ...prev,
        columns: newColumns,
        columnCount: newColumns.length,
        updatedAt: new Date()
      };
    });
    setHasUnsavedChanges(true);
  }, [mergedOptions.config]);

  // 列を削除
  const removeColumn = useCallback((index: number) => {
    setSpreadsheet(prev => {
      if (index < 0 || index >= prev.columnCount) {
        throw new Error('無効な列インデックスです');
      }

      const newColumns = prev.columns.filter((_, i) => i !== index);
      const newCells = new Map(prev.cells);

      // 削除された列のセルを除去
      for (const [key, cell] of prev.cells) {
        if (cell.position.column === index) {
          newCells.delete(key);
        } else if (cell.position.column > index) {
          // 列インデックスを調整
          newCells.delete(key);
          const updatedCell = {
            ...cell,
            position: { ...cell.position, column: cell.position.column - 1 }
          };
          const newKey = `${updatedCell.position.row}-${updatedCell.position.column}`;
          newCells.set(newKey, updatedCell);
        }
      }

      // インデックスとヘッダーを更新
      for (let i = 0; i < newColumns.length; i++) {
        newColumns[i] = {
          ...newColumns[i],
          index: i,
          header: String.fromCharCode(65 + i)
        };
      }

      return {
        ...prev,
        columns: newColumns,
        cells: newCells,
        columnCount: newColumns.length,
        updatedAt: new Date()
      };
    });
    setHasUnsavedChanges(true);
  }, []);

  // CSV エクスポート
  const exportToCsv = useCallback(() => {
    const csvRows: string[] = [];

    for (let rowIndex = 0; rowIndex < spreadsheet.rowCount; rowIndex++) {
      const csvCells: string[] = [];

      for (let colIndex = 0; colIndex < spreadsheet.columnCount; colIndex++) {
        const cell = getCellFromSpreadsheet(spreadsheet, { row: rowIndex, column: colIndex });
        const cellValue = cell?.displayValue || '';

        // CSV形式にエスケープ処理
        const escapedValue = cellValue.includes(',') || cellValue.includes('"') || cellValue.includes('\n')
          ? `"${cellValue.replace(/"/g, '""')}"`
          : cellValue;

        csvCells.push(escapedValue);
      }

      csvRows.push(csvCells.join(','));
    }

    return csvRows.join('\n');
  }, [spreadsheet]);

  // 状態をリセット
  const reset = useCallback(() => {
    const newSpreadsheet = createSpreadsheet('新規スプレッドシート', mergedOptions.config);
    setSpreadsheet(newSpreadsheet);
    setHasUnsavedChanges(false);
    setValidationErrors([]);
    setIsLoading(false);
    setIsSaving(false);
  }, [mergedOptions.config]);

  // 数式エンジンの初期化
  useEffect(() => {
    const initEngine = async () => {
      if (!formulaEngine) {
        const engine = await initializeFormulaEngine();
        setFormulaEngine(engine);
      }
    };
    initEngine();
  }, [formulaEngine]);

  // 自動保存機能
  useEffect(() => {
    if (!mergedOptions.autoSave || !hasUnsavedChanges || isSaving) {
      return;
    }

    const autoSaveTimer = setTimeout(() => {
      saveSpreadsheet().catch(error => {
        console.error('自動保存エラー:', error);
      });
    }, mergedOptions.autoSaveInterval);

    return () => clearTimeout(autoSaveTimer);
  }, [hasUnsavedChanges, isSaving, saveSpreadsheet, mergedOptions.autoSave, mergedOptions.autoSaveInterval]);

  return {
    // 状態
    spreadsheet,
    isLoading,
    isSaving,
    hasUnsavedChanges,
    validationErrors,

    // 基本操作
    createNew,
    loadSpreadsheet,
    saveSpreadsheet,

    // セル操作
    setCell,
    getCell,
    getCellValue,

    // メタデータ操作
    updateName,
    addRow,
    removeRow,
    addColumn,
    removeColumn,

    // その他
    validate,
    exportToCsv,
    reset,
  };
}