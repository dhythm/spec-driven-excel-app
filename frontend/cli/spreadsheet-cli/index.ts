#!/usr/bin/env node

/**
 * Spreadsheet CLI Tool (T059)
 * スプレッドシートの基本操作を提供するCLIツール
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// コアライブラリのインポート
import {
  createNewSpreadsheet,
  setCellValue,
  getCellValue,
  setCellFormat,
  deleteCell,
  batchUpdateCells,
  getCellRangeValues,
  clearCellRange,
  getSpreadsheetStats,
  copySpreadsheet,
  renameSpreadsheet,
  SpreadsheetOperationResult,
  BatchOperationResult,
  CellUpdate
} from '../../src/lib/spreadsheet-core/index';

import {
  Spreadsheet,
  createSpreadsheet,
  DEFAULT_SPREADSHEET_CONFIG,
  SpreadsheetConfig
} from '../../src/lib/spreadsheet';

import {
  CellPosition,
  CellFormat,
  createEmptyCell
} from '../../src/lib/cell';

// CLIプログラムの設定
const program = new Command();

program
  .name('spreadsheet-cli')
  .description('Spreadsheet management CLI tool')
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
 * セル位置を文字列に変換する（例: {row: 0, column: 0} -> "A1"）
 */
function formatCellPosition(position: CellPosition): string {
  let column = position.column + 1;
  let columnStr = '';

  while (column > 0) {
    column--;
    columnStr = String.fromCharCode('A'.charCodeAt(0) + (column % 26)) + columnStr;
    column = Math.floor(column / 26);
  }

  return columnStr + (position.row + 1);
}

/**
 * 操作結果を表示する
 */
function displayOperationResult<T>(result: SpreadsheetOperationResult<T>, successMessage?: string): void {
  if (result.success) {
    console.log(chalk.green(successMessage || '操作が完了しました'));
    if (result.data !== undefined) {
      console.log(chalk.blue('結果:'), result.data);
    }
  } else {
    console.error(chalk.red('操作に失敗しました:'), result.error);
  }
}

// ====================
// コマンド実装
// ====================

/**
 * 新しいスプレッドシートを作成する
 */
program
  .command('create')
  .description('新しいスプレッドシートを作成する')
  .option('-n, --name <name>', 'スプレッドシート名', 'Untitled')
  .option('-r, --rows <rows>', '行数', '1000')
  .option('-c, --columns <columns>', '列数', '26')
  .option('-o, --output <file>', '出力ファイルパス', 'spreadsheet.json')
  .action(async (options) => {
    const spinner = ora('スプレッドシートを作成中...').start();

    try {
      const config: Partial<SpreadsheetConfig> = {
        rowCount: parseInt(options.rows, 10),
        columnCount: parseInt(options.columns, 10)
      };

      const result = createNewSpreadsheet(options.name, config);

      if (result.success && result.data) {
        saveSpreadsheetFile(result.data, options.output);
        spinner.succeed(`スプレッドシートが作成されました: ${options.output}`);

        console.log(chalk.blue('詳細:'));
        console.log(`  名前: ${result.data.name}`);
        console.log(`  サイズ: ${result.data.rowCount}行 x ${result.data.columnCount}列`);
        console.log(`  ID: ${result.data.id}`);
      } else {
        spinner.fail('スプレッドシートの作成に失敗しました');
        console.error(chalk.red(result.error));
      }
    } catch (error) {
      spinner.fail('エラーが発生しました');
      handleError(error, 'create');
    }
  });

/**
 * セルの値を設定する
 */
program
  .command('set-cell')
  .description('セルの値を設定する')
  .argument('<file>', 'スプレッドシートファイルパス')
  .argument('<cell>', 'セル参照 (例: A1)')
  .argument('<value>', '設定する値')
  .option('-f, --format <format>', '書式設定 (JSON形式)')
  .action(async (file, cellRef, value, options) => {
    const spinner = ora('セル値を設定中...').start();

    try {
      const spreadsheet = loadSpreadsheetFile(file);
      const position = parseCellPosition(cellRef);

      const result = setCellValue(spreadsheet, position, value);

      if (result.success) {
        let updatedSpreadsheet = result.spreadsheet;

        // 書式が指定されている場合は設定
        if (options.format) {
          try {
            const format: Partial<CellFormat> = JSON.parse(options.format);
            const formatResult = setCellFormat(updatedSpreadsheet, position, format);
            if (formatResult.success) {
              updatedSpreadsheet = formatResult.spreadsheet;
            }
          } catch (error) {
            spinner.warn('書式の設定に失敗しました');
          }
        }

        saveSpreadsheetFile(updatedSpreadsheet, file);
        spinner.succeed(`セル ${cellRef} に値を設定しました: ${value}`);
      } else {
        spinner.fail('セル値の設定に失敗しました');
        console.error(chalk.red(result.error));
      }
    } catch (error) {
      spinner.fail('エラーが発生しました');
      handleError(error, 'set-cell');
    }
  });

/**
 * セルの値を取得する
 */
