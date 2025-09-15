'use client'

import React, { useEffect, useRef, useCallback } from 'react';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  separator?: boolean;
  disabled?: boolean;
  action?: () => void;
  subItems?: ContextMenuItem[];
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  isOpen: boolean;
  onClose: () => void;
}

export function ContextMenu({ items, position, isOpen, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // クリック外でメニューを閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // メニュー位置の調整（画面端での表示を考慮）
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const { innerWidth, innerHeight } = window;

    let adjustedX = position.x;
    let adjustedY = position.y;

    // 右端チェック
    if (position.x + rect.width > innerWidth) {
      adjustedX = innerWidth - rect.width - 10;
    }

    // 下端チェック
    if (position.y + rect.height > innerHeight) {
      adjustedY = innerHeight - rect.height - 10;
    }

    menu.style.left = `${adjustedX}px`;
    menu.style.top = `${adjustedY}px`;
  }, [isOpen, position]);

  const handleItemClick = useCallback((item: ContextMenuItem) => {
    if (item.disabled) return;

    if (item.action) {
      item.action();
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white border border-gray-300 rounded-md shadow-lg py-1 min-w-[200px]"
      style={{
        left: position.x,
        top: position.y
      }}
    >
      {items.map((item, index) => {
        if (item.separator) {
          return <div key={`separator-${index}`} className="my-1 h-px bg-gray-200" />;
        }

        return (
          <MenuItem
            key={item.id}
            item={item}
            onClick={() => handleItemClick(item)}
          />
        );
      })}
    </div>
  );
}

interface MenuItemProps {
  item: ContextMenuItem;
  onClick: () => void;
}

function MenuItem({ item, onClick }: MenuItemProps) {
  const baseClasses = "px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-100 transition-colors cursor-pointer";
  const disabledClasses = "opacity-50 cursor-not-allowed hover:bg-transparent";

  return (
    <div
      className={`${baseClasses} ${item.disabled ? disabledClasses : ''}`}
      onClick={item.disabled ? undefined : onClick}
    >
      <div className="flex items-center space-x-2">
        {item.icon && <span className="text-base w-5">{item.icon}</span>}
        <span>{item.label}</span>
      </div>
      {item.shortcut && (
        <span className="text-xs text-gray-500 ml-8">{item.shortcut}</span>
      )}
    </div>
  );
}

// セル用のコンテキストメニューアイテム
export function getCellContextMenuItems(
  hasValue: boolean,
  hasClipboard: boolean,
  canUndo: boolean,
  canRedo: boolean
): ContextMenuItem[] {
  return [
    {
      id: 'cut',
      label: '切り取り',
      icon: '✂️',
      shortcut: 'Ctrl+X',
      action: () => console.log('Cut'),
      disabled: !hasValue
    },
    {
      id: 'copy',
      label: 'コピー',
      icon: '📋',
      shortcut: 'Ctrl+C',
      action: () => console.log('Copy'),
      disabled: !hasValue
    },
    {
      id: 'paste',
      label: '貼り付け',
      icon: '📄',
      shortcut: 'Ctrl+V',
      action: () => console.log('Paste'),
      disabled: !hasClipboard
    },
    {
      id: 'separator-1',
      separator: true
    },
    {
      id: 'undo',
      label: '元に戻す',
      icon: '↶',
      shortcut: 'Ctrl+Z',
      action: () => console.log('Undo'),
      disabled: !canUndo
    },
    {
      id: 'redo',
      label: 'やり直し',
      icon: '↷',
      shortcut: 'Ctrl+Y',
      action: () => console.log('Redo'),
      disabled: !canRedo
    },
    {
      id: 'separator-2',
      separator: true
    },
    {
      id: 'insert-row',
      label: '行を挿入',
      icon: '⬇',
      action: () => console.log('Insert row')
    },
    {
      id: 'insert-column',
      label: '列を挿入',
      icon: '➡',
      action: () => console.log('Insert column')
    },
    {
      id: 'delete-row',
      label: '行を削除',
      icon: '🗑',
      action: () => console.log('Delete row')
    },
    {
      id: 'delete-column',
      label: '列を削除',
      icon: '🗑',
      action: () => console.log('Delete column')
    },
    {
      id: 'separator-3',
      separator: true
    },
    {
      id: 'clear',
      label: 'セルをクリア',
      icon: '🧹',
      action: () => console.log('Clear cell'),
      disabled: !hasValue
    },
    {
      id: 'format',
      label: '書式設定...',
      icon: '🎨',
      action: () => console.log('Format cell')
    }
  ];
}