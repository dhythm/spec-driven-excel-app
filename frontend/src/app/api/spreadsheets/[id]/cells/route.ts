import { NextRequest, NextResponse } from 'next/server';
import { createStorageManager } from '@/lib/storage-manager';
import { Cell } from '@/lib/cell';

/**
 * UUIDの形式をバリデーション
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * セルアドレスの形式をバリデーション (A1, B2, etc.)
 */
function isValidCellAddress(address: string): boolean {
  const addressRegex = /^[A-Z]+[1-9][0-9]*$/;
  return addressRegex.test(address);
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

  // 列文字を数値に変換 (A=0, B=1, ..., Z=25, AA=26, etc.)
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
 * セルの値の型を判定
 */
function getCellType(value: any, formula?: string): string {
  if (formula && typeof formula === 'string' && formula.startsWith('=')) {
    return 'formula';
  }

  if (value === null || value === undefined || value === '') {
    return 'empty';
  }

  if (typeof value === 'number') {
    return 'number';
  }

  if (typeof value === 'boolean') {
    return 'boolean';
  }

  if (typeof value === 'string') {
    // 日付かどうかのチェック（簡易版）
    const dateValue = new Date(value);
    if (!isNaN(dateValue.getTime()) && value.includes('-') || value.includes('/')) {
      return 'date';
    }
    return 'text';
  }

  return 'text';
}

/**
 * セル更新（バッチ） (T055)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // UUIDバリデーション
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: '不正なスプレッドシートIDです' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // リクエストボディのバリデーション
    if (!body.cells || !Array.isArray(body.cells)) {
      return NextResponse.json(
        { error: 'cellsフィールドは配列である必要があります' },
        { status: 400 }
      );
    }

    if (body.cells.length === 0) {
      return NextResponse.json(
        { error: '更新するセルが指定されていません' },
        { status: 400 }
      );
    }

    const storageManager = createStorageManager();

    // 既存のスプレッドシートを読み込み
    const loadResult = await storageManager.loadSpreadsheet(id);
    if (!loadResult.success || !loadResult.data) {
      return NextResponse.json(
        { error: 'スプレッドシートが見つかりません' },
        { status: 404 }
      );
    }

    const spreadsheet = loadResult.data;
    const updatedCells: Cell[] = [];
    const errors: Array<{ address: string; error: any }> = [];

    // 各セル更新を処理
    for (const cellUpdate of body.cells) {
      try {
        // セルアドレスのバリデーション
        if (!cellUpdate.address || typeof cellUpdate.address !== 'string') {
          errors.push({
            address: cellUpdate.address || 'unknown',
            error: {
              type: '#VALUE!',
              message: 'セルアドレスが無効です',
              details: {}
            }
          });
          continue;
        }

        if (!isValidCellAddress(cellUpdate.address)) {
          errors.push({
            address: cellUpdate.address,
            error: {
              type: '#REF!',
              message: 'セルアドレスの形式が不正です',
              details: {}
            }
          });
          continue;
        }

        const { row, column } = parseCellAddress(cellUpdate.address);

        // グリッド範囲チェック
        if (row >= spreadsheet.gridSize.rowCount || column >= spreadsheet.gridSize.columnCount) {
          errors.push({
            address: cellUpdate.address,
            error: {
              type: '#REF!',
              message: 'セルアドレスがグリッドの範囲外です',
              details: { row, column, gridSize: spreadsheet.gridSize }
            }
          });
          continue;
        }

        // セルオブジェクトを作成または更新
        const cellType = getCellType(cellUpdate.value, cellUpdate.formula);

        const cell: Cell = {
          address: {
            row,
            column,
            address: cellUpdate.address
          },
          value: cellUpdate.value,
          formula: cellUpdate.formula,
          type: cellType as any,
          error: undefined
        };

        // 数式がある場合の簡易バリデーション
        if (cell.formula && !cell.formula.startsWith('=')) {
          errors.push({
            address: cellUpdate.address,
            error: {
              type: '#VALUE!',
              message: '数式は=で始まる必要があります',
              details: { formula: cell.formula }
            }
          });
          continue;
        }

        // スプレッドシートのセルマップを更新
        spreadsheet.cells.set(cellUpdate.address, cell);
        updatedCells.push(cell);

      } catch (error) {
        console.error(`セル ${cellUpdate.address} の更新エラー:`, error);
        errors.push({
          address: cellUpdate.address || 'unknown',
          error: {
            type: '#VALUE!',
            message: error instanceof Error ? error.message : 'セルの更新に失敗しました',
            details: {}
          }
        });
      }
    }

    // スプレッドシートの更新日時を更新
    spreadsheet.updatedAt = new Date();

    // ストレージに保存
    const saveResult = await storageManager.saveSpreadsheet(id, spreadsheet);
    if (!saveResult.success) {
      return NextResponse.json(
        { error: saveResult.error || 'スプレッドシートの保存に失敗しました' },
        { status: 500 }
      );
    }

    // レスポンスを作成
    const response = {
      updated: updatedCells.map(cell => ({
        ...cell,
        address: typeof cell.address === 'object' ? cell.address : {
          address: cell.address,
          row: parseCellAddress(cell.address as string).row,
          column: parseCellAddress(cell.address as string).column
        }
      })),
      errors: errors.map(error => ({
        address: error.address,
        error: error.error
      }))
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('セル更新APIエラー:', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: '不正なJSONフォーマットです' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}