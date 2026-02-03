/**
 * Webcam API - Fetch live webcams from Windy Webcams API v3
 * Supports querying by country, coordinates, and bounding box
 */

import type { Webcam, WebcamApiResponse } from '$lib/types/webcam';

// Windy Webcams API base URL
const WINDY_API_BASE = 'https://api.windy.com/webcams/api/v3';

// Get API key from environment (required for Windy API)
const getApiKey = (): string => {
	if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WINDY_API_KEY) {
		return import.meta.env.VITE_WINDY_API_KEY;
	}
	// Fallback to demo key (limited usage)
	return '';
};

// Cache for webcam responses (10-minute expiry to match API token limits)
const webcamCache = new Map<string, { data: Webcam[]; timestamp: number }>();
const CACHE_TTL = 9 * 60 * 1000; // 9 minutes (slightly less than API token expiry)

// Timeout for Windy API requests (5 seconds)
const API_TIMEOUT_MS = 5000;

/**
 * Fetch webcams by country code (ISO 3166-1 alpha-2)
 */
export async function fetchWebcamsByCountry(countryCode: string): Promise<Webcam[]> {
	const cacheKey = `country:${countryCode.toUpperCase()}`;
	const cached = webcamCache.get(cacheKey);

	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.data;
	}

	const apiKey = getApiKey();
	if (!apiKey) {
		// Fallback to curated webcam sources when no API key
		return fetchFallbackWebcams(countryCode);
	}

	// Create abort controller for timeout
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

	try {
		const url = `${WINDY_API_BASE}/webcams?countries=${countryCode.toUpperCase()}&limit=50&include=images,player,location`;

		const response = await fetch(url, {
			headers: {
				'x-windy-api-key': apiKey
			},
			signal: controller.signal
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			if (response.status === 401) {
				console.warn('Windy API key invalid or expired, using fallback webcams');
				return fetchFallbackWebcams(countryCode);
			}
			throw new Error(`Windy API error: ${response.status}`);
		}

		const data: WebcamApiResponse = await response.json();
		const webcams = data.webcams || [];

		// Cache the results
		webcamCache.set(cacheKey, { data: webcams, timestamp: Date.now() });

		return webcams;
	} catch (error) {
		clearTimeout(timeoutId);
		if (error instanceof Error && error.name === 'AbortError') {
			console.warn('Windy API request timed out, using fallback webcams');
		} else {
			console.error('Error fetching webcams from Windy:', error);
		}
		return fetchFallbackWebcams(countryCode);
	}
}

/**
 * Fetch webcams near coordinates
 */
export async function fetchWebcamsNearby(
	lat: number,
	lon: number,
	radius: number = 100 // km
): Promise<Webcam[]> {
	const cacheKey = `nearby:${lat.toFixed(2)},${lon.toFixed(2)},${radius}`;
	const cached = webcamCache.get(cacheKey);

	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.data;
	}

	const apiKey = getApiKey();
	if (!apiKey) {
		return [];
	}

	// Create abort controller for timeout
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

	try {
		const url = `${WINDY_API_BASE}/webcams?nearby=${lat},${lon},${radius}&limit=30&include=images,player,location`;

		const response = await fetch(url, {
			headers: {
				'x-windy-api-key': apiKey
			},
			signal: controller.signal
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			throw new Error(`Windy API error: ${response.status}`);
		}

		const data: WebcamApiResponse = await response.json();
		const webcams = data.webcams || [];

		webcamCache.set(cacheKey, { data: webcams, timestamp: Date.now() });

		return webcams;
	} catch (error) {
		clearTimeout(timeoutId);
		if (error instanceof Error && error.name === 'AbortError') {
			console.warn('Windy API nearby request timed out');
		} else {
			console.error('Error fetching nearby webcams:', error);
		}
		return [];
	}
}

/**
 * Fallback webcam data when Windy API is not available
 * Uses curated public webcam streams from various sources
 */
function fetchFallbackWebcams(countryCode: string): Webcam[] {
	const code = countryCode.toUpperCase();
	const mainData = FALLBACK_WEBCAMS[code] || [];
	const extraData = FALLBACK_WEBCAMS[`${code}_EXTRA`] || [];

	// Special handling for Scotland (part of GB)
	if (code === 'GB') {
		const scottishData = FALLBACK_WEBCAMS['SC'] || [];
		return [...mainData, ...scottishData, ...extraData];
	}

	// Special handling for Seychelles (SC conflicts with Scotland abbreviation)
	if (code === 'SC') {
		return FALLBACK_WEBCAMS['SC_SEYCHELLES'] || [];
	}

	return [...mainData, ...extraData];
}

