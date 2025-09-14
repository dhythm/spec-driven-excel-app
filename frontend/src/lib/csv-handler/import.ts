/**
 * CSV Import Library
 * CSVデータのスプレッドシートインポート機能を提供
 */

import { Spreadsheet, setCellInSpreadsheet, createSpreadsheet } from '../spreadsheet';
import { CellPosition, Cell, createEmptyCell, updateCellValue, CellDataType, determineCellDataType } from '../cell';
import { CSVHandler, CSVImportOptions, CSVOperationResult, createCSVHandler } from './index';

/**
 * インポートターゲットの定義
 */
export interface ImportTarget {
  position: CellPosition;
  replaceExisting: boolean;
}

/**
 * データマッピングのオプション
 */
export interface DataMappingOptions {
  autoDetectTypes: boolean;
  dateFormats: string[];
  numberFormats: {
    decimal: string;
    thousands: string;
    currency: string[];
  };
  booleanValues: {
    true: string[];
    false: string[];
  };
  emptyValues: string[];
  trimWhitespace: boolean;
  convertEncoding: boolean;
  preserveLeadingZeros: boolean;
}

/**
 * インポート検証のオプション
 */
export interface ImportValidationOptions {
  validateDataTypes: boolean;
  validateRequiredFields: boolean;
  validateUniqueness: boolean;
  validateRanges: boolean;
  maxErrors: number;
  stopOnError: boolean;
  customValidators?: { [column: number]: (value: any, row: number) => string | null };
}

/**
 * 高度なインポートオプション
 */
export interface AdvancedImportOptions extends CSVImportOptions {
  target?: ImportTarget;
  mapping?: DataMappingOptions;
  validation?: ImportValidationOptions;
  preview?: boolean;
  chunkSize?: number;
  progressCallback?: (progress: { processed: number; total: number; percentage: number }) => void;
}

/**
 * インポート結果の統計
 */
export interface ImportStatistics {
  totalRows: number;
  totalColumns: number;
  importedCells: number;
  skippedCells: number;
  errorCells: number;
  emptyRows: number;
  processingTime: number;
  dataTypeCounts: {
    text: number;
    number: number;
    date: number;
    boolean: number;
    empty: number;
    formula: number;
  };
}

/**
 * インポートエラー
 */
export interface ImportError {
  row: number;
  column: number;
  value: any;
  error: string;
  severity: 'error' | 'warning';
}

/**
 * インポート検証結果
 */
export interface ImportValidationResult {
  isValid: boolean;
  errors: ImportError[];
  warnings: ImportError[];
  statistics: ImportStatistics;
}

/**
 * CSVインポーター クラス
 */
export class CSVImporter {
  private csvHandler: CSVHandler;
  private defaultMappingOptions: DataMappingOptions;
  private defaultValidationOptions: ImportValidationOptions;

  constructor() {
    this.csvHandler = createCSVHandler();

    this.defaultMappingOptions = {
      autoDetectTypes: true,
      dateFormats: [
        'YYYY-MM-DD',
        'MM/DD/YYYY',
        'DD/MM/YYYY',
        'YYYY/MM/DD',
        'DD-MM-YYYY',
        'MM-DD-YYYY'
      ],
      numberFormats: {
        decimal: '.',
        thousands: ',',
        currency: ['$', '¥', '€', '£']
      },
      booleanValues: {
        true: ['true', 'yes', 'on', '1', 'enabled', 'active'],
        false: ['false', 'no', 'off', '0', 'disabled', 'inactive']
      },
      emptyValues: ['', 'null', 'undefined', 'n/a', 'na', '#n/a'],
      trimWhitespace: true,
      convertEncoding: true,
      preserveLeadingZeros: false
    };

    this.defaultValidationOptions = {
      validateDataTypes: true,
      validateRequiredFields: false,
      validateUniqueness: false,
      validateRanges: false,
      maxErrors: 100,
      stopOnError: false
    };
  }

