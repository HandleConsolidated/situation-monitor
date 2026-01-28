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
	// ========== UNITED STATES ==========
	// Continental US
	{ name: 'Norfolk', lat: 36.9, lon: -76.3, desc: 'Norfolk — US Navy 2nd Fleet, largest naval base worldwide' },
	{ name: 'San Diego', lat: 32.7, lon: -117.2, desc: 'San Diego — US 3rd Fleet, major Pacific naval complex' },
	{ name: 'Fort Bragg', lat: 35.14, lon: -79.0, desc: 'Fort Liberty — US Army largest base, Special Ops Command' },
	{ name: 'Fort Hood', lat: 31.13, lon: -97.78, desc: 'Fort Cavazos — US Army largest active duty armored post' },
	{ name: 'Nellis AFB', lat: 36.24, lon: -115.03, desc: 'Nellis — US Air Force Warfare Center, Red Flag exercises' },
	{ name: 'Edwards AFB', lat: 34.91, lon: -117.88, desc: 'Edwards — US Air Force Test Center, experimental aircraft' },
	{ name: 'Eglin AFB', lat: 30.46, lon: -86.52, desc: 'Eglin — US Air Force largest base by area, weapons testing' },
	{ name: 'Kings Bay', lat: 30.8, lon: -81.5, desc: 'Kings Bay — US Navy Atlantic submarine base, Trident missiles' },
	{ name: 'Kitsap', lat: 47.7, lon: -122.7, desc: 'Kitsap — US Navy Pacific submarine base, Trident missiles' },
	{ name: 'JBLM', lat: 47.1, lon: -122.5, desc: 'Joint Base Lewis-McChord — US Army/Air Force power projection' },
	{ name: 'Pendleton', lat: 33.3, lon: -117.35, desc: 'Camp Pendleton — US Marine Corps largest West Coast base' },
	{ name: 'Lejeune', lat: 34.62, lon: -77.36, desc: 'Camp Lejeune — US Marine Corps major East Coast base' },
	{ name: 'Coronado', lat: 32.68, lon: -117.17, desc: 'Coronado — US Navy SEAL training, Naval Special Warfare' },

	// US Pacific
	{ name: 'Pearl Harbor', lat: 21.35, lon: -157.95, desc: 'Pearl Harbor — US Pacific Fleet HQ, Indo-Pacific Command' },
	{ name: 'Guam', lat: 13.45, lon: 144.79, desc: 'Guam — US Pacific Command, Andersen AFB, strategic bomber base' },
	{ name: 'Yokosuka', lat: 35.28, lon: 139.67, desc: 'Yokosuka — US 7th Fleet HQ Japan, carrier homeport' },
	{ name: 'Okinawa', lat: 26.35, lon: 127.77, desc: 'Okinawa — US Forces Japan, Kadena AFB, 30+ facilities' },
	{ name: 'Camp Humphreys', lat: 36.96, lon: 127.03, desc: 'Camp Humphreys — US Forces Korea HQ, largest overseas base' },
	{ name: 'Osan AB', lat: 37.09, lon: 127.03, desc: 'Osan — US Air Force Korea, frontline deterrence' },
	{ name: 'Misawa', lat: 40.7, lon: 141.37, desc: 'Misawa — US Air Force Japan, intel/recon hub' },
	{ name: 'Iwakuni', lat: 34.15, lon: 132.24, desc: 'Iwakuni — US Marine Corps Japan, F-35 deployment' },
	{ name: 'Sasebo', lat: 33.16, lon: 129.72, desc: 'Sasebo — US Navy Japan, amphibious forces' },

	// US Europe
	{ name: 'Ramstein', lat: 49.44, lon: 7.6, desc: 'Ramstein — US Air Force Europe HQ, NATO airlift hub' },
	{ name: 'Spangdahlem', lat: 49.97, lon: 6.69, desc: 'Spangdahlem — US Air Force Germany, fighter wing' },
	{ name: 'Grafenwöhr', lat: 49.7, lon: 11.93, desc: 'Grafenwöhr — US Army Germany, largest training area Europe' },
	{ name: 'Aviano', lat: 46.03, lon: 12.6, desc: 'Aviano — US Air Force Italy, Med operations' },
	{ name: 'Sigonella', lat: 37.4, lon: 14.92, desc: 'Sigonella — US Navy Sicily, drone/surveillance hub' },
	{ name: 'Naples', lat: 40.82, lon: 14.29, desc: 'Naples — US 6th Fleet HQ, NATO JFC' },
	{ name: 'Rota', lat: 36.64, lon: -6.35, desc: 'Rota — US Navy Spain, Aegis destroyers' },
	{ name: 'Morón', lat: 37.18, lon: -5.62, desc: 'Morón — US Air Force Spain, Africa rapid response' },
	{ name: 'Incirlik', lat: 37.0, lon: 35.43, desc: 'Incirlik — US/NATO Turkey, nuclear weapons storage' },
	{ name: 'Souda Bay', lat: 35.49, lon: 24.12, desc: 'Souda Bay — US/NATO Crete, Eastern Med logistics' },
	{ name: 'Łask', lat: 51.55, lon: 19.18, desc: 'Łask — US Air Force Poland, NATO eastern flank' },
	{ name: 'Redzikowo', lat: 54.48, lon: 17.1, desc: 'Redzikowo — US Aegis Ashore Poland, missile defense' },
	{ name: 'Deveselu', lat: 43.77, lon: 24.39, desc: 'Deveselu — US Aegis Ashore Romania, missile defense' },
	{ name: 'Mihail Kogălniceanu', lat: 44.36, lon: 28.49, desc: 'MK Base — US/NATO Romania, Black Sea presence' },
	{ name: 'Keflavik', lat: 63.98, lon: -22.6, desc: 'Keflavik — US/NATO Iceland, North Atlantic patrol' },

	// US Middle East
	{ name: 'Al Udeid', lat: 25.12, lon: 51.31, desc: 'Al Udeid — US CENTCOM Forward HQ Qatar, largest ME base' },
	{ name: 'Bahrain', lat: 26.23, lon: 50.59, desc: 'NSA Bahrain — US 5th Fleet HQ, Persian Gulf command' },
	{ name: 'Al Dhafra', lat: 24.25, lon: 54.55, desc: 'Al Dhafra — US Air Force UAE, stealth operations' },
	{ name: 'Ali Al Salem', lat: 29.35, lon: 47.52, desc: 'Ali Al Salem — US Air Force Kuwait, Iraq support' },
	{ name: 'Arifjan', lat: 28.93, lon: 48.1, desc: 'Camp Arifjan — US Army Kuwait, regional logistics' },
	{ name: 'Prince Sultan AB', lat: 24.06, lon: 47.58, desc: 'Prince Sultan — US Air Force Saudi Arabia' },

	// US Other
	{ name: 'Diego Garcia', lat: -7.32, lon: 72.42, desc: 'Diego Garcia — US/UK Indian Ocean, strategic bombers/subs' },
	{ name: 'Djibouti', lat: 11.55, lon: 43.15, desc: 'Camp Lemonnier — US Africa Command, counter-terror hub' },
	{ name: 'Thule', lat: 76.53, lon: -68.7, desc: 'Thule — US Space Force Greenland, missile warning' },
	{ name: 'Lajes', lat: 38.76, lon: -27.09, desc: 'Lajes — US Air Force Azores, Atlantic staging' },

	// ========== RUSSIA ==========
	{ name: 'Kaliningrad', lat: 54.7, lon: 20.5, desc: 'Kaliningrad — Russian Baltic Fleet, Iskander missiles, NATO enclave' },
	{ name: 'Severomorsk', lat: 69.07, lon: 33.42, desc: 'Severomorsk — Russian Northern Fleet HQ, nuclear submarines' },
	{ name: 'Gadzhiyevo', lat: 69.25, lon: 33.33, desc: 'Gadzhiyevo — Russian nuclear submarine base, SSBNs' },
	{ name: 'Murmansk', lat: 68.97, lon: 33.09, desc: 'Murmansk — Russian Arctic military hub' },
	{ name: 'Sevastopol', lat: 44.62, lon: 33.53, desc: 'Sevastopol — Russian Black Sea Fleet HQ (Crimea)' },
	{ name: 'Novorossiysk', lat: 44.72, lon: 37.77, desc: 'Novorossiysk — Russian Black Sea naval base' },
	{ name: 'Vladivostok', lat: 43.12, lon: 131.9, desc: 'Vladivostok — Russian Pacific Fleet HQ' },
	{ name: 'Petropavlovsk', lat: 52.97, lon: 158.65, desc: 'Petropavlovsk-Kamchatsky — Russian Pacific submarine base' },
	{ name: 'Tartus', lat: 34.89, lon: 35.89, desc: 'Tartus — Russian Navy Syria, Mediterranean presence' },
	{ name: 'Khmeimim', lat: 35.41, lon: 35.95, desc: 'Khmeimim — Russian Air Force Syria, power projection' },
	{ name: 'Astrakhan', lat: 46.35, lon: 48.04, desc: 'Astrakhan — Russian Caspian Flotilla HQ' },
	{ name: 'Engels', lat: 51.48, lon: 46.2, desc: 'Engels — Russian strategic bomber base, Tu-160s' },
	{ name: 'Saratov', lat: 51.57, lon: 45.8, desc: 'Saratov — Russian Air Force, bomber operations' },

	// ========== CHINA ==========
	{ name: 'Qingdao', lat: 36.07, lon: 120.33, desc: 'Qingdao — PLA Navy North Sea Fleet HQ' },
	{ name: 'Ningbo', lat: 29.87, lon: 121.54, desc: 'Ningbo — PLA Navy East Sea Fleet HQ' },
	{ name: 'Zhanjiang', lat: 21.19, lon: 110.4, desc: 'Zhanjiang — PLA Navy South Sea Fleet HQ' },
	{ name: 'Yulin', lat: 18.23, lon: 109.52, desc: 'Yulin (Hainan) — PLA Navy submarine base, SSBNs' },
	{ name: 'Longpo', lat: 19.53, lon: 109.1, desc: 'Longpo — PLA Air Force Hainan, South China Sea' },
	{ name: 'Fiery Cross', lat: 9.55, lon: 112.89, desc: 'Fiery Cross Reef — PLA artificial island, SCS base' },
	{ name: 'Subi Reef', lat: 10.92, lon: 114.08, desc: 'Subi Reef — PLA artificial island, SCS base' },
	{ name: 'Mischief Reef', lat: 9.9, lon: 115.54, desc: 'Mischief Reef — PLA artificial island, SCS base' },
	{ name: 'Djibouti PLA', lat: 11.59, lon: 43.05, desc: 'Djibouti — PLA Support Base, first overseas base' },
	{ name: 'Korla', lat: 41.76, lon: 86.13, desc: 'Korla — PLA Rocket Force test facility, missiles' },
	{ name: 'Jiuquan', lat: 40.96, lon: 100.29, desc: 'Jiuquan — PLA strategic missile/space launch' },
	{ name: 'Chengdu', lat: 30.58, lon: 103.95, desc: 'Chengdu — PLA Air Force, J-20 stealth fighters' },

	// ========== UNITED KINGDOM ==========
	{ name: 'Faslane', lat: 56.07, lon: -4.82, desc: 'Faslane — UK Royal Navy, Trident nuclear submarines' },
	{ name: 'Portsmouth', lat: 50.8, lon: -1.1, desc: 'Portsmouth — UK Royal Navy HQ, carrier homeport' },
	{ name: 'Plymouth', lat: 50.38, lon: -4.15, desc: 'Devonport — UK Royal Navy, largest naval base' },
	{ name: 'Brize Norton', lat: 51.75, lon: -1.58, desc: 'Brize Norton — UK Royal Air Force, transport hub' },
	{ name: 'Coningsby', lat: 53.09, lon: -0.17, desc: 'Coningsby — UK Royal Air Force, Typhoon QRA' },
	{ name: 'Lossiemouth', lat: 57.71, lon: -3.34, desc: 'Lossiemouth — UK Royal Air Force, maritime patrol' },
	{ name: 'Akrotiri', lat: 34.59, lon: 32.99, desc: 'Akrotiri — UK Sovereign Base Cyprus, Middle East staging' },
	{ name: 'Gibraltar', lat: 36.15, lon: -5.35, desc: 'Gibraltar — UK Royal Navy, Mediterranean chokepoint' },
	{ name: 'Falklands', lat: -51.82, lon: -58.45, desc: 'Mount Pleasant — UK RAF Falkland Islands' },
	{ name: 'Brunei', lat: 4.93, lon: 114.93, desc: 'Seria — UK Army Brunei, jungle training' },

	// ========== FRANCE ==========
	{ name: 'Toulon', lat: 43.12, lon: 5.93, desc: 'Toulon — French Navy Mediterranean Fleet, carrier port' },
	{ name: 'Brest', lat: 48.38, lon: -4.49, desc: 'Brest — French Navy Atlantic Fleet, nuclear subs' },
	{ name: 'Île Longue', lat: 48.28, lon: -4.52, desc: 'Île Longue — French Navy SSBN base, nuclear deterrent' },
	{ name: 'Saint-Dizier', lat: 48.64, lon: 4.9, desc: 'Saint-Dizier — French Air Force, Rafale nuclear strike' },
	{ name: 'Istres', lat: 43.52, lon: 4.93, desc: 'Istres — French Air Force, strategic bomber base' },
	{ name: 'Djibouti FR', lat: 11.55, lon: 43.13, desc: 'Djibouti — French Forces, largest Africa base' },
	{ name: 'Abu Dhabi FR', lat: 24.43, lon: 54.46, desc: 'Abu Dhabi — French Navy UAE, Gulf presence' },
	{ name: 'Réunion', lat: -20.88, lon: 55.53, desc: 'Réunion — French Forces Indian Ocean' },
	{ name: 'New Caledonia', lat: -22.27, lon: 166.46, desc: 'New Caledonia — French Forces Pacific' },
	{ name: 'French Guiana', lat: 5.21, lon: -52.77, desc: 'Cayenne — French Forces South America' },
	{ name: 'Dakar', lat: 14.74, lon: -17.49, desc: 'Dakar — French Navy Senegal, Atlantic Africa' },
	{ name: 'Abidjan', lat: 5.36, lon: -3.93, desc: 'Abidjan — French Forces Ivory Coast' },
	{ name: 'N\'Djamena', lat: 12.13, lon: 15.03, desc: 'N\'Djamena — French Forces Chad, Sahel operations' },

	// ========== GERMANY ==========
	{ name: 'Wilhelmshaven', lat: 53.52, lon: 8.15, desc: 'Wilhelmshaven — German Navy HQ, North Sea' },
	{ name: 'Kiel', lat: 54.33, lon: 10.14, desc: 'Kiel — German Navy, Baltic Fleet' },
	{ name: 'Rostock', lat: 54.18, lon: 12.08, desc: 'Rostock — German Navy, Baltic operations' },
	{ name: 'Büchel', lat: 50.17, lon: 7.07, desc: 'Büchel — German Air Force, NATO nuclear sharing' },
	{ name: 'Neuburg', lat: 48.71, lon: 11.21, desc: 'Neuburg — German Air Force, Eurofighter QRA' },

	// ========== INDIA ==========
	{ name: 'Mumbai', lat: 18.93, lon: 72.85, desc: 'Mumbai — Indian Navy Western Command HQ' },
	{ name: 'Visakhapatnam', lat: 17.69, lon: 83.29, desc: 'Visakhapatnam — Indian Navy Eastern Command HQ' },
	{ name: 'Karwar', lat: 14.81, lon: 74.13, desc: 'Karwar (INS Kadamba) — Indian Navy, largest base' },
	{ name: 'Kochi', lat: 9.97, lon: 76.27, desc: 'Kochi — Indian Navy Southern Command, carrier port' },
	{ name: 'Port Blair', lat: 11.67, lon: 92.74, desc: 'Port Blair — Indian Navy Andaman, strategic location' },
	{ name: 'Ambala', lat: 30.37, lon: 76.82, desc: 'Ambala — Indian Air Force, frontline Pakistan border' },
	{ name: 'Agra', lat: 27.16, lon: 77.96, desc: 'Agra — Indian Air Force, strategic bomber base' },
	{ name: 'Jodhpur', lat: 26.25, lon: 73.05, desc: 'Jodhpur — Indian Air Force, Western Air Command' },
	{ name: 'Pune', lat: 18.58, lon: 73.92, desc: 'Pune — Indian Army Southern Command HQ' },
	{ name: 'Leh', lat: 34.14, lon: 77.58, desc: 'Leh — Indian Air Force, Ladakh high-altitude base' },

	// ========== PAKISTAN ==========
	{ name: 'Karachi', lat: 24.85, lon: 66.98, desc: 'Karachi — Pakistan Navy HQ, PNS Karsaz' },
	{ name: 'Gwadar', lat: 25.13, lon: 62.33, desc: 'Gwadar — Pakistan/China strategic port, CPEC' },
	{ name: 'Ormara', lat: 25.21, lon: 64.64, desc: 'Ormara — Pakistan Navy, submarine base' },
	{ name: 'Kamra', lat: 33.87, lon: 72.4, desc: 'Kamra — Pakistan Air Force, JF-17 production' },
	{ name: 'Sargodha', lat: 32.05, lon: 72.67, desc: 'Sargodha — Pakistan Air Force, nuclear capable' },
	{ name: 'Masroor', lat: 24.89, lon: 66.94, desc: 'Masroor — Pakistan Air Force, largest base' },

	// ========== JAPAN (Self-Defense Forces) ==========
	{ name: 'Yokohama', lat: 35.44, lon: 139.65, desc: 'Yokohama — JMSDF Fleet HQ' },
	{ name: 'Kure', lat: 34.23, lon: 132.55, desc: 'Kure — JMSDF, major naval base' },
	{ name: 'Maizuru', lat: 35.47, lon: 135.38, desc: 'Maizuru — JMSDF, Sea of Japan defense' },
	{ name: 'Hyakuri', lat: 36.18, lon: 140.42, desc: 'Hyakuri — JASDF, Tokyo air defense' },
	{ name: 'Chitose', lat: 42.79, lon: 141.68, desc: 'Chitose — JASDF, Northern defense, F-35s' },
	{ name: 'Naha', lat: 26.2, lon: 127.65, desc: 'Naha — JASDF Okinawa, Southwest defense' },

	// ========== SOUTH KOREA ==========
	{ name: 'Jinhae', lat: 35.15, lon: 128.68, desc: 'Jinhae — ROK Navy HQ, largest naval base' },
	{ name: 'Pyeongtaek', lat: 36.99, lon: 126.98, desc: 'Pyeongtaek — ROK Navy 2nd Fleet, West Sea' },
	{ name: 'Daegu', lat: 35.9, lon: 128.66, desc: 'Daegu — ROK Air Force, F-35 deployment' },
	{ name: 'Cheongju', lat: 36.72, lon: 127.5, desc: 'Cheongju — ROK Air Force, central defense' },
	{ name: 'Seongnam', lat: 37.44, lon: 127.11, desc: 'Seongnam — ROK Air Force, Seoul defense' },

	// ========== ISRAEL ==========
	{ name: 'Haifa', lat: 32.82, lon: 35.0, desc: 'Haifa — Israeli Navy HQ, submarine base' },
	{ name: 'Tel Nof', lat: 31.84, lon: 34.82, desc: 'Tel Nof — Israeli Air Force, F-35 base' },
	{ name: 'Nevatim', lat: 31.21, lon: 35.01, desc: 'Nevatim — Israeli Air Force, primary F-35 base' },
	{ name: 'Hatzerim', lat: 31.23, lon: 34.66, desc: 'Hatzerim — Israeli Air Force, flight academy' },
	{ name: 'Ramat David', lat: 32.67, lon: 35.18, desc: 'Ramat David — Israeli Air Force, northern defense' },
	{ name: 'Palmachim', lat: 31.9, lon: 34.69, desc: 'Palmachim — Israeli Air Force, missile tests, space' },

	// ========== TURKEY ==========
	{ name: 'Gölcük', lat: 40.72, lon: 29.82, desc: 'Gölcük — Turkish Navy HQ, Sea of Marmara' },
	{ name: 'Aksaz', lat: 36.97, lon: 28.38, desc: 'Aksaz — Turkish Navy, Aegean Fleet' },
	{ name: 'Izmir', lat: 38.29, lon: 27.15, desc: 'Izmir — Turkish Air Force, NATO Land Command' },
	{ name: 'Konya', lat: 37.98, lon: 32.56, desc: 'Konya — Turkish Air Force, weapons training' },
	{ name: 'Diyarbakır', lat: 37.89, lon: 40.19, desc: 'Diyarbakır — Turkish Air Force, eastern operations' },
	{ name: 'Batman', lat: 37.93, lon: 41.12, desc: 'Batman — Turkish Air Force, Iraq/Syria border' },

	// ========== IRAN ==========
	{ name: 'Bandar Abbas', lat: 27.18, lon: 56.27, desc: 'Bandar Abbas — Iranian Navy HQ, Strait of Hormuz' },
	{ name: 'Bushehr Naval', lat: 28.92, lon: 50.82, desc: 'Bushehr — Iranian Navy, Persian Gulf' },
	{ name: 'Jask', lat: 25.64, lon: 57.77, desc: 'Jask — Iranian Navy, Gulf of Oman new base' },
	{ name: 'Chabahar', lat: 25.29, lon: 60.62, desc: 'Chabahar — Iranian Navy, strategic Indian Ocean port' },
	{ name: 'Isfahan', lat: 32.75, lon: 51.86, desc: 'Isfahan — IRIAF major air base' },
	{ name: 'Shiraz', lat: 29.54, lon: 52.59, desc: 'Shiraz — IRIAF, tactical fighter base' },
	{ name: 'Mehrabad', lat: 35.69, lon: 51.31, desc: 'Mehrabad — IRIAF Tehran, strategic base' },

	// ========== SAUDI ARABIA ==========
	{ name: 'Jubail', lat: 27.01, lon: 49.66, desc: 'Jubail — Royal Saudi Navy, Eastern Fleet' },
	{ name: 'Jeddah', lat: 21.67, lon: 39.15, desc: 'Jeddah — Royal Saudi Navy, Western Fleet' },
	{ name: 'King Khalid', lat: 18.3, lon: 42.8, desc: 'King Khalid AB — Royal Saudi Air Force, Yemen ops' },
	{ name: 'King Fahd', lat: 26.27, lon: 49.81, desc: 'King Fahd AB — Royal Saudi Air Force, largest base' },
	{ name: 'King Abdulaziz', lat: 26.26, lon: 50.15, desc: 'King Abdulaziz AB — Royal Saudi Air Force' },
	{ name: 'Tabuk', lat: 28.37, lon: 36.63, desc: 'Tabuk — Royal Saudi Air Force, northwest defense' },

	// ========== UAE ==========
	{ name: 'Abu Dhabi Naval', lat: 24.53, lon: 54.64, desc: 'Mina Zayed — UAE Navy HQ, Persian Gulf' },
	{ name: 'Al Minhad', lat: 25.03, lon: 55.37, desc: 'Al Minhad — UAE Air Force, allied operations hub' },
	{ name: 'Assab', lat: 13.07, lon: 42.65, desc: 'Assab — UAE base Eritrea, Yemen operations' },

	// ========== EGYPT ==========
	{ name: 'Alexandria', lat: 31.2, lon: 29.92, desc: 'Alexandria — Egyptian Navy, Mediterranean Fleet' },
	{ name: 'Berenice', lat: 23.95, lon: 35.48, desc: 'Berenice — Egyptian Navy, Red Sea strategic base' },
	{ name: 'Cairo West', lat: 30.12, lon: 30.92, desc: 'Cairo West — Egyptian Air Force, capital defense' },
	{ name: 'Gebel el-Basur', lat: 27.83, lon: 30.73, desc: 'Gebel el-Basur — Egyptian Air Force' },
	{ name: 'Hurghada', lat: 27.18, lon: 33.8, desc: 'Hurghada — Egyptian Air Force, Red Sea' },

	// ========== AUSTRALIA ==========
	{ name: 'Sydney Fleet', lat: -33.84, lon: 151.24, desc: 'Sydney — RAN Fleet Base East, carrier port' },
	{ name: 'Perth', lat: -32.2, lon: 115.79, desc: 'HMAS Stirling — RAN Fleet Base West, submarine base' },
	{ name: 'Darwin', lat: -12.42, lon: 130.88, desc: 'Darwin — ADF Northern Command, US rotational' },
	{ name: 'Tindal', lat: -14.52, lon: 132.38, desc: 'Tindal — RAAF, northern Australia, B-52 capable' },
	{ name: 'Amberley', lat: -27.64, lon: 152.71, desc: 'Amberley — RAAF, largest air base' },
	{ name: 'Townsville', lat: -19.25, lon: 146.77, desc: 'Townsville — Australian Army major base' },
	{ name: 'Pine Gap', lat: -23.8, lon: 133.74, desc: 'Pine Gap — US/Australia intel, satellite ground station' },

	// ========== NEW ZEALAND ==========
	{ name: 'Auckland', lat: -36.83, lon: 174.78, desc: 'Devonport — RNZN Fleet Base, primary naval' },
	{ name: 'Ohakea', lat: -40.21, lon: 175.39, desc: 'Ohakea — RNZAF, main air base' },

	// ========== BRAZIL ==========
	{ name: 'Rio de Janeiro', lat: -22.86, lon: -43.13, desc: 'Rio — Brazilian Navy HQ, Atlantic Fleet' },
	{ name: 'Salvador', lat: -12.91, lon: -38.41, desc: 'Salvador — Brazilian Navy 2nd District' },
	{ name: 'Brasília', lat: -15.87, lon: -47.93, desc: 'Brasília — Brazilian Air Force HQ' },
	{ name: 'Natal', lat: -5.91, lon: -35.25, desc: 'Natal — Brazilian Air Force, Atlantic patrol' },
	{ name: 'Manaus', lat: -3.15, lon: -59.99, desc: 'Manaus — Brazilian Army Amazon Command' },
	{ name: 'Campo Grande', lat: -20.47, lon: -54.67, desc: 'Campo Grande — Brazilian Air Force, border patrol' },

	// ========== ARGENTINA ==========
	{ name: 'Puerto Belgrano', lat: -38.88, lon: -62.08, desc: 'Puerto Belgrano — Argentine Navy HQ' },
	{ name: 'Mar del Plata', lat: -38.03, lon: -57.54, desc: 'Mar del Plata — Argentine Navy submarine base' },
	{ name: 'Ushuaia', lat: -54.83, lon: -68.31, desc: 'Ushuaia — Argentine Navy, Antarctic operations' },
	{ name: 'Mendoza', lat: -32.83, lon: -68.79, desc: 'Mendoza — Argentine Air Force, mountain brigade' },

	// ========== OTHER SOUTH AMERICA ==========
	{ name: 'Santiago', lat: -33.38, lon: -70.79, desc: 'Santiago — Chilean Armed Forces HQ' },
	{ name: 'Valparaíso', lat: -33.04, lon: -71.6, desc: 'Valparaíso — Chilean Navy HQ' },
	{ name: 'Bogotá', lat: 4.7, lon: -74.15, desc: 'Bogotá — Colombian Armed Forces, counter-narcotics' },
	{ name: 'Cartagena', lat: 10.39, lon: -75.48, desc: 'Cartagena — Colombian Navy, Caribbean Fleet' },
	{ name: 'Callao', lat: -12.07, lon: -77.15, desc: 'Callao — Peruvian Navy HQ' },
	{ name: 'Lima', lat: -12.1, lon: -77.02, desc: 'Las Palmas — Peruvian Air Force HQ' },
	{ name: 'Caracas', lat: 10.6, lon: -66.99, desc: 'Caracas — Venezuelan Armed Forces, Fuerte Tiuna' },

	// ========== CANADA ==========
	{ name: 'Halifax', lat: 44.67, lon: -63.58, desc: 'Halifax — RCN Atlantic Fleet, MARLANT' },
	{ name: 'Esquimalt', lat: 48.43, lon: -123.44, desc: 'Esquimalt — RCN Pacific Fleet, MARPAC' },
	{ name: 'Cold Lake', lat: 54.42, lon: -110.28, desc: 'Cold Lake — RCAF fighter training, CF-18s' },
	{ name: 'Trenton', lat: 44.12, lon: -77.53, desc: 'Trenton — RCAF airlift hub, transport command' },
	{ name: 'Petawawa', lat: 45.9, lon: -77.28, desc: 'Petawawa — Canadian Army, rapid deployment' },
	{ name: 'Edmonton', lat: 53.67, lon: -113.59, desc: 'Edmonton — Canadian Army, 3rd Division' },
	{ name: 'Alert', lat: 82.5, lon: -62.35, desc: 'Alert — Canadian Forces Arctic, SIGINT station' },

	// ========== MEXICO ==========
	{ name: 'Veracruz', lat: 19.2, lon: -96.15, desc: 'Veracruz — Mexican Navy Gulf Fleet' },
	{ name: 'Acapulco', lat: 16.86, lon: -99.88, desc: 'Acapulco — Mexican Navy Pacific Fleet' },
	{ name: 'Manzanillo', lat: 19.06, lon: -104.31, desc: 'Manzanillo — Mexican Navy, Pacific operations' },
	{ name: 'Santa Lucía', lat: 19.75, lon: -99.02, desc: 'Santa Lucía — Mexican Air Force, capital defense' },

	// ========== SOUTH AFRICA ==========
	{ name: 'Simonstown', lat: -34.2, lon: 18.44, desc: 'Simonstown — SA Navy HQ, Cape of Good Hope' },
	{ name: 'Durban', lat: -29.87, lon: 31.04, desc: 'Durban — SA Navy, Indian Ocean operations' },
	{ name: 'Waterkloof', lat: -25.83, lon: 28.22, desc: 'Waterkloof — SA Air Force, VIP/strategic' },
	{ name: 'Hoedspruit', lat: -24.37, lon: 31.05, desc: 'Hoedspruit — SA Air Force, combat training' },
	{ name: 'Pretoria', lat: -25.77, lon: 28.19, desc: 'Pretoria — SA Army HQ, Thaba Tshwane' },

	// ========== NORTH AFRICA ==========
	{ name: 'Casablanca', lat: 33.57, lon: -7.67, desc: 'Casablanca — Royal Moroccan Navy, Atlantic Fleet' },
	{ name: 'Kenitra', lat: 34.3, lon: -6.6, desc: 'Kenitra — Royal Moroccan Air Force' },
	{ name: 'Algiers', lat: 36.72, lon: 3.25, desc: 'Algiers — Algerian Navy, Mediterranean Fleet' },
	{ name: 'Mers El Kébir', lat: 35.73, lon: -0.72, desc: 'Mers El Kébir — Algerian Navy, major base' },
	{ name: 'Tripoli', lat: 32.9, lon: 13.18, desc: 'Tripoli — Libyan Navy (contested control)' },
	{ name: 'Misrata', lat: 32.38, lon: 15.09, desc: 'Misrata — Turkish-backed forces Libya' },

	// ========== SUB-SAHARAN AFRICA ==========
	{ name: 'Mombasa', lat: -4.05, lon: 39.67, desc: 'Mombasa — Kenya Navy HQ, Indian Ocean' },
	{ name: 'Lagos', lat: 6.45, lon: 3.4, desc: 'Lagos — Nigerian Navy Western Command' },
	{ name: 'Port Harcourt', lat: 4.78, lon: 7.01, desc: 'Port Harcourt — Nigerian Navy, Niger Delta' },
	{ name: 'Abuja', lat: 9.08, lon: 7.49, desc: 'Abuja — Nigerian Armed Forces HQ' },
	{ name: 'Accra', lat: 5.6, lon: -0.17, desc: 'Accra — Ghana Armed Forces HQ' },
	{ name: 'Addis Ababa', lat: 9.0, lon: 38.75, desc: 'Addis Ababa — Ethiopian National Defense Force HQ' },
	{ name: 'Dire Dawa', lat: 9.6, lon: 41.85, desc: 'Dire Dawa — Ethiopian Air Force main base' },
	{ name: 'Entebbe', lat: 0.05, lon: 32.44, desc: 'Entebbe — Uganda Air Force main base' },
	{ name: 'Kigali', lat: -1.97, lon: 30.1, desc: 'Kigali — Rwanda Defence Force HQ' },
	{ name: 'Dar es Salaam', lat: -6.8, lon: 39.27, desc: 'Dar es Salaam — Tanzania Navy HQ' },
	{ name: 'Kinshasa', lat: -4.33, lon: 15.31, desc: 'Kinshasa — DRC Armed Forces HQ' },

	// ========== SOUTHEAST ASIA ==========
	{ name: 'Changi', lat: 1.38, lon: 103.98, desc: 'Changi — Singapore Navy, RSS Singapura' },
	{ name: 'Tengah', lat: 1.39, lon: 103.71, desc: 'Tengah — Singapore Air Force, fighter base' },
	{ name: 'Paya Lebar', lat: 1.36, lon: 103.91, desc: 'Paya Lebar — Singapore Air Force, F-15/F-35' },
	{ name: 'Surabaya', lat: -7.25, lon: 112.75, desc: 'Surabaya — Indonesian Navy Eastern Fleet' },
	{ name: 'Jakarta', lat: -6.1, lon: 106.87, desc: 'Jakarta — Indonesian Navy Western Fleet' },
	{ name: 'Makassar', lat: -5.07, lon: 119.55, desc: 'Makassar — Indonesian Air Force, eastern ops' },
	{ name: 'Subic Bay', lat: 14.8, lon: 120.28, desc: 'Subic Bay — Philippine Navy, former US base' },
	{ name: 'Clark', lat: 15.19, lon: 120.56, desc: 'Clark — Philippine Air Force, US rotational' },
	{ name: 'Lumbia', lat: 8.42, lon: 124.61, desc: 'Lumbia — Philippine Air Force, Mindanao' },
	{ name: 'Sattahip', lat: 12.68, lon: 100.93, desc: 'Sattahip — Royal Thai Navy HQ' },
	{ name: 'Korat', lat: 14.93, lon: 102.08, desc: 'Korat — Royal Thai Air Force, F-16s' },
	{ name: 'Cam Ranh', lat: 11.98, lon: 109.22, desc: 'Cam Ranh — Vietnam Navy, strategic bay' },
	{ name: 'Da Nang', lat: 16.04, lon: 108.2, desc: 'Da Nang — Vietnam Air Force, central coast' },
	{ name: 'Kuala Lumpur', lat: 2.72, lon: 101.73, desc: 'Subang — Royal Malaysian Air Force HQ' },
	{ name: 'Sepanggar', lat: 6.07, lon: 116.1, desc: 'Sepanggar — Royal Malaysian Navy, Borneo' },

	// ========== CENTRAL ASIA ==========
	{ name: 'Dushanbe', lat: 38.56, lon: 68.77, desc: 'Dushanbe — Russian 201st Military Base Tajikistan' },
	{ name: 'Kant', lat: 42.85, lon: 74.85, desc: 'Kant — Russian Air Base Kyrgyzstan' },
	{ name: 'Baikonur', lat: 45.62, lon: 63.31, desc: 'Baikonur — Russian space/missile facility Kazakhstan' },
	{ name: 'Tashkent', lat: 41.31, lon: 69.28, desc: 'Tashkent — Uzbekistan Armed Forces HQ' },

	// ========== EASTERN EUROPE ==========
	{ name: 'Warsaw', lat: 52.17, lon: 20.97, desc: 'Warsaw — Polish Armed Forces HQ' },
	{ name: 'Gdynia', lat: 54.52, lon: 18.55, desc: 'Gdynia — Polish Navy HQ, Baltic Fleet' },
	{ name: 'Malbork', lat: 54.03, lon: 19.07, desc: 'Malbork — Polish Air Force, NATO Air Policing' },
	{ name: 'Klaipėda', lat: 55.72, lon: 21.13, desc: 'Klaipėda — Lithuanian Navy HQ' },
	{ name: 'Šiauliai', lat: 55.89, lon: 23.39, desc: 'Šiauliai — Lithuanian Air Base, NATO QRA' },
	{ name: 'Tapa', lat: 59.26, lon: 25.96, desc: 'Tapa — Estonian Defence Forces, NATO eFP' },
	{ name: 'Ämari', lat: 59.26, lon: 24.21, desc: 'Ämari — Estonian Air Force, NATO Air Policing' },
	{ name: 'Riga', lat: 56.92, lon: 23.97, desc: 'Riga — Latvian National Armed Forces HQ' },
	{ name: 'Lielvārde', lat: 56.77, lon: 24.83, desc: 'Lielvārde — Latvian Air Force Base' },
	{ name: 'Ādaži', lat: 57.08, lon: 24.32, desc: 'Ādaži — Latvian Army, NATO eFP Canada-led' },
	{ name: 'Prague', lat: 50.08, lon: 14.25, desc: 'Prague — Czech Armed Forces HQ' },
	{ name: 'Čáslav', lat: 49.94, lon: 15.38, desc: 'Čáslav — Czech Air Force, Gripen fighters' },
	{ name: 'Budapest', lat: 47.44, lon: 19.26, desc: 'Budapest — Hungarian Defence Forces HQ' },
	{ name: 'Pápa', lat: 47.36, lon: 17.5, desc: 'Pápa — NATO Heavy Airlift Wing, C-17s' },
	{ name: 'Bucharest', lat: 44.5, lon: 26.08, desc: 'Bucharest — Romanian Armed Forces HQ' },
	{ name: 'Fetești', lat: 44.38, lon: 27.83, desc: 'Fetești — Romanian Air Force, F-16s' },
	{ name: 'Sofia', lat: 42.7, lon: 23.32, desc: 'Sofia — Bulgarian Armed Forces HQ' },
	{ name: 'Graf Ignatievo', lat: 42.29, lon: 24.71, desc: 'Graf Ignatievo — Bulgarian Air Force' },

	// ========== NORTHERN EUROPE ==========
	{ name: 'Stockholm', lat: 59.33, lon: 18.0, desc: 'Stockholm — Swedish Armed Forces HQ' },
	{ name: 'Karlskrona', lat: 56.16, lon: 15.59, desc: 'Karlskrona — Swedish Navy, Baltic HQ' },
	{ name: 'Luleå', lat: 65.55, lon: 22.12, desc: 'Luleå — Swedish Air Force, Arctic defense' },
	{ name: 'Gotland', lat: 57.67, lon: 18.35, desc: 'Gotland — Swedish Army, Baltic strategic island' },
	{ name: 'Oslo', lat: 59.91, lon: 10.76, desc: 'Oslo — Norwegian Armed Forces HQ' },
	{ name: 'Haakonsvern', lat: 60.31, lon: 5.19, desc: 'Haakonsvern — Royal Norwegian Navy HQ' },
	{ name: 'Bodø', lat: 67.27, lon: 14.37, desc: 'Bodø — Royal Norwegian Air Force, Arctic' },
	{ name: 'Ørland', lat: 63.7, lon: 9.6, desc: 'Ørland — Royal Norwegian Air Force, F-35 main base' },
	{ name: 'Copenhagen', lat: 55.68, lon: 12.59, desc: 'Copenhagen — Danish Defence HQ' },
	{ name: 'Frederikshavn', lat: 57.44, lon: 10.54, desc: 'Frederikshavn — Royal Danish Navy' },
	{ name: 'Helsinki', lat: 60.17, lon: 24.94, desc: 'Helsinki — Finnish Defence Forces HQ' },
	{ name: 'Turku', lat: 60.45, lon: 22.27, desc: 'Turku — Finnish Navy HQ' },
	{ name: 'Rovaniemi', lat: 66.56, lon: 25.83, desc: 'Rovaniemi — Finnish Air Force, Arctic F-35 base' },

	// ========== SOUTHERN/WESTERN EUROPE ==========
	{ name: 'Madrid', lat: 40.49, lon: -3.57, desc: 'Torrejón — Spanish Air Force, NATO hub' },
	{ name: 'Ferrol', lat: 43.49, lon: -8.24, desc: 'Ferrol — Spanish Navy, Atlantic Fleet' },
	{ name: 'Cartagena', lat: 37.6, lon: -0.98, desc: 'Cartagena — Spanish Navy, Mediterranean Fleet' },
	{ name: 'Zaragoza', lat: 41.67, lon: -1.03, desc: 'Zaragoza — Spanish Air Force, KC-130/A400M' },
	{ name: 'Lisbon', lat: 38.78, lon: -9.13, desc: 'Lisbon — Portuguese Navy HQ' },
	{ name: 'Monte Real', lat: 39.83, lon: -8.89, desc: 'Monte Real — Portuguese Air Force, F-16s' },
	{ name: 'Rome', lat: 41.8, lon: 12.24, desc: 'Rome — Italian Armed Forces HQ, Cecchignola' },
	{ name: 'La Spezia', lat: 44.1, lon: 9.83, desc: 'La Spezia — Italian Navy, major base' },
	{ name: 'Taranto', lat: 40.47, lon: 17.24, desc: 'Taranto — Italian Navy, carrier port' },
	{ name: 'Pratica di Mare', lat: 41.65, lon: 12.45, desc: 'Pratica di Mare — Italian Air Force HQ' },
	{ name: 'Athens', lat: 37.89, lon: 23.93, desc: 'Athens — Hellenic Armed Forces HQ' },
	{ name: 'Salamis', lat: 37.94, lon: 23.49, desc: 'Salamis — Hellenic Navy main base' },
	{ name: 'Larissa', lat: 39.65, lon: 22.46, desc: 'Larissa — Hellenic Air Force, F-16s/Rafales' },
	{ name: 'Brussels', lat: 50.9, lon: 4.53, desc: 'Brussels — Belgian Defence HQ, NATO HQ' },
	{ name: 'Kleine-Brogel', lat: 51.17, lon: 5.47, desc: 'Kleine-Brogel — Belgian Air Force, NATO nuclear' },
	{ name: 'The Hague', lat: 52.08, lon: 4.31, desc: 'The Hague — Netherlands Defence HQ' },
	{ name: 'Den Helder', lat: 52.96, lon: 4.79, desc: 'Den Helder — Royal Netherlands Navy HQ' },
	{ name: 'Leeuwarden', lat: 53.23, lon: 5.76, desc: 'Leeuwarden — Netherlands Air Force, F-35s' },

	// ========== NORTH KOREA ==========
	{ name: 'Pyongyang', lat: 39.02, lon: 125.73, desc: 'Pyongyang — KPA Supreme Command' },
	{ name: 'Nampho', lat: 38.73, lon: 125.38, desc: 'Nampho — KPN West Sea Fleet HQ' },
	{ name: 'Wonsan', lat: 39.17, lon: 127.44, desc: 'Wonsan — KPN East Sea Fleet, submarine base' },
	{ name: 'Sunchon', lat: 39.43, lon: 125.93, desc: 'Sunchon — KPAF, MiG-29 base' },
	{ name: 'Hwangju', lat: 38.62, lon: 125.78, desc: 'Hwangju — KPAF, frontline fighters' },

	// ========== TAIWAN ==========
	{ name: 'Zuoying', lat: 22.7, lon: 120.28, desc: 'Zuoying — ROC Navy Southern Fleet, Kaohsiung' },
	{ name: 'Keelung', lat: 25.15, lon: 121.74, desc: 'Keelung — ROC Navy Northern Fleet' },
	{ name: 'Hualien', lat: 24.03, lon: 121.62, desc: 'Hualien — ROC Air Force, mountain bunkers' },
	{ name: 'Chiayi', lat: 23.46, lon: 120.38, desc: 'Chiayi — ROC Air Force, F-16V base' },
	{ name: 'Taitung', lat: 22.79, lon: 121.1, desc: 'Taitung — ROC Air Force, east coast defense' },

	// ========== CARIBBEAN ==========
	{ name: 'Havana', lat: 23.15, lon: -82.35, desc: 'Havana — Cuban Revolutionary Armed Forces HQ' },
	{ name: 'Cienfuegos', lat: 22.15, lon: -80.45, desc: 'Cienfuegos — Cuban Navy main base' },
	{ name: 'San Antonio', lat: 22.86, lon: -82.5, desc: 'San Antonio de los Baños — Cuban Air Force' },
	{ name: 'Guantánamo', lat: 19.9, lon: -75.1, desc: 'Guantánamo Bay — US Naval Station Cuba' }
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