// Curated fallback webcams by country (public embeddable streams)
// These are popular tourist/city webcams that don't require API keys
const FALLBACK_WEBCAMS: Record<string, Webcam[]> = {
	US: [
		createFallbackWebcam('times-square-nyc', 'Times Square, New York City', 'New York', 'US', 40.758, -73.9855, 'https://www.earthcam.com/usa/newyork/timessquare/?cam=tsstreet'),
		createFallbackWebcam('las-vegas-strip', 'Las Vegas Strip', 'Las Vegas', 'US', 36.1147, -115.1728, 'https://www.earthcam.com/usa/nevada/lasvegas/'),
		createFallbackWebcam('miami-beach', 'Miami Beach', 'Miami', 'US', 25.7907, -80.1300, 'https://www.earthcam.com/usa/florida/miamibeach/'),
		createFallbackWebcam('san-francisco-bay', 'San Francisco Bay Bridge', 'San Francisco', 'US', 37.7983, -122.3778, 'https://www.youtube.com/embed/live_stream?channel=UC7kGC2QL5VrwZxN7pMU9Mwg'),
		createFallbackWebcam('chicago-skyline', 'Chicago Skyline', 'Chicago', 'US', 41.8781, -87.6298, 'https://www.earthcam.com/usa/illinois/chicago/'),
		createFallbackWebcam('hollywood-blvd', 'Hollywood Boulevard', 'Los Angeles', 'US', 34.1016, -118.3267, 'https://www.earthcam.com/usa/california/losangeles/hollywood/'),
		createFallbackWebcam('bourbon-street', 'Bourbon Street, New Orleans', 'New Orleans', 'US', 29.9584, -90.0654, 'https://www.earthcam.com/usa/louisiana/neworleans/bourbonstreet/'),
		createFallbackWebcam('waikiki-beach', 'Waikiki Beach, Hawaii', 'Honolulu', 'US', 21.2766, -157.8278, 'https://www.earthcam.com/usa/hawaii/waikiki/'),
		createFallbackWebcam('boston-faneuil', 'Faneuil Hall, Boston', 'Boston', 'US', 42.3601, -71.0549, 'https://www.earthcam.com/usa/massachusetts/boston/'),
		createFallbackWebcam('seattle-pike-place', 'Pike Place Market, Seattle', 'Seattle', 'US', 47.6097, -122.3422, 'https://www.earthcam.com/usa/washington/seattle/pikeplace/'),
		createFallbackWebcam('dc-capitol', 'US Capitol, Washington DC', 'Washington', 'US', 38.8899, -77.0091, 'https://www.earthcam.com/usa/dc/'),
		createFallbackWebcam('nashville-broadway', 'Broadway, Nashville', 'Nashville', 'US', 36.1627, -86.7816, 'https://www.earthcam.com/usa/tennessee/nashville/'),
		createFallbackWebcam('denver-downtown', 'Downtown Denver', 'Denver', 'US', 39.7392, -104.9903, 'https://www.webcamtaxi.com/en/usa/colorado/denver-downtown.html'),
		createFallbackWebcam('san-diego-beach', 'San Diego Beach', 'San Diego', 'US', 32.7157, -117.1611, 'https://www.webcamtaxi.com/en/usa/california/san-diego-beach.html'),
		createFallbackWebcam('phoenix-downtown', 'Downtown Phoenix', 'Phoenix', 'US', 33.4484, -112.0740, 'https://www.webcamtaxi.com/en/usa/arizona/phoenix.html'),
	],
	GB: [
		createFallbackWebcam('london-tower-bridge', 'Tower Bridge, London', 'London', 'GB', 51.5055, -0.0754, 'https://www.earthcam.com/world/uk/london/'),
		createFallbackWebcam('london-abbey-road', 'Abbey Road, London', 'London', 'GB', 51.5320, -0.1780, 'https://www.abbeyroad.com/crossing'),
		createFallbackWebcam('edinburgh-castle', 'Edinburgh Castle', 'Edinburgh', 'GB', 55.9486, -3.1999, 'https://www.skylinewebcams.com/en/webcam/united-kingdom/scotland/edinburgh/edinburgh-castle.html'),
		createFallbackWebcam('london-trafalgar', 'Trafalgar Square, London', 'London', 'GB', 51.5080, -0.1281, 'https://www.webcamtaxi.com/en/uk/london/trafalgar-square.html'),
		createFallbackWebcam('london-big-ben', 'Big Ben & Parliament', 'London', 'GB', 51.5007, -0.1246, 'https://www.webcamtaxi.com/en/uk/london/big-ben.html'),
		createFallbackWebcam('oxford-street', 'Oxford Street, London', 'London', 'GB', 51.5152, -0.1418, 'https://www.webcamtaxi.com/en/uk/london/oxford-street.html'),
		createFallbackWebcam('brighton-beach', 'Brighton Beach', 'Brighton', 'GB', 50.8214, -0.1419, 'https://www.webcamtaxi.com/en/uk/brighton/beach.html'),
		createFallbackWebcam('manchester-city', 'Manchester City Centre', 'Manchester', 'GB', 53.4808, -2.2426, 'https://www.webcamtaxi.com/en/uk/manchester/city-centre.html'),
		createFallbackWebcam('liverpool-waterfront', 'Liverpool Waterfront', 'Liverpool', 'GB', 53.4058, -2.9887, 'https://www.webcamtaxi.com/en/uk/liverpool/waterfront.html'),
	],
	FR: [
		createFallbackWebcam('paris-eiffel-tower', 'Eiffel Tower, Paris', 'Paris', 'FR', 48.8584, 2.2945, 'https://www.youtube.com/embed/vHGqaNt0yAQ'),
		createFallbackWebcam('nice-promenade', 'Promenade des Anglais, Nice', 'Nice', 'FR', 43.6947, 7.2650, 'https://www.skylinewebcams.com/en/webcam/france/provence-alpes-cote-d-azur/nice/nice-promenade-des-anglais.html'),
		createFallbackWebcam('paris-champs-elysees', 'Champs-Élysées, Paris', 'Paris', 'FR', 48.8698, 2.3078, 'https://www.webcamtaxi.com/en/france/paris/champs-elysees.html'),
		createFallbackWebcam('paris-notre-dame', 'Notre-Dame Area, Paris', 'Paris', 'FR', 48.8530, 2.3499, 'https://www.webcamtaxi.com/en/france/paris/notre-dame.html'),
		createFallbackWebcam('cannes-croisette', 'La Croisette, Cannes', 'Cannes', 'FR', 43.5513, 7.0128, 'https://www.skylinewebcams.com/en/webcam/france/provence-alpes-cote-d-azur/cannes/la-croisette.html'),
		createFallbackWebcam('marseille-vieux-port', 'Vieux Port, Marseille', 'Marseille', 'FR', 43.2965, 5.3698, 'https://www.webcamtaxi.com/en/france/marseille/vieux-port.html'),
		createFallbackWebcam('lyon-place-bellecour', 'Place Bellecour, Lyon', 'Lyon', 'FR', 45.7578, 4.8320, 'https://www.webcamtaxi.com/en/france/lyon/place-bellecour.html'),
		createFallbackWebcam('mont-saint-michel', 'Mont Saint-Michel', 'Mont Saint-Michel', 'FR', 48.6361, -1.5115, 'https://www.webcamtaxi.com/en/france/mont-saint-michel/abbey.html'),
	],
	DE: [
		createFallbackWebcam('berlin-brandenburg', 'Brandenburg Gate, Berlin', 'Berlin', 'DE', 52.5163, 13.3777, 'https://www.earthcam.com/world/germany/berlin/'),
		createFallbackWebcam('munich-marienplatz', 'Marienplatz, Munich', 'Munich', 'DE', 48.1374, 11.5755, 'https://www.youtube.com/embed/live_stream?channel=UCv7c0DqF8t9p2BbNmR4AqGQ'),
		createFallbackWebcam('cologne-cathedral', 'Cologne Cathedral', 'Cologne', 'DE', 50.9413, 6.9583, 'https://www.webcamtaxi.com/en/germany/cologne/cathedral.html'),
		createFallbackWebcam('frankfurt-skyline', 'Frankfurt Skyline', 'Frankfurt', 'DE', 50.1109, 8.6821, 'https://www.webcamtaxi.com/en/germany/frankfurt/skyline.html'),
		createFallbackWebcam('hamburg-harbour', 'Hamburg Harbour', 'Hamburg', 'DE', 53.5459, 9.9660, 'https://www.webcamtaxi.com/en/germany/hamburg/harbour.html'),
		createFallbackWebcam('dresden-frauenkirche', 'Frauenkirche, Dresden', 'Dresden', 'DE', 51.0519, 13.7416, 'https://www.webcamtaxi.com/en/germany/dresden/frauenkirche.html'),
		createFallbackWebcam('heidelberg-castle', 'Heidelberg Castle', 'Heidelberg', 'DE', 49.4107, 8.7152, 'https://www.webcamtaxi.com/en/germany/heidelberg/castle.html'),
		createFallbackWebcam('nuremberg-hauptmarkt', 'Hauptmarkt, Nuremberg', 'Nuremberg', 'DE', 49.4540, 11.0773, 'https://www.webcamtaxi.com/en/germany/nuremberg/hauptmarkt.html'),
		createFallbackWebcam('stuttgart-schlossplatz', 'Schlossplatz, Stuttgart', 'Stuttgart', 'DE', 48.7785, 9.1780, 'https://www.webcamtaxi.com/en/germany/stuttgart/schlossplatz.html'),
		createFallbackWebcam('dusseldorf-rhine', 'Rhine Tower, Dusseldorf', 'Dusseldorf', 'DE', 51.2217, 6.7762, 'https://www.webcamtaxi.com/en/germany/dusseldorf/rhine-tower.html'),
		createFallbackWebcam('leipzig-marktplatz', 'Marktplatz, Leipzig', 'Leipzig', 'DE', 51.3404, 12.3747, 'https://www.webcamtaxi.com/en/germany/leipzig/marktplatz.html'),
		createFallbackWebcam('bremen-marktplatz', 'Marktplatz, Bremen', 'Bremen', 'DE', 53.0759, 8.8074, 'https://www.webcamtaxi.com/en/germany/bremen/marktplatz.html'),
	],
	IT: [
		createFallbackWebcam('rome-colosseum', 'Colosseum, Rome', 'Rome', 'IT', 41.8902, 12.4922, 'https://www.skylinewebcams.com/en/webcam/italia/lazio/roma/colosseo.html'),
		createFallbackWebcam('venice-grand-canal', 'Grand Canal, Venice', 'Venice', 'IT', 45.4408, 12.3155, 'https://www.skylinewebcams.com/en/webcam/italia/veneto/venezia/rialto.html'),
		createFallbackWebcam('florence-duomo', 'Duomo, Florence', 'Florence', 'IT', 43.7731, 11.2560, 'https://www.skylinewebcams.com/en/webcam/italia/toscana/firenze/piazza-del-duomo.html'),
		createFallbackWebcam('milan-duomo', 'Duomo di Milano', 'Milan', 'IT', 45.4642, 9.1900, 'https://www.skylinewebcams.com/en/webcam/italia/lombardia/milano/duomo-milano.html'),
		createFallbackWebcam('naples-vesuvius', 'Mount Vesuvius, Naples', 'Naples', 'IT', 40.8518, 14.2681, 'https://www.skylinewebcams.com/en/webcam/italia/campania/napoli/vesuvio.html'),
		createFallbackWebcam('pisa-tower', 'Leaning Tower of Pisa', 'Pisa', 'IT', 43.7230, 10.3966, 'https://www.skylinewebcams.com/en/webcam/italia/toscana/pisa/torre-di-pisa.html'),
		createFallbackWebcam('amalfi-coast', 'Amalfi Coast', 'Amalfi', 'IT', 40.6340, 14.6027, 'https://www.skylinewebcams.com/en/webcam/italia/campania/salerno/amalfi.html'),
		createFallbackWebcam('rome-trevi', 'Trevi Fountain, Rome', 'Rome', 'IT', 41.9009, 12.4833, 'https://www.skylinewebcams.com/en/webcam/italia/lazio/roma/fontana-di-trevi.html'),
		createFallbackWebcam('venice-san-marco', 'St. Marks Square, Venice', 'Venice', 'IT', 45.4343, 12.3388, 'https://www.skylinewebcams.com/en/webcam/italia/veneto/venezia/piazza-san-marco.html'),
		createFallbackWebcam('sicily-taormina', 'Taormina, Sicily', 'Taormina', 'IT', 37.8533, 15.2859, 'https://www.skylinewebcams.com/en/webcam/italia/sicilia/messina/taormina.html'),
		createFallbackWebcam('cinque-terre', 'Cinque Terre, Manarola', 'Manarola', 'IT', 44.1068, 9.7265, 'https://www.skylinewebcams.com/en/webcam/italia/liguria/la-spezia/manarola.html'),
		createFallbackWebcam('turin-mole', 'Mole Antonelliana, Turin', 'Turin', 'IT', 45.0693, 7.6929, 'https://www.skylinewebcams.com/en/webcam/italia/piemonte/torino/mole-antonelliana.html'),
		createFallbackWebcam('bologna-piazza', 'Piazza Maggiore, Bologna', 'Bologna', 'IT', 44.4939, 11.3428, 'https://www.skylinewebcams.com/en/webcam/italia/emilia-romagna/bologna/piazza-maggiore.html'),
		createFallbackWebcam('sardinia-costa-smeralda', 'Costa Smeralda, Sardinia', 'Porto Cervo', 'IT', 41.1344, 9.5329, 'https://www.skylinewebcams.com/en/webcam/italia/sardegna/olbia-tempio/costa-smeralda.html'),
	],
	ES: [
		createFallbackWebcam('barcelona-sagrada-familia', 'Sagrada Familia, Barcelona', 'Barcelona', 'ES', 41.4036, 2.1744, 'https://www.skylinewebcams.com/en/webcam/espana/cataluna/barcelona/sagrada-familia.html'),
		createFallbackWebcam('madrid-puerta-sol', 'Puerta del Sol, Madrid', 'Madrid', 'ES', 40.4168, -3.7038, 'https://www.skylinewebcams.com/en/webcam/espana/comunidad-de-madrid/madrid/puerta-del-sol.html'),
		createFallbackWebcam('seville-plaza-espana', 'Plaza de Espana, Seville', 'Seville', 'ES', 37.3772, -5.9869, 'https://www.skylinewebcams.com/en/webcam/espana/andalucia/sevilla/plaza-de-espana.html'),
		createFallbackWebcam('valencia-city-arts', 'City of Arts and Sciences, Valencia', 'Valencia', 'ES', 39.4540, -0.3503, 'https://www.skylinewebcams.com/en/webcam/espana/comunidad-valenciana/valencia/ciudad-de-las-artes.html'),
		createFallbackWebcam('malaga-beach', 'Malagueta Beach, Malaga', 'Malaga', 'ES', 36.7191, -4.4094, 'https://www.skylinewebcams.com/en/webcam/espana/andalucia/malaga/playa-malagueta.html'),
		createFallbackWebcam('ibiza-port', 'Ibiza Port', 'Ibiza', 'ES', 38.9067, 1.4206, 'https://www.skylinewebcams.com/en/webcam/espana/islas-baleares/ibiza/puerto-ibiza.html'),
		createFallbackWebcam('tenerife-beach', 'Las Americas Beach, Tenerife', 'Tenerife', 'ES', 28.0520, -16.7320, 'https://www.skylinewebcams.com/en/webcam/espana/islas-canarias/tenerife/playa-americas.html'),
		createFallbackWebcam('granada-alhambra', 'Alhambra View, Granada', 'Granada', 'ES', 37.1773, -3.5986, 'https://www.skylinewebcams.com/en/webcam/espana/andalucia/granada/alhambra.html'),
	],
	JP: [
		createFallbackWebcam('tokyo-shibuya', 'Shibuya Crossing, Tokyo', 'Tokyo', 'JP', 35.6595, 139.7004, 'https://www.youtube.com/embed/live_stream?channel=UCgdHxnHSXvcAi4PaMIY1Ltg'),
		createFallbackWebcam('tokyo-skytree', 'Tokyo Skytree', 'Tokyo', 'JP', 35.7101, 139.8107, 'https://www.youtube.com/embed/live_stream?channel=UCT0N8qWPwG2c9M1lL-5MF4A'),
		createFallbackWebcam('mt-fuji', 'Mount Fuji', 'Shizuoka', 'JP', 35.3606, 138.7274, 'https://www.youtube.com/embed/live_stream?channel=UC7B1qgT-bECAKq9IFOvuJkg'),
		createFallbackWebcam('tokyo-shinjuku', 'Shinjuku, Tokyo', 'Tokyo', 'JP', 35.6938, 139.7034, 'https://www.webcamtaxi.com/en/japan/tokyo/shinjuku.html'),
		createFallbackWebcam('osaka-dotonbori', 'Dotonbori, Osaka', 'Osaka', 'JP', 34.6687, 135.5031, 'https://www.webcamtaxi.com/en/japan/osaka/dotonbori.html'),
		createFallbackWebcam('kyoto-kiyomizu', 'Kiyomizu Temple, Kyoto', 'Kyoto', 'JP', 34.9949, 135.7850, 'https://www.webcamtaxi.com/en/japan/kyoto/kiyomizu.html'),
		createFallbackWebcam('hiroshima-peace', 'Peace Memorial, Hiroshima', 'Hiroshima', 'JP', 34.3955, 132.4536, 'https://www.webcamtaxi.com/en/japan/hiroshima/peace-memorial.html'),
		createFallbackWebcam('nara-deer-park', 'Nara Deer Park', 'Nara', 'JP', 34.6851, 135.8048, 'https://www.webcamtaxi.com/en/japan/nara/deer-park.html'),
		createFallbackWebcam('yokohama-bay', 'Yokohama Bay', 'Yokohama', 'JP', 35.4437, 139.6380, 'https://www.webcamtaxi.com/en/japan/yokohama/bay.html'),
	],
	CN: [
		createFallbackWebcam('shanghai-bund', 'The Bund, Shanghai', 'Shanghai', 'CN', 31.2400, 121.4900, 'https://www.earthcam.com/world/china/shanghai/'),
		createFallbackWebcam('beijing-tiananmen', 'Tiananmen Square Area, Beijing', 'Beijing', 'CN', 39.9087, 116.3975, 'https://www.webcamtaxi.com/en/china/beijing/tiananmen-square.html'),
	],
	AU: [
		createFallbackWebcam('sydney-opera-house', 'Sydney Opera House', 'Sydney', 'AU', -33.8568, 151.2153, 'https://www.youtube.com/embed/live_stream?channel=UCy1Xc8YVHNUMSn-CzWwD9fw'),
		createFallbackWebcam('melbourne-flinders', 'Flinders Street Station, Melbourne', 'Melbourne', 'AU', -37.8183, 144.9671, 'https://www.earthcam.com/world/australia/melbourne/'),
		createFallbackWebcam('sydney-harbour-bridge', 'Sydney Harbour Bridge', 'Sydney', 'AU', -33.8523, 151.2108, 'https://www.webcamtaxi.com/en/australia/sydney/harbour-bridge.html'),
		createFallbackWebcam('brisbane-southbank', 'South Bank, Brisbane', 'Brisbane', 'AU', -27.4698, 153.0251, 'https://www.webcamtaxi.com/en/australia/brisbane/south-bank.html'),
		createFallbackWebcam('perth-elizabeth-quay', 'Elizabeth Quay, Perth', 'Perth', 'AU', -31.9575, 115.8588, 'https://www.webcamtaxi.com/en/australia/perth/elizabeth-quay.html'),
		createFallbackWebcam('adelaide-rundle-mall', 'Rundle Mall, Adelaide', 'Adelaide', 'AU', -34.9228, 138.6007, 'https://www.webcamtaxi.com/en/australia/adelaide/rundle-mall.html'),
		createFallbackWebcam('gold-coast-surfers', 'Surfers Paradise, Gold Coast', 'Gold Coast', 'AU', -28.0034, 153.4290, 'https://www.webcamtaxi.com/en/australia/gold-coast/surfers-paradise.html'),
		createFallbackWebcam('bondi-beach', 'Bondi Beach, Sydney', 'Sydney', 'AU', -33.8915, 151.2767, 'https://www.webcamtaxi.com/en/australia/sydney/bondi-beach.html'),
		createFallbackWebcam('cairns-reef', 'Cairns Esplanade', 'Cairns', 'AU', -16.9186, 145.7781, 'https://www.webcamtaxi.com/en/australia/cairns/esplanade.html'),
	],
	BR: [
		createFallbackWebcam('rio-copacabana', 'Copacabana Beach, Rio', 'Rio de Janeiro', 'BR', -22.9711, -43.1822, 'https://www.skylinewebcams.com/en/webcam/brasil/rio-de-janeiro/rio-de-janeiro/copacabana.html'),
		createFallbackWebcam('rio-ipanema', 'Ipanema Beach, Rio', 'Rio de Janeiro', 'BR', -22.9838, -43.1985, 'https://www.webcamtaxi.com/en/brazil/rio-de-janeiro/ipanema-beach.html'),
		createFallbackWebcam('rio-christ-redeemer', 'Christ the Redeemer View, Rio', 'Rio de Janeiro', 'BR', -22.9068, -43.1729, 'https://www.webcamtaxi.com/en/brazil/rio-de-janeiro/christ-redeemer.html'),
		createFallbackWebcam('sao-paulo-paulista', 'Paulista Avenue, Sao Paulo', 'Sao Paulo', 'BR', -23.5613, -46.6559, 'https://www.webcamtaxi.com/en/brazil/sao-paulo/paulista-avenue.html'),
		createFallbackWebcam('brasilia-esplanada', 'Esplanada dos Ministerios, Brasilia', 'Brasilia', 'BR', -15.7989, -47.8643, 'https://www.webcamtaxi.com/en/brazil/brasilia/esplanada.html'),
		createFallbackWebcam('salvador-pelourinho', 'Pelourinho, Salvador', 'Salvador', 'BR', -12.9711, -38.5108, 'https://www.webcamtaxi.com/en/brazil/salvador/pelourinho.html'),
		createFallbackWebcam('florianopolis-beach', 'Florianopolis Beach', 'Florianopolis', 'BR', -27.5954, -48.5480, 'https://www.webcamtaxi.com/en/brazil/florianopolis/beach.html'),
		createFallbackWebcam('recife-boa-viagem', 'Boa Viagem Beach, Recife', 'Recife', 'BR', -8.1134, -34.8960, 'https://www.webcamtaxi.com/en/brazil/recife/boa-viagem.html'),
	],
	RU: [
		createFallbackWebcam('moscow-red-square', 'Red Square, Moscow', 'Moscow', 'RU', 55.7539, 37.6208, 'https://www.webcamtaxi.com/en/russia/moscow/red-square.html'),
		createFallbackWebcam('moscow-kremlin', 'Kremlin View, Moscow', 'Moscow', 'RU', 55.7520, 37.6175, 'https://www.webcamtaxi.com/en/russia/moscow/kremlin.html'),
		createFallbackWebcam('st-petersburg-hermitage', 'Hermitage Museum, St. Petersburg', 'St. Petersburg', 'RU', 59.9398, 30.3146, 'https://www.webcamtaxi.com/en/russia/st-petersburg/hermitage.html'),
		createFallbackWebcam('st-petersburg-nevsky', 'Nevsky Prospect, St. Petersburg', 'St. Petersburg', 'RU', 59.9343, 30.3351, 'https://www.webcamtaxi.com/en/russia/st-petersburg/nevsky-prospect.html'),
		createFallbackWebcam('sochi-beach', 'Sochi Beach', 'Sochi', 'RU', 43.5855, 39.7231, 'https://www.webcamtaxi.com/en/russia/sochi/beach.html'),
		createFallbackWebcam('vladivostok-golden-horn', 'Golden Horn Bay, Vladivostok', 'Vladivostok', 'RU', 43.1155, 131.8855, 'https://www.webcamtaxi.com/en/russia/vladivostok/golden-horn.html'),
		createFallbackWebcam('kazan-kremlin', 'Kazan Kremlin', 'Kazan', 'RU', 55.7987, 49.1067, 'https://www.webcamtaxi.com/en/russia/kazan/kremlin.html'),
		createFallbackWebcam('yekaterinburg-center', 'Yekaterinburg City Center', 'Yekaterinburg', 'RU', 56.8389, 60.6057, 'https://www.webcamtaxi.com/en/russia/yekaterinburg/center.html'),
	],
	IN: [
		createFallbackWebcam('mumbai-marine-drive', 'Marine Drive, Mumbai', 'Mumbai', 'IN', 18.9432, 72.8235, 'https://www.webcamtaxi.com/en/india/mumbai/marine-drive.html'),
	],
	AE: [
		createFallbackWebcam('dubai-burj-khalifa', 'Burj Khalifa, Dubai', 'Dubai', 'AE', 25.1972, 55.2744, 'https://www.earthcam.com/world/uae/dubai/'),
	],
	NL: [
		createFallbackWebcam('amsterdam-dam-square', 'Dam Square, Amsterdam', 'Amsterdam', 'NL', 52.3731, 4.8932, 'https://www.earthcam.com/world/netherlands/amsterdam/'),
	],
	TH: [
		createFallbackWebcam('bangkok-sukhumvit', 'Sukhumvit Road, Bangkok', 'Bangkok', 'TH', 13.7563, 100.5018, 'https://www.webcamtaxi.com/en/thailand/bangkok/sukhumvit.html'),
	],
	MX: [
		createFallbackWebcam('cancun-beach', 'Cancun Beach', 'Cancun', 'MX', 21.1619, -86.8515, 'https://www.skylinewebcams.com/en/webcam/mexico/quintana-roo/cancun/cancun.html'),
	],
	GR: [
		createFallbackWebcam('santorini-oia', 'Oia, Santorini', 'Santorini', 'GR', 36.4618, 25.3753, 'https://www.skylinewebcams.com/en/webcam/greece/south-aegean/santorini/santorini-oia.html'),
		createFallbackWebcam('athens-acropolis', 'Acropolis, Athens', 'Athens', 'GR', 37.9715, 23.7267, 'https://www.skylinewebcams.com/en/webcam/greece/attica/athens/acropolis.html'),
	],
	PT: [
		createFallbackWebcam('lisbon-alfama', 'Alfama, Lisbon', 'Lisbon', 'PT', 38.7139, -9.1334, 'https://www.skylinewebcams.com/en/webcam/portugal/lisbon/lisbon/alfama.html'),
	],
	UA: [
		createFallbackWebcam('kyiv-maidan', 'Maidan Square, Kyiv', 'Kyiv', 'UA', 50.4501, 30.5234, 'https://www.webcamtaxi.com/en/ukraine/kyiv/maidan-square.html'),
	],
	PL: [
		createFallbackWebcam('warsaw-old-town', 'Old Town, Warsaw', 'Warsaw', 'PL', 52.2497, 21.0122, 'https://www.skylinewebcams.com/en/webcam/poland/masovian/warsaw/stare-miasto.html'),
		createFallbackWebcam('krakow-market-square', 'Market Square, Krakow', 'Krakow', 'PL', 50.0619, 19.9369, 'https://www.skylinewebcams.com/en/webcam/poland/lesser-poland/krakow/main-square.html'),
	],
	AT: [
		createFallbackWebcam('vienna-stephansplatz', 'Stephansplatz, Vienna', 'Vienna', 'AT', 48.2082, 16.3738, 'https://www.skylinewebcams.com/en/webcam/oesterreich/wien/wien/stephansplatz.html'),
	],
	CH: [
		createFallbackWebcam('zurich-city', 'Zurich City Center', 'Zurich', 'CH', 47.3769, 8.5417, 'https://www.webcamtaxi.com/en/switzerland/zurich/bahnhofstrasse.html'),
	],
	SE: [
		createFallbackWebcam('stockholm-gamla-stan', 'Gamla Stan, Stockholm', 'Stockholm', 'SE', 59.3251, 18.0710, 'https://www.webcamtaxi.com/en/sweden/stockholm/gamla-stan.html'),
	],
	NO: [
		createFallbackWebcam('oslo-harbor', 'Oslo Harbor', 'Oslo', 'NO', 59.9127, 10.7461, 'https://www.webcamtaxi.com/en/norway/oslo/oslo-harbour.html'),
	],
	DK: [
		createFallbackWebcam('copenhagen-nyhavn', 'Nyhavn, Copenhagen', 'Copenhagen', 'DK', 55.6797, 12.5891, 'https://www.webcamtaxi.com/en/denmark/copenhagen/nyhavn.html'),
	],
	FI: [
		createFallbackWebcam('helsinki-senate', 'Senate Square, Helsinki', 'Helsinki', 'FI', 60.1699, 24.9384, 'https://www.webcamtaxi.com/en/finland/helsinki/senate-square.html'),
	],
	CZ: [
		createFallbackWebcam('prague-old-town', 'Old Town Square, Prague', 'Prague', 'CZ', 50.0875, 14.4213, 'https://www.skylinewebcams.com/en/webcam/czech-republic/prague/prague/old-town-square.html'),
	],
	HU: [
		createFallbackWebcam('budapest-chain-bridge', 'Chain Bridge, Budapest', 'Budapest', 'HU', 47.4979, 19.0402, 'https://www.webcamtaxi.com/en/hungary/budapest/chain-bridge.html'),
	],
	IE: [
		createFallbackWebcam('dublin-temple-bar', 'Temple Bar, Dublin', 'Dublin', 'IE', 53.3459, -6.2645, 'https://www.webcamtaxi.com/en/ireland/dublin/temple-bar.html'),
	],
	KR: [
		createFallbackWebcam('seoul-gangnam', 'Gangnam, Seoul', 'Seoul', 'KR', 37.4979, 127.0276, 'https://www.youtube.com/embed/live_stream?channel=UC-f9GEVlPgKCKmBdvfKM4NA'),
	],
	SG: [
		createFallbackWebcam('singapore-marina-bay', 'Marina Bay, Singapore', 'Singapore', 'SG', 1.2838, 103.8591, 'https://www.earthcam.com/world/singapore/'),
	],
	HK: [
		createFallbackWebcam('hong-kong-harbour', 'Victoria Harbour, Hong Kong', 'Hong Kong', 'HK', 22.2855, 114.1577, 'https://www.earthcam.com/world/china/hongkong/'),
	],
	NZ: [
		createFallbackWebcam('auckland-harbour', 'Auckland Harbour', 'Auckland', 'NZ', -36.8485, 174.7633, 'https://www.webcamtaxi.com/en/new-zealand/auckland/auckland-harbour.html'),
	],
	ZA: [
		createFallbackWebcam('cape-town-table-mountain', 'Table Mountain, Cape Town', 'Cape Town', 'ZA', -33.9628, 18.4098, 'https://www.webcamtaxi.com/en/south-africa/cape-town/table-mountain.html'),
	],
	EG: [
		createFallbackWebcam('cairo-pyramids', 'Giza Pyramids, Cairo', 'Cairo', 'EG', 29.9792, 31.1342, 'https://www.webcamtaxi.com/en/egypt/giza/pyramids.html'),
	],
	IL: [
		createFallbackWebcam('jerusalem-western-wall', 'Western Wall, Jerusalem', 'Jerusalem', 'IL', 31.7767, 35.2345, 'https://www.skylinewebcams.com/en/webcam/israel/jerusalem-district/jerusalem/western-wall.html'),
		createFallbackWebcam('tel-aviv-beach', 'Tel Aviv Beach', 'Tel Aviv', 'IL', 32.0853, 34.7818, 'https://www.skylinewebcams.com/en/webcam/israel/tel-aviv-district/tel-aviv/tel-aviv-beach.html'),
	],
	CA: [
		createFallbackWebcam('toronto-cn-tower', 'CN Tower, Toronto', 'Toronto', 'CA', 43.6426, -79.3871, 'https://www.earthcam.com/world/canada/toronto/'),
		createFallbackWebcam('vancouver-harbour', 'Vancouver Harbour', 'Vancouver', 'CA', 49.2827, -123.1207, 'https://www.webcamtaxi.com/en/canada/vancouver/vancouver-harbour.html'),
		createFallbackWebcam('niagara-falls', 'Niagara Falls', 'Niagara Falls', 'CA', 43.0896, -79.0849, 'https://www.earthcam.com/world/canada/niagarafalls/'),
		createFallbackWebcam('montreal-old-port', 'Old Port, Montreal', 'Montreal', 'CA', 45.5048, -73.5538, 'https://www.webcamtaxi.com/en/canada/montreal/old-port.html'),
		createFallbackWebcam('calgary-downtown', 'Downtown Calgary', 'Calgary', 'CA', 51.0447, -114.0719, 'https://www.webcamtaxi.com/en/canada/calgary/downtown.html'),
		createFallbackWebcam('ottawa-parliament', 'Parliament Hill, Ottawa', 'Ottawa', 'CA', 45.4236, -75.6961, 'https://www.webcamtaxi.com/en/canada/ottawa/parliament-hill.html'),
		createFallbackWebcam('quebec-chateau', 'Chateau Frontenac, Quebec City', 'Quebec City', 'CA', 46.8119, -71.2056, 'https://www.webcamtaxi.com/en/canada/quebec/chateau-frontenac.html'),
		createFallbackWebcam('banff-mountains', 'Banff Town Centre', 'Banff', 'CA', 51.1784, -115.5708, 'https://www.webcamtaxi.com/en/canada/banff/town-centre.html'),
		createFallbackWebcam('halifax-waterfront', 'Halifax Waterfront', 'Halifax', 'CA', 44.6488, -63.5752, 'https://www.webcamtaxi.com/en/canada/halifax/waterfront.html'),
		createFallbackWebcam('victoria-harbour', 'Victoria Inner Harbour', 'Victoria', 'CA', 48.4222, -123.3707, 'https://www.webcamtaxi.com/en/canada/victoria/inner-harbour.html'),
		createFallbackWebcam('whistler-village', 'Whistler Village', 'Whistler', 'CA', 50.1163, -122.9574, 'https://www.webcamtaxi.com/en/canada/whistler/village.html'),
	],
	AR: [
		createFallbackWebcam('buenos-aires-obelisco', 'Obelisco, Buenos Aires', 'Buenos Aires', 'AR', -34.6037, -58.3816, 'https://www.webcamtaxi.com/en/argentina/buenos-aires/obelisco.html'),
	],
	CL: [
		createFallbackWebcam('santiago-costanera', 'Costanera Center, Santiago', 'Santiago', 'CL', -33.4489, -70.6693, 'https://www.webcamtaxi.com/en/chile/santiago/costanera-center.html'),
	],
	CO: [
		createFallbackWebcam('bogota-plaza-bolivar', 'Plaza Bolivar, Bogota', 'Bogota', 'CO', 4.5981, -74.0760, 'https://www.webcamtaxi.com/en/colombia/bogota/plaza-bolivar.html'),
	],
	PE: [
		createFallbackWebcam('lima-miraflores', 'Miraflores, Lima', 'Lima', 'PE', -12.1191, -77.0302, 'https://www.webcamtaxi.com/en/peru/lima/miraflores.html'),
	],
	TR: [
		createFallbackWebcam('istanbul-sultanahmet', 'Sultanahmet, Istanbul', 'Istanbul', 'TR', 41.0082, 28.9784, 'https://www.skylinewebcams.com/en/webcam/turkey/istanbul/istanbul/sultanahmet.html'),
	],
	MY: [
		createFallbackWebcam('kuala-lumpur-towers', 'Petronas Towers, Kuala Lumpur', 'Kuala Lumpur', 'MY', 3.1579, 101.7116, 'https://www.webcamtaxi.com/en/malaysia/kuala-lumpur/petronas-towers.html'),
	],
	PH: [
		createFallbackWebcam('manila-bay', 'Manila Bay', 'Manila', 'PH', 14.5535, 120.9830, 'https://www.webcamtaxi.com/en/philippines/manila/manila-bay.html'),
	],
	ID: [
		createFallbackWebcam('bali-kuta-beach', 'Kuta Beach, Bali', 'Bali', 'ID', -8.7220, 115.1714, 'https://www.webcamtaxi.com/en/indonesia/bali/kuta-beach.html'),
	],
	VN: [
		createFallbackWebcam('ho-chi-minh-city', 'Ho Chi Minh City Center', 'Ho Chi Minh City', 'VN', 10.8231, 106.6297, 'https://www.webcamtaxi.com/en/vietnam/ho-chi-minh-city/city-center.html'),
	],
	BE: [
		createFallbackWebcam('brussels-grand-place', 'Grand Place, Brussels', 'Brussels', 'BE', 50.8467, 4.3525, 'https://www.skylinewebcams.com/en/webcam/belgique/bruxelles/bruxelles/grand-place.html'),
	],
	HR: [
		createFallbackWebcam('dubrovnik-old-town', 'Old Town, Dubrovnik', 'Dubrovnik', 'HR', 42.6507, 18.0944, 'https://www.skylinewebcams.com/en/webcam/hrvatska/dubrovacko-neretvanska/dubrovnik/dubrovnik-stradun.html'),
	],
	IS: [
		createFallbackWebcam('reykjavik-harbour', 'Reykjavik Harbour', 'Reykjavik', 'IS', 64.1466, -21.9426, 'https://www.webcamtaxi.com/en/iceland/reykjavik/harbour.html'),
	],
	MC: [
		createFallbackWebcam('monaco-harbour', 'Monaco Harbour', 'Monaco', 'MC', 43.7384, 7.4246, 'https://www.skylinewebcams.com/en/webcam/monaco/monaco/monaco/port-hercule.html'),
	],
	VA: [
		createFallbackWebcam('vatican-st-peters', "St. Peter's Square, Vatican", 'Vatican City', 'VA', 41.9029, 12.4534, 'https://www.skylinewebcams.com/en/webcam/italia/lazio/roma/piazza-san-pietro.html'),
	],
	MT: [
		createFallbackWebcam('malta-valletta', 'Valletta Harbour, Malta', 'Valletta', 'MT', 35.8989, 14.5146, 'https://www.skylinewebcams.com/en/webcam/malta/island-of-malta/valletta/grand-harbour.html'),
	],
	CY: [
		createFallbackWebcam('nicosia-ledra', 'Ledra Street, Nicosia', 'Nicosia', 'CY', 35.1690, 33.3630, 'https://www.webcamtaxi.com/en/cyprus/nicosia/ledra-street.html'),
	],
	SA: [
		createFallbackWebcam('mecca-kaaba', 'Kaaba, Mecca', 'Mecca', 'SA', 21.4225, 39.8262, 'https://www.youtube.com/embed/live_stream?channel=UCkQ6PgDwk3B5PHfAOKpCSAg'),
	],
	KE: [
		createFallbackWebcam('nairobi-city', 'Nairobi City Center', 'Nairobi', 'KE', -1.2921, 36.8219, 'https://www.webcamtaxi.com/en/kenya/nairobi/city-center.html'),
	],
	NG: [
		createFallbackWebcam('lagos-lekki', 'Lekki, Lagos', 'Lagos', 'NG', 6.4698, 3.5852, 'https://www.webcamtaxi.com/en/nigeria/lagos/lekki.html'),
	],
	MA: [
		createFallbackWebcam('marrakech-jemaa', 'Jemaa el-Fnaa, Marrakech', 'Marrakech', 'MA', 31.6255, -7.9891, 'https://www.webcamtaxi.com/en/morocco/marrakech/jemaa-el-fnaa.html'),
	],
	TN: [
		createFallbackWebcam('tunis-medina', 'Medina, Tunis', 'Tunis', 'TN', 36.7992, 10.1802, 'https://www.webcamtaxi.com/en/tunisia/tunis/medina.html'),
	],
	JO: [
		createFallbackWebcam('amman-citadel', 'Citadel, Amman', 'Amman', 'JO', 31.9539, 35.9106, 'https://www.webcamtaxi.com/en/jordan/amman/citadel.html'),
	],
	LB: [
		createFallbackWebcam('beirut-downtown', 'Downtown Beirut', 'Beirut', 'LB', 33.8938, 35.5018, 'https://www.webcamtaxi.com/en/lebanon/beirut/downtown.html'),
	],
	QA: [
		createFallbackWebcam('doha-corniche', 'Corniche, Doha', 'Doha', 'QA', 25.3013, 51.4870, 'https://www.webcamtaxi.com/en/qatar/doha/corniche.html'),
	],
	BH: [
		createFallbackWebcam('manama-financial', 'Financial Harbour, Manama', 'Manama', 'BH', 26.2361, 50.5831, 'https://www.webcamtaxi.com/en/bahrain/manama/financial-harbour.html'),
	],
	KW: [
		createFallbackWebcam('kuwait-city-towers', 'Kuwait Towers, Kuwait City', 'Kuwait City', 'KW', 29.3908, 47.9942, 'https://www.webcamtaxi.com/en/kuwait/kuwait-city/kuwait-towers.html'),
	],
	OM: [
		createFallbackWebcam('muscat-mutrah', 'Mutrah Corniche, Muscat', 'Muscat', 'OM', 23.6161, 58.5903, 'https://www.webcamtaxi.com/en/oman/muscat/mutrah.html'),
	],
	// Additional African countries
	GH: [
		createFallbackWebcam('accra-independence', 'Independence Square, Accra', 'Accra', 'GH', 5.5560, -0.1969, 'https://www.webcamtaxi.com/en/ghana/accra/independence-square.html'),
	],
	TZ: [
		createFallbackWebcam('dar-es-salaam-harbour', 'Dar es Salaam Harbour', 'Dar es Salaam', 'TZ', -6.8235, 39.2695, 'https://www.webcamtaxi.com/en/tanzania/dar-es-salaam/harbour.html'),
	],
	ET: [
		createFallbackWebcam('addis-ababa-meskel', 'Meskel Square, Addis Ababa', 'Addis Ababa', 'ET', 9.0107, 38.7612, 'https://www.webcamtaxi.com/en/ethiopia/addis-ababa/meskel-square.html'),
	],
	SN: [
		createFallbackWebcam('dakar-coast', 'Dakar Coast', 'Dakar', 'SN', 14.6928, -17.4467, 'https://www.webcamtaxi.com/en/senegal/dakar/coast.html'),
	],
	// Additional Asian countries
	TW: [
		createFallbackWebcam('taipei-101', 'Taipei 101', 'Taipei', 'TW', 25.0330, 121.5654, 'https://www.webcamtaxi.com/en/taiwan/taipei/taipei-101.html'),
		createFallbackWebcam('taipei-ximending', 'Ximending, Taipei', 'Taipei', 'TW', 25.0421, 121.5081, 'https://www.webcamtaxi.com/en/taiwan/taipei/ximending.html'),
	],
	PK: [
		createFallbackWebcam('karachi-clifton', 'Clifton Beach, Karachi', 'Karachi', 'PK', 24.8138, 67.0300, 'https://www.webcamtaxi.com/en/pakistan/karachi/clifton-beach.html'),
		createFallbackWebcam('lahore-badshahi', 'Badshahi Mosque, Lahore', 'Lahore', 'PK', 31.5881, 74.3107, 'https://www.webcamtaxi.com/en/pakistan/lahore/badshahi-mosque.html'),
	],
	BD: [
		createFallbackWebcam('dhaka-shahbag', 'Shahbag, Dhaka', 'Dhaka', 'BD', 23.7380, 90.3958, 'https://www.webcamtaxi.com/en/bangladesh/dhaka/shahbag.html'),
	],
	LK: [
		createFallbackWebcam('colombo-galle-face', 'Galle Face Green, Colombo', 'Colombo', 'LK', 6.9271, 79.8449, 'https://www.webcamtaxi.com/en/sri-lanka/colombo/galle-face.html'),
	],
	NP: [
		createFallbackWebcam('kathmandu-durbar', 'Durbar Square, Kathmandu', 'Kathmandu', 'NP', 27.7047, 85.3066, 'https://www.webcamtaxi.com/en/nepal/kathmandu/durbar-square.html'),
	],
	MM: [
		createFallbackWebcam('yangon-shwedagon', 'Shwedagon Pagoda, Yangon', 'Yangon', 'MM', 16.7984, 96.1496, 'https://www.webcamtaxi.com/en/myanmar/yangon/shwedagon.html'),
	],
	KH: [
		createFallbackWebcam('phnom-penh-riverside', 'Riverside, Phnom Penh', 'Phnom Penh', 'KH', 11.5564, 104.9282, 'https://www.webcamtaxi.com/en/cambodia/phnom-penh/riverside.html'),
	],
	LA: [
		createFallbackWebcam('vientiane-mekong', 'Mekong River, Vientiane', 'Vientiane', 'LA', 17.9757, 102.6331, 'https://www.webcamtaxi.com/en/laos/vientiane/mekong.html'),
	],
	// Additional European countries
	RO: [
		createFallbackWebcam('bucharest-parliament', 'Parliament Palace, Bucharest', 'Bucharest', 'RO', 44.4268, 26.1025, 'https://www.webcamtaxi.com/en/romania/bucharest/parliament.html'),
		createFallbackWebcam('brasov-council-square', 'Council Square, Brasov', 'Brasov', 'RO', 45.6427, 25.5887, 'https://www.webcamtaxi.com/en/romania/brasov/council-square.html'),
	],
	BG: [
		createFallbackWebcam('sofia-alexander-nevsky', 'Alexander Nevsky Cathedral, Sofia', 'Sofia', 'BG', 42.6966, 23.3326, 'https://www.webcamtaxi.com/en/bulgaria/sofia/alexander-nevsky.html'),
	],
	RS: [
		createFallbackWebcam('belgrade-republic-square', 'Republic Square, Belgrade', 'Belgrade', 'RS', 44.8176, 20.4569, 'https://www.webcamtaxi.com/en/serbia/belgrade/republic-square.html'),
	],
	SK: [
		createFallbackWebcam('bratislava-old-town', 'Old Town, Bratislava', 'Bratislava', 'SK', 48.1486, 17.1077, 'https://www.webcamtaxi.com/en/slovakia/bratislava/old-town.html'),
	],
	SI: [
		createFallbackWebcam('ljubljana-preseren', 'Preseren Square, Ljubljana', 'Ljubljana', 'SI', 46.0511, 14.5051, 'https://www.webcamtaxi.com/en/slovenia/ljubljana/preseren-square.html'),
		createFallbackWebcam('lake-bled', 'Lake Bled', 'Bled', 'SI', 46.3683, 14.1146, 'https://www.webcamtaxi.com/en/slovenia/bled/lake-bled.html'),
	],
	AL: [
		createFallbackWebcam('tirana-skanderbeg', 'Skanderbeg Square, Tirana', 'Tirana', 'AL', 41.3275, 19.8187, 'https://www.webcamtaxi.com/en/albania/tirana/skanderbeg-square.html'),
	],
	MK: [
		createFallbackWebcam('skopje-square', 'Macedonia Square, Skopje', 'Skopje', 'MK', 41.9973, 21.4280, 'https://www.webcamtaxi.com/en/macedonia/skopje/macedonia-square.html'),
	],
	BA: [
		createFallbackWebcam('sarajevo-bascarsija', 'Bascarsija, Sarajevo', 'Sarajevo', 'BA', 43.8598, 18.4311, 'https://www.webcamtaxi.com/en/bosnia/sarajevo/bascarsija.html'),
	],
	ME: [
		createFallbackWebcam('kotor-bay', 'Kotor Bay', 'Kotor', 'ME', 42.4247, 18.7712, 'https://www.webcamtaxi.com/en/montenegro/kotor/bay.html'),
	],
	XK: [
		createFallbackWebcam('pristina-center', 'Pristina Center', 'Pristina', 'XK', 42.6629, 21.1655, 'https://www.webcamtaxi.com/en/kosovo/pristina/center.html'),
	],
	LT: [
		createFallbackWebcam('vilnius-cathedral', 'Cathedral Square, Vilnius', 'Vilnius', 'LT', 54.6858, 25.2872, 'https://www.webcamtaxi.com/en/lithuania/vilnius/cathedral-square.html'),
	],
	LV: [
		createFallbackWebcam('riga-old-town', 'Old Town, Riga', 'Riga', 'LV', 56.9496, 24.1052, 'https://www.webcamtaxi.com/en/latvia/riga/old-town.html'),
	],
	EE: [
		createFallbackWebcam('tallinn-old-town', 'Old Town, Tallinn', 'Tallinn', 'EE', 59.4370, 24.7536, 'https://www.webcamtaxi.com/en/estonia/tallinn/old-town.html'),
	],
	BY: [
		createFallbackWebcam('minsk-independence', 'Independence Square, Minsk', 'Minsk', 'BY', 53.8967, 27.5500, 'https://www.webcamtaxi.com/en/belarus/minsk/independence-square.html'),
	],
	MD: [
		createFallbackWebcam('chisinau-center', 'Chisinau Center', 'Chisinau', 'MD', 47.0105, 28.8638, 'https://www.webcamtaxi.com/en/moldova/chisinau/center.html'),
	],
	// Additional Americas
	EC: [
		createFallbackWebcam('quito-basilica', 'Basilica del Voto Nacional, Quito', 'Quito', 'EC', -0.2150, -78.5069, 'https://www.webcamtaxi.com/en/ecuador/quito/basilica.html'),
	],
	VE: [
		createFallbackWebcam('caracas-plaza-bolivar', 'Plaza Bolivar, Caracas', 'Caracas', 'VE', 10.5064, -66.9146, 'https://www.webcamtaxi.com/en/venezuela/caracas/plaza-bolivar.html'),
	],
	UY: [
		createFallbackWebcam('montevideo-plaza', 'Plaza Independencia, Montevideo', 'Montevideo', 'UY', -34.9070, -56.2010, 'https://www.webcamtaxi.com/en/uruguay/montevideo/plaza-independencia.html'),
	],
	PY: [
		createFallbackWebcam('asuncion-panteon', 'Panteon, Asuncion', 'Asuncion', 'PY', -25.2844, -57.6350, 'https://www.webcamtaxi.com/en/paraguay/asuncion/panteon.html'),
	],
	BO: [
		createFallbackWebcam('la-paz-plaza-murillo', 'Plaza Murillo, La Paz', 'La Paz', 'BO', -16.4955, -68.1336, 'https://www.webcamtaxi.com/en/bolivia/la-paz/plaza-murillo.html'),
	],
	CR: [
		createFallbackWebcam('san-jose-central', 'San Jose Central', 'San Jose', 'CR', 9.9281, -84.0907, 'https://www.webcamtaxi.com/en/costa-rica/san-jose/central.html'),
	],
	PA: [
		createFallbackWebcam('panama-city-skyline', 'Panama City Skyline', 'Panama City', 'PA', 8.9824, -79.5199, 'https://www.webcamtaxi.com/en/panama/panama-city/skyline.html'),
		createFallbackWebcam('panama-canal', 'Panama Canal', 'Panama City', 'PA', 9.0800, -79.6800, 'https://www.webcamtaxi.com/en/panama/panama-canal/miraflores.html'),
	],
	GT: [
		createFallbackWebcam('guatemala-city-central', 'Guatemala City Central', 'Guatemala City', 'GT', 14.6349, -90.5069, 'https://www.webcamtaxi.com/en/guatemala/guatemala-city/central.html'),
	],
	HN: [
		createFallbackWebcam('tegucigalpa-center', 'Tegucigalpa Center', 'Tegucigalpa', 'HN', 14.0818, -87.2068, 'https://www.webcamtaxi.com/en/honduras/tegucigalpa/center.html'),
	],
	SV: [
		createFallbackWebcam('san-salvador-plaza', 'Plaza Gerardo Barrios, San Salvador', 'San Salvador', 'SV', 13.6989, -89.1914, 'https://www.webcamtaxi.com/en/el-salvador/san-salvador/plaza.html'),
	],
	NI: [
		createFallbackWebcam('managua-plaza', 'Plaza de la Revolucion, Managua', 'Managua', 'NI', 12.1364, -86.2514, 'https://www.webcamtaxi.com/en/nicaragua/managua/plaza.html'),
	],
	CU: [
		createFallbackWebcam('havana-malecon', 'Malecon, Havana', 'Havana', 'CU', 23.1451, -82.3618, 'https://www.webcamtaxi.com/en/cuba/havana/malecon.html'),
	],
	DO: [
		createFallbackWebcam('santo-domingo-zona', 'Zona Colonial, Santo Domingo', 'Santo Domingo', 'DO', 18.4741, -69.8857, 'https://www.webcamtaxi.com/en/dominican-republic/santo-domingo/zona-colonial.html'),
	],
	JM: [
		createFallbackWebcam('kingston-harbour', 'Kingston Harbour', 'Kingston', 'JM', 17.9771, -76.7674, 'https://www.webcamtaxi.com/en/jamaica/kingston/harbour.html'),
	],
	TT: [
		createFallbackWebcam('port-spain-independence', 'Independence Square, Port of Spain', 'Port of Spain', 'TT', 10.6549, -61.5175, 'https://www.webcamtaxi.com/en/trinidad/port-of-spain/independence-square.html'),
	],
	// Additional Oceania
	FJ: [
		createFallbackWebcam('suva-harbour', 'Suva Harbour', 'Suva', 'FJ', -18.1416, 178.4419, 'https://www.webcamtaxi.com/en/fiji/suva/harbour.html'),
	],
	PG: [
		createFallbackWebcam('port-moresby', 'Port Moresby', 'Port Moresby', 'PG', -9.4438, 147.1803, 'https://www.webcamtaxi.com/en/papua-new-guinea/port-moresby/city.html'),
	],
	// Additional Middle East
	IR: [
		createFallbackWebcam('tehran-azadi', 'Azadi Tower, Tehran', 'Tehran', 'IR', 35.6997, 51.3380, 'https://www.webcamtaxi.com/en/iran/tehran/azadi-tower.html'),
	],
	IQ: [
		createFallbackWebcam('baghdad-firdos', 'Firdos Square, Baghdad', 'Baghdad', 'IQ', 33.3120, 44.3939, 'https://www.webcamtaxi.com/en/iraq/baghdad/firdos-square.html'),
	],
	SY: [
		createFallbackWebcam('damascus-umayyad', 'Umayyad Square, Damascus', 'Damascus', 'SY', 33.5138, 36.2765, 'https://www.webcamtaxi.com/en/syria/damascus/umayyad-square.html'),
	],
	YE: [
		createFallbackWebcam('sanaa-old-city', 'Old City, Sanaa', 'Sanaa', 'YE', 15.3520, 44.2075, 'https://www.webcamtaxi.com/en/yemen/sanaa/old-city.html'),
	],
	AF: [
		createFallbackWebcam('kabul-city', 'Kabul City', 'Kabul', 'AF', 34.5281, 69.1723, 'https://www.webcamtaxi.com/en/afghanistan/kabul/city.html'),
	],
	// Central Asia
	KZ: [
		createFallbackWebcam('astana-bayterek', 'Bayterek Tower, Astana', 'Astana', 'KZ', 51.1282, 71.4307, 'https://www.webcamtaxi.com/en/kazakhstan/astana/bayterek.html'),
		createFallbackWebcam('almaty-republic', 'Republic Square, Almaty', 'Almaty', 'KZ', 43.2380, 76.9454, 'https://www.webcamtaxi.com/en/kazakhstan/almaty/republic-square.html'),
	],
	UZ: [
		createFallbackWebcam('tashkent-amir-timur', 'Amir Timur Square, Tashkent', 'Tashkent', 'UZ', 41.3111, 69.2797, 'https://www.webcamtaxi.com/en/uzbekistan/tashkent/amir-timur.html'),
	],
	TM: [
		createFallbackWebcam('ashgabat-independence', 'Independence Monument, Ashgabat', 'Ashgabat', 'TM', 37.9601, 58.3261, 'https://www.webcamtaxi.com/en/turkmenistan/ashgabat/independence.html'),
	],
	TJ: [
		createFallbackWebcam('dushanbe-rudaki', 'Rudaki Avenue, Dushanbe', 'Dushanbe', 'TJ', 38.5598, 68.7870, 'https://www.webcamtaxi.com/en/tajikistan/dushanbe/rudaki.html'),
	],
	KG: [
		createFallbackWebcam('bishkek-ala-too', 'Ala-Too Square, Bishkek', 'Bishkek', 'KG', 42.8746, 74.6122, 'https://www.webcamtaxi.com/en/kyrgyzstan/bishkek/ala-too.html'),
	],
	MN: [
		createFallbackWebcam('ulaanbaatar-sukhbaatar', 'Sukhbaatar Square, Ulaanbaatar', 'Ulaanbaatar', 'MN', 47.9184, 106.9177, 'https://www.webcamtaxi.com/en/mongolia/ulaanbaatar/sukhbaatar.html'),
	],
	// Russia additional cities
	AZ: [
		createFallbackWebcam('baku-flame-towers', 'Flame Towers, Baku', 'Baku', 'AZ', 40.3596, 49.8206, 'https://www.webcamtaxi.com/en/azerbaijan/baku/flame-towers.html'),
	],
	AM: [
		createFallbackWebcam('yerevan-republic', 'Republic Square, Yerevan', 'Yerevan', 'AM', 40.1776, 44.5126, 'https://www.webcamtaxi.com/en/armenia/yerevan/republic-square.html'),
	],
	GE: [
		createFallbackWebcam('tbilisi-freedom', 'Freedom Square, Tbilisi', 'Tbilisi', 'GE', 41.6938, 44.8015, 'https://www.webcamtaxi.com/en/georgia/tbilisi/freedom-square.html'),
		createFallbackWebcam('batumi-boulevard', 'Batumi Boulevard', 'Batumi', 'GE', 41.6459, 41.6339, 'https://www.webcamtaxi.com/en/georgia/batumi/boulevard.html'),
	],
	// Additional Russia cities
	RU_EXTRA: [],
	// Scandinavia additional
	SE_EXTRA: [
		createFallbackWebcam('gothenburg-harbor', 'Gothenburg Harbor', 'Gothenburg', 'SE', 57.7089, 11.9746, 'https://www.webcamtaxi.com/en/sweden/gothenburg/harbor.html'),
	],
	// Additional UK
	SC: [
		createFallbackWebcam('glasgow-george-square', 'George Square, Glasgow', 'Glasgow', 'GB', 55.8609, -4.2514, 'https://www.webcamtaxi.com/en/uk/glasgow/george-square.html'),
	],
	// Caribbean additions
	BB: [
		createFallbackWebcam('bridgetown-harbor', 'Bridgetown Harbor', 'Bridgetown', 'BB', 13.0969, -59.6145, 'https://www.webcamtaxi.com/en/barbados/bridgetown/harbor.html'),
	],
	BS: [
		createFallbackWebcam('nassau-paradise', 'Paradise Island, Nassau', 'Nassau', 'BS', 25.0833, -77.3228, 'https://www.webcamtaxi.com/en/bahamas/nassau/paradise-island.html'),
	],
	PR: [
		createFallbackWebcam('san-juan-old', 'Old San Juan', 'San Juan', 'PR', 18.4655, -66.1057, 'https://www.webcamtaxi.com/en/puerto-rico/san-juan/old-town.html'),
		createFallbackWebcam('condado-beach', 'Condado Beach', 'San Juan', 'PR', 18.4571, -66.0702, 'https://www.webcamtaxi.com/en/puerto-rico/san-juan/condado-beach.html'),
	],
	VI: [
		createFallbackWebcam('charlotte-amalie', 'Charlotte Amalie Harbor', 'Charlotte Amalie', 'VI', 18.3420, -64.9307, 'https://www.webcamtaxi.com/en/virgin-islands/charlotte-amalie/harbor.html'),
	],
	// Pacific Islands
	GU: [
		createFallbackWebcam('tumon-bay', 'Tumon Bay, Guam', 'Tumon', 'GU', 13.5070, 144.8004, 'https://www.webcamtaxi.com/en/guam/tumon/bay.html'),
	],
	// Nordic additions
	GL: [
		createFallbackWebcam('nuuk-harbor', 'Nuuk Harbor', 'Nuuk', 'GL', 64.1835, -51.7216, 'https://www.webcamtaxi.com/en/greenland/nuuk/harbor.html'),
	],
	FO: [
		createFallbackWebcam('torshavn-harbor', 'Torshavn Harbor', 'Torshavn', 'FO', 62.0079, -6.7716, 'https://www.webcamtaxi.com/en/faroe-islands/torshavn/harbor.html'),
	],
	// More European additions
	LU: [
		createFallbackWebcam('luxembourg-city', 'Luxembourg City Center', 'Luxembourg', 'LU', 49.6117, 6.1319, 'https://www.webcamtaxi.com/en/luxembourg/luxembourg-city/center.html'),
	],
	AD: [
		createFallbackWebcam('andorra-la-vella', 'Andorra la Vella', 'Andorra la Vella', 'AD', 42.5063, 1.5218, 'https://www.webcamtaxi.com/en/andorra/andorra-la-vella/center.html'),
	],
	LI: [
		createFallbackWebcam('vaduz-castle', 'Vaduz Castle', 'Vaduz', 'LI', 47.1410, 9.5215, 'https://www.webcamtaxi.com/en/liechtenstein/vaduz/castle.html'),
	],
	SM: [
		createFallbackWebcam('san-marino-tower', 'San Marino Tower', 'San Marino', 'SM', 43.9424, 12.4578, 'https://www.webcamtaxi.com/en/san-marino/san-marino/tower.html'),
	],
	// More Asia
	BN: [
		createFallbackWebcam('bandar-seri-begawan', 'Bandar Seri Begawan', 'Bandar Seri Begawan', 'BN', 4.9031, 114.9398, 'https://www.webcamtaxi.com/en/brunei/bandar-seri-begawan/center.html'),
	],
	MV: [
		createFallbackWebcam('male-waterfront', 'Male Waterfront', 'Male', 'MV', 4.1755, 73.5093, 'https://www.webcamtaxi.com/en/maldives/male/waterfront.html'),
	],
	BT: [
		createFallbackWebcam('thimphu-clock-tower', 'Clock Tower Square, Thimphu', 'Thimphu', 'BT', 27.4728, 89.6390, 'https://www.webcamtaxi.com/en/bhutan/thimphu/clock-tower.html'),
	],
	// Africa additions
	MU: [
		createFallbackWebcam('port-louis-waterfront', 'Port Louis Waterfront', 'Port Louis', 'MU', -20.1609, 57.5012, 'https://www.webcamtaxi.com/en/mauritius/port-louis/waterfront.html'),
	],
	SC_SEYCHELLES: [
		createFallbackWebcam('victoria-harbor', 'Victoria Harbor', 'Victoria', 'SC', -4.6191, 55.4513, 'https://www.webcamtaxi.com/en/seychelles/victoria/harbor.html'),
	],
	RW: [
		createFallbackWebcam('kigali-convention', 'Kigali Convention Center', 'Kigali', 'RW', -1.9441, 30.0619, 'https://www.webcamtaxi.com/en/rwanda/kigali/convention-center.html'),
	],
	UG: [
		createFallbackWebcam('kampala-independence', 'Independence Monument, Kampala', 'Kampala', 'UG', 0.3136, 32.5811, 'https://www.webcamtaxi.com/en/uganda/kampala/independence.html'),
	],
	ZW: [
		createFallbackWebcam('victoria-falls', 'Victoria Falls', 'Victoria Falls', 'ZW', -17.9243, 25.8572, 'https://www.webcamtaxi.com/en/zimbabwe/victoria-falls/falls.html'),
	],
	ZM: [
		createFallbackWebcam('lusaka-cairo-road', 'Cairo Road, Lusaka', 'Lusaka', 'ZM', -15.4167, 28.2833, 'https://www.webcamtaxi.com/en/zambia/lusaka/cairo-road.html'),
	],
	BW: [
		createFallbackWebcam('gaborone-main-mall', 'Main Mall, Gaborone', 'Gaborone', 'BW', -24.6282, 25.9231, 'https://www.webcamtaxi.com/en/botswana/gaborone/main-mall.html'),
	],
	NA: [
		createFallbackWebcam('windhoek-independence', 'Independence Ave, Windhoek', 'Windhoek', 'NA', -22.5609, 17.0658, 'https://www.webcamtaxi.com/en/namibia/windhoek/independence.html'),
	],
	// More South America
	GY: [
		createFallbackWebcam('georgetown-seawall', 'Georgetown Seawall', 'Georgetown', 'GY', 6.8013, -58.1551, 'https://www.webcamtaxi.com/en/guyana/georgetown/seawall.html'),
	],
	SR: [
		createFallbackWebcam('paramaribo-waterfront', 'Paramaribo Waterfront', 'Paramaribo', 'SR', 5.8520, -55.2038, 'https://www.webcamtaxi.com/en/suriname/paramaribo/waterfront.html'),
	],
	// Additional major city cameras for countries with existing entries
	// More US cities
	US_EXTRA: [
		createFallbackWebcam('atlanta-peachtree', 'Peachtree Street, Atlanta', 'Atlanta', 'US', 33.7490, -84.3880, 'https://www.webcamtaxi.com/en/usa/georgia/atlanta-peachtree.html'),
		createFallbackWebcam('dallas-skyline', 'Dallas Skyline', 'Dallas', 'US', 32.7767, -96.7970, 'https://www.webcamtaxi.com/en/usa/texas/dallas-skyline.html'),
		createFallbackWebcam('austin-congress', 'Congress Avenue, Austin', 'Austin', 'US', 30.2672, -97.7431, 'https://www.webcamtaxi.com/en/usa/texas/austin-congress.html'),
		createFallbackWebcam('portland-pioneer', 'Pioneer Square, Portland', 'Portland', 'US', 45.5152, -122.6784, 'https://www.webcamtaxi.com/en/usa/oregon/portland-pioneer.html'),
		createFallbackWebcam('minneapolis-skyline', 'Minneapolis Skyline', 'Minneapolis', 'US', 44.9778, -93.2650, 'https://www.webcamtaxi.com/en/usa/minnesota/minneapolis-skyline.html'),
		createFallbackWebcam('detroit-downtown', 'Downtown Detroit', 'Detroit', 'US', 42.3314, -83.0458, 'https://www.webcamtaxi.com/en/usa/michigan/detroit-downtown.html'),
		createFallbackWebcam('philadelphia-city-hall', 'City Hall, Philadelphia', 'Philadelphia', 'US', 39.9526, -75.1652, 'https://www.webcamtaxi.com/en/usa/pennsylvania/philadelphia-city-hall.html'),
		createFallbackWebcam('san-antonio-riverwalk', 'River Walk, San Antonio', 'San Antonio', 'US', 29.4241, -98.4936, 'https://www.webcamtaxi.com/en/usa/texas/san-antonio-riverwalk.html'),
	],
};

