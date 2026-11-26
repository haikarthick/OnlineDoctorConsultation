import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RowActions, ConfirmDeleteSheet, EditFieldsSheet, missingRequired, numOrUndefined, textOrEmpty, textOrNull, type SheetField } from './RowActions'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts && Object.keys(opts).length ? `${key}|${JSON.stringify(opts)}` : key) }),
}))

describe('RowActions', () => {
  it('offers only the actions it is given, named for the row', () => {
    const onDelete = vi.fn()
    render(<RowActions name="Barn" onDelete={onDelete} />)
    expect(screen.queryByText('recordActions.edit')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /recordActions.deleteItem/ }))
    expect(onDelete).toHaveBeenCalled()
  })
  it('renders nothing with no actions', () => {
    const { container } = render(<RowActions name="x" />)
    expect(container.firstChild).toBeNull()
  })
})

describe('ConfirmDeleteSheet', () => {
  it('says what will be removed and only deletes after the confirm tap', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    const onDone = vi.fn()
    render(<ConfirmDeleteSheet open name="Barn" what="the sensor and its readings" onConfirm={onConfirm} onClose={onClose} onDone={onDone} />)
    expect(screen.getByText(/recordActions.willRemove/)).toHaveTextContent('the sensor and its readings')
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('recordActions.confirmDelete'))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalled()
  })
  it('keeps the sheet open and shows the server words on a refusal, never a status code', async () => {
    const onConfirm = vi.fn().mockRejectedValue({ response: { status: 403, data: { message: 'Your role on this farm (viewer) lets you see it but not add or change anything.' } } })
    const onClose = vi.fn()
    render(<ConfirmDeleteSheet open name="Barn" what="x" onConfirm={onConfirm} onClose={onClose} />)
    fireEvent.click(screen.getByText('recordActions.confirmDelete'))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('lets you see it but not add or change anything')
    expect(alert.textContent).not.toMatch(/403|status code/i)
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('EditFieldsSheet', () => {
  const fields: SheetField[] = [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'on', label: 'Active', type: 'checkbox' },
  ]
  it('asks for a missing required field in words and does not save', () => {
    const onSave = vi.fn()
    render(<EditFieldsSheet open title="Edit" fields={fields} initial={{ name: '', on: 'false' }} onSave={onSave} onClose={() => {}} />)
    fireEvent.click(screen.getByText('recordActions.save'))
    expect(screen.getByRole('alert')).toHaveTextContent('recordActions.fillRequired')
    expect(onSave).not.toHaveBeenCalled()
  })
  it('saves the edited values and closes', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<EditFieldsSheet open title="Edit" fields={fields} initial={{ name: 'Old', on: 'false' }} onSave={onSave} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'New' } })
    fireEvent.click(screen.getByLabelText('Active'))
    fireEvent.click(screen.getByText('recordActions.save'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onSave).toHaveBeenCalledWith({ name: 'New', on: 'true' })
  })
})

describe('payload helpers', () => {
  it('finds the empty required fields', () => {
    expect(missingRequired([{ key: 'a', label: 'A', type: 'text', required: true }], { a: '  ' })).toHaveLength(1)
  })
  it('maps empty text and numbers the way the server accepts them', () => {
    expect(numOrUndefined('')).toBeUndefined()
    expect(numOrUndefined('', true)).toBeNull()
    expect(numOrUndefined('4.5')).toBe(4.5)
    expect(numOrUndefined('abc')).toBeUndefined()
    expect(textOrEmpty('  hi ')).toBe('hi')
    expect(textOrNull('  ')).toBeNull()
  })
})
