import { useState, useEffect, useCallback, useRef } from 'react'
import apiService from '../services/api'

export default function VetSearchPicker({ onSelect, selectedVet, label, required }: {
  onSelect: (vet: any) => void
  selectedVet: any
  label?: string
  required?: boolean
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Load all vets on mount so the list is ready when user opens the dropdown
  useEffect(() => { doSearch('') }, [])

  const doSearch = useCallback(async (q: string) => {
    setSearching(true)
    try {
      const res = await apiService.searchVets(q)
      setResults(res.data || [])
    } catch { setResults([]) }
    setSearching(false)
  }, [])

  const handleInput = (val: string) => {
    setQuery(val)
    setShowDropdown(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(val), 300)
  }

  if (selectedVet) {
    return (
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#14532d' }}>
              👨‍⚕️ Dr. {selectedVet.first_name} {selectedVet.last_name}
              {selectedVet.is_verified && (
                <span style={{ marginLeft: 6, fontSize: 11, background: '#dcfce7', color: '#166534', borderRadius: 4, padding: '2px 6px' }}>✓ Verified</span>
              )}
              {selectedVet.is_available === false && (
                <span style={{ marginLeft: 6, fontSize: 11, background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '2px 6px' }}>Unavailable</span>
              )}
            </div>
            {selectedVet.clinic_name && (
              <div style={{ fontSize: 13, color: '#166534' }}>🏥 {selectedVet.clinic_name}</div>
            )}
            {selectedVet.specializations?.length > 0 && (
              <div style={{ fontSize: 12, color: '#64748b' }}>🎓 {selectedVet.specializations.join(', ')}</div>
            )}
            {selectedVet.license_number && (
              <div style={{ fontSize: 11, color: '#94a3b8' }}>License: {selectedVet.license_number}</div>
            )}
          </div>
          <button
            onClick={() => onSelect(null)}
            style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0 }}
          >✕ Change</button>
        </div>
      </div>
    )
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <label style={{ fontWeight: 500, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>
        {label || '👨‍⚕️ Referring To (Veterinarian)'}
        {required && <span style={{ color: '#dc2626', marginLeft: 3 }}>*</span>}
      </label>
      <input
        placeholder="Search by name, specialization, clinic, or license number..."
        value={query}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => { setShowDropdown(true); if (results.length === 0) doSearch('') }}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }}
      />
      {showDropdown && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff',
          border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.14)',
          maxHeight: 300, overflowY: 'auto', zIndex: 1000, marginTop: 4,
        }}>
          {searching && (
            <div style={{ padding: 12, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Searching...</div>
          )}
          {!searching && results.length === 0 && (
            <div style={{ padding: 12, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No veterinarians found</div>
          )}
          {!searching && results.length > 0 && (
            <div style={{ padding: '6px 12px', fontSize: 11, color: '#94a3b8', borderBottom: '1px solid #f3f4f6' }}>
              {results.length} veterinarian{results.length !== 1 ? 's' : ''} available
            </div>
          )}
          {results.map(v => (
            <div
              key={v.id}
              onClick={() => { onSelect(v); setQuery(''); setShowDropdown(false) }}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', transition: 'background .1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                👨‍⚕️ Dr. {v.first_name} {v.last_name}
                {v.is_verified && (
                  <span style={{ fontSize: 10, background: '#dcfce7', color: '#166534', borderRadius: 4, padding: '2px 5px' }}>✓ Verified</span>
                )}
                {v.is_available === false && (
                  <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '2px 5px' }}>Unavailable</span>
                )}
                {v.rating > 0 && (
                  <span style={{ fontSize: 11, color: '#f59e0b', marginLeft: 'auto' }}>⭐ {Number(v.rating).toFixed(1)}</span>
                )}
              </div>
              {v.clinic_name && (
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>🏥 {v.clinic_name}</div>
              )}
              {v.specializations?.length > 0 && (
                <div style={{ fontSize: 12, color: '#8b5cf6', marginTop: 1 }}>🎓 {v.specializations.join(', ')}</div>
              )}
              {v.license_number && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                  License: {v.license_number}
                  {v.years_of_experience > 0 ? ` • ${v.years_of_experience} yrs exp` : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