/**
 * Check if a URL is a YouTube embed URL (these work in iframes)
 */
function isYouTubeEmbed(url: string): boolean {
	return url.includes('youtube.com/embed') || url.includes('youtu.be');
}

/**
 * Helper to create a fallback webcam object
 * Non-YouTube URLs are marked as externalOnly since they can't be embedded
 */
function createFallbackWebcam(
	id: string,
	title: string,
	city: string,
	countryCode: string,
	lat: number,
	lon: number,
	embedUrl: string
): Webcam {
	// Only YouTube embeds can be reliably embedded in iframes
	// Other sites (EarthCam, WebcamTaxi, SkylineWebcams) block iframe embedding
	const canEmbed = isYouTubeEmbed(embedUrl);

	return {
		webcamId: id,
		title,
		viewCount: 0,
		status: 'active',
		lastUpdatedOn: new Date().toISOString(),
		location: {
			city,
			region: '',
			regionCode: '',
			country: countryCode,
			countryCode,
			continent: '',
			latitude: lat,
			longitude: lon
		},
		images: {
			current: {
				icon: `https://images.webcams.travel/thumbnail/${id}.jpg`,
				thumbnail: `https://images.webcams.travel/thumbnail/${id}.jpg`,
				preview: `https://images.webcams.travel/preview/${id}.jpg`,
				toenail: `https://images.webcams.travel/toenail/${id}.jpg`
			},
			sizes: {
				icon: { width: 48, height: 48 },
				thumbnail: { width: 200, height: 112 },
				preview: { width: 400, height: 224 },
				toenail: { width: 80, height: 45 }
			}
		},
		player: {
			live: { available: canEmbed, embed: canEmbed ? embedUrl : '' },
			day: { available: false, embed: '' },
			month: { available: false, embed: '' },
			year: { available: false, embed: '' },
			lifetime: { available: false, embed: '' }
		},
		urls: {
			detail: embedUrl,
			edit: ''
		},
		externalOnly: !canEmbed
	};
}

