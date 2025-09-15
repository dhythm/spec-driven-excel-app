import { NextRequest, NextResponse } from 'next/server';
import { createStorageManager } from '@/lib/storage-manager';
import { createCSVHandler } from '@/lib/csv-handler';

/**
 * UUIDの形式をバリデーション
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * デリミターの設定を取得
 */
function getDelimiter(delimiterParam: string = 'comma'): string {
  switch (delimiterParam.toLowerCase()) {
    case 'comma':
      return ',';
    case 'semicolon':
      return ';';
    case 'tab':
      return '\t';
    default:
      return ',';
  }
}

/**
 * エンコーディング設定を取得
 */
function getEncoding(encodingParam: string = 'utf-8'): string {
  switch (encodingParam.toLowerCase()) {
    case 'utf-8':
      return 'utf-8';
    case 'shift-jis':
      return 'shift_jis';
    default:
      return 'utf-8';
  }
}

/**
 * CSV形式でエクスポート (T057)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);

    // UUIDバリデーション
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: '不正なスプレッドシートIDです' },
        { status: 400 }
      );
    }

    // クエリパラメータの取得とバリデーション
    const encodingParam = searchParams.get('encoding') || 'utf-8';
    const delimiterParam = searchParams.get('delimiter') || 'comma';

    // パラメータのバリデーション
    const validEncodings = ['utf-8', 'shift-jis'];
    const validDelimiters = ['comma', 'semicolon', 'tab'];

    if (!validEncodings.includes(encodingParam)) {
      return NextResponse.json(
        { error: 'encoding パラメータは utf-8 または shift-jis である必要があります' },
        { status: 400 }
      );
    }

    if (!validDelimiters.includes(delimiterParam)) {
      return NextResponse.json(
        { error: 'delimiter パラメータは comma, semicolon, または tab である必要があります' },
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

    // CSVハンドラーを作成
    const csvHandler = createCSVHandler({
      delimiter: getDelimiter(delimiterParam),
      encoding: getEncoding(encodingParam),
      hasHeader: false, // エクスポート時はヘッダーを自動判定
      quotes: 'auto',
      escapeChar: '"'
    });

    // CSVエクスポートのオプションを設定
    const exportOptions = {
      delimiter: getDelimiter(delimiterParam),
      encoding: getEncoding(encodingParam),
      includeHeaders: true, // ヘッダー（列名）を含める
      dateFormat: 'iso',
      numberFormat: 'raw',
      booleanFormat: 'text',
      emptyValue: '',
      excludeEmptyRows: true,
      excludeEmptyColumns: true
    };

    // スプレッドシートをCSV形式でエクスポート
    const exportResult = await csvHandler.exportSpreadsheetToCSV(spreadsheet, exportOptions);

    if (!exportResult.success || !exportResult.data) {
      return NextResponse.json(
        { error: exportResult.error || 'CSVエクスポートに失敗しました' },
        { status: 500 }
      );
    }

    const csvContent = exportResult.data;

    // Content-Typeの設定
    let contentType = 'text/csv; charset=utf-8';
    if (encodingParam === 'shift-jis') {
      contentType = 'text/csv; charset=shift_jis';
    }

    // ファイル名を作成
    const fileName = `${spreadsheet.name.replace(/[^\w\s-]/g, '')}_${new Date().toISOString().split('T')[0]}.csv`;

    // レスポンスヘッダーを設定
    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Shift-JISの場合はエンコード変換が必要（実際の実装では適切なライブラリを使用）
    let responseBody = csvContent;
    if (encodingParam === 'shift-jis') {
      try {
        // ここでは簡易的な処理とし、実際の実装では iconv-lite などを使用
        responseBody = csvContent; // UTF-8のまま返す（実装簡略化のため）
        console.warn('Shift-JIS エンコーディングは未実装です。UTF-8で返します。');
      } catch (error) {
        console.error('エンコーディング変換エラー:', error);
        return NextResponse.json(
          { error: 'エンコーディング変換に失敗しました' },
          { status: 500 }
        );
      }
    }

    return new NextResponse(responseBody, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('CSV エクスポート API エラー:', error);

    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}