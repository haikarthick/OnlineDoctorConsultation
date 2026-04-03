import React, { useState, useRef, useEffect } from 'react'
import './AutocompleteInput.css'

interface AutocompleteInputProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  className?: string
  emptyMessage?: string
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChange,
  options,
  placeholder,
  className,
  emptyMessage,
}) => {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = value
    ? options.filter(o => o.toLowerCase().includes(value.toLowerCase()))
    : options

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setHighlighted(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open && e.key !== 'Escape') setOpen(true)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault()
      onChange(filtered[highlighted])
      setOpen(false)
      setHighlighted(-1)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setHighlighted(-1)
    }
  }

  const handleSelect = (opt: string) => {
    onChange(opt)
    setOpen(false)
    setHighlighted(-1)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setOpen(false)
    setHighlighted(-1)
  }

  return (
    <div className={`autocomplete-container ${className || ''}`} ref={containerRef}>
      <div className="autocomplete-input-wrap">
        <span className="autocomplete-icon">🔍</span>
        <input
          className="module-input autocomplete-input"
          value={value}
          onChange={e => {
            onChange(e.target.value)
            setOpen(true)
            setHighlighted(-1)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
        />
        {value && (
          <button className="autocomplete-clear" onClick={handleClear} tabIndex={-1} type="button">
            ×
          </button>
        )}
      </div>
      {open && (
        <div className="autocomplete-dropdown">
          {filtered.length === 0 ? (
            <div className="autocomplete-empty">{emptyMessage || 'No matches found'}</div>
          ) : (
            filtered.slice(0, 50).map((opt, i) => (
              <div
                key={opt}
                className={`autocomplete-option ${i === highlighted ? 'highlighted' : ''}`}
                onMouseDown={() => handleSelect(opt)}
                onMouseEnter={() => setHighlighted(i)}
              >
                {value ? (
                  <span dangerouslySetInnerHTML={{
                    __html: opt.replace(
                      new RegExp(`(${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                      '<mark>$1</mark>'
                    )
                  }} />
                ) : opt}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default AutocompleteInput
