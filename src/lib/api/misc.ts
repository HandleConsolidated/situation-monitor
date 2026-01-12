/**
 * Miscellaneous API functions for specialized panels
 * Real data APIs where possible, with curated fallbacks for APIs requiring auth
 */

export interface Prediction {
	id: string;
	question: string;
	yes: number;
	volume: string;
}

export interface WhaleTransaction {
	coin: string;
	amount: number;
	usd: number;
	hash: string;
}

export interface Contract {
	agency: string;
	description: string;
	vendor: string;
	amount: number;
	url?: string;
	awardDate?: string;
}

export interface Layoff {
	company: string;
	count: number;
	title: string;
	date: string;
}

export interface OutageData {
	id: string;
	country: string;
	countryCode: string;
	type: 'internet' | 'power' | 'both';
	severity: 'partial' | 'major' | 'total';
	lat: number;
	lon: number;
	description: string;
	affectedPopulation?: number;
	startTime?: string;
	source: string;
	active: boolean;
	radiusKm?: number; // Radius for map display based on severity/population
}

/**
 * Fetch Polymarket predictions from their public CLOB API
 * Uses the Gamma Markets API for prediction market data
 */
export async function fetchPolymarket(): Promise<Prediction[]> {
	try {
		// Try Polymarket's Gamma API (public, no auth required)
		const response = await fetch(
			'https://gamma-api.polymarket.com/markets?limit=20&active=true&closed=false&order=volume&ascending=false',
			{
				headers: {
					Accept: 'application/json'
				}
			}
		);

		if (response.ok) {
			const markets = await response.json();
			if (Array.isArray(markets) && markets.length > 0) {
				return markets.slice(0, 7).map(
					(market: {
						id: string;
						question: string;
						outcomePrices?: string;
						volume?: number;
						volumeNum?: number;
					}) => {
						// Parse outcome prices to get "yes" probability
						let yesPrice = 50;
						try {
							if (market.outcomePrices) {
								const prices = JSON.parse(market.outcomePrices);
								yesPrice = Math.round(parseFloat(prices[0]) * 100);
							}
						} catch {
							yesPrice = 50;
						}

						const volume = market.volumeNum || market.volume || 0;
						return {
							id: market.id || `pm-${Math.random().toString(36).substr(2, 9)}`,
							question: market.question || 'Unknown market',
							yes: yesPrice,
							volume: formatVolume(volume)
						};
					}
				);
			}
		}
	} catch (error) {
		console.warn('Polymarket API failed:', error);
	}

	// Try alternative: PredictIt-style or Metaculus
	try {
		const response = await fetch('https://www.metaculus.com/api2/questions/?limit=10&status=open&type=binary&order_by=-activity', {
			headers: { Accept: 'application/json' }
		});

		if (response.ok) {
			const data = await response.json();
			if (data.results && Array.isArray(data.results)) {
				return data.results.slice(0, 7).map(
					(q: { id: number; title: string; community_prediction?: { full?: { q2?: number } }; activity?: number }) => ({
						id: `mc-${q.id}`,
						question: q.title?.substring(0, 80) || 'Unknown question',
						yes: Math.round((q.community_prediction?.full?.q2 || 0.5) * 100),
						volume: formatVolume(q.activity || 0)
					})
				);
			}
		}
	} catch (error) {
		console.warn('Metaculus API failed:', error);
	}

	// Return empty if all APIs fail - no sample data
	console.warn('All prediction market APIs failed, returning empty');
	return [];
}

// Format volume for display
function formatVolume(volume: number): string {
	if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
	if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
	return volume.toString();
}

/**
 * Fetch whale transactions from real blockchain APIs
 * Uses Blockchain.com for BTC and public mempool data
 */
export async function fetchWhaleTransactions(): Promise<WhaleTransaction[]> {
	const whales: WhaleTransaction[] = [];

	try {
		// Fetch BTC price for USD conversion
		const btcPrice = await fetchBTCPrice();

		// Fetch large recent Bitcoin transactions from blockchain.com
		const btcWhales = await fetchBTCWhaleTransactions(btcPrice);
		whales.push(...btcWhales);
	} catch (error) {
		console.warn('BTC whale fetch failed:', error);
	}

	try {
		// Fetch ETH price and large transactions
		const ethPrice = await fetchETHPrice();
		const ethWhales = await fetchETHWhaleTransactions(ethPrice);
		whales.push(...ethWhales);
	} catch (error) {
		console.warn('ETH whale fetch failed:', error);
	}

	// Sort by USD value descending
	whales.sort((a, b) => b.usd - a.usd);

	// Return top 10 whale transactions
	return whales.slice(0, 10);
}

