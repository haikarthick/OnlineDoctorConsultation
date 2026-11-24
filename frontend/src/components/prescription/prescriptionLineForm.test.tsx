import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PrescriptionLineForm, { type RecentLine } from './PrescriptionLineForm'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o?.count !== undefined ? `${k}:${o.count}` : k) }) }))

const recent: RecentLine[] = [
  { name: 'Product A', kind: 'medicine', dosage: '5 ml', frequency: 'Once daily', treatmentDays: 3, withdrawalMilkDays: 4, withdrawalMeatDays: 28 },
]

const fill = (placeholder: string, value: string) => fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } })
const numberInputs = () => screen.getAllByRole('textbox').filter(el => (el as HTMLInputElement).inputMode === 'numeric') as HTMLInputElement[]

describe('PrescriptionLineForm', () => {
  const onAdd = vi.fn()
  beforeEach(() => onAdd.mockReset())

  it('a pet needs no label days', () => {
    render(<PrescriptionLineForm foodProducing={false} recent={[]} onAdd={onAdd} />)
    fill('prescriptionWriter.medicationName', 'Product B'); fill('prescriptionWriter.dosage', '1 tab'); fill('prescriptionWriter.frequency', 'Twice daily')
    fireEvent.click(screen.getByText('+ prescriptionWriter.addMedication'))
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd.mock.calls[0][0]).not.toHaveProperty('withdrawalMilkDays')
  })

  it('a food-producing animal cannot get a medicine line without the label days or an explicit none', () => {
    render(<PrescriptionLineForm foodProducing recent={[]} onAdd={onAdd} />)
    fill('prescriptionWriter.medicationName', 'Product B'); fill('prescriptionWriter.dosage', '1 tab'); fill('prescriptionWriter.frequency', 'Twice daily')
    fireEvent.click(screen.getByText('+ prescriptionWriter.addMedication'))
    expect(screen.getByRole('alert').textContent).toBe('withdrawal.errorDays')
    fireEvent.change(numberInputs()[0], { target: { value: '3' } })
    fireEvent.click(screen.getByText('+ prescriptionWriter.addMedication'))
    expect(screen.getByRole('alert').textContent).toBe('withdrawal.errorWithdrawal')
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('the none choice is stored as zero days for both', () => {
    render(<PrescriptionLineForm foodProducing recent={[]} onAdd={onAdd} />)
    fill('prescriptionWriter.medicationName', 'Product B'); fill('prescriptionWriter.dosage', '1 tab'); fill('prescriptionWriter.frequency', 'Twice daily')
    fireEvent.change(numberInputs()[0], { target: { value: '3' } })
    fireEvent.click(screen.getByLabelText('withdrawal.none'))
    fireEvent.click(screen.getByText('+ prescriptionWriter.addMedication'))
    expect(onAdd.mock.calls[0][0]).toMatchObject({ treatmentDays: 3, withdrawalNone: true, withdrawalMilkDays: 0, withdrawalMeatDays: 0 })
  })

  it("the vet's own recent medicine fills the form, label days included", () => {
    render(<PrescriptionLineForm foodProducing recent={recent} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('+ Product A'))
    fireEvent.click(screen.getByText('+ prescriptionWriter.addMedication'))
    expect(onAdd.mock.calls[0][0]).toMatchObject({ name: 'Product A', dosage: '5 ml', treatmentDays: 3, withdrawalMilkDays: 4, withdrawalMeatDays: 28 })
  })

  it('a diet line never asks for withdrawal days', () => {
    render(<PrescriptionLineForm foodProducing recent={[]} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('withdrawal.kind.diet'))
    expect(screen.queryByText('withdrawal.fromLabel')).toBeNull()
  })
})
