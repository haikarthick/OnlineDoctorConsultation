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

/** Breeds for a species, tolerant of case/singular differences. Falls back to a generic list. */
export function breedsForSpecies(species?: string): string[] {
  if (!species) return []
  const direct = BREED_DATABASE[species]
  if (direct) return direct
  const match = Object.keys(BREED_DATABASE).find(k => k.toLowerCase() === species.toLowerCase())
  return match ? BREED_DATABASE[match] : ['Mixed Breed', 'Other']
}
