/**
 * セルモデル
 * 個々のデータ入力単位。行番号、列番号、値（テキスト/数値/数式）、データ型、書式設定を持つ
 */

export interface CellPosition {
  row: number;
  column: number;
}

export enum CellDataType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  BOOLEAN = 'boolean',
  FORMULA = 'formula',
  EMPTY = 'empty',
}

export interface CellFormat {
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  textColor: string;
  backgroundColor: string;
  border: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
    color: string;
    width: number;
  };
  numberFormat?: {
    type: 'integer' | 'decimal' | 'percentage' | 'currency';
    decimalPlaces: number;
    currencySymbol?: string;
  };
  dateFormat?: string;
}

export interface Cell {
  position: CellPosition;
  rawValue: string;
  displayValue: string;
  dataType: CellDataType;
  format: CellFormat;
  isReadOnly: boolean;
  isSelected: boolean;
  validationError?: string;
  lastModified: Date;
}

export const DEFAULT_CELL_FORMAT: CellFormat = {
  fontSize: 12,
  fontFamily: 'Arial, sans-serif',
  fontWeight: 'normal',
  fontStyle: 'normal',
  textAlign: 'left',
  textColor: '#000000',
  backgroundColor: '#ffffff',
  border: {
    top: false,
    right: false,
    bottom: false,
    left: false,
    color: '#d0d0d0',
    width: 1,
  },
};

/**
 * 新しい空のセルを作成する関数
 */
export function createEmptyCell(position: CellPosition): Cell {
  return {
    position,
    rawValue: '',
    displayValue: '',
    dataType: CellDataType.EMPTY,
    format: { ...DEFAULT_CELL_FORMAT },
    isReadOnly: false,
    isSelected: false,
    lastModified: new Date(),
  };
}

/**
 * セルのデータ型を判定する関数
 */
export function determineCellDataType(value: string): CellDataType {
  if (!value || value.trim() === '') {
    return CellDataType.EMPTY;
  }

  // 数式の判定
  if (value.startsWith('=')) {
    return CellDataType.FORMULA;
  }

  // 数値の判定
  const numValue = parseFloat(value);
  if (!isNaN(numValue) && isFinite(numValue)) {
    return CellDataType.NUMBER;
  }

  // 日付の判定（基本的なISO形式とローカル形式をサポート）
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{4}\/\d{1,2}\/\d{1,2}$/, // YYYY/M/D
    /^\d{1,2}\/\d{1,2}\/\d{4}$/, // M/D/YYYY
  ];

  for (const pattern of datePatterns) {
    if (pattern.test(value)) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return CellDataType.DATE;
      }
    }
  }

  // ブール値の判定
  const lowerValue = value.toLowerCase();
  if (lowerValue === 'true' || lowerValue === 'false') {
    return CellDataType.BOOLEAN;
  }

  // デフォルトはテキスト
  return CellDataType.TEXT;
}

/**
 * セルの表示値を計算する関数
 */
export function calculateDisplayValue(cell: Cell): string {
  if (cell.dataType === CellDataType.EMPTY) {
    return '';
  }

  if (cell.dataType === CellDataType.FORMULA) {
    // 数式の場合は計算結果を表示（実装は簡素化）
    return cell.rawValue; // 実際の実装では数式エンジンで計算
  }

  if (cell.dataType === CellDataType.NUMBER && cell.format.numberFormat) {
    const numValue = parseFloat(cell.rawValue);
    if (isNaN(numValue)) return cell.rawValue;

    const format = cell.format.numberFormat;
    switch (format.type) {
      case 'integer':
        return Math.round(numValue).toString();
      case 'decimal':
        return numValue.toFixed(format.decimalPlaces);
      case 'percentage':
        return `${(numValue * 100).toFixed(format.decimalPlaces)}%`;
      case 'currency':
        return `${format.currencySymbol || '$'}${numValue.toFixed(format.decimalPlaces)}`;
    }
  }

  if (cell.dataType === CellDataType.DATE && cell.format.dateFormat) {
    const date = new Date(cell.rawValue);
    if (!isNaN(date.getTime())) {
      // 簡単な日付フォーマット（実際の実装ではより詳細な処理が必要）
      switch (cell.format.dateFormat) {
        case 'YYYY-MM-DD':
          return date.toISOString().split('T')[0];
        case 'MM/DD/YYYY':
          return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
        default:
          return date.toLocaleDateString();
      }
    }
  }

  return cell.rawValue;
}

/**
 * セルの値を更新する関数
 */
export function updateCellValue(cell: Cell, newValue: string): Cell {
  const dataType = determineCellDataType(newValue);
  const updatedCell: Cell = {
    ...cell,
    rawValue: newValue,
    dataType,
    lastModified: new Date(),
    validationError: undefined,
  };

  updatedCell.displayValue = calculateDisplayValue(updatedCell);
  return updatedCell;
}

/**
 * セルの書式を更新する関数
 */
export function updateCellFormat(cell: Cell, formatUpdate: Partial<CellFormat>): Cell {
  const updatedCell: Cell = {
    ...cell,
    format: { ...cell.format, ...formatUpdate },
    lastModified: new Date(),
  };

  updatedCell.displayValue = calculateDisplayValue(updatedCell);
  return updatedCell;
}

/**
 * セルのデータ検証を行う関数
 */
export function validateCellData(cell: Cell): { isValid: boolean; error?: string } {
  if (cell.dataType === CellDataType.EMPTY) {
    return { isValid: true };
  }

  // 数値検証
  if (cell.dataType === CellDataType.NUMBER) {
    const numValue = parseFloat(cell.rawValue);
    if (isNaN(numValue) || !isFinite(numValue)) {
      return { isValid: false, error: '有効な数値を入力してください' };
    }
  }

  // 日付検証
  if (cell.dataType === CellDataType.DATE) {
    const date = new Date(cell.rawValue);
    if (isNaN(date.getTime())) {
      return { isValid: false, error: '有効な日付を入力してください' };
    }
  }

  return { isValid: true };
}

/**
 * セルの座標を文字列表現に変換する関数（例: A1, B2）
 */
export function cellPositionToA1Notation(position: CellPosition): string {
  let columnLabel = '';
  let column = position.column;

  while (column >= 0) {
    columnLabel = String.fromCharCode(65 + (column % 26)) + columnLabel;
    column = Math.floor(column / 26) - 1;
  }

  return `${columnLabel}${position.row + 1}`;
}

/**
 * A1記法の文字列をセル座標に変換する関数
 */
export function a1NotationToCellPosition(a1: string): CellPosition {
  const match = a1.match(/^([A-Z]+)(\d+)$/);
  if (!match) {
    throw new Error('無効なA1記法です');
  }

  const [, columnStr, rowStr] = match;
  let column = 0;

  for (let i = 0; i < columnStr.length; i++) {
    column = column * 26 + (columnStr.charCodeAt(i) - 64);
  }
  column -= 1; // 0ベースのインデックスに変換

  const row = parseInt(rowStr, 10) - 1; // 0ベースのインデックスに変換

  return { row, column };
}