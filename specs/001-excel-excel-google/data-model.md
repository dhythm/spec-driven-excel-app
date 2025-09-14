# Data Model: スプレッドシートアプリケーション

**Date**: 2025-09-14
**Version**: 0.1.0

## Core Entities

### Spreadsheet
スプレッドシート全体を表すルートエンティティ

```typescript
interface Spreadsheet {
  id: string;                    // UUID v4
  name: string;                   // スプレッドシート名
  createdAt: Date;               // 作成日時
  updatedAt: Date;               // 最終更新日時
  gridSize: GridSize;            // グリッドサイズ
  cells: Map<string, Cell>;      // セルデータ（キー: "A1"形式）
  rows: Row[];                   // 行設定
  columns: Column[];             // 列設定
  version: string;               // データモデルバージョン
}

interface GridSize {
  rowCount: number;              // 行数（初期値: 100、最大: 1000）
  columnCount: number;           // 列数（初期値: 26、最大: 1000）
}
```

### Cell
個々のセルデータを表すエンティティ

```typescript
interface Cell {
  address: CellAddress;          // セルアドレス
  value: CellValue;              // 表示値
  formula?: string;              // 数式（"="で開始）
  type: CellType;                // データ型
  format?: CellFormat;           // 書式（将来拡張用）
  dependencies?: string[];       // 依存セル（数式が参照するセル）
  dependents?: string[];         // 被依存セル（このセルを参照する数式）
  error?: FormulaError;          // 数式エラー
}

interface CellAddress {
  row: number;                   // 行番号（0-based）
  column: number;                // 列番号（0-based）
  address: string;               // A1形式のアドレス
}

type CellValue = string | number | boolean | null | Date;

enum CellType {
  TEXT = 'text',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  FORMULA = 'formula',
  EMPTY = 'empty'
}

interface CellFormat {
  // 将来拡張用（フォント、色、罫線など）
  numberFormat?: string;         // 数値フォーマット
  dateFormat?: string;           // 日付フォーマット
}
```

### Row
行の設定を管理するエンティティ

```typescript
interface Row {
  index: number;                 // 行インデックス（0-based）
  height: number;                // 行の高さ（ピクセル、デフォルト: 25）
  visible: boolean;              // 表示/非表示
  frozen: boolean;               // 固定行（将来拡張）
}
```

### Column
列の設定を管理するエンティティ

```typescript
interface Column {
  index: number;                 // 列インデックス（0-based）
  width: number;                 // 列幅（ピクセル、デフォルト: 100）
  visible: boolean;              // 表示/非表示
  frozen: boolean;               // 固定列（将来拡張）
  label: string;                 // 列ラベル（A, B, C...）
}
```

### Formula
数式計算関連のエンティティ

```typescript
interface Formula {
  expression: string;            // 数式文字列（"="を除く）
  tokens: FormulaToken[];        // パース済みトークン
  references: CellReference[];  // セル参照リスト
  result: CellValue;            // 計算結果
}

interface FormulaToken {
  type: TokenType;              // トークンタイプ
  value: string;                // トークン値
  position: number;             // 文字列内の位置
}

enum TokenType {
  OPERATOR = 'operator',        // +, -, *, /
  FUNCTION = 'function',        // SUM, AVERAGE, etc.
  CELL_REF = 'cell_ref',       // A1, B2
  RANGE_REF = 'range_ref',     // A1:B10
  NUMBER = 'number',
  STRING = 'string',
  BOOLEAN = 'boolean'
}

interface CellReference {
  type: 'single' | 'range';
  start: CellAddress;
  end?: CellAddress;            // range時のみ
}
```

### FormulaError
数式エラーを表すエンティティ

