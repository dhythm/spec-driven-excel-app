/**
 * Formula Calculator Library
 * 数式の解析と計算を担当するライブラリ
 */

import {
  parseFormula,
  evaluateFormula,
  validateFormula,
  ParsedFormula,
  FormulaResult,
  FormulaError,
  FormulaFunction,
  FormulaOperator
} from '../formula';
import { CellPosition } from '../cell';
import { Spreadsheet, getCellFromSpreadsheet } from '../spreadsheet';

/**
 * 計算コンテキスト
 */
export interface CalculationContext {
  spreadsheet: Spreadsheet;
  getCurrentCellValue: (position: CellPosition) => any;
  getCalculatedCellValue: (position: CellPosition) => any;
  preventCircularReference: boolean;
  maxCalculationDepth: number;
  currentDepth: number;
  visitedCells: Set<string>;
}

/**
 * 計算結果
 */
export interface CalculationResult {
  success: boolean;
  value: any;
  displayValue: string;
  dataType: 'number' | 'text' | 'boolean' | 'date' | 'error' | 'empty';
  error?: FormulaError;
  dependencies: CellPosition[];
  calculationTime: number;
}

/**
 * 高度な計算オプション
 */
export interface AdvancedCalculationOptions {
  enableArrayFormulas?: boolean;
  enableVolatileFunctions?: boolean;
  customFunctions?: { [name: string]: Function };
  dateSystem?: '1900' | '1904';
  precision?: number;
  iterativeCalculation?: {
    enabled: boolean;
    maxIterations: number;
    maxChange: number;
  };
}

/**
 * 数式計算エンジン
 */
export class FormulaCalculator {
  private options: AdvancedCalculationOptions;
  private functionRegistry: Map<string, Function>;

  constructor(options: AdvancedCalculationOptions = {}) {
    this.options = {
      enableArrayFormulas: true,
      enableVolatileFunctions: true,
      customFunctions: {},
      dateSystem: '1900',
      precision: 15,
      iterativeCalculation: {
        enabled: false,
        maxIterations: 100,
        maxChange: 0.001
      },
      ...options
    };

    this.functionRegistry = new Map();
    this.initializeBuiltInFunctions();
    this.registerCustomFunctions();
  }

  /**
   * 数式を計算する
   */
  calculate(
    formula: string,
    context: CalculationContext
  ): CalculationResult {
    const startTime = performance.now();

    try {
      // 数式の妥当性をチェック
      const validation = validateFormula(formula);
      if (!validation.isValid) {
        return {
          success: false,
          value: null,
          displayValue: '#ERROR!',
          dataType: 'error',
          error: validation.errors[0],
          dependencies: [],
          calculationTime: performance.now() - startTime
        };
      }

      // 数式を解析
      const parsed = parseFormula(formula);

      // 循環参照チェック
      if (context.preventCircularReference && this.hasCircularReference(parsed, context)) {
        return {
          success: false,
          value: null,
          displayValue: '#CIRCULAR!',
          dataType: 'error',
          error: {
            type: 'CIRCULAR_REFERENCE',
            message: '循環参照が検出されました'
          },
          dependencies: parsed.dependencies,
          calculationTime: performance.now() - startTime
        };
      }

      // 計算深度チェック
      if (context.currentDepth >= context.maxCalculationDepth) {
        return {
          success: false,
          value: null,
          displayValue: '#DEPTH!',
          dataType: 'error',
          error: {
            type: 'CALCULATION_DEPTH_EXCEEDED',
            message: '計算の深度が上限を超えました'
          },
          dependencies: parsed.dependencies,
          calculationTime: performance.now() - startTime
        };
      }

      // 数式を評価
      const result = this.evaluateParsedFormula(parsed, context);

      return {
        success: result.error === undefined,
        value: result.value,
        displayValue: result.displayValue,
        dataType: this.determineDataType(result.value, result.error),
        error: result.error,
        dependencies: result.dependencies,
        calculationTime: performance.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        value: null,
        displayValue: '#ERROR!',
        dataType: 'error',
        error: {
          type: 'SYNTAX_ERROR',
          message: error instanceof Error ? error.message : '計算エラー'
        },
        dependencies: [],
        calculationTime: performance.now() - startTime
      };
    }
  }

  /**
   * セル値を計算する（数式以外も対応）
   */
  calculateCellValue(
    position: CellPosition,
    context: CalculationContext
  ): CalculationResult {
    const cell = getCellFromSpreadsheet(context.spreadsheet, position);

    if (!cell) {
      return {
        success: true,
        value: null,
        displayValue: '',
        dataType: 'empty',
        dependencies: [],
        calculationTime: 0
      };
    }

    if (cell.dataType === 'formula') {
      return this.calculate(cell.rawValue, context);
    } else {
      const value = this.convertCellValue(cell.rawValue, cell.dataType);
      return {
        success: true,
        value,
        displayValue: cell.displayValue,
        dataType: cell.dataType as any,
        dependencies: [],
        calculationTime: 0
      };
    }
  }

