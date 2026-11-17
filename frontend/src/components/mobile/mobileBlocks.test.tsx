import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react'
import { useState } from 'react'
import { BottomTabBar } from './BottomTabBar'
import { NumberStepper, parseStepperValue } from './NumberStepper'
import { DateQuick, localIsoDate } from './DateQuick'
import { ChipSelect } from './ChipSelect'
import { StepForm } from './StepForm'
import { SaveState } from './SaveState'
import { useSaveAction } from '../../hooks/useSaveAction'
import type { MenuItem } from '../../types'

let mockRole = 'farmer'
vi.mock('react-i18next', () => ({
  // key echo, with interpolation values appended so Step X of Y is checkable
  useTranslation: () => ({ t: (key: string, opts?: { defaultValue?: string; current?: number; total?: number }) => (opts?.current ? `${key}:${opts.current}/${opts.total}` : (opts?.defaultValue ?? key)) }),
}))
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u', role: mockRole, roles: [mockRole] } }) }))

const item = (id: string, path: string): MenuItem => ({ id, label: id.toUpperCase(), icon: '*', path, roles: [] as never })
const FARM_MENU = [item('dashboard', '/dashboard'), item('animals', '/animals'), item('herd-medical', '/herd-medical'), item('animal-groups', '/animal-groups'), item('breeding', '/breeding'), item('settings', '/settings')]