```typescript
interface FormulaError {
  type: ErrorType;              // エラータイプ
  message: string;              // エラーメッセージ
  details?: any;                // 詳細情報
}

enum ErrorType {
  DIV_ZERO = '#DIV/0!',        // ゼロ除算
  REF = '#REF!',                // 無効な参照
  VALUE = '#VALUE!',            // 型エラー
  NAME = '#NAME?',              // 未定義の名前
  CIRCULAR = '#CIRCULAR!',      // 循環参照
  NA = '#N/A',                  // 値が利用不可
  NULL = '#NULL!'               // 範囲演算子エラー
}
```

## Value Objects

### Selection
選択範囲を表す値オブジェクト

```typescript
interface Selection {
  start: CellAddress;           // 選択開始セル
  end: CellAddress;             // 選択終了セル
  type: SelectionType;
}

enum SelectionType {
  SINGLE = 'single',            // 単一セル
  RANGE = 'range',              // 範囲選択
  COLUMN = 'column',            // 列全体
  ROW = 'row',                  // 行全体
  ALL = 'all'                   // 全選択
}
```

### ClipboardData
コピー/カット時のデータ

```typescript
interface ClipboardData {
  cells: Cell[];                // コピーされたセル
  selection: Selection;         // 元の選択範囲
  operation: 'copy' | 'cut';   // 操作タイプ
  timestamp: Date;              // コピー時刻
}
```

### HistoryEntry
Undo/Redo用の履歴エントリ

```typescript
interface HistoryEntry {
  id: string;                   // UUID
  timestamp: Date;              // 操作時刻
  action: ActionType;           // 操作タイプ
  before: any;                  // 変更前の状態
  after: any;                   // 変更後の状態
  selection?: Selection;        // 操作時の選択範囲
}

enum ActionType {
  CELL_EDIT = 'cell_edit',
  CELL_DELETE = 'cell_delete',
  ROW_INSERT = 'row_insert',
  ROW_DELETE = 'row_delete',
  COLUMN_INSERT = 'column_insert',
  COLUMN_DELETE = 'column_delete',
  PASTE = 'paste',
  FORMAT_CHANGE = 'format_change'
}
```

## Storage Schema

### LocalStorage Structure
```typescript
interface StorageSchema {
  version: string;              // スキーマバージョン
  spreadsheets: {
    [id: string]: SpreadsheetMetadata;
  };
  activeSpreadsheetId?: string;
}

interface SpreadsheetMetadata {
  id: string;
  name: string;
  createdAt: string;           // ISO 8601
  updatedAt: string;           // ISO 8601
  size: number;                // バイト数
  compressed: boolean;         // 圧縮フラグ
}

// 実データは別キーで保存
// Key: `spreadsheet_${id}`
// Value: JSON.stringify(Spreadsheet) or compressed
```

## Validation Rules

### Cell Validation
- アドレスは正規表現 `/^[A-Z]+[1-9][0-9]*$/` に一致
- 数式は "=" で開始
- 循環参照の検出と防止
- 最大文字数: 32,767文字（Excel互換）

### Grid Validation
- 最小サイズ: 1×1
- 最大サイズ: 1000×1000
- 行高さ: 10px - 500px
- 列幅: 20px - 500px

### Formula Validation
- サポート関数の検証
- 引数の型と数の検証
- 範囲参照の妥当性検証

## State Transitions

### Cell State
```
EMPTY → EDITING → VALUE
         ↓         ↓
      CANCELLED  ERROR
```

### Spreadsheet State
```
NEW → LOADING → READY → SAVING → SAVED
        ↓         ↓        ↓
      ERROR    EDITING   ERROR
```

## Performance Considerations

### Indexing Strategy
- セルは Map<string, Cell> で O(1) アクセス
- 依存グラフは隣接リストで管理
- 変更検出は shallow comparison

### Memory Optimization
- 空セルは保存しない（sparse storage）
- 大規模データは分割読み込み
- 非表示領域はアンロード対象

### Calculation Optimization
- 依存グラフによる最小限の再計算
- 非同期計算でUIブロッキング回避
- キャッシュによる重複計算防止

---
*Data Model v0.1.0 - 2025-09-14*