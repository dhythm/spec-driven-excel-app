#!/usr/bin/env node

/**
 * Formula CLI Tool (T060)
 * 数式計算と解析を提供するCLIツール
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// コアライブラリのインポート
import {
  SpreadsheetFormulaEngine,
  createFormulaEngine,
  validateFormulaSyntax,
  FormulaCalculationResult,
  FormulaEngineConfig
} from '../../src/lib/formula-engine/index';

import { Spreadsheet } from '../../src/lib/spreadsheet';
import { CellPosition } from '../../src/lib/cell';

// CLIプログラムの設定
const program = new Command();

program
  .name('formula-cli')
  .description('Formula calculation and analysis CLI tool')
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
 * 数式計算結果を表示する
 */
function displayCalculationResult(result: FormulaCalculationResult, context?: string): void {
  if (result.success) {
    console.log(chalk.green(context ? `${context}: 成功` : '計算成功'));
    console.log(chalk.blue('値:'), result.value);
    console.log(chalk.blue('表示値:'), result.displayValue);
  } else {
    console.error(chalk.red(context ? `${context}: 失敗` : '計算失敗'));
    if (result.error) {
      console.error(chalk.red('エラータイプ:'), result.error.type);
      console.error(chalk.red('エラーメッセージ:'), result.error.message);
    }
  }
}

// ====================
// コマンド実装
// ====================

/**
 * 数式を評価する（単発計算）
 */
program
  .command('evaluate')
  .description('数式を評価する')
  .argument('<formula>', '評価する数式 (=SUM(1,2,3) など)')
  .option('--context <cell>', 'コンテキストセル位置 (例: A1)', 'A1')
  .option('--format <format>', '出力形式 (json, table, raw)', 'table')
  .action(async (formula, options) => {
    const spinner = ora('数式を評価中...').start();

    try {
      const engine = createFormulaEngine();
      const contextPosition = parseCellPosition(options.context);

      const result = engine.evaluateFormula(formula, contextPosition);

      spinner.stop();

      switch (options.format) {
        case 'json':
          console.log(JSON.stringify({
            formula,
            context: options.context,
            result: {
              success: result.success,
              value: result.value,
              displayValue: result.displayValue,
              error: result.error
            }
          }, null, 2));
          break;
        case 'raw':
          if (result.success) {
            console.log(result.displayValue || result.value || '');
          } else {
            console.error(result.error?.message || 'エラー');
          }
          break;
        default:
          console.log(chalk.blue('数式:'), formula);
          console.log(chalk.blue('コンテキスト:'), options.context);
          displayCalculationResult(result);
      }

      engine.destroy();
    } catch (error) {
      spinner.fail('エラーが発生しました');
      handleError(error, 'evaluate');
    }
  });

/**
 * 数式の構文チェック
 */
program
  .command('validate')
  .description('数式の構文を検証する')
  .argument('<formula>', '検証する数式')
  .option('--format <format>', '出力形式 (json, table)', 'table')
  .action(async (formula, options) => {
    const spinner = ora('数式を検証中...').start();

    try {
      const result = validateFormulaSyntax(formula);
      spinner.stop();

      switch (options.format) {
        case 'json':
          console.log(JSON.stringify({
            formula,
            validation: result
          }, null, 2));
          break;
        default:
          console.log(chalk.blue('数式:'), formula);
          if (result.isValid) {
            console.log(chalk.green('✓ 構文は正しいです'));
          } else {
            console.log(chalk.red('✗ 構文エラーがあります'));
            console.log(chalk.red('エラー:'), result.error);
          }
      }
    } catch (error) {
      spinner.fail('エラーが発生しました');
      handleError(error, 'validate');
    }
  });

/**
 * スプレッドシートで数式を計算する
 */
