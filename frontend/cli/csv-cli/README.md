# CSV CLI Tool

CSV インポート・エクスポートと処理を提供するCLIツール（T061）

## インストール

```bash
npm install
npm run build
```

## 使用方法

### 基本コマンド

#### CSVファイルをスプレッドシートにインポート
```bash
csv-cli import data.csv sheet.json
csv-cli import data.csv sheet.json --delimiter ";" --header --start B2
```

#### スプレッドシートをCSVファイルにエクスポート
```bash
csv-cli export sheet.json output.csv
csv-cli export sheet.json output.csv --start A1 --end C10 --delimiter ","
```

#### CSVファイルの検証
```bash
csv-cli validate data.csv
csv-cli validate data.csv --delimiter ";" --format json
```

#### CSVファイルの分析
```bash
csv-cli analyze data.csv
csv-cli analyze data.csv --format json
```

#### CSVファイルの形式変換
```bash
csv-cli convert input.csv output.csv --input-delimiter ";" --output-delimiter ","
```

#### CSVファイルのマージ
```bash
csv-cli merge file1.csv file2.csv file3.csv merged.csv --mode vertical
csv-cli merge file1.csv file2.csv merged.csv --mode horizontal --include-headers
```

#### CSVファイルのプレビュー
```bash
csv-cli preview data.csv --lines 20
csv-cli preview data.csv --format json
```

## オプション

### グローバルオプション
- `--help`: ヘルプを表示
- `--version`: バージョンを表示

### 共通オプション
- `--delimiter <char>`: 区切り文字を指定（デフォルト: `,`）
- `--format <format>`: 出力形式（`json`, `table`など）

### インポートオプション
- `--header`: 1行目をヘッダーとして扱う
- `--skip-empty-lines`: 空行をスキップ
- `--dynamic-typing`: 自動型変換を有効化
- `--start <cell>`: インポート開始位置（デフォルト: A1）
- `--name <name>`: スプレッドシート名を指定
- `--preview <lines>`: プレビュー行数（0で無効）

### エクスポートオプション
- `--start <cell>`: エクスポート開始位置（デフォルト: A1）
- `--end <cell>`: エクスポート終了位置（自動検出）
- `--include-headers`: ヘッダー行を含める
- `--include-formulas`: 数式を含める
- `--empty-value <value>`: 空セルの値（デフォルト: 空文字）

### 変換オプション
- `--input-delimiter <char>`: 入力ファイルの区切り文字
- `--output-delimiter <char>`: 出力ファイルの区切り文字
- `--input-encoding <encoding>`: 入力エンコーディング
- `--output-encoding <encoding>`: 出力エンコーディング
- `--skip-empty-lines`: 空行をスキップ
- `--trim-spaces`: 前後の空白を削除

### マージオプション
- `--mode <mode>`: マージモード（`vertical` または `horizontal`）
- `--include-headers`: ヘッダー行を含める

## 使用例

### 1. 基本的なインポート・エクスポート

```bash
# CSVファイルを作成
echo "名前,年齢,職業
田中太郎,30,エンジニア
佐藤花子,25,デザイナー
鈴木一郎,35,マネージャー" > sample.csv

# スプレッドシートにインポート
csv-cli import sample.csv sheet.json --header --name "社員データ"

# スプレッドシートからエクスポート
csv-cli export sheet.json output.csv --include-headers
```

### 2. 異なる区切り文字の処理

```bash
# セミコロン区切りのCSVをインポート
csv-cli import european.csv sheet.json --delimiter ";" --header

# タブ区切りに変換
csv-cli convert input.csv output.tsv --input-delimiter "," --output-delimiter "\t"
```

### 3. CSVファイルの検証と分析

```bash
# CSVファイルを検証
csv-cli validate data.csv
# 結果例：
# === CSV検証結果 ===
# 検証結果: ✓ 正常
# 総行数: 4
# 総列数: 3
# 空行数: 0
# 空列数: 0

# 詳細分析
csv-cli analyze data.csv
# 結果例：
# === CSV分析結果 ===
# デリミター: ","
# 行末文字: "\r\n"
# エンコーディング: UTF-8
# ヘッダーの有無: あり
# 統計情報:
#   総行数: 4
#   総列数: 3
#   空の値: 0
#   各列のユニーク値数: [3, 3, 3]
```

### 4. CSVファイルのマージ

```bash
# 複数のCSVを縦に結合
csv-cli merge 2023-Q1.csv 2023-Q2.csv 2023-Q3.csv 2023-full.csv --mode vertical

# 複数のCSVを横に結合
csv-cli merge names.csv ages.csv jobs.csv combined.csv --mode horizontal
```

### 5. プレビューと確認

```bash
# 最初の5行をプレビュー
csv-cli preview large-file.csv --lines 5

# JSON形式でプレビュー
csv-cli preview data.csv --format json --lines 3
```

### 6. 大きなファイルの処理

```bash
# 大きなCSVファイルを部分的にインポート
csv-cli import big-file.csv sheet.json --preview 1000 --start A1

# 特定の範囲のみエクスポート
csv-cli export sheet.json subset.csv --start A1 --end J100
```

## エラーハンドリング

### よくあるエラーと対処法

1. **区切り文字の不一致**
   ```bash
   # エラー: 予期した列数と異なる
   csv-cli analyze problematic.csv
   # 正しい区切り文字を確認してから再実行
   csv-cli import problematic.csv sheet.json --delimiter ";"
   ```

2. **エンコーディングの問題**
   ```bash
   # 文字化けが発生した場合
   csv-cli convert input.csv output.csv --input-encoding "shift_jis" --output-encoding "utf-8"
   ```

3. **大きすぎるファイル**
   ```bash
   # プレビューで確認
   csv-cli preview big-file.csv --lines 10
   # 部分的にインポート
   csv-cli import big-file.csv sheet.json --preview 10000
   ```

## 対応形式

### 区切り文字
- `,` (カンマ) - 標準
- `;` (セミコロン) - ヨーロッパ式
- `\t` (タブ) - TSV形式
- `|` (パイプ) - その他

### エンコーディング
- UTF-8（推奨）
- Shift_JIS（日本語レガシー）
- EUC-JP
- ISO-8859-1
- その他Node.jsがサポートするエンコーディング

### データ型の自動検出
- 数値（整数・浮動小数点）
- 日付（YYYY-MM-DD、MM/DD/YYYY など）
- 論理値（true/false、yes/no など）
- 文字列

## パフォーマンス

- **小さなファイル (< 1MB)**: 瞬時に処理
- **中程度のファイル (1-10MB)**: 数秒で処理
- **大きなファイル (> 10MB)**: プレビュー機能の使用を推奨

## トラブルシューティング

### メモリ不足
```bash
# 大きなファイルの場合はプレビューを使用
csv-cli import large-file.csv sheet.json --preview 50000
```

### 文字化け
```bash
# エンコーディングを明示的に指定
csv-cli convert input.csv output.csv --input-encoding "shift_jis" --output-encoding "utf-8"
```

### 列数の不一致
```bash
# ファイルを分析して問題を特定
csv-cli validate problematic.csv --format json
```