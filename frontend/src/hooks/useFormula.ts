/**
 * useFormula (T047) - 数式計算フック
 * セルの数式解析、計算実行、依存関係管理機能を提供
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  parseFormula,
  evaluateFormula,
  validateFormula,
  checkCircularReference,
  ParsedFormula,
  FormulaResult,
  FormulaError
} from '../lib/formula';
import { CellPosition } from '../lib/cell';
import { FormulaEngine } from '../lib/formula-engine';

interface UseFormulaOptions {
  getCellValue?: (position: CellPosition) => any;
  onFormulaChange?: (formula: string, result: FormulaResult) => void;
  onError?: (error: FormulaError) => void;
  enableCircularReferenceCheck?: boolean;
  maxCalculationDepth?: number;
  autoRecalculate?: boolean;
}

interface UseFormulaReturn {
  // 現在の状態
  formula: string;
  parsedFormula: ParsedFormula | null;
  result: FormulaResult | null;
  error: FormulaError | null;
  isCalculating: boolean;
  isValid: boolean;

  // 依存関係
  dependencies: CellPosition[];
  dependents: CellPosition[];
  hasCircularReference: boolean;

  // 操作
  setFormula: (formula: string) => void;
  calculate: () => Promise<FormulaResult | null>;
  recalculate: () => Promise<void>;
  clearFormula: () => void;

  // バリデーション
  validate: () => boolean;

  // 依存関係管理
  addDependent: (position: CellPosition) => void;
  removeDependent: (position: CellPosition) => void;
  updateDependencies: () => void;

  // その他
  getFormulaText: () => string;
  getResultValue: () => any;
  getResultDisplay: () => string;
  reset: () => void;
}

const DEFAULT_OPTIONS: UseFormulaOptions = {
  enableCircularReferenceCheck: true,
  maxCalculationDepth: 100,
  autoRecalculate: true,
};

export function useFormula(
  initialFormula: string = '',
  currentPosition?: CellPosition,
  options: UseFormulaOptions = {}
): UseFormulaReturn {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const formulaEngine = useRef(new FormulaEngine()).current;

  // 状態管理
  const [formula, setFormulaState] = useState(initialFormula);
  const [parsedFormula, setParsedFormula] = useState<ParsedFormula | null>(null);
  const [result, setResult] = useState<FormulaResult | null>(null);
  const [error, setError] = useState<FormulaError | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [dependents, setDependents] = useState<CellPosition[]>([]);
  const [calculationDepth, setCalculationDepth] = useState(0);

  // 計算されたプロパティ
  const isValid = useMemo(() => error === null, [error]);
  const dependencies = useMemo(() => parsedFormula?.dependencies || [], [parsedFormula]);
  const hasCircularReference = useMemo(() =>
    parsedFormula?.hasCircularReference || false,
    [parsedFormula]
  );

  // 数式の解析
  const parseFormulaString = useCallback((formulaStr: string) => {
    if (!formulaStr || !formulaStr.startsWith('=')) {
      setParsedFormula(null);
      setError(null);
      return null;
    }

    try {
      const parsed = parseFormula(formulaStr);

      // 循環参照チェック
      if (mergedOptions.enableCircularReferenceCheck && currentPosition) {
        const hasCircular = checkCircularReference(
          currentPosition,
          parsed.dependencies,
          (pos) => formulaEngine.getDependencies(pos)
        );
        parsed.hasCircularReference = hasCircular;
      }

      setParsedFormula(parsed);
      setError(null);
      return parsed;
    } catch (err) {
      const formulaError: FormulaError = {
        type: 'SYNTAX_ERROR',
        message: err instanceof Error ? err.message : '数式解析エラー'
      };
      setError(formulaError);
      setParsedFormula(null);

      if (mergedOptions.onError) {
        mergedOptions.onError(formulaError);
      }

      return null;
    }
  }, [currentPosition, mergedOptions, formulaEngine]);

  // 数式を設定
  const setFormula = useCallback((newFormula: string) => {
    setFormulaState(newFormula);

    if (newFormula) {
      parseFormulaString(newFormula);
    } else {
      setParsedFormula(null);
      setResult(null);
      setError(null);
    }
  }, [parseFormulaString]);

  // 計算実行
  const calculate = useCallback(async (): Promise<FormulaResult | null> => {
    if (!parsedFormula || isCalculating) {
      return null;
    }

    // 循環参照チェック
    if (parsedFormula.hasCircularReference) {
      const circularError: FormulaError = {
        type: 'CIRCULAR_REFERENCE',
        message: '循環参照が検出されました'
      };
      setError(circularError);
      if (mergedOptions.onError) {
        mergedOptions.onError(circularError);
      }
      return null;
    }

    // 計算の深度チェック
    if (calculationDepth >= (mergedOptions.maxCalculationDepth || 100)) {
      const depthError: FormulaError = {
        type: 'VALUE_ERROR',
        message: '計算の深度が最大値を超えました'
      };
      setError(depthError);
      if (mergedOptions.onError) {
        mergedOptions.onError(depthError);
      }
      return null;
    }

    setIsCalculating(true);
    setCalculationDepth(prev => prev + 1);

    try {
      // セル値取得関数のデフォルト実装
      const getCellValue = mergedOptions.getCellValue || ((pos: CellPosition) => {
        // formulaEngineまたはデフォルト値を使用
        return formulaEngine.getCellValue(pos) || '';
      });

      const calculationResult = evaluateFormula(parsedFormula, getCellValue);

      setResult(calculationResult);
      setError(calculationResult.error || null);

      if (mergedOptions.onFormulaChange) {
        mergedOptions.onFormulaChange(formula, calculationResult);
      }

      if (calculationResult.error && mergedOptions.onError) {
        mergedOptions.onError(calculationResult.error);
      }

      return calculationResult;

    } catch (err) {
      const calculationError: FormulaError = {
        type: 'VALUE_ERROR',
        message: err instanceof Error ? err.message : '計算エラー'
      };

      setError(calculationError);
      if (mergedOptions.onError) {
        mergedOptions.onError(calculationError);
      }

      return null;
    } finally {
      setIsCalculating(false);
      setCalculationDepth(prev => Math.max(0, prev - 1));
    }
  }, [
    parsedFormula,
    isCalculating,
    calculationDepth,
    formula,
    mergedOptions,
    formulaEngine
  ]);

  // 再計算
  const recalculate = useCallback(async () => {
    if (formula) {
      parseFormulaString(formula);
      await calculate();
    }
  }, [formula, parseFormulaString, calculate]);

  // 数式をクリア
  const clearFormula = useCallback(() => {
    setFormulaState('');
    setParsedFormula(null);
    setResult(null);
    setError(null);
    setDependents([]);
  }, []);

  // バリデーション
  const validate = useCallback(() => {
    if (!formula) return true;

    const validationResult = validateFormula(formula);
    if (!validationResult.isValid && validationResult.errors.length > 0) {
      setError(validationResult.errors[0]);
      return false;
    }

    return true;
  }, [formula]);

  // 依存関係を持つセルを追加
  const addDependent = useCallback((position: CellPosition) => {
    setDependents(prev => {
      const exists = prev.some(dep =>
        dep.row === position.row && dep.column === position.column
      );

      if (!exists) {
        return [...prev, position];
      }
      return prev;
    });
  }, []);

  // 依存関係を持つセルを削除
  const removeDependent = useCallback((position: CellPosition) => {
    setDependents(prev =>
      prev.filter(dep =>
        !(dep.row === position.row && dep.column === position.column)
      )
    );
  }, []);

  // 依存関係を更新
  const updateDependencies = useCallback(() => {
    if (parsedFormula && currentPosition) {
      // 数式エンジンに依存関係を登録
      formulaEngine.updateDependencies(currentPosition, parsedFormula.dependencies);
    }
  }, [parsedFormula, currentPosition, formulaEngine]);

  // 数式テキストを取得
  const getFormulaText = useCallback(() => {
    return formula;
  }, [formula]);

  // 結果値を取得
  const getResultValue = useCallback(() => {
    return result?.value;
  }, [result]);

  // 結果表示値を取得
  const getResultDisplay = useCallback(() => {
    return result?.displayValue || '';
  }, [result]);

  // リセット
  const reset = useCallback(() => {
    clearFormula();
    setCalculationDepth(0);
  }, [clearFormula]);

  // 初期化時の解析
  useEffect(() => {
    if (initialFormula) {
      parseFormulaString(initialFormula);
    }
  }, [initialFormula, parseFormulaString]);

  // 数式変更時の自動計算
  useEffect(() => {
    if (mergedOptions.autoRecalculate && parsedFormula && !error) {
      calculate();
    }
  }, [parsedFormula, error, calculate, mergedOptions.autoRecalculate]);

  // 依存関係の更新
  useEffect(() => {
    if (parsedFormula) {
      updateDependencies();
    }
  }, [parsedFormula, updateDependencies]);

  return {
    // 現在の状態
    formula,
    parsedFormula,
    result,
    error,
    isCalculating,
    isValid,

    // 依存関係
    dependencies,
    dependents,
    hasCircularReference,

    // 操作
    setFormula,
    calculate,
    recalculate,
    clearFormula,

    // バリデーション
    validate,

    // 依存関係管理
    addDependent,
    removeDependent,
    updateDependencies,

    // その他
    getFormulaText,
    getResultValue,
    getResultDisplay,
    reset,
  };
}