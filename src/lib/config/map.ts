// Map configuration - hotspots, conflict zones, and strategic locations

export interface Hotspot {
	name: string;
	lat: number;
	lon: number;
	level: 'critical' | 'high' | 'elevated' | 'low';
	desc: string;
}

export interface ConflictZone {
	name: string;
	coords: [number, number][];
	color: string;
}

export interface Chokepoint {
	name: string;
	lat: number;
	lon: number;
	desc: string;
}

export interface CableLanding {
	name: string;
	lat: number;
	lon: number;
	desc: string;
}

export interface NuclearSite {
	name: string;
	lat: number;
	lon: number;
	desc: string;
}

export interface MilitaryBase {
	name: string;
	lat: number;
	lon: number;
	desc: string;
}

export interface OutageEvent {
	id: string;
	name: string;
	lat: number;
	lon: number;
	type: 'internet' | 'power' | 'both';
	severity: 'partial' | 'major' | 'total';
	region?: string;
	desc: string;
	affectedPopulation?: number;
	startTime?: string;
	active: boolean;
}

export interface Ocean {
	name: string;
	lat: number;
	lon: number;
}

export const THREAT_COLORS = {
	critical: '#ff0000',
	high: '#ff4444',
	elevated: '#ffcc00',
	low: '#00ff88'
} as const;

export const SANCTIONED_COUNTRY_IDS = [
	364, // Iran
	408, // North Korea
	760, // Syria
	862, // Venezuela
	112, // Belarus
	643, // Russia
	728, // South Sudan
	729 // Sudan
];

export const HOTSPOTS: Hotspot[] = [
	{
		name: 'DC',
		lat: 38.9,
		lon: -77.0,
		level: 'low',
		desc: 'Washington DC — US political center, White House, Pentagon, Capitol'
	},
	{
		name: 'Moscow',
		lat: 55.75,
		lon: 37.6,
		level: 'elevated',
		desc: 'Moscow — Kremlin, Russian military command, sanctions hub'
	},
	{
		name: 'Beijing',
		lat: 39.9,
		lon: 116.4,
		level: 'elevated',
		desc: 'Beijing — CCP headquarters, US-China tensions, tech rivalry'
	},
	{
		name: 'Kyiv',
		lat: 50.45,
		lon: 30.5,
		level: 'high',
		desc: 'Kyiv — Active conflict zone, Russian invasion ongoing'
	},
	{
		name: 'Taipei',
		lat: 25.03,
		lon: 121.5,
		level: 'elevated',
		desc: 'Taipei — Taiwan Strait tensions, TSMC, China threat'
	},
	{
		name: 'Tehran',
		lat: 35.7,
		lon: 51.4,
		level: 'critical',
		desc: 'Tehran — ACTIVE UPRISING: 200+ cities, 26 provinces. Revolution protests, regime instability, nuclear program'
	},
	{
		name: 'Tel Aviv',
		lat: 32.07,
		lon: 34.78,
		level: 'high',
		desc: 'Tel Aviv — Israel-Gaza conflict, active military operations'
	},
	{
		name: 'London',
		lat: 51.5,
		lon: -0.12,
		level: 'low',
		desc: 'London — Financial center, Five Eyes, NATO ally'
	},
	{
		name: 'Brussels',
		lat: 50.85,
		lon: 4.35,
		level: 'low',
		desc: 'Brussels — EU/NATO headquarters, European policy'
	},
	{
		name: 'Pyongyang',
		lat: 39.03,
		lon: 125.75,
		level: 'elevated',
		desc: 'Pyongyang — North Korea nuclear threat, missile tests'
	},
	{
		name: 'Riyadh',
		lat: 24.7,
		lon: 46.7,
		level: 'elevated',
		desc: 'Riyadh — Saudi oil, OPEC+, Yemen conflict, regional power'
	},
	{
		name: 'Delhi',
		lat: 28.6,
		lon: 77.2,
		level: 'low',
		desc: 'Delhi — India rising power, China border tensions'
	},
	{
		name: 'Singapore',
		lat: 1.35,
		lon: 103.82,
		level: 'low',
		desc: 'Singapore — Shipping chokepoint, Asian finance hub'
	},
	{
		name: 'Tokyo',
		lat: 35.68,
		lon: 139.76,
		level: 'low',
		desc: 'Tokyo — US ally, regional security, economic power'
	},
	{
		name: 'Caracas',
		lat: 10.5,
		lon: -66.9,
		level: 'high',
		desc: 'Caracas — Venezuela crisis, Maduro regime, US sanctions, humanitarian emergency'
	},
	{
		name: 'Nuuk',
		lat: 64.18,
		lon: -51.72,
		level: 'elevated',
		desc: 'Nuuk — Greenland, US acquisition interest, Arctic strategy, Denmark tensions'
	}
];

