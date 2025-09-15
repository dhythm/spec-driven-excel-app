/**
 * 行モデル
 * 水平方向のセルの集合。行番号と高さ設定を持つ
 */

export interface Row {
  index: number;
  height: number;
  isVisible: boolean;
  isSelected?: boolean;
  isLocked?: boolean;
  backgroundColor?: string;
  headerLabel?: string;
}

export interface RowOperation {
  type: 'insert' | 'delete' | 'resize' | 'hide' | 'show' | 'move';
  targetIndex: number;
  newIndex?: number; // move操作の場合
  newHeight?: number; // resize操作の場合
  count?: number; // insert/delete操作の場合
}

export const DEFAULT_ROW_HEIGHT = 20;
export const MIN_ROW_HEIGHT = 10;
export const MAX_ROW_HEIGHT = 400;

/**
 * 新しい行を作成する関数
 */
export function createRow(
  index: number,
  height: number = DEFAULT_ROW_HEIGHT,
  isVisible: boolean = true
): Row {
  return {
    index,
    height: Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, height)),
    isVisible,
    headerLabel: (index + 1).toString(),
  };
}

/**
 * 行の高さを更新する関数
 */
export function updateRowHeight(row: Row, newHeight: number): Row {
  const clampedHeight = Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, newHeight));

  return {
    ...row,
    height: clampedHeight,
  };
}

/**
 * 行の表示状態を切り替える関数
 */
export function toggleRowVisibility(row: Row): Row {
  return {
    ...row,
    isVisible: !row.isVisible,
  };
}

/**
 * 行を非表示にする関数
 */
export function hideRow(row: Row): Row {
  return {
    ...row,
    isVisible: false,
  };
}

/**
 * 行を表示する関数
 */
export function showRow(row: Row): Row {
  return {
    ...row,
    isVisible: true,
  };
}

/**
 * 行の選択状態を設定する関数
 */
export function setRowSelection(row: Row, isSelected: boolean): Row {
  return {
    ...row,
    isSelected,
  };
}

/**
 * 行の背景色を設定する関数
 */
export function setRowBackgroundColor(row: Row, backgroundColor: string): Row {
  return {
    ...row,
    backgroundColor,
  };
}

/**
 * 複数行に対して操作を適用する関数
 */
export function applyRowOperation(rows: Row[], operation: RowOperation): Row[] {
  switch (operation.type) {
    case 'insert':
      return insertRows(rows, operation.targetIndex, operation.count || 1);

    case 'delete':
      return deleteRows(rows, operation.targetIndex, operation.count || 1);

    case 'resize':
      if (operation.newHeight === undefined) {
        throw new Error('resize操作にはnewHeightが必要です');
      }
      return resizeRow(rows, operation.targetIndex, operation.newHeight);

    case 'hide':
      return hideRows(rows, operation.targetIndex, operation.count || 1);

    case 'show':
      return showRows(rows, operation.targetIndex, operation.count || 1);

    case 'move':
      if (operation.newIndex === undefined) {
        throw new Error('move操作にはnewIndexが必要です');
      }
      return moveRow(rows, operation.targetIndex, operation.newIndex);

    default:
      throw new Error(`未知の行操作タイプ: ${operation.type}`);
  }
}

/**
 * 指定位置に行を挿入する関数
 */
export function insertRows(rows: Row[], index: number, count: number = 1): Row[] {
  if (index < 0 || index > rows.length) {
    throw new Error('挿入位置が無効です');
  }

  const newRows = [...rows];
  const insertedRows: Row[] = [];

  for (let i = 0; i < count; i++) {
    insertedRows.push(createRow(index + i));
  }

  // 挿入位置以降の行のインデックスを更新
  for (let i = index; i < newRows.length; i++) {
    newRows[i] = { ...newRows[i], index: newRows[i].index + count };
  }

  newRows.splice(index, 0, ...insertedRows);

  // 全体のインデックスを再計算
  return newRows.map((row, idx) => ({ ...row, index: idx, headerLabel: (idx + 1).toString() }));
}

