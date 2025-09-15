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
 * セルアドレスを生成する
 */
function getCellAddress(row: number, column: number): string {
  let columnStr = '';
  let columnIndex = column;

  while (columnIndex >= 0) {
    columnStr = String.fromCharCode(65 + (columnIndex % 26)) + columnStr;
    columnIndex = Math.floor(columnIndex / 26) - 1;
  }

  return `${columnStr}${row + 1}`;
}

/**
 * セルの値の型を判定
 */
function getCellType(value: any): string {
  if (value === null || value === undefined || value === '') {
    return 'empty';
  }

  if (typeof value === 'number' || (!isNaN(Number(value)) && !isNaN(parseFloat(value)))) {
    return 'number';
  }

  if (typeof value === 'boolean' || value === 'true' || value === 'false') {
    return 'boolean';
  }

  if (typeof value === 'string') {
    // 日付かどうかのチェック（簡易版）
    const dateValue = new Date(value);
    if (!isNaN(dateValue.getTime()) && (value.includes('-') || value.includes('/'))) {
      return 'date';
    }
    return 'text';
  }

  return 'text';
}

/**
 * 値を適切な型に変換
 */
function convertValue(value: string, targetType?: string): any {
  if (!value || value.trim() === '') {
    return null;
  }

  const trimmedValue = value.trim();

  // 明示的な型変換
  if (targetType === 'number' || (!targetType && !isNaN(Number(trimmedValue)) && !isNaN(parseFloat(trimmedValue)))) {
    const numValue = parseFloat(trimmedValue);
    return isNaN(numValue) ? trimmedValue : numValue;
  }

  if (targetType === 'boolean' || (!targetType && (trimmedValue.toLowerCase() === 'true' || trimmedValue.toLowerCase() === 'false'))) {
    return trimmedValue.toLowerCase() === 'true';
  }

  if (targetType === 'date' || (!targetType && !isNaN(Date.parse(trimmedValue)))) {
    const dateValue = new Date(trimmedValue);
    if (!isNaN(dateValue.getTime())) {
      return dateValue.toISOString();
    }
  }

  return trimmedValue;
}

/**
 * CSVファイルインポート (T058)
 */
