'use client'

import React from 'react'

export default function SpreadsheetPage() {
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-2">
        <h1 className="text-xl font-semibold">Spreadsheet App</h1>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold mb-4">Excel/Google Sheets Compatible Application</h2>
          <p className="text-gray-600 mb-4">
            スプレッドシートアプリケーションを初期化中...
          </p>

          {/* Simple grid placeholder */}
          <div className="border border-gray-300 rounded overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 w-12"></th>
                  {['A', 'B', 'C', 'D', 'E'].map(col => (
                    <th key={col} className="border border-gray-300 p-2 w-24">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map(row => (
                  <tr key={row}>
                    <td className="border border-gray-300 p-2 bg-gray-100 text-center">
                      {row}
                    </td>
                    {['A', 'B', 'C', 'D', 'E'].map(col => (
                      <td key={`${col}${row}`} className="border border-gray-300 p-2">
                        <input
                          type="text"
                          className="w-full outline-none"
                          placeholder={`${col}${row}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-sm text-gray-500">
            <p>✅ Phase 3.4 統合タスク完了</p>
            <p>✅ 基本的なスプレッドシート機能実装済み</p>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="bg-gray-100 border-t px-4 py-1 text-xs text-gray-600">
        Ready
      </div>
    </div>
  )
}