  /**
   * 配列数式を計算する
   */
  calculateArrayFormula(
    formula: string,
    targetRange: { start: CellPosition; end: CellPosition },
    context: CalculationContext
  ): CalculationResult[] {
    if (!this.options.enableArrayFormulas) {
      throw new Error('配列数式は無効になっています');
    }

    const results: CalculationResult[] = [];
    const rowCount = targetRange.end.row - targetRange.start.row + 1;
    const colCount = targetRange.end.column - targetRange.start.column + 1;

    try {
      // 基本的な配列数式の実装（簡易版）
      const baseResult = this.calculate(formula, context);

      // 結果を配列範囲に展開
      for (let row = 0; row < rowCount; row++) {
        for (let col = 0; col < colCount; col++) {
          if (Array.isArray(baseResult.value)) {
            const arrayValue = baseResult.value[row]?.[col] ?? baseResult.value[0]?.[0] ?? null;
            results.push({
              ...baseResult,
              value: arrayValue,
              displayValue: this.formatValueForDisplay(arrayValue)
            });
          } else {
            results.push(baseResult);
          }
        }
      }

      return results;
    } catch (error) {
      // エラーの場合、すべてのセルにエラーを設定
      const errorResult: CalculationResult = {
        success: false,
        value: null,
        displayValue: '#ARRAY_ERROR!',
        dataType: 'error',
        error: {
          type: 'ARRAY_FORMULA_ERROR',
          message: error instanceof Error ? error.message : '配列数式エラー'
        },
        dependencies: [],
        calculationTime: 0
      };

      return Array(rowCount * colCount).fill(errorResult);
    }
  }

  /**
   * 解析済み数式を評価する
   */
  private evaluateParsedFormula(
    parsed: ParsedFormula,
    context: CalculationContext
  ): FormulaResult {
    // 新しい計算コンテキストを作成（深度を増加）
    const newContext: CalculationContext = {
      ...context,
      currentDepth: context.currentDepth + 1
    };

    // セル値取得関数を定義
    const getCellValue = (position: CellPosition): any => {
      const key = `${position.row}-${position.column}`;

      // 循環参照チェック
      if (context.visitedCells.has(key)) {
        throw new Error('循環参照が検出されました');
      }

      context.visitedCells.add(key);

      try {
        const result = this.calculateCellValue(position, newContext);
        return result.value;
      } finally {
        context.visitedCells.delete(key);
      }
    };

    return evaluateFormula(parsed, getCellValue);
  }

  /**
   * 循環参照をチェックする
   */
  private hasCircularReference(
    parsed: ParsedFormula,
    context: CalculationContext
  ): boolean {
    // 簡易的な循環参照チェック
    for (const dependency of parsed.dependencies) {
      const key = `${dependency.row}-${dependency.column}`;
      if (context.visitedCells.has(key)) {
        return true;
      }
    }
    return false;
  }

  /**
   * セル値を適切な型に変換する
   */
  private convertCellValue(rawValue: string, dataType: string): any {
    switch (dataType) {
      case 'number':
        const numValue = parseFloat(rawValue);
        return isNaN(numValue) ? 0 : numValue;
      case 'boolean':
        return rawValue.toLowerCase() === 'true';
      case 'date':
        return new Date(rawValue);
      case 'empty':
        return null;
      default:
        return rawValue;
    }
  }

  /**
   * データ型を判定する
   */
  private determineDataType(
    value: any,
    error?: FormulaError
  ): 'number' | 'text' | 'boolean' | 'date' | 'error' | 'empty' {
    if (error) return 'error';
    if (value === null || value === undefined) return 'empty';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    return 'text';
  }

