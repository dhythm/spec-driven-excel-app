/**
 * 計算式モデル
 * セルに入力される数式。参照セル、演算子、関数名を持つ
 */

import { CellPosition, cellPositionToA1Notation, a1NotationToCellPosition } from './cell';

export enum FormulaOperator {
  ADD = '+',
  SUBTRACT = '-',
  MULTIPLY = '*',
  DIVIDE = '/',
  POWER = '^',
  EQUAL = '=',
  NOT_EQUAL = '<>',
  LESS_THAN = '<',
  LESS_THAN_OR_EQUAL = '<=',
  GREATER_THAN = '>',
  GREATER_THAN_OR_EQUAL = '>=',
}

export enum FormulaFunction {
  SUM = 'SUM',
  AVERAGE = 'AVERAGE',
  COUNT = 'COUNT',
  MIN = 'MIN',
  MAX = 'MAX',
  IF = 'IF',
  ROUND = 'ROUND',
  ABS = 'ABS',
  SQRT = 'SQRT',
  CONCATENATE = 'CONCATENATE',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  MID = 'MID',
  LEN = 'LEN',
  UPPER = 'UPPER',
  LOWER = 'LOWER',
  TODAY = 'TODAY',
  NOW = 'NOW',
}

export interface CellReference {
  position: CellPosition;
  isAbsolute: {
    row: boolean;
    column: boolean;
  };
  a1Notation: string;
}

export interface CellRange {
  start: CellPosition;
  end: CellPosition;
  a1Notation: string;
}

export interface FormulaToken {
  type: 'number' | 'string' | 'boolean' | 'cell_reference' | 'cell_range' | 'function' | 'operator' | 'parenthesis';
  value: string;
  position?: number;
}

export interface ParsedFormula {
  originalFormula: string;
  tokens: FormulaToken[];
  cellReferences: CellReference[];
  cellRanges: CellRange[];
  functions: FormulaFunction[];
  hasCircularReference: boolean;
  dependencies: CellPosition[];
}

export interface FormulaError {
  type: 'SYNTAX_ERROR' | 'CIRCULAR_REFERENCE' | 'INVALID_REFERENCE' | 'DIVISION_BY_ZERO' | 'VALUE_ERROR' | 'NAME_ERROR';
  message: string;
  position?: number;
}

export interface FormulaResult {
  value: string | number | boolean | Date;
  displayValue: string;
  error?: FormulaError;
  dependencies: CellPosition[];
}

/**
 * 数式を解析する関数
 */
export function parseFormula(formula: string): ParsedFormula {
  if (!formula.startsWith('=')) {
    throw new Error('数式は=で始まる必要があります');
  }

  const formulaBody = formula.slice(1); // =を除去
  const tokens = tokenizeFormula(formulaBody);
  const cellReferences = extractCellReferences(tokens);
  const cellRanges = extractCellRanges(tokens);
  const functions = extractFunctions(tokens);
  const dependencies = [...cellReferences.map(ref => ref.position)];

  // 循環参照チェック（簡易版）
  const hasCircularReference = false; // 実装は簡素化

  return {
    originalFormula: formula,
    tokens,
    cellReferences,
    cellRanges,
    functions,
    hasCircularReference,
    dependencies,
  };
}

/**
 * 数式をトークンに分解する関数
 */
export function tokenizeFormula(formula: string): FormulaToken[] {
  const tokens: FormulaToken[] = [];
  let current = '';
  let i = 0;

  while (i < formula.length) {
    const char = formula[i];

    if (char === ' ') {
      if (current) {
        tokens.push(createToken(current, i - current.length));
        current = '';
      }
      i++;
      continue;
    }

    if (isOperator(char)) {
      if (current) {
        tokens.push(createToken(current, i - current.length));
        current = '';
      }
      tokens.push({ type: 'operator', value: char, position: i });
      i++;
      continue;
    }

    if (char === '(' || char === ')') {
      if (current) {
        tokens.push(createToken(current, i - current.length));
        current = '';
      }
      tokens.push({ type: 'parenthesis', value: char, position: i });
      i++;
      continue;
    }

    current += char;
    i++;
  }

  if (current) {
    tokens.push(createToken(current, i - current.length));
  }

  return tokens;
}

