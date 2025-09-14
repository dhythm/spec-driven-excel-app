/**
 * Spreadsheet Operations Library
 * セルの操作（更新、削除、書式設定）を担当するライブラリ
 */

import { Spreadsheet, setCellInSpreadsheet, getCellFromSpreadsheet } from '../spreadsheet';
import {
  Cell,
  CellPosition,
  CellFormat,
  CellDataType,
  createEmptyCell,
  updateCellValue,
  updateCellFormat,
  calculateDisplayValue
} from '../cell';
import { Selection, getAllSelectedCellPositions } from '../selection';

/**
 * セル操作の結果
 */
export interface CellOperationResult {
  success: boolean;
  error?: string;
  affectedCells: CellPosition[];
  spreadsheet: Spreadsheet;
}

/**
 * セル書式の適用結果
 */
export interface FormatOperationResult extends CellOperationResult {
  appliedFormat: Partial<CellFormat>;
}

/**
 * セルの値を更新する
 */
export function updateCell(
  spreadsheet: Spreadsheet,
  position: CellPosition,
  value: string,
  preserveFormat: boolean = true
): CellOperationResult {
  try {
    // 既存のセルを取得または新しいセルを作成
    let existingCell = getCellFromSpreadsheet(spreadsheet, position);
    if (!existingCell) {
      existingCell = createEmptyCell(position);
    }

    // セル値を更新
    const updatedCell = updateCellValue(existingCell, value);

    // 書式を保持する場合は既存の書式を適用
    if (preserveFormat && existingCell) {
      updatedCell.format = existingCell.format;
    }

    const updatedSpreadsheet = setCellInSpreadsheet(spreadsheet, position, updatedCell);

    return {
      success: true,
      affectedCells: [position],
      spreadsheet: updatedSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'セルの更新に失敗しました',
      affectedCells: [],
      spreadsheet
    };
  }
}

/**
 * 複数のセルの値を一括更新する
 */
export function updateCells(
  spreadsheet: Spreadsheet,
  updates: { position: CellPosition; value: string }[]
): CellOperationResult {
  const affectedCells: CellPosition[] = [];
  let currentSpreadsheet = spreadsheet;

  for (const update of updates) {
    const result = updateCell(currentSpreadsheet, update.position, update.value);
    if (result.success) {
      currentSpreadsheet = result.spreadsheet;
      affectedCells.push(update.position);
    } else {
      return {
        success: false,
        error: `セル ${update.position.row + 1}:${update.position.column + 1} の更新に失敗: ${result.error}`,
        affectedCells,
        spreadsheet: currentSpreadsheet
      };
    }
  }

  return {
    success: true,
    affectedCells,
    spreadsheet: currentSpreadsheet
  };
}

/**
 * セルを削除する（値をクリアし、デフォルト書式にリセット）
 */
export function deleteCell(
  spreadsheet: Spreadsheet,
  position: CellPosition,
  clearFormatToo: boolean = false
): CellOperationResult {
  try {
    const existingCell = getCellFromSpreadsheet(spreadsheet, position);

    if (!existingCell) {
      // セルが存在しない場合はそのまま成功を返す
      return {
        success: true,
        affectedCells: [],
        spreadsheet
      };
    }

    // 新しい空のセルを作成
    let emptyCell = createEmptyCell(position);

    // 書式をクリアしない場合は既存の書式を保持
    if (!clearFormatToo) {
      emptyCell = updateCellFormat(emptyCell, existingCell.format);
    }

    const updatedSpreadsheet = setCellInSpreadsheet(spreadsheet, position, emptyCell);

    return {
      success: true,
      affectedCells: [position],
      spreadsheet: updatedSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'セルの削除に失敗しました',
      affectedCells: [],
      spreadsheet
    };
  }
}

/**
 * 複数のセルを削除する
 */
