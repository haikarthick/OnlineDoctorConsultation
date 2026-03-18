import { useState, useEffect, useCallback, useRef } from 'react'
import apiService from '../services/api'

export default function AnimalSearchPicker({ onSelect, selectedAnimal, label }: {
  onSelect: (animal: any) => void; selectedAnimal: any; label?: string;
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

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const res = await apiService.searchWorkflowAnimals(q)
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

  if (selectedAnimal) {
    return (
      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '10px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0c4a6e' }}>🐾 {selectedAnimal.name}</div>
            <div style={{ fontSize: 13, color: '#0369a1' }}>{selectedAnimal.species}{selectedAnimal.breed ? ` — ${selectedAnimal.breed}` : ''}{selectedAnimal.weight ? ` • ${selectedAnimal.weight}kg` : ''}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Owner: {selectedAnimal.owner_first_name} {selectedAnimal.owner_last_name}{selectedAnimal.owner_phone ? ` • ${selectedAnimal.owner_phone}` : ''}</div>
          </div>
          <button onClick={() => onSelect(null)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>✕ Change</button>
        </div>
      </div>
    )
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <label style={{ fontWeight: 500, fontSize: 13, color: '#374151', marginBottom: 4, display: 'block' }}>{label || '🔍 Search Patient (Animal)'}</label>
      <input
        placeholder="Type animal name, owner name, or microchip..."
        value={query}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => { if (results.length) setShowDropdown(true) }}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }}
      />
      {showDropdown && (query.length >= 2) && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 240, overflowY: 'auto', zIndex: 100, marginTop: 4 }}>
          {searching && <div style={{ padding: 12, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Searching...</div>}
          {!searching && results.length === 0 && <div style={{ padding: 12, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No animals found</div>}
          {results.map(a => (
            <div key={a.id} onClick={() => { onSelect(a); setQuery(''); setShowDropdown(false) }}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', transition: 'background .1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>🐾 {a.name} <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 12 }}>({a.species}{a.breed ? ` — ${a.breed}` : ''})</span></div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Owner: {a.owner_first_name} {a.owner_last_name}{a.owner_phone ? ` • ${a.owner_phone}` : ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
