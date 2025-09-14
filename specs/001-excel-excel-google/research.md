# Research Document: スプレッドシートアプリケーション技術調査

**Date**: 2025-09-14
**Feature**: オンラインスプレッドシートアプリケーション

## Executive Summary
Next.js App Router + TypeScript環境でExcel互換スプレッドシートを構築するための技術選定と実装方針を調査。1000×1000セルの大規模グリッドをサポートし、LocalStorageでデータ永続化を実現する。

## 技術選定結果

### 1. グリッドレンダリング戦略

**Decision**: DOM仮想化 + @tanstack/react-virtual
**Rationale**:
- React生態系との統合が容易
- セル内インタラクティブ要素の実装が自然
- アクセシビリティサポートが良好
- 1000×1000セルでも十分なパフォーマンス

**Alternatives considered**:
- Canvas レンダリング: 高パフォーマンスだが実装コストとインタラクション実装の複雑さで却下
- react-window: 機能が限定的で動的サイズ計算が困難なため却下
- react-virtualized: メンテナンスが停滞気味のため却下

### 2. 数式エンジン

**Decision**: HyperFormula
**Rationale**:
- TypeScript製で型安全性が高い
- 400個以上のExcel互換関数
- パフォーマンス最適化済み（循環参照検出、依存グラフ管理）
- バンドルサイズ135KB (minified + gzipped)で許容範囲

**Alternatives considered**:
- Formula.js: パフォーマンス問題と拡張性の限界で却下
- カスタム実装: 開発コストが数ヶ月規模になるため却下
- SheetJS: ライセンス制約とファイル処理特化のため却下

### 3. パフォーマンス最適化

**Decision**: React 18最適化 + メモ化戦略
**Rationale**:
- React.memoによる不要な再レンダリング防止
- useMemoによる計算結果キャッシュ
- useCallbackによるイベントハンドラ安定化
- 並行レンダリングによる応答性向上

**Alternatives considered**:
- React 19 Compiler待ち: 現時点では利用不可
- Preact移行: エコシステムの制約で却下

### 4. データ永続化

**Decision**: LocalStorage（初期版） → IndexedDB（将来）
**Rationale**:
- LocalStorageは実装が簡単で5MBまで対応可能
- JSON圧縮で実効容量を拡大
- IndexedDBへの段階的移行パスを確保

**Alternatives considered**:
- IndexedDB即採用: 初期版には過剰、API複雑性で却下
- SessionStorage: 永続化要件を満たさないため却下
- WebSQL: 非推奨技術のため却下

### 5. CSV処理

**Decision**: Papa Parse
**Rationale**:
- ストリーミング処理で大容量ファイル対応
- Web Worker対応でUIブロッキング回避
- Excel互換性考慮（エンコーディング、区切り文字）
- 豊富な実績とコミュニティサポート

**Alternatives considered**:
- ネイティブ実装: エッジケース対応の工数で却下
- SheetJS: ライセンスコストとオーバースペックで却下
- CSV.js: メンテナンス停滞で却下

## 実装アーキテクチャ

### コンポーネント構成
```
SpreadsheetApp
├── Grid (仮想スクロール管理)
│   ├── VirtualizedRows
│   └── Cell (メモ化済み)
├── FormulaBar
├── Toolbar
└── StatusBar
```

### ライブラリ構成
```
lib/
├── spreadsheet-core/ (グリッド管理)
├── formula-engine/ (HyperFormula wrapper)
├── csv-handler/ (Papa Parse wrapper)
└── storage-manager/ (LocalStorage/IndexedDB抽象化)
```

### パフォーマンス目標達成方法

**1000×1000セル対応**:
- 仮想スクロールで可視範囲のみレンダリング（約30×20セル）
- セルコンポーネントのメモ化
- 計算処理のWeb Worker化検討

**計算処理100ms以内**:
- HyperFormulaの依存グラフによる差分計算
- 非同期計算とプログレス表示
- バッチ更新による再計算最適化

## リスクと対策

### リスク1: LocalStorage容量制限
**対策**:
- データ圧縮（gzip）
- チャンキング戦略
- IndexedDBへの早期移行準備

### リスク2: 大規模データでのパフォーマンス劣化
**対策**:
- 段階的読み込み（lazy loading）
- Web Worker活用
- Canvas レンダリングへの移行パス確保

### リスク3: ブラウザ互換性
**対策**:
- Polyfill導入
- Progressive Enhancement
- 機能検出による代替実装

## 実装優先順位

1. **Phase 1**: 基本グリッド + セル編集（仮想スクロール含む）
2. **Phase 2**: HyperFormula統合
3. **Phase 3**: LocalStorage永続化
4. **Phase 4**: CSV入出力（Papa Parse）
5. **Phase 5**: パフォーマンス最適化

## 推奨開発環境

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "@tanstack/react-virtual": "^3.0.0",
    "hyperformula": "^2.6.0",
    "papaparse": "^5.4.0",
    "localforage": "^1.10.0"
  },
  "devDependencies": {
    "@types/papaparse": "^5.3.0",
    "typescript": "^5.3.0"
  }
}
```

## 結論

提案された技術スタックにより、Excel互換の高性能スプレッドシートアプリケーションの実現が可能。初期版はLocalStorage + DOM仮想化で開始し、需要に応じてIndexedDB + Canvas レンダリングへ段階的に移行する戦略を推奨。

---
*Research completed: 2025-09-14*