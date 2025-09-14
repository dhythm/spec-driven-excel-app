import { NextRequest, NextResponse } from 'next/server';
import { createStorageManager } from '@/lib/storage-manager';
import { Spreadsheet } from '@/lib/spreadsheet';
import { v4 as uuidv4 } from 'uuid';

/**
 * スプレッドシート一覧取得 (T051)
 */
export async function GET() {
  try {
    const storageManager = createStorageManager();
    const result = await storageManager.listSpreadsheets();

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || 'スプレッドシート一覧の取得に失敗しました' },
        { status: 500 }
      );
    }

    // OpenAPI仕様に合わせてSpreadsheetMetadata形式でレスポンス
    const spreadsheets = result.data.map(metadata => ({
      id: metadata.id,
      name: metadata.name,
      createdAt: metadata.createdAt.toISOString(),
      updatedAt: metadata.updatedAt.toISOString(),
      size: metadata.size,
      compressed: metadata.compressed
    }));

    return NextResponse.json(spreadsheets, { status: 200 });
  } catch (error) {
    console.error('スプレッドシート一覧取得エラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * 新規スプレッドシート作成 (T052)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // バリデーション
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

    // デフォルトのグリッドサイズ
    const defaultGridSize = {
      rowCount: 100,
      columnCount: 26
    };

    let gridSize = defaultGridSize;

    if (body.gridSize) {
      // グリッドサイズのバリデーション
      if (!body.gridSize.rowCount || !body.gridSize.columnCount) {
        return NextResponse.json(
          { error: 'gridSizeにはrowCountとcolumnCountが必要です' },
          { status: 400 }
        );
      }

      if (body.gridSize.rowCount < 1 || body.gridSize.rowCount > 1000) {
        return NextResponse.json(
          { error: 'rowCountは1から1000の間で指定してください' },
          { status: 400 }
        );
      }

      if (body.gridSize.columnCount < 1 || body.gridSize.columnCount > 1000) {
        return NextResponse.json(
          { error: 'columnCountは1から1000の間で指定してください' },
          { status: 400 }
        );
      }

      gridSize = body.gridSize;
    }

    // 新しいスプレッドシートを作成
    const id = uuidv4();
    const now = new Date();

    const spreadsheet: Spreadsheet = {
      id,
      name: body.name.trim(),
      createdAt: now,
      updatedAt: now,
      gridSize,
      cells: new Map(),
      rows: Array.from({ length: gridSize.rowCount }, (_, index) => ({
        index,
        height: 25,
        visible: true,
        frozen: false
      })),
      columns: Array.from({ length: gridSize.columnCount }, (_, index) => ({
        index,
        width: 80,
        visible: true,
        frozen: false,
        label: String.fromCharCode(65 + index % 26) // A, B, C, ...
      })),
      version: '1.0'
    };

    // ストレージに保存
    const storageManager = createStorageManager();
    const saveResult = await storageManager.saveSpreadsheet(id, spreadsheet);

    if (!saveResult.success) {
      return NextResponse.json(
        { error: saveResult.error || 'スプレッドシートの保存に失敗しました' },
        { status: 500 }
      );
    }

    // レスポンス用にcellsを除外（空なので省略）
    const responseSpreadsheet = {
      ...spreadsheet,
      createdAt: spreadsheet.createdAt.toISOString(),
      updatedAt: spreadsheet.updatedAt.toISOString(),
      cells: {}
    };

    return NextResponse.json(responseSpreadsheet, { status: 201 });
  } catch (error) {
    console.error('スプレッドシート作成エラー:', error);

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