/**
 * 指定位置から行を削除する関数
 */
export function deleteRows(rows: Row[], index: number, count: number = 1): Row[] {
  if (index < 0 || index >= rows.length) {
    throw new Error('削除位置が無効です');
  }

  const actualCount = Math.min(count, rows.length - index);
  const newRows = [...rows];
  newRows.splice(index, actualCount);

  // インデックスを再計算
  return newRows.map((row, idx) => ({ ...row, index: idx, headerLabel: (idx + 1).toString() }));
}

/**
 * 行の高さを変更する関数
 */
export function resizeRow(rows: Row[], index: number, newHeight: number): Row[] {
  if (index < 0 || index >= rows.length) {
    throw new Error('対象行のインデックスが無効です');
  }

  return rows.map((row, idx) =>
    idx === index ? updateRowHeight(row, newHeight) : row
  );
}

/**
 * 複数行を非表示にする関数
 */
export function hideRows(rows: Row[], startIndex: number, count: number = 1): Row[] {
  if (startIndex < 0 || startIndex >= rows.length) {
    throw new Error('対象行のインデックスが無効です');
  }

  return rows.map((row, idx) => {
    if (idx >= startIndex && idx < startIndex + count) {
      return hideRow(row);
    }
    return row;
  });
}

/**
 * 複数行を表示する関数
 */
export function showRows(rows: Row[], startIndex: number, count: number = 1): Row[] {
  if (startIndex < 0 || startIndex >= rows.length) {
    throw new Error('対象行のインデックスが無効です');
  }

  return rows.map((row, idx) => {
    if (idx >= startIndex && idx < startIndex + count) {
      return showRow(row);
    }
    return row;
  });
}

/**
 * 行を移動する関数
 */
export function moveRow(rows: Row[], fromIndex: number, toIndex: number): Row[] {
  if (fromIndex < 0 || fromIndex >= rows.length || toIndex < 0 || toIndex >= rows.length) {
    throw new Error('移動インデックスが無効です');
  }

  if (fromIndex === toIndex) {
    return rows;
  }

  const newRows = [...rows];
  const [movedRow] = newRows.splice(fromIndex, 1);
  newRows.splice(toIndex, 0, movedRow);

  // インデックスを再計算
  return newRows.map((row, idx) => ({ ...row, index: idx, headerLabel: (idx + 1).toString() }));
}

/**
 * 表示されている行のみを取得する関数
 */
export function getVisibleRows(rows: Row[]): Row[] {
  return rows.filter(row => row.isVisible);
}

/**
 * 行の総高さを計算する関数
 */
export function calculateTotalRowHeight(rows: Row[]): number {
  return rows.reduce((total, row) => {
    return total + (row.isVisible ? row.height : 0);
  }, 0);
}

/**
 * 指定した行範囲の高さを計算する関数
 */
export function calculateRowRangeHeight(rows: Row[], startIndex: number, endIndex: number): number {
  if (startIndex < 0 || endIndex >= rows.length || startIndex > endIndex) {
    throw new Error('行範囲が無効です');
  }

  return rows.slice(startIndex, endIndex + 1).reduce((total, row) => {
    return total + (row.isVisible ? row.height : 0);
  }, 0);
}

/**
 * 行の妥当性を検証する関数
 */
export function validateRow(row: Row): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (row.index < 0) {
    errors.push('行インデックスは0以上である必要があります');
  }

  if (row.height < MIN_ROW_HEIGHT) {
    errors.push(`行の高さは${MIN_ROW_HEIGHT}px以上である必要があります`);
  }

  if (row.height > MAX_ROW_HEIGHT) {
    errors.push(`行の高さは${MAX_ROW_HEIGHT}px以下である必要があります`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}