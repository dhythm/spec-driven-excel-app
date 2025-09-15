/**
 * 列モデル
 * 垂直方向のセルの集合。列番号（またはアルファベット表記）と幅設定を持つ
 */

export interface Column {
  index: number;
  width: number;
  header: string; // A, B, C, ... AA, AB, ...
  isVisible: boolean;
  isSelected?: boolean;
  isLocked?: boolean;
  backgroundColor?: string;
  dataType?: 'auto' | 'text' | 'number' | 'date' | 'boolean';
}

export interface ColumnOperation {
  type: 'insert' | 'delete' | 'resize' | 'hide' | 'show' | 'move';
  targetIndex: number;
  newIndex?: number; // move操作の場合
  newWidth?: number; // resize操作の場合
  count?: number; // insert/delete操作の場合
}

export const DEFAULT_COLUMN_WIDTH = 100;
export const MIN_COLUMN_WIDTH = 20;
export const MAX_COLUMN_WIDTH = 500;

/**
 * 列インデックスからアルファベット表記に変換する関数
 */
export function indexToColumnHeader(index: number): string {
  let header = '';
  let temp = index;

  while (temp >= 0) {
    header = String.fromCharCode(65 + (temp % 26)) + header;
    temp = Math.floor(temp / 26) - 1;
  }

  return header;
}

/**
 * アルファベット表記から列インデックスに変換する関数
 */
export function columnHeaderToIndex(header: string): number {
  let index = 0;
  const upperHeader = header.toUpperCase();

  for (let i = 0; i < upperHeader.length; i++) {
    index = index * 26 + (upperHeader.charCodeAt(i) - 64);
  }

  return index - 1; // 0ベースのインデックスに変換
}

/**
 * 新しい列を作成する関数
 */
export function createColumn(
  index: number,
  width: number = DEFAULT_COLUMN_WIDTH,
  isVisible: boolean = true
): Column {
  return {
    index,
    width: Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, width)),
    header: indexToColumnHeader(index),
    isVisible,
    dataType: 'auto',
  };
}

/**
 * 列の幅を更新する関数
 */
export function updateColumnWidth(column: Column, newWidth: number): Column {
  const clampedWidth = Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, newWidth));

  return {
    ...column,
    width: clampedWidth,
  };
}

/**
 * 列の表示状態を切り替える関数
 */
export function toggleColumnVisibility(column: Column): Column {
  return {
    ...column,
    isVisible: !column.isVisible,
  };
}

/**
 * 列を非表示にする関数
 */
export function hideColumn(column: Column): Column {
  return {
    ...column,
    isVisible: false,
  };
}

/**
 * 列を表示する関数
 */
export function showColumn(column: Column): Column {
  return {
    ...column,
    isVisible: true,
  };
}

/**
 * 列の選択状態を設定する関数
 */
export function setColumnSelection(column: Column, isSelected: boolean): Column {
  return {
    ...column,
    isSelected,
  };
}

/**
 * 列の背景色を設定する関数
 */
export function setColumnBackgroundColor(column: Column, backgroundColor: string): Column {
  return {
    ...column,
    backgroundColor,
  };
}

/**
 * 列のデータ型を設定する関数
 */
export function setColumnDataType(column: Column, dataType: Column['dataType']): Column {
  return {
    ...column,
    dataType,
  };
}

/**
 * 複数列に対して操作を適用する関数
 */
export function applyColumnOperation(columns: Column[], operation: ColumnOperation): Column[] {
  switch (operation.type) {
    case 'insert':
      return insertColumns(columns, operation.targetIndex, operation.count || 1);

    case 'delete':
      return deleteColumns(columns, operation.targetIndex, operation.count || 1);

    case 'resize':
      if (operation.newWidth === undefined) {
        throw new Error('resize操作にはnewWidthが必要です');
      }
      return resizeColumn(columns, operation.targetIndex, operation.newWidth);

    case 'hide':
      return hideColumns(columns, operation.targetIndex, operation.count || 1);

    case 'show':
      return showColumns(columns, operation.targetIndex, operation.count || 1);

    case 'move':
      if (operation.newIndex === undefined) {
        throw new Error('move操作にはnewIndexが必要です');
      }
      return moveColumn(columns, operation.targetIndex, operation.newIndex);

    default:
      throw new Error(`未知の列操作タイプ: ${operation.type}`);
  }
}

/**
 * 指定位置に列を挿入する関数
 */
export function insertColumns(columns: Column[], index: number, count: number = 1): Column[] {
  if (index < 0 || index > columns.length) {
    throw new Error('挿入位置が無効です');
  }

  const newColumns = [...columns];
  const insertedColumns: Column[] = [];

  for (let i = 0; i < count; i++) {
    insertedColumns.push(createColumn(index + i));
  }

  // 挿入位置以降の列のインデックスを更新
  for (let i = index; i < newColumns.length; i++) {
    newColumns[i] = { ...newColumns[i], index: newColumns[i].index + count };
  }

  newColumns.splice(index, 0, ...insertedColumns);

  // 全体のインデックスとヘッダーを再計算
  return newColumns.map((column, idx) => ({
    ...column,
    index: idx,
    header: indexToColumnHeader(idx),
  }));
}

