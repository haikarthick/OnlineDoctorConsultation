// ─── Species & Breed master data (single source of truth) ───────────────────
// India-focused breeds grouped by species. Used by the Animals module and the
// Marketplace sell form so breed is always a picker, never free text
// (master-data rule). Keep additions here — do not re-declare elsewhere.

export const BREED_DATABASE: Record<string, string[]> = {
  // ── Common Pets ──
  Dog: ['Indian Pariah', 'Mudhol Hound', 'Rajapalayam', 'Kanni', 'Chippiparai', 'Kombai', 'Bakharwal', 'Rampur Greyhound', 'Himalayan Sheepdog', 'Labrador Retriever', 'Golden Retriever', 'German Shepherd', 'Beagle', 'Pug', 'Dachshund', 'Rottweiler', 'Doberman Pinscher', 'Great Dane', 'Saint Bernard', 'Siberian Husky', 'Shih Tzu', 'Pomeranian', 'Cocker Spaniel', 'Boxer', 'Dalmatian', 'Border Collie', 'Maltese', 'Poodle', 'Bichon Frise', 'German Spitz', 'Lhasa Apso', 'Chow Chow', 'Bulldog', 'French Bulldog', 'Yorkshire Terrier', 'Mixed Breed', 'Other'],
  Cat: ['Persian', 'Siamese', 'Bengal', 'Maine Coon', 'Russian Blue', 'British Shorthair', 'Scottish Fold', 'Ragdoll', 'Himalayan', 'Turkish Angora', 'Bombay', 'American Shorthair', 'Abyssinian', 'Burmese', 'Devon Rex', 'Indian Domestic', 'Mixed Breed', 'Other'],
  // ── Small Pets ──
  Rabbit: ['New Zealand White', 'Dutch', 'Rex', 'Angora', 'Mini Lop', 'Holland Lop', 'Flemish Giant', 'Lionhead', 'Himalayan', 'Mixed Breed', 'Other'],
  Hamster: ['Syrian (Golden)', 'Dwarf Campbell', 'Dwarf Winter White', 'Roborovski', 'Chinese', 'Mixed', 'Other'],
  'Guinea Pig': ['American', 'Abyssinian', 'Peruvian', 'Silkie', 'Teddy', 'Texel', 'Mixed', 'Other'],
  Gerbil: ['Mongolian', 'Fat-tailed', 'Mixed', 'Other'],
  Chinchilla: ['Standard Grey', 'White', 'Beige', 'Black Velvet', 'Violet', 'Mixed', 'Other'],
  Ferret: ['Sable', 'Albino', 'Dark-eyed White', 'Silver', 'Cinnamon', 'Mixed', 'Other'],
  Hedgehog: ['African Pygmy', 'European', 'Long-eared', 'Mixed', 'Other'],
  'Sugar Glider': ['Classic Grey', 'Leucistic', 'Albino', 'Black Beauty', 'Mixed', 'Other'],
  // ── Birds ──
  Parrot: ['African Grey', 'Blue and Gold Macaw', 'Green Wing Macaw', 'Scarlet Macaw', 'Cockatoo', 'Yellow-naped Amazon', 'Blue-fronted Amazon', 'Eclectus', 'Sun Conure', 'Green Cheek Conure', 'Caique', 'Alexandrine Parakeet', 'Rose-ringed Parakeet', 'Mixed', 'Other'],
  Budgerigar: ['English Budgie', 'American Budgie', 'Australian Budgie', 'Lutino', 'Albino', 'Pied', 'Mixed', 'Other'],
  Cockatiel: ['Normal Grey', 'Lutino', 'Pearl', 'Cinnamon', 'Pied', 'Whiteface', 'Mixed', 'Other'],
  Lovebird: ['Peach-faced', "Fischer's", 'Black-masked', 'Nyasa', 'Black-cheeked', 'Mixed', 'Other'],
  Finch: ['Zebra Finch', 'Society Finch', 'Gouldian Finch', 'Java Sparrow', 'Star Finch', 'Mixed', 'Other'],
  Canary: ['Yorkshire', 'Border', 'Roller', 'Red Factor', 'Gloster', 'Mixed', 'Other'],
  Mynah: ['Common Hill Mynah', 'Bank Mynah', 'Jungle Mynah', 'Mixed', 'Other'],
  Pigeon: ['Fantail', 'Jacobin', 'Tumbler', 'King', 'Racing Homer', 'Indian Fantail', 'Mixed', 'Other'],
  Bird: ['Mixed / Unknown', 'Other'],
  // ── Reptiles ──
  Tortoise: ['Indian Star Tortoise', 'Russian Tortoise', "Hermann's Tortoise", 'Sulcata', 'Red-footed', 'Mixed', 'Other'],
  Turtle: ['Red-eared Slider', 'Painted Turtle', 'Map Turtle', 'Box Turtle', 'Mixed', 'Other'],
  Gecko: ['Leopard Gecko', 'Crested Gecko', 'African Fat-tailed', 'Tokay', 'Day Gecko', 'Mixed', 'Other'],
  'Bearded Dragon': ['Inland/Central', "Rankin's Dragon", 'Mixed', 'Other'],
  Chameleon: ['Veiled', 'Panther', "Jackson's", "Fischer's", 'Mixed', 'Other'],
  Snake: ['Ball Python', 'Corn Snake', 'King Snake', 'Milk Snake', 'Boa Constrictor', 'Mixed', 'Other'],
  // ── Amphibians ──
  Frog: ['African Dwarf', 'Pacman (Horned)', 'Tree Frog', "White's Tree Frog", 'Mixed', 'Other'],
  Axolotl: ['Wild Type', 'Leucistic', 'Golden Albino', 'Melanoid', 'Axanthic', 'Mixed', 'Other'],
  // ── Ornamental Fish ──
  'Ornamental Fish': ['Betta', 'Guppy', 'Mollies', 'Platy', 'Swordtail', 'Tetra', 'Angelfish', 'Discus', 'Cichlid', 'Clownfish', 'Mixed', 'Other'],
  Koi: ['Kohaku', 'Sanke', 'Showa', 'Bekko', 'Asagi', 'Ogon', 'Butterfly Koi', 'Mixed', 'Other'],
  Arowana: ['Silver', 'Golden', 'Red', 'Black', 'Pearl', 'Mixed', 'Other'],
  Goldfish: ['Common', 'Comet', 'Fantail', 'Oranda', 'Ryukin', 'Black Moor', 'Telescope', 'Bubble Eye', 'Mixed', 'Other'],
  // ── Livestock / Farm ──
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
  // ── Poultry ──
  Chicken: ['Aseel', 'Kadaknath', 'Ghagus', 'Naked Neck', 'Kalinga Brown', 'Vanaraja', 'Grampriya', 'Nicobari', 'Broiler', 'White Leghorn', 'Rhode Island Red', 'Plymouth Rock', 'Sussex', 'Australorp', 'Mixed Breed', 'Other'],
  Duck: ['Indian Runner', 'Khaki Campbell', 'Pekin', 'Muscovy', 'Rouen', 'Mixed', 'Other'],
  Turkey: ['Broad-breasted White', 'Bronze', 'Bourbon Red', 'Narragansett', 'Mixed', 'Other'],
  Quail: ['Japanese', 'Bobwhite', 'California', 'Coturnix', 'Mixed', 'Other'],
  Emu: ['Australian Emu', 'Other'],
  Ostrich: ['Common Ostrich', 'Other'],
  Peacock: ['Indian Peafowl (Blue)', 'White Peafowl', 'Green Peafowl', 'Mixed', 'Other'],
  // ── Exotic Large ──
  Llama: ['Suri', 'Huacaya', 'Mixed', 'Other'],
  Alpaca: ['Suri', 'Huacaya', 'Mixed', 'Other'],
  // ── Other ──
  Other: [],
}

