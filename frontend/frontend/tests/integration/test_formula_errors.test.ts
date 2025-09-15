import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import SpreadsheetApp from '../../src/components/SpreadsheetApp'

/**
 * 数式エラーハンドリングの統合テスト
 * TDD REDフェーズ - これらのテストは現在実装がないため失敗します
 */
describe('数式エラーハンドリング統合テスト', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('基本的な数式エラー', () => {
    test('#DIV/0!エラー - ゼロ除算', async () => {
      render(<SpreadsheetApp />)

      // A1に0を入力
      await inputValueToCell('cell-A1', '0')

      // B1にゼロ除算の数式を入力
      const cellB1 = screen.getByTestId('cell-B1')
      fireEvent.doubleClick(cellB1)

      const editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '=10/A1' } })
      fireEvent.key('Enter')

      // #DIV/0!エラーが表示されることを確認
      await waitFor(() => {
        expect(cellB1).toHaveTextContent('#DIV/0!')
      })

      // エラーセルをクリックしたときにエラーメッセージが表示される
      fireEvent.click(cellB1)
      const errorTooltip = await waitFor(() =>
        screen.getByTestId('error-tooltip')
      )
      expect(errorTooltip).toHaveTextContent('ゼロで除算することはできません')
    })

    test('#NAME?エラー - 不明な関数名', async () => {
      render(<SpreadsheetApp />)

      const cellA2 = await waitFor(() => screen.getByTestId('cell-A2'))
      fireEvent.doubleClick(cellA2)

      const editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '=INVALIDFUNC(10,20)' } })
      fireEvent.key('Enter')

      // #NAME?エラーが表示されることを確認
      await waitFor(() => {
        expect(cellA2).toHaveTextContent('#NAME?')
      })

      // エラーメッセージの確認
      fireEvent.click(cellA2)
      const errorTooltip = await waitFor(() =>
        screen.getByTestId('error-tooltip')
      )
      expect(errorTooltip).toHaveTextContent('関数名が認識されません: INVALIDFUNC')
    })

    test('#VALUE!エラー - 不正な引数型', async () => {
      render(<SpreadsheetApp />)

      // A3に文字列を入力
      await inputValueToCell('cell-A3', 'Hello')

      const cellB3 = screen.getByTestId('cell-B3')
      fireEvent.doubleClick(cellB3)

      const editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '=A3+10' } })
      fireEvent.key('Enter')

      // #VALUE!エラーが表示されることを確認
      await waitFor(() => {
        expect(cellB3).toHaveTextContent('#VALUE!')
      })

      fireEvent.click(cellB3)
      const errorTooltip = await waitFor(() =>
        screen.getByTestId('error-tooltip')
      )
      expect(errorTooltip).toHaveTextContent('数値以外の値を数値演算で使用しようとしました')
    })

    test('#REF!エラー - 無効な参照', async () => {
      render(<SpreadsheetApp />)

      const cellA4 = await waitFor(() => screen.getByTestId('cell-A4'))
      fireEvent.doubleClick(cellA4)

      const editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '=ZZ999' } })
      fireEvent.key('Enter')

      // #REF!エラーが表示されることを確認
      await waitFor(() => {
        expect(cellA4).toHaveTextContent('#REF!')
      })

      fireEvent.click(cellA4)
      const errorTooltip = await waitFor(() =>
        screen.getByTestId('error-tooltip')
      )
      expect(errorTooltip).toHaveTextContent('無効なセル参照です: ZZ999')
    })

    test('#NUM!エラー - 数値範囲エラー', async () => {
      render(<SpreadsheetApp />)

      const cellA5 = await waitFor(() => screen.getByTestId('cell-A5'))
      fireEvent.doubleClick(cellA5)

      const editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '=SQRT(-1)' } })
      fireEvent.key('Enter')

      // #NUM!エラーが表示されることを確認
      await waitFor(() => {
        expect(cellA5).toHaveTextContent('#NUM!')
      })

      fireEvent.click(cellA5)
      const errorTooltip = await waitFor(() =>
        screen.getByTestId('error-tooltip')
      )
      expect(errorTooltip).toHaveTextContent('負の数の平方根は計算できません')
    })
  })

  describe('循環参照エラー', () => {
    test('直接的な循環参照の検出', async () => {
      render(<SpreadsheetApp />)

      const cellB5 = await waitFor(() => screen.getByTestId('cell-B5'))
      fireEvent.doubleClick(cellB5)

      const editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '=B5+1' } })
      fireEvent.key('Enter')

      // #CIRCULAR!エラーが表示されることを確認
      await waitFor(() => {
        expect(cellB5).toHaveTextContent('#CIRCULAR!')
      })

      fireEvent.click(cellB5)
      const errorTooltip = await waitFor(() =>
        screen.getByTestId('error-tooltip')
      )
      expect(errorTooltip).toHaveTextContent('循環参照が発生しています')
    })

    test('間接的な循環参照の検出', async () => {
      render(<SpreadsheetApp />)

      // C1 = C2 + 10
      await inputFormulaToCell('cell-C1', '=C2+10')

      // C2 = C3 + 5
      await inputFormulaToCell('cell-C2', '=C3+5')

      // C3 = C1 + 1 （循環参照を作成）
      const cellC3 = screen.getByTestId('cell-C3')
      fireEvent.doubleClick(cellC3)

      const editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '=C1+1' } })
      fireEvent.key('Enter')

      // 関連するセルに#CIRCULAR!エラーが表示されることを確認
      await waitFor(() => {
        expect(screen.getByTestId('cell-C1')).toHaveTextContent('#CIRCULAR!')
        expect(screen.getByTestId('cell-C2')).toHaveTextContent('#CIRCULAR!')
        expect(cellC3).toHaveTextContent('#CIRCULAR!')
      })
    })

    test('循環参照の解決', async () => {
      render(<SpreadsheetApp />)

      // 循環参照を作成
      await inputFormulaToCell('cell-D1', '=D2+10')
      await inputFormulaToCell('cell-D2', '=D1+5')

      // 循環参照エラーを確認
      await waitFor(() => {
        expect(screen.getByTestId('cell-D1')).toHaveTextContent('#CIRCULAR!')
        expect(screen.getByTestId('cell-D2')).toHaveTextContent('#CIRCULAR!')
      })

      // D2を固定値に変更して循環参照を解決
      const cellD2 = screen.getByTestId('cell-D2')
      fireEvent.doubleClick(cellD2)

      const editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '20' } })
      fireEvent.key('Enter')

      // エラーが解決されることを確認
      await waitFor(() => {
        expect(screen.getByTestId('cell-D1')).toHaveTextContent('30') // 20 + 10
        expect(cellD2).toHaveTextContent('20')
      })
    })
  })

  describe('構文エラー', () => {
    test('不正な数式構文', async () => {
      render(<SpreadsheetApp />)

      const cellE1 = await waitFor(() => screen.getByTestId('cell-E1'))
      fireEvent.doubleClick(cellE1)

      const editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '=10 + + 20' } })
      fireEvent.key('Enter')

      // #ERROR!エラーが表示されることを確認
      await waitFor(() => {
        expect(cellE1).toHaveTextContent('#ERROR!')
      })

      fireEvent.click(cellE1)
      const errorTooltip = await waitFor(() =>
        screen.getByTestId('error-tooltip')
      )
      expect(errorTooltip).toHaveTextContent('数式の構文が正しくありません')
    })

    test('括弧の不一致', async () => {
      render(<SpreadsheetApp />)

      const cellE2 = await waitFor(() => screen.getByTestId('cell-E2'))
      fireEvent.doubleClick(cellE2)

      const editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '=(10+20' } })
      fireEvent.key('Enter')

      // #ERROR!エラーが表示されることを確認
      await waitFor(() => {
        expect(cellE2).toHaveTextContent('#ERROR!')
      })

      fireEvent.click(cellE2)
      const errorTooltip = await waitFor(() =>
        screen.getByTestId('error-tooltip')
      )
      expect(errorTooltip).toHaveTextContent('括弧が一致しません')
    })

    test('関数の引数不足', async () => {
      render(<SpreadsheetApp />)

      const cellE3 = await waitFor(() => screen.getByTestId('cell-E3'))
      fireEvent.doubleClick(cellE3)

      const editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '=SUM()' } })
      fireEvent.key('Enter')

      // #ERROR!エラーが表示されることを確認
      await waitFor(() => {
        expect(cellE3).toHaveTextContent('#ERROR!')
      })

      fireEvent.click(cellE3)
      const errorTooltip = await waitFor(() =>
        screen.getByTestId('error-tooltip')
      )
      expect(errorTooltip).toHaveTextContent('SUM関数には少なくとも1つの引数が必要です')
    })
  })

  describe('エラーの波及と処理', () => {
    test('エラー値を参照する数式', async () => {
      render(<SpreadsheetApp />)

      // F1にエラーを発生させる
      await inputFormulaToCell('cell-F1', '=10/0')

      await waitFor(() => {
        expect(screen.getByTestId('cell-F1')).toHaveTextContent('#DIV/0!')
      })

      // F2でF1を参照
      const cellF2 = screen.getByTestId('cell-F2')
      fireEvent.doubleClick(cellF2)

      const editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '=F1+10' } })
      fireEvent.key('Enter')

      // エラーが伝播されることを確認
      await waitFor(() => {
        expect(cellF2).toHaveTextContent('#DIV/0!')
      })
    })

    test('IFERROR関数によるエラーハンドリング', async () => {
      render(<SpreadsheetApp />)

      const cellG1 = await waitFor(() => screen.getByTestId('cell-G1'))
      fireEvent.doubleClick(cellG1)

      const editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '=IFERROR(10/0, "エラーです")' } })
      fireEvent.key('Enter')

      // エラーの代わりに指定した値が表示されることを確認
      await waitFor(() => {
        expect(cellG1).toHaveTextContent('エラーです')
      })
    })

    test('複数の関数でのエラー処理', async () => {
      render(<SpreadsheetApp />)

      // G2に数値、G3に文字列、G4に空セル
      await inputValueToCell('cell-G2', '100')
      await inputValueToCell('cell-G3', 'text')

      const cellG5 = screen.getByTestId('cell-G5')
      fireEvent.doubleClick(cellG5)

      const editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '=SUM(G2:G4)' } })
      fireEvent.key('Enter')

      // 数値のみが合計されることを確認（文字列や空セルは無視）
      await waitFor(() => {
        expect(cellG5).toHaveTextContent('100')
      })
    })
  })

  describe('エラー情報の表示', () => {
    test('エラーセルのホバー時にツールチップ表示', async () => {
      render(<SpreadsheetApp />)

      await inputFormulaToCell('cell-H1', '=1/0')

      await waitFor(() => {
        expect(screen.getByTestId('cell-H1')).toHaveTextContent('#DIV/0!')
      })

      const cellH1 = screen.getByTestId('cell-H1')

      // ホバーイベント
      fireEvent.mouseEnter(cellH1)

      // ツールチップが表示されることを確認
      const tooltip = await waitFor(() =>
        screen.getByTestId('error-hover-tooltip')
      )
      expect(tooltip).toBeInTheDocument()
      expect(tooltip).toHaveTextContent('ゼロで除算することはできません')

      // ツールチップの詳細情報
      expect(tooltip).toHaveTextContent('セル: H1')
      expect(tooltip).toHaveTextContent('数式: =1/0')
      expect(tooltip).toHaveTextContent('エラー種別: #DIV/0!')
    })

    test('エラーログパネルの表示', async () => {
      render(<SpreadsheetApp />)

      // 複数のエラーを発生させる
      await inputFormulaToCell('cell-H2', '=10/0')
      await inputFormulaToCell('cell-H3', '=INVALIDFUNC()')
      await inputFormulaToCell('cell-H4', '="text"+5')

      // エラーログボタンをクリック
      const errorLogButton = await waitFor(() =>
        screen.getByTestId('error-log-button')
      )
      fireEvent.click(errorLogButton)

      // エラーログパネルが表示されることを確認
      const errorLogPanel = await waitFor(() =>
        screen.getByTestId('error-log-panel')
      )
      expect(errorLogPanel).toBeInTheDocument()

      // エラーリストが表示されることを確認
      const errorList = screen.getByTestId('error-list')
      expect(errorList).toBeInTheDocument()

      const errorItems = screen.getAllByTestId(/error-item-/)
      expect(errorItems).toHaveLength(3)

      // 個別エラーの内容確認
      expect(errorItems[0]).toHaveTextContent('H2: #DIV/0! - ゼロで除算することはできません')
      expect(errorItems[1]).toHaveTextContent('H3: #NAME? - 関数名が認識されません')
      expect(errorItems[2]).toHaveTextContent('H4: #VALUE! - 数値以外の値を数値演算で使用')
    })

    test('エラー修正後のログ更新', async () => {
      render(<SpreadsheetApp />)

      // エラーを発生させる
      await inputFormulaToCell('cell-H5', '=10/0')

      // エラーログを開く
      const errorLogButton = await waitFor(() =>
        screen.getByTestId('error-log-button')
      )
      fireEvent.click(errorLogButton)

      // エラーが1つあることを確認
      let errorItems = screen.getAllByTestId(/error-item-/)
      expect(errorItems).toHaveLength(1)

      // エラーを修正
      const cellH5 = screen.getByTestId('cell-H5')
      fireEvent.doubleClick(cellH5)

      const editInput = await waitFor(() =>
        screen.getByTestId('cell-edit-input')
      )
      fireEvent.change(editInput, { target: { value: '=10/2' } })
      fireEvent.key('Enter')

      // エラーログが更新されることを確認
      await waitFor(() => {
        const updatedErrorItems = screen.queryAllByTestId(/error-item-/)
        expect(updatedErrorItems).toHaveLength(0)
      })

      // エラーカウンターが0になることを確認
      const errorCounter = screen.getByTestId('error-counter')
      expect(errorCounter).toHaveTextContent('エラー: 0件')
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

  async function inputFormulaToCell(cellTestId: string, formula: string) {
    const cell = screen.getByTestId(cellTestId)
    fireEvent.doubleClick(cell)

    const editInput = await waitFor(() =>
      screen.getByTestId('cell-edit-input')
    )
    fireEvent.change(editInput, { target: { value: formula } })
    fireEvent.key('Enter')

    await waitFor(() => {
      expect(screen.queryByTestId('cell-edit-input')).not.toBeInTheDocument()
    })
  }
})