export const CONFLICT_ZONES: ConflictZone[] = [
	{
		name: 'Ukraine',
		coords: [
			[30, 52],
			[40, 52],
			[40, 45],
			[30, 45],
			[30, 52]
		],
		color: '#ff4444'
	},
	{
		name: 'Gaza',
		coords: [
			[34, 32],
			[35, 32],
			[35, 31],
			[34, 31],
			[34, 32]
		],
		color: '#ff4444'
	},
	{
		name: 'Taiwan Strait',
		coords: [
			[117, 28],
			[122, 28],
			[122, 22],
			[117, 22],
			[117, 28]
		],
		color: '#ffaa00'
	},
	{
		name: 'Yemen',
		coords: [
			[42, 19],
			[54, 19],
			[54, 12],
			[42, 12],
			[42, 19]
		],
		color: '#ff6644'
	},
	{
		name: 'Sudan',
		coords: [
			[22, 23],
			[38, 23],
			[38, 8],
			[22, 8],
			[22, 23]
		],
		color: '#ff6644'
	},
	{
		name: 'Myanmar',
		coords: [
			[92, 28],
			[101, 28],
			[101, 10],
			[92, 10],
			[92, 28]
		],
		color: '#ff8844'
	}
];

export const CHOKEPOINTS: Chokepoint[] = [
	{
		name: 'Suez',
		lat: 30.0,
		lon: 32.5,
		desc: 'Suez Canal — 12% of global trade, Europe-Asia route'
	},
	{
		name: 'Panama',
		lat: 9.1,
		lon: -79.7,
		desc: 'Panama Canal — Americas transit, Pacific-Atlantic link'
	},
	{
		name: 'Hormuz',
		lat: 26.5,
		lon: 56.5,
		desc: 'Strait of Hormuz — 21% of global oil, Persian Gulf exit'
	},
	{
		name: 'Malacca',
		lat: 2.5,
		lon: 101.0,
		desc: 'Strait of Malacca — 25% of global trade, China supply line'
	},
	{
		name: 'Bab el-M',
		lat: 12.5,
		lon: 43.3,
		desc: 'Bab el-Mandeb — Red Sea gateway, Houthi threat zone'
	},
	{ name: 'Gibraltar', lat: 36.0, lon: -5.5, desc: 'Strait of Gibraltar — Mediterranean access' },
	{
		name: 'Bosporus',
		lat: 41.1,
		lon: 29.0,
		desc: 'Bosporus Strait — Black Sea access, Russia exports'
	}
];