/**
 * Strategic webcams - curated YouTube Live streams for geopolitically important locations
 * These are actual live streams, not timelapse like Windy
 */
export interface StrategicWebcam extends Webcam {
	strategicCategory: 'conflict' | 'chokepoint' | 'capital' | 'port' | 'border' | 'infrastructure';
	threatLevel: 'critical' | 'high' | 'elevated' | 'low';
	relatedHotspot?: string; // Links to hotspot in map config
}

/**
 * Create a strategic webcam with additional metadata
 */
function createStrategicWebcam(
	id: string,
	title: string,
	city: string,
	countryCode: string,
	lat: number,
	lon: number,
	youtubeUrl: string,
	category: StrategicWebcam['strategicCategory'],
	threatLevel: StrategicWebcam['threatLevel'],
	relatedHotspot?: string
): StrategicWebcam {
	const base = createFallbackWebcam(id, title, city, countryCode, lat, lon, youtubeUrl);
	return {
		...base,
		strategicCategory: category,
		threatLevel,
		relatedHotspot
	};
}

/**
 * Curated strategic webcams - YouTube Live streams for intelligence/situational awareness
 * These provide actual live footage, not Windy timelapse
 */
export const STRATEGIC_WEBCAMS: StrategicWebcam[] = [
	// CONFLICT ZONES
	createStrategicWebcam(
		'kyiv-maidan-live',
		'Kyiv Maidan Square (Live)',
		'Kyiv',
		'UA',
		50.4501,
		30.5234,
		'https://www.youtube.com/embed/iZebYm-nenY?autoplay=1&mute=1',
		'conflict',
		'critical',
		'Kyiv'
	),
	createStrategicWebcam(
		'kyiv-khreshchatyk-live',
		'Kyiv Khreshchatyk Street (Live)',
		'Kyiv',
		'UA',
		50.4500,
		30.5236,
		'https://www.youtube.com/embed/2cyQPN5xQPM?autoplay=1&mute=1',
		'conflict',
		'critical',
		'Kyiv'
	),
	createStrategicWebcam(
		'odesa-port-live',
		'Odesa Port Area (Live)',
		'Odesa',
		'UA',
		46.4825,
		30.7233,
		'https://www.youtube.com/embed/K5V_qg2xLsg?autoplay=1&mute=1',
		'port',
		'high',
		'Kyiv'
	),
	createStrategicWebcam(
		'tel-aviv-live',
		'Tel Aviv Skyline (Live)',
		'Tel Aviv',
		'IL',
		32.0853,
		34.7818,
		'https://www.youtube.com/embed/xWdRK_mXGHE?autoplay=1&mute=1',
		'conflict',
		'critical',
		'Israel-Gaza'
	),
	createStrategicWebcam(
		'jerusalem-kotel-live',
		'Jerusalem Western Wall (Live)',
		'Jerusalem',
		'IL',
		31.7767,
		35.2345,
		'https://www.youtube.com/embed/pL-CdP_FkLU?autoplay=1&mute=1',
		'conflict',
		'critical',
		'Israel-Gaza'
	),

	// EAST ASIA - STRATEGIC
	createStrategicWebcam(
		'taipei-101-live',
		'Taipei 101 Tower (Live)',
		'Taipei',
		'TW',
		25.0330,
		121.5654,
		'https://www.youtube.com/embed/CmV3TBEh5ug?autoplay=1&mute=1',
		'capital',
		'high',
		'Taipei'
	),
	createStrategicWebcam(
		'tokyo-shibuya-live',
		'Tokyo Shibuya Crossing (Live)',
		'Tokyo',
		'JP',
		35.6595,
		139.7004,
		'https://www.youtube.com/embed/DjdUEyjx8GM?autoplay=1&mute=1',
		'capital',
		'elevated',
		'Tokyo'
	),
	createStrategicWebcam(
		'seoul-gangnam-live',
		'Seoul Gangnam (Live)',
		'Seoul',
		'KR',
		37.4979,
		127.0276,
		'https://www.youtube.com/embed/gFRtAAmiFbE?autoplay=1&mute=1',
		'capital',
		'elevated'
	),

	// CHOKEPOINTS & PORTS
	createStrategicWebcam(
		'singapore-marina-live',
		'Singapore Marina Bay (Live)',
		'Singapore',
		'SG',
		1.2838,
		103.8591,
		'https://www.youtube.com/embed/SLDNRGPcjKo?autoplay=1&mute=1',
		'chokepoint',
		'high',
		'Malacca Strait'
	),
	createStrategicWebcam(
		'hong-kong-harbour-live',
		'Hong Kong Victoria Harbour (Live)',
		'Hong Kong',
		'HK',
		22.2855,
		114.1577,
		'https://www.youtube.com/embed/4rkjI5oqSpA?autoplay=1&mute=1',
		'port',
		'high'
	),
	createStrategicWebcam(
		'dubai-palm-live',
		'Dubai Palm Jumeirah (Live)',
		'Dubai',
		'AE',
		25.1124,
		55.1390,
		'https://www.youtube.com/embed/Y6PqrMtFUhA?autoplay=1&mute=1',
		'port',
		'elevated',
		'Hormuz'
	),

	// EUROPEAN CAPITALS
	createStrategicWebcam(
		'london-parliament-live',
		'London Parliament (Live)',
		'London',
		'GB',
		51.5007,
		-0.1246,
		'https://www.youtube.com/embed/9VYL5TtQXHw?autoplay=1&mute=1',
		'capital',
		'low'
	),
	createStrategicWebcam(
		'paris-eiffel-live',
		'Paris Eiffel Tower (Live)',
		'Paris',
		'FR',
		48.8584,
		2.2945,
		'https://www.youtube.com/embed/vHGqaNt0yAQ?autoplay=1&mute=1',
		'capital',
		'low'
	),
	createStrategicWebcam(
		'berlin-brandenburg-live',
		'Berlin Brandenburg Gate (Live)',
		'Berlin',
		'DE',
		52.5163,
		13.3777,
		'https://www.youtube.com/embed/w4Oy4Kz0P3Q?autoplay=1&mute=1',
		'capital',
		'low'
	),
	createStrategicWebcam(
		'moscow-red-square-live',
		'Moscow Red Square (Live)',
		'Moscow',
		'RU',
		55.7539,
		37.6208,
		'https://www.youtube.com/embed/FqXAd1INRCM?autoplay=1&mute=1',
		'capital',
		'high'
	),

	// US STRATEGIC
	createStrategicWebcam(
		'dc-capitol-live',
		'Washington DC Capitol (Live)',
		'Washington',
		'US',
		38.8899,
		-77.0091,
		'https://www.youtube.com/embed/mJGtLhiZJXg?autoplay=1&mute=1',
		'capital',
		'elevated'
	),
	createStrategicWebcam(
		'nyc-times-square-live',
		'New York Times Square (Live)',
		'New York',
		'US',
		40.758,
		-73.9855,
		'https://www.youtube.com/embed/1-iS7LArMPA?autoplay=1&mute=1',
		'infrastructure',
		'low'
	),

	// MIDDLE EAST
	createStrategicWebcam(
		'mecca-kaaba-live',
		'Mecca Kaaba (Live)',
		'Mecca',
		'SA',
		21.4225,
		39.8262,
		'https://www.youtube.com/embed/KYS8k9XFM4o?autoplay=1&mute=1',
		'infrastructure',
		'elevated'
	),

	// BORDER REGIONS
	createStrategicWebcam(
		'niagara-falls-live',
		'Niagara Falls US-Canada Border (Live)',
		'Niagara Falls',
		'US',
		43.0896,
		-79.0849,
		'https://www.youtube.com/embed/6s2i1tqAQcs?autoplay=1&mute=1',
		'border',
		'low'
	)
];

