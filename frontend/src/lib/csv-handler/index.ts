/**
 * CSV Handler Library
 * Papa ParseのラッパーライブラリでCSVの読み書きを統合管理
 */

import Papa from 'papaparse';
import { Spreadsheet } from '../spreadsheet';
import { CellPosition } from '../cell';

/**
 * CSV処理の設定
 */
export interface CSVConfig {
  delimiter?: string;
  newline?: string;
  quoteChar?: string;
  escapeChar?: string;
  header?: boolean;
  skipEmptyLines?: boolean | 'greedy';
  transform?: (value: string, header: string | number) => any;
  transformHeader?: (header: string) => string;
  dynamicTyping?: boolean;
  encoding?: string;
  worker?: boolean;
  comments?: string | boolean;
  step?: (results: Papa.ParseResult<any>, parser: Papa.Parser) => void;
  complete?: (results: Papa.ParseResult<any>) => void;
  error?: (error: Papa.ParseError, file?: File) => void;
  download?: boolean;
  downloadRequestHeaders?: { [headerName: string]: string };
  downloadRequestBody?: string | FormData;
  chunk?: (results: Papa.ParseResult<any>, parser: Papa.Parser) => void;
  beforeFirstChunk?: (chunk: string) => string | void;
  withCredentials?: boolean;
  preview?: number;
  fastMode?: boolean;
}

/**
 * CSV操作の結果
 */
export interface CSVOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
  rowCount?: number;
  columnCount?: number;
  processingTime?: number;
}

/**
 * CSVインポートのオプション
 */
export interface CSVImportOptions extends CSVConfig {
  targetPosition?: CellPosition;
  replaceExisting?: boolean;
  includeHeaders?: boolean;
  maxRows?: number;
  maxColumns?: number;
  dateFormats?: string[];
  numberFormats?: string[];
  booleanValues?: { true: string[]; false: string[] };
}

/**
 * CSVエクスポートのオプション
 */
export interface CSVExportOptions extends CSVConfig {
  range?: {
    start: CellPosition;
    end: CellPosition;
  };
  includeHeaders?: boolean;
  includeFormulas?: boolean;
  includeFormattedValues?: boolean;
  emptyValue?: string;
  filename?: string;
}

/**
 * CSV検証の結果
 */
export interface CSVValidationResult {
  isValid: boolean;
  errors: Array<{
    row: number;
    column: number;
    message: string;
    severity: 'error' | 'warning';
  }>;
  summary: {
    totalRows: number;
    totalColumns: number;
    emptyRows: number;
    emptyColumns: number;
    dataTypes: { [column: number]: string };
  };
}

/**
 * CSV Handler クラス
 */
export class CSVHandler {
  private defaultConfig: CSVConfig;

  constructor(config: CSVConfig = {}) {
    this.defaultConfig = {
      delimiter: '',  // 自動検出
      newline: '',    // 自動検出
      quoteChar: '"',
      escapeChar: '"',
      header: false,
      skipEmptyLines: false,
      dynamicTyping: false,
      encoding: '',   // 自動検出
      worker: false,
      comments: false,
      preview: 0,
      fastMode: undefined,
      ...config
    };
  }

