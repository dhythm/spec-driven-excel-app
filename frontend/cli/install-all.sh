#!/bin/bash

# 全CLIツールのインストールスクリプト
echo "=== Spreadsheet CLI Tools セットアップ ==="

CLI_BASE="$(dirname "$0")"
cd "$CLI_BASE"

# エラーハンドリング
set -e

# 各CLIツールの依存関係をインストール・ビルド
for cli in "spreadsheet-cli" "formula-cli" "csv-cli" "storage-cli"; do
    echo ""
    echo "[$cli] セットアップ中..."
    echo "======================"

    if [ -d "$cli" ]; then
        cd "$cli"

        # npm install
        echo "依存関係をインストール中..."
        npm install

        # TypeScriptをJavaScriptにコンパイル
        echo "TypeScriptをコンパイル中..."
        npm run build

        # 実行権限を付与
        if [ -f "index.js" ] || [ -f "dist/index.js" ]; then
            echo "実行権限を付与..."
            chmod +x index.js 2>/dev/null || chmod +x dist/index.js 2>/dev/null || true
        fi

        echo "✓ $cli セットアップ完了"
        cd ..
    else
        echo "✗ $cli ディレクトリが見つかりません"
    fi
done

echo ""
echo "====================="
echo "全CLIツールのセットアップ完了!"
echo "====================="

echo ""
echo "使用方法:"
echo "--------"
echo "各CLIツールのディレクトリに移動して実行:"
echo ""
echo "cd cli/spreadsheet-cli && node index.js --help"
echo "cd cli/formula-cli && node index.js --help"
echo "cd cli/csv-cli && node index.js --help"
echo "cd cli/storage-cli && node index.js --help"
echo ""
echo "または、グローバルにインストール:"
echo "cd cli/spreadsheet-cli && npm link"
echo "cd cli/formula-cli && npm link"
echo "cd cli/csv-cli && npm link"
echo "cd cli/storage-cli && npm link"