program
  .command('calculate')
  .description('スプレッドシートのセルの数式を計算する')
  .argument('<file>', 'スプレッドシートファイルパス')
  .argument('<cell>', '計算するセル参照 (例: A1)')
  .option('--update', '計算結果でセルを更新する', false)
  .option('--format <format>', '出力形式 (json, table)', 'table')
  .action(async (file, cellRef, options) => {
    const spinner = ora('セルの数式を計算中...').start();

    try {
      const spreadsheet = loadSpreadsheetFile(file);
      const position = parseCellPosition(cellRef);

      const engine = createFormulaEngine();
      engine.setSpreadsheetData(spreadsheet);

      const result = engine.calculateCell(position);

      if (options.update && result.success) {
        // 計算結果でスプレッドシートを更新
        const key = `${position.row}-${position.column}`;
        const existingCell = spreadsheet.cells.get(key);

        if (existingCell) {
          existingCell.calculatedValue = result.value;
          existingCell.displayValue = result.displayValue || String(result.value);
          existingCell.updatedAt = new Date();
        }

        spreadsheet.updatedAt = new Date();
        saveSpreadsheetFile(spreadsheet, file);
      }

      spinner.stop();

      switch (options.format) {
        case 'json':
          console.log(JSON.stringify({
            cell: cellRef,
            position,
            result: {
              success: result.success,
              value: result.value,
              displayValue: result.displayValue,
              error: result.error
            },
            updated: options.update && result.success
          }, null, 2));
          break;
        default:
          console.log(chalk.blue('セル:'), cellRef);
          displayCalculationResult(result, 'セル計算');
          if (options.update && result.success) {
            console.log(chalk.green('✓ スプレッドシートを更新しました'));
          }
      }

      engine.destroy();
    } catch (error) {
      spinner.fail('エラーが発生しました');
      handleError(error, 'calculate');
    }
  });

/**
 * セル範囲の一括計算
 */
program
  .command('calculate-range')
  .description('セル範囲の数式を一括計算する')
  .argument('<file>', 'スプレッドシートファイルパス')
  .argument('<start>', '開始セル (例: A1)')
  .argument('<end>', '終了セル (例: C3)')
  .option('--update', '計算結果でセルを更新する', false)
  .option('--format <format>', '出力形式 (json, table)', 'table')
  .action(async (file, startCell, endCell, options) => {
    const spinner = ora('セル範囲を計算中...').start();

    try {
      const spreadsheet = loadSpreadsheetFile(file);
      const startPosition = parseCellPosition(startCell);
      const endPosition = parseCellPosition(endCell);

      const engine = createFormulaEngine();
      engine.setSpreadsheetData(spreadsheet);

      const result = engine.getCellRangeValues(startPosition, endPosition);

      if (options.update && result.success && result.values) {
        let updatedCount = 0;

        // 計算結果でスプレッドシートを更新
        for (let rowIndex = 0; rowIndex < result.values.length; rowIndex++) {
          for (let colIndex = 0; colIndex < result.values[rowIndex].length; colIndex++) {
            const position = {
              row: startPosition.row + rowIndex,
              column: startPosition.column + colIndex
            };
            const key = `${position.row}-${position.column}`;
            const existingCell = spreadsheet.cells.get(key);
            const value = result.values[rowIndex][colIndex];

            if (existingCell && value !== null && value !== undefined) {
              existingCell.calculatedValue = value;
              existingCell.displayValue = String(value);
              existingCell.updatedAt = new Date();
              updatedCount++;
            }
          }
        }

        if (updatedCount > 0) {
          spreadsheet.updatedAt = new Date();
          saveSpreadsheetFile(spreadsheet, file);
        }
      }

      spinner.stop();

      switch (options.format) {
        case 'json':
          console.log(JSON.stringify({
            range: `${startCell}:${endCell}`,
            values: result.values,
            success: result.success,
            error: result.error,
            updated: options.update && result.success
          }, null, 2));
          break;
        default:
          console.log(chalk.blue(`範囲: ${startCell}:${endCell}`));
          if (result.success && result.values) {
            result.values.forEach((row, rowIndex) => {
              const rowValues = row.map((value, colIndex) => {
                const cellPos = {
                  row: startPosition.row + rowIndex,
                  column: startPosition.column + colIndex
                };
                const cellRef = formatCellPosition(cellPos);
                return `${cellRef}: ${value !== null && value !== undefined ? value : '(空)'}`;
              }).join(' | ');
              console.log(`行${startPosition.row + rowIndex + 1}: ${rowValues}`);
            });

            if (options.update) {
              console.log(chalk.green('✓ スプレッドシートを更新しました'));
            }
          } else {
            console.error(chalk.red('範囲計算に失敗:'), result.error?.message);
          }
      }

      engine.destroy();
    } catch (error) {
      spinner.fail('エラーが発生しました');
      handleError(error, 'calculate-range');
    }
  });

