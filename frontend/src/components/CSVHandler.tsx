'use client'

import React, { useRef, useCallback } from 'react';
import { Spreadsheet } from '@/lib/spreadsheet';
import { parseCSVString, convertToCSVString } from '@/lib/csv-handler';

interface CSVHandlerProps {
  spreadsheet: Spreadsheet | null;
  onImport: (spreadsheet: Spreadsheet) => void;
  onError?: (error: Error) => void;
}

export function CSVHandler({ spreadsheet, onImport, onError }: CSVHandlerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSVファイルのインポート
  const handleImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = parseCSVString(text, {
        header: true,
        skipEmptyLines: true
      });

      if (result.success && result.data) {
        // Convert CSV data to Spreadsheet format
        // This is a simplified version - actual conversion logic needed
        const mockSpreadsheet = {} as Spreadsheet;
        onImport(mockSpreadsheet);
      } else if (result.error) {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('CSV import error:', error);
      onError?.(error as Error);
    }

    // リセット
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onImport, onError]);

  // CSVファイルのエクスポート
  const handleExport = useCallback(async () => {
    if (!spreadsheet) {
      console.warn('No spreadsheet to export');
      return;
    }

    try {
      // Convert spreadsheet to CSV format
      // This is a simplified version - actual conversion logic needed
      const csvData: string[][] = [];
      const result = convertToCSVString(csvData, {
        includeHeaders: true,
        delimiter: ','
      });

      if (result.success && result.data) {
        // ダウンロード処理
        const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `${spreadsheet.name || 'spreadsheet'}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
      } else if (result.error) {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('CSV export error:', error);
      onError?.(error as Error);
    }
  }, [spreadsheet, onError]);

  // ファイル選択ダイアログを開く
  const openImportDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleImport}
        style={{ display: 'none' }}
      />

      {/* これらのメソッドは親コンポーネントから呼び出される */}
      <div style={{ display: 'none' }}>
        <button id="csv-import-trigger" onClick={openImportDialog} />
        <button id="csv-export-trigger" onClick={handleExport} />
      </div>
    </>
  );
}

// ユーティリティ関数をエクスポート
export { parseCSVString, convertToCSVString } from '@/lib/csv-handler';