#!/usr/bin/env node

/**
 * CSV CLI Tool (T061)
 * CSV インポート・エクスポートと処理を提供するCLIツール
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, extname } from 'path';

// コアライブラリのインポート
import {
  CSVHandler,
  createCSVHandler,
  parseCSVString,
  convertToCSVString,
  CSVConfig,
  CSVImportOptions,
  CSVExportOptions,
  CSVOperationResult,
  CSVValidationResult
} from '../../src/lib/csv-handler/index';

import { Spreadsheet } from '../../src/lib/spreadsheet';
import { CellPosition } from '../../src/lib/cell';
import {
  createNewSpreadsheet,
  setCellValue,
  getCellRangeValues,
  batchUpdateCells,
  CellUpdate
} from '../../src/lib/spreadsheet-core/index';

// CLIプログラムの設定
const program = new Command();

program
  .name('csv-cli')
  .description('CSV import/export and processing CLI tool')
  .version('1.0.0');

/**
 * エラーハンドリング用のユーティリティ関数
 */
function handleError(error: unknown, context: string): void {
  console.error(chalk.red(`エラーが発生しました (${context}):`));
  if (error instanceof Error) {
    console.error(chalk.red(error.message));
  } else {
    console.error(chalk.red('予期しないエラー'));
  }
  process.exit(1);
}

/**
 * スプレッドシートファイルを読み込む
 */