/**
 * Get strategic webcams by category
 */
export function getStrategicWebcamsByCategory(category: StrategicWebcam['strategicCategory']): StrategicWebcam[] {
	return STRATEGIC_WEBCAMS.filter(w => w.strategicCategory === category);
}

/**
 * Get strategic webcams by threat level
 */
export function getStrategicWebcamsByThreatLevel(level: StrategicWebcam['threatLevel']): StrategicWebcam[] {
	return STRATEGIC_WEBCAMS.filter(w => w.threatLevel === level);
}

/**
 * Get strategic webcams for a specific hotspot
 */
export function getStrategicWebcamsForHotspot(hotspotName: string): StrategicWebcam[] {
	return STRATEGIC_WEBCAMS.filter(w => w.relatedHotspot === hotspotName);
}

/**
 * Get all strategic webcams sorted by threat level
 */
export function getAllStrategicWebcams(): StrategicWebcam[] {
	const order = { critical: 0, high: 1, elevated: 2, low: 3 };
	return [...STRATEGIC_WEBCAMS].sort((a, b) => order[a.threatLevel] - order[b.threatLevel]);
}

/**
 * Clear webcam cache (useful when refreshing)
 */
export function clearWebcamCache(): void {
	webcamCache.clear();
}

// =============================================================================
// DOT (Department of Transportation) TRAFFIC WEBCAMS
// =============================================================================