  /**
   * CSVファイルを解析する
   */
  async parseCSV(
    input: string | File,
    options: CSVImportOptions = {}
  ): Promise<CSVOperationResult<Papa.ParseResult<any>>> {
    const startTime = performance.now();

    try {
      const config = { ...this.defaultConfig, ...options };

      return new Promise((resolve) => {
        const parseConfig: Papa.ParseConfig<any> = {
          ...config,
          complete: (results: Papa.ParseResult<any>) => {
            const processingTime = performance.now() - startTime;

            if (results.errors && results.errors.length > 0) {
              const warnings = results.errors
                .filter(error => error.type === 'Quotes')
                .map(error => error.message);

              const criticalErrors = results.errors
                .filter(error => error.type !== 'Quotes')
                .map(error => error.message);

              if (criticalErrors.length > 0) {
                resolve({
                  success: false,
                  error: criticalErrors[0],
                  warnings,
                  processingTime
                });
                return;
              }

              resolve({
                success: true,
                data: results,
                warnings,
                rowCount: results.data.length,
                columnCount: results.data.length > 0 ? results.data[0].length : 0,
                processingTime
              });
            } else {
              resolve({
                success: true,
                data: results,
                rowCount: results.data.length,
                columnCount: results.data.length > 0 ? results.data[0].length : 0,
                processingTime
              });
            }
          },
          error: (error: Papa.ParseError) => {
            resolve({
              success: false,
              error: error.message,
              processingTime: performance.now() - startTime
            });
          }
        };

        Papa.parse(input, parseConfig);
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'CSV解析中にエラーが発生しました',
        processingTime: performance.now() - startTime
      };
    }
  }

  /**
   * データをCSV形式に変換する
   */
  async convertToCSV(
    data: any[][],
    options: CSVExportOptions = {}
  ): Promise<CSVOperationResult<string>> {
    const startTime = performance.now();

    try {
      const config = { ...this.defaultConfig, ...options };

      const csvString = Papa.unparse(data, {
        delimiter: config.delimiter || ',',
        newline: config.newline || '\r\n',
        quoteChar: config.quoteChar || '"',
        escapeChar: config.escapeChar || '"',
        header: config.includeHeaders || false,
        skipEmptyLines: config.skipEmptyLines || false,
        transform: config.transform,
        transformHeader: config.transformHeader,
        comments: config.comments || false
      });

      const processingTime = performance.now() - startTime;

      return {
        success: true,
        data: csvString,
        rowCount: data.length,
        columnCount: data.length > 0 ? data[0].length : 0,
        processingTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'CSV変換中にエラーが発生しました',
        processingTime: performance.now() - startTime
      };
    }
  }

  /**
   * CSVデータを検証する
   */
  validateCSV(data: any[][]): CSVValidationResult {
    const errors: Array<{
      row: number;
      column: number;
      message: string;
      severity: 'error' | 'warning';
    }> = [];

    if (!data || data.length === 0) {
      return {
        isValid: false,
        errors: [{
          row: 0,
          column: 0,
          message: 'CSVデータが空です',
          severity: 'error'
        }],
        summary: {
          totalRows: 0,
          totalColumns: 0,
          emptyRows: 0,
          emptyColumns: 0,
          dataTypes: {}
        }
      };
    }

    const totalRows = data.length;
    const totalColumns = Math.max(...data.map(row => row.length));
    let emptyRows = 0;
    const columnEmptyCounts = new Array(totalColumns).fill(0);
    const dataTypes: { [column: number]: string } = {};

    // 各行をチェック
    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex];

      if (!row || row.length === 0) {
        emptyRows++;
        errors.push({
          row: rowIndex + 1,
          column: 0,
          message: '空の行です',
          severity: 'warning'
        });
        continue;
      }

      let rowIsEmpty = true;

      // 各列をチェック
      for (let colIndex = 0; colIndex < totalColumns; colIndex++) {
        const value = row[colIndex];

        if (value === null || value === undefined || value === '') {
          columnEmptyCounts[colIndex]++;
        } else {
          rowIsEmpty = false;

          // データ型を判定
          if (!dataTypes[colIndex]) {
            dataTypes[colIndex] = this.detectDataType(value);
          } else if (dataTypes[colIndex] !== this.detectDataType(value)) {
            // 型が混在している場合は警告
            if (dataTypes[colIndex] !== 'mixed') {
              dataTypes[colIndex] = 'mixed';
              errors.push({
                row: rowIndex + 1,
                column: colIndex + 1,
                message: `列 ${colIndex + 1} で複数のデータ型が混在しています`,
                severity: 'warning'
              });
            }
          }
        }
      }

      if (rowIsEmpty) {
        emptyRows++;
      }

      // 列数の不整合をチェック
      if (row.length !== totalColumns) {
        errors.push({
          row: rowIndex + 1,
          column: 0,
          message: `列数が不正です（期待: ${totalColumns}, 実際: ${row.length}）`,
          severity: 'warning'
        });
      }
    }

    // 空の列をカウント
    const emptyColumns = columnEmptyCounts.filter(count => count === totalRows).length;

    // 大部分が空の列に対する警告
    for (let colIndex = 0; colIndex < totalColumns; colIndex++) {
      const emptyRatio = columnEmptyCounts[colIndex] / totalRows;
      if (emptyRatio > 0.8 && emptyRatio < 1) {
        errors.push({
          row: 0,
          column: colIndex + 1,
          message: `列 ${colIndex + 1} の ${Math.round(emptyRatio * 100)}% が空です`,
          severity: 'warning'
        });
      }
    }

    const criticalErrors = errors.filter(error => error.severity === 'error');