  /**
   * CSVファイルをスプレッドシートにインポート
   */
  async importToSpreadsheet(
    input: string | File,
    spreadsheet: Spreadsheet,
    options: AdvancedImportOptions = {}
  ): Promise<CSVOperationResult<Spreadsheet> & { statistics: ImportStatistics; errors: ImportError[] }> {
    const startTime = performance.now();

    try {
      // CSVを解析
      const parseResult = await this.csvHandler.parseCSV(input, options);

      if (!parseResult.success || !parseResult.data) {
        return {
          success: false,
          error: parseResult.error,
          statistics: this.createEmptyStatistics(performance.now() - startTime),
          errors: []
        };
      }

      const csvData = parseResult.data.data;

      // プレビューモードの場合は最初の数行のみ処理
      const dataToProcess = options.preview ? csvData.slice(0, 10) : csvData;

      // データをインポート
      const importResult = await this.importData(
        dataToProcess,
        spreadsheet,
        options
      );

      return {
        success: importResult.success,
        data: importResult.spreadsheet,
        error: importResult.error,
        statistics: importResult.statistics,
        errors: importResult.errors
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'インポート中にエラーが発生しました',
        statistics: this.createEmptyStatistics(performance.now() - startTime),
        errors: []
      };
    }
  }

  /**
   * CSVデータから新しいスプレッドシートを作成
   */
  async importToNewSpreadsheet(
    input: string | File,
    name: string = '無題のスプレッドシート',
    options: AdvancedImportOptions = {}
  ): Promise<CSVOperationResult<Spreadsheet> & { statistics: ImportStatistics; errors: ImportError[] }> {
    const startTime = performance.now();

    try {
      // CSVを解析
      const parseResult = await this.csvHandler.parseCSV(input, options);

      if (!parseResult.success || !parseResult.data) {
        return {
          success: false,
          error: parseResult.error,
          statistics: this.createEmptyStatistics(performance.now() - startTime),
          errors: []
        };
      }

      const csvData = parseResult.data.data;

      // 適切なサイズの新しいスプレッドシートを作成
      const maxColumns = Math.max(...csvData.map(row => row.length));
      const newSpreadsheet = createSpreadsheet(name, {
        maxRows: Math.max(1000, csvData.length + 100),
        maxColumns: Math.max(26, maxColumns + 5),
        defaultRowHeight: 20,
        defaultColumnWidth: 100
      });

      // データをインポート
      const importResult = await this.importData(
        csvData,
        newSpreadsheet,
        {
          ...options,
          target: { position: { row: 0, column: 0 }, replaceExisting: true }
        }
      );

      return {
        success: importResult.success,
        data: importResult.spreadsheet,
        error: importResult.error,
        statistics: importResult.statistics,
        errors: importResult.errors
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'インポート中にエラーが発生しました',
        statistics: this.createEmptyStatistics(performance.now() - startTime),
        errors: []
      };
    }
  }

  /**
   * CSVデータを検証する
   */
  async validateImportData(
    input: string | File,
    options: AdvancedImportOptions = {}
  ): Promise<CSVOperationResult<ImportValidationResult>> {
    try {
      // CSVを解析
      const parseResult = await this.csvHandler.parseCSV(input, {
        ...options,
        preview: Math.min(options.preview || 100, 1000) // 検証は最大1000行まで
      });

      if (!parseResult.success || !parseResult.data) {
        return {
          success: false,
          error: parseResult.error
        };
      }

      const csvData = parseResult.data.data;
      const mappingOptions = { ...this.defaultMappingOptions, ...options.mapping };
      const validationOptions = { ...this.defaultValidationOptions, ...options.validation };

      const validationResult = this.performValidation(csvData, mappingOptions, validationOptions);

      return {
        success: true,
        data: validationResult
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '検証中にエラーが発生しました'
      };
    }
  }