/**
 * トークンを作成する関数
 */
function createToken(value: string, position: number): FormulaToken {
  // 数値の判定
  if (!isNaN(Number(value)) && value !== '') {
    return { type: 'number', value, position };
  }

  // 文字列の判定（クォートで囲まれている）
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return { type: 'string', value: value.slice(1, -1), position };
  }

  // ブール値の判定
  if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
    return { type: 'boolean', value: value.toLowerCase(), position };
  }

  // セル範囲の判定（A1:B2の形式）
  if (value.includes(':') && isCellRangeNotation(value)) {
    return { type: 'cell_range', value, position };
  }

  // セル参照の判定
  if (isCellReferenceNotation(value)) {
    return { type: 'cell_reference', value, position };
  }

  // 関数の判定
  if (Object.values(FormulaFunction).includes(value.toUpperCase() as FormulaFunction)) {
    return { type: 'function', value: value.toUpperCase(), position };
  }

  // デフォルトは文字列として扱う
  return { type: 'string', value, position };
}

/**
 * 演算子かどうかを判定する関数
 */
function isOperator(char: string): boolean {
  return Object.values(FormulaOperator).includes(char as FormulaOperator);
}

/**
 * セル参照記法かどうかを判定する関数
 */
function isCellReferenceNotation(value: string): boolean {
  // $A$1, A1, $A1, A$1 のパターンをサポート
  const pattern = /^\$?[A-Z]+\$?\d+$/;
  return pattern.test(value);
}

/**
 * セル範囲記法かどうかを判定する関数
 */
function isCellRangeNotation(value: string): boolean {
  const parts = value.split(':');
  return parts.length === 2 && parts.every(part => isCellReferenceNotation(part));
}

/**
 * トークンからセル参照を抽出する関数
 */
function extractCellReferences(tokens: FormulaToken[]): CellReference[] {
  return tokens
    .filter(token => token.type === 'cell_reference')
    .map(token => parseCellReference(token.value));
}

/**
 * トークンからセル範囲を抽出する関数
 */
function extractCellRanges(tokens: FormulaToken[]): CellRange[] {
  return tokens
    .filter(token => token.type === 'cell_range')
    .map(token => parseCellRange(token.value));
}

/**
 * トークンから関数を抽出する関数
 */
function extractFunctions(tokens: FormulaToken[]): FormulaFunction[] {
  return tokens
    .filter(token => token.type === 'function')
    .map(token => token.value as FormulaFunction);
}

/**
 * セル参照文字列を解析する関数
 */
function parseCellReference(reference: string): CellReference {
  const isAbsoluteRow = reference.includes('$') && reference.split('$').length === 3;
  const isAbsoluteColumn = reference.startsWith('$');

  // $記号を除去してA1記法に変換
  const cleanReference = reference.replace(/\$/g, '');
  const position = a1NotationToCellPosition(cleanReference);

  return {
    position,
    isAbsolute: {
      row: isAbsoluteRow,
      column: isAbsoluteColumn,
    },
    a1Notation: cleanReference,
  };
}

/**
 * セル範囲文字列を解析する関数
 */
function parseCellRange(range: string): CellRange {
  const [startRef, endRef] = range.split(':');
  const start = a1NotationToCellPosition(startRef.replace(/\$/g, ''));
  const end = a1NotationToCellPosition(endRef.replace(/\$/g, ''));

  return {
    start,
    end,
    a1Notation: range.replace(/\$/g, ''),
  };
}

/**
 * 基本的な数式を評価する関数（簡易実装）
 */