export const CABLE_LANDINGS: CableLanding[] = [
	// North America
	{ name: 'NYC', lat: 40.7, lon: -74.0, desc: 'New York — Transatlantic hub, 10+ cables' },
	{ name: 'LA', lat: 33.7, lon: -118.2, desc: 'Los Angeles — Pacific gateway' },
	{ name: 'Miami', lat: 25.8, lon: -80.2, desc: 'Miami — Americas/Caribbean hub' },
	{ name: 'Virginia Beach', lat: 36.9, lon: -76.0, desc: 'Virginia Beach — Major US East Coast landing' },
	// Europe
	{ name: 'Cornwall', lat: 50.1, lon: -5.5, desc: 'Cornwall UK — Europe-Americas gateway' },
	{ name: 'Marseille', lat: 43.3, lon: 5.4, desc: 'Marseille — Mediterranean hub, SEA-ME-WE' },
	{ name: 'Frankfurt', lat: 50.1, lon: 8.7, desc: 'Frankfurt — DE-CIX, Europe largest IX' },
	{ name: 'Amsterdam', lat: 52.4, lon: 4.9, desc: 'Amsterdam — AMS-IX, major European hub' },
	// Middle East
	{ name: 'Fujairah', lat: 25.1, lon: 56.4, desc: 'Fujairah UAE — Middle East cable hub' },
	{ name: 'Jeddah', lat: 21.5, lon: 39.2, desc: 'Jeddah — Red Sea cable junction' },
	{ name: 'Djibouti', lat: 11.6, lon: 43.1, desc: 'Djibouti — Africa/Asia strategic link' },
	// Asia
	{ name: 'Mumbai', lat: 19.1, lon: 72.9, desc: 'Mumbai — India gateway, 10+ cables' },
	{ name: 'Chennai', lat: 13.1, lon: 80.3, desc: 'Chennai — India East coast hub' },
	{ name: 'Singapore', lat: 1.3, lon: 103.8, desc: 'Singapore — Asia-Pacific nexus, 20+ cables' },
	{ name: 'Hong Kong', lat: 22.3, lon: 114.2, desc: 'Hong Kong — China connectivity hub' },
	{ name: 'Tokyo', lat: 35.5, lon: 139.8, desc: 'Tokyo — Trans-Pacific terminus' },
	{ name: 'Busan', lat: 35.1, lon: 129.0, desc: 'Busan — Korea/Japan cable hub' },
	// Oceania/Africa/South America
	{ name: 'Sydney', lat: -33.9, lon: 151.2, desc: 'Sydney — Australia/Pacific hub' },
	{ name: 'Cape Town', lat: -33.9, lon: 18.4, desc: 'Cape Town — Africa west/south hub' },
	{ name: 'Fortaleza', lat: -3.7, lon: -38.5, desc: 'Fortaleza — Brazil, South America hub' }
];

export const NUCLEAR_SITES: NuclearSite[] = [
	// Iran
	{ name: 'Natanz', lat: 33.7, lon: 51.7, desc: 'Natanz — Iran uranium enrichment' },
	{ name: 'Bushehr', lat: 28.8, lon: 50.9, desc: 'Bushehr — Iran nuclear power plant' },
	{ name: 'Fordow', lat: 34.9, lon: 51.0, desc: 'Fordow — Iran underground enrichment' },
	// North Korea
	{ name: 'Yongbyon', lat: 39.8, lon: 125.8, desc: 'Yongbyon — North Korea nuclear complex' },
	{ name: 'Punggye-ri', lat: 41.3, lon: 129.1, desc: 'Punggye-ri — NK nuclear test site' },
	// Israel
	{ name: 'Dimona', lat: 31.0, lon: 35.1, desc: 'Dimona — Israel nuclear facility' },
	// Ukraine/Russia conflict
	{ name: 'Zaporizhzhia', lat: 47.5, lon: 34.6, desc: 'Zaporizhzhia — Europe largest NPP, conflict zone' },
	{ name: 'Chernobyl', lat: 51.4, lon: 30.1, desc: 'Chernobyl — Exclusion zone, occupied 2022' },
	// Russia
	{ name: 'Mayak', lat: 55.7, lon: 60.8, desc: 'Mayak — Russia plutonium production' },
	{ name: 'Sarov', lat: 54.9, lon: 43.3, desc: 'Sarov — Russia nuclear weapons lab' },
	// China
	{ name: 'Lop Nur', lat: 41.5, lon: 88.5, desc: 'Lop Nur — China nuclear test site' },
	{ name: 'Jiuquan', lat: 40.0, lon: 100.3, desc: 'Jiuquan — China nuclear/space complex' },
	// Pakistan
	{ name: 'Kahuta', lat: 33.6, lon: 73.4, desc: 'Kahuta — Pakistan uranium enrichment' },
	{ name: 'Khushab', lat: 32.0, lon: 72.2, desc: 'Khushab — Pakistan plutonium reactors' },
	// India
	{ name: 'BARC', lat: 19.0, lon: 72.9, desc: 'BARC Mumbai — India nuclear research' },
	{ name: 'Tarapur', lat: 19.8, lon: 72.7, desc: 'Tarapur — India largest nuclear plant' },
	// Other
	{ name: 'Fukushima', lat: 37.4, lon: 141.0, desc: 'Fukushima — Decommissioning site' },
	{ name: 'La Hague', lat: 49.7, lon: -1.9, desc: 'La Hague — France reprocessing plant' },
	{ name: 'Sellafield', lat: 54.4, lon: -3.5, desc: 'Sellafield — UK nuclear complex' }
];