function loadSpreadsheetFile(filePath: string): Spreadsheet {
  try {
    if (!existsSync(filePath)) {
      throw new Error(`ファイルが見つかりません: ${filePath}`);
    }

    const content = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    // セルマップを復元
    if (data.cells && Array.isArray(data.cells)) {
      data.cells = new Map(data.cells);
    }

    // 日付を復元
    if (data.createdAt) data.createdAt = new Date(data.createdAt);
    if (data.updatedAt) data.updatedAt = new Date(data.updatedAt);

    return data as Spreadsheet;
  } catch (error) {
    throw new Error(`スプレッドシートの読み込みに失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * スプレッドシートファイルを保存する
 */
function saveSpreadsheetFile(spreadsheet: Spreadsheet, filePath: string): void {
  try {
    const data = {
      ...spreadsheet,
      cells: Array.from(spreadsheet.cells.entries())
    };

    writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    throw new Error(`スプレッドシートの保存に失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * セル位置を文字列から解析する（例: "A1" -> {row: 0, column: 0}）
 */
function parseCellPosition(cellRef: string): CellPosition {
  const match = cellRef.match(/^([A-Z]+)(\d+)$/);
  if (!match) {
    throw new Error(`無効なセル参照: ${cellRef}`);
  }

  const columnStr = match[1];
  const rowStr = match[2];

  // 列をアルファベットから数値に変換
  let column = 0;
  for (let i = 0; i < columnStr.length; i++) {
    column = column * 26 + (columnStr.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }
  column -= 1; // 0ベースに調整

  const row = parseInt(rowStr, 10) - 1; // 0ベースに調整

  return { row, column };
}

/**
 * CSV操作結果を表示する
 */
function displayCSVResult<T>(result: CSVOperationResult<T>, successMessage?: string): void {
  if (result.success) {
    console.log(chalk.green(successMessage || '操作が完了しました'));
    if (result.rowCount !== undefined) {
      console.log(chalk.blue('行数:'), result.rowCount);
    }
    if (result.columnCount !== undefined) {
      console.log(chalk.blue('列数:'), result.columnCount);
    }
    if (result.processingTime !== undefined) {
      console.log(chalk.blue('処理時間:'), `${result.processingTime.toFixed(2)}ms`);
    }
    if (result.warnings && result.warnings.length > 0) {
      console.log(chalk.yellow('警告:'));
      result.warnings.forEach(warning => console.log(chalk.yellow(`  ${warning}`)));
    }
  } else {
    console.error(chalk.red('操作に失敗しました:'), result.error);
    if (result.warnings && result.warnings.length > 0) {
      console.log(chalk.yellow('警告:'));
      result.warnings.forEach(warning => console.log(chalk.yellow(`  ${warning}`)));
    }
  }
}

/**
 * 検証結果を表示する
 */
function displayValidationResult(result: CSVValidationResult): void {
  console.log(chalk.blue('=== CSV検証結果 ==='));
  console.log(`検証結果: ${result.isValid ? chalk.green('✓ 正常') : chalk.red('✗ エラーあり')}`);
  console.log(`総行数: ${result.summary.totalRows}`);
  console.log(`総列数: ${result.summary.totalColumns}`);
  console.log(`空行数: ${result.summary.emptyRows}`);
  console.log(`空列数: ${result.summary.emptyColumns}`);

  if (Object.keys(result.summary.dataTypes).length > 0) {
    console.log(chalk.blue('データ型:'));
    Object.entries(result.summary.dataTypes).forEach(([col, type]) => {
      console.log(`  列${parseInt(col) + 1}: ${type}`);
    });
  }

  if (result.errors.length > 0) {
    console.log(chalk.red('エラー・警告:'));
    result.errors.forEach(error => {
      const color = error.severity === 'error' ? chalk.red : chalk.yellow;
      console.log(color(`  [${error.severity.toUpperCase()}] 行${error.row}, 列${error.column}: ${error.message}`));
    });
  }
}

// ====================
// コマンド実装
// ====================

/**
 * CSVファイルをスプレッドシートに変換
 */
program
  .command('import')
  .description('CSVファイルをスプレッドシートにインポートする')
  .argument('<csv-file>', 'CSVファイルパス')
  .argument('<output-file>', '出力スプレッドシートファイルパス')
  .option('--delimiter <delimiter>', 'デリミター', ',')
  .option('--header', 'ヘッダー行があることを指定', false)
  .option('--skip-empty-lines', '空行をスキップ', false)
  .option('--dynamic-typing', '動的型付けを有効化', false)
  .option('--start <cell>', '開始セル位置', 'A1')
  .option('--name <name>', 'スプレッドシート名')
  .option('--preview <lines>', 'プレビュー行数', '0')
  .action(async (csvFile, outputFile, options) => {
    const spinner = ora('CSVファイルをインポート中...').start();

    try {
      if (!existsSync(csvFile)) {
        throw new Error(`CSVファイルが見つかりません: ${csvFile}`);
      }

      const csvContent = readFileSync(csvFile, 'utf-8');
      const handler = createCSVHandler();

      const importOptions: CSVImportOptions = {
        delimiter: options.delimiter,
        header: options.header,
        skipEmptyLines: options.skipEmptyLines,
        dynamicTyping: options.dynamicTyping,
        preview: parseInt(options.preview, 10) || 0
      };

      // CSVを解析
      const parseResult = await handler.parseCSV(csvContent, importOptions);

      if (!parseResult.success || !parseResult.data) {
        spinner.fail('CSVの解析に失敗しました');
        console.error(chalk.red(parseResult.error));
        return;
      }

      const csvData = parseResult.data.data;
      const startPosition = parseCellPosition(options.start);

      // 新しいスプレッドシートを作成
      const spreadsheetName = options.name || `Import from ${csvFile}`;
      const spreadsheetResult = createNewSpreadsheet(spreadsheetName, {
        rowCount: Math.max(1000, csvData.length + startPosition.row + 10),
        columnCount: Math.max(26, (csvData[0]?.length || 0) + startPosition.column + 5)
      });

      if (!spreadsheetResult.success || !spreadsheetResult.data) {
        spinner.fail('スプレッドシートの作成に失敗しました');
        console.error(chalk.red(spreadsheetResult.error));
        return;
      }

      // セル更新データを準備
      const updates: CellUpdate[] = [];
      csvData.forEach((row, rowIndex) => {
        if (Array.isArray(row)) {
          row.forEach((cell, colIndex) => {
            if (cell !== null && cell !== undefined && cell !== '') {
              updates.push({
                position: {
                  row: startPosition.row + rowIndex,
                  column: startPosition.column + colIndex
                },
                value: String(cell)
              });
            }
          });
        }
      });

      // バッチ更新を実行
      const batchResult = batchUpdateCells(spreadsheetResult.data, updates);

      if (batchResult.success) {
        saveSpreadsheetFile(batchResult.spreadsheet, outputFile);
        spinner.succeed(`CSVファイルをインポートしました: ${outputFile}`);

        console.log(chalk.blue('インポート詳細:'));
        console.log(`  インポート行数: ${csvData.length}`);
        console.log(`  インポート列数: ${csvData[0]?.length || 0}`);
        console.log(`  成功したセル数: ${batchResult.successCount}`);
        console.log(`  総セル数: ${batchResult.totalCount}`);

        if (batchResult.errors.length > 0) {
          console.log(chalk.yellow('エラーのあったセル:'));
          batchResult.errors.slice(0, 10).forEach(error => {
            console.log(chalk.red(`  行${error.position.row + 1}, 列${error.position.column + 1}: ${error.error}`));
          });
          if (batchResult.errors.length > 10) {
            console.log(chalk.yellow(`  ... 他${batchResult.errors.length - 10}件`));
          }
        }
      } else {
        spinner.fail('セルの更新に失敗しました');
      }

    } catch (error) {
      spinner.fail('エラーが発生しました');
      handleError(error, 'import');
    }
  });

/**
 * スプレッドシートをCSVファイルにエクスポート
 */
program
  .command('export')
  .description('スプレッドシートをCSVファイルにエクスポートする')
  .argument('<spreadsheet-file>', 'スプレッドシートファイルパス')
  .argument('<output-file>', '出力CSVファイルパス')
  .option('--start <cell>', '開始セル位置', 'A1')
  .option('--end <cell>', '終了セル位置')
  .option('--delimiter <delimiter>', 'デリミター', ',')
  .option('--include-headers', 'ヘッダー行を含める', false)
  .option('--include-formulas', '数式を含める', false)
  .option('--empty-value <value>', '空セルの値', '')
  .action(async (spreadsheetFile, outputFile, options) => {
    const spinner = ora('スプレッドシートをエクスポート中...').start();

    try {
      const spreadsheet = loadSpreadsheetFile(spreadsheetFile);
      const startPosition = parseCellPosition(options.start);

      let endPosition: CellPosition;
      if (options.end) {
        endPosition = parseCellPosition(options.end);
      } else {
        // 自動的に使用範囲を検出
        let maxRow = 0;
        let maxCol = 0;
        for (const [key] of spreadsheet.cells) {
          const [rowStr, colStr] = key.split('-');
          const row = parseInt(rowStr, 10);
          const col = parseInt(colStr, 10);
          if (row >= startPosition.row && col >= startPosition.column) {
            maxRow = Math.max(maxRow, row);
            maxCol = Math.max(maxCol, col);
          }
        }
        endPosition = { row: maxRow, column: maxCol };
      }

      // セル範囲の値を取得
      const rangeResult = getCellRangeValues(spreadsheet, startPosition, endPosition);

      if (!rangeResult.success || !rangeResult.data) {
        spinner.fail('セル範囲の取得に失敗しました');
        console.error(chalk.red(rangeResult.error));
        return;
      }

      // 空の値を処理
      const processedData = rangeResult.data.map(row =>
        row.map(cell => cell || options.emptyValue)
      );

      // CSVに変換
      const handler = createCSVHandler();
      const exportOptions: CSVExportOptions = {
        delimiter: options.delimiter,
        includeHeaders: options.includeHeaders,
        includeFormulas: options.includeFormulas,
        emptyValue: options.emptyValue
      };

      const csvResult = await handler.convertToCSV(processedData, exportOptions);

      if (csvResult.success && csvResult.data) {
        writeFileSync(outputFile, csvResult.data);
        spinner.succeed(`CSVファイルにエクスポートしました: ${outputFile}`);

        console.log(chalk.blue('エクスポート詳細:'));
        console.log(`  エクスポート行数: ${csvResult.rowCount}`);
        console.log(`  エクスポート列数: ${csvResult.columnCount}`);
        console.log(`  ファイルサイズ: ${csvResult.data.length} bytes`);
        console.log(`  処理時間: ${csvResult.processingTime?.toFixed(2)}ms`);
      } else {
        spinner.fail('CSV変換に失敗しました');
        console.error(chalk.red(csvResult.error));
      }

    } catch (error) {
      spinner.fail('エラーが発生しました');
      handleError(error, 'export');
    }
  });

/**
 * CSVファイルを検証する
 */
program
  .command('validate')
  .description('CSVファイルを検証する')
  .argument('<csv-file>', 'CSVファイルパス')
  .option('--delimiter <delimiter>', 'デリミター', ',')
  .option('--format <format>', '出力形式 (json, table)', 'table')
  .action(async (csvFile, options) => {
    const spinner = ora('CSVファイルを検証中...').start();

    try {
      if (!existsSync(csvFile)) {
        throw new Error(`CSVファイルが見つかりません: ${csvFile}`);
      }

      const csvContent = readFileSync(csvFile, 'utf-8');
      const handler = createCSVHandler();

      // CSVを解析
      const parseResult = await handler.parseCSV(csvContent, {
        delimiter: options.delimiter
      });

      if (!parseResult.success || !parseResult.data) {
        spinner.fail('CSVの解析に失敗しました');
        console.error(chalk.red(parseResult.error));
        return;
      }

      // 検証を実行
      const validationResult = handler.validateCSV(parseResult.data.data);
      spinner.stop();

      switch (options.format) {
        case 'json':
          console.log(JSON.stringify(validationResult, null, 2));
          break;
        default:
          displayValidationResult(validationResult);
      }

    } catch (error) {
      spinner.fail('エラーが発生しました');
      handleError(error, 'validate');
    }
  });

/**
 * CSVファイルを分析する
 */
program
  .command('analyze')
  .description('CSVファイルの詳細分析を行う')
  .argument('<csv-file>', 'CSVファイルパス')
  .option('--format <format>', '出力形式 (json, table)', 'table')
  .action(async (csvFile, options) => {
    const spinner = ora('CSVファイルを分析中...').start();

    try {
      if (!existsSync(csvFile)) {
        throw new Error(`CSVファイルが見つかりません: ${csvFile}`);
      }

      const csvContent = readFileSync(csvFile, 'utf-8');
      const handler = createCSVHandler();

      // 分析を実行
      const analysisResult = await handler.analyzeCSV(csvContent);

      if (!analysisResult.success || !analysisResult.data) {
        spinner.fail('CSV分析に失敗しました');
        console.error(chalk.red(analysisResult.error));
        return;
      }

      spinner.stop();

      switch (options.format) {
        case 'json':
          console.log(JSON.stringify(analysisResult.data, null, 2));
          break;
        default:
          const analysis = analysisResult.data;
          console.log(chalk.blue('=== CSV分析結果 ==='));
          console.log(`デリミター: "${analysis.delimiter}"`);
          console.log(`行末文字: "${analysis.lineEnding.replace(/\r/g, '\\r').replace(/\n/g, '\\n')}"`);
          console.log(`エンコーディング: ${analysis.encoding}`);
          console.log(`ヘッダーの有無: ${analysis.hasHeader ? 'あり' : 'なし'}`);

          console.log(chalk.blue('\n統計情報:'));
          console.log(`  総行数: ${analysis.statistics.totalRows}`);
          console.log(`  総列数: ${analysis.statistics.totalColumns}`);
          console.log(`  空の値: ${analysis.statistics.emptyValues}`);
          console.log(`  各列のユニーク値数: [${analysis.statistics.uniqueValuesPerColumn.join(', ')}]`);

          if (analysis.preview.length > 0) {
            console.log(chalk.blue('\nプレビュー (最大10行):'));
            analysis.preview.slice(0, 10).forEach((row, index) => {
              console.log(`  行${index + 1}: [${row.map(cell => `"${cell}"`).join(', ')}]`);
            });
          }
      }

    } catch (error) {
      spinner.fail('エラーが発生しました');
      handleError(error, 'analyze');
    }
  });

/**
 * CSVファイルを変換する
 */
program
  .command('convert')
  .description('CSVファイルの形式を変換する')
  .argument('<input-file>', '入力CSVファイルパス')
  .argument('<output-file>', '出力CSVファイルパス')
  .option('--input-delimiter <delimiter>', '入力デリミター', ',')
  .option('--output-delimiter <delimiter>', '出力デリミター', ',')
  .option('--input-encoding <encoding>', '入力エンコーディング', 'utf-8')
  .option('--output-encoding <encoding>', '出力エンコーディング', 'utf-8')
  .option('--skip-empty-lines', '空行をスキップ', false)
  .option('--trim-spaces', '空白をトリム', false)
  .action(async (inputFile, outputFile, options) => {
    const spinner = ora('CSVファイルを変換中...').start();

    try {
      if (!existsSync(inputFile)) {
        throw new Error(`入力ファイルが見つかりません: ${inputFile}`);
      }

      const inputContent = readFileSync(inputFile, options.inputEncoding);
      const handler = createCSVHandler();

      // 入力CSVを解析
      const parseResult = await handler.parseCSV(inputContent, {
        delimiter: options.inputDelimiter,
        skipEmptyLines: options.skipEmptyLines,
        transform: options.trimSpaces ? (value: string) => value.trim() : undefined
      });

      if (!parseResult.success || !parseResult.data) {
        spinner.fail('入力CSVの解析に失敗しました');
        console.error(chalk.red(parseResult.error));
        return;
      }

      // 出力CSVに変換
      const convertResult = await handler.convertToCSV(parseResult.data.data, {
        delimiter: options.outputDelimiter
      });

      if (!convertResult.success || !convertResult.data) {
        spinner.fail('出力CSVの変換に失敗しました');
        console.error(chalk.red(convertResult.error));
        return;
      }

      // ファイルに書き込み
      writeFileSync(outputFile, convertResult.data, options.outputEncoding);

      spinner.succeed(`CSVファイルを変換しました: ${outputFile}`);

      console.log(chalk.blue('変換詳細:'));
      console.log(`  入力行数: ${parseResult.rowCount}`);
      console.log(`  出力行数: ${convertResult.rowCount}`);
      console.log(`  入力列数: ${parseResult.columnCount}`);
      console.log(`  出力列数: ${convertResult.columnCount}`);
      console.log(`  入力デリミター: "${options.inputDelimiter}"`);
      console.log(`  出力デリミター: "${options.outputDelimiter}"`);

    } catch (error) {
      spinner.fail('エラーが発生しました');
      handleError(error, 'convert');
    }
  });

/**
 * CSVファイルをマージする
 */
program
  .command('merge')
  .description('複数のCSVファイルをマージする')
  .argument '<files...>'
  .argument('<output-file>', '出力CSVファイルパス')
  .option('--mode <mode>', 'マージモード (vertical, horizontal)', 'vertical')
  .option('--delimiter <delimiter>', 'デリミター', ',')
  .option('--include-headers', 'ヘッダー行を含める', false)
  .action(async (files, outputFile, options) => {
    const spinner = ora('CSVファイルをマージ中...').start();

    try {
      // 最後の引数はoutputFileなので除外
      const inputFiles = files.slice(0, -1);
      const actualOutputFile = files[files.length - 1];

      if (inputFiles.length < 2) {
        throw new Error('マージするには少なくとも2つのファイルが必要です');
      }

      const handler = createCSVHandler();
      const allData: any[][] = [];

      // 各ファイルを読み込み・解析
      for (const file of inputFiles) {
        if (!existsSync(file)) {
          throw new Error(`ファイルが見つかりません: ${file}`);
        }

        const content = readFileSync(file, 'utf-8');
        const parseResult = await handler.parseCSV(content, {
          delimiter: options.delimiter,
          header: false
        });

        if (!parseResult.success || !parseResult.data) {
          throw new Error(`${file}の解析に失敗しました: ${parseResult.error}`);
        }

        const fileData = parseResult.data.data;

        if (options.mode === 'vertical') {
          // 縦方向にマージ（行を追加）
          allData.push(...fileData);
        } else if (options.mode === 'horizontal') {
          // 横方向にマージ（列を追加）
          if (allData.length === 0) {
            allData.push(...fileData);
          } else {
            fileData.forEach((row, index) => {
              if (allData[index]) {
                allData[index].push(...row);
              } else {
                allData[index] = [...row];
              }
            });
          }
        }
      }

      // マージしたデータをCSVに変換
      const convertResult = await handler.convertToCSV(allData, {
        delimiter: options.delimiter,
        includeHeaders: options.includeHeaders
      });

      if (!convertResult.success || !convertResult.data) {
        spinner.fail('マージしたデータの変換に失敗しました');
        console.error(chalk.red(convertResult.error));
        return;
      }

      // ファイルに書き込み
      writeFileSync(actualOutputFile, convertResult.data);

      spinner.succeed(`CSVファイルをマージしました: ${actualOutputFile}`);

      console.log(chalk.blue('マージ詳細:'));
      console.log(`  入力ファイル数: ${inputFiles.length}`);
      console.log(`  マージモード: ${options.mode}`);
      console.log(`  出力行数: ${convertResult.rowCount}`);
      console.log(`  出力列数: ${convertResult.columnCount}`);

    } catch (error) {
      spinner.fail('エラーが発生しました');
      handleError(error, 'merge');
    }
  });

/**
 * CSVファイルのプレビュー
 */
program
  .command('preview')
  .description('CSVファイルをプレビューする')
  .argument('<csv-file>', 'CSVファイルパス')
  .option('--lines <lines>', 'プレビュー行数', '10')
  .option('--delimiter <delimiter>', 'デリミター', ',')
  .option('--format <format>', '出力形式 (table, json)', 'table')
  .action(async (csvFile, options) => {
    try {
      if (!existsSync(csvFile)) {
        throw new Error(`CSVファイルが見つかりません: ${csvFile}`);
      }

      const csvContent = readFileSync(csvFile, 'utf-8');
      const handler = createCSVHandler();
      const previewLines = parseInt(options.lines, 10);

      const parseResult = await handler.parseCSV(csvContent, {
        delimiter: options.delimiter,
        preview: previewLines
      });

      if (!parseResult.success || !parseResult.data) {
        console.error(chalk.red('CSVの解析に失敗しました:'), parseResult.error);
        return;
      }

      const data = parseResult.data.data;

      switch (options.format) {
        case 'json':
          console.log(JSON.stringify({
            file: csvFile,
            rows: data.length,
            preview: data
          }, null, 2));
          break;
        default:
          console.log(chalk.blue(`CSVファイルプレビュー: ${csvFile}`));
          console.log(chalk.blue(`最大${previewLines}行表示 (実際: ${data.length}行)`));
          console.log('');

          data.forEach((row, index) => {
            const formattedRow = Array.isArray(row)
              ? row.map(cell => `"${cell || ''}"`).join(' | ')
              : String(row);
            console.log(`${String(index + 1).padStart(3)}: ${formattedRow}`);
          });

          if (parseResult.rowCount && parseResult.rowCount > previewLines) {
            console.log(chalk.yellow(`\n... 他${parseResult.rowCount - previewLines}行`));
          }
      }

    } catch (error) {
      handleError(error, 'preview');
    }
  });

// プログラムの実行
program.parse(process.argv);

// コマンドが指定されていない場合はヘルプを表示
if (process.argv.length <= 2) {
  program.outputHelp();
}