'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CellPosition } from '../../lib/cell';

export interface CellEditorProps {
  position: CellPosition;
  initialValue: string;
  value: string;
  style?: React.CSSProperties;
  onComplete: (value: string) => void;
  onCancel: () => void;
}

export function CellEditor({
  position,
  initialValue,
  value: externalValue,
  style,
  onComplete,
  onCancel,
}: CellEditorProps) {
  const [internalValue, setInternalValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 複数行の入力かどうかを判定
  const isMultiline = internalValue.includes('\n') || internalValue.length > 50;

  // 外部からの値の変更を反映
  useEffect(() => {
    setInternalValue(externalValue);
  }, [externalValue]);

  // マウント時にフォーカスを設定し、テキストを全選択
  useEffect(() => {
    const element = isMultiline ? textareaRef.current : inputRef.current;
    if (element) {
      element.focus();
      element.select();
    }
  }, [isMultiline]);

  // 値の変更ハンドラー
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInternalValue(event.target.value);
    },
    []
  );

  // キーダウンハンドラー
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      switch (event.key) {
        case 'Enter':
          if (!event.shiftKey || !isMultiline) {
            event.preventDefault();
            onComplete(internalValue);
          }
          break;
        case 'Escape':
          event.preventDefault();
          onCancel();
          break;
        case 'Tab':
          event.preventDefault();
          onComplete(internalValue);
          break;
      }
    },
    [internalValue, isMultiline, onComplete, onCancel]
  );

  // フォーカスアウトハンドラー
  const handleBlur = useCallback(() => {
    // 少し遅延させて、他の要素がクリックされた場合の処理を優先
    setTimeout(() => {
      onComplete(internalValue);
    }, 100);
  }, [internalValue, onComplete]);

  // エディターのスタイルを生成
  const getEditorStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      ...style,
      position: 'absolute',
      zIndex: 1000,
      border: '2px solid #1976d2',
      borderRadius: '2px',
      outline: 'none',
      padding: '2px 4px',
      fontSize: '12px',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#ffffff',
      color: '#000000',
      boxSizing: 'border-box',
    };

    if (isMultiline) {
      baseStyle.minHeight = '60px';
      baseStyle.resize = 'both' as const;
    }

    return baseStyle;
  };

  // 単一行入力
  if (!isMultiline) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={internalValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        style={getEditorStyle()}
        aria-label={`セル編集 ${String.fromCharCode(65 + position.column)}${position.row + 1}`}
        autoComplete="off"
        spellCheck={false}
      />
    );
  }

  // 複数行入力
  return (
    <textarea
      ref={textareaRef}
      value={internalValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      style={getEditorStyle()}
      aria-label={`セル編集 ${String.fromCharCode(65 + position.column)}${position.row + 1}`}
      spellCheck={false}
      rows={Math.min(Math.max(internalValue.split('\n').length, 2), 10)}
    />
  );
}