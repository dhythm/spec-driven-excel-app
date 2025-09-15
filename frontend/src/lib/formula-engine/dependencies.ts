/**
 * Formula Dependencies Library
 * 数式の依存関係グラフの管理を担当するライブラリ
 */

import { CellPosition, cellPositionToA1Notation } from '../cell';
import { Spreadsheet, getCellFromSpreadsheet, cellPositionToKey } from '../spreadsheet';
import { parseFormula, ParsedFormula } from '../formula';

/**
 * 依存関係の種類
 */
export enum DependencyType {
  DIRECT = 'direct',        // 直接参照
  INDIRECT = 'indirect',    // 間接参照
  RANGE = 'range',         // 範囲参照
  CIRCULAR = 'circular'     // 循環参照
}

/**
 * 依存関係エッジ
 */
export interface DependencyEdge {
  from: CellPosition;
  to: CellPosition;
  type: DependencyType;
  formula?: string;
  weight: number;
}

/**
 * 依存関係ノード
 */
export interface DependencyNode {
  position: CellPosition;
  formula?: string;
  dependents: CellPosition[];    // このセルに依存するセル
  dependencies: CellPosition[];  // このセルが依存するセル
  level: number;                // 依存関係の深さレベル
  isCircular: boolean;          // 循環参照に含まれているか
  lastUpdated: Date;
}

/**
 * 循環参照の情報
 */
export interface CircularReference {
  cycle: CellPosition[];
  severity: 'warning' | 'error';
  canResolve: boolean;
  resolutionHint?: string;
}

/**
 * 依存関係グラフ
 */
export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: DependencyEdge[];
  circularReferences: CircularReference[];
  calculationOrder: CellPosition[];
  lastUpdated: Date;
}

/**
 * 依存関係分析結果
 */
export interface DependencyAnalysis {
  totalNodes: number;
  totalEdges: number;
  maxDepth: number;
  circularReferenceCount: number;
  orphanNodes: CellPosition[];
  rootNodes: CellPosition[];
  leafNodes: CellPosition[];
  complexityScore: number;
}

/**
 * 依存関係管理クラス
 */
export class DependencyManager {
  private graph: DependencyGraph;
  private spreadsheet: Spreadsheet;

  constructor(spreadsheet: Spreadsheet) {
    this.spreadsheet = spreadsheet;
    this.graph = {
      nodes: new Map(),
      edges: [],
      circularReferences: [],
      calculationOrder: [],
      lastUpdated: new Date()
    };
    this.buildDependencyGraph();
  }

  /**
   * 依存関係グラフを構築する
   */
  buildDependencyGraph(): void {
    this.graph.nodes.clear();
    this.graph.edges = [];
    this.graph.circularReferences = [];

    // 全てのセルを分析
    for (const [key, cell] of this.spreadsheet.cells) {
      if (cell.dataType === 'formula') {
        this.processFormulaCell(cell.position, cell.rawValue);
      } else {
        // 数式でないセルもノードとして追加
        this.addNode(cell.position);
      }
    }

    // 循環参照を検出
    this.detectCircularReferences();

    // 計算順序を決定
    this.calculateExecutionOrder();

    // 依存関係レベルを設定
    this.assignDependencyLevels();

    this.graph.lastUpdated = new Date();
  }

  /**
   * 数式セルを処理する
   */
  private processFormulaCell(position: CellPosition, formula: string): void {
    try {
      const parsed = parseFormula(formula);
      const node = this.addNode(position, formula);

      // 依存関係を追加
      for (const dependency of parsed.dependencies) {
        this.addDependency(position, dependency, DependencyType.DIRECT, formula);
      }

      // 範囲参照も処理
      for (const range of parsed.cellRanges) {
        for (let row = range.start.row; row <= range.end.row; row++) {
          for (let col = range.start.column; col <= range.end.column; col++) {
            const rangePos = { row, column: col };
            this.addDependency(position, rangePos, DependencyType.RANGE, formula);
          }
        }
      }
    } catch (error) {
      // 解析エラーの場合はノードだけ追加
      this.addNode(position, formula);
    }
  }

  /**
   * ノードを追加する
   */
  private addNode(position: CellPosition, formula?: string): DependencyNode {
    const key = cellPositionToKey(position);
    let node = this.graph.nodes.get(key);

    if (!node) {
      node = {
        position,
        formula,
        dependents: [],
        dependencies: [],
        level: 0,
        isCircular: false,
        lastUpdated: new Date()
      };
      this.graph.nodes.set(key, node);
    } else {
      // 既存のノードを更新
      node.formula = formula;
      node.lastUpdated = new Date();
    }

    return node;
  }

