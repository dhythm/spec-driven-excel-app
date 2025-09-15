'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useSpreadsheet } from '@/hooks/useSpreadsheet'
import { useSelection } from '@/hooks/useSelection'
import { useHistory } from '@/hooks/useHistory'
import { useClipboard } from '@/hooks/useClipboard'
import { useFormula } from '@/hooks/useFormula'
import { Spreadsheet } from '@/lib/spreadsheet'
import { createSpreadsheet } from '@/lib/spreadsheet-core'
import { initializeFormulaEngine } from '@/lib/formula-engine'
import { loadFromStorage, saveToStorage, enableAutoSave } from '@/lib/storage-manager'

// Dynamic imports for performance
const SpreadsheetApp = dynamic(() => import('@/components/SpreadsheetApp'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-screen">Loading spreadsheet...</div>
})

export default function SpreadsheetPage() {
  const [isClient, setIsClient] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null)

  // Initialize hooks
  const {
    spreadsheet,
    setSpreadsheet,
    updateCell,
    addRow,
    addColumn,
    deleteRow,
    deleteColumn,
    isModified,
    resetModified
  } = useSpreadsheet()

  const {
    selection,
    activeCell,
    selectCell,
    selectRange,
    moveSelection,
    clearSelection
  } = useSelection()

  const {
    history,
    canUndo,
    canRedo,
    undo,
    redo,
    addToHistory,
    clearHistory
  } = useHistory()

  const {
    clipboardData,
    copy,
    cut,
    paste,
    hasClipboardData
  } = useClipboard()

  const {
    calculateFormula,
    validateFormula,
    getDependencies,
    getFormulaCells,
    recalculate
  } = useFormula()

  // Initialize client-side only features
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Load spreadsheet from storage or create new
  useEffect(() => {
    const initializeSpreadsheet = async () => {
      try {
        setIsLoading(true)

        // Check if there's a saved spreadsheet
        const savedSpreadsheets = await loadFromStorage()
        let loadedSpreadsheet: Spreadsheet | null = null

        if (savedSpreadsheets && savedSpreadsheets.length > 0) {
          // Load the most recent spreadsheet
          loadedSpreadsheet = savedSpreadsheets[0]
        }

        if (!loadedSpreadsheet) {
          // Create a new spreadsheet
          const result = createSpreadsheet({
            name: 'New Spreadsheet',
            rows: 100,
            columns: 26
          })

          if (result.success && result.data) {
            loadedSpreadsheet = result.data
          }
        }

        if (loadedSpreadsheet) {
          setSpreadsheet(loadedSpreadsheet)

          // Initialize formula engine
          await initializeFormulaEngine()
        }
      } catch (err) {
        console.error('Failed to initialize spreadsheet:', err)
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    if (isClient) {
      initializeSpreadsheet()
    }
  }, [isClient, setSpreadsheet])

  // T066: Auto-save implementation (3 seconds after modification)
  useEffect(() => {
    if (!autoSaveEnabled || !spreadsheet || !isModified) return

    const saveTimeout = setTimeout(async () => {
      try {
        await saveToStorage(spreadsheet)
        setLastSaveTime(new Date())
        resetModified()
        console.log('Auto-saved at', new Date().toISOString())
      } catch (err) {
        console.error('Auto-save failed:', err)
      }
    }, 3000)

    return () => clearTimeout(saveTimeout)
  }, [spreadsheet, isModified, autoSaveEnabled, resetModified])

  // T068: Keyboard shortcuts implementation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modifier = isMac ? e.metaKey : e.ctrlKey

      // Prevent default for our shortcuts
      if (modifier) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault()
            if (e.shiftKey) {
              if (canRedo) redo()
            } else {
              if (canUndo) undo()
            }
            break
          case 'y':
            e.preventDefault()
            if (canRedo) redo()
            break
          case 'c':
            e.preventDefault()
            if (selection) copy(selection)
            break
          case 'x':
            e.preventDefault()
            if (selection) cut(selection)
            break
          case 'v':
            e.preventDefault()
            if (hasClipboardData && activeCell) {
              paste(activeCell.address)
            }
            break
          case 's':
            e.preventDefault()
            handleSave()
            break
          case 'a':
            e.preventDefault()
            selectAll()
            break
        }
      }

      // Arrow key navigation (without modifier)
      if (!modifier && !e.shiftKey) {
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault()
            moveSelection('up')
            break
          case 'ArrowDown':
            e.preventDefault()
            moveSelection('down')
            break
          case 'ArrowLeft':
            e.preventDefault()
            moveSelection('left')
            break
          case 'ArrowRight':
            e.preventDefault()
            moveSelection('right')
            break
          case 'Enter':
            if (!e.shiftKey) {
              e.preventDefault()
              moveSelection('down')
            }
            break
          case 'Tab':
            e.preventDefault()
            moveSelection(e.shiftKey ? 'left' : 'right')
            break
        }
      }
    }

    if (isClient) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    isClient,
    canUndo,
    canRedo,
    undo,
    redo,
    copy,
    cut,
    paste,
    selection,
    activeCell,
    hasClipboardData,
    moveSelection
  ])

  // Helper functions
  const handleSave = useCallback(async () => {
    if (!spreadsheet) return

    try {
      await saveToStorage(spreadsheet)
      setLastSaveTime(new Date())
      resetModified()
      console.log('Manually saved at', new Date().toISOString())
    } catch (err) {
      console.error('Save failed:', err)
      setError(err as Error)
    }
  }, [spreadsheet, resetModified])

  const selectAll = useCallback(() => {
    if (!spreadsheet) return

    selectRange({
      start: { row: 0, column: 0, address: 'A1' },
      end: {
        row: spreadsheet.gridSize.rowCount - 1,
        column: spreadsheet.gridSize.columnCount - 1,
        address: `${String.fromCharCode(65 + spreadsheet.gridSize.columnCount - 1)}${spreadsheet.gridSize.rowCount}`
      }
    })
  }, [spreadsheet, selectRange])

  // T067: Error boundary implementation
  const ErrorFallback = ({ error, resetError }: { error: Error; resetError: () => void }) => (
    <div className="flex flex-col items-center justify-center h-screen p-8">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
        <h2 className="text-xl font-semibold text-red-800 mb-2">Something went wrong</h2>
        <p className="text-red-600 mb-4">{error.message}</p>
        <button
          onClick={resetError}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    </div>
  )

  // Loading state
  if (!isClient || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading spreadsheet...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return <ErrorFallback error={error} resetError={() => setError(null)} />
  }

  // Main render
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header with save status */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold">
            {spreadsheet?.name || 'Spreadsheet'}
          </h1>
          {lastSaveTime && (
            <span className="text-sm text-gray-500">
              Last saved: {lastSaveTime.toLocaleTimeString()}
            </span>
          )}
          {isModified && (
            <span className="text-sm text-yellow-600">Unsaved changes</span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoSaveEnabled}
              onChange={(e) => setAutoSaveEnabled(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm">Auto-save</span>
          </label>
          <button
            onClick={handleSave}
            disabled={!isModified}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>

      {/* Main spreadsheet app */}
      <div className="flex-1 overflow-hidden">
        <SpreadsheetApp
          spreadsheet={spreadsheet}
          selection={selection}
          activeCell={activeCell}
          onCellUpdate={updateCell}
          onCellSelect={selectCell}
          onRangeSelect={selectRange}
          onAddRow={addRow}
          onAddColumn={addColumn}
          onDeleteRow={deleteRow}
          onDeleteColumn={deleteColumn}
          onCopy={() => selection && copy(selection)}
          onCut={() => selection && cut(selection)}
          onPaste={() => activeCell && hasClipboardData && paste(activeCell.address)}
          onUndo={canUndo ? undo : undefined}
          onRedo={canRedo ? redo : undefined}
          onHistoryAdd={addToHistory}
          clipboardData={clipboardData}
          canUndo={canUndo}
          canRedo={canRedo}
        />
      </div>

      {/* Status bar */}
      <div className="bg-gray-100 border-t px-4 py-1 text-xs text-gray-600 flex items-center justify-between">
        <div>
          {activeCell && (
            <span>
              Cell: {activeCell.address} |
              {selection && ` Selected: ${selection.type}`}
            </span>
          )}
        </div>
        <div>
          Ready
        </div>
      </div>
    </div>
  )
}