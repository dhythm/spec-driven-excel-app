import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SpreadsheetApp } from '@/components/SpreadsheetApp'

/**
 * CSVインポート/エクスポートフローの統合テスト
 * TDD REDフェーズ - これらのテストは現在実装がないため失敗します
 */
describe('CSV インポート/エクスポート統合テスト', () => {
  beforeEach(() => {
    localStorage.clear()
    // ファイルAPIのモック設定
    global.URL.createObjectURL = jest.fn()
    global.URL.revokeObjectURL = jest.fn()
  })

  afterEach(() => {
    localStorage.clear()
    jest.resetAllMocks()
  })

  describe('CSVインポートフロー', () => {
    test('CSVファイル選択ダイアログが開く', async () => {
      render(<SpreadsheetApp />)

      // インポートボタンをクリック
      const importButton = await waitFor(() =>
        screen.getByTestId('import-csv-button')
      )
      fireEvent.click(importButton)

      // ファイル選択ダイアログが表示されることを確認
      const fileInput = await waitFor(() =>
        screen.getByTestId('csv-file-input')
      )
      expect(fileInput).toBeInTheDocument()
      expect(fileInput).toHaveAttribute('type', 'file')
      expect(fileInput).toHaveAttribute('accept', '.csv')
    })

    test('基本的なCSVデータをインポート', async () => {
      render(<SpreadsheetApp />)

      // CSVデータを準備
      const csvData = 'Name,Age,City\nTaro,25,Tokyo\nHanako,30,Osaka\nJiro,35,Kyoto'
      const csvFile = new File([csvData], 'test.csv', { type: 'text/csv' })

      // ファイルをアップロード
      const importButton = screen.getByTestId('import-csv-button')
      fireEvent.click(importButton)

      const fileInput = await waitFor(() =>
        screen.getByTestId('csv-file-input')
      )
      fireEvent.change(fileInput, { target: { files: [csvFile] } })

      // データがグリッドに読み込まれることを確認
      await waitFor(() => {
        expect(screen.getByTestId('cell-A1')).toHaveTextContent('Name')
        expect(screen.getByTestId('cell-B1')).toHaveTextContent('Age')
        expect(screen.getByTestId('cell-C1')).toHaveTextContent('City')

        expect(screen.getByTestId('cell-A2')).toHaveTextContent('Taro')
        expect(screen.getByTestId('cell-B2')).toHaveTextContent('25')
        expect(screen.getByTestId('cell-C2')).toHaveTextContent('Tokyo')

        expect(screen.getByTestId('cell-A3')).toHaveTextContent('Hanako')
        expect(screen.getByTestId('cell-B3')).toHaveTextContent('30')
        expect(screen.getByTestId('cell-C3')).toHaveTextContent('Osaka')
      })

      // インポート成功メッセージが表示されることを確認
      const successMessage = screen.getByTestId('import-success-message')
      expect(successMessage).toBeInTheDocument()
      expect(successMessage).toHaveTextContent('CSVファイルが正常にインポートされました')
    })

    test('日本語を含むCSVデータのインポート', async () => {
      render(<SpreadsheetApp />)

      const csvData = '商品名,価格,カテゴリー\nりんご,100,果物\nみかん,80,果物\nキャベツ,200,野菜'
      const csvFile = new File([csvData], 'products.csv', { type: 'text/csv' })

      const importButton = screen.getByTestId('import-csv-button')
      fireEvent.click(importButton)

      const fileInput = await waitFor(() =>
        screen.getByTestId('csv-file-input')
      )
      fireEvent.change(fileInput, { target: { files: [csvFile] } })

      // 日本語データが正しく読み込まれることを確認
      await waitFor(() => {
        expect(screen.getByTestId('cell-A1')).toHaveTextContent('商品名')
        expect(screen.getByTestId('cell-B1')).toHaveTextContent('価格')
        expect(screen.getByTestId('cell-C1')).toHaveTextContent('カテゴリー')

        expect(screen.getByTestId('cell-A2')).toHaveTextContent('りんご')
        expect(screen.getByTestId('cell-C2')).toHaveTextContent('果物')
      })
    })

    test('カンマを含む値がクォートで囲まれたCSVの処理', async () => {
      render(<SpreadsheetApp />)

      const csvData = 'Title,Description\n"Hello, World","A simple greeting"\n"Test, CSV","Data with commas"'
      const csvFile = new File([csvData], 'quoted.csv', { type: 'text/csv' })

      const importButton = screen.getByTestId('import-csv-button')
      fireEvent.click(importButton)

      const fileInput = await waitFor(() =>
        screen.getByTestId('csv-file-input')
      )
      fireEvent.change(fileInput, { target: { files: [csvFile] } })

      // クォートで囲まれた値が正しく処理されることを確認
      await waitFor(() => {
        expect(screen.getByTestId('cell-A2')).toHaveTextContent('Hello, World')
        expect(screen.getByTestId('cell-B2')).toHaveTextContent('A simple greeting')
        expect(screen.getByTestId('cell-A3')).toHaveTextContent('Test, CSV')
        expect(screen.getByTestId('cell-B3')).toHaveTextContent('Data with commas')
      })
    })

    test('インポート時の既存データ上書き確認', async () => {
      render(<SpreadsheetApp />)

      // 既存データを入力
      const cellA1 = await waitFor(() => screen.getByTestId('cell-A1'))
      fireEvent.doubleClick(cellA1)
      const editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '既存データ' } })
      fireEvent.key('Enter')

      // CSVインポートを実行
      const csvData = 'NewData\nValue1'
      const csvFile = new File([csvData], 'overwrite.csv', { type: 'text/csv' })

      const importButton = screen.getByTestId('import-csv-button')
      fireEvent.click(importButton)

      const fileInput = await waitFor(() =>
        screen.getByTestId('csv-file-input')
      )
      fireEvent.change(fileInput, { target: { files: [csvFile] } })

      // 確認ダイアログが表示されることを確認
      const confirmDialog = await waitFor(() =>
        screen.getByTestId('import-confirm-dialog')
      )
      expect(confirmDialog).toBeInTheDocument()
      expect(confirmDialog).toHaveTextContent('既存のデータが上書きされます。続行しますか？')

      // 確認ボタンをクリック
      const confirmButton = screen.getByTestId('confirm-import-button')
      fireEvent.click(confirmButton)

      // データが上書きされることを確認
      await waitFor(() => {
        expect(cellA1).toHaveTextContent('NewData')
      })
    })
  })

  describe('CSVエクスポートフロー', () => {
    test('基本的なエクスポート機能', async () => {
      render(<SpreadsheetApp />)

      // テストデータを入力
      await inputTestData()

      // エクスポートボタンをクリック
      const exportButton = screen.getByTestId('export-csv-button')
      fireEvent.click(exportButton)

      // ファイルダウンロードダイアログが表示されることを確認
      const downloadDialog = await waitFor(() =>
        screen.getByTestId('export-download-dialog')
      )
      expect(downloadDialog).toBeInTheDocument()

      // ファイル名入力フィールドが表示されることを確認
      const filenameInput = screen.getByTestId('export-filename-input')
      expect(filenameInput).toBeInTheDocument()
      expect(filenameInput).toHaveValue('spreadsheet.csv')
    })

    test('カスタムファイル名でエクスポート', async () => {
      render(<SpreadsheetApp />)

      await inputTestData()

      const exportButton = screen.getByTestId('export-csv-button')
      fireEvent.click(exportButton)

      const filenameInput = await waitFor(() =>
        screen.getByTestId('export-filename-input')
      )

      // カスタムファイル名を入力
      fireEvent.change(filenameInput, { target: { value: 'my-data.csv' } })

      const downloadButton = screen.getByTestId('download-csv-button')
      fireEvent.click(downloadButton)

      // Blob URLが作成されることを確認
      expect(global.URL.createObjectURL).toHaveBeenCalled()

      // ダウンロード成功メッセージが表示されることを確認
      const successMessage = await waitFor(() =>
        screen.getByTestId('export-success-message')
      )
      expect(successMessage).toHaveTextContent('CSVファイルがダウンロードされました')
    })

    test('選択範囲のみエクスポート', async () => {
      render(<SpreadsheetApp />)

      await inputTestData()

      // 範囲を選択（A1:B2）
      const cellA1 = screen.getByTestId('cell-A1')
      const cellB2 = screen.getByTestId('cell-B2')

      fireEvent.mouseDown(cellA1)
      fireEvent.mouseOver(cellB2)
      fireEvent.mouseUp(cellB2)

      // 選択範囲がハイライトされることを確認
      await waitFor(() => {
        expect(cellA1).toHaveClass('selected-range')
        expect(screen.getByTestId('cell-A2')).toHaveClass('selected-range')
        expect(screen.getByTestId('cell-B1')).toHaveClass('selected-range')
        expect(cellB2).toHaveClass('selected-range')
      })

      const exportButton = screen.getByTestId('export-csv-button')
      fireEvent.click(exportButton)

      // エクスポートオプションが表示されることを確認
      const exportOptions = await waitFor(() =>
        screen.getByTestId('export-options')
      )
      expect(exportOptions).toBeInTheDocument()

      // 「選択範囲のみ」オプションを選択
      const selectedRangeOption = screen.getByTestId('export-selected-range-option')
      fireEvent.click(selectedRangeOption)

      const downloadButton = screen.getByTestId('download-csv-button')
      fireEvent.click(downloadButton)

      // エクスポートが成功することを確認
      expect(global.URL.createObjectURL).toHaveBeenCalled()
    })

    test('空のスプレッドシートのエクスポート処理', async () => {
      render(<SpreadsheetApp />)

      const exportButton = await waitFor(() =>
        screen.getByTestId('export-csv-button')
      )
      fireEvent.click(exportButton)

      // 警告メッセージが表示されることを確認
      const warningMessage = await waitFor(() =>
        screen.getByTestId('empty-export-warning')
      )
      expect(warningMessage).toBeInTheDocument()
      expect(warningMessage).toHaveTextContent('エクスポートするデータがありません')

      // エクスポートボタンが無効化されることを確認
      const downloadButton = screen.getByTestId('download-csv-button')
      expect(downloadButton).toBeDisabled()
    })
  })

  describe('CSVファイル形式オプション', () => {
    test('区切り文字オプション（カンマ、セミコロン、タブ）', async () => {
      render(<SpreadsheetApp />)

      await inputTestData()

      const exportButton = screen.getByTestId('export-csv-button')
      fireEvent.click(exportButton)

      // 区切り文字設定が表示されることを確認
      const delimiterOptions = await waitFor(() =>
        screen.getByTestId('delimiter-options')
      )
      expect(delimiterOptions).toBeInTheDocument()

      // セミコロン区切りを選択
      const semicolonOption = screen.getByTestId('delimiter-semicolon')
      fireEvent.click(semicolonOption)

      const downloadButton = screen.getByTestId('download-csv-button')
      fireEvent.click(downloadButton)

      // エクスポートが成功することを確認
      expect(global.URL.createObjectURL).toHaveBeenCalled()
    })

    test('文字エンコーディングオプション（UTF-8、Shift_JIS）', async () => {
      render(<SpreadsheetApp />)

      await inputTestData()

      const exportButton = screen.getByTestId('export-csv-button')
      fireEvent.click(exportButton)

      // エンコーディングオプションが表示されることを確認
      const encodingOptions = await waitFor(() =>
        screen.getByTestId('encoding-options')
      )
      expect(encodingOptions).toBeInTheDocument()

      // Shift_JISを選択
      const shiftJisOption = screen.getByTestId('encoding-shift-jis')
      fireEvent.click(shiftJisOption)

      const downloadButton = screen.getByTestId('download-csv-button')
      fireEvent.click(downloadButton)

      // エクスポートが成功することを確認
      expect(global.URL.createObjectURL).toHaveBeenCalled()
    })
  })

  describe('エラーハンドリング', () => {
    test('無効なCSVファイル形式のエラー処理', async () => {
      render(<SpreadsheetApp />)

      // 無効なファイル（画像ファイル）をアップロード
      const invalidFile = new File(['invalid data'], 'image.png', { type: 'image/png' })

      const importButton = screen.getByTestId('import-csv-button')
      fireEvent.click(importButton)

      const fileInput = await waitFor(() =>
        screen.getByTestId('csv-file-input')
      )
      fireEvent.change(fileInput, { target: { files: [invalidFile] } })

      // エラーメッセージが表示されることを確認
      const errorMessage = await waitFor(() =>
        screen.getByTestId('import-error-message')
      )
      expect(errorMessage).toBeInTheDocument()
      expect(errorMessage).toHaveTextContent('CSVファイルの形式が無効です')
    })

    test('ファイルサイズ制限エラー', async () => {
      render(<SpreadsheetApp />)

      // 大きなファイル（10MB）を模擬
      const largeData = 'a'.repeat(10 * 1024 * 1024) // 10MB
      const largeFile = new File([largeData], 'large.csv', { type: 'text/csv' })

      const importButton = screen.getByTestId('import-csv-button')
      fireEvent.click(importButton)

      const fileInput = await waitFor(() =>
        screen.getByTestId('csv-file-input')
      )
      fireEvent.change(fileInput, { target: { files: [largeFile] } })

      // ファイルサイズエラーメッセージが表示されることを確認
      const errorMessage = await waitFor(() =>
        screen.getByTestId('file-size-error-message')
      )
      expect(errorMessage).toBeInTheDocument()
      expect(errorMessage).toHaveTextContent('ファイルサイズが制限を超えています（最大5MB）')
    })

    test('ネットワークエラー時の処理', async () => {
      render(<SpreadsheetApp />)

      // ダウンロード機能をエラーが発生するようにモック
      global.URL.createObjectURL = jest.fn(() => {
        throw new Error('Network error')
      })

      await inputTestData()

      const exportButton = screen.getByTestId('export-csv-button')
      fireEvent.click(exportButton)

      const downloadButton = await waitFor(() =>
        screen.getByTestId('download-csv-button')
      )
      fireEvent.click(downloadButton)

      // エラーメッセージが表示されることを確認
      const errorMessage = await waitFor(() =>
        screen.getByTestId('export-error-message')
      )
      expect(errorMessage).toBeInTheDocument()
      expect(errorMessage).toHaveTextContent('ファイルのダウンロードに失敗しました')
    })
  })

  // ヘルパー関数
  async function inputTestData() {
    // A1-C3に基本テストデータを入力
    const testData = [
      ['Name', 'Age', 'City'],
      ['Taro', '25', 'Tokyo'],
      ['Hanako', '30', 'Osaka']
    ]

    for (let row = 0; row < testData.length; row++) {
      for (let col = 0; col < testData[row].length; col++) {
        const colChar = String.fromCharCode(65 + col) // A, B, C...
        const cellId = `cell-${colChar}${row + 1}`
        const cell = screen.getByTestId(cellId)

        fireEvent.doubleClick(cell)
        const editInput = await waitFor(() =>
          screen.getByTestId('cell-edit-input')
        )
        fireEvent.change(editInput, { target: { value: testData[row][col] } })
        fireEvent.key('Enter')

        await waitFor(() => {
          expect(screen.queryByTestId('cell-edit-input')).not.toBeInTheDocument()
        })
      }
    }
  }
})