  /**
   * データをインポートする内部メソッド
   */
  private async importData(
    csvData: any[][],
    spreadsheet: Spreadsheet,
    options: AdvancedImportOptions
  ): Promise<{
    success: boolean;
    spreadsheet: Spreadsheet;
    error?: string;
    statistics: ImportStatistics;
    errors: ImportError[];
  }> {
    const startTime = performance.now();
    const mappingOptions = { ...this.defaultMappingOptions, ...options.mapping };
    const validationOptions = { ...this.defaultValidationOptions, ...options.validation };
    const target = options.target || { position: { row: 0, column: 0 }, replaceExisting: false };

    let currentSpreadsheet = spreadsheet;
    const errors: ImportError[] = [];
    const statistics = this.createEmptyStatistics(0);

    statistics.totalRows = csvData.length;
    statistics.totalColumns = Math.max(...csvData.map(row => row.length));

    let processedRows = 0;

    try {
      for (let rowIndex = 0; rowIndex < csvData.length; rowIndex++) {
        const row = csvData[rowIndex];
        const targetRow = target.position.row + rowIndex;

        // 行が空の場合
        if (!row || row.length === 0) {
          statistics.emptyRows++;
          continue;
        }

        let hasData = false;

        for (let colIndex = 0; colIndex < row.length; colIndex++) {
          const rawValue = row[colIndex];
          const targetCol = target.position.column + colIndex;
          const targetPosition = { row: targetRow, column: targetCol };

          // 範囲外チェック
          if (targetRow >= currentSpreadsheet.rowCount ||
              targetCol >= currentSpreadsheet.columnCount) {
            errors.push({
              row: rowIndex + 1,
              column: colIndex + 1,
              value: rawValue,
              error: 'ターゲット位置がスプレッドシートの範囲外です',
              severity: 'error'
            });
            statistics.skippedCells++;
            continue;
          }

          // 値を処理
          const processedValue = this.processValue(rawValue, mappingOptions);

          if (this.isEmpty(processedValue, mappingOptions)) {
            statistics.dataTypeCounts.empty++;
            statistics.skippedCells++;
            continue;
          }

          hasData = true;

          // 既存のセルがある場合の処理
          if (!target.replaceExisting) {
            const existingCell = currentSpreadsheet.cells.get(`${targetRow}-${targetCol}`);
            if (existingCell && existingCell.rawValue !== '') {
              statistics.skippedCells++;
              continue;
            }
          }

          try {
            // セルを作成
            let cell = createEmptyCell(targetPosition);
            cell = updateCellValue(cell, String(processedValue));

            // データ型を記録
            this.recordDataType(cell.dataType, statistics);

            // 検証を実行
            if (validationOptions.validateDataTypes) {
              const validationError = this.validateCellValue(
                processedValue,
                cell.dataType,
                rowIndex,
                colIndex,
                validationOptions
              );

              if (validationError) {
                errors.push(validationError);
                if (validationError.severity === 'error') {
                  statistics.errorCells++;
                  if (validationOptions.stopOnError) {
                    return {
                      success: false,
                      spreadsheet: currentSpreadsheet,
                      error: `行 ${rowIndex + 1}, 列 ${colIndex + 1} で検証エラー: ${validationError.error}`,
                      statistics,
                      errors
                    };
                  }
                }
              }
            }

            // スプレッドシートにセルを設定
            currentSpreadsheet = setCellInSpreadsheet(currentSpreadsheet, targetPosition, cell);
            statistics.importedCells++;

          } catch (cellError) {
            errors.push({
              row: rowIndex + 1,
              column: colIndex + 1,
              value: rawValue,
              error: cellError instanceof Error ? cellError.message : 'セル作成エラー',
              severity: 'error'
            });
            statistics.errorCells++;
          }

          // エラー数の上限チェック
          if (errors.length >= validationOptions.maxErrors) {
            return {
              success: false,
              spreadsheet: currentSpreadsheet,
              error: `エラー数が上限（${validationOptions.maxErrors}）に達しました`,
              statistics,
              errors
            };
          }
        }

        if (!hasData) {
          statistics.emptyRows++;
        }

        processedRows++;

        // 進捗コールバック
        if (options.progressCallback && processedRows % 100 === 0) {
          options.progressCallback({
            processed: processedRows,
            total: csvData.length,
            percentage: (processedRows / csvData.length) * 100
          });
        }
      }

      statistics.processingTime = performance.now() - startTime;

      // 最終的な進捗報告
      if (options.progressCallback) {
        options.progressCallback({
          processed: processedRows,
          total: csvData.length,
          percentage: 100
        });
      }

      const hasErrors = errors.some(error => error.severity === 'error');

      return {
        success: !hasErrors,
        spreadsheet: currentSpreadsheet,
        error: hasErrors ? `${errors.length}個のエラーが発生しました` : undefined,
        statistics,
        errors
      };

    } catch (error) {
      statistics.processingTime = performance.now() - startTime;
      return {
        success: false,
        spreadsheet: currentSpreadsheet,
        error: error instanceof Error ? error.message : 'インポート処理中にエラーが発生しました',
        statistics,
        errors
      };
    }
  }

