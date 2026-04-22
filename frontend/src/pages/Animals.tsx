import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import apiService from '../services/api'
import AutocompleteInput from '../components/AutocompleteInput'
import './ModulePage.css'
import { useTranslation } from 'react-i18next'
import { useScrollToForm } from '../hooks/useScrollToForm'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

// ─── Breed Database by Species ──────────────────────────────
// ── Common Pets ──────────────────────────────────────────────────────
const BREED_DATABASE: Record<string, string[]> = {
  Dog: ['Indian Pariah', 'Mudhol Hound', 'Rajapalayam', 'Kanni', 'Chippiparai', 'Kombai', 'Bakharwal', 'Rampur Greyhound', 'Himalayan Sheepdog', 'Labrador Retriever', 'Golden Retriever', 'German Shepherd', 'Beagle', 'Pug', 'Dachshund', 'Rottweiler', 'Doberman Pinscher', 'Great Dane', 'Saint Bernard', 'Siberian Husky', 'Shih Tzu', 'Pomeranian', 'Cocker Spaniel', 'Boxer', 'Dalmatian', 'Border Collie', 'Maltese', 'Poodle', 'Bichon Frise', 'German Spitz', 'Lhasa Apso', 'Chow Chow', 'Bulldog', 'French Bulldog', 'Yorkshire Terrier', 'Mixed Breed', 'Other'],
  Cat: ['Persian', 'Siamese', 'Bengal', 'Maine Coon', 'Russian Blue', 'British Shorthair', 'Scottish Fold', 'Ragdoll', 'Himalayan', 'Turkish Angora', 'Bombay', 'American Shorthair', 'Abyssinian', 'Burmese', 'Devon Rex', 'Indian Domestic', 'Mixed Breed', 'Other'],
  // ── Small Pets ──────────────────────────────────────────────────────
  Rabbit: ['New Zealand White', 'Dutch', 'Rex', 'Angora', 'Mini Lop', 'Holland Lop', 'Flemish Giant', 'Lionhead', 'Himalayan', 'Mixed Breed', 'Other'],
  Hamster: ['Syrian (Golden)', 'Dwarf Campbell', 'Dwarf Winter White', 'Roborovski', 'Chinese', 'Mixed', 'Other'],
  'Guinea Pig': ['American', 'Abyssinian', 'Peruvian', 'Silkie', 'Teddy', 'Texel', 'Mixed', 'Other'],
  Gerbil: ['Mongolian', 'Fat-tailed', 'Mixed', 'Other'],
  Chinchilla: ['Standard Grey', 'White', 'Beige', 'Black Velvet', 'Violet', 'Mixed', 'Other'],
  Ferret: ['Sable', 'Albino', 'Dark-eyed White', 'Silver', 'Cinnamon', 'Mixed', 'Other'],
  Hedgehog: ['African Pygmy', 'European', 'Long-eared', 'Mixed', 'Other'],
  'Sugar Glider': ['Classic Grey', 'Leucistic', 'Albino', 'Black Beauty', 'Mixed', 'Other'],
  // ── Birds ──────────────────────────────────────────────────────────
  Parrot: ['African Grey', 'Blue and Gold Macaw', 'Green Wing Macaw', 'Scarlet Macaw', 'Cockatoo', 'Yellow-naped Amazon', 'Blue-fronted Amazon', 'Eclectus', 'Sun Conure', 'Green Cheek Conure', 'Caique', 'Alexandrine Parakeet', 'Rose-ringed Parakeet', 'Mixed', 'Other'],
  Budgerigar: ['English Budgie', 'American Budgie', 'Australian Budgie', 'Lutino', 'Albino', 'Pied', 'Mixed', 'Other'],
  Cockatiel: ['Normal Grey', 'Lutino', 'Pearl', 'Cinnamon', 'Pied', 'Whiteface', 'Mixed', 'Other'],
  Lovebird: ['Peach-faced', "Fischer's", 'Black-masked', 'Nyasa', 'Black-cheeked', 'Mixed', 'Other'],
  Finch: ['Zebra Finch', 'Society Finch', 'Gouldian Finch', 'Java Sparrow', 'Star Finch', 'Mixed', 'Other'],
  Canary: ['Yorkshire', 'Border', 'Roller', 'Red Factor', 'Gloster', 'Mixed', 'Other'],
  Mynah: ['Common Hill Mynah', 'Bank Mynah', 'Jungle Mynah', 'Mixed', 'Other'],
  Pigeon: ['Fantail', 'Jacobin', 'Tumbler', 'King', 'Racing Homer', 'Indian Fantail', 'Mixed', 'Other'],
  Bird: ['Mixed / Unknown', 'Other'],
  // ── Reptiles ───────────────────────────────────────────────────────
  Tortoise: ['Indian Star Tortoise', 'Russian Tortoise', "Hermann's Tortoise", 'Sulcata', 'Red-footed', 'Mixed', 'Other'],
  Turtle: ['Red-eared Slider', 'Painted Turtle', 'Map Turtle', 'Box Turtle', 'Mixed', 'Other'],
  Gecko: ['Leopard Gecko', 'Crested Gecko', 'African Fat-tailed', 'Tokay', 'Day Gecko', 'Mixed', 'Other'],
  'Bearded Dragon': ['Inland/Central', "Rankin's Dragon", 'Mixed', 'Other'],
  Chameleon: ['Veiled', 'Panther', "Jackson's", "Fischer's", 'Mixed', 'Other'],
  Snake: ['Ball Python', 'Corn Snake', 'King Snake', 'Milk Snake', 'Boa Constrictor', 'Mixed', 'Other'],
  // ── Amphibians ─────────────────────────────────────────────────────
  Frog: ['African Dwarf', 'Pacman (Horned)', 'Tree Frog', "White's Tree Frog", 'Mixed', 'Other'],
  Axolotl: ['Wild Type', 'Leucistic', 'Golden Albino', 'Melanoid', 'Axanthic', 'Mixed', 'Other'],
  // ── Ornamental Fish ────────────────────────────────────────────────
  'Ornamental Fish': ['Betta', 'Guppy', 'Mollies', 'Platy', 'Swordtail', 'Tetra', 'Angelfish', 'Discus', 'Cichlid', 'Clownfish', 'Mixed', 'Other'],
  Koi: ['Kohaku', 'Sanke', 'Showa', 'Bekko', 'Asagi', 'Ogon', 'Butterfly Koi', 'Mixed', 'Other'],
  Arowana: ['Silver', 'Golden', 'Red', 'Black', 'Pearl', 'Mixed', 'Other'],
  Goldfish: ['Common', 'Comet', 'Fantail', 'Oranda', 'Ryukin', 'Black Moor', 'Telescope', 'Bubble Eye', 'Mixed', 'Other'],
  // ── Livestock / Farm ───────────────────────────────────────────────
  Cattle: ['Gir', 'Sahiwal', 'Red Sindhi', 'Tharparkar', 'Ongole', 'Hallikar', 'Khillari', 'Deoni', 'Kangayam', 'Umblachery', 'Malnad Gidda', 'Punganur', 'Vechur', 'Hariana', 'Rathi', 'Holstein Friesian (HF)', 'Jersey', 'Brown Swiss', 'Simmental', 'Mixed Breed', 'Other'],
  Buffalo: ['Murrah', 'Surti', 'Mehsana', 'Jaffarabadi', 'Nili-Ravi', 'Pandharpuri', 'Marathwadi', 'Nagpuri', 'Toda (Nilgiri)', 'Mixed', 'Other'],
  Horse: ['Marwari', 'Kathiawari', 'Manipuri Pony', 'Bhutia', 'Spiti', 'Zanskari', 'Thoroughbred', 'Arabian', 'Quarter Horse', 'Warmblood', 'Standardbred', 'Mixed Breed', 'Other'],
  Donkey: ['Indian Donkey', 'Halari', 'Spiti', 'Mixed', 'Other'],
  Sheep: ['Nellore', 'Deccani', 'Mandya', 'Bellary', 'Madras Red', 'Coimbatore', 'Mecheri', 'Ramnad White', 'Vembur', 'Nilgiri', 'Korriedale', 'Garole', 'Merino', 'Suffolk', 'Rambouillet', 'Mixed Breed', 'Other'],
  Goat: ['Jamunapari', 'Barbari', 'Sirohi', 'Black Bengal', 'Osmanabadi', 'Salem Black', 'Malabari', 'Sangamneri', 'Ganjam', 'Kanniadu', 'Boer', 'Alpine', 'Saanen', 'Nubian', 'Angora', 'Mixed Breed', 'Other'],
  Pig: ['Desi (Indigenous)', 'Ghungroo', 'Niang Megha', 'Yorkshire (Large White)', 'Landrace', 'Duroc', 'Hampshire', 'Berkshire', 'Mixed Breed', 'Other'],
  Camel: ['Dromedary (One-humped)', 'Bactrian (Two-humped)', 'Mixed', 'Other'],
  Yak: ['Domestic Yak', 'Mixed', 'Other'],
  Deer: ['Spotted Deer (Chital)', 'Sambhar', 'Barking Deer (Muntjac)', 'Mixed', 'Other'],
  // ── Poultry ────────────────────────────────────────────────────────
  Chicken: ['Aseel', 'Kadaknath', 'Ghagus', 'Naked Neck', 'Kalinga Brown', 'Vanaraja', 'Grampriya', 'Nicobari', 'Broiler', 'White Leghorn', 'Rhode Island Red', 'Plymouth Rock', 'Sussex', 'Australorp', 'Mixed Breed', 'Other'],
  Duck: ['Indian Runner', 'Khaki Campbell', 'Pekin', 'Muscovy', 'Rouen', 'Mixed', 'Other'],
  Turkey: ['Broad-breasted White', 'Bronze', 'Bourbon Red', 'Narragansett', 'Mixed', 'Other'],
  Quail: ['Japanese', 'Bobwhite', 'California', 'Coturnix', 'Mixed', 'Other'],
  Emu: ['Australian Emu', 'Other'],
  Ostrich: ['Common Ostrich', 'Other'],
  Peacock: ['Indian Peafowl (Blue)', 'White Peafowl', 'Green Peafowl', 'Mixed', 'Other'],
  // ── Exotic Large ───────────────────────────────────────────────────
  Llama: ['Suri', 'Huacaya', 'Mixed', 'Other'],
  Alpaca: ['Suri', 'Huacaya', 'Mixed', 'Other'],
  // ── Other ──────────────────────────────────────────────────────────
  Other: [],
}

