import { NextRequest, NextResponse } from 'next/server';
import { createStorageManager } from '@/lib/storage-manager';
import { SpreadsheetFormulaEngine } from '@/lib/formula-engine';

/**
 * UUIDの形式をバリデーション
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * セルアドレスの形式をバリデーション
 */
function isValidCellAddress(address: string): boolean {
  const addressRegex = /^[A-Z]+[1-9][0-9]*$/;
  return addressRegex.test(address);
}

/**
 * セル範囲をパースする
 */
function parseCellRange(rangeStr: string): { start: string; end: string } {
  if (!rangeStr.includes(':')) {
    // 単一セルの場合
    return { start: rangeStr, end: rangeStr };
  }

  const [start, end] = rangeStr.split(':');
  if (!isValidCellAddress(start.trim()) || !isValidCellAddress(end.trim())) {
    throw new Error(`Invalid cell range: ${rangeStr}`);
  }

  return { start: start.trim(), end: end.trim() };
}

/**
 * セルアドレスを行・列に変換
 */
function parseCellAddress(address: string): { row: number; column: number } {
  const match = address.match(/^([A-Z]+)([1-9][0-9]*)$/);
  if (!match) {
    throw new Error(`Invalid cell address: ${address}`);
  }

  const columnLetters = match[1];
  const rowNumber = parseInt(match[2], 10);

  // 列文字を数値に変換
  let column = 0;
  for (let i = 0; i < columnLetters.length; i++) {
    column = column * 26 + (columnLetters.charCodeAt(i) - 65 + 1);
  }
  column -= 1; // 0ベースに調整

  return {
    row: rowNumber - 1, // 0ベースに調整
    column
  };
}

/**
 * 範囲内のセルアドレス一覧を取得
 */
function getCellsInRange(startAddress: string, endAddress: string): string[] {
  const start = parseCellAddress(startAddress);
  const end = parseCellAddress(endAddress);

  const cells: string[] = [];

  for (let row = start.row; row <= end.row; row++) {
    for (let col = start.column; col <= end.column; col++) {
      // 行・列を A1 形式のアドレスに変換
      let columnStr = '';
      let columnIndex = col;
      while (columnIndex >= 0) {
        columnStr = String.fromCharCode(65 + (columnIndex % 26)) + columnStr;
        columnIndex = Math.floor(columnIndex / 26) - 1;
      }
      const address = `${columnStr}${row + 1}`;
      cells.push(address);
    }
  }

  return cells;
}

/**
 * 数式再計算 (T056)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = performance.now();

  try {
    const { id } = params;

    // UUIDバリデーション
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: '不正なスプレッドシートIDです' },
        { status: 400 }
      );
    }

    const storageManager = createStorageManager();

    // スプレッドシートを読み込み
    const loadResult = await storageManager.loadSpreadsheet(id);
    if (!loadResult.success || !loadResult.data) {
      return NextResponse.json(
        { error: 'スプレッドシートが見つかりません' },
        { status: 404 }
      );
    }

    const spreadsheet = loadResult.data;

    // リクエストボディを解析（範囲指定がある場合）
    let targetCells: string[] = [];

    try {
      const body = await request.json().catch(() => null);

      if (body && body.range) {
        // 範囲が指定されている場合
        if (typeof body.range === 'object' && body.range.start && body.range.end) {
          if (!isValidCellAddress(body.range.start) || !isValidCellAddress(body.range.end)) {
            return NextResponse.json(
              { error: '不正なセル範囲です' },
              { status: 400 }
            );
          }

          targetCells = getCellsInRange(body.range.start, body.range.end);
        } else {
          return NextResponse.json(
            { error: 'range オブジェクトには start と end が必要です' },
            { status: 400 }
          );
        }
      } else {
        // 範囲が指定されていない場合は全てのセルを対象とする
        targetCells = Array.from(spreadsheet.cells.keys());
      }
    } catch (error) {
      // JSON パースに失敗した場合は全てのセルを対象とする
      targetCells = Array.from(spreadsheet.cells.keys());
    }

    // 数式エンジンを初期化
    const formulaEngine = new SpreadsheetFormulaEngine({
      useArrayArithmetic: true,
      matrixDetection: true,
      precisionRounding: 5
    });

    // スプレッドシートを数式エンジンに読み込み
    try {
      await formulaEngine.loadSpreadsheet(spreadsheet);
    } catch (error) {
      console.error('数式エンジンへのスプレッドシート読み込みエラー:', error);
      return NextResponse.json(
        { error: '数式エンジンの初期化に失敗しました' },
        { status: 500 }
      );
    }

    // 対象セルの数式を再計算
    const calculatedCells: any[] = [];
    let hasChanges = false;

    for (const cellAddress of targetCells) {
      const cell = spreadsheet.cells.get(cellAddress);

      if (!cell || !cell.formula || !cell.formula.startsWith('=')) {
        // 数式が無い場合はスキップ
        continue;
      }

      try {
        // 数式を計算
        const result = await formulaEngine.calculateFormula(
          cell.formula,
          { row: cell.address.row, column: cell.address.column }
        );

        if (result.success) {
          // 計算結果でセルの値を更新
          const oldValue = cell.value;
          cell.value = result.value;
          cell.error = undefined;

          // 値が変更された場合のみhasChangesをtrueに
          if (oldValue !== result.value) {
            hasChanges = true;
          }

          calculatedCells.push({
            address: {
              row: cell.address.row,
              column: cell.address.column,
              address: cellAddress
            },
            value: result.value,
            formula: cell.formula,
            type: cell.type,
            error: undefined
          });
        } else {
          // 計算エラーの場合
          cell.error = result.error;

          calculatedCells.push({
            address: {
              row: cell.address.row,
              column: cell.address.column,
              address: cellAddress
            },
            value: cell.value,
            formula: cell.formula,
            type: cell.type,
            error: result.error
          });
        }

        // スプレッドシートのセルを更新
        spreadsheet.cells.set(cellAddress, cell);

      } catch (error) {
        console.error(`セル ${cellAddress} の計算エラー:`, error);

        // エラー情報をセルに設定
        cell.error = {
          type: '#VALUE!',
          message: error instanceof Error ? error.message : '計算エラーが発生しました'
        };

        calculatedCells.push({
          address: {
            row: cell.address.row,
            column: cell.address.column,
            address: cellAddress
          },
          value: cell.value,
          formula: cell.formula,
          type: cell.type,
          error: cell.error
        });

        spreadsheet.cells.set(cellAddress, cell);
      }
    }

    // 変更があった場合のみスプレッドシートを保存
    if (hasChanges) {
      spreadsheet.updatedAt = new Date();

      const saveResult = await storageManager.saveSpreadsheet(id, spreadsheet);
      if (!saveResult.success) {
        return NextResponse.json(
          { error: saveResult.error || 'スプレッドシートの保存に失敗しました' },
          { status: 500 }
        );
      }
    }

    // 計算時間を測定
    const executionTime = performance.now() - startTime;

    const response = {
      cells: calculatedCells,
      executionTime: Math.round(executionTime * 100) / 100 // 小数点2桁まで
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('数式再計算APIエラー:', error);

    const executionTime = performance.now() - startTime;

    return NextResponse.json(
      {
        error: 'サーバーエラーが発生しました',
        executionTime: Math.round(executionTime * 100) / 100
      },
      { status: 500 }
    );
  }
}