export function deleteCells(
  spreadsheet: Spreadsheet,
  positions: CellPosition[],
  clearFormatToo: boolean = false
): CellOperationResult {
  const affectedCells: CellPosition[] = [];
  let currentSpreadsheet = spreadsheet;

  for (const position of positions) {
    const result = deleteCell(currentSpreadsheet, position, clearFormatToo);
    if (result.success) {
      currentSpreadsheet = result.spreadsheet;
      if (result.affectedCells.length > 0) {
        affectedCells.push(...result.affectedCells);
      }
    } else {
      return {
        success: false,
        error: `セル ${position.row + 1}:${position.column + 1} の削除に失敗: ${result.error}`,
        affectedCells,
        spreadsheet: currentSpreadsheet
      };
    }
  }

  return {
    success: true,
    affectedCells,
    spreadsheet: currentSpreadsheet
  };
}

/**
 * セルの書式を適用する
 */
export function formatCell(
  spreadsheet: Spreadsheet,
  position: CellPosition,
  format: Partial<CellFormat>
): FormatOperationResult {
  try {
    // 既存のセルを取得または新しいセルを作成
    let existingCell = getCellFromSpreadsheet(spreadsheet, position);
    if (!existingCell) {
      existingCell = createEmptyCell(position);
    }

    // 書式を適用
    const updatedCell = updateCellFormat(existingCell, format);
    const updatedSpreadsheet = setCellInSpreadsheet(spreadsheet, position, updatedCell);

    return {
      success: true,
      affectedCells: [position],
      appliedFormat: format,
      spreadsheet: updatedSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'セル書式の適用に失敗しました',
      affectedCells: [],
      appliedFormat: {},
      spreadsheet
    };
  }
}

/**
 * 複数のセルに書式を適用する
 */
export function formatCells(
  spreadsheet: Spreadsheet,
  positions: CellPosition[],
  format: Partial<CellFormat>
): FormatOperationResult {
  const affectedCells: CellPosition[] = [];
  let currentSpreadsheet = spreadsheet;

  for (const position of positions) {
    const result = formatCell(currentSpreadsheet, position, format);
    if (result.success) {
      currentSpreadsheet = result.spreadsheet;
      affectedCells.push(position);
    } else {
      return {
        success: false,
        error: `セル ${position.row + 1}:${position.column + 1} の書式適用に失敗: ${result.error}`,
        affectedCells,
        appliedFormat: format,
        spreadsheet: currentSpreadsheet
      };
    }
  }

  return {
    success: true,
    affectedCells,
    appliedFormat: format,
    spreadsheet: currentSpreadsheet
  };
}

/**
 * 選択範囲のセルに書式を適用する
 */
export function formatSelection(
  spreadsheet: Spreadsheet,
  selection: Selection,
  format: Partial<CellFormat>
): FormatOperationResult {
  const selectedPositions = getAllSelectedCellPositions(selection);
  return formatCells(spreadsheet, selectedPositions, format);
}

/**
 * セル範囲の値をコピーする
 */
export function copyCellRange(
  spreadsheet: Spreadsheet,
  startPosition: CellPosition,
  endPosition: CellPosition
): CellOperationResult & { copiedData: { position: CellPosition; cell: Cell }[] } {
  try {
    const minRow = Math.min(startPosition.row, endPosition.row);
    const maxRow = Math.max(startPosition.row, endPosition.row);
    const minCol = Math.min(startPosition.column, endPosition.column);
    const maxCol = Math.max(startPosition.column, endPosition.column);

    const copiedData: { position: CellPosition; cell: Cell }[] = [];

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const position = { row, column: col };
        const cell = getCellFromSpreadsheet(spreadsheet, position);
        if (cell) {
          copiedData.push({ position, cell: { ...cell } });
        }
      }
    }

    return {
      success: true,
      affectedCells: [],
      spreadsheet,
      copiedData
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'セル範囲のコピーに失敗しました',
      affectedCells: [],
      spreadsheet,
      copiedData: []
    };
  }
}

/**
 * セルデータを貼り付ける
 */
