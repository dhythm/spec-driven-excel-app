import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SpreadsheetApp } from '@/components/SpreadsheetApp'

/**
 * セル編集・計算シナリオの統合テスト
 * TDD REDフェーズ - これらのテストは現在実装がないため失敗します
 */
describe('セル編集・計算統合テスト', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('基本的なセル編集フロー', () => {
    test('セルをダブルクリックして編集モードに入る', async () => {
      render(<SpreadsheetApp />)

      const cellA1 = await waitFor(() => screen.getByTestId('cell-A1'))

      // ダブルクリックで編集モードに入る
      fireEvent.doubleClick(cellA1)

      // 編集モードのインプットフィールドが表示されることを確認
      const editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      expect(editInput).toBeInTheDocument()
      expect(editInput).toHaveFocus()
    })

    test('セルに文字列を入力してEnterで確定', async () => {
      render(<SpreadsheetApp />)

      const cellA1 = await waitFor(() => screen.getByTestId('cell-A1'))
      fireEvent.doubleClick(cellA1)

      const editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )

      // 文字列を入力
      fireEvent.change(editInput, { target: { value: 'Hello World' } })
      fireEvent.key('Enter')

      // セル内容が更新されることを確認
      await waitFor(() => {
        expect(cellA1).toHaveTextContent('Hello World')
      })

      // 編集モードが終了することを確認
      expect(screen.queryByTestId('cell-edit-input')).not.toBeInTheDocument()
    })

    test('セルに数値を入力して計算に使用できる', async () => {
      render(<SpreadsheetApp />)

      // A1に数値100を入力
      const cellA1 = await waitFor(() => screen.getByTestId('cell-A1'))
      fireEvent.doubleClick(cellA1)

      let editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '100' } })
      fireEvent.key('Enter')

      // A2に数値200を入力
      const cellA2 = screen.getByTestId('cell-A2')
      fireEvent.doubleClick(cellA2)

      editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '200' } })
      fireEvent.key('Enter')

      // セル内容が正しく表示されることを確認
      await waitFor(() => {
        expect(cellA1).toHaveTextContent('100')
        expect(cellA2).toHaveTextContent('200')
      })
    })

    test('ESCキーで編集をキャンセル', async () => {
      render(<SpreadsheetApp />)

      const cellA1 = await waitFor(() => screen.getByTestId('cell-A1'))

      // 初期値を設定
      fireEvent.doubleClick(cellA1)
      let editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '元の値' } })
      fireEvent.key('Enter')

      // 再編集してESCでキャンセル
      fireEvent.doubleClick(cellA1)
      editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '変更された値' } })
      fireEvent.keyDown(editInput, { key: 'Escape', code: 'Escape' })

      // 元の値が保持されることを確認
      await waitFor(() => {
        expect(cellA1).toHaveTextContent('元の値')
      })

      // 編集モードが終了することを確認
      expect(screen.queryByTestId('cell-edit-input')).not.toBeInTheDocument()
    })
  })

  describe('数式計算フロー', () => {
    test('基本的な算術計算（加算）', async () => {
      render(<SpreadsheetApp />)

      // A1に10、A2に20を入力
      await inputValueToCell('cell-A1', '10')
      await inputValueToCell('cell-A2', '20')

      // A3に数式を入力
      const cellA3 = screen.getByTestId('cell-A3')
      fireEvent.doubleClick(cellA3)

      const editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '=A1+A2' } })
      fireEvent.key('Enter')

      // 計算結果が表示されることを確認
      await waitFor(() => {
        expect(cellA3).toHaveTextContent('30')
      })

      // フォーミュラバーに数式が表示されることを確認
      fireEvent.click(cellA3)
      const formulaBar = screen.getByTestId('formula-bar-input')
      expect(formulaBar).toHaveValue('=A1+A2')
    })

    test('複雑な数式計算（四則演算）', async () => {
      render(<SpreadsheetApp />)

      // 基礎データを入力
      await inputValueToCell('cell-B1', '5')
      await inputValueToCell('cell-B2', '3')
      await inputValueToCell('cell-B3', '2')

      // 複雑な計算式を入力
      const cellB4 = screen.getByTestId('cell-B4')
      fireEvent.doubleClick(cellB4)

      const editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '=(B1+B2)*B3' } })
      fireEvent.key('Enter')

      // 計算結果 (5+3)*2 = 16 が表示されることを確認
      await waitFor(() => {
        expect(cellB4).toHaveTextContent('16')
      })
    })

    test('SUM関数による範囲計算', async () => {
      render(<SpreadsheetApp />)

      // C1からC3に値を入力
      await inputValueToCell('cell-C1', '10')
      await inputValueToCell('cell-C2', '20')
      await inputValueToCell('cell-C3', '30')

      // SUM関数を使用
      const cellC4 = screen.getByTestId('cell-C4')
      fireEvent.doubleClick(cellC4)

      const editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '=SUM(C1:C3)' } })
      fireEvent.key('Enter')

      // 合計値60が表示されることを確認
      await waitFor(() => {
        expect(cellC4).toHaveTextContent('60')
      })
    })

    test('AVERAGE関数による平均計算', async () => {
      render(<SpreadsheetApp />)

      // D1からD4に値を入力
      await inputValueToCell('cell-D1', '100')
      await inputValueToCell('cell-D2', '200')
      await inputValueToCell('cell-D3', '300')
      await inputValueToCell('cell-D4', '400')

      // AVERAGE関数を使用
      const cellD5 = screen.getByTestId('cell-D5')
      fireEvent.doubleClick(cellD5)

      const editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '=AVERAGE(D1:D4)' } })
      fireEvent.key('Enter')

      // 平均値250が表示されることを確認
      await waitFor(() => {
        expect(cellD5).toHaveTextContent('250')
      })
    })

    test('参照先セルの値が変更されると計算結果も自動更新', async () => {
      render(<SpreadsheetApp />)

      // 初期値を設定
      await inputValueToCell('cell-E1', '5')
      await inputValueToCell('cell-E2', '10')

      // 計算式を入力
      const cellE3 = screen.getByTestId('cell-E3')
      fireEvent.doubleClick(cellE3)

      let editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '=E1*E2' } })
      fireEvent.key('Enter')

      // 初期計算結果を確認
      await waitFor(() => {
        expect(cellE3).toHaveTextContent('50')
      })

      // E1の値を変更
      const cellE1 = screen.getByTestId('cell-E1')
      fireEvent.doubleClick(cellE1)

      editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '8' } })
      fireEvent.key('Enter')

      // E3の計算結果が自動更新されることを確認
      await waitFor(() => {
        expect(cellE3).toHaveTextContent('80')
      })
    })
  })

  describe('フォーミュラバー連携', () => {
    test('セル選択時にフォーミュラバーに内容が表示される', async () => {
      render(<SpreadsheetApp />)

      // セルに数式を入力
      await inputValueToCell('cell-F1', '=10+20')

      // セルをクリック
      const cellF1 = screen.getByTestId('cell-F1')
      fireEvent.click(cellF1)

      // フォーミュラバーに数式が表示されることを確認
      await waitFor(() => {
        const formulaBarInput = screen.getByTestId('formula-bar-input')
        expect(formulaBarInput).toHaveValue('=10+20')
      })

      // セルには計算結果が表示されることを確認
      expect(cellF1).toHaveTextContent('30')
    })

    test('フォーミュラバーから直接編集', async () => {
      render(<SpreadsheetApp />)

      const cellG1 = await waitFor(() => screen.getByTestId('cell-G1'))
      fireEvent.click(cellG1)

      // フォーミュラバーに直接入力
      const formulaBarInput = screen.getByTestId('formula-bar-input')
      fireEvent.change(formulaBarInput, { target: { value: '=5*6' } })
      fireEvent.key('Enter')

      // セルに計算結果が表示されることを確認
      await waitFor(() => {
        expect(cellG1).toHaveTextContent('30')
      })
    })
  })

  describe('セル書式設定', () => {
    test('数値の書式設定（小数点以下の表示）', async () => {
      render(<SpreadsheetApp />)

      // 小数値を入力
      await inputValueToCell('cell-H1', '3.14159')

      const cellH1 = screen.getByTestId('cell-H1')
      fireEvent.click(cellH1)

      // 書式設定ボタンをクリック
      const formatButton = screen.getByTestId('format-number-button')
      fireEvent.click(formatButton)

      // 小数点以下2桁に設定
      const decimalPlacesInput = screen.getByTestId('decimal-places-input')
      fireEvent.change(decimalPlacesInput, { target: { value: '2' } })

      const applyFormatButton = screen.getByTestId('apply-format-button')
      fireEvent.click(applyFormatButton)

      // 書式が適用されることを確認
      await waitFor(() => {
        expect(cellH1).toHaveTextContent('3.14')
      })
    })

    test('パーセント書式の適用', async () => {
      render(<SpreadsheetApp />)

      await inputValueToCell('cell-I1', '0.85')

      const cellI1 = screen.getByTestId('cell-I1')
      fireEvent.click(cellI1)

      // パーセント書式ボタンをクリック
      const percentButton = screen.getByTestId('percent-format-button')
      fireEvent.click(percentButton)

      // パーセント表示になることを確認
      await waitFor(() => {
        expect(cellI1).toHaveTextContent('85%')
      })
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