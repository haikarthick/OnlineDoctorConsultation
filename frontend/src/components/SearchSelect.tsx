import React, { useState, useEffect, useRef, useCallback } from 'react'

export interface SearchSelectOption {
  value: string
  label: string
  sublabel?: string
}

interface SearchSelectProps {
  placeholder: string
  value: string
  displayValue: string
  onSelect: (value: string, label: string) => void
  onClear: () => void
  onSearch: (q: string) => Promise<SearchSelectOption[]>
  loadOnOpen?: boolean
  required?: boolean
  disabled?: boolean
  className?: string
}

const SearchSelect: React.FC<SearchSelectProps> = ({
  placeholder,
  value,
  displayValue,
  onSelect,
  onClear,
  onSearch,
  loadOnOpen = false,
  required = false,
  disabled = false,
  className,
}) => {
  const [inputText, setInputText] = useState('')
  const [options, setOptions] = useState<SearchSelectOption[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // When a value is selected, show its displayValue in the input
  useEffect(() => {
    if (value) {
      setInputText(displayValue)
    } else {
      setInputText('')
    }
  }, [value, displayValue])

  const runSearch = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const results = await onSearch(q)
      setOptions(results)
    } catch {
      setOptions([])
    } finally {
      setLoading(false)
    }
  }, [onSearch])

  const handleFocus = () => {
    if (disabled) return
    setOpen(true)
    if (loadOnOpen && !value) {
      runSearch('')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setInputText(q)

    // If user clears selection by typing
    if (value) {
      onClear()
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (q.length >= 1 || loadOnOpen) {
        runSearch(q)
      } else {
        setOptions([])
      }
    }, 250)
  }

  const handleSelect = (opt: SearchSelectOption) => {
    onSelect(opt.value, opt.label)
    setInputText(opt.label)
    setOpen(false)
    setOptions([])
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClear()
    setInputText('')
    setOptions([])
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }} className={className}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          style={{
            width: '100%',
            padding: '10px 36px 10px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 14,
            background: disabled ? '#f9fafb' : '#fff',
            color: '#111827',
            outline: 'none',
            boxSizing: 'border-box',
          }}
          autoComplete="off"
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              position: 'absolute',
              right: 8,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#9ca3af',
              fontSize: 16,
              lineHeight: 1,
              padding: '2px 4px',
            }}
            aria-label="Clear selection"
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: '#fff',
          border: '1px solid #d1d5db',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          zIndex: 1000,
          maxHeight: 200,
          overflowY: 'auto',
          marginTop: 4,
        }}>
          {loading && (
            <div style={{ padding: '10px 14px', color: '#6b7280', fontSize: 14 }}>
              Searching...
            </div>
          )}
          {!loading && options.length === 0 && (
            <div style={{ padding: '10px 14px', color: '#9ca3af', fontSize: 14 }}>
              {inputText.length > 0 || loadOnOpen ? 'No results found' : 'Type to search...'}
            </div>
          )}
          {!loading && options.map(opt => (
            <div
              key={opt.value}
              onMouseDown={() => handleSelect(opt)}
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                borderBottom: '1px solid #f3f4f6',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              <div style={{ fontWeight: 500, fontSize: 14, color: '#111827' }}>{opt.label}</div>
              {opt.sublabel && (
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{opt.sublabel}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default SearchSelect