/**
 * セルの依存関係を取得
 */
program
  .command('dependencies')
  .description('セルの依存関係を取得する')
  .argument('<file>', 'スプレッドシートファイルパス')
  .argument('<cell>', 'セル参照 (例: A1)')
  .option('--format <format>', '出力形式 (json, table)', 'table')
  .action(async (file, cellRef, options) => {
    try {
      const spreadsheet = loadSpreadsheetFile(file);
      const position = parseCellPosition(cellRef);

      const engine = createFormulaEngine();
      engine.setSpreadsheetData(spreadsheet);

      const dependencies = engine.getCellDependencies(position);
      const precedents = engine.getCellPrecedents(position);

      switch (options.format) {
        case 'json':
          console.log(JSON.stringify({
            cell: cellRef,
            dependencies: dependencies.map(dep => formatCellPosition(dep)),
            precedents: precedents.map(prec => formatCellPosition(prec))
          }, null, 2));
          break;
        default:
          console.log(chalk.blue('セル:'), cellRef);
          console.log(chalk.blue('依存先:'),
            dependencies.length > 0
              ? dependencies.map(dep => formatCellPosition(dep)).join(', ')
              : '(なし)'
          );
          console.log(chalk.blue('被依存:'),
            precedents.length > 0
              ? precedents.map(prec => formatCellPosition(prec)).join(', ')
              : '(なし)'
          );
      }

      engine.destroy();
    } catch (error) {
      handleError(error, 'dependencies');
    }
  });

/**
 * セルの数式を取得
 */
program
  .command('get-formula')
  .description('セルの数式を取得する')
  .argument('<file>', 'スプレッドシートファイルパス')
  .argument('<cell>', 'セル参照 (例: A1)')
  .option('--format <format>', '出力形式 (json, table, raw)', 'table')
  .action(async (file, cellRef, options) => {
    try {
      const spreadsheet = loadSpreadsheetFile(file);
      const position = parseCellPosition(cellRef);

      const engine = createFormulaEngine();
      engine.setSpreadsheetData(spreadsheet);

      const formula = engine.getCellFormula(position);
      const valueType = engine.getCellValueType(position);

      switch (options.format) {
        case 'json':
          console.log(JSON.stringify({
            cell: cellRef,
            formula: formula || null,
            valueType
          }, null, 2));
          break;
        case 'raw':
          console.log(formula || '');
          break;
        default:
          console.log(chalk.blue('セル:'), cellRef);
          console.log(chalk.blue('数式:'), formula || '(数式なし)');
          console.log(chalk.blue('値の型:'), valueType);
      }

      engine.destroy();
    } catch (error) {
      handleError(error, 'get-formula');
    }
  });

/**
 * 利用可能な関数のリストを表示
 */
program
  .command('functions')
  .description('利用可能な関数のリストを表示する')
  .option('--filter <filter>', '関数名のフィルター')
  .option('--format <format>', '出力形式 (json, list)', 'list')
  .action(async (options) => {
    try {
      const engine = createFormulaEngine();
      const functions = engine.getAvailableFunctions();

      let filteredFunctions = functions;
      if (options.filter) {
        const filterRegex = new RegExp(options.filter, 'i');
        filteredFunctions = functions.filter(func => filterRegex.test(func));
      }

      switch (options.format) {
        case 'json':
          console.log(JSON.stringify({
            totalFunctions: functions.length,
            filteredFunctions: filteredFunctions.length,
            functions: filteredFunctions
          }, null, 2));
          break;
        default:
          console.log(chalk.blue(`利用可能な関数 (${filteredFunctions.length}/${functions.length}):`));

          // 列に分けて表示
          const columns = 4;
          const maxLength = Math.max(...filteredFunctions.map(f => f.length));

          for (let i = 0; i < filteredFunctions.length; i += columns) {
            const row = filteredFunctions.slice(i, i + columns);
            const formattedRow = row.map(func => func.padEnd(maxLength)).join('  ');
            console.log(`  ${formattedRow}`);
          }
      }

      engine.destroy();
    } catch (error) {
      handleError(error, 'functions');
    }
  });

