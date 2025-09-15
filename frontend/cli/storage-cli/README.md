# Storage CLI Tool

ストレージ管理を提供するCLIツール（T062）

## 概要

このCLIツールは、スプレッドシートデータの永続化とストレージ管理機能を提供します。
Node.js環境では、ファイルベースのストレージをシミュレートして、実際のブラウザ環境でのlocalforage機能と同様の操作を可能にします。

## インストール

```bash
npm install
npm run build
```

## 使用方法

### 基本コマンド

#### ストレージ設定の確認
```bash
storage-cli config --base-dir ./my-storage --backup --max-backups 5
```

#### スプレッドシートの保存
```bash
storage-cli save sheet.json my-sheet-001 --tags "重要,売上データ"
```

#### スプレッドシートの読み込み
```bash
storage-cli load my-sheet-001 restored-sheet.json
```

#### スプレッドシートの削除
```bash
storage-cli delete my-sheet-001
storage-cli delete my-sheet-001 --force
```

#### ストレージ内容の一覧
```bash
storage-cli list
storage-cli list --filter "売上" --format json
```

#### ストレージ統計情報
```bash
storage-cli stats
storage-cli stats --format json
```

#### ストレージのクリア
```bash
storage-cli clear --force
```

#### バックアップの管理
```bash
storage-cli backup list
```

## オプション

### グローバルオプション
- `--help`: ヘルプを表示
- `--version`: バージョンを表示

### 共通オプション
- `--base-dir <dir>`: ストレージのベースディレクトリ（デフォルト: `./storage`）
- `--format <format>`: 出力形式（`table`, `json`）

### 保存オプション
- `--tags <tags>`: タグをカンマ区切りで指定

### 削除・クリアオプション
- `--force`: 確認をスキップして強制実行

### リストオプション
- `--filter <filter>`: フィルター条件（名前、ID、タグで検索）

## 使用例

### 1. 基本的なストレージ操作

```bash
# ストレージディレクトリを設定
storage-cli config --base-dir ./project-storage

# スプレッドシートを作成
spreadsheet-cli create -n "売上データ2024" -o sales-2024.json

# ストレージに保存
storage-cli save sales-2024.json sales-2024 --tags "売上,2024,重要"

# 保存されたデータを確認
storage-cli list

# 統計情報を確認
storage-cli stats
```

### 2. データのバックアップと復元

```bash
# 重要なスプレッドシートを保存（自動的にバックアップされる）
storage-cli save important-data.json critical-data --tags "重要"

# データを変更して再保存（古いバージョンがバックアップされる）
storage-cli save modified-data.json critical-data --tags "重要,更新済み"

# バックアップ一覧を確認
storage-cli backup list

# データを別の場所に復元
storage-cli load critical-data restored-data.json
```

### 3. 複数プロジェクトの管理

```bash
# プロジェクトA用ストレージ
storage-cli save project-a-data.json proj-a-main --base-dir ./project-a-storage --tags "プロジェクトA"

# プロジェクトB用ストレージ
storage-cli save project-b-data.json proj-b-main --base-dir ./project-b-storage --tags "プロジェクトB"

# 各プロジェクトの一覧表示
storage-cli list --base-dir ./project-a-storage
storage-cli list --base-dir ./project-b-storage
```

### 4. データの検索とフィルタリング

```bash
# タグで検索
storage-cli list --filter "売上"

# 名前で検索
storage-cli list --filter "2024"

# JSON形式で詳細情報を出力
storage-cli list --format json --filter "重要"
```

### 5. ストレージのメンテナンス

```bash
# 統計情報を確認
storage-cli stats

# 不要なデータを削除
storage-cli delete old-data-001 --force

# 全データをクリア（注意）
storage-cli clear
```

## ファイル構造

ストレージディレクトリには以下のファイルが作成されます：

```
./storage/
├── sheet-001.json                    # スプレッドシートデータ
├── sheet-001.meta.json              # メタデータ
├── sheet-001.backup.1634567890.json # バックアップデータ
├── sheet-001.backup.1634567890.meta.json # バックアップメタデータ
└── ...
```

### メタデータの構造

```json
{
  "id": "sheet-001",
  "name": "売上データ2024",
  "type": "spreadsheet",
  "size": 15432,
  "compressed": false,
  "encrypted": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-15T12:30:00.000Z",
  "version": 1,
  "tags": ["売上", "2024", "重要"]
}
```

## エラーハンドリング

### よくあるエラーと対処法

1. **ファイルが見つからない**
   ```bash
   # エラー: スプレッドシートファイルが見つからない
   storage-cli save non-existent.json my-sheet
   # 解決: ファイルパスを確認
   ls -la *.json
   ```

2. **IDの重複**
   ```bash
   # 既存のIDに再度保存すると上書きされる（バックアップが作成される）
   storage-cli save new-data.json existing-id --tags "更新"
   ```

3. **権限エラー**
   ```bash
   # 解決: ディレクトリの権限を確認
   chmod 755 ./storage
   ```

## 高度な機能

### 1. 自動バックアップ

- ストレージに保存する際、既存のデータがあれば自動的にバックアップが作成されます
- バックアップは最大10個まで保持され、古いものから削除されます

### 2. タグシステム

- スプレッドシートにタグを付けて分類できます
- フィルタリング時にタグで検索可能です

### 3. メタデータ追跡

- ファイルサイズ、作成日時、更新日時などを自動的に記録します
- 統計情報で全体の使用状況を把握できます

## パフォーマンス

- **小さなスプレッドシート (< 100KB)**: 瞬時に処理
- **中程度のスプレッドシート (100KB - 1MB)**: 数秒で処理
- **大きなスプレッドシート (> 1MB)**: 処理時間は増加しますが、進行状況が表示されます

## セキュリティ注意事項

- このCLIツールはローカルファイルシステムを使用します
- 重要なデータは適切にバックアップを取ってください
- 本番環境では適切なアクセス権限を設定してください

## トラブルシューティング

### ストレージが破損した場合

```bash
# バックアップから復元
storage-cli backup list
storage-cli load backup-id restored.json

# または新しいストレージディレクトリを作成
storage-cli config --base-dir ./new-storage
```

### 大量のデータがある場合

```bash
# 統計情報で使用量を確認
storage-cli stats

# フィルタを使用して必要なデータのみ表示
storage-cli list --filter "2024"

# 不要なデータを削除
storage-cli delete old-data --force
```

## 実装ノート

このCLIツールは、実際のWebアプリケーションでのlocalforage使用を想定して設計されています。
Node.js環境では、ブラウザ環境の制約（IndexedDB、WebSQL、LocalStorageなど）をシミュレートするため、ファイルベースのストレージを使用しています。

実際のWebアプリケーション環境では、`localforage`ライブラリが自動的に最適なストレージバックエンドを選択します。