export async function POST(
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

    // 既存のスプレッドシートを読み込み
    const loadResult = await storageManager.loadSpreadsheet(id);
    if (!loadResult.success || !loadResult.data) {
      return NextResponse.json(
        { error: 'スプレッドシートが見つかりません' },
        { status: 404 }
      );
    }

    const spreadsheet = loadResult.data;

    // multipart/form-dataを解析
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const optionsStr = formData.get('options') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'ファイルが指定されていません' },
        { status: 400 }
      );
    }

    // ファイルがCSVかチェック
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'application/csv') {
      return NextResponse.json(
        { error: 'CSVファイルを指定してください' },
        { status: 400 }
      );
    }

    // オプションを解析
    let options = {
      encoding: 'utf-8',
      delimiter: 'comma',
      hasHeader: false
    };

    if (optionsStr) {
      try {
        const parsedOptions = JSON.parse(optionsStr);
        options = { ...options, ...parsedOptions };
      } catch (error) {
        console.error('オプション解析エラー:', error);
        // デフォルトオプションを使用
      }
    }

    // パラメータのバリデーション
    const validEncodings = ['utf-8', 'shift-jis'];
    const validDelimiters = ['comma', 'semicolon', 'tab'];

    if (!validEncodings.includes(options.encoding)) {
      return NextResponse.json(
        { error: 'encoding は utf-8 または shift-jis である必要があります' },
        { status: 400 }
      );
    }

    if (!validDelimiters.includes(options.delimiter)) {
      return NextResponse.json(
        { error: 'delimiter は comma, semicolon, または tab である必要があります' },
        { status: 400 }
      );
    }

    // ファイルの内容を読み込み
    const fileContent = await file.text();

    if (!fileContent || fileContent.trim() === '') {
      return NextResponse.json(
        { error: 'ファイルの内容が空です' },
        { status: 400 }
      );
    }

    // CSVハンドラーを作成
    const csvHandler = createCSVHandler({
      delimiter: getDelimiter(options.delimiter),
      encoding: getEncoding(options.encoding),
      hasHeader: options.hasHeader,
      quotes: 'auto',
      escapeChar: '"'
    });

    // CSVインポートのオプションを設定
    const importOptions = {
      delimiter: getDelimiter(options.delimiter),
      encoding: getEncoding(options.encoding),
      hasHeader: options.hasHeader,
      autoDetectTypes: true,
      trimWhitespace: true,
      preserveLeadingZeros: false,
      replaceExisting: true, // 既存のセルを置き換える
      startPosition: { row: 0, column: 0 }
    };

    // CSVデータをインポート
    const importResult = await csvHandler.importCSVToSpreadsheet(fileContent, spreadsheet, importOptions);

    if (!importResult.success) {
      return NextResponse.json(
        { error: importResult.error || 'CSVインポートに失敗しました' },
        { status: 500 }
      );
    }

    // インポート統計を計算
    let rowsImported = 0;
    let columnsImported = 0;
    const errors: Array<{ row: number; column: number; message: string }> = [];

    if (importResult.data) {
      // CSVデータを手動で解析してセルに設定
      const lines = fileContent.split('\n');
      const delimiter = getDelimiter(options.delimiter);

      for (let rowIndex = 0; rowIndex < lines.length; rowIndex++) {
        const line = lines[rowIndex].trim();
        if (!line) continue;

        const values = line.split(delimiter);
        const actualRow = options.hasHeader && rowIndex === 0 ? -1 : rowIndex - (options.hasHeader ? 1 : 0);

        if (actualRow >= 0) {
          rowsImported = Math.max(rowsImported, actualRow + 1);

          for (let colIndex = 0; colIndex < values.length; colIndex++) {
            columnsImported = Math.max(columnsImported, colIndex + 1);

            try {
              const rawValue = values[colIndex].replace(/^"|"$/g, '').trim();
              const cellAddress = getCellAddress(actualRow, colIndex);
              const convertedValue = convertValue(rawValue);
              const cellType = getCellType(convertedValue);

              const cell = {
                address: {
                  row: actualRow,
                  column: colIndex,
                  address: cellAddress
                },
                value: convertedValue,
                type: cellType,
                formula: undefined,
                error: undefined
              };

              spreadsheet.cells.set(cellAddress, cell);

            } catch (error) {
              errors.push({
                row: actualRow,
                column: colIndex,
                message: error instanceof Error ? error.message : 'セルの処理中にエラーが発生しました'
              });
            }
          }
        }
      }
    }

    // グリッドサイズを必要に応じて拡張
    if (rowsImported > spreadsheet.gridSize.rowCount) {
      spreadsheet.gridSize.rowCount = Math.min(rowsImported, 1000);
    }
    if (columnsImported > spreadsheet.gridSize.columnCount) {
      spreadsheet.gridSize.columnCount = Math.min(columnsImported, 1000);
    }

    // 行・列定義を更新
    if (spreadsheet.rows.length < spreadsheet.gridSize.rowCount) {
      for (let i = spreadsheet.rows.length; i < spreadsheet.gridSize.rowCount; i++) {
        spreadsheet.rows.push({
          index: i,
          height: 25,
          visible: true,
          frozen: false
        });
      }
    }

    if (spreadsheet.columns.length < spreadsheet.gridSize.columnCount) {
      for (let i = spreadsheet.columns.length; i < spreadsheet.gridSize.columnCount; i++) {
        spreadsheet.columns.push({
          index: i,
          width: 80,
          visible: true,
          frozen: false,
          label: String.fromCharCode(65 + i % 26)
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
      rowsImported,
      columnsImported,
      errors: errors.slice(0, 100) // エラーは最大100件まで返す
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('CSV インポート API エラー:', error);

    if (error instanceof Error && error.message.includes('FormData')) {
      return NextResponse.json(
        { error: 'multipart/form-data の解析に失敗しました' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}