export const SPECIES_CATEGORIES: Array<{ label: string; species: string[] }> = [
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

// ─── Sex/reproductive class terms (single source of truth) ───────────────────
// Species-correct terminology (Bull/Cow/Bullock, Ram/Ewe/Wether, etc.) instead
// of generic Male/Female. Only covers species with verified source terminology
// — everything else keeps the plain gender select. `impliedGender` drives the
// underlying gender field silently (never shown as its own control);
// `canBePregnant`/`canProduceMilk` gate the pregnancy/lactation form fields.
// Buffalo terms verified via web research (not assumed from Cattle) — no
// attested Buffalo equivalent of Steer/Veal, so its castrated-male slot uses
// a single "Buffalo Bullock" rather than forcing an unverified split.
export interface AnimalClassTerm {
  value: string
  labelKey: string
  /** Admin-typed plain-text label (master-data CRUD) — fallback when labelKey is empty. */
  label?: string | null
  impliedGender: 'male' | 'female' | 'unknown'
  canBePregnant: boolean
  canProduceMilk: boolean
}

export const ANIMAL_CLASS_TERMS: Record<string, AnimalClassTerm[]> = {
  Cattle: [
    { value: 'cattle_bull', labelKey: 'animalClass.cattle_bull', impliedGender: 'male', canBePregnant: false, canProduceMilk: false },
    { value: 'cattle_cow', labelKey: 'animalClass.cattle_cow', impliedGender: 'female', canBePregnant: true, canProduceMilk: true },
    { value: 'cattle_calf', labelKey: 'animalClass.cattle_calf', impliedGender: 'unknown', canBePregnant: false, canProduceMilk: false },
    { value: 'cattle_bull_calf', labelKey: 'animalClass.cattle_bull_calf', impliedGender: 'male', canBePregnant: false, canProduceMilk: false },
    { value: 'cattle_heifer_calf', labelKey: 'animalClass.cattle_heifer_calf', impliedGender: 'female', canBePregnant: false, canProduceMilk: false },
    { value: 'cattle_heifer', labelKey: 'animalClass.cattle_heifer', impliedGender: 'female', canBePregnant: true, canProduceMilk: false },
    { value: 'cattle_bullock', labelKey: 'animalClass.cattle_bullock', impliedGender: 'male', canBePregnant: false, canProduceMilk: false },
    { value: 'cattle_steer', labelKey: 'animalClass.cattle_steer', impliedGender: 'male', canBePregnant: false, canProduceMilk: false },
  ],
  Buffalo: [
    { value: 'buffalo_bull', labelKey: 'animalClass.buffalo_bull', impliedGender: 'male', canBePregnant: false, canProduceMilk: false },
    { value: 'buffalo_cow', labelKey: 'animalClass.buffalo_cow', impliedGender: 'female', canBePregnant: true, canProduceMilk: true },
    { value: 'buffalo_calf', labelKey: 'animalClass.buffalo_calf', impliedGender: 'unknown', canBePregnant: false, canProduceMilk: false },
    { value: 'buffalo_bull_calf', labelKey: 'animalClass.buffalo_bull_calf', impliedGender: 'male', canBePregnant: false, canProduceMilk: false },
    { value: 'buffalo_heifer_calf', labelKey: 'animalClass.buffalo_heifer_calf', impliedGender: 'female', canBePregnant: false, canProduceMilk: false },
    { value: 'buffalo_heifer', labelKey: 'animalClass.buffalo_heifer', impliedGender: 'female', canBePregnant: true, canProduceMilk: false },
    { value: 'buffalo_bullock', labelKey: 'animalClass.buffalo_bullock', impliedGender: 'male', canBePregnant: false, canProduceMilk: false },
  ],
  Sheep: [
    { value: 'sheep_ram', labelKey: 'animalClass.sheep_ram', impliedGender: 'male', canBePregnant: false, canProduceMilk: false },
    { value: 'sheep_ewe', labelKey: 'animalClass.sheep_ewe', impliedGender: 'female', canBePregnant: true, canProduceMilk: true },
    { value: 'sheep_lamb', labelKey: 'animalClass.sheep_lamb', impliedGender: 'unknown', canBePregnant: false, canProduceMilk: false },
    { value: 'sheep_ram_lamb', labelKey: 'animalClass.sheep_ram_lamb', impliedGender: 'male', canBePregnant: false, canProduceMilk: false },
    { value: 'sheep_ewe_lamb', labelKey: 'animalClass.sheep_ewe_lamb', impliedGender: 'female', canBePregnant: false, canProduceMilk: false },
    { value: 'sheep_wether', labelKey: 'animalClass.sheep_wether', impliedGender: 'male', canBePregnant: false, canProduceMilk: false },
  ],
  Goat: [
    { value: 'goat_buck', labelKey: 'animalClass.goat_buck', impliedGender: 'male', canBePregnant: false, canProduceMilk: false },
    { value: 'goat_doe', labelKey: 'animalClass.goat_doe', impliedGender: 'female', canBePregnant: true, canProduceMilk: true },
    { value: 'goat_buckling', labelKey: 'animalClass.goat_buckling', impliedGender: 'male', canBePregnant: false, canProduceMilk: false },
    { value: 'goat_goatling', labelKey: 'animalClass.goat_goatling', impliedGender: 'female', canBePregnant: true, canProduceMilk: false },
    { value: 'goat_kid', labelKey: 'animalClass.goat_kid', impliedGender: 'unknown', canBePregnant: false, canProduceMilk: false },
  ],
  Pig: [
    { value: 'pig_boar', labelKey: 'animalClass.pig_boar', impliedGender: 'male', canBePregnant: false, canProduceMilk: false },
    { value: 'pig_sow', labelKey: 'animalClass.pig_sow', impliedGender: 'female', canBePregnant: true, canProduceMilk: false },
    { value: 'pig_gilt', labelKey: 'animalClass.pig_gilt', impliedGender: 'female', canBePregnant: true, canProduceMilk: false },
    { value: 'pig_barrow', labelKey: 'animalClass.pig_barrow', impliedGender: 'male', canBePregnant: false, canProduceMilk: false },
  ],
  Dog: [
    { value: 'dog_male', labelKey: 'animalClass.dog_male', impliedGender: 'male', canBePregnant: false, canProduceMilk: false },
    { value: 'dog_bitch', labelKey: 'animalClass.dog_bitch', impliedGender: 'female', canBePregnant: true, canProduceMilk: false },
    { value: 'dog_pup', labelKey: 'animalClass.dog_pup', impliedGender: 'unknown', canBePregnant: false, canProduceMilk: false },
  ],
  Cat: [
    { value: 'cat_tom', labelKey: 'animalClass.cat_tom', impliedGender: 'male', canBePregnant: false, canProduceMilk: false },
    { value: 'cat_queen', labelKey: 'animalClass.cat_queen', impliedGender: 'female', canBePregnant: true, canProduceMilk: false },
    { value: 'cat_kitten', labelKey: 'animalClass.cat_kitten', impliedGender: 'unknown', canBePregnant: false, canProduceMilk: false },
    { value: 'cat_neuter', labelKey: 'animalClass.cat_neuter', impliedGender: 'unknown', canBePregnant: false, canProduceMilk: false },
  ],
}

export function classTermsForSpecies(species: string): AnimalClassTerm[] {
  return ANIMAL_CLASS_TERMS[species] || []
}

export function findClassTerm(species: string, value: string): AnimalClassTerm | undefined {
  return classTermsForSpecies(species).find(c => c.value === value)
}

export const SPECIES_ICONS: Record<string, string> = {
  Dog: '🐕', Cat: '🐈',
  Rabbit: '🐰', Hamster: '🐹', 'Guinea Pig': '🐾', Gerbil: '🐀',
  Chinchilla: '🐭', Ferret: '🦡', Hedgehog: '🦔', 'Sugar Glider': '🦘',
  Parrot: '🦜', Budgerigar: '🦜', Cockatiel: '🦜', Lovebird: '💚',
  Finch: '🐦', Canary: '🐦', Mynah: '🐦', Pigeon: '🕊️', Bird: '🐦',
  Tortoise: '🐢', Turtle: '🐢', Gecko: '🦎', 'Bearded Dragon': '🦎',
  Chameleon: '🦎', Snake: '🐍',
  Frog: '🐸', Axolotl: '🦎',
  'Ornamental Fish': '🐠', Koi: '🐟', Arowana: '🐟', Goldfish: '🐡',
  Cattle: '🐄', Buffalo: '🐃', Horse: '🐴', Donkey: '🫏',
  Sheep: '🐑', Goat: '🐐', Pig: '🐷', Camel: '🐪', Yak: '🐂', Deer: '🦌',
  Chicken: '🐔', Duck: '🦆', Turkey: '🦃', Quail: '🐦',
  Emu: '🦤', Ostrich: '🦢', Peacock: '🦚',
  Llama: '🦙', Alpaca: '🦙',
  Other: '🐾',
}

// Species that commonly use ear tags / registration numbers
export const EAR_TAG_SPECIES = ['Cattle', 'Buffalo', 'Sheep', 'Goat', 'Pig', 'Horse', 'Donkey', 'Camel', 'Yak', 'Deer', 'Emu', 'Ostrich', 'Peacock', 'Llama', 'Alpaca']

// ─── Marketplace species pickers ──────────────────────────────────────────
// Curated subsets (not the full SPECIES_CATEGORIES list) for the Marketplace
// sell form, keyed to canonical BREED_DATABASE names ('Cattle'/'Chicken', not
// 'Cow'/'Poultry' — the previous local copies of these lists used the wrong
// names, so breedsForSpecies() silently fell back to a generic ['Mixed
// Breed', 'Other'] instead of the real curated breed list for anyone
// listing a cattle or poultry animal).
export const MARKETPLACE_FARMER_SPECIES = ['Cattle', 'Buffalo', 'Goat', 'Sheep', 'Horse', 'Camel', 'Pig', 'Chicken', 'Dog', 'Cat', 'Other']
export const MARKETPLACE_PET_OWNER_SPECIES = ['Dog', 'Cat', 'Horse', 'Rabbit', 'Cattle', 'Buffalo', 'Goat', 'Sheep', 'Camel', 'Pig', 'Chicken', 'Other']

/** Breeds for a species, tolerant of case/singular differences. Falls back to a generic list. */
export function breedsForSpecies(species?: string): string[] {
  if (!species) return []
  const direct = BREED_DATABASE[species]
  if (direct) return direct
  const match = Object.keys(BREED_DATABASE).find(k => k.toLowerCase() === species.toLowerCase())
  return match ? BREED_DATABASE[match] : ['Mixed Breed', 'Other']
}
