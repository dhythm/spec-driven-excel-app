# Formula CLI Tool

数式計算と解析を提供するCLIツール（T060）

## インストール

```bash
npm install
npm run build
```

## 使用方法

### 基本コマンド

#### 単発の数式評価
```bash
formula-cli evaluate "=SUM(1,2,3,4,5)"
formula-cli evaluate "=AVERAGE(10,20,30)" --format json
formula-cli evaluate "=IF(5>3,\"True\",\"False\")" --context A1
```

#### 数式の構文チェック
```bash
formula-cli validate "=SUM(A1:A5)"
formula-cli validate "=INVALID_FUNCTION()" --format json
```

#### スプレッドシート内の数式計算
```bash
# セルの数式を計算
formula-cli calculate sheet.json A1

# 計算結果でセルを更新
formula-cli calculate sheet.json B2 --update

# セル範囲を一括計算
formula-cli calculate-range sheet.json A1 C3 --update
```

#### 依存関係の解析
```bash
# セルの依存関係を取得
formula-cli dependencies sheet.json B2

# セルの数式を取得
formula-cli get-formula sheet.json A1
```

#### 関数とエンジン情報
```bash
# 利用可能な関数一覧
formula-cli functions
formula-cli functions --filter "SUM"

# エンジン統計
formula-cli engine-stats sheet.json
```

#### 対話モード
```bash
# 単発計算モード
formula-cli interactive

# スプレッドシートを読み込んで対話モード
formula-cli interactive --file sheet.json
```

## 対応する関数

HyperFormulaエンジンを使用しているため、Excel互換の豊富な関数をサポートしています：

### 数学関数
- `SUM`, `AVERAGE`, `COUNT`, `MAX`, `MIN`
- `ABS`, `ROUND`, `CEILING`, `FLOOR`
- `POWER`, `SQRT`, `EXP`, `LN`, `LOG`
- `SIN`, `COS`, `TAN`, `PI`

### 論理関数
- `IF`, `AND`, `OR`, `NOT`
- `TRUE`, `FALSE`

### 文字列関数
- `CONCATENATE`, `LEFT`, `RIGHT`, `MID`
- `LEN`, `UPPER`, `LOWER`, `TRIM`
- `FIND`, `SUBSTITUTE`, `REPLACE`

### 日付時刻関数
- `TODAY`, `NOW`, `DATE`, `TIME`
- `YEAR`, `MONTH`, `DAY`
- `HOUR`, `MINUTE`, `SECOND`
- `WEEKDAY`, `DATEDIF`

### 検索・参照関数
- `VLOOKUP`, `HLOOKUP`, `INDEX`, `MATCH`
- `OFFSET`, `INDIRECT`, `TRANSPOSE`

### 統計関数
- `STDEV`, `VAR`, `MEDIAN`, `MODE`
- `PERCENTILE`, `QUARTILE`, `RANK`

## 使用例

### 1. 基本的な計算

```bash
# 簡単な算術
formula-cli evaluate "=2+3*4"
# 結果: 14

# 関数の使用
formula-cli evaluate "=SUM(1,2,3,4,5)"
# 結果: 15

# 条件分岐
formula-cli evaluate "=IF(10>5,\"大きい\",\"小さい\")"
# 結果: 大きい
```

### 2. スプレッドシートでの計算

```bash
# スプレッドシートを作成
spreadsheet-cli create -n "計算表" -o calc.json

# データを入力
spreadsheet-cli set-cell calc.json A1 10
spreadsheet-cli set-cell calc.json A2 20
spreadsheet-cli set-cell calc.json A3 30

# 合計の数式を設定
spreadsheet-cli set-cell calc.json A4 "=SUM(A1:A3)"

# 数式を計算して更新
formula-cli calculate calc.json A4 --update
```

### 3. バッチ計算

```bash
# 複数のセルを一括計算
formula-cli calculate-range calc.json A1 A10 --update --format json
```

### 4. 対話モード

```bash
formula-cli interactive --file calc.json
```

対話モードでは以下のコマンドが使用できます：
- 数式を入力: `=SUM(A1:A3)`
- ヘルプ: `?help`
- 関数一覧: `?functions`
- 終了: `exit`

### 5. エラー処理

```bash
# 構文エラーの確認
formula-cli validate "=SUM(A1:A3" --format json
# 結果: 構文エラーが表示される

# 循環参照などのエラー
formula-cli evaluate "=A1" --context A1
# 結果: エラーメッセージが表示される
```

## 出力形式

### JSON形式
```json
{
  "formula": "=SUM(1,2,3)",
  "result": {
    "success": true,
    "value": 6,
    "displayValue": "6",
    "error": null
  }
}
```

### テーブル形式
```
数式: =SUM(1,2,3)
計算成功: 成功
値: 6
表示値: 6
```

### Raw形式
```
6
```

## エラーハンドリング

- 数式の構文エラー
- 循環参照
- 無効なセル参照
- 型の不一致
- 未定義の関数

各エラーには適切なエラーメッセージとエラータイプが表示されます。

## パフォーマンス

- 大量のセルの一括計算には時間がかかる場合があります
- `--update`オプションを使用する場合は、事前にバックアップを作成することを推奨します
- 対話モードでは、スプレッドシートデータは最初に一度だけ読み込まれます