/**
 * 指定位置から列を削除する関数
 */
export function deleteColumns(columns: Column[], index: number, count: number = 1): Column[] {
  if (index < 0 || index >= columns.length) {
    throw new Error('削除位置が無効です');
  }

  const actualCount = Math.min(count, columns.length - index);
  const newColumns = [...columns];
  newColumns.splice(index, actualCount);

  // インデックスとヘッダーを再計算
  return newColumns.map((column, idx) => ({
    ...column,
    index: idx,
    header: indexToColumnHeader(idx),
  }));
}

/**
 * 列の幅を変更する関数
 */
export function resizeColumn(columns: Column[], index: number, newWidth: number): Column[] {
  if (index < 0 || index >= columns.length) {
    throw new Error('対象列のインデックスが無効です');
  }

  return columns.map((column, idx) =>
    idx === index ? updateColumnWidth(column, newWidth) : column
  );
}

/**
 * 複数列を非表示にする関数
 */
export function hideColumns(columns: Column[], startIndex: number, count: number = 1): Column[] {
  if (startIndex < 0 || startIndex >= columns.length) {
    throw new Error('対象列のインデックスが無効です');
  }

  return columns.map((column, idx) => {
    if (idx >= startIndex && idx < startIndex + count) {
      return hideColumn(column);
    }
    return column;
  });
}

/**
 * 複数列を表示する関数
 */
export function showColumns(columns: Column[], startIndex: number, count: number = 1): Column[] {
  if (startIndex < 0 || startIndex >= columns.length) {
    throw new Error('対象列のインデックスが無効です');
  }

  return columns.map((column, idx) => {
    if (idx >= startIndex && idx < startIndex + count) {
      return showColumn(column);
    }
    return column;
  });
}

/**
 * 列を移動する関数
 */
export function moveColumn(columns: Column[], fromIndex: number, toIndex: number): Column[] {
  if (fromIndex < 0 || fromIndex >= columns.length || toIndex < 0 || toIndex >= columns.length) {
    throw new Error('移動インデックスが無効です');
  }

  if (fromIndex === toIndex) {
    return columns;
  }

  const newColumns = [...columns];
  const [movedColumn] = newColumns.splice(fromIndex, 1);
  newColumns.splice(toIndex, 0, movedColumn);

  // インデックスとヘッダーを再計算
  return newColumns.map((column, idx) => ({
    ...column,
    index: idx,
    header: indexToColumnHeader(idx),
  }));
}

/**
 * 表示されている列のみを取得する関数
 */
export function getVisibleColumns(columns: Column[]): Column[] {
  return columns.filter(column => column.isVisible);
}

/**
 * 列の総幅を計算する関数
 */
export function calculateTotalColumnWidth(columns: Column[]): number {
  return columns.reduce((total, column) => {
    return total + (column.isVisible ? column.width : 0);
  }, 0);
}

/**
 * 指定した列範囲の幅を計算する関数
 */
export function calculateColumnRangeWidth(columns: Column[], startIndex: number, endIndex: number): number {
  if (startIndex < 0 || endIndex >= columns.length || startIndex > endIndex) {
    throw new Error('列範囲が無効です');
  }

  return columns.slice(startIndex, endIndex + 1).reduce((total, column) => {
    return total + (column.isVisible ? column.width : 0);
  }, 0);
}

/**
 * 列ヘッダーの配列を生成する関数
 */
export function generateColumnHeaders(count: number): string[] {
  const headers: string[] = [];
  for (let i = 0; i < count; i++) {
    headers.push(indexToColumnHeader(i));
  }
  return headers;
}

/**
 * 列の妥当性を検証する関数
 */
export function validateColumn(column: Column): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (column.index < 0) {
    errors.push('列インデックスは0以上である必要があります');
  }

  if (column.width < MIN_COLUMN_WIDTH) {
    errors.push(`列の幅は${MIN_COLUMN_WIDTH}px以上である必要があります`);
  }

  if (column.width > MAX_COLUMN_WIDTH) {
    errors.push(`列の幅は${MAX_COLUMN_WIDTH}px以下である必要があります`);
  }

  if (!column.header || column.header.trim() === '') {
    errors.push('列ヘッダーが必要です');
  }

  // ヘッダーがインデックスと一致するかチェック
  const expectedHeader = indexToColumnHeader(column.index);
  if (column.header !== expectedHeader) {
    errors.push(`列ヘッダー（${column.header}）がインデックス（${column.index}）と一致しません。期待値: ${expectedHeader}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}