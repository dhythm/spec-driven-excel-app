# CLAUDE.md - スプレッドシートアプリケーション開発ガイド

## プロジェクト概要
Excel/Google Sheets互換のブラウザベーススプレッドシートアプリケーション

## 技術スタック
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript 5.3+
- **Styling**: Tailwind CSS 3.4+
- **State Management**: React Context API / Zustand
- **Formula Engine**: HyperFormula
- **CSV Processing**: Papa Parse
- **Virtual Scrolling**: @tanstack/react-virtual
- **Storage**: LocalStorage → IndexedDB (将来)
- **Testing**: Jest + React Testing Library

## 開発原則

### TDD (Test-Driven Development)
1. **必ず**テストを先に書く（RED phase）
2. テストが失敗することを確認
3. 実装を書く（GREEN phase）
4. リファクタリング（REFACTOR phase）

### コーディング規約
- TypeScriptで**function**を使用（classは避ける）
- コンポーネントはReact.memoでメモ化
- 大規模な計算はuseMemoでキャッシュ
- イベントハンドラはuseCallbackで安定化

## プロジェクト構造
```
frontend/
├── src/
│   ├── app/           # Next.js App Router
│   ├── components/    # UIコンポーネント
│   ├── lib/          # コアライブラリ
│   └── hooks/        # カスタムフック
└── tests/            # テストファイル
```

## コアライブラリ

### spreadsheet-core
グリッド管理とセル操作を担当
```typescript
function createSpreadsheet(options: SpreadsheetOptions): Spreadsheet
function updateCell(spreadsheet: Spreadsheet, address: string, value: any): Spreadsheet
function addRow(spreadsheet: Spreadsheet, index: number): Spreadsheet
function addColumn(spreadsheet: Spreadsheet, index: number): Spreadsheet
```

### formula-engine
HyperFormulaのラッパー
```typescript
function createEngine(config?: EngineConfig): FormulaEngine
function calculate(engine: FormulaEngine, formula: string): CellValue
function updateDependencies(engine: FormulaEngine, cell: Cell): void
```

### csv-handler
Papa Parseのラッパー
```typescript
function exportToCsv(spreadsheet: Spreadsheet, options?: ExportOptions): string
function importFromCsv(file: File, options?: ImportOptions): Promise<Spreadsheet>
```

### storage-manager
データ永続化の抽象化層
```typescript
function saveSpreadsheet(spreadsheet: Spreadsheet): Promise<void>
function loadSpreadsheet(id: string): Promise<Spreadsheet>
function listSpreadsheets(): Promise<SpreadsheetMetadata[]>
```

## パフォーマンス最適化

### 仮想スクロール
- 可視範囲のみレンダリング（約30×20セル）
- @tanstack/react-virtualを使用
- 動的な行高・列幅に対応

### メモ化戦略
```typescript
// セルコンポーネント
const Cell = React.memo(({ value, onChange }) => {
  // レンダリングロジック
}, (prevProps, nextProps) => {
  return prevProps.value === nextProps.value;
});
```

### 計算最適化
- HyperFormulaの依存グラフによる差分計算
- Web Worker検討（将来）

## エラーハンドリング

### 数式エラー
- `#DIV/0!`: ゼロ除算
- `#REF!`: 無効な参照
- `#VALUE!`: 型エラー
- `#CIRCULAR!`: 循環参照

### ユーザーフィードバック
- エラーはセル内に表示
- ツールチップで詳細説明
- コンソールにスタックトレース

## テスト戦略

### 優先順位
1. 契約テスト（API仕様）
2. 統合テスト（ライブラリ連携）
3. E2Eテスト（ユーザーシナリオ）
4. ユニットテスト（個別関数）

### テストコマンド
```bash
npm run test           # 全テスト実行
npm run test:unit      # ユニットテスト
npm run test:integration # 統合テスト
npm run test:e2e       # E2Eテスト
```

## デバッグ

### 開発ツール
- React DevTools: コンポーネントツリー確認
- Redux DevTools: 状態管理デバッグ（Zustand使用時）
- Chrome Performance: パフォーマンス分析

### ログレベル
```typescript
console.debug()  // 詳細デバッグ情報
console.info()   // 一般情報
console.warn()   // 警告
console.error()  // エラー
```

## よくある問題と解決策

### 問題: 大規模データでの遅延
**解決**:
- 仮想スクロールの適切な設定
- メモ化の見直し
- 不要な再レンダリング削除

### 問題: LocalStorage容量超過
**解決**:
- データ圧縮実装
- IndexedDBへの移行
- 不要データの削除

### 問題: 循環参照
**解決**:
- HyperFormulaの循環参照検出を活用
- ユーザーに明確なエラー表示

## 最近の変更
- 2025-09-14: 初期実装計画策定
- 技術スタック決定（Next.js, HyperFormula, Papa Parse）
- データモデル定義完了

---
*Last updated: 2025-09-14*