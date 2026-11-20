import type { Species } from './types';

export interface BreedDefinition {
  readonly name: string;
  readonly species: Species;
  readonly origin: string;
  readonly category: string;
  readonly isAfrican?: boolean;
  readonly aliases?: readonly string[];
}

export const BREED_DICTIONARY: readonly BreedDefinition[] = [
  // ======================== CATTLE (cow) ========================
  // African Cattle Breeds & Crossbreeds
  {
    name: 'Ankole-Watusi (Ankole Longhorn)',
    species: 'cow',
    origin: 'East & Central Africa (Uganda / Rwanda)',
    category: 'Dual-Purpose · Hardy',
    isAfrican: true,
    aliases: ['Ankole', 'Ankole Longhorn', 'Ankole-Watusi', 'Watusi', 'Nkore'],
  },
  {
    name: 'Boran',
    species: 'cow',
    origin: 'East Africa (Kenya / Ethiopia)',
    category: 'Beef · Heat-Tolerant',
    isAfrican: true,
    aliases: ['Kenyan Boran', 'Improved Boran', 'Ethiopian Boran'],
  },
  {
    name: 'Nganda',
    species: 'cow',
    origin: 'Uganda (Lake Victoria Basin)',
    category: 'Dual-Purpose · Indigenous',
    isAfrican: true,
  },
  {
    name: 'Small East African Zebu',
    species: 'cow',
    origin: 'East Africa',
    category: 'Dual-Purpose · Drought-Tolerant',
    isAfrican: true,
    aliases: ['SEAZ', 'Zebu', 'East African Zebu', 'Nkedi Zebu'],
  },
  {
    name: 'East African Shorthorn Zebu',
    species: 'cow',
    origin: 'East Africa (Kenya / Tanzania / Uganda)',
    category: 'Dual-Purpose · Indigenous',
    isAfrican: true,
    aliases: ['EASZ', 'Shorthorn Zebu', 'Masai Zebu'],
  },
  {
    name: 'Nguni',
    species: 'cow',
    origin: 'Southern Africa (South Africa / Eswatini)',
    category: 'Beef · Tick-Resistant',
    isAfrican: true,
  },
  {
    name: 'Bonsmara',
    species: 'cow',
    origin: 'South Africa',
    category: 'Beef',
    isAfrican: true,
  },
  {
    name: 'Afrikaner',
    species: 'cow',
    origin: 'Southern Africa',
    category: 'Beef · Hardy',
    isAfrican: true,
    aliases: ['Africander'],
  },
  {
    name: 'Tuli',
    species: 'cow',
    origin: 'Zimbabwe',
    category: 'Beef · Heat-Tolerant',
    isAfrican: true,
  },
  {
    name: 'Sahiwal',
    species: 'cow',
    origin: 'East Africa / South Asia (Widely adapted in Kenya & Uganda)',
    category: 'Dairy · Dual-Purpose',
    isAfrican: true,
  },
  {
    name: 'Kenana',
    species: 'cow',
    origin: 'Sudan (Blue Nile)',
    category: 'Dairy · Zebu',
    isAfrican: true,
  },
  {
    name: 'Butana',
    species: 'cow',
    origin: 'Sudan',
    category: 'Dairy · Zebu',
    isAfrican: true,
  },
  {
    name: "N'Dama",
    species: 'cow',
    origin: 'West Africa (Guinea / Senegal)',
    category: 'Beef · Trypanotolerant',
    isAfrican: true,
    aliases: ['Ndama'],
  },
  {
    name: 'White Fulani (Bunaji)',
    species: 'cow',
    origin: 'West & Central Africa (Nigeria / Niger)',
    category: 'Dual-Purpose · Dairy/Beef',
    isAfrican: true,
    aliases: ['White Fulani', 'Bunaji'],
  },
  {
    name: 'Sokoto Gudali',
    species: 'cow',
    origin: 'West Africa (Nigeria / Mali)',
    category: 'Dairy · Beef',
    isAfrican: true,
    aliases: ['Gudali'],
  },
  {
    name: 'Red Bororo (Rahaji)',
    species: 'cow',
    origin: 'Sahel & West Africa',
    category: 'Beef · Pastoral',
    isAfrican: true,
    aliases: ['Red Bororo', 'Rahaji', 'Mbororo'],
  },
  {
    name: 'Mpwapwa',
    species: 'cow',
    origin: 'Tanzania',
    category: 'Dual-Purpose · Synthetic',
    isAfrican: true,
  },
  {
    name: 'Drakensberger',
    species: 'cow',
    origin: 'South Africa',
    category: 'Beef · Hardy',
    isAfrican: true,
  },
  {
    name: 'Mashona',
    species: 'cow',
    origin: 'Zimbabwe',
    category: 'Beef · Sanga',
    isAfrican: true,
  },
  {
    name: 'Sanga',
    species: 'cow',
    origin: 'Eastern & Southern Africa',
    category: 'Dual-Purpose · Hardy',
    isAfrican: true,
  },
  {
    name: 'Tswana',
    species: 'cow',
    origin: 'Botswana',
    category: 'Beef · Heat-Tolerant',
    isAfrican: true,
  },
  {
    name: 'Kuri',
    species: 'cow',
    origin: 'Lake Chad Basin (Chad / Niger / Nigeria)',
    category: 'Dairy · Beef',
    isAfrican: true,
  },
  {
    name: 'Friesian-Ankole Cross',
    species: 'cow',
    origin: 'East Africa Hybrid',
    category: 'Dairy Crossbreed',
    isAfrican: true,
    aliases: ['Ankole-Friesian Cross', 'Ankole Cross'],
  },
  {
    name: 'Friesian-Zebu Cross',
    species: 'cow',
    origin: 'East Africa Hybrid',
    category: 'Dairy Crossbreed',
    isAfrican: true,
    aliases: ['Zebu-Friesian Cross', 'Zebu Cross'],
  },
  {
    name: 'Jersey-Cross',
    species: 'cow',
    origin: 'Dairy Crossbreed',
    category: 'Dairy Crossbreed',
    isAfrican: true,
    aliases: ['Jersey Cross', 'Jersey-Zebu Cross'],
  },
  {
    name: 'Indigenous / Local Crossbreed',
    species: 'cow',
    origin: 'Regional Crossbreed',
    category: 'Dual-Purpose',
    isAfrican: true,
    aliases: ['Local Crossbreed', 'Local Cow', 'Mixed Cattle'],
  },
  // Global Cattle Breeds
  {
    name: 'Holstein',
    species: 'cow',
    origin: 'Netherlands / North America',
    category: 'High-Yield Dairy',
    aliases: ['Holstein Friesian', 'Holstein-Friesian'],
  },
  {
    name: 'Friesian',
    species: 'cow',
    origin: 'Europe (Netherlands / UK)',
    category: 'High-Yield Dairy',
    aliases: ['British Friesian', 'Dutch Friesian'],
  },
  {
    name: 'Jersey',
    species: 'cow',
    origin: 'Channel Islands (UK)',
    category: 'High-Butterfat Dairy',
  },
  {
    name: 'Guernsey',
    species: 'cow',
    origin: 'Channel Islands (UK)',
    category: 'Dairy',
  },
  {
    name: 'Ayrshire',
    species: 'cow',
    origin: 'Scotland',
    category: 'Dairy',
  },
  {
    name: 'Brown Swiss',
    species: 'cow',
    origin: 'Switzerland',
    category: 'Dairy · Dual-Purpose',
  },
  {
    name: 'Simmental (Fleckvieh)',
    species: 'cow',
    origin: 'Switzerland / Germany',
    category: 'Dual-Purpose · Dairy/Beef',
    aliases: ['Simmental', 'Fleckvieh'],
  },
  {
    name: 'Brahman',
    species: 'cow',
    origin: 'USA / India (Tropically Adapted)',
    category: 'Beef · Heat-Tolerant',
  },
  {
    name: 'Angus (Aberdeen Angus)',
    species: 'cow',
    origin: 'Scotland',
    category: 'Beef',
    aliases: ['Angus', 'Aberdeen Angus', 'Black Angus', 'Red Angus'],
  },
  {
    name: 'Hereford',
    species: 'cow',
    origin: 'England',
    category: 'Beef',
  },
  {
    name: 'Charolais',
    species: 'cow',
    origin: 'France',
    category: 'Beef',
  },
  {
    name: 'Limousin',
    species: 'cow',
    origin: 'France',
    category: 'Beef',
  },
  {
    name: 'Shorthorn',
    species: 'cow',
    origin: 'England',
    category: 'Dual-Purpose',
  },
  {
    name: 'Santa Gertrudis',
    species: 'cow',
    origin: 'USA',
    category: 'Beef',
  },
  {
    name: 'Brangus',
    species: 'cow',
    origin: 'USA (Brahman x Angus)',
    category: 'Beef',
  },
  {
    name: 'Beefmaster',
    species: 'cow',
    origin: 'USA',
    category: 'Beef',
  },

  // ======================== GOATS (goat) ========================
  // African Goat Breeds & Crossbreeds
  {
    name: 'Boer',
    species: 'goat',
    origin: 'South Africa',
    category: 'Meat · Fast Growth',
    isAfrican: true,
    aliases: ['Boer Goat'],
  },
  {
    name: 'Kalahari Red',
    species: 'goat',
    origin: 'South Africa / Namibia',
    category: 'Meat · Hardy',
    isAfrican: true,
  },
  {
    name: 'Savanna',
    species: 'goat',
    origin: 'South Africa',
    category: 'Meat · Drought-Tolerant',
    isAfrican: true,
    aliases: ['White Savanna'],
  },
  {
    name: 'Small East African Goat',
    species: 'goat',
    origin: 'East Africa (Kenya / Uganda / Tanzania)',
    category: 'Meat · Disease-Hardy',
    isAfrican: true,
    aliases: ['Small East African', 'SEA Goat'],
  },
  {
    name: 'Mubende',
    species: 'goat',
    origin: 'Uganda',
    category: 'Meat & Hide',
    isAfrican: true,
    aliases: ['Mubende Goat'],
  },
  {
    name: 'Kigezi',
    species: 'goat',
    origin: 'Southwestern Uganda',
    category: 'Highland Meat',
    isAfrican: true,
  },
  {
    name: 'Sebei',
    species: 'goat',
    origin: 'Eastern Uganda',
    category: 'Meat · Hardy',
    isAfrican: true,
  },
  {
    name: 'Galla (Somali / Boran Goat)',
    species: 'goat',
    origin: 'Kenya / Somalia / Ethiopia',
    category: 'Meat & Milk · Arid-Hardy',
    isAfrican: true,
    aliases: ['Galla', 'Somali Goat', 'Boran Goat'],
  },
  {
    name: 'West African Dwarf (WAD)',
    species: 'goat',
    origin: 'West & Central Africa',
    category: 'Meat · Trypanotolerant',
    isAfrican: true,
    aliases: ['West African Dwarf', 'WAD'],
  },
  {
    name: 'Red Sokoto (Maradi)',
    species: 'goat',
    origin: 'Nigeria / Niger',
    category: 'Dual-Purpose · Leather',
    isAfrican: true,
    aliases: ['Red Sokoto', 'Maradi'],
  },
  {
    name: 'Sahelian',
    species: 'goat',
    origin: 'West African Sahel',
    category: 'Meat & Milk',
    isAfrican: true,
  },
  {
    name: 'Anglo-Nubian (Nubian)',
    species: 'goat',
    origin: 'Africa / UK Cross',
    category: 'Dual-Purpose · High-Butterfat Milk',
    isAfrican: true,
    aliases: ['Nubian', 'Anglo-Nubian'],
  },
  {
    name: 'Matabele',
    species: 'goat',
    origin: 'Zimbabwe',
    category: 'Meat · Hardy',
    isAfrican: true,
  },
  {
    name: 'Tswana Goat',
    species: 'goat',
    origin: 'Botswana',
    category: 'Meat · Arid-Hardy',
    isAfrican: true,
    aliases: ['Tswana'],
  },
  {
    name: 'Damara Goat',
    species: 'goat',
    origin: 'Namibia',
    category: 'Meat · Arid-Hardy',
    isAfrican: true,
  },
  {
    name: 'Boer Crossbreed',
    species: 'goat',
    origin: 'Regional Crossbreed',
    category: 'Improved Meat Cross',
    isAfrican: true,
    aliases: ['Boer Cross', 'Boer-Mubende Cross'],
  },
  {
    name: 'Dairy Goat Crossbreed',
    species: 'goat',
    origin: 'Regional Crossbreed',
    category: 'Improved Dairy Cross',
    isAfrican: true,
    aliases: ['Toggenburg Cross', 'Saanen Cross', 'Alpine Cross'],
  },
  {
    name: 'Indigenous / Local Crossbreed',
    species: 'goat',
    origin: 'Regional Crossbreed',
    category: 'Dual-Purpose',
    isAfrican: true,
    aliases: ['Local Goat', 'Mixed Goat'],
  },
  // Global Goat Breeds
  {
    name: 'Saanen',
    species: 'goat',
    origin: 'Switzerland',
    category: 'High-Yield Dairy',
  },
  {
    name: 'Toggenburg',
    species: 'goat',
    origin: 'Switzerland',
    category: 'Dairy · Highland-Adapted',
  },
  {
    name: 'Alpine',
    species: 'goat',
    origin: 'French Alps',
    category: 'Dairy',
    aliases: ['French Alpine'],
  },
  {
    name: 'LaMancha',
    species: 'goat',
    origin: 'USA',
    category: 'Dairy',
  },
  {
    name: 'Oberhasli',
    species: 'goat',
    origin: 'Switzerland',
    category: 'Dairy',
  },
  {
    name: 'Nigerian Dwarf',
    species: 'goat',
    origin: 'West Africa / USA',
    category: 'Dairy · Miniature',
  },
  {
    name: 'Pygmy',
    species: 'goat',
    origin: 'Cameroon / West Africa',
    category: 'Companion · Meat',
  },
  {
    name: 'Angora',
    species: 'goat',
    origin: 'Turkey',
    category: 'Fiber (Mohair)',
  },
  {
    name: 'Cashmere',
    species: 'goat',
    origin: 'Central Asia',
    category: 'Fiber',
  },
  {
    name: 'Damascus (Shami)',
    species: 'goat',
    origin: 'Middle East / North Africa',
    category: 'Dairy & Meat',
    aliases: ['Damascus', 'Shami'],
  },

  // ======================== SHEEP (sheep) ========================
  // African Sheep Breeds
  {
    name: 'Dorper',
    species: 'sheep',
    origin: 'South Africa (Dorset Horn x Blackhead Persian)',
    category: 'Meat · Hair Sheep',
    isAfrican: true,
  },
  {
    name: 'White Dorper',
    species: 'sheep',
    origin: 'South Africa',
    category: 'Meat · Hair Sheep',
    isAfrican: true,
  },
  {
    name: 'Red Maasai',
    species: 'sheep',
    origin: 'East Africa (Kenya / Tanzania)',
    category: 'Meat · Parasite-Resistant',
    isAfrican: true,
    aliases: ['Maasai', 'Masai Sheep'],
  },
  {
    name: 'Blackhead Persian (Somali)',
    species: 'sheep',
    origin: 'Somalia / East & South Africa',
    category: 'Fat-Rumped Meat',
    isAfrican: true,
    aliases: ['Blackhead Persian', 'Somali Sheep'],
  },
  {
    name: 'East African Fat-Tailed',
    species: 'sheep',
    origin: 'East Africa (Uganda / Kenya / Tanzania)',
    category: 'Meat · Hardy Indigenous',
    isAfrican: true,
    aliases: ['Fat-Tailed Sheep', 'East African Sheep'],
  },
  {
    name: 'Damara',
    species: 'sheep',
    origin: 'Namibia / Angola',
    category: 'Fat-Tailed · Drought-Hardy',
    isAfrican: true,
  },
  {
    name: 'Van Rooy',
    species: 'sheep',
    origin: 'South Africa',
    category: 'Meat · Hair Sheep',
    isAfrican: true,
  },
  {
    name: 'Meatmaster',
    species: 'sheep',
    origin: 'South Africa',
    category: 'Meat · Easy-Care',
    isAfrican: true,
  },
  {
    name: 'West African Dwarf (Djallonké)',
    species: 'sheep',
    origin: 'West & Central Africa',
    category: 'Meat · Trypanotolerant',
    isAfrican: true,
    aliases: ['Djallonke', 'Djallonké', 'West African Dwarf Sheep'],
  },
  {
    name: 'Uda',
    species: 'sheep',
    origin: 'West African Sahel (Nigeria / Niger / Chad)',
    category: 'Meat · Long-Legged Hair Sheep',
    isAfrican: true,
  },
  {
    name: 'Yankasa',
    species: 'sheep',
    origin: 'Nigeria',
    category: 'Meat & Milk',
    isAfrican: true,
  },
  {
    name: 'Balami',
    species: 'sheep',
    origin: 'Nigeria / Chad',
    category: 'Large Meat Sheep',
    isAfrican: true,
  },
  {
    name: 'Menz',
    species: 'sheep',
    origin: 'Ethiopian Highlands',
    category: 'Highland Wool & Meat',
    isAfrican: true,
  },
  {
    name: 'Horro',
    species: 'sheep',
    origin: 'Western Ethiopia',
    category: 'Fat-Tailed Meat',
    isAfrican: true,
  },
  {
    name: 'Afar',
    species: 'sheep',
    origin: 'Ethiopia / Djibouti / Eritrea',
    category: 'Arid Fat-Tailed',
    isAfrican: true,
  },
  {
    name: 'Namaqua Afrikaner',
    species: 'sheep',
    origin: 'South Africa / Namibia',
    category: 'Fat-Tailed · Hardy',
    isAfrican: true,
  },
  {
    name: 'Sabi',
    species: 'sheep',
    origin: 'Zimbabwe',
    category: 'Fat-Tailed · Indigenous',
    isAfrican: true,
  },
  {
    name: 'Dorper Crossbreed',
    species: 'sheep',
    origin: 'Regional Crossbreed',
    category: 'Improved Meat Cross',
    isAfrican: true,
    aliases: ['Dorper Cross'],
  },
  {
    name: 'Indigenous / Local Crossbreed',
    species: 'sheep',
    origin: 'Regional Crossbreed',
    category: 'Dual-Purpose',
    isAfrican: true,
    aliases: ['Local Sheep', 'Mixed Sheep'],
  },
  // Global Sheep Breeds
  {
    name: 'Merino',
    species: 'sheep',
    origin: 'Spain / Global (also South Africa)',
    category: 'Fine Wool · Dual-Purpose',
  },
  {
    name: 'Suffolk',
    species: 'sheep',
    origin: 'England',
    category: 'Meat',
  },
  {
    name: 'Hampshire',
    species: 'sheep',
    origin: 'England',
    category: 'Meat',
  },
  {
    name: 'Texel',
    species: 'sheep',
    origin: 'Netherlands',
    category: 'Lean Meat',
  },
  {
    name: 'Romney',
    species: 'sheep',
    origin: 'England / New Zealand',
    category: 'Dual-Purpose · Wet-Adapted',
  },
  {
    name: 'Awassi',
    species: 'sheep',
    origin: 'Southwest Asia / North Africa',
    category: 'Dairy · Fat-Tailed',
  },
  {
    name: 'Katahdin',
    species: 'sheep',
    origin: 'USA',
    category: 'Meat · Hair Sheep',
  },
  {
    name: 'Barbados Blackbelly',
    species: 'sheep',
    origin: 'Caribbean (African Heritage)',
    category: 'Meat · Hair Sheep',
  },
  {
    name: 'Corriedale',
    species: 'sheep',
    origin: 'New Zealand (Widely raised in Kenya)',
    category: 'Dual-Purpose · Wool/Meat',
  },

  // ======================== DUCKS (duck) ========================
  {
    name: 'Muscovy',
    species: 'duck',
    origin: 'Widely Kept in Africa / Americas',
    category: 'Meat · Self-Brooding & Hardy',
    isAfrican: true,
    aliases: ['Muscovy Duck'],
  },
  {
    name: 'African Indigenous / Local Duck',
    species: 'duck',
    origin: 'Sub-Saharan Africa Homesteads',
    category: 'Dual-Purpose · Free-Range',
    isAfrican: true,
    aliases: ['Local Duck', 'Indigenous Duck'],
  },
  {
    name: 'Pekin',
    species: 'duck',
    origin: 'China / Global Commercial',
    category: 'Fast-Growth Meat',
    aliases: ['White Pekin', 'Pekin Duck'],
  },
  {
    name: 'Khaki Campbell',
    species: 'duck',
    origin: 'England',
    category: 'High-Yield Layers (Eggs)',
  },
  {
    name: 'Indian Runner',
    species: 'duck',
    origin: 'Southeast Asia',
    category: 'Egg Layer · Forager',
  },
  {
    name: 'Rouen',
    species: 'duck',
    origin: 'France',
    category: 'Roasting Meat',
  },
  {
    name: 'Mallard',
    species: 'duck',
    origin: 'Northern Hemisphere',
    category: 'Dual-Purpose · Wild Type',
  },
  {
    name: 'Cayuga',
    species: 'duck',
    origin: 'USA',
    category: 'Dual-Purpose',
  },
  {
    name: 'Swedish Blue',
    species: 'duck',
    origin: 'Sweden',
    category: 'Dual-Purpose · Cold/Wet-Hardy',
  },
  {
    name: 'Welsh Harlequin',
    species: 'duck',
    origin: 'Wales',
    category: 'Egg Layer',
  },
  {
    name: 'Silver Appleyard',
    species: 'duck',
    origin: 'England',
    category: 'Dual-Purpose',
  },
  {
    name: 'Buff Orpington',
    species: 'duck',
    origin: 'England',
    category: 'Dual-Purpose',
  },
  {
    name: 'Aylesbury',
    species: 'duck',
    origin: 'England',
    category: 'Meat',
  },
  {
    name: 'Mulard (Moulard Cross)',
    species: 'duck',
    origin: 'Muscovy x Pekin Hybrid',
    category: 'Commercial Meat Hybrid',
    aliases: ['Mulard', 'Moulard'],
  },

  // ======================== OTHER / POULTRY & HOMESTEAD (other) ========================
  // African & Tropical Poultry Breeds
  {
    name: 'Kuroiler',
    species: 'other',
    origin: 'India / Widely Farmed in Uganda & Kenya',
    category: 'Poultry · Dual-Purpose Scavenger',
    isAfrican: true,
  },
  {
    name: 'Sasso',
    species: 'other',
    origin: 'France / Widely Kept Dual-Purpose in East Africa',
    category: 'Poultry · Slow-Growing Meat & Eggs',
    isAfrican: true,
  },
  {
    name: 'Kenbro',
    species: 'other',
    origin: 'Kenya',
    category: 'Poultry · Dual-Purpose',
    isAfrican: true,
  },
  {
    name: 'Kari Improved Kienyeji',
    species: 'other',
    origin: 'Kenya (KALRO)',
    category: 'Poultry · High-Yield Dual-Purpose',
    isAfrican: true,
    aliases: ['Improved Kienyeji', 'KALRO Kienyeji'],
  },
  {
    name: 'Kienyeji (Indigenous Village Chicken)',
    species: 'other',
    origin: 'East Africa',
    category: 'Poultry · Free-Range Hardy',
    isAfrican: true,
    aliases: ['Kienyeji', 'Local Chicken', 'Indigenous Chicken'],
  },
  {
    name: 'Potchefstroom Koekoek',
    species: 'other',
    origin: 'South Africa',
    category: 'Poultry · Dual-Purpose Free-Range',
    isAfrican: true,
    aliases: ['Koekoek'],
  },
  {
    name: 'Boschveld',
    species: 'other',
    origin: 'South Africa',
    category: 'Poultry · Hardy Free-Range',
    isAfrican: true,
  },
  {
    name: 'Venda',
    species: 'other',
    origin: 'South Africa (Limpopo)',
    category: 'Poultry · Indigenous',
    isAfrican: true,
  },
  {
    name: 'Ovambo',
    species: 'other',
    origin: 'Northern Namibia',
    category: 'Poultry · Hardy Indigenous',
    isAfrican: true,
  },
  {
    name: 'Fayoumi',
    species: 'other',
    origin: 'Egypt',
    category: 'Poultry · Disease-Hardy Layer',
    isAfrican: true,
  },
  {
    name: 'Noiler',
    species: 'other',
    origin: 'Nigeria',
    category: 'Poultry · Dual-Purpose',
    isAfrican: true,
  },
  {
    name: 'Fulani Ecotype',
    species: 'other',
    origin: 'Nigeria',
    category: 'Poultry · Heavy Ecotype',
    isAfrican: true,
  },
  // Global Commercial & Heritage Poultry
  {
    name: 'Rhode Island Red',
    species: 'other',
    origin: 'USA',
    category: 'Poultry · Brown Egg & Meat',
  },
  {
    name: 'Cobb 500 (Broiler)',
    species: 'other',
    origin: 'Commercial Hybrid',
    category: 'Poultry · Fast Broiler',
    aliases: ['Cobb 500', 'Broiler'],
  },
  {
    name: 'Ross 308 (Broiler)',
    species: 'other',
    origin: 'Commercial Hybrid',
    category: 'Poultry · Fast Broiler',
    aliases: ['Ross 308'],
  },
  {
    name: 'ISA Brown (Layer)',
    species: 'other',
    origin: 'Commercial Hybrid',
    category: 'Poultry · High-Yield Layer',
    aliases: ['ISA Brown', 'Layer'],
  },
  {
    name: 'Hy-Line Brown',
    species: 'other',
    origin: 'Commercial Hybrid',
    category: 'Poultry · Layer',
  },
  {
    name: 'Lohmann Brown',
    species: 'other',
    origin: 'Germany',
    category: 'Poultry · Layer',
  },
  {
    name: 'White Leghorn',
    species: 'other',
    origin: 'Italy / Global',
    category: 'Poultry · White Egg Layer',
    aliases: ['Leghorn'],
  },
  {
    name: 'Plymouth Rock',
    species: 'other',
    origin: 'USA',
    category: 'Poultry · Dual-Purpose',
  },
  {
    name: 'Light Sussex',
    species: 'other',
    origin: 'England',
    category: 'Poultry · Dual-Purpose',
    aliases: ['Sussex'],
  },
  {
    name: 'Australorp',
    species: 'other',
    origin: 'Australia',
    category: 'Poultry · Dual-Purpose',
  },
  {
    name: 'Orpington',
    species: 'other',
    origin: 'England',
    category: 'Poultry · Dual-Purpose',
  },
  {
    name: 'Brahma',
    species: 'other',
    origin: 'Asia / USA',
    category: 'Poultry · Heavy Dual-Purpose',
  },
  {
    name: 'Guinea Fowl (Helmeted)',
    species: 'other',
    origin: 'Sub-Saharan Africa',
    category: 'Poultry · Pest-Foraging Meat',
    isAfrican: true,
    aliases: ['Guinea Fowl'],
  },
  {
    name: 'Broad Breasted Turkey',
    species: 'other',
    origin: 'Americas / Global',
    category: 'Poultry · Meat Turkey',
    aliases: ['Turkey'],
  },
  // Pigs, Rabbits & Other Homestead Stock
  {
    name: 'Camborough Pig',
    species: 'other',
    origin: 'Commercial Hybrid (Popular in East Africa)',
    category: 'Swine · Lean Meat',
    isAfrican: true,
  },
  {
    name: 'Large White Pig',
    species: 'other',
    origin: 'England / Global',
    category: 'Swine · Commercial Pork',
    aliases: ['Large White'],
  },
  {
    name: 'Landrace Pig',
    species: 'other',
    origin: 'Denmark / Global',
    category: 'Swine · Bacon & Pork',
    aliases: ['Landrace'],
  },
  {
    name: 'Duroc Pig',
    species: 'other',
    origin: 'USA',
    category: 'Swine · Meat',
    aliases: ['Duroc'],
  },
  {
    name: 'African Indigenous Pig',
    species: 'other',
    origin: 'Sub-Saharan Africa',
    category: 'Swine · Hardy Local',
    isAfrican: true,
  },
  {
    name: 'New Zealand White Rabbit',
    species: 'other',
    origin: 'USA / Global',
    category: 'Rabbitry · Meat',
  },
  {
    name: 'Californian Rabbit',
    species: 'other',
    origin: 'USA',
    category: 'Rabbitry · Meat',
  },
  {
    name: 'Chinchilla Rabbit',
    species: 'other',
    origin: 'France / Global',
    category: 'Rabbitry · Meat & Fur',
  },
  {
    name: 'Mixed / Unspecified Breed',
    species: 'other',
    origin: 'General Homestead',
    category: 'Other Livestock',
    aliases: ['Mixed Breed', 'Other Breed'],
  },
];

function normalizeBreedCompare(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function getBreedsForSpecies(species: Species): readonly BreedDefinition[] {
  return BREED_DICTIONARY.filter((def) => def.species === species).sort((a, b) => {
    const africanDiff = Number(Boolean(b.isAfrican)) - Number(Boolean(a.isAfrican));
    if (africanDiff !== 0) return africanDiff;
    return a.name.localeCompare(b.name, 'en');
  });
}

export function formatBreedHint(def: BreedDefinition): string {
  return def.isAfrican
    ? `African · ${def.origin} · ${def.category}`
    : `${def.origin} · ${def.category}`;
}

export function findCanonicalBreed(
  species: Species,
  rawBreed: string
): BreedDefinition | null {
  const normalized = normalizeBreedCompare(rawBreed);
  if (!normalized) return null;

  for (const def of BREED_DICTIONARY) {
    if (def.species !== species) continue;
    if (normalizeBreedCompare(def.name) === normalized) {
      return def;
    }
    if (def.aliases?.some((alias) => normalizeBreedCompare(alias) === normalized)) {
      return def;
    }
  }
  return null;
}

export function isValidBreedForSpecies(species: Species, rawBreed: string): boolean {
  return findCanonicalBreed(species, rawBreed) !== null;
}