const SPECIES_CATEGORIES: Array<{ label: string; species: string[] }> = [
  { label: 'Common Pets', species: ['Dog', 'Cat'] },
  { label: 'Small Pets', species: ['Rabbit', 'Hamster', 'Guinea Pig', 'Gerbil', 'Chinchilla', 'Ferret', 'Hedgehog', 'Sugar Glider'] },
  { label: 'Birds', species: ['Parrot', 'Budgerigar', 'Cockatiel', 'Lovebird', 'Finch', 'Canary', 'Mynah', 'Pigeon', 'Bird'] },
  { label: 'Reptiles', species: ['Tortoise', 'Turtle', 'Gecko', 'Bearded Dragon', 'Chameleon', 'Snake'] },
  { label: 'Amphibians', species: ['Frog', 'Axolotl'] },
  { label: 'Ornamental Fish', species: ['Ornamental Fish', 'Koi', 'Arowana', 'Goldfish'] },
  { label: 'Livestock / Farm', species: ['Cattle', 'Buffalo', 'Horse', 'Donkey', 'Sheep', 'Goat', 'Pig', 'Camel', 'Yak', 'Deer'] },
  { label: 'Poultry', species: ['Chicken', 'Duck', 'Turkey', 'Quail', 'Emu', 'Ostrich', 'Peacock'] },
  { label: 'Exotic Large', species: ['Llama', 'Alpaca'] },
  { label: 'Other', species: ['Other'] },
]