// Fetch current BTC price
async function fetchBTCPrice(): Promise<number> {
	try {
		const response = await fetch(
			'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
		);
		if (!response.ok) throw new Error('CoinGecko API failed');
		const data = await response.json();
		return data.bitcoin?.usd || 100000;
	} catch {
		return 100000; // Fallback price
	}
}

// Fetch current ETH price
async function fetchETHPrice(): Promise<number> {
	try {
		const response = await fetch(
			'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
		);
		if (!response.ok) throw new Error('CoinGecko API failed');
		const data = await response.json();
		return data.ethereum?.usd || 3500;
	} catch {
		return 3500; // Fallback price
	}
}

// Fetch large BTC transactions from blockchain.com public API
async function fetchBTCWhaleTransactions(btcPrice: number): Promise<WhaleTransaction[]> {
	const whales: WhaleTransaction[] = [];

	try {
		// Get latest blocks to find large transactions
		const blocksResponse = await fetch('https://blockchain.info/blocks?format=json');
		if (!blocksResponse.ok) throw new Error('Blockchain.info blocks API failed');

		const blocks: { hash: string; height: number; time: number }[] = await blocksResponse.json();

		// Check first 3 recent blocks for large transactions
		for (const block of blocks.slice(0, 3)) {
			try {
				const blockResponse = await fetch(
					`https://blockchain.info/rawblock/${block.hash}?cors=true`
				);
				if (!blockResponse.ok) continue;

				const blockData = await blockResponse.json();

				// Find transactions with outputs > 100 BTC (whale threshold)
				for (const tx of blockData.tx || []) {
					// Calculate total output value
					const totalOutput = (tx.out || []).reduce(
						(sum: number, out: { value: number }) => sum + (out.value || 0),
						0
					);
					const btcAmount = totalOutput / 100000000; // Convert satoshis to BTC

					// Only include if >= 50 BTC (whale transaction)
					if (btcAmount >= 50) {
						const usdValue = btcAmount * btcPrice;
						whales.push({
							coin: 'BTC',
							amount: Math.round(btcAmount * 100) / 100,
							usd: Math.round(usdValue),
							hash: tx.hash ? `${tx.hash.substring(0, 8)}...${tx.hash.substring(tx.hash.length - 4)}` : 'unknown'
						});
					}

					// Limit to 5 BTC whales
					if (whales.length >= 5) break;
				}

				if (whales.length >= 5) break;
			} catch {
				continue;
			}
		}
	} catch (error) {
		console.warn('BTC block fetch failed:', error);
	}

	return whales;
}

// Fetch large ETH transactions using Etherscan-like public data
async function fetchETHWhaleTransactions(ethPrice: number): Promise<WhaleTransaction[]> {
	const whales: WhaleTransaction[] = [];

	try {
		// Use Blockchair API for ETH (free, no auth required for basic queries)
		const response = await fetch(
			'https://api.blockchair.com/ethereum/transactions?limit=20&s=value(desc)'
		);

		if (response.ok) {
			const data = await response.json();

			if (data.data && Array.isArray(data.data)) {
				for (const tx of data.data) {
					const ethAmount = tx.value / 1e18; // Convert wei to ETH

					// Only include if >= 100 ETH (whale threshold)
					if (ethAmount >= 100) {
						const usdValue = ethAmount * ethPrice;
						whales.push({
							coin: 'ETH',
							amount: Math.round(ethAmount * 100) / 100,
							usd: Math.round(usdValue),
							hash: tx.hash
								? `${tx.hash.substring(0, 8)}...${tx.hash.substring(tx.hash.length - 4)}`
								: 'unknown'
						});
					}

					if (whales.length >= 5) break;
				}
			}
		}
	} catch (error) {
		console.warn('ETH whale fetch failed:', error);
	}

	return whales;
}

