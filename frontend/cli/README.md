# Spreadsheet CLI Tools

スプレッドシートアプリケーション用の4つのCLIツールコレクション

## 概要

このディレクトリには、スプレッドシートアプリケーションの機能をコマンドラインから利用するための4つのCLIツールが含まれています。

### CLIツール一覧

1. **Spreadsheet CLI (T059)** - `/cli/spreadsheet-cli/`
   - スプレッドシートの基本操作（作成、セル操作、統計など）

2. **Formula CLI (T060)** - `/cli/formula-cli/`
   - 数式の計算、評価、解析機能

3. **CSV CLI (T061)** - `/cli/csv-cli/`
   - CSV インポート・エクスポート、変換、検証機能

4. **Storage CLI (T062)** - `/cli/storage-cli/`
   - データの永続化、バックアップ、ストレージ管理機能

## セットアップ

### 全体的なセットアップ

```bash
# 各CLIツールのディレクトリに移動してインストール
cd cli/spreadsheet-cli && npm install && npm run build
cd ../formula-cli && npm install && npm run build
cd ../csv-cli && npm install && npm run build
cd ../storage-cli && npm install && npm run build
```

### グローバルインストール（オプション）

```bash
# 各CLIツールをグローバルにインストール
cd cli/spreadsheet-cli && npm link
cd ../formula-cli && npm link
cd ../csv-cli && npm link
cd ../storage-cli && npm link
```

## 基本的なワークフロー

### 1. スプレッドシート作成からCSVエクスポートまで

```bash
# 1. 新しいスプレッドシートを作成
spreadsheet-cli create -n "売上データ" -o sales.json

# 2. データを入力
spreadsheet-cli set-cell sales.json A1 "商品名"
spreadsheet-cli set-cell sales.json B1 "売上"
spreadsheet-cli set-cell sales.json A2 "商品A"
spreadsheet-cli set-cell sales.json B2 1000

# 3. 数式を追加
spreadsheet-cli set-cell sales.json B3 "=B2*1.1"

# 4. 数式を計算
formula-cli calculate sales.json B3 --update

# 5. CSVにエクスポート
csv-cli export sales.json sales.csv --include-headers
```

### 2. CSVインポートから分析まで

```bash
# 1. CSVファイルをインポート
csv-cli import data.csv imported.json --header --name "インポートデータ"

# 2. ストレージに保存
storage-cli save imported.json dataset-001 --tags "インポート,データ分析"

# 3. 統計分析
spreadsheet-cli stats imported.json

# 4. 数式エンジンの統計
formula-cli engine-stats imported.json
```

### 3. データ管理とバックアップ

```bash
# 1. ストレージの統計確認
storage-cli stats

# 2. 全データのリスト表示
storage-cli list

# 3. 特定のデータを読み込み
storage-cli load dataset-001 current-data.json

# 4. バックアップ状況の確認
storage-cli backup list
```

## 各ツールの特徴

### Spreadsheet CLI の特徴
- スプレッドシートの作成・編集
- セル操作（値設定、取得、削除）
- 範囲操作（取得、クリア）
- 統計情報の表示
- バッチ更新機能

### Formula CLI の特徴
- 数式の評価と計算
- 構文チェック機能
- セル依存関係の解析
- 豊富な Excel 互換関数
- 対話モード

### CSV CLI の特徴
- インポート・エクスポート
- 形式変換とバリデーション
- ファイル分析機能
- マージ・分割機能
- プレビュー機能

### Storage CLI の特徴
- データの永続化
- 自動バックアップ
- タグベースの管理
- 統計とメタデータ追跡
- 検索・フィルタリング

## 実用的な使用例

### 例1: 月次売上レポートの作成

```bash
# 1. 基本スプレッドシートを作成
spreadsheet-cli create -n "月次売上レポート" -o monthly-sales.json

# 2. ヘッダーを設定
spreadsheet-cli set-cell monthly-sales.json A1 "商品"
spreadsheet-cli set-cell monthly-sales.json B1 "1月"
spreadsheet-cli set-cell monthly-sales.json C1 "2月"
spreadsheet-cli set-cell monthly-sales.json D1 "合計"

# 3. データを入力
spreadsheet-cli set-cell monthly-sales.json A2 "商品A"
spreadsheet-cli set-cell monthly-sales.json B2 1000
spreadsheet-cli set-cell monthly-sales.json C2 1200

# 4. 合計数式を追加
spreadsheet-cli set-cell monthly-sales.json D2 "=B2+C2"

# 5. 数式を計算
formula-cli calculate monthly-sales.json D2 --update

# 6. CSVとしてエクスポート
csv-cli export monthly-sales.json monthly-report.csv --include-headers

# 7. ストレージに保存
storage-cli save monthly-sales.json monthly-2024-01 --tags "月次,売上,2024"
```

### 例2: データクリーニングとバリデーション

```bash
# 1. CSVファイルを分析
csv-cli analyze raw-data.csv

# 2. バリデーションを実行
csv-cli validate raw-data.csv --format json > validation-report.json

# 3. 問題があれば修正してから再度検証
csv-cli validate cleaned-data.csv

# 4. スプレッドシートにインポート
csv-cli import cleaned-data.csv clean-spreadsheet.json --header

# 5. データ品質チェックのための統計
spreadsheet-cli stats clean-spreadsheet.json
```

### 例3: バックアップとリストア

```bash
# 1. 重要なデータをストレージに保存
storage-cli save critical-data.json critical-backup --tags "重要,バックアップ"

# 2. 定期的にバックアップ状況を確認
storage-cli backup list

# 3. 必要に応じてデータを復元
storage-cli load critical-backup restored-data.json

# 4. ストレージの使用状況を監視
storage-cli stats --format json
```

## トラブルシューティング

### 共通の問題と解決法

1. **依存関係のエラー**
   ```bash
   # 各CLIディレクトリで再インストール
   cd cli/spreadsheet-cli && npm install
   ```

2. **TypeScriptコンパイルエラー**
   ```bash
   # TypeScriptを再ビルド
   npm run build
   ```

3. **パスの問題**
   ```bash
   # 絶対パスを使用
   spreadsheet-cli create -o /absolute/path/to/file.json
   ```

4. **権限エラー**
   ```bash
   # 実行権限を確認
   chmod +x cli/*/index.js
   ```

## 開発者向け情報

### アーキテクチャ

各CLIツールは以下の構造を持っています：
- `index.ts`: メインCLIロジック
- `package.json`: 依存関係とスクリプト
- `tsconfig.json`: TypeScript設定
- `README.md`: 詳細なドキュメント

### コアライブラリとの統合

全てのCLIツールは `/src/lib/` のコアライブラリを使用しています：
- `spreadsheet-core`: 基本的なスプレッドシート操作
- `formula-engine`: HyperFormula ベースの数式エンジン
- `csv-handler`: Papa Parse ベースのCSV処理
- `storage-manager`: LocalForage ベースのストレージ管理

### テストとデバッグ

```bash
# 開発モードで実行（TypeScriptから直接）
npm run dev -- create -n "test"

# ビルドしてテスト
npm run build && node index.js --help
```

## 今後の拡張

### 予定されている機能
- Web API との連携
- リアルタイム同期機能
- プラグインシステム
- 高度なデータ変換機能
- パフォーマンスの最適化

### カスタマイゼーション
- 設定ファイルのサポート
- カスタム関数の追加
- テーマとスタイリング
- 言語の国際化