/** DOT webcam category types */
export type DOTWebcamCategory = 'highway' | 'bridge' | 'tunnel' | 'border' | 'port';

/** US region types for DOT webcams */
export type DOTWebcamRegion = 'california' | 'texas' | 'florida' | 'new_york' | 'federal' | 'other';

/** DOT Traffic webcam with transportation-specific metadata */
export interface DOTWebcam extends Webcam {
	/** Category of transportation infrastructure */
	dotCategory: DOTWebcamCategory;
	/** US state/region */
	dotRegion: DOTWebcamRegion;
	/** Route/highway designation (e.g., "I-95", "US-101") */
	routeDesignation?: string;
	/** Direction of traffic view (e.g., "NB", "SB", "EB", "WB") */
	direction?: string;
	/** Whether this is an image refresh camera (not live video) */
	isImageRefresh: boolean;
	/** Refresh interval in seconds for image-based cameras */
	refreshInterval?: number;
	/** DOT source agency */
	sourceAgency: string;
}

/**
 * Create a DOT traffic webcam
 */
function createDOTWebcam(
	id: string,
	title: string,
	city: string,
	state: string,
	lat: number,
	lon: number,
	url: string,
	category: DOTWebcamCategory,
	region: DOTWebcamRegion,
	sourceAgency: string,
	isImageRefresh: boolean = false,
	routeDesignation?: string,
	direction?: string,
	refreshInterval?: number
): DOTWebcam {
	// DOT cameras often use image refresh, not live video
	// Image URLs can be embedded, video streams may require external viewing
	const canEmbed = !isImageRefresh || url.includes('youtube.com') || url.includes('.jpg') || url.includes('.png');

	return {
		webcamId: `dot-${id}`,
		title,
		viewCount: 0,
		status: 'active',
		lastUpdatedOn: new Date().toISOString(),
		location: {
			city,
			region: state,
			regionCode: state,
			country: 'US',
			countryCode: 'US',
			continent: 'North America',
			latitude: lat,
			longitude: lon
		},
		images: {
			current: {
				icon: isImageRefresh ? url : `https://images.webcams.travel/thumbnail/${id}.jpg`,
				thumbnail: isImageRefresh ? url : `https://images.webcams.travel/thumbnail/${id}.jpg`,
				preview: isImageRefresh ? url : `https://images.webcams.travel/preview/${id}.jpg`,
				toenail: isImageRefresh ? url : `https://images.webcams.travel/toenail/${id}.jpg`
			},
			sizes: {
				icon: { width: 48, height: 48 },
				thumbnail: { width: 200, height: 112 },
				preview: { width: 400, height: 224 },
				toenail: { width: 80, height: 45 }
			}
		},
		player: {
			live: { available: canEmbed && !isImageRefresh, embed: canEmbed && !isImageRefresh ? url : '' },
			day: { available: false, embed: '' },
			month: { available: false, embed: '' },
			year: { available: false, embed: '' },
			lifetime: { available: false, embed: '' }
		},
		urls: {
			detail: url,
			edit: ''
		},
		externalOnly: !canEmbed,
		// DOT-specific fields
		dotCategory: category,
		dotRegion: region,
		routeDesignation,
		direction,
		isImageRefresh,
		refreshInterval: isImageRefresh ? (refreshInterval || 60) : undefined,
		sourceAgency
	};
}

/**
 * DOT Traffic Webcams - Government-provided traffic cameras
 * These are free, publicly available cameras from various DOT agencies
 * Many use image refresh (not live video) updated every 30-120 seconds
 */