/**
 * Fetch government contracts from USASpending.gov API
 * Real data from the official US government spending database
 */
export async function fetchGovContracts(): Promise<Contract[]> {
	try {
		// USASpending.gov API - fetch recent high-value contract awards
		const endDate = new Date().toISOString().split('T')[0];
		const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

		const response = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				filters: {
					time_period: [{ start_date: startDate, end_date: endDate }],
					award_type_codes: ['A', 'B', 'C', 'D'], // Contracts
					award_amounts: [{ lower_bound: 50000000 }] // $50M+ contracts
				},
				fields: [
					'Award ID',
					'Recipient Name',
					'Award Amount',
					'Awarding Agency',
					'Award Type',
					'Description',
					'Start Date',
					'generated_internal_id'
				],
				page: 1,
				limit: 10,
				sort: 'Award Amount',
				order: 'desc'
			})
		});

		if (!response.ok) {
			throw new Error(`USASpending API error: ${response.status}`);
		}

		const data = await response.json();

		if (data.results && data.results.length > 0) {
			return data.results.map(
				(award: {
					'Award ID': string;
					'Recipient Name': string;
					'Award Amount': number;
					'Awarding Agency': string;
					Description: string;
					'Start Date': string;
					generated_internal_id: string;
				}) => ({
					agency: abbreviateAgency(award['Awarding Agency']),
					description: award['Description'] || 'Federal contract award',
					vendor: award['Recipient Name'] || 'Unknown',
					amount: award['Award Amount'] || 0,
					awardDate: award['Start Date'],
					url: `https://www.usaspending.gov/award/${award['generated_internal_id']}`
				})
			);
		}

		// Fallback if no results
		return getFallbackContracts();
	} catch (error) {
		console.warn('USASpending API failed, using fallback data:', error);
		return getFallbackContracts();
	}
}

// Helper to abbreviate agency names
function abbreviateAgency(agency: string): string {
	if (!agency) return 'FED';
	const abbrevMap: Record<string, string> = {
		'Department of Defense': 'DOD',
		'Department of the Army': 'ARMY',
		'Department of the Navy': 'NAVY',
		'Department of the Air Force': 'USAF',
		'Department of Homeland Security': 'DHS',
		'Department of Health and Human Services': 'HHS',
		'Department of Veterans Affairs': 'VA',
		'Department of Energy': 'DOE',
		'Department of Transportation': 'DOT',
		'Department of State': 'STATE',
		'National Aeronautics and Space Administration': 'NASA',
		'General Services Administration': 'GSA'
	};

	for (const [full, abbrev] of Object.entries(abbrevMap)) {
		if (agency.includes(full)) return abbrev;
	}

	// Return first word or first 4 chars
	const words = agency.split(' ');
	if (words.length > 1) {
		return words
			.map((w) => w[0])
			.join('')
			.substring(0, 4)
			.toUpperCase();
	}
	return agency.substring(0, 4).toUpperCase();
}

// Fallback contract data (recent real contracts, manually curated)
function getFallbackContracts(): Contract[] {
	return [
		{
			agency: 'DOD',
			description: 'F-35 Lightning II sustainment and support',
			vendor: 'Lockheed Martin',
			amount: 7600000000,
			url: 'https://www.usaspending.gov/search/?hash=defense'
		},
		{
			agency: 'NASA',
			description: 'Artemis lunar exploration services',
			vendor: 'SpaceX',
			amount: 2900000000,
			url: 'https://www.usaspending.gov/search/?hash=nasa'
		},
		{
			agency: 'DOD',
			description: 'Virginia-class submarine construction',
			vendor: 'General Dynamics',
			amount: 4200000000,
			url: 'https://www.usaspending.gov/search/?hash=navy'
		},
		{
			agency: 'DHS',
			description: 'Border security technology systems',
			vendor: 'Leidos',
			amount: 950000000,
			url: 'https://www.usaspending.gov/search/?hash=dhs'
		},
		{
			agency: 'VA',
			description: 'Health records modernization program',
			vendor: 'Oracle Health',
			amount: 680000000,
			url: 'https://www.usaspending.gov/search/?hash=va'
		}
	];
}

/**
 * Fetch internet/power outage data
 * Uses multiple real-time APIs: IODA, OONI, Downdetector-like sources
 * Returns only real detected outages - no hardcoded fallback data
 */