program
  .command('get-cell')
  .description('セルの値を取得する')
  .argument('<file>', 'スプレッドシートファイルパス')
  .argument('<cell>', 'セル参照 (例: A1)')
  .option('--format <format>', '出力形式 (json, table, raw)', 'raw')
  .action(async (file, cellRef, options) => {
    try {
      const spreadsheet = loadSpreadsheetFile(file);
      const position = parseCellPosition(cellRef);

      const result = getCellValue(spreadsheet, position);

      if (result.success) {
        switch (options.format) {
          case 'json':
            console.log(JSON.stringify({
              cell: cellRef,
              value: result.data,
              position: position
            }, null, 2));
            break;
          case 'table':
            console.log(chalk.blue('セル:'), cellRef);
            console.log(chalk.blue('値:'), result.data || '(空)');
            break;
          default:
            console.log(result.data || '');
        }
      } else {
        console.error(chalk.red('セル値の取得に失敗しました:'), result.error);
      }
    } catch (error) {
      handleError(error, 'get-cell');
    }
  });

/**
 * セルを削除する
 */
program
  .command('delete-cell')
  .description('セルを削除する')
  .argument('<file>', 'スプレッドシートファイルパス')
  .argument('<cell>', 'セル参照 (例: A1)')
  .action(async (file, cellRef) => {
    const spinner = ora('セルを削除中...').start();

    try {
      const spreadsheet = loadSpreadsheetFile(file);
      const position = parseCellPosition(cellRef);

      const result = deleteCell(spreadsheet, position);

      if (result.success) {
        saveSpreadsheetFile(result.spreadsheet, file);
        spinner.succeed(`セル ${cellRef} を削除しました`);
      } else {
        spinner.fail('セルの削除に失敗しました');
        console.error(chalk.red(result.error));
      }
    } catch (error) {
      spinner.fail('エラーが発生しました');
      handleError(error, 'delete-cell');
    }
  });

/**
 * セル範囲を取得する
 */
program
  .command('get-range')
  .description('セル範囲の値を取得する')
  .argument('<file>', 'スプレッドシートファイルパス')
  .argument('<start>', '開始セル (例: A1)')
  .argument('<end>', '終了セル (例: C3)')
  .option('--format <format>', '出力形式 (json, table, csv)', 'table')
  .action(async (file, startCell, endCell, options) => {
    try {
      const spreadsheet = loadSpreadsheetFile(file);
      const startPosition = parseCellPosition(startCell);
      const endPosition = parseCellPosition(endCell);

      const result = getCellRangeValues(spreadsheet, startPosition, endPosition);

      if (result.success && result.data) {
        switch (options.format) {
          case 'json':
            console.log(JSON.stringify({
              range: `${startCell}:${endCell}`,
              values: result.data
            }, null, 2));
            break;
          case 'csv':
            result.data.forEach(row => {
              console.log(row.map(cell => cell || '').join(','));
            });
            break;
          default:
            console.log(chalk.blue(`範囲: ${startCell}:${endCell}`));
            result.data.forEach((row, rowIndex) => {
              const rowNum = startPosition.row + rowIndex + 1;
              const rowStr = row.map((cell, colIndex) => {
                const colNum = startPosition.column + colIndex;
                const cellRef = formatCellPosition({ row: startPosition.row + rowIndex, column: colNum });
                return `${cellRef}:${cell || '(空)'}`;
              }).join(' | ');
              console.log(`行${rowNum}: ${rowStr}`);
            });
        }
      } else {
        console.error(chalk.red('セル範囲の取得に失敗しました:'), result.error);
      }
    } catch (error) {
      handleError(error, 'get-range');
    }
  });

/**
 * セル範囲をクリアする
 */
program
  .command('clear-range')
  .description('セル範囲をクリアする')
  .argument('<file>', 'スプレッドシートファイルパス')
  .argument('<start>', '開始セル (例: A1)')
  .argument('<end>', '終了セル (例: C3)')
  .action(async (file, startCell, endCell) => {
    const spinner = ora('セル範囲をクリア中...').start();

    try {
      const spreadsheet = loadSpreadsheetFile(file);
      const startPosition = parseCellPosition(startCell);
      const endPosition = parseCellPosition(endCell);

      const result = clearCellRange(spreadsheet, startPosition, endPosition);

      if (result.success) {
        saveSpreadsheetFile(result.spreadsheet, file);
        spinner.succeed(`範囲 ${startCell}:${endCell} をクリアしました (${result.data}個のセルを削除)`);
      } else {
        spinner.fail('セル範囲のクリアに失敗しました');
        console.error(chalk.red(result.error));
      }
    } catch (error) {
      spinner.fail('エラーが発生しました');
      handleError(error, 'clear-range');
    }
  });

/**
 * 統計情報を表示する
 */
