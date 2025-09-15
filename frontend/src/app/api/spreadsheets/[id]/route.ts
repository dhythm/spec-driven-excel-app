import { NextRequest, NextResponse } from 'next/server';
import { createStorageManager } from '@/lib/storage-manager';
import { Spreadsheet } from '@/lib/spreadsheet';

/**
 * UUIDの形式をバリデーション
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * スプレッドシート取得 (T053)
 */
export async function GET(
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

    const storageManager = createStorageManager();
    const result = await storageManager.loadSpreadsheet(id);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: 'スプレッドシートが見つかりません' },
        { status: 404 }
      );
    }

    const spreadsheet = result.data;

    // レスポンス用にMapを通常のオブジェクトに変換
    const responseSpreadsheet = {
      ...spreadsheet,
      createdAt: spreadsheet.createdAt.toISOString(),
      updatedAt: spreadsheet.updatedAt.toISOString(),
      cells: Object.fromEntries(
        Array.from(spreadsheet.cells.entries()).map(([key, cell]) => [
          key,
          {
            ...cell,
            address: typeof cell.address === 'string' ? {
              address: cell.address,
              row: parseInt(cell.address.replace(/[A-Z]/g, '')) - 1,
              column: cell.address.replace(/[0-9]/g, '').charCodeAt(0) - 65
            } : cell.address
          }
        ])
      )
    };

    return NextResponse.json(responseSpreadsheet, { status: 200 });
  } catch (error) {
    console.error('スプレッドシート取得エラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * スプレッドシート更新 (T054)
 */
export async function PUT(
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

    // 基本的なバリデーション
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: 'nameフィールドは必須です' },
        { status: 400 }
      );
    }

    if (body.name.length > 255) {
      return NextResponse.json(
        { error: 'nameは255文字以下である必要があります' },
        { status: 400 }
      );
    }

    if (!body.gridSize || !body.gridSize.rowCount || !body.gridSize.columnCount) {
      return NextResponse.json(
        { error: 'gridSizeは必須です' },
        { status: 400 }
      );
    }

    if (!body.version || typeof body.version !== 'string') {
      return NextResponse.json(
        { error: 'versionフィールドは必須です' },
        { status: 400 }
      );
    }

    const storageManager = createStorageManager();

    // 既存のスプレッドシートを確認
    const existingResult = await storageManager.loadSpreadsheet(id);
    if (!existingResult.success || !existingResult.data) {
      return NextResponse.json(
        { error: 'スプレッドシートが見つかりません' },
        { status: 404 }
      );
    }

    const existingSpreadsheet = existingResult.data;

    // cellsオブジェクトをMapに変換
    const cellsMap = new Map();
    if (body.cells && typeof body.cells === 'object') {
      for (const [key, cell] of Object.entries(body.cells)) {
        if (cell && typeof cell === 'object') {
          cellsMap.set(key, cell);
        }
      }
    }

    // 更新されたスプレッドシートオブジェクトを作成
    const updatedSpreadsheet: Spreadsheet = {
      ...existingSpreadsheet,
      name: body.name.trim(),
      updatedAt: new Date(),
      gridSize: body.gridSize,
      cells: cellsMap,
      rows: body.rows || existingSpreadsheet.rows,
      columns: body.columns || existingSpreadsheet.columns,
      version: body.version
    };

    // 日付フィールドの処理
    if (body.createdAt) {
      updatedSpreadsheet.createdAt = new Date(body.createdAt);
    }

    // ストレージに保存
    const saveResult = await storageManager.saveSpreadsheet(id, updatedSpreadsheet);

    if (!saveResult.success) {
      return NextResponse.json(
        { error: saveResult.error || 'スプレッドシートの更新に失敗しました' },
        { status: 500 }
      );
    }

    // レスポンス用にMapを通常のオブジェクトに変換
    const responseSpreadsheet = {
      ...updatedSpreadsheet,
      createdAt: updatedSpreadsheet.createdAt.toISOString(),
      updatedAt: updatedSpreadsheet.updatedAt.toISOString(),
      cells: Object.fromEntries(
        Array.from(updatedSpreadsheet.cells.entries()).map(([key, cell]) => [
          key,
          {
            ...cell,
            address: typeof cell.address === 'string' ? {
              address: cell.address,
              row: parseInt(cell.address.replace(/[A-Z]/g, '')) - 1,
              column: cell.address.replace(/[0-9]/g, '').charCodeAt(0) - 65
            } : cell.address
          }
        ])
      )
    };

    return NextResponse.json(responseSpreadsheet, { status: 200 });
  } catch (error) {
    console.error('スプレッドシート更新エラー:', error);

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

/**
 * スプレッドシート削除
 * OpenAPI仕様には含まれていますが、要求されていないので実装をコメントアウト
 */
/*
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: '不正なスプレッドシートIDです' },
        { status: 400 }
      );
    }

    const storageManager = createStorageManager();
    const result = await storageManager.deleteSpreadsheet(id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'スプレッドシートの削除に失敗しました' },
        { status: 500 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('スプレッドシート削除エラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
*/