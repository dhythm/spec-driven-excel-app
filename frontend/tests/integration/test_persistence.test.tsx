import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SpreadsheetApp } from '@/components/SpreadsheetApp'

/**
 * LocalStorageによるデータ永続化の統合テスト
 * TDD REDフェーズ - これらのテストは現在実装がないため失敗します
 */
describe('データ永続化統合テスト', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('基本的な永続化機能', () => {
    test('セルデータが自動的に保存される', async () => {
      const { unmount } = render(<SpreadsheetApp />)

      // セルにデータを入力
      await inputValueToCell('cell-A1', 'テストデータ1')
      await inputValueToCell('cell-B2', '123')
      await inputValueToCell('cell-C3', '=A1&" - "&B2')

      // 短時間待機して自動保存が実行されることを確認
      await waitFor(
        () => {
          const savedData = localStorage.getItem('spreadsheet-data')
          expect(savedData).not.toBeNull()
        },
        { timeout: 3000 }
      )

      // コンポーネントをアンマウント
      unmount()

      // 再レンダリング
      render(<SpreadsheetApp />)

      // データが復元されることを確認
      await waitFor(() => {
        expect(screen.getByTestId('cell-A1')).toHaveTextContent('テストデータ1')
        expect(screen.getByTestId('cell-B2')).toHaveTextContent('123')
        expect(screen.getByTestId('cell-C3')).toHaveTextContent('テストデータ1 - 123')
      })
    })

    test('スプレッドシートタイトルが保存・復元される', async () => {
      const { unmount } = render(<SpreadsheetApp />)

      // タイトルを変更
      const titleInput = await waitFor(() =>
        screen.getByTestId('spreadsheet-title-input')
      )
      fireEvent.change(titleInput, { target: { value: '売上管理表' } })
      fireEvent.blur(titleInput)

      // 自動保存を待機
      await waitFor(
        () => {
          const savedData = localStorage.getItem('spreadsheet-metadata')
          expect(savedData).not.toBeNull()
        },
        { timeout: 3000 }
      )

      unmount()
      render(<SpreadsheetApp />)

      // タイトルが復元されることを確認
      await waitFor(() => {
        const restoredTitleInput = screen.getByTestId('spreadsheet-title-input')
        expect(restoredTitleInput).toHaveValue('売上管理表')
      })
    })

    test('数式と計算結果の両方が正しく保存・復元される', async () => {
      const { unmount } = render(<SpreadsheetApp />)

      // 基本データを入力
      await inputValueToCell('cell-D1', '100')
      await inputValueToCell('cell-D2', '200')
      await inputValueToCell('cell-D3', '=D1+D2')

      // SUM関数を使用
      await inputValueToCell('cell-D4', '=SUM(D1:D3)')

      // 自動保存を待機
      await waitFor(
        () => {
          const savedData = localStorage.getItem('spreadsheet-data')
          expect(savedData).not.toBeNull()
        },
        { timeout: 3000 }
      )

      unmount()
      render(<SpreadsheetApp />)

      // データと計算結果が復元されることを確認
      await waitFor(() => {
        expect(screen.getByTestId('cell-D1')).toHaveTextContent('100')
        expect(screen.getByTestId('cell-D2')).toHaveTextContent('200')
        expect(screen.getByTestId('cell-D3')).toHaveTextContent('300') // 100 + 200
        expect(screen.getByTestId('cell-D4')).toHaveTextContent('600') // 100 + 200 + 300
      })

      // 数式も正しく復元されることを確認
      fireEvent.click(screen.getByTestId('cell-D3'))
      const formulaBar = screen.getByTestId('formula-bar-input')
      expect(formulaBar).toHaveValue('=D1+D2')

      fireEvent.click(screen.getByTestId('cell-D4'))
      expect(formulaBar).toHaveValue('=SUM(D1:D3)')
    })
  })

  describe('保存タイミングの制御', () => {
    test('セル編集後に自動保存が実行される', async () => {
      render(<SpreadsheetApp />)

      await inputValueToCell('cell-E1', 'オートセーブテスト')

      // 自動保存が実行されることを確認
      await waitFor(
        () => {
          const savedData = localStorage.getItem('spreadsheet-data')
          const parsedData = JSON.parse(savedData || '{}')
          expect(parsedData.cells.E1.value).toBe('オートセーブテスト')
        },
        { timeout: 3000 }
      )

      // 保存インディケーターが表示されることを確認
      const saveIndicator = await waitFor(() =>
        screen.getByTestId('auto-save-indicator')
      )
      expect(saveIndicator).toHaveTextContent('自動保存済み')
    })

    test('手動保存ボタンで即座に保存', async () => {
      render(<SpreadsheetApp />)

      await inputValueToCell('cell-E2', '手動保存テスト')

      // 手動保存ボタンをクリック
      const saveButton = screen.getByTestId('manual-save-button')
      fireEvent.click(saveButton)

      // 即座に保存されることを確認
      await waitFor(() => {
        const savedData = localStorage.getItem('spreadsheet-data')
        const parsedData = JSON.parse(savedData || '{}')
        expect(parsedData.cells.E2.value).toBe('手動保存テスト')
      })

      // 保存完了メッセージが表示されることを確認
      const saveMessage = await waitFor(() =>
        screen.getByTestId('manual-save-message')
      )
      expect(saveMessage).toHaveTextContent('データを保存しました')
    })

    test('一定時間編集がない場合の定期保存', async () => {
      jest.useFakeTimers()

      render(<SpreadsheetApp />)

      await inputValueToCell('cell-E3', '定期保存テスト')

      // 5秒経過をシミュレート
      jest.advanceTimersByTime(5000)

      await waitFor(() => {
        const savedData = localStorage.getItem('spreadsheet-data')
        const parsedData = JSON.parse(savedData || '{}')
        expect(parsedData.cells.E3.value).toBe('定期保存テスト')
      })

      jest.useRealTimers()
    })
  })

  describe('複数スプレッドシートの管理', () => {
    test('異なるスプレッドシートIDで個別に保存', async () => {
      // 最初のスプレッドシート
      const { unmount: unmount1 } = render(<SpreadsheetApp spreadsheetId="sheet1" />)

      await inputValueToCell('cell-F1', 'Sheet1のデータ')

      await waitFor(
        () => {
          const savedData = localStorage.getItem('spreadsheet-data-sheet1')
          expect(savedData).not.toBeNull()
        },
        { timeout: 3000 }
      )

      unmount1()

      // 2番目のスプレッドシート
      const { unmount: unmount2 } = render(<SpreadsheetApp spreadsheetId="sheet2" />)

      await inputValueToCell('cell-F1', 'Sheet2のデータ')

      await waitFor(
        () => {
          const savedData = localStorage.getItem('spreadsheet-data-sheet2')
          expect(savedData).not.toBeNull()
        },
        { timeout: 3000 }
      )

      unmount2()

      // Sheet1を再読み込み
      render(<SpreadsheetApp spreadsheetId="sheet1" />)

      await waitFor(() => {
        expect(screen.getByTestId('cell-F1')).toHaveTextContent('Sheet1のデータ')
      })
    })

    test('スプレッドシート一覧の表示', async () => {
      // 複数のスプレッドシートを作成
      localStorage.setItem(
        'spreadsheet-list',
        JSON.stringify([
          { id: 'sheet1', title: '売上管理', lastModified: Date.now() },
          { id: 'sheet2', title: '在庫管理', lastModified: Date.now() - 86400000 },
          { id: 'sheet3', title: '顧客管理', lastModified: Date.now() - 172800000 }
        ])
      )

      render(<SpreadsheetApp />)

      // スプレッドシート一覧ボタンをクリック
      const listButton = await waitFor(() =>
        screen.getByTestId('spreadsheet-list-button')
      )
      fireEvent.click(listButton)

      // 一覧ダイアログが表示されることを確認
      const listDialog = await waitFor(() =>
        screen.getByTestId('spreadsheet-list-dialog')
      )
      expect(listDialog).toBeInTheDocument()

      // 各スプレッドシートが表示されることを確認
      expect(screen.getByTestId('spreadsheet-item-sheet1')).toHaveTextContent('売上管理')
      expect(screen.getByTestId('spreadsheet-item-sheet2')).toHaveTextContent('在庫管理')
      expect(screen.getByTestId('spreadsheet-item-sheet3')).toHaveTextContent('顧客管理')
    })

    test('スプレッドシートの削除', async () => {
      render(<SpreadsheetApp />)

      // データを入力
      await inputValueToCell('cell-G1', '削除予定データ')

      // 削除ボタンをクリック
      const deleteButton = screen.getByTestId('delete-spreadsheet-button')
      fireEvent.click(deleteButton)

      // 確認ダイアログが表示されることを確認
      const confirmDialog = await waitFor(() =>
        screen.getByTestId('delete-confirm-dialog')
      )
      expect(confirmDialog).toBeInTheDocument()
      expect(confirmDialog).toHaveTextContent('このスプレッドシートを削除しますか？')

      // 削除確認
      const confirmButton = screen.getByTestId('confirm-delete-button')
      fireEvent.click(confirmButton)

      // LocalStorageからデータが削除されることを確認
      await waitFor(() => {
        const savedData = localStorage.getItem('spreadsheet-data')
        expect(savedData).toBeNull()
      })

      // 新しい空のスプレッドシートが表示されることを確認
      expect(screen.getByTestId('cell-G1')).toHaveTextContent('')
    })
  })

  describe('データのインポート・エクスポート', () => {
    test('保存されたデータをJSONでエクスポート', async () => {
      render(<SpreadsheetApp />)

      // テストデータを作成
      await inputValueToCell('cell-H1', 'エクスポートテスト')
      await inputValueToCell('cell-H2', '42')
      await inputValueToCell('cell-H3', '=H2*2')

      // エクスポートボタンをクリック
      const exportButton = screen.getByTestId('export-json-button')
      fireEvent.click(exportButton)

      // ダウンロードが開始されることを確認
      await waitFor(() => {
        expect(global.URL.createObjectURL).toHaveBeenCalled()
      })

      // エクスポート成功メッセージ
      const successMessage = screen.getByTestId('export-json-success')
      expect(successMessage).toHaveTextContent('データをエクスポートしました')
    })

    test('JSONファイルからデータをインポート', async () => {
      render(<SpreadsheetApp />)

      // インポート用のJSONデータを準備
      const importData = {
        cells: {
          I1: { value: 'インポートされたデータ', formula: null },
          I2: { value: 100, formula: null },
          I3: { value: 200, formula: '=I2*2' }
        },
        metadata: {
          title: 'インポートされたシート',
          createdAt: Date.now(),
          lastModified: Date.now()
        }
      }

      const jsonFile = new File([JSON.stringify(importData)], 'import.json', {
        type: 'application/json'
      })

      // インポートボタンをクリック
      const importButton = screen.getByTestId('import-json-button')
      fireEvent.click(importButton)

      // ファイル選択
      const fileInput = await waitFor(() =>
        screen.getByTestId('json-file-input')
      )
      fireEvent.change(fileInput, { target: { files: [jsonFile] } })

      // データがインポートされることを確認
      await waitFor(() => {
        expect(screen.getByTestId('cell-I1')).toHaveTextContent('インポートされたデータ')
        expect(screen.getByTestId('cell-I2')).toHaveTextContent('100')
        expect(screen.getByTestId('cell-I3')).toHaveTextContent('200')
      })

      // タイトルもインポートされることを確認
      const titleInput = screen.getByTestId('spreadsheet-title-input')
      expect(titleInput).toHaveValue('インポートされたシート')
    })
  })

  describe('データ整合性とエラー処理', () => {
    test('破損したLocalStorageデータの処理', async () => {
      // 破損したデータをLocalStorageに設定
      localStorage.setItem('spreadsheet-data', '{"invalid": json}')

      render(<SpreadsheetApp />)

      // エラーメッセージが表示されることを確認
      const errorMessage = await waitFor(() =>
        screen.getByTestId('data-recovery-error')
      )
      expect(errorMessage).toBeInTheDocument()
      expect(errorMessage).toHaveTextContent('保存されたデータが破損しています')

      // 新しい空のスプレッドシートが初期化されることを確認
      expect(screen.getByTestId('cell-A1')).toHaveTextContent('')

      // 復旧オプションが提示されることを確認
      const recoveryOptions = screen.getByTestId('data-recovery-options')
      expect(recoveryOptions).toBeInTheDocument()
    })

    test('LocalStorageの容量制限エラー', async () => {
      render(<SpreadsheetApp />)

      // LocalStorageの setItem をエラーを投げるようにモック
      const originalSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = jest.fn(() => {
        throw new Error('QuotaExceededError')
      })

      await inputValueToCell('cell-J1', '容量テスト')

      // 容量エラーメッセージが表示されることを確認
      const errorMessage = await waitFor(() =>
        screen.getByTestId('storage-quota-error')
      )
      expect(errorMessage).toBeInTheDocument()
      expect(errorMessage).toHaveTextContent('ストレージの容量が不足しています')

      // 古いデータの削除オプションが提示されることを確認
      const cleanupOptions = screen.getByTestId('storage-cleanup-options')
      expect(cleanupOptions).toBeInTheDocument()

      // 元のsetItemを復元
      Storage.prototype.setItem = originalSetItem
    })

    test('保存失敗時のリトライ機能', async () => {
      render(<SpreadsheetApp />)

      // 最初の2回は失敗し、3回目で成功するようにモック
      let callCount = 0
      const originalSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = jest.fn((key, value) => {
        callCount++
        if (callCount <= 2) {
          throw new Error('Temporary failure')
        }
        return originalSetItem.call(localStorage, key, value)
      })

      await inputValueToCell('cell-J2', 'リトライテスト')

      // リトライメッセージが表示されることを確認
      const retryMessage = await waitFor(() =>
        screen.getByTestId('save-retry-message')
      )
      expect(retryMessage).toBeInTheDocument()
      expect(retryMessage).toHaveTextContent('保存をリトライしています...')

      // 最終的に成功することを確認
      await waitFor(() => {
        const successMessage = screen.getByTestId('save-success-message')
        expect(successMessage).toHaveTextContent('データを保存しました')
      })

      // setItemが3回呼ばれたことを確認（2回失敗、1回成功）
      expect(Storage.prototype.setItem).toHaveBeenCalledTimes(3)

      Storage.prototype.setItem = originalSetItem
    })

    test('オフライン時の動作', async () => {
      // オンライン状態をモック
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      })

      render(<SpreadsheetApp />)

      await inputValueToCell('cell-K1', 'オフラインテスト')

      // オフラインメッセージが表示されることを確認
      const offlineMessage = await waitFor(() =>
        screen.getByTestId('offline-message')
      )
      expect(offlineMessage).toBeInTheDocument()
      expect(offlineMessage).toHaveTextContent('オフラインモードで動作しています')

      // ローカルには保存されることを確認
      await waitFor(() => {
        const savedData = localStorage.getItem('spreadsheet-data')
        expect(savedData).not.toBeNull()
      })

      // オンライン復帰
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      })

      window.dispatchEvent(new Event('online'))

      // オンライン復帰メッセージが表示されることを確認
      const onlineMessage = await waitFor(() =>
        screen.getByTestId('online-message')
      )
      expect(onlineMessage).toHaveTextContent('オンラインに復帰しました')
    })
  })

  // ヘルパー関数
  async function inputValueToCell(cellTestId: string, value: string) {
    const cell = screen.getByTestId(cellTestId)
    fireEvent.doubleClick(cell)

    const editInput = await waitFor(() =>
      screen.getByTestId('cell-edit-input')
    )
    fireEvent.change(editInput, { target: { value } })
    fireEvent.key('Enter')

    await waitFor(() => {
      expect(screen.queryByTestId('cell-edit-input')).not.toBeInTheDocument()
    })
  }
})