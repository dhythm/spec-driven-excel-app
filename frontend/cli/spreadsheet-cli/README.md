# Spreadsheet CLI Tool

スプレッドシートの基本操作を提供するCLIツール（T059）

## インストール

```bash
npm install
npm run build
```

## 使用方法

### 基本コマンド

#### 新しいスプレッドシートを作成
```bash
spreadsheet-cli create -n "My Spreadsheet" -r 100 -c 10 -o my-sheet.json
```

#### セルの値を設定
```bash
spreadsheet-cli set-cell my-sheet.json A1 "Hello World"
spreadsheet-cli set-cell my-sheet.json B1 123 --format '{"bold":true}'
```

#### セルの値を取得
```bash
spreadsheet-cli get-cell my-sheet.json A1
spreadsheet-cli get-cell my-sheet.json A1 --format json
```

#### セル範囲の操作
```bash
# 範囲を取得
spreadsheet-cli get-range my-sheet.json A1 C3 --format table

# 範囲をクリア
spreadsheet-cli clear-range my-sheet.json A1 C3
```

#### スプレッドシートの管理
```bash
# 統計情報を表示
spreadsheet-cli stats my-sheet.json

# コピーを作成
spreadsheet-cli copy source.json target.json -n "コピー版"

# 名前を変更
spreadsheet-cli rename my-sheet.json "新しい名前"
```

#### バッチ更新
```bash
# CSVファイルからデータを一括インポート
spreadsheet-cli batch-update my-sheet.json data.csv --start A1
```

## オプション

### グローバルオプション
- `--help`: ヘルプを表示
- `--version`: バージョンを表示

### 出力形式
- `json`: JSON形式で出力
- `table`: 表形式で出力
- `csv`: CSV形式で出力
- `raw`: 生の値のみ出力

## 例

### 1. スプレッドシートを作成してデータを入力

```bash
# 新しいスプレッドシートを作成
spreadsheet-cli create -n "売上データ" -o sales.json

# データを入力
spreadsheet-cli set-cell sales.json A1 "商品名"
spreadsheet-cli set-cell sales.json B1 "価格"
spreadsheet-cli set-cell sales.json C1 "数量"
spreadsheet-cli set-cell sales.json A2 "商品A"
spreadsheet-cli set-cell sales.json B2 1000
spreadsheet-cli set-cell sales.json C2 5

# 範囲を確認
spreadsheet-cli get-range sales.json A1 C2 --format table
```

### 2. CSVファイルからバッチインポート

```bash
# data.csv の内容:
# 商品名,価格,数量
# 商品A,1000,5
# 商品B,2000,3
# 商品C,1500,8

spreadsheet-cli batch-update sales.json data.csv --start A1
```

### 3. 統計情報の確認

```bash
spreadsheet-cli stats sales.json --format json
```

## エラーハンドリング

- 無効なセル参照（例: "Z999999"）は適切にエラーメッセージが表示されます
- ファイルが存在しない場合はエラーメッセージが表示されます
- 書式設定が無効な場合は警告が表示されますが、値の設定は継続されます

## 対応形式

### セル参照
- A1形式（例: A1, B2, Z100）
- 大文字小文字を区別しません

### データ型
- 文字列
- 数値
- 日付
- 論理値

### 書式設定（JSON形式）
```json
{
  "bold": true,
  "italic": false,
  "fontSize": 12,
  "color": "#000000",
  "backgroundColor": "#FFFFFF",
  "textAlign": "left",
  "verticalAlign": "middle",
  "numberFormat": "0.00"
}
```