const SPECIES_ICONS: Record<string, string> = {
  // Common pets
  Dog: '🐕', Cat: '🐈',
  // Small pets
  Rabbit: '🐰', Hamster: '🐹', 'Guinea Pig': '🐾', Gerbil: '🐀',
  Chinchilla: '🐭', Ferret: '🦡', Hedgehog: '🦔', 'Sugar Glider': '🦘',
  // Birds
  Parrot: '🦜', Budgerigar: '🦜', Cockatiel: '🦜', Lovebird: '💚',
  Finch: '🐦', Canary: '🐦', Mynah: '🐦', Pigeon: '🕊️', Bird: '🐦',
  // Reptiles
  Tortoise: '🐢', Turtle: '🐢', Gecko: '🦎', 'Bearded Dragon': '🦎',
  Chameleon: '🦎', Snake: '🐍',
  // Amphibians
  Frog: '🐸', Axolotl: '🦎',
  // Fish
  'Ornamental Fish': '🐠', Koi: '🐟', Arowana: '🐟', Goldfish: '🐡',
  // Farm/Livestock
  Cattle: '🐄', Buffalo: '🐃', Horse: '🐴', Donkey: '🫏',
  Sheep: '🐑', Goat: '🐐', Pig: '🐷', Camel: '🐪', Yak: '🐂', Deer: '🦌',
  // Poultry
  Chicken: '🐔', Duck: '🦆', Turkey: '🦃', Quail: '🐦',
  Emu: '🦤', Ostrich: '🦢', Peacock: '🦚',
  // Exotic large
  Llama: '🦙', Alpaca: '🦙',
  // Other
  Other: '🐾',
}

// Species that commonly use ear tags / registration numbers
const EAR_TAG_SPECIES = ['Cattle', 'Buffalo', 'Sheep', 'Goat', 'Pig', 'Horse', 'Donkey', 'Camel', 'Yak', 'Deer', 'Emu', 'Ostrich', 'Peacock', 'Llama', 'Alpaca']

interface AnimalData {
  id: string; uniqueId?: string; name: string; species: string; breed?: string;
  dateOfBirth?: string; gender?: string; weight?: number; color?: string;
  microchipId?: string; earTagId?: string; registrationNumber?: string;
  isNeutered?: boolean; insuranceProvider?: string; insurancePolicyNumber?: string;
  insuranceExpiry?: string; medicalNotes?: string; ownerName?: string;
  enterpriseId?: string; groupId?: string; enterpriseName?: string; groupName?: string; groupColor?: string;
}

interface EnterpriseOption { id: string; name: string }
interface GroupOption { id: string; name: string }