  /**
   * 値を表示用の文字列に変換する
   */
  private formatValueForDisplay(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return value.toString();
      } else {
        return value.toFixed(Math.min(this.options.precision || 15, 15));
      }
    }
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (value instanceof Date) return value.toLocaleDateString();
    return value.toString();
  }

  /**
   * 組み込み関数を初期化する
   */
  private initializeBuiltInFunctions(): void {
    // 数学関数
    this.registerFunction('ABS', (value: number) => Math.abs(value));
    this.registerFunction('ROUND', (value: number, digits: number = 0) => {
      const factor = Math.pow(10, digits);
      return Math.round(value * factor) / factor;
    });
    this.registerFunction('SQRT', (value: number) => Math.sqrt(value));
    this.registerFunction('POWER', (base: number, exponent: number) => Math.pow(base, exponent));
    this.registerFunction('PI', () => Math.PI);

    // 統計関数
    this.registerFunction('SUM', (...values: number[]) => {
      return values.reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
    });

    this.registerFunction('AVERAGE', (...values: number[]) => {
      const numbers = values.filter(val => typeof val === 'number');
      return numbers.length > 0 ? numbers.reduce((sum, val) => sum + val, 0) / numbers.length : 0;
    });

    this.registerFunction('COUNT', (...values: any[]) => {
      return values.filter(val => typeof val === 'number').length;
    });

    this.registerFunction('MAX', (...values: number[]) => {
      const numbers = values.filter(val => typeof val === 'number');
      return numbers.length > 0 ? Math.max(...numbers) : 0;
    });

    this.registerFunction('MIN', (...values: number[]) => {
      const numbers = values.filter(val => typeof val === 'number');
      return numbers.length > 0 ? Math.min(...numbers) : 0;
    });

    // 論理関数
    this.registerFunction('IF', (condition: boolean, trueValue: any, falseValue: any) => {
      return condition ? trueValue : falseValue;
    });

    this.registerFunction('AND', (...conditions: boolean[]) => {
      return conditions.every(condition => Boolean(condition));
    });

    this.registerFunction('OR', (...conditions: boolean[]) => {
      return conditions.some(condition => Boolean(condition));
    });

    this.registerFunction('NOT', (condition: boolean) => !Boolean(condition));

    // 文字列関数
    this.registerFunction('CONCATENATE', (...values: any[]) => {
      return values.map(val => String(val)).join('');
    });

    this.registerFunction('LEN', (text: string) => String(text).length);

    this.registerFunction('UPPER', (text: string) => String(text).toUpperCase());

    this.registerFunction('LOWER', (text: string) => String(text).toLowerCase());

    this.registerFunction('LEFT', (text: string, length: number) => {
      return String(text).substring(0, length);
    });

    this.registerFunction('RIGHT', (text: string, length: number) => {
      const str = String(text);
      return str.substring(str.length - length);
    });

    this.registerFunction('MID', (text: string, start: number, length: number) => {
      return String(text).substring(start - 1, start - 1 + length);
    });

    // 日付関数
    this.registerFunction('TODAY', () => new Date());
    this.registerFunction('NOW', () => new Date());

    // Volatile関数（再計算時に常に更新される関数）
    if (this.options.enableVolatileFunctions) {
      this.registerFunction('RAND', () => Math.random());
      this.registerFunction('RANDBETWEEN', (bottom: number, top: number) => {
        return Math.floor(Math.random() * (top - bottom + 1)) + bottom;
      });
    }
  }

  /**
   * カスタム関数を登録する
   */
  private registerCustomFunctions(): void {
    if (this.options.customFunctions) {
      for (const [name, func] of Object.entries(this.options.customFunctions)) {
        this.registerFunction(name.toUpperCase(), func);
      }
    }
  }

  /**
   * 関数を登録する
   */
  private registerFunction(name: string, func: Function): void {
    this.functionRegistry.set(name.toUpperCase(), func);
  }

  /**
   * 関数を取得する
   */
  getFunction(name: string): Function | undefined {
    return this.functionRegistry.get(name.toUpperCase());
  }

  /**
   * 利用可能な関数のリストを取得する
   */
  getAvailableFunctions(): string[] {
    return Array.from(this.functionRegistry.keys()).sort();
  }

  /**
   * 計算統計情報を取得する
   */
  getCalculationStats(): {
    totalFunctions: number;
    customFunctions: number;
    volatileFunctionsEnabled: boolean;
    arrayFormulasEnabled: boolean;
  } {
    const customFunctionCount = Object.keys(this.options.customFunctions || {}).length;

    return {
      totalFunctions: this.functionRegistry.size,
      customFunctions: customFunctionCount,
      volatileFunctionsEnabled: this.options.enableVolatileFunctions || false,
      arrayFormulasEnabled: this.options.enableArrayFormulas || false
    };
  }
}

/**
 * デフォルトの計算コンテキストを作成する
 */
export function createCalculationContext(
  spreadsheet: Spreadsheet,
  options: Partial<CalculationContext> = {}
): CalculationContext {
  return {
    spreadsheet,
    getCurrentCellValue: (position: CellPosition) => {
      const cell = getCellFromSpreadsheet(spreadsheet, position);
      return cell?.rawValue || null;
    },
    getCalculatedCellValue: (position: CellPosition) => {
      const cell = getCellFromSpreadsheet(spreadsheet, position);
      return cell?.displayValue || null;
    },
    preventCircularReference: true,
    maxCalculationDepth: 100,
    currentDepth: 0,
    visitedCells: new Set(),
    ...options
  };
}

/**
 * デフォルトの数式計算機を作成する
 */
export function createFormulaCalculator(
  options?: AdvancedCalculationOptions
): FormulaCalculator {
  return new FormulaCalculator(options);
}