export const DOT_TRAFFIC_WEBCAMS: DOTWebcam[] = [
	// ==========================================================================
	// FEDERAL / US DOT - Major Interstate Highways & Critical Infrastructure
	// ==========================================================================

	// I-95 Corridor (East Coast Main Artery)
	createDOTWebcam(
		'i95-miami-golden-glades',
		'I-95 @ Golden Glades Interchange, Miami',
		'Miami',
		'FL',
		25.9131,
		-80.1869,
		'https://fl511.com/map/Ede92fCameras',
		'highway',
		'federal',
		'Florida DOT',
		true,
		'I-95',
		'NB/SB',
		60
	),
	createDOTWebcam(
		'i95-jacksonville-i10',
		'I-95 @ I-10 Interchange, Jacksonville',
		'Jacksonville',
		'FL',
		30.3254,
		-81.6568,
		'https://fl511.com/map/Cameras',
		'highway',
		'federal',
		'Florida DOT',
		true,
		'I-95/I-10',
		'All',
		60
	),
	createDOTWebcam(
		'i95-dc-beltway',
		'I-95/I-495 Capital Beltway, Washington DC',
		'Washington',
		'DC',
		38.8478,
		-77.0402,
		'https://www.511virginia.org/',
		'highway',
		'federal',
		'Virginia DOT',
		true,
		'I-95/I-495',
		'All',
		60
	),
	createDOTWebcam(
		'i95-new-jersey-turnpike',
		'I-95 NJ Turnpike @ Newark Airport',
		'Newark',
		'NJ',
		40.6895,
		-74.1745,
		'https://511nj.org/home',
		'highway',
		'federal',
		'NJ Turnpike Authority',
		true,
		'I-95/NJTP',
		'NB/SB',
		60
	),
	createDOTWebcam(
		'i95-george-washington-bridge',
		'I-95 @ George Washington Bridge',
		'Fort Lee',
		'NJ',
		40.8517,
		-73.9527,
		'https://511ny.org/',
		'bridge',
		'federal',
		'Port Authority NY/NJ',
		true,
		'I-95',
		'EB/WB',
		30
	),
	createDOTWebcam(
		'i95-cross-bronx',
		'I-95 Cross Bronx Expressway',
		'Bronx',
		'NY',
		40.8397,
		-73.8839,
		'https://511ny.org/',
		'highway',
		'federal',
		'NY DOT',
		true,
		'I-95',
		'EB/WB',
		60
	),
	createDOTWebcam(
		'i95-connecticut-i91',
		'I-95 @ I-91 Interchange, New Haven',
		'New Haven',
		'CT',
		41.2982,
		-72.9291,
		'https://www.ctroads.org/',
		'highway',
		'federal',
		'Connecticut DOT',
		true,
		'I-95/I-91',
		'All',
		60
	),
	createDOTWebcam(
		'i95-boston-tunnel',
		'I-93/I-95 Central Artery Tunnel, Boston',
		'Boston',
		'MA',
		42.3534,
		-71.0505,
		'https://mass511.com/',
		'tunnel',
		'federal',
		'MassDOT',
		true,
		'I-93/I-95',
		'NB/SB',
		60
	),

	// I-10 Corridor (Southern Transcontinental)
	createDOTWebcam(
		'i10-los-angeles-downtown',
		'I-10 @ Downtown Los Angeles',
		'Los Angeles',
		'CA',
		34.0407,
		-118.2468,
		'https://cwwp2.dot.ca.gov/vm/streamlist.htm',
		'highway',
		'federal',
		'Caltrans',
		true,
		'I-10',
		'EB/WB',
		60
	),
	createDOTWebcam(
		'i10-phoenix-i17',
		'I-10 @ I-17 Stack Interchange, Phoenix',
		'Phoenix',
		'AZ',
		33.4484,
		-112.0740,
		'https://az511.gov/map',
		'highway',
		'federal',
		'Arizona DOT',
		true,
		'I-10/I-17',
		'All',
		60
	),
	createDOTWebcam(
		'i10-el-paso-border',
		'I-10 @ El Paso/Juarez Border Area',
		'El Paso',
		'TX',
		31.7587,
		-106.4869,
		'https://drivetexas.org/',
		'border',
		'federal',
		'Texas DOT',
		true,
		'I-10',
		'EB/WB',
		60
	),
	createDOTWebcam(
		'i10-san-antonio-i35',
		'I-10 @ I-35 Interchange, San Antonio',
		'San Antonio',
		'TX',
		29.4241,
		-98.4936,
		'https://drivetexas.org/',
		'highway',
		'federal',
		'Texas DOT',
		true,
		'I-10/I-35',
		'All',
		60
	),
	createDOTWebcam(
		'i10-houston-i45',
		'I-10 @ I-45 Downtown Houston',
		'Houston',
		'TX',
		29.7604,
		-95.3698,
		'https://drivetexas.org/',
		'highway',
		'federal',
		'Texas DOT',
		true,
		'I-10/I-45',
		'All',
		60
	),
	createDOTWebcam(
		'i10-new-orleans-i610',
		'I-10 @ I-610 Interchange, New Orleans',
		'New Orleans',
		'LA',
		29.9876,
		-90.0535,
		'https://511la.org/',
		'highway',
		'federal',
		'Louisiana DOTD',
		true,
		'I-10/I-610',
		'All',
		60
	),

	// Critical Bridges
	createDOTWebcam(
		'golden-gate-bridge',
		'Golden Gate Bridge, San Francisco',
		'San Francisco',
		'CA',
		37.8199,
		-122.4783,
		'https://goldengate.org/bridge/bridge-cameras/',
		'bridge',
		'federal',
		'Golden Gate Bridge District',
		true,
		'US-101',
		'NB/SB',
		30
	),
	createDOTWebcam(
		'bay-bridge-sf',
		'Bay Bridge @ San Francisco',
		'San Francisco',
		'CA',
		37.7983,
		-122.3778,
		'https://cwwp2.dot.ca.gov/vm/streamlist.htm',
		'bridge',
		'federal',
		'Caltrans',
		true,
		'I-80',
		'EB/WB',
		30
	),
	createDOTWebcam(
		'verrazano-bridge',
		'Verrazano-Narrows Bridge, Brooklyn',
		'Brooklyn',
		'NY',
		40.6066,
		-74.0447,
		'https://www.mta.info/bridges-tunnels',
		'bridge',
		'federal',
		'MTA Bridges & Tunnels',
		true,
		'I-278',
		'EB/WB',
		60
	),
	createDOTWebcam(
		'chesapeake-bay-bridge',
		'Chesapeake Bay Bridge, Annapolis',
		'Annapolis',
		'MD',
		38.9926,
		-76.3852,
		'https://baybridge.maryland.gov/cameras',
		'bridge',
		'federal',
		'Maryland Transportation Authority',
		true,
		'US-50/301',
		'EB/WB',
		30
	),
	createDOTWebcam(
		'mackinac-bridge',
		'Mackinac Bridge, Mackinaw City',
		'Mackinaw City',
		'MI',
		45.8174,
		-84.7278,
		'https://www.mackinacbridge.org/bridge-cameras/',
		'bridge',
		'federal',
		'Mackinac Bridge Authority',
		true,
		'I-75',
		'NB/SB',
		60
	),

	// US-Mexico Border Crossings
	createDOTWebcam(
		'san-ysidro-border',
		'San Ysidro Port of Entry, Tijuana Border',
		'San Ysidro',
		'CA',
		32.5423,
		-117.0328,
		'https://cwwp2.dot.ca.gov/vm/streamlist.htm',
		'border',
		'federal',
		'Caltrans/CBP',
		true,
		'I-5',
		'SB',
		60
	),
	createDOTWebcam(
		'otay-mesa-border',
		'Otay Mesa Commercial Port of Entry',
		'San Diego',
		'CA',
		32.5501,
		-116.9389,
		'https://cwwp2.dot.ca.gov/vm/streamlist.htm',
		'border',
		'federal',
		'Caltrans/CBP',
		true,
		'SR-905',
		'SB',
		60
	),
	createDOTWebcam(
		'laredo-border-i35',
		'Laredo World Trade Bridge, I-35 Border',
		'Laredo',
		'TX',
		27.5066,
		-99.5075,
		'https://drivetexas.org/',
		'border',
		'federal',
		'Texas DOT/CBP',
		true,
		'I-35',
		'SB',
		60
	),
	createDOTWebcam(
		'brownsville-border',
		'Brownsville Gateway International Bridge',
		'Brownsville',
		'TX',
		25.9017,
		-97.4975,
		'https://drivetexas.org/',
		'border',
		'federal',
		'Texas DOT/CBP',
		true,
		'US-77',
		'SB',
		60
	),

	// US-Canada Border Crossings
	createDOTWebcam(
		'ambassador-bridge-detroit',
		'Ambassador Bridge, Detroit-Windsor',
		'Detroit',
		'MI',
		42.3117,
		-83.0736,
		'https://mdotjboss.state.mi.us/MiDrive/cameras.html',
		'border',
		'federal',
		'Michigan DOT/CBP',
		true,
		'I-75',
		'SB',
		60
	),
	createDOTWebcam(
		'peace-bridge-buffalo',
		'Peace Bridge, Buffalo-Fort Erie',
		'Buffalo',
		'NY',
		42.9069,
		-78.9044,
		'https://511ny.org/',
		'border',
		'federal',
		'Peace Bridge Authority',
		true,
		'I-190',
		'NB/SB',
		60
	),
	createDOTWebcam(
		'blaine-border-i5',
		'Blaine Peace Arch Border, I-5',
		'Blaine',
		'WA',
		49.0024,
		-122.7585,
		'https://wsdot.com/travel/real-time/cameras',
		'border',
		'federal',
		'Washington DOT/CBP',
		true,
		'I-5',
		'NB',
		60
	),

	// Major Port Approaches
	createDOTWebcam(
		'port-of-la-terminal-island',
		'Port of Los Angeles, Terminal Island',
		'Long Beach',
		'CA',
		33.7540,
		-118.2620,
		'https://cwwp2.dot.ca.gov/vm/streamlist.htm',
		'port',
		'federal',
		'Caltrans',
		true,
		'I-710',
		'SB',
		60
	),
	createDOTWebcam(
		'port-of-houston-ship-channel',
		'Port of Houston Ship Channel Bridge',
		'Houston',
		'TX',
		29.7354,
		-95.0775,
		'https://drivetexas.org/',
		'port',
		'federal',
		'Texas DOT',
		true,
		'SH-225',
		'EB/WB',
		60
	),
	createDOTWebcam(
		'port-of-savannah-i16',
		'Port of Savannah, I-16 Approach',
		'Savannah',
		'GA',
		32.0809,
		-81.0912,
		'https://511ga.org/',
		'port',
		'federal',
		'Georgia DOT',
		true,
		'I-16',
		'EB',
		60
	),
	createDOTWebcam(
		'port-newark-nj-turnpike',
		'Port Newark, NJ Turnpike Exit 14',
		'Newark',
		'NJ',
		40.6845,
		-74.1502,
		'https://511nj.org/',
		'port',
		'federal',
		'NJ Turnpike Authority',
		true,
		'I-95',
		'All',
		60
	),

	// ==========================================================================
	// CALIFORNIA - CALTRANS
	// ==========================================================================

	// Los Angeles Metro
	createDOTWebcam(
		'ca-i405-sepulveda-pass',
		'I-405 Sepulveda Pass, Los Angeles',
		'Los Angeles',
		'CA',
		34.0908,
		-118.4686,
		'https://cwwp2.dot.ca.gov/vm/streamlist.htm',
		'highway',
		'california',
		'Caltrans District 7',
		true,
		'I-405',
		'NB/SB',
		60
	),
	createDOTWebcam(
		'ca-i405-lax',
		'I-405 @ LAX Airport',
		'Los Angeles',
		'CA',
		33.9425,
		-118.4081,
		'https://cwwp2.dot.ca.gov/vm/streamlist.htm',
		'highway',
		'california',
		'Caltrans District 7',
		true,
		'I-405',
		'NB/SB',
		60
	),
	createDOTWebcam(
		'ca-i110-downtown-la',
		'I-110 Harbor Freeway, Downtown LA',
		'Los Angeles',
		'CA',
		34.0195,
		-118.2779,
		'https://cwwp2.dot.ca.gov/vm/streamlist.htm',
		'highway',
		'california',
		'Caltrans District 7',
		true,
		'I-110',
		'NB/SB',
		60
	),
	createDOTWebcam(
		'ca-us101-hollywood',
		'US-101 Hollywood Freeway',
		'Los Angeles',
		'CA',
		34.0928,
		-118.3287,
		'https://cwwp2.dot.ca.gov/vm/streamlist.htm',
		'highway',
		'california',
		'Caltrans District 7',
		true,
		'US-101',
		'NB/SB',
		60
	),
	createDOTWebcam(
		'ca-i5-grapevine',
		'I-5 Grapevine, Tejon Pass',
		'Lebec',
		'CA',
		34.8384,
		-118.8847,
		'https://cwwp2.dot.ca.gov/vm/streamlist.htm',
		'highway',
		'california',
		'Caltrans District 7',
		true,
		'I-5',
		'NB/SB',
		60
	),

	// San Francisco Bay Area
	createDOTWebcam(
		'ca-i80-bay-bridge-toll',
		'I-80 Bay Bridge Toll Plaza',
		'Oakland',
		'CA',
		37.8161,
		-122.3186,
		'https://cwwp2.dot.ca.gov/vm/streamlist.htm',
		'bridge',
		'california',
		'Caltrans District 4',
		true,
		'I-80',
		'WB',
		30
	),
	createDOTWebcam(
		'ca-us101-sf-downtown',
		'US-101 @ Downtown San Francisco',
		'San Francisco',
		'CA',
		37.7803,
		-122.4053,
		'https://cwwp2.dot.ca.gov/vm/streamlist.htm',
		'highway',
		'california',
		'Caltrans District 4',
		true,
		'US-101',
		'NB/SB',
		60
	),
	createDOTWebcam(
		'ca-i280-sf',
		'I-280 @ San Jose Ave, San Francisco',
		'San Francisco',
		'CA',
		37.7328,
		-122.4535,
		'https://cwwp2.dot.ca.gov/vm/streamlist.htm',
		'highway',
		'california',
		'Caltrans District 4',
		true,
		'I-280',
		'NB/SB',
		60
	),
	createDOTWebcam(
		'ca-i880-oakland',
		'I-880 Nimitz Freeway, Oakland',
		'Oakland',
		'CA',
		37.7513,
		-122.1966,
		'https://cwwp2.dot.ca.gov/vm/streamlist.htm',
		'highway',
		'california',
		'Caltrans District 4',
		true,
		'I-880',
		'NB/SB',
		60
	),
	createDOTWebcam(
		'ca-i680-walnut-creek',
		'I-680 @ Walnut Creek',
		'Walnut Creek',
		'CA',
		37.9101,
		-122.0652,
		'https://cwwp2.dot.ca.gov/vm/streamlist.htm',
		'highway',
		'california',
		'Caltrans District 4',
		true,
		'I-680',
		'NB/SB',
		60
	),

	// San Diego
	createDOTWebcam(
		'ca-i5-downtown-sd',
		'I-5 @ Downtown San Diego',
		'San Diego',
		'CA',
		32.7157,
		-117.1611,
		'https://cwwp2.dot.ca.gov/vm/streamlist.htm',
		'highway',
		'california',
		'Caltrans District 11',
		true,
		'I-5',
		'NB/SB',
		60
	),
	createDOTWebcam(
		'ca-i15-escondido',
		'I-15 @ Escondido',
		'Escondido',
		'CA',
		33.1192,
		-117.0864,
		'https://cwwp2.dot.ca.gov/vm/streamlist.htm',
		'highway',
		'california',
		'Caltrans District 11',
		true,
		'I-15',
		'NB/SB',
		60
	),
	createDOTWebcam(
		'ca-i8-mission-valley',
		'I-8 @ Mission Valley, San Diego',
		'San Diego',
		'CA',
		32.7680,
		-117.1540,
		'https://cwwp2.dot.ca.gov/vm/streamlist.htm',
		'highway',
		'california',
		'Caltrans District 11',
		true,
		'I-8',
		'EB/WB',
		60
	),
	createDOTWebcam(
		'ca-coronado-bridge',
		'San Diego-Coronado Bridge',
		'San Diego',
		'CA',
		32.6858,
		-117.1539,
		'https://cwwp2.dot.ca.gov/vm/streamlist.htm',
		'bridge',
		'california',
		'Caltrans District 11',
		true,
		'SR-75',
		'EB/WB',
		60
	),

	// ==========================================================================
	// TEXAS - TXDOT
	// ==========================================================================

	// Dallas-Fort Worth
	createDOTWebcam(
		'tx-i35e-downtown-dallas',
		'I-35E @ Downtown Dallas',
		'Dallas',
		'TX',
		32.7767,
		-96.7970,
		'https://drivetexas.org/',
		'highway',
		'texas',
		'TxDOT Dallas District',
		true,
		'I-35E',
		'NB/SB',
		60
	),
	createDOTWebcam(
		'tx-i635-lbj-freeway',
		'I-635 LBJ Freeway @ I-35E',
		'Dallas',
		'TX',
		32.8998,
		-96.8719,
		'https://drivetexas.org/',
		'highway',
		'texas',
		'TxDOT Dallas District',
		true,
		'I-635/I-35E',
		'All',
		60
	),
	createDOTWebcam(
		'tx-i30-downtown-ft-worth',
		'I-30 @ Downtown Fort Worth',
		'Fort Worth',
		'TX',
		32.7555,
		-97.3308,
		'https://drivetexas.org/',
		'highway',
		'texas',
		'TxDOT Fort Worth District',
		true,
		'I-30',
		'EB/WB',
		60
	),
	createDOTWebcam(
		'tx-i820-loop',
		'I-820 Loop @ I-35W, Fort Worth',
		'Fort Worth',
		'TX',
		32.8014,
		-97.3579,
		'https://drivetexas.org/',
		'highway',
		'texas',
		'TxDOT Fort Worth District',
		true,
		'I-820/I-35W',
		'All',
		60
	),

	// Houston
	createDOTWebcam(
		'tx-i610-loop-houston',
		'I-610 Loop @ I-10, Houston',
		'Houston',
		'TX',
		29.7604,
		-95.4393,
		'https://drivetexas.org/',
		'highway',
		'texas',
		'TxDOT Houston District',
		true,
		'I-610/I-10',
		'All',
		60
	),
	createDOTWebcam(
		'tx-i45-downtown-houston',
		'I-45 Gulf Freeway, Downtown Houston',
		'Houston',
		'TX',
		29.7604,
		-95.3698,
		'https://drivetexas.org/',
		'highway',
		'texas',
		'TxDOT Houston District',
		true,
		'I-45',
		'NB/SB',
		60
	),
	createDOTWebcam(
		'tx-us290-houston',
		'US-290 Northwest Freeway, Houston',
		'Houston',
		'TX',
		29.8133,
		-95.4959,
		'https://drivetexas.org/',
		'highway',
		'texas',
		'TxDOT Houston District',
		true,
		'US-290',
		'EB/WB',
		60
	),
	createDOTWebcam(
		'tx-i69-houston-ship-channel',
		'I-69/US-59 @ Houston Ship Channel',
		'Houston',
		'TX',
		29.7513,
		-95.1075,
		'https://drivetexas.org/',
		'port',
		'texas',
		'TxDOT Houston District',
		true,
		'I-69',
		'NB/SB',
		60
	),

	// Austin & San Antonio
	createDOTWebcam(
		'tx-i35-downtown-austin',
		'I-35 @ Downtown Austin',
		'Austin',
		'TX',
		30.2672,
		-97.7431,
		'https://drivetexas.org/',
		'highway',
		'texas',
		'TxDOT Austin District',
		true,
		'I-35',
		'NB/SB',
		60
	),
	createDOTWebcam(
		'tx-mopac-austin',
		'MoPac (Loop 1) @ US-290, Austin',
		'Austin',
		'TX',
		30.3177,
		-97.8057,
		'https://drivetexas.org/',
		'highway',
		'texas',
		'TxDOT Austin District',
		true,
		'Loop 1',
		'NB/SB',
		60
	),
	createDOTWebcam(
		'tx-i410-loop-sa',
		'I-410 Loop @ I-10, San Antonio',
		'San Antonio',
		'TX',
		29.5174,
		-98.5242,
		'https://drivetexas.org/',
		'highway',
		'texas',
		'TxDOT San Antonio District',
		true,
		'I-410/I-10',
		'All',
		60
	),

	// ==========================================================================
	// FLORIDA - FDOT
	// ==========================================================================

	// Miami
	createDOTWebcam(
		'fl-i95-downtown-miami',
		'I-95 @ Downtown Miami',
		'Miami',
		'FL',
		25.7617,
		-80.1918,
		'https://fl511.com/',
		'highway',
		'florida',
		'FDOT District 6',
		true,
		'I-95',
		'NB/SB',
		60
	),
	createDOTWebcam(
		'fl-i395-macarthur-causeway',
		'I-395 MacArthur Causeway, Miami Beach',
		'Miami Beach',
		'FL',
		25.7808,
		-80.1697,
		'https://fl511.com/',
		'bridge',
		'florida',
		'FDOT District 6',
		true,
		'I-395',
		'EB/WB',
		60
	),
	createDOTWebcam(
		'fl-sr836-dolphin-expwy',
		'SR-836 Dolphin Expressway, Miami',
		'Miami',
		'FL',
		25.7766,
		-80.2367,
		'https://fl511.com/',
		'highway',
		'florida',
		'FDOT District 6',
		true,
		'SR-836',
		'EB/WB',
		60
	),
	createDOTWebcam(
		'fl-port-miami-tunnel',
		'Port of Miami Tunnel',
		'Miami',
		'FL',
		25.7698,
		-80.1651,
		'https://fl511.com/',
		'tunnel',
		'florida',
		'FDOT District 6',
		true,
		'Port Tunnel',
		'EB/WB',
		60
	),

	// Orlando & Tampa
	createDOTWebcam(
		'fl-i4-downtown-orlando',
		'I-4 @ Downtown Orlando',
		'Orlando',
		'FL',
		28.5383,
		-81.3792,
		'https://fl511.com/',
		'highway',
		'florida',
		'FDOT District 5',
		true,
		'I-4',
		'EB/WB',
		60
	),
	createDOTWebcam(
		'fl-sr408-east-west-expwy',
		'SR-408 East-West Expressway, Orlando',
		'Orlando',
		'FL',
		28.5450,
		-81.3789,
		'https://fl511.com/',
		'highway',
		'florida',
		'FDOT District 5',
		true,
		'SR-408',
		'EB/WB',
		60
	),
	createDOTWebcam(
		'fl-i275-downtown-tampa',
		'I-275 @ Downtown Tampa',
		'Tampa',
		'FL',
		27.9506,
		-82.4572,
		'https://fl511.com/',
		'highway',
		'florida',
		'FDOT District 7',
		true,
		'I-275',
		'NB/SB',
		60
	),
	createDOTWebcam(
		'fl-howard-frankland-bridge',
		'I-275 Howard Frankland Bridge, Tampa Bay',
		'Tampa',
		'FL',
		27.9151,
		-82.5458,
		'https://fl511.com/',
		'bridge',
		'florida',
		'FDOT District 7',
		true,
		'I-275',
		'NB/SB',
		60
	),
	createDOTWebcam(
		'fl-sunshine-skyway-bridge',
		'Sunshine Skyway Bridge, Tampa Bay',
		'St. Petersburg',
		'FL',
		27.6253,
		-82.6533,
		'https://fl511.com/',
		'bridge',
		'florida',
		'FDOT District 7',
		true,
		'I-275',
		'NB/SB',
		30
	),

	// Jacksonville
	createDOTWebcam(
		'fl-i95-downtown-jax',
		'I-95 @ Downtown Jacksonville',
		'Jacksonville',
		'FL',
		30.3322,
		-81.6557,
		'https://fl511.com/',
		'highway',
		'florida',
		'FDOT District 2',
		true,
		'I-95',
		'NB/SB',
		60
	),
	createDOTWebcam(
		'fl-i295-buckman-bridge',
		'I-295 Buckman Bridge, Jacksonville',
		'Jacksonville',
		'FL',
		30.2250,
		-81.6939,
		'https://fl511.com/',
		'bridge',
		'florida',
		'FDOT District 2',
		true,
		'I-295',
		'NB/SB',
		60
	),

	// ==========================================================================
	// NEW YORK - NYSDOT
	// ==========================================================================

	// New York City
	createDOTWebcam(
		'ny-i278-bqe-brooklyn',
		'I-278 Brooklyn-Queens Expressway',
		'Brooklyn',
		'NY',
		40.6922,
		-73.9870,
		'https://511ny.org/',
		'highway',
		'new_york',
		'NYSDOT Region 11',
		true,
		'I-278',
		'EB/WB',
		60
	),
	createDOTWebcam(
		'ny-i495-lie-queens',
		'I-495 Long Island Expressway, Queens',
		'Queens',
		'NY',
		40.7528,
		-73.8650,
		'https://511ny.org/',
		'highway',
		'new_york',
		'NYSDOT Region 10',
		true,
		'I-495',
		'EB/WB',
		60
	),
	createDOTWebcam(
		'ny-holland-tunnel',
		'Holland Tunnel, Manhattan',
		'Manhattan',
		'NY',
		40.7267,
		-74.0112,
		'https://511ny.org/',
		'tunnel',
		'new_york',
		'Port Authority NY/NJ',
		true,
		'I-78',
		'EB/WB',
		60
	),
	createDOTWebcam(
		'ny-lincoln-tunnel',
		'Lincoln Tunnel, Manhattan',
		'Manhattan',
		'NY',
		40.7615,
		-74.0014,
		'https://511ny.org/',
		'tunnel',
		'new_york',
		'Port Authority NY/NJ',
		true,
		'NJ-495',
		'EB/WB',
		60
	),
	createDOTWebcam(
		'ny-tappan-zee-bridge',
		'Mario Cuomo (Tappan Zee) Bridge',
		'Tarrytown',
		'NY',
		41.0700,
		-73.8779,
		'https://511ny.org/',
		'bridge',
		'new_york',
		'NY Thruway Authority',
		true,
		'I-87/I-287',
		'EB/WB',
		30
	),
	createDOTWebcam(
		'ny-i87-thruway-albany',
		'I-87 NY Thruway @ Albany',
		'Albany',
		'NY',
		42.6526,
		-73.7562,
		'https://511ny.org/',
		'highway',
		'new_york',
		'NY Thruway Authority',
		true,
		'I-87',
		'NB/SB',
		60
	),

	// Buffalo
	createDOTWebcam(
		'ny-i90-downtown-buffalo',
		'I-90 NY Thruway @ Downtown Buffalo',
		'Buffalo',
		'NY',
		42.8864,
		-78.8784,
		'https://511ny.org/',
		'highway',
		'new_york',
		'NY Thruway Authority',
		true,
		'I-90',
		'EB/WB',
		60
	),
	createDOTWebcam(
		'ny-i190-niagara-falls',
		'I-190 @ Niagara Falls',
		'Niagara Falls',
		'NY',
		43.0896,
		-79.0566,
		'https://511ny.org/',
		'highway',
		'new_york',
		'NY Thruway Authority',
		true,
		'I-190',
		'NB/SB',
		60
	)
];