describe('BottomTabBar', () => {
  it('draws five cells: two tabs, the "+" in the middle, one tab, "More" - for a role with quick actions', () => {
    mockRole = 'farmer'
    render(<BottomTabBar items={FARM_MENU} currentPath="/animals" onNavigate={() => {}} moreOpen={false} onMore={() => {}} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(5) // 3 tabs + "+" + More
    expect(buttons[2]).toHaveAttribute('aria-label', 'mobileUi.tabs.add')
  })

  it('marks the current screen and nothing else', () => {
    mockRole = 'farmer'
    render(<BottomTabBar items={FARM_MENU} currentPath="/animals/7" onNavigate={() => {}} moreOpen={false} onMore={() => {}} />)
    const current = screen.getAllByRole('button').filter(b => b.getAttribute('aria-current') === 'page')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('ANIMALS')
  })

  it('navigates from a tab and from a quick action, closing the sheet', () => {
    mockRole = 'farmer'
    const go = vi.fn()
    render(<BottomTabBar items={FARM_MENU} currentPath="/dashboard" onNavigate={go} moreOpen={false} onMore={() => {}} />)
    fireEvent.click(screen.getAllByText('ANIMALS')[0])
    expect(go).toHaveBeenLastCalledWith('/animals')
    fireEvent.click(screen.getByLabelText('mobileUi.tabs.add'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    const breeding = screen.getAllByText('BREEDING')
    fireEvent.click(breeding[breeding.length - 1])
    expect(go).toHaveBeenLastCalledWith('/breeding')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('"More" toggles the full menu and Escape closes the sheet', () => {
    mockRole = 'farmer'
    const more = vi.fn()
    render(<BottomTabBar items={FARM_MENU} currentPath="/dashboard" onNavigate={() => {}} moreOpen={false} onMore={more} />)
    fireEvent.click(screen.getByText('mobileUi.tabs.more'))
    expect(more).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByLabelText('mobileUi.tabs.add'))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a role with no quick actions has no "+"', () => {
    mockRole = 'pharmacist'
    render(<BottomTabBar items={[item('dashboard', '/dashboard'), item('pharmacy', '/pharmacy'), item('settings', '/settings')]} currentPath="/dashboard" onNavigate={() => {}} moreOpen={false} onMore={() => {}} />)
    expect(screen.queryByLabelText('mobileUi.tabs.add')).toBeNull()
  })

  it('renders nothing when there is nothing to show', () => {
    mockRole = 'farmer'
    const { container } = render(<BottomTabBar items={[]} currentPath="/" onNavigate={() => {}} moreOpen={false} onMore={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('NumberStepper', () => {
  const Harness = ({ start = '8.5', ...rest }: { start?: string; integer?: boolean; min?: number; max?: number; step?: number }) => {
    const [v, setV] = useState(start)
    return <NumberStepper label="Litres" value={v} onChange={setV} quickValues={[8, 9]} {...rest} />
  }

  it('steps up and down by the step, and never below the minimum', () => {
    render(<Harness start="1" step={0.5} />)
    const input = screen.getByLabelText('Litres') as HTMLInputElement
    fireEvent.click(screen.getByLabelText('mobileUi.stepper.more'))
    expect(input.value).toBe('1.5')
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByLabelText('mobileUi.stepper.less')) // 1.5 -> 1 -> 0.5 -> 0
    expect(input.value).toBe('0')
    expect(screen.getByLabelText('mobileUi.stepper.less')).toBeDisabled()
  })

  it('opens the right keypad and refuses letters', () => {
    render(<Harness />)
    const input = screen.getByLabelText('Litres') as HTMLInputElement
    expect(input).toHaveAttribute('inputmode', 'decimal')
    fireEvent.change(input, { target: { value: '9x' } })
    expect(input.value).toBe('8.5')
    fireEvent.change(input, { target: { value: '9,25' } }) // decimal comma from a phone keypad
    expect(input.value).toBe('9.25')
  })

  it('whole-number mode uses the digit keypad and rejects a decimal point', () => {
    render(<Harness start="3" integer />)
    const input = screen.getByLabelText('Litres') as HTMLInputElement
    expect(input).toHaveAttribute('inputmode', 'numeric')
    fireEvent.change(input, { target: { value: '3.5' } })
    expect(input.value).toBe('3')
  })

  it('a quick value sets the number in one tap', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('9'))
    expect((screen.getByLabelText('Litres') as HTMLInputElement).value).toBe('9')
  })

  it('parses empty and garbage as null', () => {
    expect(parseStepperValue('')).toBeNull()
    expect(parseStepperValue('abc')).toBeNull()
    expect(parseStepperValue('7,5')).toBe(7.5)
  })
})

describe('DateQuick', () => {
  it('uses the local calendar day, not UTC', () => {
    expect(localIsoDate(0, new Date(2026, 10, 15, 23, 59))).toBe('2026-11-15')
    expect(localIsoDate(-1, new Date(2026, 10, 1, 0, 1))).toBe('2026-10-31')
  })

  it('selects today and yesterday in one tap', () => {
    const onChange = vi.fn()
    render(<DateQuick label="Day" value={localIsoDate(0)} onChange={onChange} />)
    expect(screen.getByText('mobileUi.date.today')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByText('mobileUi.date.yesterday'))
    expect(onChange).toHaveBeenCalledWith(localIsoDate(-1))
  })

  // Regression (2026-11-17): the date field is invisible and sits over the "Other" chip. Desktop
  // browsers only focus a date segment on click, so "Other date" appeared to do nothing.
  it('opens the calendar when "Other date" is clicked', () => {
    const showPicker = vi.fn()
    const original = HTMLInputElement.prototype.showPicker
    HTMLInputElement.prototype.showPicker = showPicker
    try {
      const { container } = render(<DateQuick label="Day" value={localIsoDate(0)} onChange={() => {}} />)
      fireEvent.click(container.querySelector('input[type="date"]') as HTMLInputElement)
      expect(showPicker).toHaveBeenCalledTimes(1)
    } finally {
      HTMLInputElement.prototype.showPicker = original
    }
  })

  it('does not break where the browser has no calendar API', () => {
    const original = HTMLInputElement.prototype.showPicker
    // @ts-expect-error simulating an older browser
    HTMLInputElement.prototype.showPicker = undefined
    try {
      const { container } = render(<DateQuick label="Day" value={localIsoDate(0)} onChange={() => {}} />)
      expect(() => fireEvent.click(container.querySelector('input[type="date"]') as HTMLInputElement)).not.toThrow()
    } finally {
      HTMLInputElement.prototype.showPicker = original
    }
  })
})

describe('ChipSelect', () => {
  it('selects, and clears an optional choice by tapping it again', () => {
    const onChange = vi.fn(); const onClear = vi.fn()
    render(<ChipSelect label="Which animal?" options={[{ value: 'cow', label: 'Cow' }, { value: 'bull', label: 'Bull' }]} value="cow" onChange={onChange} allowClear onClear={onClear} />)
    expect(screen.getByRole('group', { name: 'Which animal?' })).toBeInTheDocument()
    fireEvent.click(screen.getByText('Bull'))
    expect(onChange).toHaveBeenCalledWith('bull')
    fireEvent.click(screen.getByText('Cow'))
    expect(onClear).toHaveBeenCalled()
  })
})

describe('StepForm', () => {
  const Harness = ({ blocked = '', onSubmit = () => {} }: { blocked?: string; onSubmit?: () => void }) => {
    const [i, setI] = useState(0)
    return <StepForm steps={[{ id: 'a', title: 'One', content: <p>first</p>, blockedReason: blocked }, { id: 'b', title: 'Two', content: <p>second</p> }]} current={i} onStepChange={setI} onSubmit={onSubmit} submitLabel="Finish" />
  }

  it('goes forward and back, and submits only from the last step', () => {
    const submit = vi.fn()
    render(<Harness onSubmit={submit} />)
    expect(screen.getByText('first')).toBeInTheDocument()
    fireEvent.click(screen.getByText('mobileUi.step.next'))
    expect(screen.getByText('second')).toBeInTheDocument()
    expect(submit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('mobileUi.step.back'))
    expect(screen.getByText('first')).toBeInTheDocument()
    fireEvent.click(screen.getByText('mobileUi.step.next'))
    fireEvent.click(screen.getByText('Finish'))
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('says why it cannot go on instead of failing silently', () => {
    render(<Harness blocked="Choose an animal first" />)
    expect(screen.getByText('Choose an animal first')).toBeInTheDocument()
    expect(screen.getByText('mobileUi.step.next')).toBeDisabled()
  })
})

describe('useSaveAction + SaveState', () => {
  it('ignores a second tap while saving (no duplicate record)', async () => {
    let release: () => void = () => {}
    const save = vi.fn(() => new Promise<void>(res => { release = res }))
    const { result } = renderHook(() => useSaveAction(save, 'fallback'))
    let first: Promise<boolean> = Promise.resolve(false)
    act(() => { first = result.current.run() })
    await act(async () => { await result.current.run() })
    expect(save).toHaveBeenCalledTimes(1)
    await act(async () => { release(); await first })
    expect(result.current.status).toBe('saved')
  })

  it('shows the server\'s own message, keeps the arguments, and retries', async () => {
    const save = vi.fn()
      .mockRejectedValueOnce({ response: { data: { error: { message: 'Lakshmi is under medicine withdrawal' } } } })
      .mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useSaveAction(save, 'fallback'))
    await act(async () => { await result.current.run('payload') })
    expect(result.current.status).toBe('failed')
    expect(result.current.error).toBe('Lakshmi is under medicine withdrawal')
    expect(result.current.offline).toBe(false)
    await act(async () => { await result.current.retry() })
    expect(save).toHaveBeenLastCalledWith('payload')
    expect(result.current.status).toBe('saved')
  })

  it('treats a request that never reached the server as offline, not as an error', async () => {
    const save = vi.fn().mockRejectedValue(new Error('Network Error'))
    const { result } = renderHook(() => useSaveAction(save, 'fallback'))
    await act(async () => { await result.current.run() })
    expect(result.current.offline).toBe(true)
    render(<SaveState status="failed" offline error={result.current.error} onRetry={() => {}} />)
    expect(screen.getByRole('alert')).toHaveClass('is-offline')
    expect(screen.getByText('mobileUi.save.retry')).toBeInTheDocument()
  })
})
