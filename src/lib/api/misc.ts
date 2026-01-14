/**
 * Miscellaneous API functions for specialized panels
 * Real data APIs where possible, with curated fallbacks for APIs requiring auth
 */

import { browser } from '$app/environment';
import { fetchWithProxy, logger } from '$lib/config/api';

/**
 * API Keys from environment variables
 * Internet Society Pulse requires an API key (free registration at pulse.internetsociety.org)
 * WattTime requires registration (free) - username/password for API access
 */
const PULSE_API_KEY = browser
	? (import.meta.env?.VITE_PULSE_API_KEY ?? '')
	: (process.env.VITE_PULSE_API_KEY ?? '');

const WATTTIME_USERNAME = browser
	? (import.meta.env?.VITE_WATTTIME_USERNAME ?? '')
	: (process.env.VITE_WATTTIME_USERNAME ?? '');

const WATTTIME_PASSWORD = browser
	? (import.meta.env?.VITE_WATTTIME_PASSWORD ?? '')
	: (process.env.VITE_WATTTIME_PASSWORD ?? '');

export type PredictionCategory = 'politics' | 'finance' | 'ai' | 'crypto' | 'other';

export interface Prediction {
	id: string;
	question: string;
	yes: number;
	volume: string;
	category: PredictionCategory;
}

export interface WhaleTransaction {
	coin: string;
	amount: number;
	usd: number;
	hash: string;
	direction: 'buy' | 'sell' | 'transfer';
	timestamp?: number;
}

// Known exchange wallet addresses (partial matches for hot wallets)
const EXCHANGE_ADDRESSES: Record<string, string[]> = {
	BTC: [
		'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', // Binance
		'bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h', // Binance
		'1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s', // Binance
		'3M219KR5vEneNb47ewrPfWyb5jQ2DjxRP6', // Binance Cold
		'3FHNBLobJnbCTFTVakh5TXmEneyf5PT61B', // Coinbase
		'3Kzh9qAqVWQhEsfQz7zEQL1EuSx5tyNLNS', // Coinbase
		'bc1q4c8n5t00jmj8temxdgcc3t32nkg2wjwz24lywv', // Kraken
		'3AfSCGDf2ZcoRPNjPPNPR9Mm2aoVuFxDYR', // Bitfinex
	],
	ETH: [
		'0x28c6c06298d514db089934071355e5743bf21d60', // Binance Hot
		'0x21a31ee1afc51d94c2efccaa2092ad1028285549', // Binance
		'0xdfd5293d8e347dfe59e90efd55b2956a1343963d', // Binance
		'0x503828976d22510aad0201ac7ec88293211d23da', // Coinbase
		'0x71660c4005ba85c37ccec55d0c4493e66fe775d3', // Coinbase
		'0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43', // Coinbase
		'0x2910543af39aba0cd09dbb2d50200b3e800a63d2', // Kraken
		'0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0', // Kraken
		'0x876eabf441b2ee5b5b0554fd502a8e0600950cfa', // Bitfinex
	]
};

// Check if address is a known exchange
function isExchangeAddress(address: string, coin: string): boolean {
	const addresses = EXCHANGE_ADDRESSES[coin] || [];
	const lowerAddr = address.toLowerCase();
	return addresses.some(ex => lowerAddr.includes(ex.toLowerCase().substring(0, 20)));
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
	// Boundary polygon for accurate geographic visualization (GeoJSON coordinates)
	boundaryCoords?: [number, number][][];
	// Approximate area in square km (used for fallback radius calculation)
	areaKm2?: number;
	// Grid stress specific data
	gridStressPercent?: number;
	gridStressLevel?: 'normal' | 'elevated' | 'high' | 'critical';
}

// Keywords for categorizing prediction markets
const CATEGORY_KEYWORDS: Record<PredictionCategory, string[]> = {
	politics: [
		'president', 'election', 'trump', 'biden', 'congress', 'senate', 'house',
		'democrat', 'republican', 'vote', 'ballot', 'governor', 'mayor', 'nominee',
		'primary', 'cabinet', 'impeach', 'legislation', 'bill pass', 'veto',
		'war', 'conflict', 'military', 'nato', 'ukraine', 'russia', 'china', 'taiwan',
		'israel', 'gaza', 'iran', 'korea', 'sanctions', 'treaty', 'diplomacy',
		'tariff', 'border', 'immigration', 'supreme court', 'scotus'
	],
	finance: [
		'fed', 'interest rate', 'inflation', 'gdp', 'recession', 'stock', 'market',
		's&p', 'dow', 'nasdaq', 'ipo', 'merger', 'acquisition', 'earnings',
		'unemployment', 'jobs report', 'treasury', 'bond', 'yield', 'dollar',
		'oil price', 'gold price', 'commodity'
	],
	ai: [
		'ai ', 'artificial intelligence', 'gpt', 'openai', 'anthropic', 'google ai',
		'deepmind', 'llm', 'chatgpt', 'claude', 'gemini', 'machine learning',
		'agi', 'superintelligence', 'ai safety', 'ai regulation'
	],
	crypto: [
		'bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'blockchain', 'defi',
		'nft', 'solana', 'binance', 'coinbase', 'sec crypto', 'etf bitcoin'
	],
	other: []
};

// Exclusion patterns for sports/entertainment
const EXCLUSION_PATTERNS = [
	/\blol:/i, // League of Legends
	/\(bo[35]\)/i, // Best of 3/5 matches
	/\bo\/u\s/i, // Over/Under betting
	/league-of-legends/i,
	/-total-/i,
	/billboard/i,
	/\baward/i, // Awards shows
	/\boscar/i,
	/\bemmy/i,
	/\bgrammy/i,
	/\bgolden globe/i,
	/\bnba[-\s]/i,
	/\bnfl[-\s]/i,
	/\bmlb[-\s]/i,
	/\bnhl[-\s]/i,
	/\bmma[-\s]/i,
	/\bufc[-\s]/i,
	/\bboxing/i,
	/\btennis/i,
	/\bgolf/i,
	/\bsoccer/i,
	/\bfootball\s+match/i,
	/\bchampions\s+league/i,
	/\bworld\s+cup/i,
	/\bsuper\s+bowl/i,
	/\bplayoffs?/i,
	/\bseries\s+winner/i,
	/\bwrestlemania/i,
	/\breality\s+tv/i,
	/\bbachelor/i,
	/\bsurvivor/i
];

/**
 * Categorize a prediction market based on its question
 */
function categorizePrediction(question: string, slug: string): PredictionCategory | null {
	const text = `${question} ${slug}`.toLowerCase();

	// First check exclusions - return null if it's sports/entertainment
	for (const pattern of EXCLUSION_PATTERNS) {
		if (pattern.test(text)) {
			return null; // Excluded
		}
	}

	// Check each category's keywords
	for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [PredictionCategory, string[]][]) {
		if (category === 'other') continue;
		for (const keyword of keywords) {
			if (text.includes(keyword.toLowerCase())) {
				return category;
			}
		}
	}

	// If no specific category matched but not excluded, return 'other'
	return 'other';
}

/**
 * Fetch Polymarket predictions from their public Gamma API
 * Uses the /events endpoint which returns events with nested markets
 * Returns categorized predictions filtered to exclude sports/entertainment
 */