export function evaluateFormula(parsedFormula: ParsedFormula, getCellValue: (position: CellPosition) => any): FormulaResult {
  try {
    // 非常に簡易的な実装（実際にはより複雑なパーサーが必要）
    const tokens = parsedFormula.tokens;

    // 単純なSUM関数の例
    if (tokens.length >= 2 && tokens[0].type === 'function' && tokens[0].value === 'SUM') {
      const rangeToken = tokens.find(token => token.type === 'cell_range');
      if (rangeToken) {
        const range = parseCellRange(rangeToken.value);
        let sum = 0;

        for (let row = range.start.row; row <= range.end.row; row++) {
          for (let col = range.start.column; col <= range.end.column; col++) {
            const value = getCellValue({ row, column: col });
            if (typeof value === 'number') {
              sum += value;
            } else if (typeof value === 'string' && !isNaN(Number(value))) {
              sum += Number(value);
            }
          }
        }

        return {
          value: sum,
          displayValue: sum.toString(),
          dependencies: parsedFormula.dependencies,
        };
      }
    }

    // 単純な算術演算の例
    if (tokens.length === 3 && tokens[1].type === 'operator') {
      const left = parseTokenValue(tokens[0], getCellValue);
      const right = parseTokenValue(tokens[2], getCellValue);
      const operator = tokens[1].value;

      if (typeof left === 'number' && typeof right === 'number') {
        let result: number;
        switch (operator) {
          case '+':
            result = left + right;
            break;
          case '-':
            result = left - right;
            break;
          case '*':
            result = left * right;
            break;
          case '/':
            if (right === 0) {
              return {
                value: 0,
                displayValue: '#DIV/0!',
                error: { type: 'DIVISION_BY_ZERO', message: 'ゼロで除算しようとしました' },
                dependencies: parsedFormula.dependencies,
              };
            }
            result = left / right;
            break;
          default:
            throw new Error(`未サポートの演算子: ${operator}`);
        }

        return {
          value: result,
          displayValue: result.toString(),
          dependencies: parsedFormula.dependencies,
        };
      }
    }

    return {
      value: parsedFormula.originalFormula,
      displayValue: parsedFormula.originalFormula,
      dependencies: parsedFormula.dependencies,
    };

  } catch (error) {
    return {
      value: 0,
      displayValue: '#ERROR!',
      error: {
        type: 'SYNTAX_ERROR',
        message: error instanceof Error ? error.message : '構文エラー',
      },
      dependencies: parsedFormula.dependencies,
    };
  }
}

/**
 * トークンの値を解析する関数
 */
function parseTokenValue(token: FormulaToken, getCellValue: (position: CellPosition) => any): any {
  switch (token.type) {
    case 'number':
      return Number(token.value);
    case 'string':
      return token.value;
    case 'boolean':
      return token.value === 'true';
    case 'cell_reference':
      const ref = parseCellReference(token.value);
      return getCellValue(ref.position);
    default:
      return token.value;
  }
}

/**
 * 循環参照をチェックする関数
 */
export function checkCircularReference(
  currentCell: CellPosition,
  dependencies: CellPosition[],
  getAllFormulaDependencies: (position: CellPosition) => CellPosition[]
): boolean {
  const visited = new Set<string>();
  const stack = [currentCell];

  while (stack.length > 0) {
    const cell = stack.pop()!;
    const key = `${cell.row}-${cell.column}`;

    if (visited.has(key)) {
      return true; // 循環参照発見
    }

    visited.add(key);
    const cellDeps = getAllFormulaDependencies(cell);

    for (const dep of cellDeps) {
      if (dep.row === currentCell.row && dep.column === currentCell.column) {
        return true; // 循環参照発見
      }
      stack.push(dep);
    }
  }

  return false;
}

/**
 * 数式の妥当性を検証する関数
 */
export function validateFormula(formula: string): { isValid: boolean; errors: FormulaError[] } {
  const errors: FormulaError[] = [];

  if (!formula.startsWith('=')) {
    errors.push({
      type: 'SYNTAX_ERROR',
      message: '数式は=で始まる必要があります',
      position: 0,
    });
    return { isValid: false, errors };
  }

  try {
    const parsed = parseFormula(formula);

    // 基本的な構文チェック
    if (parsed.tokens.length === 0) {
      errors.push({
        type: 'SYNTAX_ERROR',
        message: '空の数式です',
      });
    }

    // 括弧の対応チェック
    const openParens = parsed.tokens.filter(t => t.value === '(').length;
    const closeParens = parsed.tokens.filter(t => t.value === ')').length;

    if (openParens !== closeParens) {
      errors.push({
        type: 'SYNTAX_ERROR',
        message: '括弧が対応していません',
      });
    }

  } catch (error) {
    errors.push({
      type: 'SYNTAX_ERROR',
      message: error instanceof Error ? error.message : '構文エラー',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}