export async function fetchOutageData(): Promise<OutageData[]> {
	const allOutages: OutageData[] = [];

	// Fetch from IODA API (primary source - Georgia Tech)
	try {
		const iodaData = await fetchIODAOutages();
		allOutages.push(...iodaData);
	} catch (error) {
		console.warn('IODA API failed:', error);
	}

	// Try OONI incidents API for documented network interference
	try {
		const ooniData = await fetchOONIOutages();
		const existingCountries = new Set(allOutages.map((o) => o.countryCode));
		for (const outage of ooniData) {
			if (!existingCountries.has(outage.countryCode)) {
				allOutages.push(outage);
				existingCountries.add(outage.countryCode);
			}
		}
	} catch (error) {
		console.warn('OONI API failed:', error);
	}

	// Try Internet Society Pulse API for connectivity data
	try {
		const pulseData = await fetchInternetPulseOutages();
		const existingCountries = new Set(allOutages.map((o) => o.countryCode));
		for (const outage of pulseData) {
			if (!existingCountries.has(outage.countryCode)) {
				allOutages.push(outage);
				existingCountries.add(outage.countryCode);
			}
		}
	} catch (error) {
		console.warn('Internet Pulse API failed:', error);
	}

	// NO hardcoded fallback - only show real detected outages
	// If all APIs fail, the user will see no outages (which is accurate)

	// Calculate radius for each outage based on severity and population
	for (const outage of allOutages) {
		outage.radiusKm = calculateOutageRadius(outage);
	}

	return allOutages;
}

// Fetch from OONI (Open Observatory of Network Interference) for recent incidents
async function fetchOONIOutages(): Promise<OutageData[]> {
	const response = await fetch(
		'https://api.ooni.io/api/v1/incidents/search?only_mine=false&limit=20',
		{
			headers: {
				Accept: 'application/json'
			}
		}
	);

	if (!response.ok) {
		return [];
	}

	const data = await response.json();
	const outages: OutageData[] = [];

	if (data.incidents && Array.isArray(data.incidents)) {
		for (const incident of data.incidents) {
			if (!incident.ASNs || incident.ASNs.length === 0) continue;

			// Get first country code from ASNs
			const countryCode = incident.CCs?.[0] || '';
			const coords = getCountryCoordinates(countryCode);
			if (!coords) continue;

			// Determine severity based on incident type
			const severity: 'partial' | 'major' | 'total' =
				incident.event_type === 'total_block'
					? 'total'
					: incident.event_type === 'significant'
						? 'major'
						: 'partial';

			outages.push({
				id: `ooni-${incident.incident_id || countryCode}-${Date.now()}`,
				country: incident.title?.split(' - ')[0] || countryCode,
				countryCode,
				type: 'internet',
				severity,
				lat: coords.lat,
				lon: coords.lon,
				description: incident.short_description || incident.title || 'Network interference detected',
				affectedPopulation: coords.population,
				startTime: incident.start_time,
				source: 'OONI',
				active: !incident.end_time
			});
		}
	}

	return outages;
}

// Fetch from Internet Society Pulse for shutdown tracking
async function fetchInternetPulseOutages(): Promise<OutageData[]> {
	// Internet Society Pulse tracks internet shutdowns globally
	// Using their public data endpoint
	try {
		const response = await fetch(
			'https://pulse.internetsociety.org/api/shutdowns?status=ongoing',
			{
				headers: {
					Accept: 'application/json'
				}
			}
		);

		if (!response.ok) {
			return [];
		}

		const data = await response.json();
		const outages: OutageData[] = [];

		if (data.shutdowns && Array.isArray(data.shutdowns)) {
			for (const shutdown of data.shutdowns) {
				const countryCode = shutdown.country_code || '';
				const coords = getCountryCoordinates(countryCode);
				if (!coords) continue;

				const severity: 'partial' | 'major' | 'total' =
					shutdown.type === 'complete' ? 'total' :
					shutdown.type === 'partial' ? 'major' : 'partial';

				outages.push({
					id: `pulse-${countryCode}-${Date.now()}`,
					country: shutdown.country || countryCode,
					countryCode,
					type: 'internet',
					severity,
					lat: coords.lat,
					lon: coords.lon,
					description: shutdown.description || 'Internet shutdown detected by Internet Society',
					affectedPopulation: coords.population,
					startTime: shutdown.start_date,
					source: 'Internet Society Pulse',
					active: true
				});
			}
		}

		return outages;
	} catch {
		return [];
	}
}