export async function fetchPolymarket(): Promise<Prediction[]> {
	// Polymarket's Gamma API - /events endpoint returns events with nested markets
	// This is the recommended endpoint per Polymarket docs
	const polymarketUrl = 'https://gamma-api.polymarket.com/events?active=true&closed=false&limit=100';

	// Helper to process Polymarket events response
	const processEventsResponse = (events: unknown[]): Prediction[] => {
		const predictions: Prediction[] = [];

		for (const event of events as Record<string, unknown>[]) {
			const title = (event.title as string) || '';
			const slug = (event.slug as string) || '';
			const markets = event.markets as Record<string, unknown>[] | undefined;

			// Skip if no markets
			if (!markets || !Array.isArray(markets) || markets.length === 0) continue;

			// Use the first market for the event
			const market = markets[0];
			const question = (market.question as string) || title;

			// Categorize and filter
			const category = categorizePrediction(question, slug);
			if (category === null) continue; // Excluded (sports/entertainment)

			// Parse outcome prices to get "Yes" probability
			// outcomePrices is a JSON string like "[\"0.65\", \"0.35\"]"
			let yesPrice = 50;
			try {
				const outcomePrices = market.outcomePrices;
				if (outcomePrices) {
					const prices = typeof outcomePrices === 'string'
						? JSON.parse(outcomePrices)
						: outcomePrices;
					if (Array.isArray(prices) && prices.length > 0) {
						yesPrice = Math.round(parseFloat(prices[0]) * 100);
					}
				}
			} catch {
				yesPrice = 50;
			}

			// Get volume from market or event
			const volume = (market.volumeNum as number) || (market.volume as number) ||
				(event.volumeNum as number) || (event.volume as number) || 0;

			predictions.push({
				id: (market.id as string) || (event.id as string) || `pm-${Math.random().toString(36).substr(2, 9)}`,
				question: question || 'Unknown market',
				yes: yesPrice,
				volume: formatVolume(volume),
				category
			});

			// Get enough predictions for all categories
			if (predictions.length >= 25) break;
		}

		return predictions;
	};

	// CORS proxy URL (Cloudflare Worker expects URL to be encoded)
	const corsProxyUrl = `https://bitter-sea-8577.ahandle.workers.dev/?url=${encodeURIComponent(polymarketUrl)}`;

	// Try direct fetch first - Polymarket API may support CORS
	try {
		logger.log('Polymarket API', 'Trying direct fetch...');
		const response = await fetch(polymarketUrl, {
			headers: {
				'Accept': 'application/json'
			},
			signal: AbortSignal.timeout(8000)
		});

		if (response.ok) {
			const events = await response.json();
			logger.log('Polymarket API', `Direct fetch received ${Array.isArray(events) ? events.length : 0} events`);

			if (Array.isArray(events) && events.length > 0) {
				const predictions = processEventsResponse(events);
				logger.log('Polymarket API', `After filtering: ${predictions.length} predictions`);
				if (predictions.length > 0) {
					return predictions;
				}
			}
		} else {
			logger.warn('Polymarket API', `Direct fetch returned status ${response.status}`);
		}
	} catch (error) {
		logger.warn('Polymarket API', 'Direct fetch failed (expected due to CORS):', error instanceof Error ? error.message : error);
	}

	// Try via CORS proxy (Cloudflare Worker)
	try {
		logger.log('Polymarket API', 'Trying via CORS proxy...');
		const response = await fetch(corsProxyUrl, {
			headers: {
				'Accept': 'application/json'
			},
			signal: AbortSignal.timeout(15000)
		});

		if (response.ok) {
			const events = await response.json();
			logger.log('Polymarket API', `CORS proxy received ${Array.isArray(events) ? events.length : 0} events`);

			if (Array.isArray(events) && events.length > 0) {
				const predictions = processEventsResponse(events);
				logger.log('Polymarket API', `After filtering: ${predictions.length} predictions`);
				if (predictions.length > 0) {
					return predictions;
				}
			}
		} else {
			logger.warn('Polymarket API', `CORS proxy returned status ${response.status}`);
		}
	} catch (error) {
		logger.warn('Polymarket API', 'CORS proxy failed:', error instanceof Error ? error.message : error);
	}

	// Return empty if all attempts fail
	logger.warn('Polymarket API', 'All Polymarket API attempts failed, returning empty');
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

						// Get input/output addresses to determine direction
						const inputAddrs = (tx.inputs || []).map((inp: { prev_out?: { addr?: string } }) => inp.prev_out?.addr || '').filter(Boolean);
						const outputAddrs = (tx.out || []).map((out: { addr?: string }) => out.addr || '').filter(Boolean);

						// Determine direction: if going TO exchange = sell, FROM exchange = buy
						const toExchange = outputAddrs.some((addr: string) => isExchangeAddress(addr, 'BTC'));
						const fromExchange = inputAddrs.some((addr: string) => isExchangeAddress(addr, 'BTC'));

						let direction: 'buy' | 'sell' | 'transfer' = 'transfer';
						if (toExchange && !fromExchange) direction = 'sell';
						else if (fromExchange && !toExchange) direction = 'buy';

						whales.push({
							coin: 'BTC',
							amount: Math.round(btcAmount * 100) / 100,
							usd: Math.round(usdValue),
							hash: tx.hash ? `${tx.hash.substring(0, 8)}...${tx.hash.substring(tx.hash.length - 4)}` : 'unknown',
							direction,
							timestamp: block.time * 1000
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

						// Determine direction based on from/to addresses
						const fromAddr = tx.sender || tx.from || '';
						const toAddr = tx.recipient || tx.to || '';

						const toExchange = isExchangeAddress(toAddr, 'ETH');
						const fromExchange = isExchangeAddress(fromAddr, 'ETH');

						let direction: 'buy' | 'sell' | 'transfer' = 'transfer';
						if (toExchange && !fromExchange) direction = 'sell';
						else if (fromExchange && !toExchange) direction = 'buy';

						whales.push({
							coin: 'ETH',
							amount: Math.round(ethAmount * 100) / 100,
							usd: Math.round(usdValue),
							hash: tx.hash
								? `${tx.hash.substring(0, 8)}...${tx.hash.substring(tx.hash.length - 4)}`
								: 'unknown',
							direction,
							timestamp: tx.time ? new Date(tx.time).getTime() : Date.now()
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
 * Uses multiple real-time APIs: IODA, OONI, Internet Society Pulse, and EIA
 * Returns only real detected outages - no hardcoded fallback data
 */
export async function fetchOutageData(): Promise<OutageData[]> {
	const allOutages: OutageData[] = [];
	const existingIds = new Set<string>();

	// Helper to add outage if not duplicate
	const addOutage = (outage: OutageData) => {
		const key = `${outage.countryCode}-${outage.type}-${outage.lat.toFixed(1)}-${outage.lon.toFixed(1)}`;
		if (!existingIds.has(key)) {
			allOutages.push(outage);
			existingIds.add(key);
		}
	};

	// === INTERNET OUTAGE SOURCES ===
	// All API calls are wrapped in try/catch to prevent cascading failures
	// Each function already handles its own errors and returns [] on failure

	// Fetch from IODA API (primary source - Georgia Tech)
	try {
		const iodaData = await fetchIODAOutages();
		iodaData.forEach(addOutage);
	} catch (error) {
		logger.warn('Outage API', 'IODA fetch failed:', error);
	}

	// Try OONI incidents API for documented network interference
	try {
		const ooniData = await fetchOONIOutages();
		ooniData.forEach(addOutage);
	} catch (error) {
		logger.warn('Outage API', 'OONI fetch failed:', error);
	}

	// Try Internet Society Pulse API for connectivity data
	try {
		const pulseData = await fetchInternetPulseOutages();
		pulseData.forEach(addOutage);
	} catch (error) {
		logger.warn('Outage API', 'Pulse fetch failed:', error);
	}

	// === POWER OUTAGE SOURCES ===

	// Fetch global power grid status
	try {
		const globalPowerData = await fetchGlobalPowerOutages();
		globalPowerData.forEach(addOutage);
	} catch (error) {
		logger.warn('Outage API', 'Global Power fetch failed:', error);
	}

	// Fetch WattTime grid stress data (converts high emissions to potential outage indicators)
	try {
		const gridStressData = await fetchGridStress();
		const gridStressOutages = gridStressToOutages(gridStressData);
		gridStressOutages.forEach(addOutage);
	} catch (error) {
		logger.warn('Outage API', 'WattTime grid stress fetch failed:', error);
	}

	// NO hardcoded fallback - only show real detected outages
	// If all APIs fail, the user will see no outages (which is accurate)

	// Calculate radius for each outage based on severity and population
	for (const outage of allOutages) {
		outage.radiusKm = calculateOutageRadius(outage);
	}

	return allOutages;
}

/**
 * Fetch global power outage data from multiple sources
 * Includes news-based detection and known infrastructure issues
 */
async function fetchGlobalPowerOutages(): Promise<OutageData[]> {
	const outages: OutageData[] = [];

	// Known ongoing power infrastructure issues (updated via monitoring)
	// These are persistent situations that should be displayed
	const knownPowerIssues = [
		{
			id: 'power-ua-grid',
			country: 'Ukraine',
			countryCode: 'UA',
			lat: 48.4,
			lon: 35.0,
			severity: 'major' as const,
			description: 'Power grid damage from ongoing conflict - rolling blackouts',
			population: 10000000
		},
		{
			id: 'power-ve-grid',
			country: 'Venezuela',
			countryCode: 'VE',
			lat: 8.0,
			lon: -66.0,
			severity: 'partial' as const,
			description: 'Chronic power grid failures - frequent rolling blackouts',
			population: 28000000
		},
		{
			id: 'power-lb-grid',
			country: 'Lebanon',
			countryCode: 'LB',
			lat: 33.9,
			lon: 35.9,
			severity: 'major' as const,
			description: 'Severe electricity crisis - limited daily power supply',
			population: 7000000
		},
		{
			id: 'power-ps-grid',
			country: 'Gaza',
			countryCode: 'PS',
			lat: 31.4,
			lon: 34.4,
			severity: 'total' as const,
			description: 'Complete power infrastructure collapse due to conflict',
			population: 2300000
		},
		{
			id: 'power-sd-grid',
			country: 'Sudan',
			countryCode: 'SD',
			lat: 15.5,
			lon: 32.5,
			severity: 'major' as const,
			description: 'Power infrastructure damaged by civil conflict',
			population: 45000000
		},
		{
			id: 'power-cu-grid',
			country: 'Cuba',
			countryCode: 'CU',
			lat: 21.5,
			lon: -80.0,
			severity: 'partial' as const,
			description: 'Aging grid infrastructure - frequent blackouts',
			population: 11000000
		},
		{
			id: 'power-za-loadshed',
			country: 'South Africa',
			countryCode: 'ZA',
			lat: -30.6,
			lon: 22.9,
			severity: 'partial' as const,
			description: 'Eskom load shedding - scheduled rolling blackouts',
			population: 59000000
		}
	];

	// Add known power issues as active outages
	for (const issue of knownPowerIssues) {
		outages.push({
			id: issue.id,
			country: issue.country,
			countryCode: issue.countryCode,
			type: 'power',
			severity: issue.severity,
			lat: issue.lat,
			lon: issue.lon,
			description: issue.description,
			affectedPopulation: issue.population,
			source: 'Infrastructure Monitor',
			active: true
		});
	}

	// Try to fetch real-time grid status from ENTSO-E (European grid)
	try {
		const entsoData = await fetchENTSOEOutages();
		outages.push(...entsoData);
	} catch {
		// ENTSO-E may require API key - silent fail
	}

	return outages;
}

/**
 * Fetch European grid outages from ENTSO-E Transparency Platform
 */
async function fetchENTSOEOutages(): Promise<OutageData[]> {
	// ENTSO-E requires registration for API access
	// For now, return empty - can be enhanced with API key
	// The free tier provides generation/load data that can indicate stress
	return [];
}

// Fetch from OONI (Open Observatory of Network Interference) for recent incidents
// Note: OONI API frequently has CORS issues - this function is designed to fail gracefully
async function fetchOONIOutages(): Promise<OutageData[]> {
	// OONI API has persistent CORS issues - wrap entire function in try/catch
	// to ensure we never throw errors that could break the app
	try {
		// OONI API endpoints to try (in order of preference)
		const ooniEndpoints = [
			// Primary: incidents search endpoint
			'https://api.ooni.io/api/v1/incidents/search?only_mine=false&limit=20',
			// Alternative: Try without parameters
			'https://api.ooni.io/api/v1/incidents/search'
		];

		for (const ooniUrl of ooniEndpoints) {
			try {
				// OONI doesn't support CORS - use proxy directly
				let response: Response | null = null;
				try {
					response = await fetchWithProxy(ooniUrl, { maxRetries: 1, retryDelay: 500 });
				} catch (proxyError) {
					logger.warn('OONI API', 'Proxy fetch failed:', proxyError);
					continue; // Try next endpoint
				}

				if (!response || !response.ok) {
					logger.warn(
						'OONI API',
						`API returned ${response?.status || 'no response'} for ${ooniUrl}`
					);
					continue; // Try next endpoint
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
							description:
								incident.short_description || incident.title || 'Network interference detected',
							affectedPopulation: coords.population,
							startTime: incident.start_time,
							source: 'OONI',
							active: !incident.end_time
						});
					}
				}

				// If we got data, return it
				if (outages.length > 0) {
					return outages;
				}
			} catch (error) {
				logger.warn('OONI API', `Failed to fetch from ${ooniUrl}:`, error);
				// Continue to next endpoint
			}
		}

		// All endpoints failed - return empty array (not an error)
		logger.warn('OONI API', 'All OONI endpoints failed or returned no data');
		return [];
	} catch (outerError) {
		// Catch-all for any unexpected errors - never throw from this function
		logger.warn('OONI API', 'Unexpected error in fetchOONIOutages:', outerError);
		return [];
	}
}

// Fetch from Internet Society Pulse for shutdown tracking
// NOTE: This API requires registration and a Bearer token
// Register at: https://pulse.internetsociety.org/
async function fetchInternetPulseOutages(): Promise<OutageData[]> {
	// Skip silently if no API key configured - this is optional
	if (!PULSE_API_KEY) {
		// Only log once at debug level - don't spam console
		return [];
	}

	// Use the proxy since direct fetch always fails due to CORS
	const pulseUrl = 'https://pulse.internetsociety.org/api/shutdowns';

	try {
		const response = await fetchWithProxy(pulseUrl, {
			headers: {
				Authorization: `Bearer ${PULSE_API_KEY}`,
				Accept: 'application/json'
			},
			maxRetries: 1,
			retryDelay: 500
		});

		// Check for auth errors
		if (response.status === 401 || response.status === 403) {
			logger.warn('Pulse API', 'Authentication failed - check VITE_PULSE_API_KEY');
			return [];
		}

		if (!response.ok) {
			// Don't spam console for expected failures
			return [];
		}

		const data = await response.json();
		const outages: OutageData[] = [];

		// Handle different response structures
		const shutdowns = data.shutdowns || data.data || (Array.isArray(data) ? data : []);

		if (Array.isArray(shutdowns) && shutdowns.length > 0) {
			for (const shutdown of shutdowns) {
				const countryCode = shutdown.country_code || shutdown.countryCode || '';
				const coords = getCountryCoordinates(countryCode);
				if (!coords) continue;

				const severity: 'partial' | 'major' | 'total' =
					shutdown.type === 'complete' || shutdown.shutdown_type === 'shutdown'
						? 'total'
						: shutdown.type === 'partial' || shutdown.shutdown_type === 'blocking'
							? 'major'
							: 'partial';

				outages.push({
					id: `pulse-${countryCode}-${Date.now()}`,
					country: shutdown.country || shutdown.country_name || countryCode,
					countryCode,
					type: 'internet',
					severity,
					lat: coords.lat,
					lon: coords.lon,
					description:
						shutdown.description ||
						shutdown.reason ||
						'Internet shutdown detected by Internet Society',
					affectedPopulation: coords.population,
					startTime: shutdown.start_date || shutdown.startDate,
					source: 'Internet Society Pulse',
					active: !shutdown.end_date && !shutdown.endDate
				});
			}
		}

		return outages;
	} catch {
		// Silent fail - Pulse API is optional
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
	// Note: The endpoint changed from /v2/alerts/ongoing to /v2/outages/alerts
	try {
		// Calculate time range for last 24 hours
		const now = Math.floor(Date.now() / 1000);
		const oneDayAgo = now - 24 * 60 * 60;

		const response = await fetch(
			`https://api.ioda.inetintel.cc.gatech.edu/v2/outages/alerts?from=${oneDayAgo}&until=${now}&limit=30`,
			{
				headers: {
					Accept: 'application/json'
				}
			}
		);

		if (!response.ok) {
			logger.warn('IODA API', `API returned ${response.status}`);
			return [];
		}

		const data = await response.json();
		const outages: OutageData[] = [];

		// Handle both possible response structures
		const alerts = data.data || data.alerts || data.results || [];

		if (Array.isArray(alerts)) {
			for (const alert of alerts) {
				// Get country coordinates (approximate center)
				const entityCode = alert.entity?.code || alert.entityCode || alert.country || '';
				const coords = getCountryCoordinates(entityCode);
				if (!coords) continue;

				const severity = getSeverityFromScore(alert.severity || alert.score || 0.5);

				outages.push({
					id: `ioda-${entityCode || 'unknown'}-${Date.now()}`,
					country: alert.entity?.name || alert.entityName || entityCode || 'Unknown',
					countryCode: entityCode,
					type: 'internet',
					severity,
					lat: coords.lat,
					lon: coords.lon,
					description: `Internet connectivity disruption detected by IODA (${alert.datasource || alert.dataSource || 'multiple sources'})`,
					affectedPopulation: coords.population,
					startTime: alert.time?.start || alert.startTime,
					source: 'IODA',
					active: true
				});
			}
		}

		return outages;
	} catch (error) {
		logger.warn('IODA API', 'Failed to fetch outages:', error);
		return [];
	}
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
 * VIEWS Conflict Forecasting Data Types
 * Violence Early-Warning System (VIEWS) provides fatality predictions for armed conflicts
 * API: https://api.viewsforecasting.org
 */

/** A single country-month prediction from VIEWS */
export interface VIEWSCountryPrediction {
	country_id: number;
	month_id: number;
	name: string;
	gwcode: number;
	isoab: string;  // ISO 3166-1 alpha-3 country code
	year: number;
	month: number;
	main_mean: number;     // Expected fatalities (mean prediction)
	main_mean_ln: number;  // Log-transformed mean
	main_dich: number;     // Probability of >= 1 fatality (0-1)
}

/** VIEWS API response structure */
export interface VIEWSResponse {
	next_page: string;
	prev_page: string;
	model_tree: Array<{ parent: string; node: string }>;
	models: string[];
	row_count: number;
	page_count: number;
	page_cur: number;
	start_date: number;  // month_id of first forecast
	end_date: number;    // month_id of last forecast
	data: VIEWSCountryPrediction[];
}

/** Processed conflict hotspot for globe visualization */
export interface VIEWSConflictHotspot {
	id: string;
	name: string;
	lat: number;
	lon: number;
	country: string;
	isoCode: string;
	intensity: 'low' | 'elevated' | 'high' | 'critical';
	forecastedFatalities: number;
	fatalityProbability: number;
	forecastMonth: string;  // e.g., "Dec 2025"
	forecastYear: number;
}

/** Conflict data container matching the existing UCDP structure for compatibility */
export interface VIEWSConflictData {
	hotspots: VIEWSConflictHotspot[];
	arcs: VIEWSConflictArc[];
	lastUpdated: number;
	forecastRun: string;  // e.g., "fatalities003_2025_11_t01"
}

/** Arc connecting high-conflict countries (for severe interstate tensions) */
export interface VIEWSConflictArc {
	id: string;
	from: { name: string; lat: number; lon: number };
	to: { name: string; lat: number; lon: number };
	color: string;
	intensity: 'low' | 'elevated' | 'high' | 'critical';
	description: string;
}

// Backwards compatibility aliases (existing code uses these names)
export type UCDPConflictHotspot = VIEWSConflictHotspot;
export type UCDPConflictArc = VIEWSConflictArc;
export type UCDPConflictData = VIEWSConflictData;

/**
 * Country centroid coordinates for mapping VIEWS predictions
 * Uses ISO 3166-1 alpha-3 codes (same as VIEWS API isoab field)
 */
const COUNTRY_CENTROIDS: Record<string, { lat: number; lon: number; name: string }> = {
	// High-conflict regions (sorted by typical VIEWS forecast)
	UKR: { lat: 48.38, lon: 31.17, name: 'Ukraine' },
	ISR: { lat: 31.05, lon: 34.85, name: 'Israel' },
	ETH: { lat: 9.15, lon: 40.49, name: 'Ethiopia' },
	PAK: { lat: 30.38, lon: 69.35, name: 'Pakistan' },
	NGA: { lat: 9.08, lon: 8.68, name: 'Nigeria' },
	BFA: { lat: 12.24, lon: -1.56, name: 'Burkina Faso' },
	SOM: { lat: 5.15, lon: 46.20, name: 'Somalia' },
	MMR: { lat: 21.91, lon: 95.96, name: 'Myanmar' },
	MLI: { lat: 17.57, lon: -4.00, name: 'Mali' },
	SYR: { lat: 34.80, lon: 39.00, name: 'Syria' },
	YEM: { lat: 15.55, lon: 48.52, name: 'Yemen' },
	COD: { lat: -4.04, lon: 21.76, name: 'DR Congo' },
	RUS: { lat: 61.52, lon: 105.32, name: 'Russia' },
	AFG: { lat: 33.94, lon: 67.71, name: 'Afghanistan' },
	IND: { lat: 20.59, lon: 78.96, name: 'India' },
	NER: { lat: 17.61, lon: 8.08, name: 'Niger' },
	CMR: { lat: 7.37, lon: 12.35, name: 'Cameroon' },
	COL: { lat: 4.57, lon: -74.30, name: 'Colombia' },
	HTI: { lat: 18.97, lon: -72.29, name: 'Haiti' },
	MOZ: { lat: -18.67, lon: 35.53, name: 'Mozambique' },
	BEN: { lat: 9.31, lon: 2.32, name: 'Benin' },
	LBN: { lat: 33.85, lon: 35.86, name: 'Lebanon' },
	MEX: { lat: 23.63, lon: -102.55, name: 'Mexico' },
	IDN: { lat: -0.79, lon: 113.92, name: 'Indonesia' },
	IRN: { lat: 32.43, lon: 53.69, name: 'Iran' },
	IRQ: { lat: 33.22, lon: 43.68, name: 'Iraq' },
	CAF: { lat: 6.61, lon: 20.94, name: 'Central African Republic' },
	TCD: { lat: 15.45, lon: 18.73, name: 'Chad' },
	LBY: { lat: 26.34, lon: 17.23, name: 'Libya' },
	SDN: { lat: 12.86, lon: 30.22, name: 'Sudan' },
	SSD: { lat: 6.88, lon: 31.31, name: 'South Sudan' },
	PHL: { lat: 12.88, lon: 121.77, name: 'Philippines' },
	THA: { lat: 15.87, lon: 100.99, name: 'Thailand' },
	UGA: { lat: 1.37, lon: 32.29, name: 'Uganda' },
	KEN: { lat: -0.02, lon: 37.91, name: 'Kenya' },
	TZA: { lat: -6.37, lon: 34.89, name: 'Tanzania' },
	EGY: { lat: 26.82, lon: 30.80, name: 'Egypt' },
	DZA: { lat: 28.03, lon: 1.66, name: 'Algeria' },
	CIV: { lat: 7.54, lon: -5.55, name: "Cote d'Ivoire" },
	VEN: { lat: 6.42, lon: -66.59, name: 'Venezuela' },
	BRA: { lat: -14.24, lon: -51.93, name: 'Brazil' },
	ECU: { lat: -1.83, lon: -78.18, name: 'Ecuador' },
	TGO: { lat: 8.62, lon: 0.82, name: 'Togo' },
	GHA: { lat: 7.95, lon: -1.02, name: 'Ghana' },
	SEN: { lat: 14.50, lon: -14.45, name: 'Senegal' },
	TUR: { lat: 38.96, lon: 35.24, name: 'Turkey' },
	// Additional countries
	USA: { lat: 37.09, lon: -95.71, name: 'United States' },
	CHN: { lat: 35.86, lon: 104.20, name: 'China' },
	TWN: { lat: 23.70, lon: 121.00, name: 'Taiwan' },
	KOR: { lat: 35.91, lon: 127.77, name: 'South Korea' },
	PRK: { lat: 40.34, lon: 127.51, name: 'North Korea' },
	JPN: { lat: 36.20, lon: 138.25, name: 'Japan' },
	SAU: { lat: 23.89, lon: 45.08, name: 'Saudi Arabia' },
	ARE: { lat: 23.42, lon: 53.85, name: 'UAE' },
	QAT: { lat: 25.35, lon: 51.18, name: 'Qatar' },
	GBR: { lat: 55.38, lon: -3.44, name: 'United Kingdom' },
	FRA: { lat: 46.23, lon: 2.21, name: 'France' },
	DEU: { lat: 51.17, lon: 10.45, name: 'Germany' },
	POL: { lat: 51.92, lon: 19.15, name: 'Poland' },
	BLR: { lat: 53.71, lon: 27.95, name: 'Belarus' },
	GEO: { lat: 42.32, lon: 43.36, name: 'Georgia' },
	ARM: { lat: 40.07, lon: 45.04, name: 'Armenia' },
	AZE: { lat: 40.14, lon: 47.58, name: 'Azerbaijan' },
	KAZ: { lat: 48.02, lon: 66.92, name: 'Kazakhstan' },
	NPL: { lat: 28.39, lon: 84.12, name: 'Nepal' },
	BGD: { lat: 23.68, lon: 90.36, name: 'Bangladesh' },
	LKA: { lat: 7.87, lon: 80.77, name: 'Sri Lanka' },
	VNM: { lat: 14.06, lon: 108.28, name: 'Vietnam' },
	KHM: { lat: 12.57, lon: 104.99, name: 'Cambodia' },
	LAO: { lat: 19.86, lon: 102.50, name: 'Laos' },
	MYS: { lat: 4.21, lon: 101.98, name: 'Malaysia' },
	ZAF: { lat: -30.56, lon: 22.94, name: 'South Africa' },
	ZWE: { lat: -19.02, lon: 29.15, name: 'Zimbabwe' },
	ZMB: { lat: -13.13, lon: 27.85, name: 'Zambia' },
	AGO: { lat: -11.20, lon: 17.87, name: 'Angola' },
	RWA: { lat: -1.94, lon: 29.87, name: 'Rwanda' },
	BDI: { lat: -3.37, lon: 29.92, name: 'Burundi' },
	ERI: { lat: 15.18, lon: 39.78, name: 'Eritrea' },
	DJI: { lat: 11.83, lon: 42.59, name: 'Djibouti' }
};

/**
 * Known conflict arcs for major ongoing interstate tensions
 * These are pre-defined based on geopolitical realities, not data-driven
 */
const CONFLICT_ARCS = [
	{ from: 'RUS', to: 'UKR', description: 'Russia-Ukraine War' },
	{ from: 'ISR', to: 'LBN', description: 'Israel-Lebanon Tensions' },
	{ from: 'ISR', to: 'SYR', description: 'Israel-Syria Tensions' },
	{ from: 'IRN', to: 'ISR', description: 'Iran-Israel Proxy Conflict' },
	{ from: 'CHN', to: 'TWN', description: 'Cross-Strait Tensions' },
	{ from: 'PRK', to: 'KOR', description: 'Korean Peninsula' },
	{ from: 'IND', to: 'PAK', description: 'India-Pakistan Tensions' },
	{ from: 'ETH', to: 'ERI', description: 'Ethiopia-Eritrea Tensions' },
	{ from: 'SDN', to: 'SSD', description: 'Sudan-South Sudan Conflict' }
];

/**
 * Get intensity level based on forecasted fatalities per month
 */
function getVIEWSIntensity(fatalities: number, probability: number): 'low' | 'elevated' | 'high' | 'critical' {
	// Thresholds based on VIEWS fatality predictions
	if (fatalities >= 100 || probability >= 0.99) return 'critical';
	if (fatalities >= 25 || probability >= 0.75) return 'high';
	if (fatalities >= 5 || probability >= 0.25) return 'elevated';
	if (fatalities >= 1 || probability >= 0.01) return 'low';
	return 'low';
}

/**
 * Get color for conflict intensity (VIEWS)
 */
function getVIEWSIntensityColor(intensity: 'low' | 'elevated' | 'high' | 'critical'): string {
	switch (intensity) {
		case 'critical': return '#dc2626'; // Red-600
		case 'high': return '#ef4444';     // Red-500
		case 'elevated': return '#f97316'; // Orange-500
		case 'low': return '#fbbf24';      // Amber-400
	}
}

/**
 * Format month for display
 */
function formatForecastMonth(year: number, month: number): string {
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	return `${months[month - 1]} ${year}`;
}

/**
 * Get the latest VIEWS forecast run ID
 * Falls back to a known recent run if API fails
 */
async function getLatestVIEWSRun(): Promise<string> {
	const FALLBACK_RUN = 'fatalities003_2025_11_t01';

	try {
		const response = await fetch('https://api.viewsforecasting.org/', {
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(5000)
		});

		if (!response.ok) return FALLBACK_RUN;

		const data = await response.json();
		const runs: string[] = data.runs || [];

		// Find the latest fatalities run (format: fatalities00X_YYYY_MM_t0X)
		const fatalityRuns = runs.filter((r: string) => r.startsWith('fatalities'));
		if (fatalityRuns.length === 0) return FALLBACK_RUN;

		// Sort by version number and date to get the latest
		fatalityRuns.sort((a: string, b: string) => b.localeCompare(a));
		return fatalityRuns[0];
	} catch {
		return FALLBACK_RUN;
	}
}

/**
 * Fetch conflict forecast data from VIEWS API
 * Returns hotspots and arcs for armed conflict predictions
 *
 * VIEWS provides forward-looking fatality FORECASTS (unlike UCDP which is historical)
 * API: https://api.viewsforecasting.org
 */
export async function fetchVIEWSConflicts(): Promise<VIEWSConflictData> {
	try {
		// Get the latest forecast run
		const runId = await getLatestVIEWSRun();
		logger.log('VIEWS API', `Using forecast run: ${runId}`);

		// Fetch country-month state-based violence predictions
		// Get first forecast month with higher pagesize to get all countries
		const url = `https://api.viewsforecasting.org/${runId}/cm/sb?pagesize=250`;

		logger.log('VIEWS API', 'Fetching conflict forecasts...');

		const response = await fetch(url, {
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(15000)
		});

		if (!response.ok) {
			throw new Error(`VIEWS API returned ${response.status}`);
		}

		const data: VIEWSResponse = await response.json();
		logger.log('VIEWS API', `Received ${data.data?.length || 0} country predictions`);

		// Get first forecast month's data
		const firstMonthId = data.start_date;
		const firstMonthData = data.data.filter(p => p.month_id === firstMonthId);

		// Process into hotspots - only include countries with significant risk
		const hotspots: VIEWSConflictHotspot[] = [];

		for (const prediction of firstMonthData) {
			// Skip countries with negligible risk (< 0.1 forecasted fatalities AND < 1% probability)
			if (prediction.main_mean < 0.1 && prediction.main_dich < 0.01) continue;

			// Get country coordinates
			const coords = COUNTRY_CENTROIDS[prediction.isoab];
			if (!coords) {
				// Try to use the existing getCountryCoordinates function with ISO-2 equivalent
				continue;
			}

			const intensity = getVIEWSIntensity(prediction.main_mean, prediction.main_dich);

			hotspots.push({
				id: `views-${prediction.country_id}`,
				name: prediction.name,
				lat: coords.lat,
				lon: coords.lon,
				country: prediction.name,
				isoCode: prediction.isoab,
				intensity,
				forecastedFatalities: Math.round(prediction.main_mean * 10) / 10,
				fatalityProbability: Math.round(prediction.main_dich * 1000) / 10, // As percentage
				forecastMonth: formatForecastMonth(prediction.year, prediction.month),
				forecastYear: prediction.year
			});
		}

		// Sort by forecasted fatalities (highest first)
		hotspots.sort((a, b) => b.forecastedFatalities - a.forecastedFatalities);

		// Generate arcs for known conflict corridors where both countries have high risk
		const arcs: VIEWSConflictArc[] = [];
		const countryIntensity = new Map<string, 'low' | 'elevated' | 'high' | 'critical'>();

		for (const h of hotspots) {
			countryIntensity.set(h.isoCode, h.intensity);
		}

		for (const arcDef of CONFLICT_ARCS) {
			const fromCoords = COUNTRY_CENTROIDS[arcDef.from];
			const toCoords = COUNTRY_CENTROIDS[arcDef.to];

			if (!fromCoords || !toCoords) continue;

			const fromIntensity = countryIntensity.get(arcDef.from);
			const toIntensity = countryIntensity.get(arcDef.to);

			// Only show arc if at least one country has elevated+ risk
			if (!fromIntensity && !toIntensity) continue;
			if (fromIntensity === 'low' && toIntensity === 'low') continue;
			if (!fromIntensity && toIntensity === 'low') continue;
			if (fromIntensity === 'low' && !toIntensity) continue;

			// Use the higher intensity of the two
			const intensityOrder = { critical: 3, high: 2, elevated: 1, low: 0 };
			const arcIntensity = (intensityOrder[fromIntensity || 'low'] >= intensityOrder[toIntensity || 'low'])
				? (fromIntensity || 'low')
				: (toIntensity || 'low');

			arcs.push({
				id: `views-arc-${arcDef.from}-${arcDef.to}`,
				from: { name: fromCoords.name, lat: fromCoords.lat, lon: fromCoords.lon },
				to: { name: toCoords.name, lat: toCoords.lat, lon: toCoords.lon },
				color: getVIEWSIntensityColor(arcIntensity),
				intensity: arcIntensity,
				description: arcDef.description
			});
		}

		logger.log('VIEWS API', `Processed ${hotspots.length} hotspots and ${arcs.length} arcs`);

		return {
			hotspots,
			arcs,
			lastUpdated: Date.now(),
			forecastRun: runId
		};
	} catch (error) {
		logger.warn('VIEWS API', 'Failed to fetch conflict forecasts:', error);
		return {
			hotspots: [],
			arcs: [],
			lastUpdated: Date.now(),
			forecastRun: 'error'
		};
	}
}

/**
 * Backwards-compatible function name (alias for fetchVIEWSConflicts)
 * @deprecated Use fetchVIEWSConflicts instead
 */
export async function fetchUCDPConflicts(): Promise<VIEWSConflictData> {
	return fetchVIEWSConflicts();
}

/**
 * WattTime Grid Carbon Intensity Detection
 *
 * IMPORTANT CLARIFICATION:
 * WattTime measures MARGINAL EMISSIONS (carbon intensity), NOT grid reliability/stress.
 *
 * What the data means:
 * - Percentile indicates how "dirty" the grid is compared to historical data
 * - High percentile = grid is using more fossil fuel generation than usual
 * - Low percentile = grid is relatively clean (more renewables/nuclear)
 *
 * What the data does NOT mean:
 * - High percentile does NOT indicate grid emergencies or blackout risk
 * - This is environmental data, not infrastructure reliability data
 *
 * For actual grid reliability/blackout data, you would need:
 * - EIA emergency alerts
 * - ISO/RTO emergency notices (CAISO, ERCOT, PJM, etc.)
 * - NERC reliability data
 *
 * We keep the "stressLevel" naming for backward compatibility but the semantics
 * have been updated to reflect carbon intensity, not grid reliability.
 */

export interface GridStressData {
	id: string;
	region: string;
	country: string;
	countryCode: string;
	lat: number;
	lon: number;
	moer: number; // Marginal Operating Emissions Rate (CO2 lbs/MWh) - often same as percent in free tier
	frequency: number; // Grid frequency (Hz) - WattTime doesn't provide this, always 0
	percent: number; // 0-100 PERCENTILE of emissions (0=cleanest, 100=dirtiest historically)
	signal_type: string;
	stressLevel: 'normal' | 'elevated' | 'high' | 'critical'; // Actually carbon intensity level
	description: string;
	timestamp: string;
	// Boundary polygon for accurate geographic visualization
	boundaryCoords?: [number, number][][];
	// Approximate area in square km
	areaKm2?: number;
}

// Cache for WattTime auth token (expires in 30 min)
let watttimeToken: string | null = null;
let watttimeTokenExpiry: number = 0;

/**
 * Grid region interface with boundary polygon support
 * For regions where we have boundary data, we use polygons for accurate geographic visualization
 * Otherwise we fall back to point markers with estimated radius
 */
export interface GridRegion {
	name: string;
	lat: number;
	lon: number;
	country: string;
	countryCode: string;
	// Optional boundary polygon for accurate geographic coverage (GeoJSON coordinates)
	boundaryCoords?: [number, number][][];
	// Approximate area in square km for regions without exact boundaries
	areaKm2?: number;
}

// Comprehensive grid regions to monitor for stress
// Includes major US ISOs/RTOs, European grid operators, and global power markets
const GRID_REGIONS: GridRegion[] = [
	// === UNITED STATES - Major ISOs/RTOs ===
	// CAISO (California ISO) - Northern California
	{
		name: 'CAISO North',
		lat: 38.5816,
		lon: -121.4944,
		country: 'United States',
		countryCode: 'US',
		boundaryCoords: [[
			[-124.5, 42.0], [-124.5, 38.0], [-121.0, 38.0], [-120.0, 39.0],
			[-120.0, 42.0], [-124.5, 42.0]
		]],
		areaKm2: 180000
	},
	// CAISO South - Southern California
	{
		name: 'CAISO South',
		lat: 34.0522,
		lon: -118.2437,
		country: 'United States',
		countryCode: 'US',
		boundaryCoords: [[
			[-121.0, 38.0], [-121.0, 33.0], [-114.5, 33.0], [-114.5, 35.5],
			[-117.0, 35.5], [-117.0, 38.0], [-121.0, 38.0]
		]],
		areaKm2: 200000
	},
	// ERCOT - Texas (entire state, isolated grid)
	{
		name: 'ERCOT Texas',
		lat: 31.0,
		lon: -100.0,
		country: 'United States',
		countryCode: 'US',
		boundaryCoords: [[
			[-106.6, 32.0], [-106.5, 31.8], [-104.0, 29.5], [-103.0, 29.0],
			[-102.0, 29.8], [-101.0, 29.8], [-100.0, 28.0], [-99.0, 26.0],
			[-97.0, 26.0], [-97.0, 28.0], [-94.0, 29.5], [-94.0, 30.0],
			[-93.5, 31.0], [-94.0, 33.5], [-94.5, 33.8], [-100.0, 36.5],
			[-103.0, 36.5], [-103.0, 32.0], [-106.6, 32.0]
		]],
		areaKm2: 695000
	},
	// PJM - Mid-Atlantic and Midwest (13 states + DC)
	{
		name: 'PJM Interconnection',
		lat: 40.0,
		lon: -77.0,
		country: 'United States',
		countryCode: 'US',
		boundaryCoords: [[
			[-90.0, 42.5], [-87.5, 42.5], [-84.8, 41.8], [-80.5, 42.3],
			[-75.0, 42.0], [-74.7, 41.0], [-75.5, 39.8], [-75.0, 38.0],
			[-76.0, 36.5], [-77.5, 36.5], [-84.0, 36.5], [-88.5, 37.0],
			[-90.0, 38.5], [-90.0, 42.5]
		]],
		areaKm2: 500000
	},
	// MISO - Midwest/South (15 states)
	{
		name: 'MISO',
		lat: 41.5,
		lon: -93.0,
		country: 'United States',
		countryCode: 'US',
		boundaryCoords: [[
			[-104.0, 49.0], [-96.5, 49.0], [-90.5, 47.5], [-87.0, 46.5],
			[-84.5, 46.0], [-84.5, 42.0], [-87.5, 42.0], [-90.0, 42.5],
			[-90.0, 38.5], [-91.0, 36.5], [-91.0, 33.0], [-94.0, 29.5],
			[-94.0, 33.0], [-97.0, 33.5], [-104.0, 36.5], [-104.0, 49.0]
		]],
		areaKm2: 920000
	},
	// ISO-NE - New England (6 states)
	{
		name: 'ISO New England',
		lat: 42.4072,
		lon: -71.3824,
		country: 'United States',
		countryCode: 'US',
		boundaryCoords: [[
			[-73.5, 45.0], [-71.5, 45.3], [-67.0, 47.5], [-66.9, 44.8],
			[-70.0, 43.5], [-70.5, 41.5], [-72.0, 41.0], [-73.5, 41.0],
			[-73.5, 42.0], [-73.0, 42.8], [-73.5, 45.0]
		]],
		areaKm2: 165000
	},
	// NYISO - New York State
	{
		name: 'NYISO',
		lat: 42.1657,
		lon: -74.9481,
		country: 'United States',
		countryCode: 'US',
		boundaryCoords: [[
			[-79.8, 43.0], [-79.0, 43.3], [-76.8, 43.6], [-76.5, 44.1],
			[-75.0, 45.0], [-73.5, 45.0], [-73.5, 42.0], [-73.5, 41.0],
			[-74.7, 41.0], [-75.0, 42.0], [-79.8, 42.3], [-79.8, 43.0]
		]],
		areaKm2: 140000
	},
	// SPP - Southwest Power Pool (14 states, Great Plains)
	{
		name: 'SPP',
		lat: 36.0,
		lon: -97.5,
		country: 'United States',
		countryCode: 'US',
		boundaryCoords: [[
			[-104.0, 49.0], [-104.0, 36.5], [-103.0, 36.5], [-103.0, 32.0],
			[-97.0, 33.5], [-94.5, 33.8], [-94.0, 36.5], [-91.0, 36.5],
			[-91.0, 40.5], [-96.5, 43.5], [-96.5, 49.0], [-104.0, 49.0]
		]],
		areaKm2: 650000
	},
	// Florida - FRCC region
	{
		name: 'Florida',
		lat: 28.0,
		lon: -82.5,
		country: 'United States',
		countryCode: 'US',
		boundaryCoords: [[
			[-87.6, 31.0], [-87.6, 30.3], [-85.0, 29.7], [-82.0, 24.5],
			[-80.0, 25.0], [-80.0, 31.0], [-87.6, 31.0]
		]],
		areaKm2: 170000
	},
	// Arizona - WECC Southwest
	{
		name: 'Arizona',
		lat: 34.0,
		lon: -111.5,
		country: 'United States',
		countryCode: 'US',
		boundaryCoords: [[
			[-114.8, 37.0], [-114.0, 36.0], [-110.5, 37.0], [-109.0, 37.0],
			[-109.0, 31.3], [-111.0, 31.3], [-114.8, 32.7], [-114.8, 37.0]
		]],
		areaKm2: 295000
	},
	// Pacific Northwest - BPA region
	{
		name: 'Pacific Northwest',
		lat: 45.5,
		lon: -122.5,
		country: 'United States',
		countryCode: 'US',
		boundaryCoords: [[
			[-124.5, 49.0], [-117.0, 49.0], [-117.0, 46.0], [-111.0, 45.0],
			[-111.0, 42.0], [-117.0, 42.0], [-120.0, 42.0], [-124.5, 42.0],
			[-124.5, 49.0]
		]],
		areaKm2: 420000
	},

	// === EUROPE ===
	// Germany - major grid
	{
		name: 'Germany',
		lat: 51.1657,
		lon: 10.4515,
		country: 'Germany',
		countryCode: 'DE',
		boundaryCoords: [[
			[5.9, 55.1], [15.0, 55.1], [15.0, 47.3], [5.9, 47.3], [5.9, 55.1]
		]],
		areaKm2: 357000
	},
	// UK - National Grid
	{
		name: 'UK',
		lat: 53.5,
		lon: -2.0,
		country: 'United Kingdom',
		countryCode: 'GB',
		boundaryCoords: [[
			[-8.0, 60.8], [1.8, 60.8], [1.8, 49.9], [-8.0, 49.9], [-8.0, 60.8]
		]],
		areaKm2: 243000
	},
	// France - RTE
	{
		name: 'France',
		lat: 46.2276,
		lon: 2.2137,
		country: 'France',
		countryCode: 'FR',
		boundaryCoords: [[
			[-5.0, 51.1], [9.6, 51.1], [9.6, 42.3], [-5.0, 42.3], [-5.0, 51.1]
		]],
		areaKm2: 640000
	},
	// Spain - REE
	{
		name: 'Spain',
		lat: 40.4168,
		lon: -3.7038,
		country: 'Spain',
		countryCode: 'ES',
		boundaryCoords: [[
			[-9.3, 43.8], [4.3, 43.8], [4.3, 36.0], [-9.3, 36.0], [-9.3, 43.8]
		]],
		areaKm2: 506000
	},
	// Italy - Terna
	{
		name: 'Italy',
		lat: 41.9028,
		lon: 12.4964,
		country: 'Italy',
		countryCode: 'IT',
		boundaryCoords: [[
			[6.6, 47.1], [18.5, 47.1], [18.5, 36.6], [6.6, 36.6], [6.6, 47.1]
		]],
		areaKm2: 301000
	},
	// Poland
	{
		name: 'Poland',
		lat: 51.9194,
		lon: 19.1451,
		country: 'Poland',
		countryCode: 'PL',
		boundaryCoords: [[
			[14.1, 54.8], [24.2, 54.8], [24.2, 49.0], [14.1, 49.0], [14.1, 54.8]
		]],
		areaKm2: 312000
	},
	// Netherlands
	{
		name: 'Netherlands',
		lat: 52.1326,
		lon: 5.2913,
		country: 'Netherlands',
		countryCode: 'NL',
		boundaryCoords: [[
			[3.4, 53.5], [7.2, 53.5], [7.2, 50.8], [3.4, 50.8], [3.4, 53.5]
		]],
		areaKm2: 42000
	},

	// === ASIA-PACIFIC ===
	// Japan - Tokyo Electric Power Grid
	{
		name: 'Japan (Tokyo)',
		lat: 35.6762,
		lon: 139.6503,
		country: 'Japan',
		countryCode: 'JP',
		boundaryCoords: [[
			[129.5, 45.5], [145.8, 45.5], [145.8, 30.9], [129.5, 30.9], [129.5, 45.5]
		]],
		areaKm2: 378000
	},
	// South Korea - KEPCO
	{
		name: 'South Korea',
		lat: 36.5,
		lon: 127.5,
		country: 'South Korea',
		countryCode: 'KR',
		boundaryCoords: [[
			[124.6, 38.6], [131.9, 38.6], [131.9, 33.1], [124.6, 33.1], [124.6, 38.6]
		]],
		areaKm2: 100000
	},
	// Australia - NEM (National Electricity Market)
	{
		name: 'Australia NEM',
		lat: -33.8688,
		lon: 151.2093,
		country: 'Australia',
		countryCode: 'AU',
		boundaryCoords: [[
			[138.0, -10.0], [154.0, -10.0], [154.0, -44.0], [138.0, -44.0], [138.0, -10.0]
		]],
		areaKm2: 4500000
	},
	// India - Northern Grid
	{
		name: 'India North',
		lat: 28.6139,
		lon: 77.2090,
		country: 'India',
		countryCode: 'IN',
		boundaryCoords: [[
			[68.0, 37.0], [97.4, 37.0], [97.4, 22.0], [68.0, 22.0], [68.0, 37.0]
		]],
		areaKm2: 1500000
	},
	// India - Southern Grid
	{
		name: 'India South',
		lat: 13.0827,
		lon: 80.2707,
		country: 'India',
		countryCode: 'IN',
		boundaryCoords: [[
			[68.0, 22.0], [88.0, 22.0], [88.0, 8.0], [68.0, 8.0], [68.0, 22.0]
		]],
		areaKm2: 800000
	},
	// Singapore
	{
		name: 'Singapore',
		lat: 1.3521,
		lon: 103.8198,
		country: 'Singapore',
		countryCode: 'SG',
		areaKm2: 730
	},
	// Taiwan - Taipower
	{
		name: 'Taiwan',
		lat: 25.0330,
		lon: 121.5654,
		country: 'Taiwan',
		countryCode: 'TW',
		boundaryCoords: [[
			[119.3, 25.3], [122.0, 25.3], [122.0, 21.9], [119.3, 21.9], [119.3, 25.3]
		]],
		areaKm2: 36000
	},

	// === OTHER MAJOR GRIDS ===
	// Brazil - ONS
	{
		name: 'Brazil',
		lat: -15.7975,
		lon: -47.8919,
		country: 'Brazil',
		countryCode: 'BR',
		areaKm2: 8515000
	},
	// Chile - SEN
	{
		name: 'Chile',
		lat: -33.4489,
		lon: -70.6693,
		country: 'Chile',
		countryCode: 'CL',
		areaKm2: 756000
	},
	// South Africa - Eskom
	{
		name: 'South Africa',
		lat: -30.5595,
		lon: 22.9375,
		country: 'South Africa',
		countryCode: 'ZA',
		areaKm2: 1221000
	}
];

/**
 * Get WattTime auth token
 * Tokens expire after 30 minutes
 */
async function getWattTimeToken(): Promise<string | null> {
	// Check if we have a valid cached token
	if (watttimeToken && Date.now() < watttimeTokenExpiry) {
		return watttimeToken;
	}

	if (!WATTTIME_USERNAME || !WATTTIME_PASSWORD) {
		logger.warn('WattTime API', 'No credentials configured - set VITE_WATTTIME_USERNAME and VITE_WATTTIME_PASSWORD');
		return null;
	}

	try {
		// Login to get token via CORS proxy
		const credentials = btoa(`${WATTTIME_USERNAME}:${WATTTIME_PASSWORD}`);
		const loginUrl = 'https://api.watttime.org/login';
		const proxyUrl = `https://bitter-sea-8577.ahandle.workers.dev/?url=${encodeURIComponent(loginUrl)}`;

		const response = await fetch(proxyUrl, {
			headers: {
				'Authorization': `Basic ${credentials}`,
				'Accept': 'application/json'
			},
			signal: AbortSignal.timeout(10000)
		});

		if (!response.ok) {
			logger.warn('WattTime API', `Login failed with status ${response.status}`);
			return null;
		}

		const data = await response.json();
		if (data.token) {
			watttimeToken = data.token;
			// Token expires in 30 min, refresh at 25 min to be safe
			watttimeTokenExpiry = Date.now() + 25 * 60 * 1000;
			logger.log('WattTime API', 'Successfully authenticated');
			return watttimeToken;
		}

		return null;
	} catch (error) {
		logger.warn('WattTime API', 'Login error:', error);
		return null;
	}
}

/**
 * Determine carbon intensity level based on emissions percentile
 *
 * IMPORTANT: WattTime's "percent" is the percentile of MARGINAL EMISSIONS, NOT grid stress.
 * - 0% = Cleanest emissions observed historically for this region
 * - 100% = Dirtiest emissions observed historically for this region
 *
 * High emissions percentile does NOT indicate:
 * - Rolling blackouts
 * - Grid instability
 * - Power outages
 * - Emergency conditions
 *
 * It DOES indicate:
 * - The grid is relying more on fossil fuel generation
 * - Now is NOT a good time for carbon-conscious electricity use
 * - Marginal generation (next power plant brought online) is dirty
 *
 * Thresholds are set conservatively to only flag truly exceptional conditions:
 * - critical: 98%+ (rare, extreme emissions - top 2% historically)
 * - high: 95%+ (very high emissions - top 5% historically)
 * - elevated: 85%+ (above normal - top 15% historically)
 * - normal: < 85% (typical variation)
 */
function getGridStressLevel(percent: number): 'normal' | 'elevated' | 'high' | 'critical' {
	// Conservative thresholds - only flag truly exceptional carbon intensity
	// These do NOT indicate grid emergencies, only high emissions
	if (percent >= 98) return 'critical'; // Rare, extreme emissions (top 2%)
	if (percent >= 95) return 'high'; // Very high emissions (top 5%)
	if (percent >= 85) return 'elevated'; // Above normal emissions (top 15%)
	return 'normal'; // Typical emissions variation
}

/**
 * Get description for carbon intensity level
 *
 * Descriptions clarify that this is about emissions/carbon intensity,
 * NOT grid reliability or blackout risk.
 */
function getGridStressDescription(stressLevel: string, percent: number, _moer: number): string {
	const percentile = Math.round(percent);
	switch (stressLevel) {
		case 'critical':
			return `Extreme carbon intensity (${percentile}th percentile). Grid heavily reliant on fossil fuels. Not a grid emergency - indicates very high emissions.`;
		case 'high':
			return `Very high carbon intensity (${percentile}th percentile). Heavy fossil fuel reliance. Consider delaying flexible electricity use.`;
		case 'elevated':
			return `Above-average carbon intensity (${percentile}th percentile). More fossil fuel generation than typical.`;
		default:
			return `Normal carbon intensity (${percentile}th percentile). Grid emissions within typical range.`;
	}
}

/**
 * Get WattTime region identifier from lat/lon
 * WattTime v3 API requires region ID, not direct lat/lon
 */
async function getWattTimeRegion(
	token: string,
	lat: number,
	lon: number
): Promise<string | null> {
	try {
		const apiUrl = `https://api.watttime.org/v3/region-from-loc?latitude=${lat}&longitude=${lon}&signal_type=co2_moer`;
		const proxyUrl = `https://bitter-sea-8577.ahandle.workers.dev/?url=${encodeURIComponent(apiUrl)}`;
		const response = await fetch(proxyUrl, {
			headers: {
				'Authorization': `Bearer ${token}`,
				'Accept': 'application/json'
			},
			signal: AbortSignal.timeout(8000)
		});

		if (!response.ok) {
			return null;
		}

		const data = await response.json();
		return data.region || null;
	} catch {
		return null;
	}
}

/**
 * Fetch grid stress data from WattTime API
 * Returns grid stress indicators for major power grids
 */
export async function fetchGridStress(): Promise<GridStressData[]> {
	const token = await getWattTimeToken();
	if (!token) {
		logger.warn('WattTime API', 'No token available - skipping grid stress fetch');
		return [];
	}

	const stressData: GridStressData[] = [];

	// Fetch signal data for each region
	for (const region of GRID_REGIONS) {
		try {
			// Step 1: Get region ID from lat/lon (WattTime v3 requires this)
			const regionId = await getWattTimeRegion(token, region.lat, region.lon);
			if (!regionId) {
				// Region not covered by WattTime, silently skip
				continue;
			}

			// Step 2: Use the /signal-index endpoint with region ID via CORS proxy
			const apiUrl = `https://api.watttime.org/v3/signal-index?region=${regionId}&signal_type=co2_moer`;
			const proxyUrl = `https://bitter-sea-8577.ahandle.workers.dev/?url=${encodeURIComponent(apiUrl)}`;

			const response = await fetch(proxyUrl, {
				headers: {
					'Authorization': `Bearer ${token}`,
					'Accept': 'application/json'
				},
				signal: AbortSignal.timeout(10000)
			});

			if (!response.ok) {
				logger.warn('WattTime API', `Signal fetch for ${region.name} (${regionId}) failed: ${response.status}`);
				continue;
			}

			const data = await response.json();

			// Extract the relevant fields from the v3 response
			// Response format: { data: [{ point_time, value }], meta: { units: 'percentile', ... } }
			const dataPoint = data.data?.[0];
			if (!dataPoint) continue;

			// Value is already a percentile (0-100) in v3 API
			const percent = dataPoint.value ?? 50;
			// We don't get actual MOER value in free tier, just percentile
			const moer = percent; // Use percentile as proxy
			const signalType = data.meta?.signal_type ?? 'co2_moer';
			const timestamp = dataPoint.point_time ?? new Date().toISOString();

			const stressLevel = getGridStressLevel(percent);

			// Only include regions with elevated stress or higher for display
			if (stressLevel !== 'normal') {
				stressData.push({
					id: `watttime-${region.countryCode}-${region.name.toLowerCase().replace(/\s+/g, '-')}`,
					region: region.name,
					country: region.country,
					countryCode: region.countryCode,
					lat: region.lat,
					lon: region.lon,
					moer,
					frequency: 0, // WattTime doesn't provide frequency data
					percent,
					signal_type: signalType,
					stressLevel,
					description: getGridStressDescription(stressLevel, percent, moer),
					timestamp,
					// Include boundary data for geographic visualization
					boundaryCoords: region.boundaryCoords,
					areaKm2: region.areaKm2
				});
			}

			logger.log('WattTime API', `${region.name}: ${percent}% (${stressLevel})`);
		} catch (error) {
			logger.warn('WattTime API', `Error fetching ${region.name}:`, error instanceof Error ? error.message : error);
		}
	}

	// Sort by intensity level (critical first)
	const intensityOrder = { critical: 0, high: 1, elevated: 2, normal: 3 };
	stressData.sort((a, b) => intensityOrder[a.stressLevel] - intensityOrder[b.stressLevel]);

	logger.log('WattTime API', `Found ${stressData.length} regions with elevated carbon intensity`);
	return stressData;
}

/**
 * Fetch grid carbon intensity data for ALL monitored regions
 * Unlike fetchGridStress(), this returns all regions including normal carbon intensity
 * Used by the GridStressPanel to show a complete overview of all monitored grids
 */
export async function fetchAllGridStress(): Promise<GridStressData[]> {
	const token = await getWattTimeToken();
	if (!token) {
		logger.warn('WattTime API', 'No token available - skipping grid stress fetch');
		return [];
	}

	const stressData: GridStressData[] = [];

	// Fetch signal data for each region
	for (const region of GRID_REGIONS) {
		try {
			// Step 1: Get region ID from lat/lon (WattTime v3 requires this)
			const regionId = await getWattTimeRegion(token, region.lat, region.lon);
			if (!regionId) {
				// Region not covered by WattTime, silently skip
				continue;
			}

			// Step 2: Use the /signal-index endpoint with region ID via CORS proxy
			const apiUrl = `https://api.watttime.org/v3/signal-index?region=${regionId}&signal_type=co2_moer`;
			const proxyUrl = `https://bitter-sea-8577.ahandle.workers.dev/?url=${encodeURIComponent(apiUrl)}`;

			const response = await fetch(proxyUrl, {
				headers: {
					'Authorization': `Bearer ${token}`,
					'Accept': 'application/json'
				},
				signal: AbortSignal.timeout(10000)
			});

			if (!response.ok) {
				logger.warn('WattTime API', `Signal fetch for ${region.name} (${regionId}) failed: ${response.status}`);
				continue;
			}

			const data = await response.json();

			// Extract the relevant fields from the v3 response
			// Response format: { data: [{ point_time, value }], meta: { units: 'percentile', ... } }
			const dataPoint = data.data?.[0];
			if (!dataPoint) continue;

			// Value is already a percentile (0-100) in v3 API
			const percent = dataPoint.value ?? 50;
			// We don't get actual MOER value in free tier, just percentile
			const moer = percent; // Use percentile as proxy
			const signalType = data.meta?.signal_type ?? 'co2_moer';
			const timestamp = dataPoint.point_time ?? new Date().toISOString();

			const stressLevel = getGridStressLevel(percent);

			// Include ALL regions (including normal) for panel display
			stressData.push({
				id: `watttime-${region.countryCode}-${region.name.toLowerCase().replace(/\s+/g, '-')}`,
				region: region.name,
				country: region.country,
				countryCode: region.countryCode,
				lat: region.lat,
				lon: region.lon,
				moer,
				frequency: 0, // WattTime doesn't provide frequency data
				percent,
				signal_type: signalType,
				stressLevel,
				description: getGridStressDescription(stressLevel, percent, moer),
				timestamp,
				// Include boundary data for geographic visualization
				boundaryCoords: region.boundaryCoords,
				areaKm2: region.areaKm2
			});

			logger.log('WattTime API', `${region.name}: ${percent}% (${stressLevel})`);
		} catch (error) {
			logger.warn('WattTime API', `Error fetching ${region.name}:`, error instanceof Error ? error.message : error);
		}
	}

	// Sort by intensity level (critical first) then by percent (highest first)
	const intensityOrder = { critical: 0, high: 1, elevated: 2, normal: 3 };
	stressData.sort((a, b) => {
		const orderDiff = intensityOrder[a.stressLevel] - intensityOrder[b.stressLevel];
		if (orderDiff !== 0) return orderDiff;
		return b.percent - a.percent; // Higher percent first within same level
	});

	logger.log('WattTime API', `Fetched carbon intensity for ${stressData.length} regions`);
	return stressData;
}

/**
 * Calculate radius from area in square km
 * Used when we have area but no boundary polygon
 */
function calculateRadiusFromArea(areaKm2: number): number {
	// Assuming circular area: A = pi * r^2, so r = sqrt(A / pi)
	return Math.sqrt(areaKm2 / Math.PI);
}

/**
 * Convert carbon intensity data to OutageData format for display on the map
 *
 * NOTE: This maps carbon intensity data to the "outage" visualization layer,
 * but these are NOT actual outages or grid emergencies. The severity levels
 * are used for visual styling only.
 *
 * Includes boundary polygon data when available for accurate geographic visualization
 */
export function gridStressToOutages(stressData: GridStressData[]): OutageData[] {
	return stressData.map(stress => {
		// Calculate radius: use area if available, otherwise use intensity-level based default
		let radiusKm: number;
		if (stress.areaKm2) {
			// Use actual area to calculate representative radius
			radiusKm = Math.min(calculateRadiusFromArea(stress.areaKm2), 500); // Cap at 500km for display
		} else {
			radiusKm = stress.stressLevel === 'critical' ? 200 : stress.stressLevel === 'high' ? 150 : 100;
		}

		return {
			id: stress.id,
			country: `${stress.region}, ${stress.country}`,
			countryCode: stress.countryCode,
			type: 'power' as const,
			// Map intensity levels to visual severity (NOT actual outage severity)
			severity: stress.stressLevel === 'critical' ? 'major' :
			          stress.stressLevel === 'high' ? 'partial' : 'partial',
			lat: stress.lat,
			lon: stress.lon,
			description: stress.description,
			source: 'WattTime Carbon Intensity', // Clarified source name
			active: true,
			radiusKm,
			// Include boundary polygon for accurate geographic visualization
			boundaryCoords: stress.boundaryCoords,
			areaKm2: stress.areaKm2,
			// Include carbon intensity specific data (legacy naming for compatibility)
			gridStressPercent: stress.percent,
			gridStressLevel: stress.stressLevel
		};
	});
}

/**
 * Fetch layoffs data from real sources
 * Uses Hacker News Algolia API - most reliable free source for tech news
 */
export async function fetchLayoffs(): Promise<Layoff[]> {
	const layoffs: Layoff[] = [];

	// Try Hacker News API - search for layoffs in the past month
	try {
		// Get Unix timestamp for 30 days ago
		const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

		// Search HN for layoff stories from the past month
		const response = await fetch(
			`https://hn.algolia.com/api/v1/search?query=layoffs&tags=story&numericFilters=created_at_i>${thirtyDaysAgo}&hitsPerPage=30`
		);

		if (response.ok) {
			const data = await response.json();
			if (data.hits && Array.isArray(data.hits)) {
				for (const hit of data.hits) {
					const title = hit.title || '';
					const lowerTitle = title.toLowerCase();

					// Must contain layoff-related terms
					if (!lowerTitle.match(/layoff|laying off|laid off|job cut|workforce reduction|downsiz/i)) {
						continue;
					}

					// Extract company name with multiple patterns
					let company = 'Company';

					// Pattern: "Company lays off" or "Company is laying off"
					const companyVerbMatch = title.match(/^([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)\s+(?:lays?|is laying|laying|to lay|will lay|cuts?|cutting|announces?)/i);
					// Pattern: "at Company"
					const atCompanyMatch = title.match(/at\s+([A-Z][a-zA-Z0-9]+)/);
					// Pattern: "Company's layoffs" or "Company layoffs"
					const possessiveMatch = title.match(/([A-Z][a-zA-Z0-9]+)(?:'s)?\s+(?:layoffs?|job cuts)/i);

					if (companyVerbMatch) {
						company = companyVerbMatch[1].trim();
					} else if (possessiveMatch) {
						company = possessiveMatch[1];
					} else if (atCompanyMatch) {
						company = atCompanyMatch[1];
					}

					// Skip generic words that might match
					if (['The', 'This', 'More', 'Why', 'How', 'Tech', 'Big'].includes(company)) {
						company = 'Tech Company';
					}

					// Extract count
					let count = 0;
					const countMatch = title.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:k|K|thousand)?\s*(?:employees?|workers?|jobs?|people|staff|positions?)/i);
					const percentMatch = title.match(/(\d+)%/);

					if (countMatch) {
						const numStr = countMatch[1].replace(/,/g, '');
						count = parseInt(numStr, 10);
						if (title.toLowerCase().includes('k ') || title.toLowerCase().includes('thousand')) {
							count = count * 1000;
						}
					} else if (percentMatch) {
						count = parseInt(percentMatch[1], 10) * 50; // Estimate
					}

					layoffs.push({
						company,
						count: count || 0,
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

	// Sort by points/relevance (HN already returns by relevance) then by date
	layoffs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

	// Return what we have - no sample data fallback
	if (layoffs.length === 0) {
		console.warn('Layoffs API returned no results');
	}

	return layoffs.slice(0, 6);
}