const Animals: React.FC = () => {
  const { t } = useTranslation()

  const { user } = useAuth()
  const { formatDate } = useSettings()
  const navigate = useNavigate()
  const [animals, setAnimals] = useState<AnimalData[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const formRef = useScrollToForm(showForm)
  const [editingAnimal, setEditingAnimal] = useState<AnimalData | null>(null)
  const [detailAnimal, setDetailAnimal] = useState<AnimalData | null>(null)
  const [formData, setFormData] = useState({
    name: '', species: '', breed: '', customBreed: '', gender: '', weight: '', color: '',
    dateOfBirth: '', microchipId: '', earTagId: '', registrationNumber: '',
    isNeutered: false, insuranceProvider: '', insurancePolicyNumber: '', insuranceExpiry: '',
    medicalNotes: '', enterpriseId: '', groupId: ''
  })
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [speciesFilter, setSpeciesFilter] = useState('')
  const [enterpriseFilter, setEnterpriseFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [vetView, setVetView] = useState<'my-pets' | 'patients'>('my-pets')

  // Enterprise / group options for farmer role
  const [enterpriseOptions, setEnterpriseOptions] = useState<EnterpriseOption[]>([])
  const [groupOptions, setGroupOptions] = useState<GroupOption[]>([])

  const isVet = user?.role === 'veterinarian'
  const isAdmin = user?.role === 'admin'
  const isFarmer = user?.role === 'farmer'
  const isPetOwner = user?.role === 'pet_owner'
  const canManageAnimals = isPetOwner || isFarmer || (isVet && vetView === 'my-pets')

  const breeds = useMemo(() => BREED_DATABASE[formData.species] || [], [formData.species])
  const showEarTag = EAR_TAG_SPECIES.includes(formData.species)

  // Load enterprises for farmer
  useEffect(() => {
    if (!isFarmer && !isAdmin) return
    apiService.listEnterprises({ limit: 100 }).then(res => {
      setEnterpriseOptions((res.data?.items || []).map((e: any) => ({ id: e.id, name: e.name })))
    }).catch(() => {})
  }, [isFarmer, isAdmin])

  // Load groups when enterprise changes in form
  useEffect(() => {
    if (!formData.enterpriseId) { setGroupOptions([]); return }
    apiService.listAnimalGroups(formData.enterpriseId, { limit: 100 }).then(res => {
      setGroupOptions((res.data?.items || []).map((g: any) => ({ id: g.id, name: g.name })))
    }).catch(() => setGroupOptions([]))
  }, [formData.enterpriseId])

  const fetchAnimals = async () => {
    try {
      setLoading(true)
      const params: Record<string, string> = {}
      if (isVet && vetView === 'patients') params.view = 'patients'
      const res = await apiService.listAnimals(params)
      let animalList: AnimalData[] = res.data?.animals || []

      // For farmers, also load enterprise animals (not personally owned but part of their enterprise)
      if (isFarmer && enterpriseOptions.length > 0) {
        const enterpriseAnimalPromises = enterpriseOptions.map(ent =>
          apiService.listEnterpriseAnimals(ent.id, { limit: 200 }).catch(() => ({ data: { items: [] } }))
        )
        const enterpriseResults = await Promise.all(enterpriseAnimalPromises)
        const enterpriseAnimals = enterpriseResults.flatMap((r: any) => r.data?.items || [])
        const existingIds = new Set(animalList.map((a: AnimalData) => a.id))
        const newEntAnimals = enterpriseAnimals.filter((a: any) => !existingIds.has(a.id))
        animalList = [...animalList, ...newEntAnimals]
      }

      setAnimals(animalList)
      
    } catch {
      setAnimals([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAnimals() }, [vetView])
  useAutoRefresh('animals', fetchAnimals)

  const resetForm = () => {
    setFormData({
      name: '', species: '', breed: '', customBreed: '', gender: '', weight: '', color: '',
      dateOfBirth: '', microchipId: '', earTagId: '', registrationNumber: '',
      isNeutered: false, insuranceProvider: '', insurancePolicyNumber: '', insuranceExpiry: '',
      medicalNotes: '', enterpriseId: '', groupId: ''
    })
    setEditingAnimal(null)
  }

  const openEditForm = (a: AnimalData) => {
    const breedList = BREED_DATABASE[a.species] || []
    const isCustomBreed = a.breed && !breedList.includes(a.breed)
    setFormData({
      name: a.name, species: a.species, breed: isCustomBreed ? 'Other' : (a.breed || ''),
      customBreed: isCustomBreed ? (a.breed || '') : '',
      gender: a.gender || '', weight: a.weight?.toString() || '', color: a.color || '',
      dateOfBirth: a.dateOfBirth ? a.dateOfBirth.split('T')[0] : '',
      microchipId: a.microchipId || '', earTagId: a.earTagId || '',
      registrationNumber: a.registrationNumber || '',
      isNeutered: a.isNeutered || false,
      insuranceProvider: a.insuranceProvider || '', insurancePolicyNumber: a.insurancePolicyNumber || '',
      insuranceExpiry: a.insuranceExpiry ? a.insuranceExpiry.split('T')[0] : '',
      medicalNotes: a.medicalNotes || '',
      enterpriseId: (a as any).enterpriseId || (a as any).enterprise_id || '',
      groupId: (a as any).groupId || (a as any).group_id || ''
    })
    setEditingAnimal(a)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    setError('')
    const finalBreed = formData.breed === 'Other' ? formData.customBreed : formData.breed
    const payload: any = {
      name: formData.name, species: formData.species, breed: finalBreed || undefined,
      gender: formData.gender || undefined, weight: formData.weight ? parseFloat(formData.weight) : undefined,
      color: formData.color || undefined, dateOfBirth: formData.dateOfBirth || undefined,
      microchipId: formData.microchipId || undefined, earTagId: formData.earTagId || undefined,
      registrationNumber: formData.registrationNumber || undefined, isNeutered: formData.isNeutered,
      insuranceProvider: formData.insuranceProvider || undefined,
      insurancePolicyNumber: formData.insurancePolicyNumber || undefined,
      insuranceExpiry: formData.insuranceExpiry || undefined,
      medicalNotes: formData.medicalNotes || undefined,
      enterpriseId: formData.enterpriseId || undefined,
      groupId: formData.groupId || undefined,
    }
    try {
      if (editingAnimal) {
        await apiService.updateAnimal(editingAnimal.id, payload)
        setSuccessMsg(t('animals.toasts.updated'))
      } else {
        await apiService.createAnimal(payload)
        setSuccessMsg(t('animals.toasts.registered'))
      }
      setShowForm(false)
      resetForm()
      fetchAnimals()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err.message || t('animals.toasts.failedSave'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('animals.toasts.confirmRemove'))) return
    try {
      await apiService.deleteAnimal(id)
      setSuccessMsg(t('animals.toasts.removed'))
      fetchAnimals()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || t('animals.toasts.failedRemove'))
    }
  }

  const calculateAge = (dob?: string): string => {
    if (!dob) return ''
    const birth = new Date(dob)
    const now = new Date()
    const years = now.getFullYear() - birth.getFullYear()
    const months = now.getMonth() - birth.getMonth()
    if (years > 0) return months < 0 ? `${years - 1}y ${12 + months}m` : `${years}y ${months}m`
    return months <= 0 ? t('animals.newborn') : `${months}m`
  }

  // Filter animals
  const filteredAnimals = animals.filter(a => {
    const matchSearch = !searchTerm || a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.uniqueId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.earTagId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.microchipId || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchSpecies = !speciesFilter || a.species === speciesFilter
        const matchEnterprise = !enterpriseFilter || a.enterpriseId === enterpriseFilter
    const matchGroup = !groupFilter || a.groupId === groupFilter
    return matchSearch && matchSpecies && matchEnterprise && matchGroup
  })

  const uniqueSpecies = [...new Set(animals.map(a => a.species))]

  const sectionTitle = (icon: string, text: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #e5e7eb' }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: '#374151' }}>{text}</span>
    </div>
  )

  const fieldStyle = { padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, width: '100%', boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: 12, fontWeight: 600 as const, color: '#4b5563', marginBottom: 4, display: 'block' }

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>{isFarmer ? '🐄' : '🐾'} {isVet ? (vetView === 'my-pets' ? t('animals.pageTitles.petOwner') : t('animals.pageTitles.vet')) : isAdmin ? t('animals.pageTitles.admin') : isFarmer ? t('animals.pageTitles.farmer') : t('animals.pageTitles.petOwner')}</h1>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
            {isVet ? (vetView === 'my-pets' ? t('animals.subtitles.vetMyPets') : t('animals.subtitles.vet')) : isAdmin ? t('animals.subtitles.admin') : isFarmer ? t('animals.subtitles.farmer') : t('animals.subtitles.petOwner')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canManageAnimals && (
            <button className="btn-primary" onClick={() => { resetForm(); setShowForm(!showForm) }}>
              {showForm ? t('animals.actions.cancel') : t('animals.registerAnimal')}
            </button>
          )}
        </div>
      </div>

      {successMsg && <div style={{ padding: '12px 16px', background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7', borderRadius: 8, marginBottom: 16, fontWeight: 500 }}>{successMsg}</div>}
      {error && <div style={{ padding: '12px 16px', background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: 8, marginBottom: 16, fontWeight: 500 }}>{error}</div>}

      {/* ─── Vet View Tabs ─────────────────────────────── */}
      {isVet && (
        <div className="module-tabs" style={{ marginBottom: 20 }}>
          <button className={`module-tab ${vetView === 'my-pets' ? 'active' : ''}`} onClick={() => setVetView('my-pets')}>
            🐾 {t('animals.vetTabs.myPets')}
          </button>
          <button className={`module-tab ${vetView === 'patients' ? 'active' : ''}`} onClick={() => setVetView('patients')}>
            🩺 {t('animals.vetTabs.patientAnimals')}
          </button>
        </div>
      )}

      {/* ─── Search & Filter Bar ───────────────────────────── */}
      {!showForm && animals.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <AutocompleteInput
            value={searchTerm}
            onChange={setSearchTerm}
            options={animals.map(a => a.name)}
            placeholder={t('animals.searchPlaceholder')}
            className="animals-search"
          />
          <select value={speciesFilter} onChange={e => setSpeciesFilter(e.target.value)} style={{ ...fieldStyle, maxWidth: 160 }}>
            <option value="">{t('animals.allSpecies')}</option>
            {uniqueSpecies.map(s => <option key={s} value={s}>{SPECIES_ICONS[s] || '🐾'} {s}</option>)}
          </select>
          {isFarmer && enterpriseOptions.length > 0 && (
            <select value={enterpriseFilter} onChange={e => { setEnterpriseFilter(e.target.value); setGroupFilter('') }} style={{ ...fieldStyle, maxWidth: 180 }}>
              <option value=''>{t('animals.enterprise.filterByEnterprise')}</option>
              {enterpriseOptions.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
            </select>
          )}
          {isFarmer && enterpriseFilter && groupOptions.length > 0 && (
            <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} style={{ ...fieldStyle, maxWidth: 160 }}>
              <option value=''>{t('animals.enterprise.filterByGroup')}</option>
              {groupOptions.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          <span style={{ fontSize: 13, color: '#6b7280' }}>{filteredAnimals.length} {filteredAnimals.length !== 1 ? t('animals.animalsCount') : t('animals.animalCount')}</span>
        </div>
      )}

      {/* ─── Registration / Edit Form Modal ──────────────── */}
      {showForm && (
        <div className="edit-form-overlay" onClick={() => { setShowForm(false); resetForm() }}>
          <div ref={formRef} className="edit-form-panel edit-form-modal" onClick={e => e.stopPropagation()}>
            <button className="edit-form-close" onClick={() => { setShowForm(false); resetForm() }} aria-label="Close">✕</button>
            {editingAnimal && <div className="edit-form-badge">{t('animals.registerModal.editingMode')}</div>}
            <h2>
              {editingAnimal ? `✏️ ${t('animals.registerModal.titleEdit', { name: editingAnimal.name })}` : t('animals.registerModal.titleNew')}
            </h2>
          <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 16px' }}>{t('animals.registerModal.requiredNote')}</p>

          <form onSubmit={handleSubmit}>
            {/* ── Basic Information ── */}
            {sectionTitle('📝', t('animals.sections.basicInfo'))}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              <div>
                <label style={labelStyle}>{t('animals.registerModal.name')}</label>
                <input type="text" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required style={fieldStyle} placeholder={t('animals.form.placeholderName')} />
              </div>
              <div>
                <label style={labelStyle}>{t('animals.registerModal.species')}</label>
                <select value={formData.species} onChange={e => setFormData(p => ({ ...p, species: e.target.value, breed: '', customBreed: '' }))} required style={fieldStyle}>
                  <option value="">{t('animals.form.selectSpecies')}</option>
                  {SPECIES_CATEGORIES.map(cat => (
                    <optgroup key={cat.label} label={cat.label}>
                      {cat.species.map(s => (
                        <option key={s} value={s}>{SPECIES_ICONS[s] || '🐾'} {s}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t('animals.registerModal.breed')}</label>
                {breeds.length > 0 ? (
                  <select value={formData.breed} onChange={e => setFormData(p => ({ ...p, breed: e.target.value, customBreed: '' }))} style={fieldStyle}>
                    <option value="">{t('animals.registerModal.selectBreed')}</option>
                    {breeds.map(b => <option key={b} value={b}>{b}</option>)}
                    <option value="Other">{t('animals.registerModal.otherBreed')}</option>
                  </select>
                ) : (
                  <input type="text" value={formData.customBreed} onChange={e => setFormData(p => ({ ...p, customBreed: e.target.value }))} style={fieldStyle} placeholder={t('animals.form.placeholderBreed')} />
                )}
              </div>
              {formData.breed === 'Other' && (
                <div>
                  <label style={labelStyle}>{t('animals.registerModal.customBreed')}</label>
                  <input type="text" value={formData.customBreed} onChange={e => setFormData(p => ({ ...p, customBreed: e.target.value }))} required style={fieldStyle} placeholder={t('animals.form.placeholderBreedName')} />
                </div>
              )}
              <div>
                <label style={labelStyle}>{t('animals.registerModal.gender')}</label>
                <select value={formData.gender} onChange={e => setFormData(p => ({ ...p, gender: e.target.value }))} style={fieldStyle}>
                  <option value="">{t('animals.form.selectGender')}</option>
                  <option value="male">{t('animals.form.male')}</option>
                  <option value="female">{t('animals.form.female')}</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t('animals.registerModal.dob')}</label>
                <input type="date" value={formData.dateOfBirth} onChange={e => setFormData(p => ({ ...p, dateOfBirth: e.target.value }))} style={fieldStyle} max={new Date().toISOString().split('T')[0]} />
              </div>
              <div>
                <label style={labelStyle}>{t('animals.registerModal.color')}</label>
                <input type="text" value={formData.color} onChange={e => setFormData(p => ({ ...p, color: e.target.value }))} style={fieldStyle} placeholder={t('animals.form.placeholderColor')} />
              </div>
              <div>
                <label style={labelStyle}>{t('animals.registerModal.weight')}</label>
                <input type="number" step="0.1" min="0" value={formData.weight} onChange={e => setFormData(p => ({ ...p, weight: e.target.value }))} style={fieldStyle} placeholder={t('animals.form.placeholderWeight')} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 22 }}>
                <input type="checkbox" id="isNeutered" checked={formData.isNeutered} onChange={e => setFormData(p => ({ ...p, isNeutered: e.target.checked }))} style={{ width: 18, height: 18 }} />
                <label htmlFor="isNeutered" style={{ fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>{t('animals.registerModal.neutered')}</label>
              </div>
            </div>

            {/* ── Identification ── */}
            {sectionTitle('🏷️', t('animals.sections.identification'))}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              <div>
                <label style={labelStyle}>{t('animals.registerModal.microchip')}</label>
                <input type="text" value={formData.microchipId} onChange={e => setFormData(p => ({ ...p, microchipId: e.target.value }))} style={fieldStyle} placeholder={t('animals.form.placeholderMicrochip')} />
              </div>
              {showEarTag && (
                <div>
                  <label style={labelStyle}>{t('animals.registerModal.earTag')}</label>
                  <input type="text" value={formData.earTagId} onChange={e => setFormData(p => ({ ...p, earTagId: e.target.value }))} style={fieldStyle} placeholder={t('animals.form.placeholderEarTag')} />
                </div>
              )}
              <div>
                <label style={labelStyle}>{t('animals.registerModal.regNumber')}</label>
                <input type="text" value={formData.registrationNumber} onChange={e => setFormData(p => ({ ...p, registrationNumber: e.target.value }))} style={fieldStyle} placeholder={t('animals.form.placeholderRegNumber')} />
              </div>
            </div>

            {/* ── Insurance ── */}
            {sectionTitle('🛡️', t('animals.sections.insurance'))}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              <div>
                <label style={labelStyle}>{t('animals.registerModal.insuranceProvider')}</label>
                <input type="text" value={formData.insuranceProvider} onChange={e => setFormData(p => ({ ...p, insuranceProvider: e.target.value }))} style={fieldStyle} placeholder={t('animals.form.placeholderInsurance')} />
              </div>
              <div>
                <label style={labelStyle}>{t('animals.registerModal.policyNumber')}</label>
                <input type="text" value={formData.insurancePolicyNumber} onChange={e => setFormData(p => ({ ...p, insurancePolicyNumber: e.target.value }))} style={fieldStyle} placeholder={t('animals.form.placeholderPolicy')} />
              </div>
              <div>
                <label style={labelStyle}>{t('animals.registerModal.policyExpiry')}</label>
                <input type="date" value={formData.insuranceExpiry} onChange={e => setFormData(p => ({ ...p, insuranceExpiry: e.target.value }))} style={fieldStyle} />
                {formData.insuranceExpiry && new Date(formData.insuranceExpiry) < new Date() && (
                  <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>{t('animals.registerModal.policyExpired')}</span>
                )}
              </div>
            </div>

            {/* ── Medical Notes ── */}
            {sectionTitle('📋', t('animals.sections.medicalNotes'))}
            <textarea value={formData.medicalNotes} onChange={e => setFormData(p => ({ ...p, medicalNotes: e.target.value }))}
              rows={3} style={{ ...fieldStyle, resize: 'vertical' }}
              placeholder={t('animals.form.placeholderMedical')} />

            {/* ── Enterprise & Group (Farmer/Admin only) ── */}
            {(isFarmer || isAdmin) && enterpriseOptions.length > 0 && (
              <>
                {sectionTitle('🏢', t('animals.sections.enterprise'))}
                <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px' }}>
                  {t('animals.enterprise.description')}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>{t('animals.enterprise.label')}</label>
                    <select value={formData.enterpriseId} onChange={e => setFormData(p => ({ ...p, enterpriseId: e.target.value, groupId: '' }))} style={fieldStyle}>
                      <option value="">{t('animals.enterprise.none')}</option>
                      {enterpriseOptions.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
                    </select>
                  </div>
                  {formData.enterpriseId && (
                    <div>
                      <label style={labelStyle}>{t('animals.enterprise.herdGroup')}</label>
                      <select value={formData.groupId} onChange={e => setFormData(p => ({ ...p, groupId: e.target.value }))} style={fieldStyle}>
                        <option value="">{t('animals.enterprise.noGroup')}</option>
                        {groupOptions.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                      {groupOptions.length === 0 && (
                        <span style={{ fontSize: 11, color: '#6b7280' }}>{t('animals.enterprise.noGroupsFound')} <span style={{ color: '#4F46E5', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/animal-groups')}>{t('animals.enterprise.createOne')}</span></span>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ padding: '10px 28px', fontSize: 14, fontWeight: 600 }}>
                {isSubmitting ? '⏳ ' + (editingAnimal ? t('animals.registerModal.updateBtn') : t('animals.registerModal.registerBtn')) + '...' : (editingAnimal ? t('animals.registerModal.updateBtn') : t('animals.registerModal.registerBtn'))}
              </button>
              <button type="button" onClick={() => { setShowForm(false); resetForm() }}
                style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', color: '#374151', cursor: 'pointer', fontSize: 14 }}>
                {t('animals.actions.cancel')}
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* ─── Animal Cards ──────────────────────────────────── */}
      <div className="module-content">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div className="loading-spinner" />
            <p style={{ color: '#6b7280', marginTop: 12 }}>{t('animals.loading')}</p>
          </div>
        ) : filteredAnimals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🐾</div>
            <h3 style={{ fontSize: 20, color: '#333', marginBottom: 8 }}>{searchTerm || speciesFilter ? t('animals.emptySearch') : t('animals.emptyAnimals')}</h3>
            <p style={{ color: '#666' }}>{canManageAnimals ? t('animals.petOwnerCTA') : t('animals.adminCTA')}</p>
            {canManageAnimals && !showForm && (
              <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => { resetForm(); setShowForm(true) }}>{t('animals.registerAnimal')}</button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {filteredAnimals.map(animal => {
              const age = calculateAge(animal.dateOfBirth)
              const insured = animal.insuranceProvider && animal.insurancePolicyNumber
              const insExpired = animal.insuranceExpiry && new Date(animal.insuranceExpiry) < new Date()
              return (
                <div key={animal.id} style={{
                  background: 'white', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.04)', transition: 'box-shadow 0.2s',
                }}>
                  {/* Card Header */}
                  <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '16px 20px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 32 }}>{SPECIES_ICONS[animal.species] || '🐾'}</span>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{animal.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.9 }}>{animal.species}{animal.breed ? ` • ${animal.breed}` : ''}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{ fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 12, fontFamily: 'monospace', cursor: 'copy' }}
                        onClick={() => {
                          if (animal.uniqueId) {
                            navigator.clipboard?.writeText(animal.uniqueId).catch(() => {});
                          }
                        }}
                        title={animal.uniqueId ? `Click to copy: ${animal.uniqueId}` : ''}
                      >
                        {animal.uniqueId || `ID-${animal.id.substring(0, 8).toUpperCase()}`}
                      </div>
                      {age && <div style={{ fontSize: 11, marginTop: 4, opacity: 0.85 }}>{t('animals.cardLabels.age')} {age}</div>}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 13 }}>
                      {animal.gender && <div><span style={{ color: '#6b7280' }}>{t('animals.cardLabels.gender')}</span> <strong>{animal.gender === 'male' ? t('animals.form.maleDisplay') : t('animals.form.femaleDisplay')}</strong></div>}
                      {animal.weight && <div><span style={{ color: '#6b7280' }}>{t('animals.cardLabels.weight')}</span> <strong>{animal.weight} kg</strong></div>}
                      {animal.color && <div><span style={{ color: '#6b7280' }}>{t('animals.cardLabels.color')}</span> <strong>{animal.color}</strong></div>}
                      {animal.isNeutered && <div><span style={{ color: '#6b7280' }}>{t('animals.cardLabels.neutered')}</span> <strong style={{ color: '#059669' }}>{t('animals.cardLabels.yesCheck')}</strong></div>}
                      {animal.dateOfBirth && <div><span style={{ color: '#6b7280' }}>{t('animals.cardLabels.dob')}</span> <strong>{formatDate(animal.dateOfBirth)}</strong></div>}
                      {animal.ownerName && (isVet || isAdmin) && <div><span style={{ color: '#6b7280' }}>{t('animals.cardLabels.owner')}</span> <strong>{animal.ownerName}</strong></div>}
                    </div>

                                        {/* Enterprise / Group (Farmer view) */}
                    {(animal.enterpriseName || animal.groupName) && (
                      <div style={{ marginTop: 8, padding: '6px 12px', background: '#f0f4ff', borderRadius: 8, fontSize: 12 }}>
                        {animal.groupColor && (
                          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: animal.groupColor, marginRight: 6, verticalAlign: 'middle' }} />
                        )}
                        {animal.enterpriseName && <span style={{ color: '#4338ca', fontWeight: 600 }}>🏢 {animal.enterpriseName}</span>}
                        {animal.groupName && <span style={{ color: '#6b7280', marginLeft: 8 }}>· {animal.groupName}</span>}
                      </div>
                    )}

                    {/* IDs Row */}
                    {(animal.microchipId || animal.earTagId || animal.registrationNumber) && (
                      <div style={{ marginTop: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 12 }}>
                        <div style={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}>{t('animals.cardLabels.identification')}</div>
                        {animal.microchipId && <div style={{ color: '#4b5563' }}>{t('animals.cardLabels.microchip')} <span style={{ fontFamily: 'monospace', color: '#2563eb' }}>{animal.microchipId}</span></div>}
                        {animal.earTagId && <div style={{ color: '#4b5563' }}>{t('animals.cardLabels.earTag')} <span style={{ fontFamily: 'monospace', color: '#2563eb' }}>{animal.earTagId}</span></div>}
                        {animal.registrationNumber && <div style={{ color: '#4b5563' }}>{t('animals.cardLabels.regNumber')} <span style={{ fontFamily: 'monospace', color: '#2563eb' }}>{animal.registrationNumber}</span></div>}
                      </div>
                    )}

                    {/* Insurance Row */}
                    {insured && (
                      <div style={{ marginTop: 8, padding: '8px 12px', background: insExpired ? '#fef2f2' : '#f0fdf4', borderRadius: 8, fontSize: 12 }}>
                        <div style={{ fontWeight: 600, color: insExpired ? '#dc2626' : '#059669', marginBottom: 2 }}>
                          {insExpired ? t('animals.cardLabels.insuranceExpired') : `🛡️ ${t('animals.cardLabels.insured')}`}
                        </div>
                        <div style={{ color: '#4b5563' }}>{animal.insuranceProvider} — {animal.insurancePolicyNumber}</div>
                        {animal.insuranceExpiry && <div style={{ color: insExpired ? '#dc2626' : '#6b7280' }}>{t('animals.cardLabels.expires')} {formatDate(animal.insuranceExpiry)}</div>}
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div style={{ padding: '12px 20px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn-small" style={{ background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0' }}
                      onClick={() => setDetailAnimal(animal)}>{t('animals.cardLabels.details')}</button>
                    <button className="btn-small" onClick={() => navigate('/medical-records')}>{t('animals.cardActions.records')}</button>
                    {canManageAnimals && (
                      <>
                        <button className="btn-small" style={{ background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }}
                          onClick={() => openEditForm(animal)}>{t('animals.cardActions.edit')}</button>
                        <button className="btn-small" style={{ color: '#dc2626', border: '1px solid #fca5a5', background: '#fef2f2' }}
                          onClick={() => handleDelete(animal.id)}>🗑️</button>
                      </>
                    )}
                    {isPetOwner && (
                      <button className="btn-small" style={{ marginLeft: 'auto', background: '#667eea', color: 'white', border: 'none' }}
                        onClick={() => navigate(`/book-consultation?animalId=${animal.id}`)}>{t('animals.actions.bookConsultation')}</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Detail Modal ──────────────────────────────────── */}
      {detailAnimal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}
          onClick={() => setDetailAnimal(null)}>
          <div style={{ background: 'white', borderRadius: 16, padding: 0, width: '95%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px 28px', color: 'white', borderRadius: '16px 16px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 40 }}>{SPECIES_ICONS[detailAnimal.species] || '🐾'}</span>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{detailAnimal.name}</div>
                  <div style={{ fontSize: 13, opacity: 0.9 }}>{detailAnimal.species}{detailAnimal.breed ? ` • ${detailAnimal.breed}` : ''} — {detailAnimal.uniqueId}</div>
                </div>
              </div>
              <button onClick={() => setDetailAnimal(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', fontSize: 20, width: 36, height: 36, borderRadius: '50%', cursor: 'pointer' }}>✕</button>
            </div>
            {/* Modal Body */}
            <div style={{ padding: '20px 28px' }}>
              {sectionTitle('📝', t('animals.detailModal.basicInfo'))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', fontSize: 14 }}>
                <div><span style={{ color: '#6b7280' }}>{t('animals.detailModal.name')}</span> <strong>{detailAnimal.name}</strong></div>
                <div><span style={{ color: '#6b7280' }}>{t('animals.detailModal.species')}</span> <strong>{detailAnimal.species}</strong></div>
                {detailAnimal.breed && <div><span style={{ color: '#6b7280' }}>{t('animals.detailModal.breed')}</span> <strong>{detailAnimal.breed}</strong></div>}
                {detailAnimal.gender && <div><span style={{ color: '#6b7280' }}>{t('animals.detailModal.gender')}</span> <strong>{detailAnimal.gender === 'male' ? t('animals.form.maleDisplay') : t('animals.form.femaleDisplay')}</strong></div>}
                {detailAnimal.dateOfBirth && <div><span style={{ color: '#6b7280' }}>{t('animals.detailModal.dob')}</span> <strong>{formatDate(detailAnimal.dateOfBirth)}</strong></div>}
                {detailAnimal.dateOfBirth && <div><span style={{ color: '#6b7280' }}>{t('animals.detailModal.age')}</span> <strong>{calculateAge(detailAnimal.dateOfBirth)}</strong></div>}
                {detailAnimal.weight && <div><span style={{ color: '#6b7280' }}>{t('animals.detailModal.weight')}</span> <strong>{detailAnimal.weight} kg</strong></div>}
                {detailAnimal.color && <div><span style={{ color: '#6b7280' }}>{t('animals.detailModal.color')}</span> <strong>{detailAnimal.color}</strong></div>}
                <div><span style={{ color: '#6b7280' }}>{t('animals.detailModal.neutered')}</span> <strong>{detailAnimal.isNeutered ? t('animals.detailModal.yesCheck') : t('animals.detailModal.no')}</strong></div>
                {detailAnimal.ownerName && <div><span style={{ color: '#6b7280' }}>{t('animals.detailModal.owner')}</span> <strong>{detailAnimal.ownerName}</strong></div>}
              </div>

              {sectionTitle('🏷️', t('animals.detailModal.identificationSection'))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', fontSize: 14 }}>
                <div><span style={{ color: '#6b7280' }}>{t('animals.detailModal.systemId')}</span> <strong style={{ fontFamily: 'monospace' }}>{detailAnimal.uniqueId}</strong></div>
                {detailAnimal.microchipId && <div><span style={{ color: '#6b7280' }}>{t('animals.detailModal.microchip')}</span> <strong style={{ fontFamily: 'monospace' }}>{detailAnimal.microchipId}</strong></div>}
                {detailAnimal.earTagId && <div><span style={{ color: '#6b7280' }}>{t('animals.detailModal.earTag')}</span> <strong style={{ fontFamily: 'monospace' }}>{detailAnimal.earTagId}</strong></div>}
                {detailAnimal.registrationNumber && <div><span style={{ color: '#6b7280' }}>{t('animals.detailModal.regNumber')}</span> <strong style={{ fontFamily: 'monospace' }}>{detailAnimal.registrationNumber}</strong></div>}
              </div>

              {(detailAnimal.insuranceProvider || detailAnimal.insurancePolicyNumber) && (
                <>
                  {sectionTitle('🛡️', t('animals.detailModal.insuranceSection'))}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', fontSize: 14 }}>
                    {detailAnimal.insuranceProvider && <div><span style={{ color: '#6b7280' }}>{t('animals.detailModal.provider')}</span> <strong>{detailAnimal.insuranceProvider}</strong></div>}
                    {detailAnimal.insurancePolicyNumber && <div><span style={{ color: '#6b7280' }}>{t('animals.detailModal.policyNumber')}</span> <strong style={{ fontFamily: 'monospace' }}>{detailAnimal.insurancePolicyNumber}</strong></div>}
                    {detailAnimal.insuranceExpiry && <div><span style={{ color: '#6b7280' }}>{t('animals.detailModal.expiry')}</span> <strong>{formatDate(detailAnimal.insuranceExpiry)}</strong></div>}
                  </div>
                </>
              )}

              {detailAnimal.medicalNotes && (
                <>
                  {sectionTitle('📋', t('animals.detailModal.medicalNotesSection'))}
                  <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, margin: 0 }}>{detailAnimal.medicalNotes}</p>
                </>
              )}
            </div>
            <div style={{ padding: '16px 28px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-small" onClick={() => navigate('/medical-records')}>{t('animals.detailModal.medicalRecords')}</button>
              {canManageAnimals && <button className="btn-small" style={{ background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }} onClick={() => { setDetailAnimal(null); openEditForm(detailAnimal) }}>{t('animals.detailModal.editBtn')}</button>}
              <button className="btn-small" onClick={() => setDetailAnimal(null)} style={{ padding: '6px 20px' }}>{t('animals.detailModal.closeBtn')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Animals
