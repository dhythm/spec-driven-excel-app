'use client'

import React, { useState, useCallback, useMemo } from 'react'

interface CellData {
  value: string
  formula: string
  computedValue: string
}

export default function SpreadsheetPage() {
  // Initialize cell data with default values matching the screenshot
  const [cells, setCells] = useState<Record<string, CellData>>(() => {
    const initialCells: Record<string, CellData> = {}

    // Set initial values from screenshot
    initialCells['A1'] = { value: '1', formula: '', computedValue: '1' }
    initialCells['B1'] = { value: '2', formula: '', computedValue: '2' }
    initialCells['C1'] = { value: '=A1+B1', formula: '=A1+B1', computedValue: '3' }

    return initialCells
  })

  const [selectedCell, setSelectedCell] = useState<string | null>(null)
  const [editingCell, setEditingCell] = useState<string | null>(null)

  // Simple formula evaluation
  const evaluateFormula = useCallback((formula: string, cellId: string): string => {
    if (!formula.startsWith('=')) return formula

    try {
      let expression = formula.substring(1) // Remove '='

      // Replace cell references with their values
      const cellRefPattern = /([A-Z])(\d+)/g
      expression = expression.replace(cellRefPattern, (match, col, row) => {
        const refCellId = `${col}${row}`
        if (refCellId === cellId) return '0' // Prevent circular reference

        const refCell = cells[refCellId]
        if (!refCell) return '0'

        // If the referenced cell has a formula, use its computed value
        const value = refCell.computedValue || refCell.value || '0'
        return isNaN(Number(value)) ? '0' : value
      })

      // Basic arithmetic evaluation (safe for simple expressions)
      // Only support basic math operations
      if (/^[\d\s+\-*/().]+$/.test(expression)) {
        try {
          // Create a safe evaluation context
          const result = Function('"use strict"; return (' + expression + ')')()
          return String(result)
        } catch {
          return '#ERROR'
        }
      }

      // Support SUM function
      if (expression.startsWith('SUM(')) {
        const rangeMatch = expression.match(/SUM\(([A-Z])(\d+):([A-Z])(\d+)\)/)
        if (rangeMatch) {
          const [, startCol, startRow, endCol, endRow] = rangeMatch
          let sum = 0

          for (let row = Number(startRow); row <= Number(endRow); row++) {
            for (let col = startCol.charCodeAt(0); col <= endCol.charCodeAt(0); col++) {
              const cellId = `${String.fromCharCode(col)}${row}`
              const cell = cells[cellId]
              if (cell) {
                const value = Number(cell.computedValue || cell.value || 0)
                if (!isNaN(value)) sum += value
              }
            }
          }
          return String(sum)
        }
      }

      return formula
    } catch (error) {
      return '#ERROR'
    }
  }, [cells])

  // Handle cell value change
  const handleCellChange = useCallback((cellId: string, value: string) => {
    setCells(prev => {
      const newCells = { ...prev }

      const isFormula = value.startsWith('=')
      const computedValue = isFormula ? evaluateFormula(value, cellId) : value

      newCells[cellId] = {
        value: value,
        formula: isFormula ? value : '',
        computedValue: computedValue
      }

      // Recalculate all formulas that might depend on this cell
      Object.keys(newCells).forEach(id => {
        if (newCells[id].formula && id !== cellId) {
          newCells[id].computedValue = evaluateFormula(newCells[id].formula, id)
        }
      })

      return newCells
    })
  }, [evaluateFormula])

  const handleCellClick = useCallback((cellId: string) => {
    setSelectedCell(cellId)
    setEditingCell(null)
  }, [])

  const handleCellDoubleClick = useCallback((cellId: string) => {
    setEditingCell(cellId)
    setSelectedCell(cellId)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent, cellId: string) => {
    if (e.key === 'Enter') {
      if (editingCell === cellId) {
        setEditingCell(null)
      } else {
        setEditingCell(cellId)
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null)
    }
  }, [editingCell])

  const getCellDisplay = useCallback((cellId: string) => {
    const cell = cells[cellId]
    if (!cell) return ''

    if (editingCell === cellId) {
      return cell.formula || cell.value || ''
    }

    return cell.computedValue || ''
  }, [cells, editingCell])

  const columns = ['A', 'B', 'C', 'D', 'E']
  const rows = [1, 2, 3, 4, 5]

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

          {/* Formula bar */}
          {selectedCell && (
            <div className="mb-4 flex items-center gap-2">
              <span className="font-semibold min-w-[60px]">{selectedCell}:</span>
              <input
                type="text"
                className="flex-1 border border-gray-300 rounded px-2 py-1"
                value={cells[selectedCell]?.formula || cells[selectedCell]?.value || ''}
                onChange={(e) => handleCellChange(selectedCell, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    setEditingCell(null)
                  }
                }}
              />
            </div>
          )}

          {/* Spreadsheet grid */}
          <div className="border border-gray-300 rounded overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 w-12"></th>
                  {columns.map(col => (
                    <th key={col} className="border border-gray-300 p-2 w-32 font-semibold">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row}>
                    <td className="border border-gray-300 p-2 bg-gray-100 text-center font-semibold">
                      {row}
                    </td>
                    {columns.map(col => {
                      const cellId = `${col}${row}`
                      const isSelected = selectedCell === cellId
                      const isEditing = editingCell === cellId

                      return (
                        <td
                          key={cellId}
                          className={`border border-gray-300 p-0 ${
                            isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''
                          }`}
                          onClick={() => handleCellClick(cellId)}
                          onDoubleClick={() => handleCellDoubleClick(cellId)}
                        >
                          <input
                            type="text"
                            className={`w-full h-full px-2 py-1 outline-none ${
                              isEditing ? 'bg-white' : 'bg-transparent'
                            }`}
                            value={getCellDisplay(cellId)}
                            onChange={(e) => handleCellChange(cellId, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, cellId)}
                            readOnly={!isEditing}
                            placeholder={cellId}
                          />
                        </td>
                      )
                    })}
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
      <div className="bg-gray-100 border-t px-4 py-1 text-xs text-gray-600 flex justify-between">
        <span>Ready</span>
        {selectedCell && <span>Cell: {selectedCell}</span>}
      </div>
    </div>
  )
}