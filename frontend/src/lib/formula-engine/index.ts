/**
 * Formula Engine Library
 * HyperFormulaのラッパーライブラリ
 */

import { HyperFormula } from 'hyperformula';
import { CellPosition } from '../cell';
import { Spreadsheet } from '../spreadsheet';

/**
 * 数式エンジンの設定
 */
export interface FormulaEngineConfig {
  licenseKey?: string;
  useColumnIndex?: boolean;
  useArrayArithmetic?: boolean;
  useStats?: boolean;
  precisionEpsilon?: number;
  precisionRounding?: number;
  smartRounding?: boolean;
  matrixDetection?: boolean;
  matrixDetectionThreshold?: number;
  dateFormats?: string[];
  timeFormats?: string[];
  functionArgSeparator?: string;
  arrayColumnSeparator?: string;
  arrayRowSeparator?: string;
}

/**
 * 数式計算の結果
 */
export interface FormulaCalculationResult {
  success: boolean;
  value?: any;
  displayValue?: string;
  error?: {
    type: string;
    message: string;
  };
}

/**
 * 数式エンジンクラス
 */
export class SpreadsheetFormulaEngine {
  private engine: HyperFormula;
  private sheetId: number = 0;

  constructor(config: FormulaEngineConfig = {}) {
    const defaultConfig = {
      licenseKey: 'gpl-v3',
      useColumnIndex: true,
      useArrayArithmetic: true,
      useStats: true,
      precisionEpsilon: 1e-13,
      precisionRounding: 14,
      smartRounding: true,
      matrixDetection: false,
      functionArgSeparator: ',',
      arrayColumnSeparator: ',',
      arrayRowSeparator: ';',
      ...config
    };

    try {
      this.engine = HyperFormula.buildEmpty(defaultConfig);
      this.sheetId = this.engine.addSheet('Sheet1');
    } catch (error) {
      throw new Error(`数式エンジンの初期化に失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * スプレッドシートデータを数式エンジンに設定する
   */
  setSpreadsheetData(spreadsheet: Spreadsheet): void {
    try {
      // 既存のデータをクリア
      this.engine.clearSheet(this.sheetId);

      // セルデータを設定
      const cellsData: any[][] = [];

      // 行と列の最大値を取得
      let maxRow = 0;
      let maxCol = 0;
      for (const [key] of spreadsheet.cells) {
        const [rowStr, colStr] = key.split('-');
        const row = parseInt(rowStr, 10);
        const col = parseInt(colStr, 10);
        maxRow = Math.max(maxRow, row);
        maxCol = Math.max(maxCol, col);
      }

      // 2次元配列を初期化
      for (let i = 0; i <= maxRow; i++) {
        cellsData[i] = new Array(maxCol + 1).fill(null);
      }

      // セルデータを配列に設定
      for (const [key, cell] of spreadsheet.cells) {
        const [rowStr, colStr] = key.split('-');
        const row = parseInt(rowStr, 10);
        const col = parseInt(colStr, 10);

        let value: any = null;

        if (cell.rawValue) {
          if (cell.dataType === 'formula') {
            // 数式の場合
            value = cell.rawValue;
          } else if (cell.dataType === 'number') {
            // 数値の場合
            const numValue = parseFloat(cell.rawValue);
            value = isNaN(numValue) ? cell.rawValue : numValue;
          } else if (cell.dataType === 'boolean') {
            // ブール値の場合
            value = cell.rawValue.toLowerCase() === 'true';
          } else if (cell.dataType === 'date') {
            // 日付の場合
            const dateValue = new Date(cell.rawValue);
            value = isNaN(dateValue.getTime()) ? cell.rawValue : dateValue;
          } else {
            // その他（テキスト）の場合
            value = cell.rawValue;
          }
        }

        cellsData[row][col] = value;
      }

      // データを一括設定
      this.engine.setSheetContent(this.sheetId, cellsData);
    } catch (error) {
      throw new Error(`スプレッドシートデータの設定に失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 指定されたセルの値を計算する
   */
  calculateCell(position: CellPosition): FormulaCalculationResult {
    try {
      const value = this.engine.getCellValue({ sheet: this.sheetId, row: position.row, col: position.column });

      if (this.engine.isCellEmpty({ sheet: this.sheetId, row: position.row, col: position.column })) {
        return {
          success: true,
          value: null,
          displayValue: ''
        };
      }

      // エラーチェック
      if (typeof value === 'object' && value !== null && 'error' in value) {
        return {
          success: false,
          error: {
            type: (value as any).error || 'CALCULATION_ERROR',
            message: this.getErrorMessage((value as any).error)
          }
        };
      }

      // 表示値を生成
      const displayValue = this.formatValueForDisplay(value);

      return {
        success: true,
        value,
        displayValue
      };
    } catch (error) {
      return {
        success: false,
        error: {
          type: 'CALCULATION_ERROR',
          message: error instanceof Error ? error.message : 'セル計算中にエラーが発生しました'
        }
      };
    }
  }

  /**
   * セルの値を設定する
   */
  setCellValue(position: CellPosition, value: any): FormulaCalculationResult {
    try {
      this.engine.setCellContents({ sheet: this.sheetId, row: position.row, col: position.column }, value);

      // 設定した値を取得して確認
      return this.calculateCell(position);
    } catch (error) {
      return {
        success: false,
        error: {
          type: 'SET_VALUE_ERROR',
          message: error instanceof Error ? error.message : 'セル値の設定中にエラーが発生しました'
        }
      };
    }
  }

  /**
   * 数式を評価する
   */
  evaluateFormula(formula: string, contextPosition?: CellPosition): FormulaCalculationResult {
    try {
      // 一時的なセルを使用して数式を評価
      const tempPosition = contextPosition || { row: 0, column: 0 };

      // 数式が=で始まっていない場合は追加
      const formulaToEvaluate = formula.startsWith('=') ? formula : `=${formula}`;

      const result = this.setCellValue(tempPosition, formulaToEvaluate);

      // 一時セルをクリア（contextPositionが指定されていない場合のみ）
      if (!contextPosition) {
        this.engine.setCellContents({ sheet: this.sheetId, row: tempPosition.row, col: tempPosition.column }, null);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: {
          type: 'FORMULA_EVALUATION_ERROR',
          message: error instanceof Error ? error.message : '数式の評価中にエラーが発生しました'
        }
      };
    }
  }

  /**
   * セル範囲の値を取得する
   */
  getCellRangeValues(
    startPosition: CellPosition,
    endPosition: CellPosition
  ): FormulaCalculationResult & { values?: any[][] } {
    try {
      const values: any[][] = [];

      for (let row = startPosition.row; row <= endPosition.row; row++) {
        const rowValues: any[] = [];
        for (let col = startPosition.column; col <= endPosition.column; col++) {
          const result = this.calculateCell({ row, column: col });
          rowValues.push(result.success ? result.value : null);
        }
        values.push(rowValues);
      }

      return {
        success: true,
        values
      };
    } catch (error) {
      return {
        success: false,
        error: {
          type: 'RANGE_CALCULATION_ERROR',
          message: error instanceof Error ? error.message : 'セル範囲の計算中にエラーが発生しました'
        }
      };
    }
  }

  /**
   * セルの数式を取得する
   */
  getCellFormula(position: CellPosition): string | null {
    try {
      const formula = this.engine.getCellFormula({ sheet: this.sheetId, row: position.row, col: position.column });
      return formula || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * セルの依存関係を取得する
   */
  getCellDependencies(position: CellPosition): CellPosition[] {
    try {
      const dependencies = this.engine.getCellDependencies({ sheet: this.sheetId, row: position.row, col: position.column });

      return dependencies.map(dep => ({
        row: dep.row,
        column: dep.col
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * セルに依存しているセルを取得する
   */
  getCellPrecedents(position: CellPosition): CellPosition[] {
    try {
      const precedents = this.engine.getCellPrecedents({ sheet: this.sheetId, row: position.row, col: position.column });

      return precedents.map(prec => ({
        row: prec.row,
        column: prec.col
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * 利用可能な関数のリストを取得する
   */
  getAvailableFunctions(): string[] {
    try {
      return this.engine.getFunctionNames();
    } catch (error) {
      return [];
    }
  }

  /**
   * 数式エンジンの統計情報を取得する
   */
  getEngineStats(): {
    cellsCount: number;
    formulasCount: number;
    functionsUsed: string[];
  } {
    try {
      const stats = this.engine.getStats();
      return {
        cellsCount: stats.totalCells || 0,
        formulasCount: stats.formulaCells || 0,
        functionsUsed: stats.functions || []
      };
    } catch (error) {
      return {
        cellsCount: 0,
        formulasCount: 0,
        functionsUsed: []
      };
    }
  }

  /**
   * エンジンを破棄する
   */
  destroy(): void {
    try {
      this.engine.destroy();
    } catch (error) {
      // エンジンの破棄でエラーが発生しても無視
    }
  }

  /**
   * エラーメッセージを取得する
   */
  private getErrorMessage(errorType: string): string {
    const errorMessages: { [key: string]: string } = {
      'DIV/0': 'ゼロで除算しようとしました',
      'VALUE': '数値が必要な場所に文字列が入力されています',
      'REF': '無効な参照です',
      'NAME': '認識されない関数または名前です',
      'NUM': '数値エラーです',
      'N/A': '値が利用できません',
      'GETTING_DATA': 'データを取得中です',
      'SPILL': '数式の結果が隣接するセルに溢れました',
      'CALC': '計算エラーが発生しました',
      'CYCLE': '循環参照が検出されました'
    };

    return errorMessages[errorType] || `エラー: ${errorType}`;
  }

  /**
   * 値を表示用の文字列に変換する
   */
  private formatValueForDisplay(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'number') {
      // 数値の場合
      if (Number.isInteger(value)) {
        return value.toString();
      } else {
        // 小数点以下の桁数を適切に調整
        const decimalPlaces = value.toString().split('.')[1]?.length || 0;
        return value.toFixed(Math.min(decimalPlaces, 10));
      }
    }

    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }

    if (value instanceof Date) {
      return value.toLocaleDateString();
    }

    return value.toString();
  }

  /**
   * セルの型を取得する
   */
  getCellValueType(position: CellPosition): string {
    try {
      const value = this.engine.getCellValue({ sheet: this.sheetId, row: position.row, col: position.column });

      if (value === null || value === undefined) {
        return 'empty';
      }

      if (typeof value === 'number') {
        return 'number';
      }

      if (typeof value === 'boolean') {
        return 'boolean';
      }

      if (value instanceof Date) {
        return 'date';
      }

      if (typeof value === 'object' && 'error' in value) {
        return 'error';
      }

      return 'text';
    } catch (error) {
      return 'error';
    }
  }

  /**
   * バッチでセル値を設定する
   */
  setBatchCellValues(updates: { position: CellPosition; value: any }[]): FormulaCalculationResult[] {
    const results: FormulaCalculationResult[] = [];

    // バッチ更新のためのデータを準備
    const changes: Array<{
      sheet: number;
      row: number;
      col: number;
      value: any;
    }> = updates.map(update => ({
      sheet: this.sheetId,
      row: update.position.row,
      col: update.position.column,
      value: update.value
    }));

    try {
      // バッチで更新を実行
      this.engine.batch(() => {
        changes.forEach(change => {
          this.engine.setCellContents(
            { sheet: change.sheet, row: change.row, col: change.col },
            change.value
          );
        });
      });

      // 各セルの結果を取得
      updates.forEach(update => {
        const result = this.calculateCell(update.position);
        results.push(result);
      });

      return results;
    } catch (error) {
      // エラーが発生した場合、全ての結果をエラーとして返す
      return updates.map(() => ({
        success: false,
        error: {
          type: 'BATCH_UPDATE_ERROR',
          message: error instanceof Error ? error.message : 'バッチ更新中にエラーが発生しました'
        }
      }));
    }
  }
}

/**
 * デフォルトの数式エンジンインスタンスを作成する
 */
export function createFormulaEngine(config?: FormulaEngineConfig): SpreadsheetFormulaEngine {
  return new SpreadsheetFormulaEngine(config);
}

/**
 * 数式の構文チェックを行う
 */
export function validateFormulaSyntax(formula: string): { isValid: boolean; error?: string } {
  try {
    const tempEngine = createFormulaEngine();
    const result = tempEngine.evaluateFormula(formula);
    tempEngine.destroy();

    if (result.success) {
      return { isValid: true };
    } else {
      return {
        isValid: false,
        error: result.error?.message || '数式の構文が正しくありません'
      };
    }
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : '数式の検証中にエラーが発生しました'
    };
  }
}