program
  .command('stats')
  .description('スプレッドシートの統計情報を表示する')
  .argument('<file>', 'スプレッドシートファイルパス')
  .option('--format <format>', '出力形式 (json, table)', 'table')
  .action(async (file, options) => {
    try {
      const spreadsheet = loadSpreadsheetFile(file);
      const result = getSpreadsheetStats(spreadsheet);

      if (result.success && result.data) {
        switch (options.format) {
          case 'json':
            console.log(JSON.stringify(result.data, null, 2));
            break;
          default:
            console.log(chalk.blue('=== スプレッドシート統計 ==='));
            console.log(`名前: ${spreadsheet.name}`);
            console.log(`ID: ${spreadsheet.id}`);
            console.log(`サイズ: ${spreadsheet.rowCount}行 x ${spreadsheet.columnCount}列`);
            console.log(`総セル数: ${result.data.cellCount}`);
            console.log(`空でないセル数: ${result.data.nonEmptyCells}`);
            console.log(`数式セル数: ${result.data.formulaCells}`);
            console.log(`作成日: ${spreadsheet.createdAt.toLocaleString()}`);
            console.log(`最終更新: ${result.data.lastModified.toLocaleString()}`);
        }
      } else {
        console.error(chalk.red('統計情報の取得に失敗しました:'), result.error);
      }
    } catch (error) {
      handleError(error, 'stats');
    }
  });

/**
 * スプレッドシートをコピーする
 */
program
  .command('copy')
  .description('スプレッドシートをコピーする')
  .argument('<source>', 'ソースファイルパス')
  .argument('<target>', 'ターゲットファイルパス')
  .option('-n, --name <name>', '新しいスプレッドシート名')
  .action(async (source, target, options) => {
    const spinner = ora('スプレッドシートをコピー中...').start();

    try {
      const spreadsheet = loadSpreadsheetFile(source);
      const newName = options.name || `${spreadsheet.name} (コピー)`;

      const result = copySpreadsheet(spreadsheet, newName);

      if (result.success && result.data) {
        saveSpreadsheetFile(result.data, target);
        spinner.succeed(`スプレッドシートをコピーしました: ${target}`);
        console.log(chalk.blue('新しいスプレッドシート:'));
        console.log(`  名前: ${result.data.name}`);
        console.log(`  ID: ${result.data.id}`);
      } else {
        spinner.fail('スプレッドシートのコピーに失敗しました');
        console.error(chalk.red(result.error));
      }
    } catch (error) {
      spinner.fail('エラーが発生しました');
      handleError(error, 'copy');
    }
  });

/**
 * スプレッドシート名を変更する
 */
program
  .command('rename')
  .description('スプレッドシート名を変更する')
  .argument('<file>', 'スプレッドシートファイルパス')
  .argument('<name>', '新しい名前')
  .action(async (file, name) => {
    const spinner = ora('スプレッドシート名を変更中...').start();

    try {
      const spreadsheet = loadSpreadsheetFile(file);
      const result = renameSpreadsheet(spreadsheet, name);

      if (result.success && result.data) {
        saveSpreadsheetFile(result.data, file);
        spinner.succeed(`スプレッドシート名を変更しました: ${name}`);
      } else {
        spinner.fail('スプレッドシート名の変更に失敗しました');
        console.error(chalk.red(result.error));
      }
    } catch (error) {
      spinner.fail('エラーが発生しました');
      handleError(error, 'rename');
    }
  });

/**
 * バッチ更新（CSVファイルから読み込み）
 */
program
  .command('batch-update')
  .description('CSVファイルからセルを一括更新する')
  .argument('<file>', 'スプレッドシートファイルパス')
  .argument('<csv>', 'CSVファイルパス')
  .option('--start <cell>', '開始セル位置', 'A1')
  .action(async (file, csvFile, options) => {
    const spinner = ora('バッチ更新中...').start();

    try {
      const spreadsheet = loadSpreadsheetFile(file);
      const csvContent = readFileSync(csvFile, 'utf-8');
      const startPosition = parseCellPosition(options.start);

      // 簡易CSVパーサー
      const rows = csvContent.trim().split('\n').map(row =>
        row.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
      );

      const updates: CellUpdate[] = [];

      rows.forEach((row, rowIndex) => {
        row.forEach((value, colIndex) => {
          if (value.trim()) {
            updates.push({
              position: {
                row: startPosition.row + rowIndex,
                column: startPosition.column + colIndex
              },
              value: value
            });
          }
        });
      });

      const result = batchUpdateCells(spreadsheet, updates);

      if (result.success) {
        saveSpreadsheetFile(result.spreadsheet, file);
        spinner.succeed(`バッチ更新完了: ${result.successCount}/${result.totalCount}件成功`);

        if (result.errors.length > 0) {
          console.log(chalk.yellow('警告: 以下のエラーが発生しました:'));
          result.errors.forEach(error => {
            const cellRef = formatCellPosition(error.position);
            console.log(chalk.red(`  ${cellRef}: ${error.error}`));
          });
        }
      } else {
        spinner.fail('バッチ更新に失敗しました');
      }
    } catch (error) {
      spinner.fail('エラーが発生しました');
      handleError(error, 'batch-update');
    }
  });

// プログラムの実行
program.parse(process.argv);

// コマンドが指定されていない場合はヘルプを表示
if (process.argv.length <= 2) {
  program.outputHelp();
}