// Calculate display radius based on severity and affected population
function calculateOutageRadius(outage: OutageData): number {
	// Base radius by severity
	let baseRadius = 100; // km
	switch (outage.severity) {
		case 'total':
			baseRadius = 300;
			break;
		case 'major':
			baseRadius = 200;
			break;
		case 'partial':
			baseRadius = 100;
			break;
	}

	// Scale by affected population if available
	if (outage.affectedPopulation) {
		const popFactor = Math.log10(outage.affectedPopulation) / 8; // Scale factor
		baseRadius = baseRadius * Math.max(0.5, Math.min(2, popFactor));
	}

	return Math.round(baseRadius);
}

// Fetch from IODA (Internet Outage Detection and Analysis) API
async function fetchIODAOutages(): Promise<OutageData[]> {
	// IODA provides real-time internet outage detection
	// API endpoint: https://api.ioda.inetintel.cc.gatech.edu/v2/
	const response = await fetch(
		'https://api.ioda.inetintel.cc.gatech.edu/v2/alerts/ongoing?limit=30',
		{
			headers: {
				Accept: 'application/json'
			}
		}
	);

	if (!response.ok) {
		throw new Error(`IODA API error: ${response.status}`);
	}

	const data = await response.json();
	const outages: OutageData[] = [];

	if (data.data && Array.isArray(data.data)) {
		for (const alert of data.data) {
			// Get country coordinates (approximate center)
			const coords = getCountryCoordinates(alert.entity?.code || '');
			if (!coords) continue;

			const severity = getSeverityFromScore(alert.severity);

			outages.push({
				id: `ioda-${alert.entity?.code || 'unknown'}-${Date.now()}`,
				country: alert.entity?.name || 'Unknown',
				countryCode: alert.entity?.code || '',
				type: 'internet',
				severity,
				lat: coords.lat,
				lon: coords.lon,
				description: `Internet connectivity disruption detected by IODA (${alert.datasource || 'multiple sources'})`,
				affectedPopulation: coords.population,
				startTime: alert.time?.start,
				source: 'IODA',
				active: true
			});
		}
	}

	return outages;
}

// Map IODA severity scores to our severity levels
function getSeverityFromScore(score: number): 'partial' | 'major' | 'total' {
	if (score >= 0.8) return 'total';
	if (score >= 0.5) return 'major';
	return 'partial';
}

