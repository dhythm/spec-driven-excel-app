'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { CellPosition, cellPositionToA1Notation } from '../../lib/cell';

export interface FormulaBarProps {
  value: string;
  activeCell: CellPosition;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function FormulaBar({ value, activeCell, onChange, onSubmit }: FormulaBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // アクティブセルのA1記法
  const activeCellA1 = cellPositionToA1Notation(activeCell);

  // 値の変更ハンドラー
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
    },
    [onChange]
  );

  // キーダウンハンドラー
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      switch (event.key) {
        case 'Enter':
          event.preventDefault();
          onSubmit();
          if (inputRef.current) {
            inputRef.current.blur();
          }
          break;
        case 'Escape':
          event.preventDefault();
          if (inputRef.current) {
            inputRef.current.blur();
          }
          break;
        case 'Tab':
          event.preventDefault();
          onSubmit();
          break;
      }
    },
    [onSubmit]
  );

  // フォーカスハンドラー
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  // ブラーハンドラー
  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  // アクティブセル表示のクリックハンドラー
  const handleActiveCellClick = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // 確定ボタンのクリックハンドラー
  const handleSubmitClick = useCallback(() => {
    onSubmit();
  }, [onSubmit]);

  // キャンセルボタンのクリックハンドラー
  const handleCancelClick = useCallback(() => {
    onChange('');
    if (inputRef.current) {
      inputRef.current.blur();
    }
  }, [onChange]);

  return (
    <div className="flex items-center bg-white border-b border-gray-300 px-2 py-1 min-h-[32px]">
      {/* アクティブセル表示 */}
      <div
        className="flex-shrink-0 px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono cursor-pointer hover:bg-gray-200"
        onClick={handleActiveCellClick}
        title="アクティブセル"
      >
        {activeCellA1}
      </div>

      {/* アクション ボタン（編集中のみ表示） */}
      {isFocused && (
        <div className="flex-shrink-0 flex items-center ml-2 space-x-1">
          <button
            onClick={handleCancelClick}
            className="flex items-center justify-center w-6 h-6 text-red-600 hover:bg-red-50 rounded border border-gray-300"
            title="キャンセル (Esc)"
            type="button"
          >
            ✕
          </button>
          <button
            onClick={handleSubmitClick}
            className="flex items-center justify-center w-6 h-6 text-green-600 hover:bg-green-50 rounded border border-gray-300"
            title="確定 (Enter)"
            type="button"
          >
            ✓
          </button>
        </div>
      )}

      {/* フォーミュラ入力フィールド */}
      <div className="flex-1 ml-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            isFocused ? 'border-blue-500' : 'border-gray-300'
          }`}
          placeholder="数式を入力..."
          aria-label="数式入力バー"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {/* 数式関数ボタン（将来の拡張用） */}
      <div className="flex-shrink-0 ml-2">
        <button
          className="px-2 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
          title="関数"
          type="button"
          onClick={() => {
            // 関数選択メニューを開く（実装を簡素化）
            if (inputRef.current) {
              const currentValue = inputRef.current.value;
              if (!currentValue.startsWith('=')) {
                onChange('=');
              }
              inputRef.current.focus();
            }
          }}
        >
          fx
        </button>
      </div>
    </div>
  );
}