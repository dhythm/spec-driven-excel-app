/**
 * クリップボードデータモデル
 * コピー、切り取り、貼り付け操作で使用されるデータを管理する
 */

import { CellPosition } from './cell';
import { CellSelection } from './selection';

export enum ClipboardOperation {
  COPY = 'copy',
  CUT = 'cut',
}

export interface ClipboardCellData {
  position: CellPosition;
  rawValue: string;
  displayValue: string;
  dataType: string;
  format: any; // CellFormatを参照
}

export interface ClipboardData {
  operation: ClipboardOperation;
  sourceSelection: CellSelection;
  cellData: ClipboardCellData[][];
  timestamp: Date;
  sourceSpreadsheetId?: string;
  metadata: {
    rowCount: number;
    columnCount: number;
    hasFormulas: boolean;
    hasFormatting: boolean;
  };
}

export interface PasteOptions {
  includeValues: boolean;
  includeFormats: boolean;
  includeFormulas: boolean;
  transposeData: boolean;
  skipBlanks: boolean;
  operation: 'overwrite' | 'add' | 'subtract' | 'multiply' | 'divide';
}

export const DEFAULT_PASTE_OPTIONS: PasteOptions = {
  includeValues: true,
  includeFormats: false,
  includeFormulas: true,
  transposeData: false,
  skipBlanks: false,
  operation: 'overwrite',
};

/**
 * 空のクリップボードデータを作成する関数
 */
export function createEmptyClipboard(): ClipboardData | null {
  return null;
}

/**
 * セル選択範囲をクリップボードにコピーする関数
 */
export function copyToClipboard(
  selection: CellSelection,
  getCellData: (position: CellPosition) => ClipboardCellData,
  spreadsheetId?: string
): ClipboardData {
  const cellData = extractCellDataFromSelection(selection, getCellData);
  const metadata = calculateClipboardMetadata(cellData);

  return {
    operation: ClipboardOperation.COPY,
    sourceSelection: selection,
    cellData,
    timestamp: new Date(),
    sourceSpreadsheetId: spreadsheetId,
    metadata,
  };
}

/**
 * セル選択範囲をクリップボードに切り取りでコピーする関数
 */
export function cutToClipboard(
  selection: CellSelection,
  getCellData: (position: CellPosition) => ClipboardCellData,
  spreadsheetId?: string
): ClipboardData {
  const cellData = extractCellDataFromSelection(selection, getCellData);
  const metadata = calculateClipboardMetadata(cellData);

  return {
    operation: ClipboardOperation.CUT,
    sourceSelection: selection,
    cellData,
    timestamp: new Date(),
    sourceSpreadsheetId: spreadsheetId,
    metadata,
  };
}

/**
 * 選択範囲からセルデータを抽出する関数
 */
function extractCellDataFromSelection(
  selection: CellSelection,
  getCellData: (position: CellPosition) => ClipboardCellData
): ClipboardCellData[][] {
  const minRow = Math.min(selection.start.row, selection.end.row);
  const maxRow = Math.max(selection.start.row, selection.end.row);
  const minColumn = Math.min(selection.start.column, selection.end.column);
  const maxColumn = Math.max(selection.start.column, selection.end.column);

  const result: ClipboardCellData[][] = [];

  for (let row = minRow; row <= maxRow; row++) {
    const rowData: ClipboardCellData[] = [];
    for (let column = minColumn; column <= maxColumn; column++) {
      const cellData = getCellData({ row, column });
      rowData.push(cellData);
    }
    result.push(rowData);
  }

  return result;
}

/**
 * クリップボードデータのメタデータを計算する関数
 */
function calculateClipboardMetadata(cellData: ClipboardCellData[][]): ClipboardData['metadata'] {
  let hasFormulas = false;
  let hasFormatting = false;

  for (const row of cellData) {
    for (const cell of row) {
      if (cell.rawValue.startsWith('=')) {
        hasFormulas = true;
      }
      if (cell.format && Object.keys(cell.format).length > 0) {
        hasFormatting = true;
      }
    }
  }

  return {
    rowCount: cellData.length,
    columnCount: cellData.length > 0 ? cellData[0].length : 0,
    hasFormulas,
    hasFormatting,
  };
}