/**
 * Get DOT webcams by US region
 */
export function getDOTWebcamsByRegion(region: DOTWebcamRegion): DOTWebcam[] {
	return DOT_TRAFFIC_WEBCAMS.filter(w => w.dotRegion === region);
}

/**
 * Get DOT webcams by category
 */
export function getDOTWebcamsByCategory(category: DOTWebcamCategory): DOTWebcam[] {
	return DOT_TRAFFIC_WEBCAMS.filter(w => w.dotCategory === category);
}

/**
 * Get DOT webcams by state abbreviation
 */
export function getDOTWebcamsByState(stateCode: string): DOTWebcam[] {
	return DOT_TRAFFIC_WEBCAMS.filter(w => w.location.regionCode === stateCode.toUpperCase());
}

/**
 * Get DOT webcams by route designation (e.g., "I-95", "US-101")
 */
export function getDOTWebcamsByRoute(route: string): DOTWebcam[] {
	const normalizedRoute = route.toUpperCase().replace(/\s+/g, '');
	return DOT_TRAFFIC_WEBCAMS.filter(w =>
		w.routeDesignation?.toUpperCase().replace(/\s+/g, '').includes(normalizedRoute)
	);
}

/**
 * Get all DOT webcams that are live video (not image refresh)
 */
export function getLiveDOTWebcams(): DOTWebcam[] {
	return DOT_TRAFFIC_WEBCAMS.filter(w => !w.isImageRefresh);
}

/**
 * Get all DOT webcams sorted by category
 */
export function getAllDOTWebcams(): DOTWebcam[] {
	const categoryOrder: Record<DOTWebcamCategory, number> = {
		border: 0,
		bridge: 1,
		tunnel: 2,
		port: 3,
		highway: 4
	};
	return [...DOT_TRAFFIC_WEBCAMS].sort((a, b) =>
		categoryOrder[a.dotCategory] - categoryOrder[b.dotCategory]
	);
}

/**
 * Get list of countries that have fallback webcams
 */
export function getCountriesWithWebcams(): string[] {
	return Object.keys(FALLBACK_WEBCAMS);
}
