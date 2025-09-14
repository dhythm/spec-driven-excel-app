# Implementation Plan: オンラインスプレッドシートアプリケーション


**Branch**: `001-excel-excel-google` | **Date**: 2025-09-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-excel-excel-google/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, or `GEMINI.md` for Gemini CLI).
6. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
ブラウザベースのExcelライクなスプレッドシートアプリケーションをNext.js (App Router) + TypeScript + Tailwind CSSで構築。セル編集、計算機能、行列操作、CSV入出力、LocalStorageによるデータ永続化を実装。将来的なExcel/Google Sheets連携を考慮した拡張可能な設計。

## Technical Context
**Language/Version**: TypeScript 5.3+
**Primary Dependencies**: Next.js 14+ (App Router), React 18, Tailwind CSS 3.4+
**Storage**: LocalStorage (初期版), 将来的にクラウドストレージ対応予定
**Testing**: Jest + React Testing Library
**Target Platform**: Web (Chrome, Firefox, Safari, Edgeの最新版)
**Project Type**: web - フロントエンド中心のアプリケーション
**Performance Goals**: 1000×1000セルでスムーズな操作、計算処理100ms以内
**Constraints**: LocalStorage 5MB制限、同時接続5ユーザーまで
**Scale/Scope**: 初期版は単一ユーザー、将来的に5ユーザー同時接続対応

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 2 (frontend, tests)
- Using framework directly? Yes (Next.js, React直接使用)
- Single data model? Yes (スプレッドシート関連エンティティのみ)
- Avoiding patterns? Yes (過度な抽象化を避ける)

**Architecture**:
- EVERY feature as library? Yes
- Libraries listed:
  - spreadsheet-core: グリッド管理とセル操作
  - formula-engine: 数式パーサーと計算エンジン
  - csv-handler: CSV入出力処理
  - storage-manager: LocalStorage操作
- CLI per library: 各ライブラリにCLIコマンド予定
- Library docs: llms.txt形式で計画

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes
- Git commits show tests before implementation? Yes
- Order: Contract→Integration→E2E→Unit strictly followed? Yes
- Real dependencies used? Yes (LocalStorage実装を使用)
- Integration tests for: 各ライブラリ間連携、データ永続化、CSV入出力
- FORBIDDEN: Implementation before test, skipping RED phase

**Observability**:
- Structured logging included? Yes
- Frontend logs → backend? 初期版はフロントエンドのみ
- Error context sufficient? Yes

**Versioning**:
- Version number assigned? 0.1.0
- BUILD increments on every change? Yes
- Breaking changes handled? N/A (初期版)

## Project Structure

### Documentation (this feature)
```
specs/001-excel-excel-google/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 2: Web application (frontend focused)
frontend/
├── src/
│   ├── components/
│   │   ├── Grid/
│   │   ├── Cell/
│   │   ├── FormulaBar/
│   │   └── Toolbar/
│   ├── lib/
│   │   ├── spreadsheet-core/
│   │   ├── formula-engine/
│   │   ├── csv-handler/
│   │   └── storage-manager/
│   ├── hooks/
│   ├── utils/
│   └── app/
│       ├── layout.tsx
│       ├── page.tsx
│       └── api/ (将来的なバックエンド連携用)
└── tests/
    ├── contract/
    ├── integration/
    └── unit/

# CLI tools
cli/
├── spreadsheet-cli/
├── formula-cli/
├── csv-cli/
└── storage-cli/
```

**Structure Decision**: Option 2 (Web application) - フロントエンド中心のNext.jsアプリケーション

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - Next.js App Router最新のベストプラクティス
   - 大規模グリッド(1000×1000)のパフォーマンス最適化手法
   - Excel互換の数式パーサー実装方法
   - LocalStorageの効率的なデータ構造設計
   - 仮想スクロール実装パターン

2. **Generate and dispatch research agents**:
   ```
   Task 1: "Research Next.js App Router performance optimization for large data grids"
   Task 2: "Find best practices for Excel-compatible formula parser implementation"
   Task 3: "Research virtual scrolling patterns for React spreadsheet components"
   Task 4: "Investigate LocalStorage optimization strategies for structured data"
   Task 5: "Research CSV parsing and generation in JavaScript/TypeScript"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all technical decisions documented

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Spreadsheet: ID、名前、作成日時、更新日時、グリッドサイズ
   - Cell: 行番号、列番号、値、数式、書式（将来拡張）
   - Row: インデックス、高さ、表示状態
   - Column: インデックス、幅、表示状態
   - Formula: 式文字列、参照セル、計算結果

2. **Generate API contracts** from functional requirements:
   - スプレッドシート操作API (CRUD)
   - セル更新API
   - 計算実行API
   - CSV入出力API
   - Output to `/contracts/`

3. **Generate contract tests** from contracts:
   - データモデル検証テスト
   - 計算エンジン契約テスト
   - CSV入出力契約テスト

4. **Extract test scenarios** from user stories:
   - 新規スプレッドシート作成シナリオ
   - セル編集・計算シナリオ
   - CSV入出力シナリオ
   - エラーハンドリングシナリオ

5. **Update agent file incrementally** (O(1) operation):
   - CLAUDE.mdにNext.js/TypeScript/Tailwind設定追加
   - スプレッドシート特有の考慮事項記載

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs
- 各エンティティモデル作成タスク [P]
- 各ライブラリ実装タスク
- 契約テスト作成タスク [P]
- 統合テスト作成タスク
- UIコンポーネント実装タスク

**Ordering Strategy**:
- TDD order: テスト→実装
- Dependency order: コアライブラリ→UI→統合
- Mark [P] for parallel execution

**Estimated Output**: 30-35 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | - | - |

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (None)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*