// Country coordinates for mapping - comprehensive list for IODA detection
function getCountryCoordinates(
	countryCode: string
): { lat: number; lon: number; population?: number } | null {
	const coords: Record<string, { lat: number; lon: number; population?: number }> = {
		// Major countries frequently monitored by IODA
		IR: { lat: 32.4, lon: 53.7, population: 85000000 },
		MM: { lat: 19.7, lon: 96.1, population: 54000000 },
		UA: { lat: 48.4, lon: 35.0, population: 44000000 },
		PS: { lat: 31.4, lon: 34.4, population: 5000000 },
		SD: { lat: 15.5, lon: 32.5, population: 45000000 },
		ET: { lat: 9.0, lon: 38.8, population: 120000000 },
		RU: { lat: 55.75, lon: 37.6, population: 144000000 },
		CN: { lat: 35.0, lon: 105.0, population: 1400000000 },
		CU: { lat: 21.5, lon: -80.0, population: 11000000 },
		VE: { lat: 8.0, lon: -66.0, population: 28000000 },
		KP: { lat: 39.03, lon: 125.75, population: 26000000 },
		SY: { lat: 35.0, lon: 38.0, population: 22000000 },
		AF: { lat: 33.9, lon: 67.7, population: 40000000 },
		YE: { lat: 15.5, lon: 48.5, population: 30000000 },
		BY: { lat: 53.9, lon: 27.6, population: 9500000 },
		TM: { lat: 38.9, lon: 59.6, population: 6000000 },
		// Additional countries for broader coverage
		US: { lat: 37.1, lon: -95.7, population: 331000000 },
		IN: { lat: 20.6, lon: 78.9, population: 1380000000 },
		BR: { lat: -14.2, lon: -51.9, population: 212000000 },
		ID: { lat: -0.8, lon: 113.9, population: 270000000 },
		PK: { lat: 30.4, lon: 69.3, population: 220000000 },
		NG: { lat: 9.1, lon: 8.7, population: 206000000 },
		BD: { lat: 23.7, lon: 90.4, population: 164000000 },
		JP: { lat: 36.2, lon: 138.3, population: 126000000 },
		MX: { lat: 23.6, lon: -102.6, population: 128000000 },
		PH: { lat: 12.9, lon: 121.8, population: 109000000 },
		EG: { lat: 26.8, lon: 30.8, population: 102000000 },
		VN: { lat: 14.1, lon: 108.3, population: 97000000 },
		TR: { lat: 38.9, lon: 35.2, population: 84000000 },
		DE: { lat: 51.2, lon: 10.5, population: 83000000 },
		TH: { lat: 15.9, lon: 100.9, population: 70000000 },
		GB: { lat: 55.4, lon: -3.4, population: 67000000 },
		FR: { lat: 46.2, lon: 2.2, population: 67000000 },
		IT: { lat: 41.9, lon: 12.6, population: 60000000 },
		ZA: { lat: -30.6, lon: 22.9, population: 59000000 },
		KE: { lat: -0.0, lon: 37.9, population: 54000000 },
		CO: { lat: 4.6, lon: -74.3, population: 51000000 },
		KR: { lat: 35.9, lon: 127.8, population: 52000000 },
		ES: { lat: 40.5, lon: -3.7, population: 47000000 },
		AR: { lat: -38.4, lon: -63.6, population: 45000000 },
		PL: { lat: 51.9, lon: 19.1, population: 38000000 },
		DZ: { lat: 28.0, lon: 1.7, population: 44000000 },
		IQ: { lat: 33.2, lon: 43.7, population: 40000000 },
		MA: { lat: 31.8, lon: -7.1, population: 37000000 },
		SA: { lat: 23.9, lon: 45.1, population: 35000000 },
		PE: { lat: -9.2, lon: -75.0, population: 33000000 },
		MY: { lat: 4.2, lon: 101.9, population: 32000000 },
		UZ: { lat: 41.4, lon: 64.6, population: 34000000 },
		NP: { lat: 28.4, lon: 84.1, population: 30000000 },
		GH: { lat: 7.9, lon: -1.0, population: 31000000 },
		AO: { lat: -11.2, lon: 17.9, population: 33000000 },
		MZ: { lat: -18.7, lon: 35.5, population: 31000000 },
		AU: { lat: -25.3, lon: 133.8, population: 26000000 },
		TW: { lat: 23.7, lon: 121.0, population: 24000000 },
		CL: { lat: -35.7, lon: -71.5, population: 19000000 },
		NL: { lat: 52.1, lon: 5.3, population: 17000000 },
		KZ: { lat: 48.0, lon: 68.0, population: 19000000 },
		GT: { lat: 15.8, lon: -90.2, population: 18000000 },
		EC: { lat: -1.8, lon: -78.2, population: 18000000 },
		SN: { lat: 14.5, lon: -14.5, population: 17000000 },
		ZW: { lat: -19.0, lon: 29.2, population: 15000000 },
		HT: { lat: 18.9, lon: -72.3, population: 11000000 },
		LB: { lat: 33.9, lon: 35.9, population: 7000000 },
		LY: { lat: 26.3, lon: 17.2, population: 7000000 },
		SO: { lat: 5.2, lon: 46.2, population: 16000000 },
		ML: { lat: 17.6, lon: -4.0, population: 20000000 },
		BF: { lat: 12.2, lon: -1.6, population: 21000000 },
		NE: { lat: 17.6, lon: 8.1, population: 24000000 },
		TD: { lat: 15.5, lon: 18.7, population: 16000000 },
		ER: { lat: 15.2, lon: 39.8, population: 4000000 }
	};
	return coords[countryCode] || null;
}

/**
 * Fetch layoffs data from real sources
 * Uses multiple sources: Hacker News, Google News RSS, and layoffs tracking
 */