/**
 * クリップボードデータを貼り付け用に変換する関数
 */
export function preparePasteData(
  clipboardData: ClipboardData,
  targetPosition: CellPosition,
  options: PasteOptions = DEFAULT_PASTE_OPTIONS
): ClipboardCellData[][] {
  let data = clipboardData.cellData;

  // 転置処理
  if (options.transposeData) {
    data = transposeData(data);
  }

  // 空白セルのスキップ処理
  if (options.skipBlanks) {
    data = data.map(row =>
      row.map(cell => (cell.rawValue.trim() === '' ? null : cell))
    ).filter(row => row.some(cell => cell !== null)) as ClipboardCellData[][];
  }

  return data;
}

/**
 * データを転置する関数
 */
function transposeData(data: ClipboardCellData[][]): ClipboardCellData[][] {
  if (data.length === 0 || data[0].length === 0) {
    return data;
  }

  const transposed: ClipboardCellData[][] = [];
  for (let col = 0; col < data[0].length; col++) {
    const newRow: ClipboardCellData[] = [];
    for (let row = 0; row < data.length; row++) {
      newRow.push(data[row][col]);
    }
    transposed.push(newRow);
  }

  return transposed;
}

/**
 * 貼り付け操作を実行する関数
 */
export function executePaste(
  clipboardData: ClipboardData,
  targetPosition: CellPosition,
  setCellData: (position: CellPosition, data: ClipboardCellData) => void,
  clearCell: (position: CellPosition) => void,
  options: PasteOptions = DEFAULT_PASTE_OPTIONS
): { affectedCells: CellPosition[]; success: boolean; errors: string[] } {
  const errors: string[] = [];
  const affectedCells: CellPosition[] = [];

  try {
    const pasteData = preparePasteData(clipboardData, targetPosition, options);

    for (let rowIndex = 0; rowIndex < pasteData.length; rowIndex++) {
      for (let colIndex = 0; colIndex < pasteData[rowIndex].length; colIndex++) {
        const cellData = pasteData[rowIndex][colIndex];
        const targetPos: CellPosition = {
          row: targetPosition.row + rowIndex,
          column: targetPosition.column + colIndex,
        };

        if (cellData) {
          // セルデータを適用
          const processedCellData = processCellDataForPaste(cellData, options);
          setCellData(targetPos, processedCellData);
          affectedCells.push(targetPos);
        }
      }
    }

    // 切り取り操作の場合、元のセルをクリア
    if (clipboardData.operation === ClipboardOperation.CUT) {
      clearSourceCells(clipboardData.sourceSelection, clearCell);
    }

    return { affectedCells, success: true, errors };

  } catch (error) {
    errors.push(error instanceof Error ? error.message : '貼り付けエラー');
    return { affectedCells, success: false, errors };
  }
}

/**
 * 貼り付け用にセルデータを処理する関数
 */
function processCellDataForPaste(
  cellData: ClipboardCellData,
  options: PasteOptions
): ClipboardCellData {
  let processedData = { ...cellData };

  // 値の処理
  if (!options.includeValues) {
    processedData.rawValue = '';
    processedData.displayValue = '';
  }

  // 数式の処理
  if (!options.includeFormulas && processedData.rawValue.startsWith('=')) {
    processedData.rawValue = processedData.displayValue; // 計算結果のみを保持
  }

  // 書式の処理
  if (!options.includeFormats) {
    processedData.format = {}; // デフォルトの書式を使用
  }

  return processedData;
}

/**
 * 切り取り操作の元のセルをクリアする関数
 */
