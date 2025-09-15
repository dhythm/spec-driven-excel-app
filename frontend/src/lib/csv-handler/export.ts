/**
 * CSV Export Library
 * スプレッドシートデータのCSVエクスポート機能を提供
 */

import { Spreadsheet, getCellFromSpreadsheet } from '../spreadsheet';
import { CellPosition, Cell } from '../cell';
import { CSVHandler, CSVExportOptions, CSVOperationResult, createCSVHandler } from './index';

/**
 * エクスポート範囲の定義
 */
export interface ExportRange {
  start: CellPosition;
  end: CellPosition;
}

/**
 * エクスポート形式のオプション
 */
export interface ExportFormatOptions {
  includeFormulas: boolean;
  includeFormattedValues: boolean;
  includeHeaders: boolean;
  emptyValue: string;
  dateFormat: 'iso' | 'locale' | 'custom';
  numberFormat: 'raw' | 'formatted';
  booleanFormat: 'boolean' | 'text' | 'numeric';
  customDateFormat?: string;
}

/**
 * エクスポートフィルターのオプション
 */
export interface ExportFilterOptions {
  excludeEmptyRows: boolean;
  excludeEmptyColumns: boolean;
  excludeHiddenRows: boolean;
  excludeHiddenColumns: boolean;
  includeOnlyVisibleCells: boolean;
  skipFormulasWithErrors: boolean;
}

/**
 * 高度なエクスポートオプション
 */
export interface AdvancedExportOptions extends CSVExportOptions {
  format?: ExportFormatOptions;
  filter?: ExportFilterOptions;
  compression?: boolean;
  encoding?: 'utf-8' | 'shift-jis' | 'iso-8859-1';
  chunks?: {
    enable: boolean;
    maxRows: number;
    overlap: number;
  };
}

/**
 * エクスポート統計情報
 */
export interface ExportStatistics {
  totalCells: number;
  exportedCells: number;
  skippedCells: number;
  emptyRows: number;
  emptyColumns: number;
  formulaCells: number;
  errorCells: number;
  processingTime: number;
  fileSize: number;
}

/**
 * チャンクエクスポートの結果
 */
export interface ChunkedExportResult {
  chunks: {
    index: number;
    data: string;
    rowRange: { start: number; end: number };
    size: number;
  }[];
  totalChunks: number;
  statistics: ExportStatistics;
}

/**
 * CSV エクスポータークラス
 */
export class CSVExporter {
  private csvHandler: CSVHandler;
  private defaultFormatOptions: ExportFormatOptions;
  private defaultFilterOptions: ExportFilterOptions;

  constructor() {
    this.csvHandler = createCSVHandler();

    this.defaultFormatOptions = {
      includeFormulas: false,
      includeFormattedValues: true,
      includeHeaders: false,
      emptyValue: '',
      dateFormat: 'locale',
      numberFormat: 'formatted',
      booleanFormat: 'text'
    };

    this.defaultFilterOptions = {
      excludeEmptyRows: false,
      excludeEmptyColumns: false,
      excludeHiddenRows: true,
      excludeHiddenColumns: true,
      includeOnlyVisibleCells: true,
      skipFormulasWithErrors: false
    };
  }

  /**
   * スプレッドシート全体をCSVエクスポート
   */
  async exportSpreadsheet(
    spreadsheet: Spreadsheet,
    options: AdvancedExportOptions = {}
  ): Promise<CSVOperationResult<string> & { statistics: ExportStatistics }> {
    const range: ExportRange = {
      start: { row: 0, column: 0 },
      end: { row: spreadsheet.rowCount - 1, column: spreadsheet.columnCount - 1 }
    };

    return await this.exportRange(spreadsheet, range, options);
  }

