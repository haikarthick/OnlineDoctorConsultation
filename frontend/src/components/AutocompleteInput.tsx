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

  // Highlight the matched substring using React nodes (never raw HTML) so
  // option text can never be interpreted as markup — prevents XSS if any
  // option list is ever sourced from user-generated content.
  const renderHighlighted = (opt: string) => {
    if (!value) return opt
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const parts = opt.split(new RegExp(`(${escaped})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === value.toLowerCase()
        ? <mark key={i}>{part}</mark>
        : <React.Fragment key={i}>{part}</React.Fragment>
    )
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
                {renderHighlighted(opt)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default AutocompleteInput