export function pasteCells(
  spreadsheet: Spreadsheet,
  targetPosition: CellPosition,
  copiedData: { position: CellPosition; cell: Cell }[],
  pasteOptions: {
    pasteValues: boolean;
    pasteFormats: boolean;
    pasteFormulas: boolean;
  } = { pasteValues: true, pasteFormats: true, pasteFormulas: true }
): CellOperationResult {
  try {
    if (copiedData.length === 0) {
      return {
        success: true,
        affectedCells: [],
        spreadsheet
      };
    }

    // コピー元の範囲を計算
    const sourcePositions = copiedData.map(d => d.position);
    const minSourceRow = Math.min(...sourcePositions.map(p => p.row));
    const minSourceCol = Math.min(...sourcePositions.map(p => p.column));

    const affectedCells: CellPosition[] = [];
    let currentSpreadsheet = spreadsheet;

    for (const { position: sourcePos, cell: sourceCell } of copiedData) {
      // 貼り付け先の位置を計算
      const rowOffset = sourcePos.row - minSourceRow;
      const colOffset = sourcePos.column - minSourceCol;
      const pastePos = {
        row: targetPosition.row + rowOffset,
        column: targetPosition.column + colOffset
      };

      // 範囲外チェック
      if (pastePos.row >= currentSpreadsheet.rowCount ||
          pastePos.column >= currentSpreadsheet.columnCount ||
          pastePos.row < 0 || pastePos.column < 0) {
        continue;
      }

      // 既存のセルを取得または新しいセルを作成
      let targetCell = getCellFromSpreadsheet(currentSpreadsheet, pastePos);
      if (!targetCell) {
        targetCell = createEmptyCell(pastePos);
      }

      // 貼り付けオプションに応じて値や書式をコピー
      let updatedCell = { ...targetCell };

      if (pasteOptions.pasteValues) {
        if (pasteOptions.pasteFormulas && sourceCell.dataType === CellDataType.FORMULA) {
          // 数式の場合はそのまま貼り付け（相対参照の調整は省略）
          updatedCell = updateCellValue(updatedCell, sourceCell.rawValue);
        } else if (sourceCell.dataType !== CellDataType.FORMULA) {
          // 数式以外の値を貼り付け
          updatedCell = updateCellValue(updatedCell, sourceCell.rawValue);
        }
      }

      if (pasteOptions.pasteFormats) {
        updatedCell = updateCellFormat(updatedCell, sourceCell.format);
      }

      currentSpreadsheet = setCellInSpreadsheet(currentSpreadsheet, pastePos, updatedCell);
      affectedCells.push(pastePos);
    }

    return {
      success: true,
      affectedCells,
      spreadsheet: currentSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'セルの貼り付けに失敗しました',
      affectedCells: [],
      spreadsheet
    };
  }
}

/**
 * セルの値と書式をクリアする
 */
export function clearCellContent(
  spreadsheet: Spreadsheet,
  positions: CellPosition[],
  clearOptions: {
    clearValues: boolean;
    clearFormats: boolean;
  } = { clearValues: true, clearFormats: false }
): CellOperationResult {
  const affectedCells: CellPosition[] = [];
  let currentSpreadsheet = spreadsheet;

  for (const position of positions) {
    try {
      const existingCell = getCellFromSpreadsheet(currentSpreadsheet, position);

      if (!existingCell) {
        continue; // セルが存在しない場合はスキップ
      }

      let updatedCell = { ...existingCell };

      if (clearOptions.clearValues) {
        updatedCell = updateCellValue(updatedCell, '');
      }

      if (clearOptions.clearFormats) {
        // デフォルト書式で置き換え
        const emptyCell = createEmptyCell(position);
        updatedCell = updateCellFormat(updatedCell, emptyCell.format);
      }

      currentSpreadsheet = setCellInSpreadsheet(currentSpreadsheet, position, updatedCell);
      affectedCells.push(position);
    } catch (error) {
      return {
        success: false,
        error: `セル ${position.row + 1}:${position.column + 1} のクリアに失敗: ${error instanceof Error ? error.message : 'Unknown error'}`,
        affectedCells,
        spreadsheet: currentSpreadsheet
      };
    }
  }

  return {
    success: true,
    affectedCells,
    spreadsheet: currentSpreadsheet
  };
}