/**
 * エンジン統計情報を表示
 */
program
  .command('engine-stats')
  .description('数式エンジンの統計情報を表示する')
  .argument('<file>', 'スプレッドシートファイルパス')
  .option('--format <format>', '出力形式 (json, table)', 'table')
  .action(async (file, options) => {
    try {
      const spreadsheet = loadSpreadsheetFile(file);

      const engine = createFormulaEngine();
      engine.setSpreadsheetData(spreadsheet);

      const stats = engine.getEngineStats();

      switch (options.format) {
        case 'json':
          console.log(JSON.stringify(stats, null, 2));
          break;
        default:
          console.log(chalk.blue('=== 数式エンジン統計 ==='));
          console.log(`総セル数: ${stats.cellsCount}`);
          console.log(`数式セル数: ${stats.formulasCount}`);
          console.log(`使用関数数: ${stats.functionsUsed.length}`);
          if (stats.functionsUsed.length > 0) {
            console.log(`使用関数: ${stats.functionsUsed.join(', ')}`);
          }
      }

      engine.destroy();
    } catch (error) {
      handleError(error, 'engine-stats');
    }
  });

/**
 * 対話モード
 */
program
  .command('interactive')
  .description('対話モードで数式を評価する')
  .option('--file <file>', 'スプレッドシートファイル（オプション）')
  .action(async (options) => {
    console.log(chalk.blue('数式対話モードを開始します。終了するには "exit" を入力してください。'));

    let engine: SpreadsheetFormulaEngine;
    let spreadsheet: Spreadsheet | undefined;

    // スプレッドシートが指定されている場合は読み込む
    if (options.file) {
      try {
        spreadsheet = loadSpreadsheetFile(options.file);
        engine = createFormulaEngine();
        engine.setSpreadsheetData(spreadsheet);
        console.log(chalk.green(`スプレッドシートを読み込みました: ${options.file}`));
      } catch (error) {
        console.log(chalk.yellow('スプレッドシートの読み込みに失敗しました。単発計算モードで続行します。'));
        engine = createFormulaEngine();
      }
    } else {
      engine = createFormulaEngine();
    }

    while (true) {
      try {
        const { formula } = await inquirer.prompt([
          {
            type: 'input',
            name: 'formula',
            message: 'formula>',
            validate: (input: string) => {
              if (!input.trim()) return '数式を入力してください';
              if (input.trim().toLowerCase() === 'exit') return true;
              return true;
            }
          }
        ]);

        if (formula.trim().toLowerCase() === 'exit') {
          break;
        }

        if (formula.startsWith('?')) {
          // ヘルプコマンド
          console.log(chalk.blue('利用可能なコマンド:'));
          console.log('  数式を入力 (例: =SUM(1,2,3))');
          console.log('  ?help - このヘルプを表示');
          console.log('  ?functions - 利用可能な関数を表示');
          console.log('  exit - 終了');
          continue;
        }

        if (formula === '?functions') {
          const functions = engine.getAvailableFunctions();
          console.log(chalk.blue(`利用可能な関数 (${functions.length}個):`));

          // 5列で表示
          for (let i = 0; i < functions.length; i += 5) {
            const row = functions.slice(i, i + 5);
            console.log(`  ${row.join('  ')}`);
          }
          continue;
        }

        // 数式を評価
        const result = engine.evaluateFormula(formula);
        displayCalculationResult(result, '評価結果');

      } catch (error) {
        console.error(chalk.red('エラー:'), error);
      }
    }

    engine.destroy();
    console.log(chalk.blue('対話モードを終了しました。'));
  });

// プログラムの実行
program.parse(process.argv);

// コマンドが指定されていない場合はヘルプを表示
if (process.argv.length <= 2) {
  program.outputHelp();
}