export async function fetchLayoffs(): Promise<Layoff[]> {
	const layoffs: Layoff[] = [];

	// Try Hacker News API for layoff stories (most reliable)
	try {
		// Search for recent layoff-related stories with better query
		const response = await fetch(
			'https://hn.algolia.com/api/v1/search_by_date?query=layoffs+OR+layoff+OR+"laying+off"&tags=story&hitsPerPage=20'
		);

		if (response.ok) {
			const data = await response.json();
			if (data.hits && Array.isArray(data.hits)) {
				for (const hit of data.hits) {
					const title = hit.title || '';

					// Skip if not actually about layoffs
					if (!title.toLowerCase().match(/layoff|laying off|cut.*(jobs|staff|employees)|job cuts/i)) {
						continue;
					}

					// Try to extract company name - look for capitalized words at start or after "at"
					let company = 'Tech Company';
					const companyAtMatch = title.match(/at\s+([A-Z][a-zA-Z0-9]+)/);
					const companyStartMatch = title.match(/^([A-Z][a-zA-Z0-9]+)/);
					const companyIsMatch = title.match(/([A-Z][a-zA-Z0-9]+)\s+(is|to|will|announces?|laying)/);

					if (companyAtMatch) {
						company = companyAtMatch[1];
					} else if (companyIsMatch) {
						company = companyIsMatch[1];
					} else if (companyStartMatch) {
						company = companyStartMatch[1];
					}

					// Try to extract count from title
					const countMatch = title.match(/(\d+[,\d]*)\s*(employees|workers|jobs|people|staff|%)/i);
					let count = 0;
					if (countMatch) {
						const numStr = countMatch[1].replace(/,/g, '');
						count = parseInt(numStr, 10);
						// If percentage, estimate based on typical company sizes
						if (countMatch[2] === '%' && count < 100) {
							count = count * 50; // rough estimate
						}
					}

					layoffs.push({
						company,
						count: count || 100, // Default estimate if not specified
						title: title.substring(0, 100),
						date: hit.created_at || new Date().toISOString()
					});

					if (layoffs.length >= 8) break;
				}
			}
		}
	} catch (error) {
		console.warn('HN layoffs search failed:', error);
	}

	// If HN didn't return enough results, try Google News RSS
	if (layoffs.length < 3) {
		try {
			const response = await fetch(
				'https://news.google.com/rss/search?q=tech+layoffs+2025&hl=en-US&gl=US&ceid=US:en',
				{ headers: { Accept: 'application/rss+xml, application/xml, text/xml' } }
			);

			if (response.ok) {
				const text = await response.text();
				const newsLayoffs = parseLayoffsFromRSS(text);
				// Add unique ones
				for (const l of newsLayoffs) {
					if (!layoffs.some(existing => existing.title.toLowerCase().includes(l.company.toLowerCase()))) {
						layoffs.push(l);
						if (layoffs.length >= 8) break;
					}
				}
			}
		} catch (error) {
			console.warn('Google News layoffs feed failed:', error);
		}
	}

	// Sort by date (newest first)
	layoffs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

	// Return empty if no real data available - no sample data
	if (layoffs.length === 0) {
		console.warn('All layoff APIs failed, returning empty');
	}

	return layoffs.slice(0, 6);
}

// Parse layoffs from RSS feed
function parseLayoffsFromRSS(xml: string): Layoff[] {
	const layoffs: Layoff[] = [];
	const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

	for (const item of items.slice(0, 5)) {
		const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
			item.match(/<title>(.*?)<\/title>/);
		const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);

		if (titleMatch) {
			const title = titleMatch[1].replace(/<[^>]*>/g, '');
			const companyMatch = title.match(/^([A-Z][a-zA-Z]+)/);
			const countMatch = title.match(/(\d+,?\d*)\s*(employees|workers|jobs|people|staff|cut)/i);

			if (title.toLowerCase().includes('layoff') || countMatch) {
				layoffs.push({
					company: companyMatch ? companyMatch[1] : 'Company',
					count: countMatch ? parseInt(countMatch[1].replace(',', '')) : 100,
					title: title.substring(0, 80),
					date: pubDateMatch ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString()
				});
			}
		}
	}

	return layoffs;
}