  /**
   * 値を処理する
   */
  private processValue(value: any, options: DataMappingOptions): any {
    if (value === null || value === undefined) {
      return '';
    }

    let processedValue = String(value);

    // ホワイトスペースのトリム
    if (options.trimWhitespace) {
      processedValue = processedValue.trim();
    }

    // 空の値の処理
    if (this.isEmpty(processedValue, options)) {
      return '';
    }

    // 自動型検出
    if (options.autoDetectTypes) {
      return this.convertToAppropriateType(processedValue, options);
    }

    return processedValue;
  }

  /**
   * 値が空かどうかを判定する
   */
  private isEmpty(value: any, options: DataMappingOptions): boolean {
    const stringValue = String(value).toLowerCase().trim();
    return options.emptyValues.some(emptyValue =>
      stringValue === emptyValue.toLowerCase()
    );
  }

  /**
   * 適切な型に変換する
   */
  private convertToAppropriateType(value: string, options: DataMappingOptions): any {
    // ブール値チェック
    const lowerValue = value.toLowerCase();
    if (options.booleanValues.true.includes(lowerValue)) {
      return 'TRUE';
    }
    if (options.booleanValues.false.includes(lowerValue)) {
      return 'FALSE';
    }

    // 数値チェック
    if (this.isNumber(value, options)) {
      return this.parseNumber(value, options);
    }

    // 日付チェック
    if (this.isDate(value, options)) {
      return this.parseDate(value, options);
    }

    // デフォルトは文字列
    return value;
  }

  /**
   * 数値かどうかを判定する
   */
  private isNumber(value: string, options: DataMappingOptions): boolean {
    // 通貨記号を除去
    let cleanValue = value;
    for (const currency of options.numberFormats.currency) {
      cleanValue = cleanValue.replace(new RegExp(`\\${currency}`, 'g'), '');
    }

    // 千の位区切り文字を除去
    cleanValue = cleanValue.replace(new RegExp(`\\${options.numberFormats.thousands}`, 'g'), '');

    // 小数点文字を標準形式に変換
    if (options.numberFormats.decimal !== '.') {
      cleanValue = cleanValue.replace(new RegExp(`\\${options.numberFormats.decimal}`, 'g'), '.');
    }

    return !isNaN(Number(cleanValue)) && isFinite(Number(cleanValue));
  }

  /**
   * 数値を解析する
   */
  private parseNumber(value: string, options: DataMappingOptions): number {
    let cleanValue = value;

    // 通貨記号を除去
    for (const currency of options.numberFormats.currency) {
      cleanValue = cleanValue.replace(new RegExp(`\\${currency}`, 'g'), '');
    }

    // 千の位区切り文字を除去
    cleanValue = cleanValue.replace(new RegExp(`\\${options.numberFormats.thousands}`, 'g'), '');

    // 小数点文字を標準形式に変換
    if (options.numberFormats.decimal !== '.') {
      cleanValue = cleanValue.replace(new RegExp(`\\${options.numberFormats.decimal}`, 'g'), '.');
    }

    return Number(cleanValue);
  }

  /**
   * 日付かどうかを判定する
   */
  private isDate(value: string, options: DataMappingOptions): boolean {
    // 簡易的な日付パターンチェック
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{1,2}\/\d{1,2}\/\d{4}$/,
      /^\d{1,2}-\d{1,2}-\d{4}$/,
      /^\d{4}\/\d{1,2}\/\d{1,2}$/
    ];

    if (datePatterns.some(pattern => pattern.test(value))) {
      const date = new Date(value);
      return !isNaN(date.getTime());
    }

