/**
 * useCell (T046) - セル操作フック
 * 個別セルの値操作、書式設定、バリデーション機能を提供
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Cell,
  CellPosition,
  CellFormat,
  CellDataType,
  createEmptyCell,
  updateCellValue,
  updateCellFormat,
  validateCellData,
  determineCellDataType,
  calculateDisplayValue,
  DEFAULT_CELL_FORMAT
} from '../lib/cell';
import { parseFormula, validateFormula } from '../lib/formula';

interface UseCellOptions {
  initialCell?: Cell;
  onChange?: (cell: Cell) => void;
  onValidationError?: (error: string) => void;
  autoCalculateDisplay?: boolean;
  validateOnChange?: boolean;
}

interface UseCellReturn {
  // 現在の状態
  cell: Cell;
  isValid: boolean;
  validationError: string | undefined;
  isEditing: boolean;
  hasChanges: boolean;

  // 値操作
  setValue: (value: string) => void;
  setDisplayValue: (value: string) => void;
  clearValue: () => void;

  // 書式操作
  setFormat: (format: Partial<CellFormat>) => void;
  resetFormat: () => void;
  applyNumberFormat: (type: 'integer' | 'decimal' | 'percentage' | 'currency', decimalPlaces?: number) => void;
  applyDateFormat: (format: string) => void;

  // データ型操作
  setDataType: (dataType: CellDataType) => void;
  autoDetectDataType: () => void;

  // 編集状態
  startEditing: () => void;
  stopEditing: () => void;
  commitChanges: () => void;
  discardChanges: () => void;

  // バリデーション
  validate: () => boolean;

  // その他
  focus: () => void;
  blur: () => void;
  getA1Notation: () => string;
  clone: () => Cell;
  reset: () => void;
}

const DEFAULT_OPTIONS: UseCellOptions = {
  autoCalculateDisplay: true,
  validateOnChange: true,
};

export function useCell(
  position: CellPosition,
  options: UseCellOptions = {}
): UseCellReturn {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  // 状態管理
  const [cell, setCell] = useState<Cell>(() =>
    mergedOptions.initialCell || createEmptyCell(position)
  );
  const [originalCell, setOriginalCell] = useState<Cell>(cell);
  const [isEditing, setIsEditing] = useState(false);
  const [validationError, setValidationError] = useState<string | undefined>();

  // 計算されたプロパティ
  const isValid = useMemo(() => validationError === undefined, [validationError]);
  const hasChanges = useMemo(() =>
    JSON.stringify(cell) !== JSON.stringify(originalCell),
    [cell, originalCell]
  );

  // バリデーション実行
  const validate = useCallback(() => {
    const result = validateCellData(cell);
    setValidationError(result.isValid ? undefined : result.error);

    // 数式の場合は追加バリデーション
    if (cell.dataType === CellDataType.FORMULA) {
      const formulaResult = validateFormula(cell.rawValue);
      if (!formulaResult.isValid && formulaResult.errors.length > 0) {
        setValidationError(formulaResult.errors[0].message);
        return false;
      }
    }

    if (!result.isValid && mergedOptions.onValidationError) {
      mergedOptions.onValidationError(result.error || 'バリデーションエラー');
    }

    return result.isValid;
  }, [cell, mergedOptions]);

  // 値を設定
  const setValue = useCallback((value: string) => {
    const updatedCell = updateCellValue(cell, value);
    setCell(updatedCell);

    if (mergedOptions.validateOnChange) {
      setTimeout(() => validate(), 0);
    }

    if (mergedOptions.onChange) {
      mergedOptions.onChange(updatedCell);
    }
  }, [cell, validate, mergedOptions]);

  // 表示値を直接設定
  const setDisplayValue = useCallback((value: string) => {
    const updatedCell = {
      ...cell,
      displayValue: value,
      lastModified: new Date()
    };
    setCell(updatedCell);

    if (mergedOptions.onChange) {
      mergedOptions.onChange(updatedCell);
    }
  }, [cell, mergedOptions]);

  // 値をクリア
  const clearValue = useCallback(() => {
    const clearedCell = {
      ...cell,
      rawValue: '',
      displayValue: '',
      dataType: CellDataType.EMPTY,
      validationError: undefined,
      lastModified: new Date()
    };
    setCell(clearedCell);
    setValidationError(undefined);

    if (mergedOptions.onChange) {
      mergedOptions.onChange(clearedCell);
    }
  }, [cell, mergedOptions]);

  // 書式を設定
  const setFormat = useCallback((formatUpdate: Partial<CellFormat>) => {
    const updatedCell = updateCellFormat(cell, formatUpdate);
    setCell(updatedCell);

    if (mergedOptions.onChange) {
      mergedOptions.onChange(updatedCell);
    }
  }, [cell, mergedOptions]);

  // 書式をリセット
  const resetFormat = useCallback(() => {
    const updatedCell = {
      ...cell,
      format: { ...DEFAULT_CELL_FORMAT },
      lastModified: new Date()
    };

    // 表示値を再計算
    if (mergedOptions.autoCalculateDisplay) {
      updatedCell.displayValue = calculateDisplayValue(updatedCell);
    }

    setCell(updatedCell);

    if (mergedOptions.onChange) {
      mergedOptions.onChange(updatedCell);
    }
  }, [cell, mergedOptions]);

  // 数値書式を適用
  const applyNumberFormat = useCallback((
    type: 'integer' | 'decimal' | 'percentage' | 'currency',
    decimalPlaces: number = 2
  ) => {
    const numberFormat = {
      type,
      decimalPlaces,
      currencySymbol: type === 'currency' ? '¥' : undefined
    };

    const formatUpdate: Partial<CellFormat> = {
      numberFormat
    };

    setFormat(formatUpdate);
  }, [setFormat]);

  // 日付書式を適用
  const applyDateFormat = useCallback((dateFormat: string) => {
    const formatUpdate: Partial<CellFormat> = {
      dateFormat
    };

    setFormat(formatUpdate);
  }, [setFormat]);

  // データ型を設定
  const setDataType = useCallback((dataType: CellDataType) => {
    const updatedCell = {
      ...cell,
      dataType,
      lastModified: new Date()
    };

    // 表示値を再計算
    if (mergedOptions.autoCalculateDisplay) {
      updatedCell.displayValue = calculateDisplayValue(updatedCell);
    }

    setCell(updatedCell);

    if (mergedOptions.onChange) {
      mergedOptions.onChange(updatedCell);
    }
  }, [cell, mergedOptions]);

  // データ型を自動検出
  const autoDetectDataType = useCallback(() => {
    const detectedType = determineCellDataType(cell.rawValue);
    if (detectedType !== cell.dataType) {
      setDataType(detectedType);
    }
  }, [cell.rawValue, cell.dataType, setDataType]);

  // 編集開始
  const startEditing = useCallback(() => {
    setIsEditing(true);
    setOriginalCell({ ...cell });
  }, [cell]);

  // 編集終了
  const stopEditing = useCallback(() => {
    setIsEditing(false);
  }, []);

  // 変更をコミット
  const commitChanges = useCallback(() => {
    if (validate()) {
      setOriginalCell({ ...cell });
      setIsEditing(false);
      return true;
    }
    return false;
  }, [cell, validate]);

  // 変更を破棄
  const discardChanges = useCallback(() => {
    setCell({ ...originalCell });
    setValidationError(undefined);
    setIsEditing(false);
  }, [originalCell]);

  // フォーカス
  const focus = useCallback(() => {
    // DOM操作は実際のコンポーネント側で実装
    startEditing();
  }, [startEditing]);

  // ブラー
  const blur = useCallback(() => {
    stopEditing();
    commitChanges();
  }, [stopEditing, commitChanges]);

  // A1記法を取得
  const getA1Notation = useCallback(() => {
    let columnLabel = '';
    let column = position.column;

    while (column >= 0) {
      columnLabel = String.fromCharCode(65 + (column % 26)) + columnLabel;
      column = Math.floor(column / 26) - 1;
    }

    return `${columnLabel}${position.row + 1}`;
  }, [position]);

  // セルを複製
  const clone = useCallback(() => {
    return {
      ...cell,
      position: { ...position },
      lastModified: new Date()
    };
  }, [cell, position]);

  // セルをリセット
  const reset = useCallback(() => {
    const emptyCell = createEmptyCell(position);
    setCell(emptyCell);
    setOriginalCell(emptyCell);
    setValidationError(undefined);
    setIsEditing(false);

    if (mergedOptions.onChange) {
      mergedOptions.onChange(emptyCell);
    }
  }, [position, mergedOptions]);

  // 自動バリデーション
  useEffect(() => {
    if (mergedOptions.validateOnChange && !isEditing) {
      validate();
    }
  }, [cell.rawValue, cell.dataType, validate, mergedOptions.validateOnChange, isEditing]);

  // 表示値の自動計算
  useEffect(() => {
    if (mergedOptions.autoCalculateDisplay) {
      const newDisplayValue = calculateDisplayValue(cell);
      if (newDisplayValue !== cell.displayValue) {
        setCell(prev => ({
          ...prev,
          displayValue: newDisplayValue
        }));
      }
    }
  }, [cell.rawValue, cell.dataType, cell.format, mergedOptions.autoCalculateDisplay]);

  return {
    // 現在の状態
    cell,
    isValid,
    validationError,
    isEditing,
    hasChanges,

    // 値操作
    setValue,
    setDisplayValue,
    clearValue,

    // 書式操作
    setFormat,
    resetFormat,
    applyNumberFormat,
    applyDateFormat,

    // データ型操作
    setDataType,
    autoDetectDataType,

    // 編集状態
    startEditing,
    stopEditing,
    commitChanges,
    discardChanges,

    // バリデーション
    validate,

    // その他
    focus,
    blur,
    getA1Notation,
    clone,
    reset,
  };
}