export const MILITARY_BASES: MilitaryBase[] = [
	// US Major Bases
	{ name: 'Norfolk', lat: 36.9, lon: -76.3, desc: 'Norfolk — US Navy 2nd Fleet, largest naval base' },
	{ name: 'Pearl Harbor', lat: 21.4, lon: -157.9, desc: 'Pearl Harbor — US Pacific Fleet HQ' },
	{ name: 'San Diego', lat: 32.7, lon: -117.2, desc: 'San Diego — US 3rd Fleet, naval complex' },
	// Europe
	{ name: 'Ramstein', lat: 49.4, lon: 7.6, desc: 'Ramstein — US Air Force, NATO hub Germany' },
	{ name: 'Incirlik', lat: 37.0, lon: 35.4, desc: 'Incirlik — US/NATO Turkey, nuclear capable' },
	{ name: 'Aviano', lat: 46.0, lon: 12.6, desc: 'Aviano — US Air Force Italy, Med operations' },
	// Middle East
	{ name: 'Qatar', lat: 25.1, lon: 51.3, desc: 'Al Udeid — US CENTCOM forward HQ, largest ME base' },
	{ name: 'Bahrain', lat: 26.2, lon: 50.6, desc: 'Bahrain — US 5th Fleet HQ' },
	{ name: 'Diego Garcia', lat: -7.3, lon: 72.4, desc: 'Diego Garcia — US/UK Indian Ocean base' },
	{ name: 'Djibouti', lat: 11.5, lon: 43.1, desc: 'Djibouti — US/China/France bases, Horn of Africa' },
	// Pacific/Asia
	{ name: 'Yokosuka', lat: 35.3, lon: 139.7, desc: 'Yokosuka — US 7th Fleet HQ, Japan' },
	{ name: 'Okinawa', lat: 26.5, lon: 127.9, desc: 'Okinawa — US Forces Japan, 30+ facilities' },
	{ name: 'Guam', lat: 13.5, lon: 144.8, desc: 'Guam — US Pacific Command, bomber/sub base' },
	{ name: 'Camp Humphreys', lat: 36.9, lon: 127.0, desc: 'Camp Humphreys — US Forces Korea HQ' },
	// Russian
	{ name: 'Kaliningrad', lat: 54.7, lon: 20.5, desc: 'Kaliningrad — Russian Baltic exclave, Iskander missiles' },
	{ name: 'Sevastopol', lat: 44.6, lon: 33.5, desc: 'Sevastopol — Russian Black Sea Fleet HQ' },
	{ name: 'Tartus', lat: 34.9, lon: 35.9, desc: 'Tartus — Russian naval base Syria, Med presence' },
	{ name: 'Vladivostok', lat: 43.1, lon: 131.9, desc: 'Vladivostok — Russian Pacific Fleet HQ' },
	// Chinese
	{ name: 'Hainan', lat: 18.2, lon: 109.5, desc: 'Hainan — Chinese submarine base, South China Sea' },
	{ name: 'Djibouti PLA', lat: 11.6, lon: 43.0, desc: 'Djibouti — China first overseas base' },
	{ name: 'Fiery Cross', lat: 9.5, lon: 112.9, desc: 'Fiery Cross Reef — China SCS artificial island base' },
	// Other strategic
	{ name: 'Gwadar', lat: 25.1, lon: 62.3, desc: 'Gwadar — Pakistan/China port, CPEC strategic' }
];

