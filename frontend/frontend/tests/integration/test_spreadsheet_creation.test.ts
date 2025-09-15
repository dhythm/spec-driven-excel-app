import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import SpreadsheetApp from '../../src/components/SpreadsheetApp'

/**
 * 新規スプレッドシート作成シナリオの統合テスト
 * TDD REDフェーズ - これらのテストは現在実装がないため失敗します
 */
describe('スプレッドシート作成統合テスト', () => {
  beforeEach(() => {
    // LocalStorageをクリア
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('新規スプレッドシート作成フロー', () => {
    test('アプリケーション起動時にスプレッドシートが初期化される', async () => {
      // アプリケーションをレンダリング
      render(<SpreadsheetApp />)

      // スプレッドシートのメインコンテナが表示されることを確認
      const spreadsheetContainer = await waitFor(() =>
        screen.getByTestId('spreadsheet-container')
      )
      expect(spreadsheetContainer).toBeInTheDocument()

      // タイトルバーに「新しいスプレッドシート」が表示されることを確認
      const titleInput = screen.getByDisplayValue('新しいスプレッドシート')
      expect(titleInput).toBeInTheDocument()

      // グリッドが表示されることを確認
      const grid = screen.getByTestId('spreadsheet-grid')
      expect(grid).toBeInTheDocument()
    })

    test('デフォルトのグリッドサイズが正しく設定される', async () => {
      render(<SpreadsheetApp />)

      // 列ヘッダーA-Zが表示されることを確認
      await waitFor(() => {
        expect(screen.getByTestId('column-header-A')).toBeInTheDocument()
        expect(screen.getByTestId('column-header-Z')).toBeInTheDocument()
      })

      // 行ヘッダー1-100が表示されることを確認
      expect(screen.getByTestId('row-header-1')).toBeInTheDocument()
      expect(screen.getByTestId('row-header-100')).toBeInTheDocument()

      // セルA1が選択された状態で初期化されることを確認
      const cellA1 = screen.getByTestId('cell-A1')
      expect(cellA1).toHaveClass('selected')
    })

    test('セルクリックで選択状態が変更される', async () => {
      render(<SpreadsheetApp />)

      await waitFor(() => {
        const cellB2 = screen.getByTestId('cell-B2')
        fireEvent.click(cellB2)
      })

      // B2セルが選択されることを確認
      const cellB2 = screen.getByTestId('cell-B2')
      expect(cellB2).toHaveClass('selected')

      // A1セルの選択が解除されることを確認
      const cellA1 = screen.getByTestId('cell-A1')
      expect(cellA1).not.toHaveClass('selected')

      // セル参照がフォーミュラバーに表示されることを確認
      const formulaBar = screen.getByTestId('formula-bar')
      expect(formulaBar).toHaveTextContent('B2')
    })

    test('新規作成ボタンで空のスプレッドシートが作成される', async () => {
      render(<SpreadsheetApp />)

      // セルA1にデータを入力
      const cellA1 = await waitFor(() => screen.getByTestId('cell-A1'))
      fireEvent.doubleClick(cellA1)
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'テストデータ' } })
      fireEvent.key('Enter')

      // 新規作成ボタンをクリック
      const newButton = screen.getByTestId('new-spreadsheet-button')
      fireEvent.click(newButton)

      // 確認ダイアログが表示されることを確認
      const confirmDialog = await waitFor(() =>
        screen.getByTestId('confirm-new-dialog')
      )
      expect(confirmDialog).toBeInTheDocument()
      expect(confirmDialog).toHaveTextContent('現在の作業内容は失われます。続行しますか？')

      // 確認ボタンをクリック
      const confirmButton = screen.getByTestId('confirm-new-button')
      fireEvent.click(confirmButton)

      // 新しい空のスプレッドシートが作成されることを確認
      await waitFor(() => {
        const titleInput = screen.getByDisplayValue('新しいスプレッドシート')
        expect(titleInput).toBeInTheDocument()

        const emptyCellA1 = screen.getByTestId('cell-A1')
        expect(emptyCellA1).toHaveTextContent('')
      })
    })

    test('スプレッドシートのタイトルが編集可能である', async () => {
      render(<SpreadsheetApp />)

      const titleInput = await waitFor(() =>
        screen.getByDisplayValue('新しいスプレッドシート')
      )

      // タイトルを変更
      fireEvent.change(titleInput, { target: { value: 'マイスプレッドシート' } })
      fireEvent.blur(titleInput)

      // 変更されたタイトルが表示されることを確認
      await waitFor(() => {
        expect(screen.getByDisplayValue('マイスプレッドシート')).toBeInTheDocument()
      })

      // ドキュメントタイトルも更新されることを確認
      expect(document.title).toContain('マイスプレッドシート')
    })

    test('キーボードナビゲーションが動作する', async () => {
      render(<SpreadsheetApp />)

      // A1セルを選択してフォーカスを設定
      const cellA1 = await waitFor(() => screen.getByTestId('cell-A1'))
      fireEvent.click(cellA1)

      // 右矢印キーでB1に移動
      fireEvent.keyDown(cellA1, { key: 'ArrowRight', code: 'ArrowRight' })

      await waitFor(() => {
        const cellB1 = screen.getByTestId('cell-B1')
        expect(cellB1).toHaveClass('selected')
      })

      // 下矢印キーでB2に移動
      const cellB1 = screen.getByTestId('cell-B1')
      fireEvent.keyDown(cellB1, { key: 'ArrowDown', code: 'ArrowDown' })

      await waitFor(() => {
        const cellB2 = screen.getByTestId('cell-B2')
        expect(cellB2).toHaveClass('selected')
      })
    })
  })

  describe('エラーハンドリング', () => {
    test('無効なセル参照でもアプリケーションがクラッシュしない', async () => {
      render(<SpreadsheetApp />)

      // 存在しないセルをプログラム的に選択しようとする
      const gridContainer = await waitFor(() =>
        screen.getByTestId('spreadsheet-grid')
      )

      // 無効なセル座標でクリックをシミュレート
      fireEvent.click(gridContainer, {
        target: { dataset: { cell: 'ZZ999' } }
      })

      // アプリケーションが正常に動作し続けることを確認
      expect(screen.getByTestId('spreadsheet-container')).toBeInTheDocument()

      // エラーメッセージが表示されないことを確認
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    test('レンダリングエラー時にエラーバウンダリが動作する', async () => {
      // エラーを意図的に発生させるためのコンポーネントをモック
      const ErrorComponent = () => {
        throw new Error('テスト用エラー')
      }

      // エラーバウンダリがエラーをキャッチすることを確認
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        render(<ErrorComponent />)
      }).not.toThrow()

      consoleSpy.mockRestore()
    })
  })
})