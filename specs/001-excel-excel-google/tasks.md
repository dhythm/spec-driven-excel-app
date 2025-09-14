# Tasks: オンラインスプレッドシートアプリケーション

**Input**: Design documents from `/specs/001-excel-excel-google/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Web app**: `frontend/src/`, `frontend/tests/`, `cli/`
- Based on plan.md structure decision

## Phase 3.1: Setup
- [ ] T001 Create project structure per implementation plan (frontend/, cli/, specs/)
- [ ] T002 Initialize Next.js 14+ project with TypeScript in frontend/
- [ ] T003 [P] Install core dependencies (React 18, Tailwind CSS 3.4+)
- [ ] T004 [P] Install spreadsheet dependencies (@tanstack/react-virtual, hyperformula, papaparse)
- [ ] T005 [P] Configure ESLint and Prettier for TypeScript/React
- [ ] T006 [P] Setup Jest and React Testing Library
- [ ] T007 Create base directory structure for libraries in frontend/src/lib/

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests
- [ ] T008 [P] Contract test for createSpreadsheet in frontend/tests/contract/test_spreadsheet_create.ts
- [ ] T009 [P] Contract test for updateCells in frontend/tests/contract/test_cells_update.ts
- [ ] T010 [P] Contract test for recalculate in frontend/tests/contract/test_formula_calculate.ts
- [ ] T011 [P] Contract test for exportCsv in frontend/tests/contract/test_csv_export.ts
- [ ] T012 [P] Contract test for importCsv in frontend/tests/contract/test_csv_import.ts

### Integration Tests
- [ ] T013 [P] Integration test for new spreadsheet creation scenario in frontend/tests/integration/test_spreadsheet_creation.ts
- [ ] T014 [P] Integration test for cell editing and calculation scenario in frontend/tests/integration/test_cell_calculation.ts
- [ ] T015 [P] Integration test for CSV import/export flow in frontend/tests/integration/test_csv_flow.ts
- [ ] T016 [P] Integration test for formula error handling in frontend/tests/integration/test_formula_errors.ts
- [ ] T017 [P] Integration test for data persistence with LocalStorage in frontend/tests/integration/test_persistence.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models
- [ ] T018 [P] Spreadsheet model in frontend/src/lib/spreadsheet-core/models/spreadsheet.ts
- [ ] T019 [P] Cell model in frontend/src/lib/spreadsheet-core/models/cell.ts
- [ ] T020 [P] Row model in frontend/src/lib/spreadsheet-core/models/row.ts
- [ ] T021 [P] Column model in frontend/src/lib/spreadsheet-core/models/column.ts
- [ ] T022 [P] Formula model in frontend/src/lib/formula-engine/models/formula.ts
- [ ] T023 [P] Selection model in frontend/src/lib/spreadsheet-core/models/selection.ts
- [ ] T024 [P] ClipboardData model in frontend/src/lib/spreadsheet-core/models/clipboard.ts
- [ ] T025 [P] HistoryEntry model for undo/redo in frontend/src/lib/spreadsheet-core/models/history.ts

### Core Libraries
- [ ] T026 Spreadsheet-core library functions in frontend/src/lib/spreadsheet-core/index.ts
- [ ] T027 Cell operations (update, delete, format) in frontend/src/lib/spreadsheet-core/operations.ts
- [ ] T028 Grid management (add/remove rows/columns) in frontend/src/lib/spreadsheet-core/grid.ts
- [ ] T029 Formula engine wrapper for HyperFormula in frontend/src/lib/formula-engine/index.ts
- [ ] T030 Formula parsing and calculation in frontend/src/lib/formula-engine/calculator.ts
- [ ] T031 Dependency graph management in frontend/src/lib/formula-engine/dependencies.ts
- [ ] T032 CSV handler with Papa Parse in frontend/src/lib/csv-handler/index.ts
- [ ] T033 CSV export functionality in frontend/src/lib/csv-handler/export.ts
- [ ] T034 CSV import functionality in frontend/src/lib/csv-handler/import.ts
- [ ] T035 Storage manager for LocalStorage in frontend/src/lib/storage-manager/index.ts
- [ ] T036 Data compression for storage in frontend/src/lib/storage-manager/compression.ts

### React Components
- [ ] T037 Main SpreadsheetApp component in frontend/src/components/SpreadsheetApp.tsx
- [ ] T038 Grid component with virtual scrolling in frontend/src/components/Grid/Grid.tsx
- [ ] T039 VirtualizedRows component in frontend/src/components/Grid/VirtualizedRows.tsx
- [ ] T040 Cell component (memoized) in frontend/src/components/Cell/Cell.tsx
- [ ] T041 Cell editor component in frontend/src/components/Cell/CellEditor.tsx
- [ ] T042 FormulaBar component in frontend/src/components/FormulaBar/FormulaBar.tsx
- [ ] T043 Toolbar component in frontend/src/components/Toolbar/Toolbar.tsx
- [ ] T044 StatusBar component in frontend/src/components/StatusBar/StatusBar.tsx

### Custom Hooks
- [ ] T045 [P] useSpreadsheet hook in frontend/src/hooks/useSpreadsheet.ts
- [ ] T046 [P] useCell hook in frontend/src/hooks/useCell.ts
- [ ] T047 [P] useFormula hook in frontend/src/hooks/useFormula.ts
- [ ] T048 [P] useSelection hook in frontend/src/hooks/useSelection.ts
- [ ] T049 [P] useClipboard hook in frontend/src/hooks/useClipboard.ts
- [ ] T050 [P] useHistory hook for undo/redo in frontend/src/hooks/useHistory.ts

### API Routes (Next.js App Router)
- [ ] T051 GET /api/spreadsheets route in frontend/src/app/api/spreadsheets/route.ts
- [ ] T052 POST /api/spreadsheets route in frontend/src/app/api/spreadsheets/route.ts
- [ ] T053 GET /api/spreadsheets/[id] route in frontend/src/app/api/spreadsheets/[id]/route.ts
- [ ] T054 PUT /api/spreadsheets/[id] route in frontend/src/app/api/spreadsheets/[id]/route.ts
- [ ] T055 PATCH /api/spreadsheets/[id]/cells route in frontend/src/app/api/spreadsheets/[id]/cells/route.ts
- [ ] T056 POST /api/spreadsheets/[id]/calculate route in frontend/src/app/api/spreadsheets/[id]/calculate/route.ts
- [ ] T057 GET /api/spreadsheets/[id]/export/csv route in frontend/src/app/api/spreadsheets/[id]/export/csv/route.ts
- [ ] T058 POST /api/spreadsheets/[id]/import/csv route in frontend/src/app/api/spreadsheets/[id]/import/csv/route.ts

### CLI Tools
- [ ] T059 [P] Spreadsheet CLI base in cli/spreadsheet-cli/index.ts
- [ ] T060 [P] Formula CLI base in cli/formula-cli/index.ts
- [ ] T061 [P] CSV CLI base in cli/csv-cli/index.ts
- [ ] T062 [P] Storage CLI base in cli/storage-cli/index.ts

## Phase 3.4: Integration
- [ ] T063 Connect storage-manager to spreadsheet-core
- [ ] T064 Integrate formula-engine with cell updates
- [ ] T065 Wire up CSV import/export with grid data
- [ ] T066 Implement auto-save with debouncing (3 seconds)
- [ ] T067 Add error boundaries for React components
- [ ] T068 Implement keyboard shortcuts (Ctrl+C/V/Z/Y/S)
- [ ] T069 Add context menu for cells
- [ ] T070 Implement cell selection and range selection

## Phase 3.5: Polish
- [ ] T071 [P] Unit tests for validation in frontend/tests/unit/test_validation.ts
- [ ] T072 [P] Unit tests for formula parsing in frontend/tests/unit/test_formula_parser.ts
- [ ] T073 [P] Unit tests for CSV parsing in frontend/tests/unit/test_csv_parser.ts
- [ ] T074 Performance optimization for virtual scrolling
- [ ] T075 Implement lazy loading for large spreadsheets
- [ ] T076 Add loading states and progress indicators
- [ ] T077 [P] Create API documentation in docs/api.md
- [ ] T078 [P] Update quickstart guide with actual implementation
- [ ] T079 Run performance tests (target: <100ms calculation, 30fps scrolling)
- [ ] T080 Execute all scenarios from quickstart.md

## Dependencies
- Setup (T001-T007) must complete first
- Tests (T008-T017) before any implementation
- Models (T018-T025) before services
- Core libraries (T026-T036) before components
- Components (T037-T044) before hooks
- Hooks can be parallel with API routes
- Integration (T063-T070) after core implementation
- Polish (T071-T080) last

## Parallel Execution Examples

### Batch 1: Dependencies Installation (after T002)
```bash
# Launch T003-T006 together:
Task: "Install core dependencies (React 18, Tailwind CSS 3.4+)"
Task: "Install spreadsheet dependencies (@tanstack/react-virtual, hyperformula, papaparse)"
Task: "Configure ESLint and Prettier for TypeScript/React"
Task: "Setup Jest and React Testing Library"
```

### Batch 2: Contract Tests (after T007)
```bash
# Launch T008-T012 together:
Task: "Contract test for createSpreadsheet in frontend/tests/contract/test_spreadsheet_create.ts"
Task: "Contract test for updateCells in frontend/tests/contract/test_cells_update.ts"
Task: "Contract test for recalculate in frontend/tests/contract/test_formula_calculate.ts"
Task: "Contract test for exportCsv in frontend/tests/contract/test_csv_export.ts"
Task: "Contract test for importCsv in frontend/tests/contract/test_csv_import.ts"
```

### Batch 3: Integration Tests
```bash
# Launch T013-T017 together:
Task: "Integration test for new spreadsheet creation scenario"
Task: "Integration test for cell editing and calculation scenario"
Task: "Integration test for CSV import/export flow"
Task: "Integration test for formula error handling"
Task: "Integration test for data persistence with LocalStorage"
```

### Batch 4: Data Models
```bash
# Launch T018-T025 together:
Task: "Spreadsheet model in frontend/src/lib/spreadsheet-core/models/spreadsheet.ts"
Task: "Cell model in frontend/src/lib/spreadsheet-core/models/cell.ts"
Task: "Row model in frontend/src/lib/spreadsheet-core/models/row.ts"
Task: "Column model in frontend/src/lib/spreadsheet-core/models/column.ts"
Task: "Formula model in frontend/src/lib/formula-engine/models/formula.ts"
Task: "Selection model in frontend/src/lib/spreadsheet-core/models/selection.ts"
Task: "ClipboardData model in frontend/src/lib/spreadsheet-core/models/clipboard.ts"
Task: "HistoryEntry model for undo/redo in frontend/src/lib/spreadsheet-core/models/history.ts"
```

### Batch 5: Hooks
```bash
# Launch T045-T050 together:
Task: "useSpreadsheet hook in frontend/src/hooks/useSpreadsheet.ts"
Task: "useCell hook in frontend/src/hooks/useCell.ts"
Task: "useFormula hook in frontend/src/hooks/useFormula.ts"
Task: "useSelection hook in frontend/src/hooks/useSelection.ts"
Task: "useClipboard hook in frontend/src/hooks/useClipboard.ts"
Task: "useHistory hook for undo/redo in frontend/src/hooks/useHistory.ts"
```

### Batch 6: CLI Tools
```bash
# Launch T059-T062 together:
Task: "Spreadsheet CLI base in cli/spreadsheet-cli/index.ts"
Task: "Formula CLI base in cli/formula-cli/index.ts"
Task: "CSV CLI base in cli/csv-cli/index.ts"
Task: "Storage CLI base in cli/storage-cli/index.ts"
```

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing (RED phase of TDD)
- Commit after each task with descriptive message
- Use React.memo for Cell components to optimize rendering
- Implement virtual scrolling early for performance
- LocalStorage has 5MB limit - implement compression
- Consider IndexedDB migration path for future

## Validation Checklist
*GATE: Checked before execution*

- [x] All contracts have corresponding tests (T008-T012)
- [x] All entities have model tasks (T018-T025)
- [x] All tests come before implementation
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] All API endpoints have implementation tasks (T051-T058)
- [x] Performance requirements addressed (T074-T075, T079)

---
*Generated from plan.md, data-model.md, contracts/spreadsheet-api.yaml, research.md*
*Total tasks: 80*
*Estimated parallel execution opportunities: 6 batches*