  /**
   * 指定範囲をCSVエクスポート
   */
  async exportRange(
    spreadsheet: Spreadsheet,
    range: ExportRange,
    options: AdvancedExportOptions = {}
  ): Promise<CSVOperationResult<string> & { statistics: ExportStatistics }> {
    const startTime = performance.now();

    try {
      const formatOptions = { ...this.defaultFormatOptions, ...options.format };
      const filterOptions = { ...this.defaultFilterOptions, ...options.filter };

      // データを抽出
      const extractResult = this.extractRangeData(spreadsheet, range, formatOptions, filterOptions);

      if (!extractResult.success) {
        return {
          success: false,
          error: extractResult.error,
          statistics: this.createEmptyStatistics(performance.now() - startTime)
        };
      }

      // CSVに変換
      const csvResult = await this.csvHandler.convertToCSV(extractResult.data, options);

      const processingTime = performance.now() - startTime;
      const statistics: ExportStatistics = {
        ...extractResult.statistics,
        processingTime,
        fileSize: csvResult.data ? new Blob([csvResult.data]).size : 0
      };

      if (csvResult.success) {
        return {
          success: true,
          data: csvResult.data,
          statistics
        };
      } else {
        return {
          success: false,
          error: csvResult.error,
          statistics
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'エクスポート中にエラーが発生しました',
        statistics: this.createEmptyStatistics(performance.now() - startTime)
      };
    }
  }

  /**
   * 選択されたセルをCSVエクスポート
   */
  async exportSelectedCells(
    spreadsheet: Spreadsheet,
    positions: CellPosition[],
    options: AdvancedExportOptions = {}
  ): Promise<CSVOperationResult<string> & { statistics: ExportStatistics }> {
    const startTime = performance.now();

    try {
      if (positions.length === 0) {
        return {
          success: false,
          error: 'エクスポートするセルが選択されていません',
          statistics: this.createEmptyStatistics(performance.now() - startTime)
        };
      }

      const formatOptions = { ...this.defaultFormatOptions, ...options.format };

      // 選択されたセルのデータを抽出
      const extractResult = this.extractSelectedCellsData(spreadsheet, positions, formatOptions);

      if (!extractResult.success) {
        return {
          success: false,
          error: extractResult.error,
          statistics: this.createEmptyStatistics(performance.now() - startTime)
        };
      }

      // CSVに変換
      const csvResult = await this.csvHandler.convertToCSV(extractResult.data, options);

      const processingTime = performance.now() - startTime;
      const statistics: ExportStatistics = {
        ...extractResult.statistics,
        processingTime,
        fileSize: csvResult.data ? new Blob([csvResult.data]).size : 0
      };

      if (csvResult.success) {
        return {
          success: true,
          data: csvResult.data,
          statistics
        };
      } else {
        return {
          success: false,
          error: csvResult.error,
          statistics
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'エクスポート中にエラーが発生しました',
        statistics: this.createEmptyStatistics(performance.now() - startTime)
      };
    }
  }

  /**
   * 大きなスプレッドシートをチャンク単位でエクスポート
   */
  async exportInChunks(
    spreadsheet: Spreadsheet,
    range: ExportRange,
    options: AdvancedExportOptions = {}
  ): Promise<CSVOperationResult<ChunkedExportResult>> {
    const startTime = performance.now();

    try {
      const chunkOptions = options.chunks || { enable: true, maxRows: 1000, overlap: 0 };

      if (!chunkOptions.enable) {
        const singleResult = await this.exportRange(spreadsheet, range, options);
        return {
          success: singleResult.success,
          data: singleResult.success ? {
            chunks: [{
              index: 0,
              data: singleResult.data!,
              rowRange: { start: range.start.row, end: range.end.row },
              size: new Blob([singleResult.data!]).size
            }],
            totalChunks: 1,
            statistics: singleResult.statistics
          } : undefined,
          error: singleResult.error
        };
      }

      const chunks: ChunkedExportResult['chunks'] = [];
      const totalRows = range.end.row - range.start.row + 1;
      const chunkCount = Math.ceil(totalRows / chunkOptions.maxRows);

      let totalStatistics = this.createEmptyStatistics(0);

      for (let i = 0; i < chunkCount; i++) {
        const chunkStart = range.start.row + (i * chunkOptions.maxRows);
        const chunkEnd = Math.min(
          chunkStart + chunkOptions.maxRows - 1 + chunkOptions.overlap,
          range.end.row
        );

        const chunkRange: ExportRange = {
          start: { row: chunkStart, column: range.start.column },
          end: { row: chunkEnd, column: range.end.column }
        };

        const chunkResult = await this.exportRange(spreadsheet, chunkRange, {
          ...options,
          chunks: { enable: false, maxRows: 0, overlap: 0 }
        });

        if (!chunkResult.success) {
          return {
            success: false,
            error: `チャンク ${i + 1} のエクスポートに失敗: ${chunkResult.error}`
          };
        }

        chunks.push({
          index: i,
          data: chunkResult.data!,
          rowRange: { start: chunkStart, end: chunkEnd },
          size: new Blob([chunkResult.data!]).size
        });

        // 統計情報を累積
        totalStatistics.totalCells += chunkResult.statistics.totalCells;
        totalStatistics.exportedCells += chunkResult.statistics.exportedCells;
        totalStatistics.skippedCells += chunkResult.statistics.skippedCells;
        totalStatistics.formulaCells += chunkResult.statistics.formulaCells;
        totalStatistics.errorCells += chunkResult.statistics.errorCells;
        totalStatistics.fileSize += chunkResult.statistics.fileSize;
      }

      totalStatistics.processingTime = performance.now() - startTime;

      return {
        success: true,
        data: {
          chunks,
          totalChunks: chunkCount,
          statistics: totalStatistics
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'チャンクエクスポート中にエラーが発生しました'
      };
    }
  }

  /**
   * 範囲データを抽出する
   */
  private extractRangeData(
    spreadsheet: Spreadsheet,
    range: ExportRange,
    formatOptions: ExportFormatOptions,
    filterOptions: ExportFilterOptions
  ): { success: boolean; data?: any[][]; error?: string; statistics: Omit<ExportStatistics, 'processingTime' | 'fileSize'> } {
    try {
      const data: any[][] = [];
      const statistics = {
        totalCells: 0,
        exportedCells: 0,
        skippedCells: 0,
        emptyRows: 0,
        emptyColumns: 0,
        formulaCells: 0,
        errorCells: 0
      };

      // 実際の範囲を調整（非表示行・列を除外）
      const effectiveRange = this.adjustRangeForFilters(spreadsheet, range, filterOptions);

      for (let row = effectiveRange.start.row; row <= effectiveRange.end.row; row++) {
        if (filterOptions.excludeHiddenRows && !spreadsheet.rows[row]?.isVisible) {
          continue;
        }

        const rowData: any[] = [];
        let hasData = false;

        for (let col = effectiveRange.start.column; col <= effectiveRange.end.column; col++) {
          if (filterOptions.excludeHiddenColumns && !spreadsheet.columns[col]?.isVisible) {
            continue;
          }

          statistics.totalCells++;

          const cell = getCellFromSpreadsheet(spreadsheet, { row, column: col });
          const cellValue = this.extractCellValue(cell, formatOptions);

          if (cellValue !== formatOptions.emptyValue) {
            hasData = true;
          }

          if (cell) {
            if (cell.dataType === 'formula') {
              statistics.formulaCells++;
              if (cell.validationError) {
                statistics.errorCells++;
                if (filterOptions.skipFormulasWithErrors) {
                  rowData.push(formatOptions.emptyValue);
                  statistics.skippedCells++;
                  continue;
                }
              }
            }
            statistics.exportedCells++;
          } else {
            statistics.skippedCells++;
          }

          rowData.push(cellValue);
        }

        if (hasData || !filterOptions.excludeEmptyRows) {
          data.push(rowData);
        } else {
          statistics.emptyRows++;
        }
      }

      return {
        success: true,
        data,
        statistics
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'データ抽出中にエラーが発生しました',
        statistics: {
          totalCells: 0,
          exportedCells: 0,
          skippedCells: 0,
          emptyRows: 0,
          emptyColumns: 0,
          formulaCells: 0,
          errorCells: 0
        }
      };
    }
  }

  /**
   * 選択されたセルのデータを抽出する
   */
  private extractSelectedCellsData(
    spreadsheet: Spreadsheet,
    positions: CellPosition[],
    formatOptions: ExportFormatOptions
  ): { success: boolean; data?: any[][]; error?: string; statistics: Omit<ExportStatistics, 'processingTime' | 'fileSize'> } {
    try {
      const statistics = {
        totalCells: positions.length,
        exportedCells: 0,
        skippedCells: 0,
        emptyRows: 0,
        emptyColumns: 0,
        formulaCells: 0,
        errorCells: 0
      };

      // ポジションをソートして行ごとにグループ化
      const sortedPositions = [...positions].sort((a, b) => {
        if (a.row !== b.row) return a.row - b.row;
        return a.column - b.column;
      });

      const rowGroups = new Map<number, CellPosition[]>();
      for (const position of sortedPositions) {
        if (!rowGroups.has(position.row)) {
          rowGroups.set(position.row, []);
        }
        rowGroups.get(position.row)!.push(position);
      }

      const data: any[][] = [];

      for (const [rowIndex, positions] of rowGroups) {
        const rowData: any[] = [];

        for (const position of positions) {
          const cell = getCellFromSpreadsheet(spreadsheet, position);
          const cellValue = this.extractCellValue(cell, formatOptions);

          if (cell) {
            if (cell.dataType === 'formula') {
              statistics.formulaCells++;
              if (cell.validationError) {
                statistics.errorCells++;
              }
            }
            statistics.exportedCells++;
          } else {
            statistics.skippedCells++;
          }

          rowData.push(cellValue);
        }

        data.push(rowData);
      }

      return {
        success: true,
        data,
        statistics
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '選択セルデータの抽出中にエラーが発生しました',
        statistics: {
          totalCells: 0,
          exportedCells: 0,
          skippedCells: 0,
          emptyRows: 0,
          emptyColumns: 0,
          formulaCells: 0,
          errorCells: 0
        }
      };
    }
  }

  /**
   * セルの値を抽出する
   */
  private extractCellValue(cell: Cell | undefined, formatOptions: ExportFormatOptions): any {
    if (!cell || cell.dataType === 'empty') {
      return formatOptions.emptyValue;
    }

    // 数式を含める場合
    if (formatOptions.includeFormulas && cell.dataType === 'formula') {
      return cell.rawValue;
    }

    // フォーマット済み値を使用するかどうか
    const useFormattedValue = formatOptions.includeFormattedValues;
    const baseValue = useFormattedValue ? cell.displayValue : cell.rawValue;

    // データ型に応じた変換
    switch (cell.dataType) {
      case 'number':
        if (formatOptions.numberFormat === 'raw') {
          return parseFloat(cell.rawValue);
        }
        return baseValue;

      case 'date':
        if (formatOptions.dateFormat === 'iso') {
          const date = new Date(cell.rawValue);
          return isNaN(date.getTime()) ? baseValue : date.toISOString().split('T')[0];
        } else if (formatOptions.dateFormat === 'locale') {
          const date = new Date(cell.rawValue);
          return isNaN(date.getTime()) ? baseValue : date.toLocaleDateString();
        } else if (formatOptions.dateFormat === 'custom' && formatOptions.customDateFormat) {
          // カスタム日付フォーマット（簡易実装）
          const date = new Date(cell.rawValue);
          return isNaN(date.getTime()) ? baseValue : this.formatDateCustom(date, formatOptions.customDateFormat);
        }
        return baseValue;

      case 'boolean':
        const boolValue = cell.rawValue.toLowerCase() === 'true';
        switch (formatOptions.booleanFormat) {
          case 'boolean':
            return boolValue;
          case 'text':
            return boolValue ? 'TRUE' : 'FALSE';
          case 'numeric':
            return boolValue ? 1 : 0;
          default:
            return baseValue;
        }

      default:
        return baseValue;
    }
  }

  /**
   * カスタム日付フォーマット（簡易実装）
   */
  private formatDateCustom(date: Date, format: string): string {
    const map: { [key: string]: string } = {
      'YYYY': date.getFullYear().toString(),
      'MM': (date.getMonth() + 1).toString().padStart(2, '0'),
      'DD': date.getDate().toString().padStart(2, '0'),
      'HH': date.getHours().toString().padStart(2, '0'),
      'mm': date.getMinutes().toString().padStart(2, '0'),
      'ss': date.getSeconds().toString().padStart(2, '0')
    };

    let formatted = format;
    for (const [pattern, value] of Object.entries(map)) {
      formatted = formatted.replace(new RegExp(pattern, 'g'), value);
    }

    return formatted;
  }

  /**
   * フィルターに基づいて範囲を調整する
   */
  private adjustRangeForFilters(
    spreadsheet: Spreadsheet,
    range: ExportRange,
    filterOptions: ExportFilterOptions
  ): ExportRange {
    let adjustedRange = { ...range };

    // 非表示行・列の除外は実際のエクスポート時に処理
    // ここでは範囲の調整のみ行う

    return adjustedRange;
  }

  /**
   * 空の統計情報を作成する
   */
  private createEmptyStatistics(processingTime: number): ExportStatistics {
    return {
      totalCells: 0,
      exportedCells: 0,
      skippedCells: 0,
      emptyRows: 0,
      emptyColumns: 0,
      formulaCells: 0,
      errorCells: 0,
      processingTime,
      fileSize: 0
    };
  }

  /**
   * エクスポートのプレビューを生成する
   */
  async generatePreview(
    spreadsheet: Spreadsheet,
    range: ExportRange,
    options: AdvancedExportOptions = {},
    maxRows: number = 10
  ): Promise<CSVOperationResult<{ preview: string; statistics: ExportStatistics }>> {
    const previewRange: ExportRange = {
      start: range.start,
      end: {
        row: Math.min(range.start.row + maxRows - 1, range.end.row),
        column: range.end.column
      }
    };

    const result = await this.exportRange(spreadsheet, previewRange, options);

    if (result.success) {
      return {
        success: true,
        data: {
          preview: result.data!,
          statistics: result.statistics
        }
      };
    } else {
      return {
        success: false,
        error: result.error
      };
    }
  }
}

/**
 * デフォルトのCSVエクスポーターを作成する
 */
export function createCSVExporter(): CSVExporter {
  return new CSVExporter();
}

/**
 * スプレッドシートをCSVエクスポートする（シンプルな関数版）
 */
export async function exportSpreadsheetToCSV(
  spreadsheet: Spreadsheet,
  options: AdvancedExportOptions = {}
): Promise<CSVOperationResult<string> & { statistics: ExportStatistics }> {
  const exporter = createCSVExporter();
  return await exporter.exportSpreadsheet(spreadsheet, options);
}

/**
 * スプレッドシートの範囲をCSVエクスポートする（シンプルな関数版）
 */
export async function exportRangeToCSV(
  spreadsheet: Spreadsheet,
  range: ExportRange,
  options: AdvancedExportOptions = {}
): Promise<CSVOperationResult<string> & { statistics: ExportStatistics }> {
  const exporter = createCSVExporter();
  return await exporter.exportRange(spreadsheet, range, options);
}

/**
 * CSVファイルとしてダウンロードする
 */
export async function downloadSpreadsheetAsCSV(
  spreadsheet: Spreadsheet,
  filename: string = 'spreadsheet.csv',
  options: AdvancedExportOptions = {}
): Promise<CSVOperationResult<boolean> & { statistics: ExportStatistics }> {
  const exporter = createCSVExporter();
  const result = await exporter.exportSpreadsheet(spreadsheet, options);

  if (result.success) {
    try {
      exporter['csvHandler'].downloadCSV(result.data!, filename);
      return {
        success: true,
        data: true,
        statistics: result.statistics
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'ダウンロードに失敗しました',
        statistics: result.statistics
      };
    }
  } else {
    return {
      success: false,
      error: result.error,
      statistics: result.statistics
    };
  }
}