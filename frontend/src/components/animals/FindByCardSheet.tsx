import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { BottomSheet } from '../mobile/BottomSheet'
import { useMasterData } from '../../context/MasterDataContext'
import { codedMessage } from '../../utils/codedMessage'
import type { AnimalData } from './animalsShared'
import '../mobile/ownerTools.css'

interface Props {
  open: boolean
  onClose: () => void
  /** The vet chose to open the animal that was found (the page shows its detail view). */
  onOpen: (animal: AnimalData) => void
}

/**
 * A vet types the unique ID card number of an animal and, ONLY if the platform already lets this vet see that animal (an appointment,
 * a hospital share, a consent), the animal is shown. Anything else - no such card, or a card the vet may not open - gets the SAME one
 * sentence, so the lookup can never tell a vet that an animal exists. The server decides; this screen never guesses.
 */
export function FindByCardSheet({ open, onClose, onOpen }: Props) {
  const { t } = useTranslation()
  const { speciesLabel, breedLabel } = useMasterData()
  const [card, setCard] = useState('')
  const [busy, setBusy] = useState(false)
  const [found, setFound] = useState<AnimalData | null>(null)
  const [canChange, setCanChange] = useState<boolean | null>(null)
  const [message, setMessage] = useState('')

  const reset = () => { setCard(''); setFound(null); setCanChange(null); setMessage('') }
  const close = () => { reset(); onClose() }

  const search = async () => {
    const uid = card.trim()
    if (!uid || busy) return
    setBusy(true); setMessage(''); setFound(null); setCanChange(null)
    try {
      const res = await apiService.searchAnimalByUniqueId(uid)
      const animal = (res?.data || null) as AnimalData | null
      if (!animal) { setMessage(t('animalLookup.errors.AL_NOT_SHARED')); return }
      setFound(animal)
      try {
        const access = await apiService.checkAnimalAccess(animal.id)
        setCanChange(!!access?.data?.canChange)
      } catch { setCanChange(null) }
    } catch (err) {
      setMessage(codedMessage(err, 'animalLookup', 'animalLookup.failed'))
    } finally { setBusy(false) }
  }

  return (
    <BottomSheet open={open} title={t('animalLookup.title')} onClose={close}>
      <div className="ot-sheet">
        <form className="ot-form" onSubmit={e => { e.preventDefault(); void search() }}>
          <p className="ot-muted">{t('animalLookup.hint')}</p>
          <label>{t('animalLookup.label')}
            <input value={card} onChange={e => setCard(e.target.value)} autoComplete="off" autoCapitalize="characters" placeholder={t('animalLookup.placeholder')} />
          </label>
          <div className="ot-actions">
            <button type="submit" className="module-btn primary" disabled={busy || !card.trim()}>{busy ? t('animalLookup.searching') : t('animalLookup.search')}</button>
          </div>
        </form>

        {message && <div className="ot-note" role="alert">{message}</div>}

        {found && (
          <section className="ot-card" aria-label={t('animalLookup.resultTitle')}>
            <h3>{found.name}</h3>
            <div className="ot-muted">
              {[speciesLabel(found.species, t), found.breed ? breedLabel(found.species, found.breed) : ''].filter(Boolean).join(' · ')}
            </div>
            {found.uniqueId && <div className="ot-muted">{t('animalLookup.cardNumber', { id: found.uniqueId })}</div>}
            {found.ownerName && <div className="ot-muted">{t('animalLookup.owner', { name: found.ownerName })}</div>}
            {canChange === false && <div className="ot-note">{t('animalLookup.readOnly')}</div>}
            <div className="ot-actions">
              <button type="button" className="module-btn primary" onClick={() => { const a = found; close(); onOpen(a) }}>{t('animalLookup.open')}</button>
            </div>
          </section>
        )}
      </div>
    </BottomSheet>
  )
}