    return false;
  }

  /**
   * 日付を解析する
   */
  private parseDate(value: string, options: DataMappingOptions): string {
    const date = new Date(value);
    return isNaN(date.getTime()) ? value : date.toISOString().split('T')[0];
  }

  /**
   * セル値を検証する
   */
  private validateCellValue(
    value: any,
    dataType: CellDataType,
    row: number,
    column: number,
    options: ImportValidationOptions
  ): ImportError | null {
    // カスタムバリデータ
    if (options.customValidators && options.customValidators[column]) {
      const customError = options.customValidators[column](value, row);
      if (customError) {
        return {
          row: row + 1,
          column: column + 1,
          value,
          error: customError,
          severity: 'error'
        };
      }
    }

    // データ型検証
    if (options.validateDataTypes) {
      const expectedType = determineCellDataType(String(value));
      if (expectedType !== dataType && dataType !== CellDataType.TEXT) {
        return {
          row: row + 1,
          column: column + 1,
          value,
          error: `データ型が不正です（期待: ${expectedType}, 実際: ${dataType}）`,
          severity: 'warning'
        };
      }
    }

    return null;
  }

  /**
   * データ型を統計に記録する
   */
  private recordDataType(dataType: CellDataType, statistics: ImportStatistics): void {
    switch (dataType) {
      case CellDataType.TEXT:
        statistics.dataTypeCounts.text++;
        break;
      case CellDataType.NUMBER:
        statistics.dataTypeCounts.number++;
        break;
      case CellDataType.DATE:
        statistics.dataTypeCounts.date++;
        break;
      case CellDataType.BOOLEAN:
        statistics.dataTypeCounts.boolean++;
        break;
      case CellDataType.FORMULA:
        statistics.dataTypeCounts.formula++;
        break;
      case CellDataType.EMPTY:
        statistics.dataTypeCounts.empty++;
        break;
    }
  }

  /**
   * 検証を実行する
   */
  private performValidation(
    csvData: any[][],
    mappingOptions: DataMappingOptions,
    validationOptions: ImportValidationOptions
  ): ImportValidationResult {
    const errors: ImportError[] = [];
    const warnings: ImportError[] = [];
    const statistics = this.createEmptyStatistics(0);

    statistics.totalRows = csvData.length;
    statistics.totalColumns = Math.max(...csvData.map(row => row.length));

    for (let rowIndex = 0; rowIndex < csvData.length; rowIndex++) {
      const row = csvData[rowIndex];

      if (!row || row.length === 0) {
        statistics.emptyRows++;
        continue;
      }

      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        const rawValue = row[colIndex];
        const processedValue = this.processValue(rawValue, mappingOptions);

        if (this.isEmpty(processedValue, mappingOptions)) {
          statistics.dataTypeCounts.empty++;
          continue;
        }

        const dataType = determineCellDataType(String(processedValue));
        this.recordDataType(dataType, statistics);

        const validationError = this.validateCellValue(
          processedValue,
          dataType,
          rowIndex,
          colIndex,
          validationOptions
        );

        if (validationError) {
          if (validationError.severity === 'error') {
            errors.push(validationError);
          } else {
            warnings.push(validationError);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      statistics
    };
  }

  /**
   * 空の統計情報を作成する
   */
  private createEmptyStatistics(processingTime: number): ImportStatistics {
    return {
      totalRows: 0,
      totalColumns: 0,
      importedCells: 0,
      skippedCells: 0,
      errorCells: 0,
      emptyRows: 0,
      processingTime,
      dataTypeCounts: {
        text: 0,
        number: 0,
        date: 0,
        boolean: 0,
        empty: 0,
        formula: 0
      }
    };
  }
}

/**
 * デフォルトのCSVインポーターを作成する
 */
export function createCSVImporter(): CSVImporter {
  return new CSVImporter();
}

/**
 * CSVファイルをスプレッドシートにインポートする（シンプルな関数版）
 */
export async function importCSVToSpreadsheet(
  input: string | File,
  spreadsheet: Spreadsheet,
  options: AdvancedImportOptions = {}
): Promise<CSVOperationResult<Spreadsheet> & { statistics: ImportStatistics; errors: ImportError[] }> {
  const importer = createCSVImporter();
  return await importer.importToSpreadsheet(input, spreadsheet, options);
}

/**
 * CSVファイルから新しいスプレッドシートを作成する（シンプルな関数版）
 */
export async function createSpreadsheetFromCSV(
  input: string | File,
  name?: string,
  options: AdvancedImportOptions = {}
): Promise<CSVOperationResult<Spreadsheet> & { statistics: ImportStatistics; errors: ImportError[] }> {
  const importer = createCSVImporter();
  return await importer.importToNewSpreadsheet(input, name, options);
}