function clearSourceCells(
  sourceSelection: CellSelection,
  clearCell: (position: CellPosition) => void
): void {
  const minRow = Math.min(sourceSelection.start.row, sourceSelection.end.row);
  const maxRow = Math.max(sourceSelection.start.row, sourceSelection.end.row);
  const minColumn = Math.min(sourceSelection.start.column, sourceSelection.end.column);
  const maxColumn = Math.max(sourceSelection.start.column, sourceSelection.end.column);

  for (let row = minRow; row <= maxRow; row++) {
    for (let column = minColumn; column <= maxColumn; column++) {
      clearCell({ row, column });
    }
  }
}

/**
 * クリップボードデータをCSV形式に変換する関数
 */
export function clipboardToCSV(clipboardData: ClipboardData): string {
  const csvRows: string[] = [];

  for (const row of clipboardData.cellData) {
    const csvCells = row.map(cell => {
      const value = cell.displayValue || cell.rawValue;
      // CSV形式にエスケープ処理
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(csvCells.join(','));
  }

  return csvRows.join('\n');
}

/**
 * CSV文字列からクリップボードデータを作成する関数
 */
export function csvToClipboardData(csv: string, sourcePosition: CellPosition): ClipboardData {
  const lines = csv.split('\n');
  const cellData: ClipboardCellData[][] = [];

  for (let rowIndex = 0; rowIndex < lines.length; rowIndex++) {
    const line = lines[rowIndex];
    if (line.trim() === '') continue;

    const cells = parseCSVLine(line);
    const rowData: ClipboardCellData[] = [];

    for (let colIndex = 0; colIndex < cells.length; colIndex++) {
      const value = cells[colIndex];
      const position: CellPosition = {
        row: sourcePosition.row + rowIndex,
        column: sourcePosition.column + colIndex,
      };

      rowData.push({
        position,
        rawValue: value,
        displayValue: value,
        dataType: 'text', // 簡易実装
        format: {},
      });
    }

    cellData.push(rowData);
  }

  const metadata = calculateClipboardMetadata(cellData);

  return {
    operation: ClipboardOperation.COPY,
    sourceSelection: {
      start: sourcePosition,
      end: {
        row: sourcePosition.row + cellData.length - 1,
        column: sourcePosition.column + (cellData[0]?.length || 1) - 1,
      },
      type: 'cell_range' as any,
      isActive: true,
    },
    cellData,
    timestamp: new Date(),
    metadata,
  };
}

/**
 * CSV行を解析する関数（簡易実装）
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }

    i++;
  }

  result.push(current);
  return result;
}

/**
 * クリップボードデータが有効かチェックする関数
 */
export function isValidClipboardData(clipboardData: ClipboardData | null): boolean {
  if (!clipboardData) return false;

  // タイムスタンプチェック（5分以内）
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  if (clipboardData.timestamp < fiveMinutesAgo) {
    return false;
  }

  // データの存在チェック
  if (!clipboardData.cellData || clipboardData.cellData.length === 0) {
    return false;
  }

  return true;
}

/**
 * クリップボードの情報を取得する関数
 */
export function getClipboardInfo(clipboardData: ClipboardData | null): {
  isEmpty: boolean;
  operation: string;
  cellCount: number;
  size: string;
  hasFormulas: boolean;
  hasFormatting: boolean;
} {
  if (!clipboardData) {
    return {
      isEmpty: true,
      operation: '',
      cellCount: 0,
      size: '',
      hasFormulas: false,
      hasFormatting: false,
    };
  }

  const cellCount = clipboardData.metadata.rowCount * clipboardData.metadata.columnCount;
  const size = `${clipboardData.metadata.rowCount} × ${clipboardData.metadata.columnCount}`;

  return {
    isEmpty: false,
    operation: clipboardData.operation === ClipboardOperation.COPY ? 'コピー' : '切り取り',
    cellCount,
    size,
    hasFormulas: clipboardData.metadata.hasFormulas,
    hasFormatting: clipboardData.metadata.hasFormatting,
  };
}