/**
 * セルの種類（データ型）を変更する
 */
export function convertCellType(
  spreadsheet: Spreadsheet,
  position: CellPosition,
  targetType: CellDataType
): CellOperationResult {
  try {
    const existingCell = getCellFromSpreadsheet(spreadsheet, position);

    if (!existingCell) {
      return {
        success: true,
        affectedCells: [],
        spreadsheet
      };
    }

    if (existingCell.dataType === targetType) {
      return {
        success: true,
        affectedCells: [],
        spreadsheet
      };
    }

    let convertedValue = existingCell.rawValue;

    // 型変換の処理
    switch (targetType) {
      case CellDataType.TEXT:
        // そのまま文字列として扱う
        break;
      case CellDataType.NUMBER:
        const numValue = parseFloat(existingCell.rawValue);
        if (isNaN(numValue)) {
          return {
            success: false,
            error: '数値に変換できません',
            affectedCells: [],
            spreadsheet
          };
        }
        convertedValue = numValue.toString();
        break;
      case CellDataType.DATE:
        const dateValue = new Date(existingCell.rawValue);
        if (isNaN(dateValue.getTime())) {
          return {
            success: false,
            error: '日付に変換できません',
            affectedCells: [],
            spreadsheet
          };
        }
        convertedValue = dateValue.toISOString().split('T')[0];
        break;
      case CellDataType.BOOLEAN:
        const lowerValue = existingCell.rawValue.toLowerCase();
        if (lowerValue !== 'true' && lowerValue !== 'false') {
          return {
            success: false,
            error: 'ブール値に変換できません',
            affectedCells: [],
            spreadsheet
          };
        }
        convertedValue = lowerValue;
        break;
    }

    const updatedCell = updateCellValue(existingCell, convertedValue);
    const updatedSpreadsheet = setCellInSpreadsheet(spreadsheet, position, updatedCell);

    return {
      success: true,
      affectedCells: [position],
      spreadsheet: updatedSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'セル種類の変換に失敗しました',
      affectedCells: [],
      spreadsheet
    };
  }
}

/**
 * セルに自動入力（オートフィル）を適用する
 */
export function autoFillCells(
  spreadsheet: Spreadsheet,
  sourcePosition: CellPosition,
  targetPositions: CellPosition[]
): CellOperationResult {
  try {
    const sourceCell = getCellFromSpreadsheet(spreadsheet, sourcePosition);

    if (!sourceCell) {
      return {
        success: false,
        error: 'ソースセルが存在しません',
        affectedCells: [],
        spreadsheet
      };
    }

    const affectedCells: CellPosition[] = [];
    let currentSpreadsheet = spreadsheet;

    for (const targetPos of targetPositions) {
      // 簡単なオートフィル実装（数値の場合は連番、それ以外はコピー）
      let fillValue = sourceCell.rawValue;

      if (sourceCell.dataType === CellDataType.NUMBER) {
        const baseNum = parseFloat(sourceCell.rawValue);
        if (!isNaN(baseNum)) {
          const distance = Math.abs(targetPos.row - sourcePosition.row) + Math.abs(targetPos.column - sourcePosition.column);
          fillValue = (baseNum + distance).toString();
        }
      }

      const targetCell = getCellFromSpreadsheet(currentSpreadsheet, targetPos) || createEmptyCell(targetPos);
      const updatedCell = updateCellValue(targetCell, fillValue);

      // ソースセルの書式もコピー
      const formattedCell = updateCellFormat(updatedCell, sourceCell.format);

      currentSpreadsheet = setCellInSpreadsheet(currentSpreadsheet, targetPos, formattedCell);
      affectedCells.push(targetPos);
    }

    return {
      success: true,
      affectedCells,
      spreadsheet: currentSpreadsheet
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'オートフィルに失敗しました',
      affectedCells: [],
      spreadsheet
    };
  }
}