    return {
      isValid: criticalErrors.length === 0,
      errors,
      summary: {
        totalRows,
        totalColumns,
        emptyRows,
        emptyColumns,
        dataTypes
      }
    };
  }

  /**
   * CSVファイルの詳細情報を取得する
   */
  async analyzeCSV(
    input: string | File,
    options: CSVImportOptions = {}
  ): Promise<CSVOperationResult<{
    delimiter: string;
    lineEnding: string;
    encoding: string;
    hasHeader: boolean;
    preview: any[][];
    statistics: {
      totalRows: number;
      totalColumns: number;
      emptyValues: number;
      uniqueValuesPerColumn: number[];
    };
  }>> {
    try {
      // まずはプレビューで分析
      const previewResult = await this.parseCSV(input, {
        ...options,
        preview: 10,
        header: false
      });

      if (!previewResult.success || !previewResult.data) {
        return {
          success: false,
          error: previewResult.error
        };
      }

      const preview = previewResult.data.data;
      const delimiter = previewResult.data.meta.delimiter;
      const lineEnding = previewResult.data.meta.linebreak;

      // ヘッダーの存在を推測
      const hasHeader = this.detectHeader(preview);

      // 統計情報を計算
      const statistics = this.calculateStatistics(preview);

      return {
        success: true,
        data: {
          delimiter,
          lineEnding,
          encoding: 'UTF-8', // ブラウザでは自動検出
          hasHeader,
          preview,
          statistics
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'CSV分析中にエラーが発生しました'
      };
    }
  }

  /**
   * CSVデータをダウンロード用のBlob URLに変換する
   */
  createDownloadUrl(csvContent: string, filename: string = 'data.csv'): string {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    return url;
  }

  /**
   * CSVファイルをダウンロードする
   */
  downloadCSV(csvContent: string, filename: string = 'data.csv'): void {
    try {
      const url = this.createDownloadUrl(csvContent, filename);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      throw new Error(`CSVファイルのダウンロードに失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * データ型を検出する
   */
  private detectDataType(value: any): string {
    if (value === null || value === undefined || value === '') {
      return 'empty';
    }

    const stringValue = String(value).trim();

    // 数値チェック
    if (!isNaN(Number(stringValue)) && isFinite(Number(stringValue))) {
      return Number.isInteger(Number(stringValue)) ? 'integer' : 'float';
    }

    // 日付チェック（簡易）
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{1,2}\/\d{1,2}\/\d{4}$/,
      /^\d{4}\/\d{1,2}\/\d{1,2}$/
    ];
    if (datePatterns.some(pattern => pattern.test(stringValue))) {
      const date = new Date(stringValue);
      if (!isNaN(date.getTime())) {
        return 'date';
      }
    }

    // ブール値チェック
    const lowerValue = stringValue.toLowerCase();
    if (['true', 'false', 'yes', 'no', '1', '0', 'on', 'off'].includes(lowerValue)) {
      return 'boolean';
    }

    return 'text';
  }

  /**
   * ヘッダーの存在を推測する
   */
  private detectHeader(preview: any[][]): boolean {
    if (preview.length < 2) {
      return false;
    }

    const firstRow = preview[0];
    const secondRow = preview[1];

    // 最初の行がすべて文字列で、2行目に数値が含まれている場合はヘッダーの可能性が高い
    let firstRowAllText = true;
    let secondRowHasNumbers = false;

    for (let i = 0; i < Math.min(firstRow.length, secondRow.length); i++) {
      if (firstRow[i] && !isNaN(Number(firstRow[i]))) {
        firstRowAllText = false;
      }
      if (secondRow[i] && !isNaN(Number(secondRow[i]))) {
        secondRowHasNumbers = true;
      }
    }

    return firstRowAllText && secondRowHasNumbers;
  }

  /**
   * 統計情報を計算する
   */
  private calculateStatistics(data: any[][]): {
    totalRows: number;
    totalColumns: number;
    emptyValues: number;
    uniqueValuesPerColumn: number[];
  } {
    const totalRows = data.length;
    const totalColumns = Math.max(...data.map(row => row.length));
    let emptyValues = 0;
    const uniqueValuesPerColumn: number[] = [];

    for (let col = 0; col < totalColumns; col++) {
      const columnValues = new Set();

      for (let row = 0; row < totalRows; row++) {
        const value = data[row]?.[col];
        if (value === null || value === undefined || value === '') {
          emptyValues++;
        } else {
          columnValues.add(value);
        }
      }

      uniqueValuesPerColumn.push(columnValues.size);
    }

    return {
      totalRows,
      totalColumns,
      emptyValues,
      uniqueValuesPerColumn
    };
  }

  /**
   * 設定を更新する
   */
  updateConfig(config: Partial<CSVConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  /**
   * 現在の設定を取得する
   */
  getConfig(): CSVConfig {
    return { ...this.defaultConfig };
  }
}

/**
 * デフォルトのCSVハンドラーインスタンスを作成する
 */
export function createCSVHandler(config?: CSVConfig): CSVHandler {
  return new CSVHandler(config);
}

/**
 * CSV形式の文字列を解析する（シンプルな関数版）
 */
export async function parseCSVString(
  csvString: string,
  options: CSVImportOptions = {}
): Promise<CSVOperationResult<any[][]>> {
  const handler = createCSVHandler();
  const result = await handler.parseCSV(csvString, options);

  if (result.success && result.data) {
    return {
      success: true,
      data: result.data.data,
      rowCount: result.rowCount,
      columnCount: result.columnCount,
      processingTime: result.processingTime
    };
  } else {
    return {
      success: false,
      error: result.error
    };
  }
}

/**
 * 2次元配列をCSV文字列に変換する（シンプルな関数版）
 */
export async function convertToCSVString(
  data: any[][],
  options: CSVExportOptions = {}
): Promise<CSVOperationResult<string>> {
  const handler = createCSVHandler();
  return await handler.convertToCSV(data, options);
}