export const OCEANS: Ocean[] = [
	{ name: 'ATLANTIC', lat: 25, lon: -40 },
	{ name: 'PACIFIC', lat: 0, lon: -150 },
	{ name: 'INDIAN', lat: -20, lon: 75 },
	{ name: 'ARCTIC', lat: 75, lon: 0 },
	{ name: 'SOUTHERN', lat: -60, lon: 0 }
];

// Internet blackouts and power outage events
export const OUTAGE_EVENTS: OutageEvent[] = [
	{
		id: 'iran-blackout',
		name: 'Iran Internet Blackout',
		lat: 32.4,
		lon: 53.7,
		type: 'internet',
		severity: 'major',
		region: 'Iran',
		desc: 'Periodic government-imposed internet blackouts during protests',
		affectedPopulation: 85000000,
		active: true
	},
	{
		id: 'myanmar-shutdown',
		name: 'Myanmar Connectivity',
		lat: 19.7,
		lon: 96.1,
		type: 'internet',
		severity: 'partial',
		region: 'Myanmar',
		desc: 'Military junta internet restrictions and mobile data throttling',
		affectedPopulation: 54000000,
		active: true
	},
	{
		id: 'ukraine-infrastructure',
		name: 'Ukraine Infrastructure',
		lat: 48.4,
		lon: 35.0,
		type: 'both',
		severity: 'major',
		region: 'Eastern Ukraine',
		desc: 'Power grid attacks and communication infrastructure damage from conflict',
		affectedPopulation: 10000000,
		active: true
	},
	{
		id: 'gaza-blackout',
		name: 'Gaza Communications',
		lat: 31.4,
		lon: 34.4,
		type: 'both',
		severity: 'total',
		region: 'Gaza Strip',
		desc: 'Complete communications and power blackout due to conflict',
		affectedPopulation: 2300000,
		active: true
	},
	{
		id: 'sudan-outage',
		name: 'Sudan Infrastructure',
		lat: 15.5,
		lon: 32.5,
		type: 'both',
		severity: 'major',
		region: 'Sudan',
		desc: 'Widespread power and internet disruptions from civil conflict',
		affectedPopulation: 45000000,
		active: true
	},
	{
		id: 'ethiopia-tigray',
		name: 'Tigray Region',
		lat: 14.1,
		lon: 38.8,
		type: 'both',
		severity: 'partial',
		region: 'Northern Ethiopia',
		desc: 'Communications blackout in conflict-affected regions',
		affectedPopulation: 6000000,
		active: true
	},
	{
		id: 'russia-censorship',
		name: 'Russia Internet Restrictions',
		lat: 55.75,
		lon: 37.6,
		type: 'internet',
		severity: 'partial',
		region: 'Russia',
		desc: 'Government-imposed internet censorship and VPN restrictions',
		affectedPopulation: 144000000,
		active: true
	},
	{
		id: 'xinjiang-restrictions',
		name: 'Xinjiang Digital Control',
		lat: 41.8,
		lon: 87.6,
		type: 'internet',
		severity: 'major',
		region: 'Xinjiang, China',
		desc: 'Heavy surveillance and internet restrictions in region',
		affectedPopulation: 26000000,
		active: true
	},
	{
		id: 'cuba-connectivity',
		name: 'Cuba Internet Access',
		lat: 21.5,
		lon: -80.0,
		type: 'internet',
		severity: 'partial',
		region: 'Cuba',
		desc: 'Limited internet access and government restrictions',
		affectedPopulation: 11000000,
		active: true
	},
	{
		id: 'venezuela-power',
		name: 'Venezuela Power Grid',
		lat: 8.0,
		lon: -66.0,
		type: 'power',
		severity: 'partial',
		region: 'Venezuela',
		desc: 'Chronic power grid failures and rolling blackouts',
		affectedPopulation: 28000000,
		active: true
	},
	{
		id: 'north-korea',
		name: 'North Korea',
		lat: 39.03,
		lon: 125.75,
		type: 'internet',
		severity: 'total',
		region: 'North Korea',
		desc: 'No public internet access - isolated intranet only',
		affectedPopulation: 26000000,
		active: true
	},
	{
		id: 'syria-infrastructure',
		name: 'Syria Infrastructure',
		lat: 35.0,
		lon: 38.0,
		type: 'both',
		severity: 'major',
		region: 'Syria',
		desc: 'War-damaged power grid and internet infrastructure',
		affectedPopulation: 22000000,
		active: true
	}
];