  /**
   * 依存関係を追加する
   */
  private addDependency(
    from: CellPosition,
    to: CellPosition,
    type: DependencyType,
    formula?: string
  ): void {
    const fromKey = cellPositionToKey(from);
    const toKey = cellPositionToKey(to);

    // ノードが存在しない場合は作成
    const fromNode = this.addNode(from, formula);
    const toNode = this.addNode(to);

    // 依存関係を追加（重複チェック）
    if (!fromNode.dependencies.some(dep =>
      dep.row === to.row && dep.column === to.column)) {
      fromNode.dependencies.push(to);
    }

    if (!toNode.dependents.some(dep =>
      dep.row === from.row && dep.column === from.column)) {
      toNode.dependents.push(from);
    }

    // エッジを追加
    const existingEdge = this.graph.edges.find(edge =>
      edge.from.row === from.row && edge.from.column === from.column &&
      edge.to.row === to.row && edge.to.column === to.column
    );

    if (!existingEdge) {
      this.graph.edges.push({
        from,
        to,
        type,
        formula,
        weight: 1
      });
    }
  }

  /**
   * 循環参照を検出する
   */
  private detectCircularReferences(): void {
    this.graph.circularReferences = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const [key, node] of this.graph.nodes) {
      if (!visited.has(key)) {
        const cycle = this.detectCycleFromNode(node, visited, recursionStack, []);
        if (cycle.length > 0) {
          const circularRef: CircularReference = {
            cycle,
            severity: 'error',
            canResolve: cycle.length === 2, // 2セル間の循環参照は解決可能かもしれない
            resolutionHint: this.generateResolutionHint(cycle)
          };
          this.graph.circularReferences.push(circularRef);

          // 循環参照に含まれるノードにマークを付ける
          for (const position of cycle) {
            const cycleKey = cellPositionToKey(position);
            const cycleNode = this.graph.nodes.get(cycleKey);
            if (cycleNode) {
              cycleNode.isCircular = true;
            }
          }
        }
      }
    }
  }

  /**
   * 特定のノードから循環参照を検出する
   */
  private detectCycleFromNode(
    node: DependencyNode,
    visited: Set<string>,
    recursionStack: Set<string>,
    currentPath: CellPosition[]
  ): CellPosition[] {
    const key = cellPositionToKey(node.position);
    visited.add(key);
    recursionStack.add(key);
    currentPath.push(node.position);

    for (const dependency of node.dependencies) {
      const depKey = cellPositionToKey(dependency);

      if (recursionStack.has(depKey)) {
        // 循環参照を発見
        const cycleStart = currentPath.findIndex(pos =>
          pos.row === dependency.row && pos.column === dependency.column);
        return currentPath.slice(cycleStart);
      }

      if (!visited.has(depKey)) {
        const depNode = this.graph.nodes.get(depKey);
        if (depNode) {
          const cycle = this.detectCycleFromNode(depNode, visited, recursionStack, [...currentPath]);
          if (cycle.length > 0) {
            return cycle;
          }
        }
      }
    }

    recursionStack.delete(key);
    return [];
  }

  /**
   * 計算順序を決定する（トポロジカルソート）
   */
  private calculateExecutionOrder(): void {
    const inDegree = new Map<string, number>();
    const queue: CellPosition[] = [];

    // 入次数を計算
    for (const [key, node] of this.graph.nodes) {
      inDegree.set(key, node.dependencies.length);
      if (node.dependencies.length === 0 && !node.isCircular) {
        queue.push(node.position);
      }
    }

    const calculationOrder: CellPosition[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      calculationOrder.push(current);

      const currentKey = cellPositionToKey(current);
      const currentNode = this.graph.nodes.get(currentKey);

      if (currentNode) {
        for (const dependent of currentNode.dependents) {
          const depKey = cellPositionToKey(dependent);
          const depNode = this.graph.nodes.get(depKey);

          if (depNode && !depNode.isCircular) {
            const newInDegree = (inDegree.get(depKey) || 0) - 1;
            inDegree.set(depKey, newInDegree);

            if (newInDegree === 0) {
              queue.push(dependent);
            }
          }
        }
      }
    }

    this.graph.calculationOrder = calculationOrder;
  }

  /**
   * 依存関係レベルを設定する
   */
  private assignDependencyLevels(): void {
    // 全ノードのレベルを0に初期化
    for (const node of this.graph.nodes.values()) {
      node.level = 0;
    }

    // 計算順序に従ってレベルを設定
    for (const position of this.graph.calculationOrder) {
      const key = cellPositionToKey(position);
      const node = this.graph.nodes.get(key);

      if (node) {
        let maxDependencyLevel = 0;
        for (const dependency of node.dependencies) {
          const depKey = cellPositionToKey(dependency);
          const depNode = this.graph.nodes.get(depKey);
          if (depNode) {
            maxDependencyLevel = Math.max(maxDependencyLevel, depNode.level);
          }
        }
        node.level = maxDependencyLevel + 1;
      }
    }
  }

  /**
   * セルの依存関係を取得する
   */
  getCellDependencies(position: CellPosition): CellPosition[] {
    const key = cellPositionToKey(position);
    const node = this.graph.nodes.get(key);
    return node ? [...node.dependencies] : [];
  }

  /**
   * セルに依存するセルを取得する
   */
  getCellDependents(position: CellPosition): CellPosition[] {
    const key = cellPositionToKey(position);
    const node = this.graph.nodes.get(key);
    return node ? [...node.dependents] : [];
  }

  /**
   * セルの依存関係を再帰的に取得する
   */
  getCellDependenciesRecursive(position: CellPosition, maxDepth: number = 10): CellPosition[] {
    const visited = new Set<string>();
    const dependencies: CellPosition[] = [];

    const traverse = (pos: CellPosition, depth: number) => {
      if (depth > maxDepth) return;

      const key = cellPositionToKey(pos);
      if (visited.has(key)) return;

      visited.add(key);
      const directDeps = this.getCellDependencies(pos);

      for (const dep of directDeps) {
        dependencies.push(dep);
        traverse(dep, depth + 1);
      }
    };

    traverse(position, 0);
    return dependencies;
  }

  /**
   * セルに依存するセルを再帰的に取得する
   */
  getCellDependentsRecursive(position: CellPosition, maxDepth: number = 10): CellPosition[] {
    const visited = new Set<string>();
    const dependents: CellPosition[] = [];

    const traverse = (pos: CellPosition, depth: number) => {
      if (depth > maxDepth) return;

      const key = cellPositionToKey(pos);
      if (visited.has(key)) return;

      visited.add(key);
      const directDeps = this.getCellDependents(pos);

      for (const dep of directDeps) {
        dependents.push(dep);
        traverse(dep, depth + 1);
      }
    };

    traverse(position, 0);
    return dependents;
  }

  /**
   * 循環参照を取得する
   */
  getCircularReferences(): CircularReference[] {
    return [...this.graph.circularReferences];
  }

  /**
   * セルが循環参照に含まれているかチェックする
   */
  isCellInCircularReference(position: CellPosition): boolean {
    const key = cellPositionToKey(position);
    const node = this.graph.nodes.get(key);
    return node ? node.isCircular : false;
  }

  /**
   * 計算順序を取得する
   */
  getCalculationOrder(): CellPosition[] {
    return [...this.graph.calculationOrder];
  }

  /**
   * セルの依存関係レベルを取得する
   */
  getCellLevel(position: CellPosition): number {
    const key = cellPositionToKey(position);
    const node = this.graph.nodes.get(key);
    return node ? node.level : 0;
  }

  /**
   * 依存関係分析を実行する
   */
  analyzeDependencies(): DependencyAnalysis {
    const nodes = Array.from(this.graph.nodes.values());
    const rootNodes = nodes.filter(node => node.dependencies.length === 0);
    const leafNodes = nodes.filter(node => node.dependents.length === 0);
    const orphanNodes = nodes.filter(node =>
      node.dependencies.length === 0 && node.dependents.length === 0 && node.formula);

    const maxDepth = nodes.reduce((max, node) => Math.max(max, node.level), 0);
    const complexityScore = this.calculateComplexityScore();

    return {
      totalNodes: this.graph.nodes.size,
      totalEdges: this.graph.edges.length,
      maxDepth,
      circularReferenceCount: this.graph.circularReferences.length,
      orphanNodes: orphanNodes.map(node => node.position),
      rootNodes: rootNodes.map(node => node.position),
      leafNodes: leafNodes.map(node => node.position),
      complexityScore
    };
  }

  /**
   * 複雑度スコアを計算する
   */
  private calculateComplexityScore(): number {
    const nodeCount = this.graph.nodes.size;
    const edgeCount = this.graph.edges.length;
    const circularRefs = this.graph.circularReferences.length;
    const maxLevel = Math.max(...Array.from(this.graph.nodes.values()).map(n => n.level));

    // 複雑度スコア = ノード数 + エッジ数 + 循環参照数 * 10 + 最大レベル * 2
    return nodeCount + edgeCount + (circularRefs * 10) + (maxLevel * 2);
  }

  /**
   * 解決のヒントを生成する
   */
  private generateResolutionHint(cycle: CellPosition[]): string {
    const cellNames = cycle.map(pos => cellPositionToA1Notation(pos)).join(' → ');

    if (cycle.length === 2) {
      return `2つのセル間の循環参照です（${cellNames}）。一方のセルの数式を変更してください。`;
    } else {
      return `複数のセルによる循環参照です（${cellNames}）。依存関係チェーンを断つ必要があります。`;
    }
  }

  /**
   * 依存関係グラフをリセットする
   */
  reset(): void {
    this.graph = {
      nodes: new Map(),
      edges: [],
      circularReferences: [],
      calculationOrder: [],
      lastUpdated: new Date()
    };
  }

  /**
   * 特定のセルの依存関係を更新する
   */
  updateCellDependencies(position: CellPosition, formula?: string): void {
    const key = cellPositionToKey(position);

    // 既存の依存関係を削除
    this.removeCellDependencies(position);

    // 新しい依存関係を追加
    if (formula && formula.startsWith('=')) {
      this.processFormulaCell(position, formula);
    } else {
      this.addNode(position);
    }

    // グラフを再構築
    this.detectCircularReferences();
    this.calculateExecutionOrder();
    this.assignDependencyLevels();

    this.graph.lastUpdated = new Date();
  }

  /**
   * 特定のセルの依存関係を削除する
   */
  private removeCellDependencies(position: CellPosition): void {
    const key = cellPositionToKey(position);
    const node = this.graph.nodes.get(key);

    if (node) {
      // 依存先から自分を削除
      for (const dependency of node.dependencies) {
        const depKey = cellPositionToKey(dependency);
        const depNode = this.graph.nodes.get(depKey);
        if (depNode) {
          depNode.dependents = depNode.dependents.filter(dep =>
            !(dep.row === position.row && dep.column === position.column));
        }
      }

      // 依存元から自分を削除
      for (const dependent of node.dependents) {
        const depKey = cellPositionToKey(dependent);
        const depNode = this.graph.nodes.get(depKey);
        if (depNode) {
          depNode.dependencies = depNode.dependencies.filter(dep =>
            !(dep.row === position.row && dep.column === position.column));
        }
      }

      // エッジを削除
      this.graph.edges = this.graph.edges.filter(edge =>
        !(edge.from.row === position.row && edge.from.column === position.column) &&
        !(edge.to.row === position.row && edge.to.column === position.column));

      // ノードをクリア
      node.dependencies = [];
      node.dependents = [];
      node.isCircular = false;
    }
  }

  /**
   * 依存関係グラフの統計を取得する
   */
  getGraphStats(): {
    lastUpdated: Date;
    nodeCount: number;
    edgeCount: number;
    circularReferenceCount: number;
    maxLevel: number;
    averageLevel: number;
  } {
    const nodes = Array.from(this.graph.nodes.values());
    const levels = nodes.map(node => node.level);
    const maxLevel = Math.max(...levels, 0);
    const averageLevel = levels.length > 0 ?
      levels.reduce((sum, level) => sum + level, 0) / levels.length : 0;

    return {
      lastUpdated: this.graph.lastUpdated,
      nodeCount: this.graph.nodes.size,
      edgeCount: this.graph.edges.length,
      circularReferenceCount: this.graph.circularReferences.length,
      maxLevel,
      averageLevel
    };
  }
}

/**
 * 依存関係管理インスタンスを作成する
 */
export function createDependencyManager(spreadsheet: Spreadsheet): DependencyManager {
  return new DependencyManager(spreadsheet);
}

/**
 * 2つのセル位置が等しいかチェックする
 */
export function areCellPositionsEqual(pos1: CellPosition, pos2: CellPosition): boolean {
  return pos1.row === pos2.row && pos1.column === pos2.column;
}

/**
 * セル位置の配列から重複を除去する
 */
export function uniqueCellPositions(positions: CellPosition[]): CellPosition[] {
  const seen = new Set<string>();
  return positions.filter(pos => {
    const key = cellPositionToKey(pos);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}