export const WEATHER_CODES: Record<number, string> = {
	0: '☀️ Clear',
	1: '🌤️ Mostly clear',
	2: '⛅ Partly cloudy',
	3: '☁️ Overcast',
	45: '🌫️ Fog',
	48: '🌫️ Fog',
	51: '🌧️ Drizzle',
	53: '🌧️ Drizzle',
	55: '🌧️ Drizzle',
	61: '🌧️ Rain',
	63: '🌧️ Rain',
	65: '🌧️ Heavy rain',
	71: '🌨️ Snow',
	73: '🌨️ Snow',
	75: '🌨️ Heavy snow',
	77: '🌨️ Snow',
	80: '🌧️ Showers',
	81: '🌧️ Showers',
	82: '⛈️ Heavy showers',
	85: '🌨️ Snow',
	86: '🌨️ Snow',
	95: '⛈️ Thunderstorm',
	96: '⛈️ Thunderstorm',
	99: '⛈️ Thunderstorm'
};

// Map detected news regions to hotspot names for news integration
export const REGION_TO_HOTSPOTS: Record<string, string[]> = {
	EUROPE: ['Moscow', 'Kyiv', 'London', 'Brussels'],
	MENA: ['Tehran', 'Tel Aviv', 'Riyadh'],
	APAC: ['Beijing', 'Taipei', 'Pyongyang', 'Tokyo', 'Delhi', 'Singapore'],
	AMERICAS: ['DC', 'Caracas'],
	AFRICA: [] // Could add African hotspots in the future
};

// Reverse mapping: hotspot name to region
export const HOTSPOT_TO_REGION: Record<string, string> = {
	Moscow: 'EUROPE',
	Kyiv: 'EUROPE',
	London: 'EUROPE',
	Brussels: 'EUROPE',
	Tehran: 'MENA',
	'Tel Aviv': 'MENA',
	Riyadh: 'MENA',
	Beijing: 'APAC',
	Taipei: 'APAC',
	Pyongyang: 'APAC',
	Tokyo: 'APAC',
	Delhi: 'APAC',
	Singapore: 'APAC',
	DC: 'AMERICAS',
	Caracas: 'AMERICAS',
	Nuuk: 'AMERICAS' // Greenland is closer to Americas geopolitically
};

// Keywords that directly match specific hotspots (more precise than region)
export const HOTSPOT_KEYWORDS: Record<string, string[]> = {
	Tehran: ['iran', 'tehran', 'persian', 'irgc', 'khamenei', 'rouhani'],
	'Tel Aviv': ['israel', 'tel aviv', 'jerusalem', 'gaza', 'netanyahu', 'idf'],
	Kyiv: ['ukraine', 'kyiv', 'kiev', 'zelensky', 'ukrainian'],
	Moscow: ['russia', 'moscow', 'kremlin', 'putin', 'russian'],
	Beijing: ['china', 'beijing', 'ccp', 'xi jinping', 'chinese'],
	Taipei: ['taiwan', 'taipei', 'tsmc', 'taiwanese'],
	Pyongyang: ['north korea', 'pyongyang', 'kim jong', 'dprk'],
	Tokyo: ['japan', 'tokyo', 'japanese'],
	DC: ['washington', 'white house', 'pentagon', 'congress', 'capitol'],
	Caracas: ['venezuela', 'caracas', 'maduro'],
	Riyadh: ['saudi', 'riyadh', 'mbs', 'aramco'],
	Nuuk: ['greenland', 'nuuk', 'arctic', 'denmark']
};
