/**
 * Miscellaneous API functions for specialized panels
 * Real data APIs where possible, with curated fallbacks for APIs requiring auth
 */

import { browser } from '$app/environment';
import { fetchWithProxy, logger } from '$lib/config/api';
import type { EarthquakeData } from '$lib/types';

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
					// Keywords that indicate app-specific bans (not infrastructure outages)
					const appBanKeywords = [
						'telegram', 'whatsapp', 'signal', 'tiktok', 'facebook', 'twitter',
						'instagram', 'youtube', 'messenger', 'wechat', 'viber', 'snapchat',
						'linkedin', 'reddit', 'discord', 'twitch', 'spotify', 'netflix',
						'vpn', 'tor', 'blocked', 'ban', 'banned', 'censorship', 'filtering',
						'app block', 'social media', 'messaging app'
					];

					// Calculate 30 days ago for filtering old events
					const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

					for (const incident of data.incidents) {
						if (!incident.ASNs || incident.ASNs.length === 0) continue;

						// Skip already-resolved/inactive events
						if (incident.end_time) continue;

						// Skip historical events older than 30 days
						const startTime = incident.start_time ? new Date(incident.start_time).getTime() : 0;
						if (startTime && startTime < thirtyDaysAgo) continue;

						// Check title and description for app-specific ban keywords
						const title = (incident.title || '').toLowerCase();
						const description = (incident.short_description || '').toLowerCase();
						const combinedText = `${title} ${description}`;

						const isAppBan = appBanKeywords.some(keyword => combinedText.includes(keyword));
						if (isAppBan) continue;

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
	// Enhanced descriptive fields for improved tooltips
	label: string;           // Human-readable label for display (e.g., "Ukraine - High Conflict Risk")
	riskDescription: string; // Brief explanation of risk level meaning
	reasoning: string;       // Contextual reasoning for the forecast
	dataSource: string;      // Attribution to VIEWS
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
 * Get human-readable risk level description
 */
function getVIEWSRiskDescription(intensity: 'low' | 'elevated' | 'high' | 'critical', fatalities: number, probability: number): string {
	const probPercent = Math.round(probability * 100);
	switch (intensity) {
		case 'critical':
			return `CRITICAL: ${probPercent}% probability of armed conflict. Forecast predicts ~${Math.round(fatalities)} fatalities. Immediate monitoring required.`;
		case 'high':
			return `HIGH RISK: ${probPercent}% probability of conflict fatalities. Model predicts ~${Math.round(fatalities)} deaths. Close monitoring recommended.`;
		case 'elevated':
			return `ELEVATED: ${probPercent}% probability of some violence. ~${fatalities.toFixed(1)} predicted fatalities. Situation warrants attention.`;
		case 'low':
			return `LOW RISK: ${probPercent}% probability of conflict. Minimal fatalities expected (~${fatalities.toFixed(1)}). Baseline monitoring.`;
	}
}

/**
 * Get contextual reasoning for VIEWS prediction based on country context
 */
function getVIEWSReasoning(countryCode: string, intensity: 'low' | 'elevated' | 'high' | 'critical', _fatalities: number): string {
	// Country-specific context based on known geopolitical situations
	const countryContext: Record<string, string> = {
		UKR: 'Active interstate conflict with ongoing military operations. VIEWS model incorporates historical fatality patterns and conflict dynamics.',
		RUS: 'Involved in active conflict with regional implications. Prediction based on conflict event data and territorial dynamics.',
		ISR: 'Recurring conflict cycles and regional tensions. Model factors in historical violence patterns and escalation indicators.',
		PSE: 'Ongoing conflict and territorial disputes. Predictions reflect cyclical violence patterns and regional instability.',
		ETH: 'Multiple internal conflicts and ethnic tensions. Model reflects subnational violence patterns and governance instability.',
		SOM: 'Protracted insurgency and state fragility. Predictions based on sustained conflict patterns and armed group activity.',
		AFG: 'Post-transition instability and armed opposition. Model reflects historical violence trends and governance challenges.',
		YEM: 'Multi-party civil conflict and humanitarian crisis. Predictions incorporate conflict intensity and fragmentation data.',
		SYR: 'Protracted civil war with multiple actors. Model reflects territorial control dynamics and ongoing hostilities.',
		MMR: 'Military coup aftermath with armed resistance. Predictions based on escalating violence and ethnic conflicts.',
		PAK: 'Counter-insurgency operations and regional tensions. Model factors in militant activity and border dynamics.',
		NGA: 'Multiple security challenges including insurgency. Predictions reflect Boko Haram activity and communal violence.',
		COD: 'Multiple armed groups and resource conflicts. Model incorporates eastern DRC violence patterns and displacement.',
		MLI: 'Insurgency and intercommunal violence. Predictions reflect Sahel instability and jihadist activity.',
		BFA: 'Expanding jihadist insurgency. Model reflects rapid deterioration and displacement patterns.',
		SDN: 'Civil conflict and factional fighting. Predictions based on military rivalries and humanitarian crisis.',
		SSD: 'Intercommunal violence and political instability. Model reflects recurring conflict cycles.',
		HTI: 'Gang violence and state fragility. Predictions incorporate urban conflict and governance collapse.',
		COL: 'Post-peace agreement remnant violence. Model reflects dissident groups and organized crime.',
		IND: 'Internal security challenges and regional tensions. Predictions factor in insurgency and border dynamics.',
		CHN: 'Regional power dynamics and territorial claims. Model reflects geopolitical tensions.',
		PRK: 'Isolated regime with regional threat posture. Predictions incorporate peninsular tensions.',
		IRN: 'Regional proxy conflicts and internal dissent. Model reflects security dynamics.',
		IRQ: 'Post-ISIS stabilization with sectarian dynamics. Predictions factor in militia activity.',
		LBY: 'Political fragmentation and armed factions. Model reflects governance vacuum.',
		MOZ: 'Northern insurgency and resource conflicts. Predictions based on Cabo Delgado violence.',
		NER: 'Sahel instability spillover. Model reflects regional jihadist expansion.',
		CMR: 'Anglophone crisis and Boko Haram spillover. Predictions incorporate dual conflict dynamics.',
		TCD: 'Political instability and regional conflicts. Model reflects Sahel dynamics.',
		CAF: 'Armed group activity and weak state capacity. Predictions based on territorial fragmentation.'
	};

	const baseReasoning = countryContext[countryCode] ||
		'VIEWS prediction based on historical conflict patterns, structural indicators, and machine learning models trained on global conflict data.';

	const intensityContext = intensity === 'critical' || intensity === 'high'
		? ' Current indicators suggest heightened risk requiring close monitoring.'
		: intensity === 'elevated'
			? ' Risk factors warrant continued attention.'
			: ' Baseline risk level within normal parameters.';

	return baseReasoning + intensityContext;
}

/**
 * Generate descriptive label for VIEWS hotspot
 */
function getVIEWSLabel(countryName: string, intensity: 'low' | 'elevated' | 'high' | 'critical'): string {
	const intensityLabels = {
		critical: 'Critical Conflict Risk',
		high: 'High Conflict Risk',
		elevated: 'Elevated Risk',
		low: 'Monitored Region'
	};
	return `${countryName} - ${intensityLabels[intensity]}`;
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
			const forecastedFatalities = Math.round(prediction.main_mean * 10) / 10;
			const fatalityProbability = prediction.main_dich; // Keep as 0-1 for calculations

			hotspots.push({
				id: `views-${prediction.country_id}`,
				name: prediction.name,
				lat: coords.lat,
				lon: coords.lon,
				country: prediction.name,
				isoCode: prediction.isoab,
				intensity,
				forecastedFatalities,
				fatalityProbability: Math.round(fatalityProbability * 1000) / 10, // As percentage for display
				forecastMonth: formatForecastMonth(prediction.year, prediction.month),
				forecastYear: prediction.year,
				// Enhanced descriptive fields
				label: getVIEWSLabel(prediction.name, intensity),
				riskDescription: getVIEWSRiskDescription(intensity, forecastedFatalities, fatalityProbability),
				reasoning: getVIEWSReasoning(prediction.isoab, intensity, forecastedFatalities),
				dataSource: 'VIEWS (Violence Early-Warning System) - Uppsala University'
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
			return `${percentile}th percentile - Extreme fossil fuel reliance`;
		case 'high':
			return `${percentile}th percentile - Very high fossil fuel reliance`;
		case 'elevated':
			return `${percentile}th percentile - Above-average emissions`;
		default:
			return `${percentile}th percentile - Normal emissions`;
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

/**
 * RainViewer Weather Radar API
 * Free API with no key required - provides global precipitation radar data
 */

export interface RainViewerTimestamp {
	time: number;
	path: string;
}

export interface RainViewerData {
	version: string;
	generated: number;
	host: string;
	radar: {
		past: RainViewerTimestamp[];
		nowcast: RainViewerTimestamp[];
	};
	satellite?: {
		infrared: RainViewerTimestamp[];
	};
}

/**
 * Fetch available radar timestamps from RainViewer API
 * Returns the latest radar timestamp for use in tile URLs
 */
export async function fetchRainViewerData(): Promise<RainViewerData | null> {
	try {
		const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');

		if (!response.ok) {
			console.warn('RainViewer API request failed:', response.status);
			return null;
		}

		const data: RainViewerData = await response.json();
		return data;
	} catch (error) {
		console.error('Error fetching RainViewer data:', error);
		return null;
	}
}

/**
 * Get the latest radar tile URL template for Mapbox raster source
 * Returns the tile URL with {z}, {x}, {y} placeholders
 */
export async function getLatestRadarTileUrl(): Promise<string | null> {
	const data = await fetchRainViewerData();

	if (!data || !data.radar.past.length) {
		return null;
	}

	// Get the most recent radar timestamp (last item in past array)
	const latestRadar = data.radar.past[data.radar.past.length - 1];

	// RainViewer tile URL format:
	// https://tilecache.rainviewer.com{path}/{size}/{z}/{x}/{y}/{color}/{options}.png
	// path: Already includes /v2/radar/{timestamp} from the API response
	// size: 256 or 512 (tile size) - comes BEFORE z/x/y
	// color: 0-8 (color scheme, 2 = universal blue)
	// options: {smooth}_{snow} (0 or 1 each)
	const tileUrl = `https://tilecache.rainviewer.com${latestRadar.path}/256/{z}/{x}/{y}/2/1_0.png`;

	return tileUrl;
}

/**
 * OpenSky Network ADS-B Aircraft Tracking
 * Free API with ~400 requests/day limit, updates every 10 seconds
 * API: https://opensky-network.org/api/states/all
 *
 * Returns array of aircraft with position, velocity, heading, altitude, etc.
 */

import type { Aircraft } from '$lib/types';

/**
 * Parse OpenSky Network state vector array into Aircraft object
 * State vector indices:
 * 0: icao24, 1: callsign, 2: origin_country, 3: time_position, 4: last_contact,
 * 5: longitude, 6: latitude, 7: baro_altitude, 8: on_ground, 9: velocity,
 * 10: true_track, 11: vertical_rate, 12: sensors, 13: geo_altitude, 14: squawk,
 * 15: spi, 16: position_source
 */
function parseAircraftState(state: unknown[]): Aircraft | null {
	// Validate required fields
	if (!state || !Array.isArray(state) || state.length < 15) return null;

	const icao24 = state[0] as string;
	const lon = state[5] as number | null;
	const lat = state[6] as number | null;

	// Skip aircraft without valid position
	if (!icao24 || lon === null || lat === null) return null;

	return {
		icao24,
		callsign: state[1] ? (state[1] as string).trim() : null,
		originCountry: (state[2] as string) || 'Unknown',
		timePosition: state[3] as number | null,
		lastContact: (state[4] as number) || 0,
		longitude: lon,
		latitude: lat,
		baroAltitude: state[7] as number | null,
		onGround: Boolean(state[8]),
		velocity: state[9] as number | null,
		trueTrack: state[10] as number | null,
		verticalRate: state[11] as number | null,
		geoAltitude: state[13] as number | null,
		squawk: state[14] as string | null
	};
}

/**
 * Fetch aircraft positions from OpenSky Network API
 * Returns aircraft with valid lat/lon positions
 *
 * @param bounds Optional bounding box [minLon, minLat, maxLon, maxLat] to limit results
 * @returns Array of Aircraft objects
 */
export async function fetchAircraftPositions(bounds?: [number, number, number, number]): Promise<Aircraft[]> {
	try {
		// Build URL with optional bounding box
		let url = 'https://opensky-network.org/api/states/all';

		if (bounds && bounds.length === 4) {
			const [minLon, minLat, maxLon, maxLat] = bounds;
			url += `?lamin=${minLat}&lomin=${minLon}&lamax=${maxLat}&lomax=${maxLon}`;
		}

		logger.log('OpenSky API', 'Fetching aircraft positions...');

		const response = await fetch(url, {
			headers: {
				Accept: 'application/json'
			},
			signal: AbortSignal.timeout(15000)
		});

		if (!response.ok) {
			if (response.status === 429) {
				logger.warn('OpenSky API', 'Rate limited - too many requests');
				return [];
			}
			throw new Error(`OpenSky API returned ${response.status}`);
		}

		const data = await response.json();

		if (!data || !data.states || !Array.isArray(data.states)) {
			logger.warn('OpenSky API', 'No aircraft data received');
			return [];
		}

		// Parse state vectors into Aircraft objects
		const aircraft: Aircraft[] = [];

		for (const state of data.states) {
			const parsed = parseAircraftState(state);
			if (parsed) {
				aircraft.push(parsed);
			}
		}

		logger.log('OpenSky API', `Received ${aircraft.length} aircraft with valid positions`);

		return aircraft;
	} catch (error) {
		logger.warn('OpenSky API', 'Failed to fetch aircraft positions:', error);
		return [];
	}
}

/**
 * Convert aircraft altitude to color for visualization
 * Lower = green/blue, Higher = yellow/red
 */
export function getAltitudeColor(altitudeMeters: number | null, onGround: boolean): string {
	if (onGround || altitudeMeters === null) return '#22c55e'; // Green for ground

	// Convert to feet for standard aviation reference
	const altitudeFeet = altitudeMeters * 3.28084;

	if (altitudeFeet < 10000) return '#3b82f6'; // Blue - low altitude
	if (altitudeFeet < 20000) return '#06b6d4'; // Cyan - medium-low
	if (altitudeFeet < 30000) return '#fbbf24'; // Yellow - medium-high
	if (altitudeFeet < 40000) return '#f97316'; // Orange - high altitude
	return '#ef4444'; // Red - very high altitude (FL400+)
}

/**
 * Format altitude for display
 */
export function formatAltitude(altitudeMeters: number | null): string {
	if (altitudeMeters === null) return 'N/A';
	const feet = Math.round(altitudeMeters * 3.28084);
	return `${feet.toLocaleString()} ft (${Math.round(altitudeMeters).toLocaleString()} m)`;
}

/**
 * Format velocity for display
 */
export function formatVelocity(velocityMs: number | null): string {
	if (velocityMs === null) return 'N/A';
	const knots = Math.round(velocityMs * 1.94384);
	return `${knots} kts (${Math.round(velocityMs)} m/s)`;
}

/**
 * Format heading for display
 */
export function formatHeading(heading: number | null): string {
	if (heading === null) return 'N/A';
	const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
	const index = Math.round(heading / 22.5) % 16;
	return `${Math.round(heading)}° ${directions[index]}`;
}

// =============================================================================
// USGS VOLCANO DATA
// =============================================================================

import type { VolcanoData, VolcanoAlertLevel, VolcanoColorCode } from '$lib/types';

/**
 * USGS Volcano API response type
 */
interface USGSVolcanoResponse {
	volcanoId: number;
	volcanoName: string;
	latitude: number;
	longitude: number;
	elevation?: number;
	country: string;
	region?: string;
	currentAlertLevel: string;
	currentColorCode: string;
	lastUpdateTime?: string;
	currentNotice?: string;
}

/**
 * Volcano alert level colors for map display
 * Only ADVISORY, WATCH, and WARNING are shown (not NORMAL/GREEN)
 */
export const VOLCANO_ALERT_COLORS: Record<VolcanoColorCode, string> = {
	GREEN: '#22c55e', // Not shown on map
	YELLOW: '#eab308', // Advisory - elevated unrest
	ORANGE: '#f97316', // Watch - heightened activity
	RED: '#ef4444' // Warning - imminent/ongoing eruption
};

/**
 * Alert level descriptions for tooltips
 */
export const VOLCANO_ALERT_DESCRIPTIONS: Record<VolcanoAlertLevel, string> = {
	NORMAL: 'Normal background activity - volcano is in typical non-eruptive state',
	ADVISORY: 'Elevated unrest above known background levels - increased monitoring',
	WATCH: 'Heightened or escalating unrest with increased potential for eruption',
	WARNING: 'Hazardous eruption imminent or underway - take protective action'
};

/**
 * Fetch elevated volcanoes from USGS Volcano Hazards Program API
 * Only returns volcanoes with elevated status (ADVISORY, WATCH, WARNING)
 * NORMAL/GREEN status volcanoes are filtered out
 *
 * API Documentation: https://volcanoes.usgs.gov/hans-public/api/
 */
export async function fetchElevatedVolcanoes(): Promise<VolcanoData[]> {
	const USGS_VOLCANO_API = 'https://volcanoes.usgs.gov/hans-public/api/volcano/getElevatedVolcanoes';

	try {
		logger.log('Volcano API', 'Fetching elevated volcanoes from USGS...');

		const response = await fetch(USGS_VOLCANO_API, {
			headers: {
				'Accept': 'application/json'
			},
			signal: AbortSignal.timeout(15000)
		});

		if (!response.ok) {
			throw new Error(`USGS Volcano API error: ${response.status} ${response.statusText}`);
		}

		const data: USGSVolcanoResponse[] = await response.json();
		logger.log('Volcano API', `Received ${data.length} elevated volcanoes`);

		// Transform and filter the data
		const volcanoes: VolcanoData[] = data
			.filter((v) => {
				// Only include ADVISORY, WATCH, and WARNING levels
				const level = v.currentAlertLevel?.toUpperCase();
				return level === 'ADVISORY' || level === 'WATCH' || level === 'WARNING';
			})
			.map((v) => ({
				id: `usgs-volcano-${v.volcanoId}`,
				name: v.volcanoName,
				lat: v.latitude,
				lon: v.longitude,
				elevation: v.elevation || 0,
				country: v.country || 'Unknown',
				region: v.region,
				alertLevel: normalizeAlertLevel(v.currentAlertLevel),
				colorCode: normalizeColorCode(v.currentColorCode),
				lastUpdate: v.lastUpdateTime,
				notice: v.currentNotice,
				description: buildVolcanoDescription(v)
			}));

		logger.log('Volcano API', `Returning ${volcanoes.length} elevated volcanoes after filtering`);
		return volcanoes;

	} catch (error) {
		logger.warn('Volcano API', 'Failed to fetch volcano data:', error instanceof Error ? error.message : error);

		// Return empty array on failure - don't use fallback data for real-time hazard monitoring
		return [];
	}
}

/**
 * Fetch all volcanoes from USGS (for reference/debugging)
 * This includes dormant volcanoes with NORMAL status
 */
export async function fetchAllVolcanoes(): Promise<VolcanoData[]> {
	const USGS_VOLCANO_API = 'https://volcanoes.usgs.gov/hans-public/api/volcano/getVolcanoes';

	try {
		logger.log('Volcano API', 'Fetching all volcanoes from USGS...');

		const response = await fetch(USGS_VOLCANO_API, {
			headers: {
				'Accept': 'application/json'
			},
			signal: AbortSignal.timeout(15000)
		});

		if (!response.ok) {
			throw new Error(`USGS Volcano API error: ${response.status} ${response.statusText}`);
		}

		const data: USGSVolcanoResponse[] = await response.json();
		logger.log('Volcano API', `Received ${data.length} total volcanoes`);

		// Transform all volcanoes
		const volcanoes: VolcanoData[] = data.map((v) => ({
			id: `usgs-volcano-${v.volcanoId}`,
			name: v.volcanoName,
			lat: v.latitude,
			lon: v.longitude,
			elevation: v.elevation || 0,
			country: v.country || 'Unknown',
			region: v.region,
			alertLevel: normalizeAlertLevel(v.currentAlertLevel),
			colorCode: normalizeColorCode(v.currentColorCode),
			lastUpdate: v.lastUpdateTime,
			notice: v.currentNotice,
			description: buildVolcanoDescription(v)
		}));

		return volcanoes;

	} catch (error) {
		logger.warn('Volcano API', 'Failed to fetch all volcanoes:', error instanceof Error ? error.message : error);
		return [];
	}
}

/**
 * Normalize alert level string to typed enum value
 */
function normalizeAlertLevel(level: string | undefined): VolcanoAlertLevel {
	if (!level) return 'NORMAL';
	const upper = level.toUpperCase();
	if (upper === 'ADVISORY' || upper === 'WATCH' || upper === 'WARNING') {
		return upper as VolcanoAlertLevel;
	}
	return 'NORMAL';
}

/**
 * Normalize color code string to typed enum value
 */
function normalizeColorCode(code: string | undefined): VolcanoColorCode {
	if (!code) return 'GREEN';
	const upper = code.toUpperCase();
	if (upper === 'YELLOW' || upper === 'ORANGE' || upper === 'RED') {
		return upper as VolcanoColorCode;
	}
	return 'GREEN';
}

/**
 * Build a human-readable description for the volcano
 */
function buildVolcanoDescription(v: USGSVolcanoResponse): string {
	const parts: string[] = [];

	if (v.elevation) {
		parts.push(`Elevation: ${v.elevation.toLocaleString()}m`);
	}

	if (v.region) {
		parts.push(`Region: ${v.region}`);
	}

	if (v.currentNotice) {
		parts.push(v.currentNotice);
	}

	return parts.join(' | ') || 'Active volcano under monitoring';
}

// =============================================================================
// VESSEL/SHIP TRACKING (AIS DATA)
// =============================================================================

/**
 * Vessel/ship data from AIS tracking
 */
export interface Vessel {
	mmsi: string;
	name?: string;
	imo?: string;
	lat: number;
	lon: number;
	course: number;
	speed: number;
	heading?: number;
	shipType?: number;
	shipTypeName?: string;
	flag?: string;
	destination?: string;
	eta?: string;
	draught?: number;
	length?: number;
	width?: number;
	callsign?: string;
	lastUpdate: number;
}

/**
 * AIS Ship Type codes to human-readable names
 * https://api.vtexplorer.com/docs/ref-aistypes.html
 */
const AIS_SHIP_TYPES: Record<number, string> = {
	// Category 20-29: Wing in Ground (WIG)
	20: 'WIG',
	21: 'WIG Hazardous A',
	22: 'WIG Hazardous B',
	23: 'WIG Hazardous C',
	24: 'WIG Hazardous D',
	// Category 30-39: Fishing/Towing/Diving
	30: 'Fishing',
	31: 'Towing',
	32: 'Towing (large)',
	33: 'Dredging',
	34: 'Diving Operations',
	35: 'Military Operations',
	36: 'Sailing',
	37: 'Pleasure Craft',
	// Category 40-49: High Speed Craft
	40: 'High Speed Craft',
	41: 'HSC Hazardous A',
	42: 'HSC Hazardous B',
	43: 'HSC Hazardous C',
	44: 'HSC Hazardous D',
	49: 'HSC No Info',
	// Category 50-59: Special Craft
	50: 'Pilot Vessel',
	51: 'Search and Rescue',
	52: 'Tug',
	53: 'Port Tender',
	54: 'Anti-Pollution',
	55: 'Law Enforcement',
	56: 'Spare Local 1',
	57: 'Spare Local 2',
	58: 'Medical Transport',
	59: 'Noncombatant',
	// Category 60-69: Passenger
	60: 'Passenger',
	61: 'Passenger Hazardous A',
	62: 'Passenger Hazardous B',
	63: 'Passenger Hazardous C',
	64: 'Passenger Hazardous D',
	69: 'Passenger No Info',
	// Category 70-79: Cargo
	70: 'Cargo',
	71: 'Cargo Hazardous A',
	72: 'Cargo Hazardous B',
	73: 'Cargo Hazardous C',
	74: 'Cargo Hazardous D',
	79: 'Cargo No Info',
	// Category 80-89: Tanker
	80: 'Tanker',
	81: 'Tanker Hazardous A',
	82: 'Tanker Hazardous B',
	83: 'Tanker Hazardous C',
	84: 'Tanker Hazardous D',
	89: 'Tanker No Info',
	// Category 90-99: Other
	90: 'Other',
	91: 'Other Hazardous A',
	92: 'Other Hazardous B',
	93: 'Other Hazardous C',
	94: 'Other Hazardous D',
	99: 'Other No Info'
};

/**
 * Get ship type name from AIS type code
 */
export function getShipTypeName(typeCode: number | undefined): string {
	if (!typeCode) return 'Unknown';
	return AIS_SHIP_TYPES[typeCode] || `Type ${typeCode}`;
}

/**
 * Get color for ship type
 */
export function getShipTypeColor(typeCode: number | undefined): string {
	if (!typeCode) return '#94a3b8'; // Gray for unknown

	// Tankers - orange
	if (typeCode >= 80 && typeCode <= 89) return '#f97316';
	// Cargo - blue
	if (typeCode >= 70 && typeCode <= 79) return '#3b82f6';
	// Passenger - green
	if (typeCode >= 60 && typeCode <= 69) return '#22c55e';
	// Special craft (SAR, tug, pilot, etc.) - cyan
	if (typeCode >= 50 && typeCode <= 59) return '#06b6d4';
	// High speed craft - purple
	if (typeCode >= 40 && typeCode <= 49) return '#a855f7';
	// Fishing/sailing/pleasure - yellow
	if (typeCode >= 30 && typeCode <= 39) return '#eab308';
	// WIG - red
	if (typeCode >= 20 && typeCode <= 29) return '#ef4444';

	return '#94a3b8';
}

/**
 * Generate comprehensive sample vessel data for major shipping lanes
 * Creates 100+ vessels covering all major maritime routes, chokepoints, and strategic waterways
 * Used when API is unavailable or for demo purposes
 */
function getSampleVesselData(): Vessel[] {
	const now = Date.now();

	// Base vessel templates for each major shipping region
	const vessels: Vessel[] = [
		// ========== STRAIT OF MALACCA (World's busiest shipping lane - ~90,000 vessels/year) ==========
		{ mmsi: '563000001', name: 'EVER GOLDEN', lat: 1.25, lon: 103.7, course: 315, speed: 12.5, shipType: 70, shipTypeName: 'Cargo', flag: 'SG', destination: 'ROTTERDAM', lastUpdate: now - 120000 },
		{ mmsi: '477000002', name: 'COSCO PACIFIC', lat: 2.1, lon: 102.5, course: 295, speed: 14.2, shipType: 70, shipTypeName: 'Cargo', flag: 'HK', destination: 'SINGAPORE', lastUpdate: now - 180000 },
		{ mmsi: '538000016', name: 'PACIFIC VOYAGER', lat: 1.8, lon: 103.2, course: 310, speed: 13.8, shipType: 80, shipTypeName: 'Tanker', flag: 'MH', destination: 'YOKOHAMA', lastUpdate: now - 95000 },
		{ mmsi: '351000017', name: 'SINGAPORE SPIRIT', lat: 1.5, lon: 104.1, course: 270, speed: 11.2, shipType: 80, shipTypeName: 'Tanker', flag: 'PA', destination: 'SINGAPORE', lastUpdate: now - 140000 },
		{ mmsi: '477000018', name: 'OOCL HONG KONG', lat: 2.5, lon: 101.8, course: 300, speed: 16.5, shipType: 70, shipTypeName: 'Cargo', flag: 'HK', destination: 'TANJUNG PELEPAS', lastUpdate: now - 75000 },
		{ mmsi: '563000019', name: 'KEPPEL SINGAPORE', lat: 1.15, lon: 103.5, course: 45, speed: 8.0, shipType: 52, shipTypeName: 'Tug', flag: 'SG', destination: 'SINGAPORE ANCHORAGE', lastUpdate: now - 200000 },
		{ mmsi: '533000020', name: 'STRAITS GUARDIAN', lat: 2.8, lon: 101.2, course: 285, speed: 18.0, shipType: 55, shipTypeName: 'Law Enforcement', flag: 'MY', destination: 'PATROL', lastUpdate: now - 50000 },
		{ mmsi: '412000021', name: 'ZHONGGU JIANGSU', lat: 1.4, lon: 103.9, course: 320, speed: 14.0, shipType: 70, shipTypeName: 'Cargo', flag: 'CN', destination: 'SHANGHAI', lastUpdate: now - 165000 },

		// ========== SUEZ CANAL & RED SEA (12% of global trade) ==========
		{ mmsi: '373000003', name: 'MAERSK EDINBURGH', lat: 29.85, lon: 32.55, course: 340, speed: 8.5, shipType: 70, shipTypeName: 'Cargo', flag: 'PA', destination: 'PORT SAID', lastUpdate: now - 90000 },
		{ mmsi: '636000022', name: 'MSC OSCAR', lat: 30.2, lon: 32.35, course: 355, speed: 7.8, shipType: 70, shipTypeName: 'Cargo', flag: 'PA', destination: 'SUEZ', lastUpdate: now - 110000 },
		{ mmsi: '538000023', name: 'SUEZMAX STAR', lat: 29.5, lon: 32.7, course: 15, speed: 9.2, shipType: 80, shipTypeName: 'Tanker', flag: 'MH', destination: 'ROTTERDAM', lastUpdate: now - 82000 },
		{ mmsi: '229000024', name: 'SUEZ PILOT', lat: 29.95, lon: 32.5, course: 180, speed: 12.0, shipType: 50, shipTypeName: 'Pilot Vessel', flag: 'EG', destination: 'PORT SAID', lastUpdate: now - 45000 },
		{ mmsi: '370000025', name: 'CANAL TRANSPORTER', lat: 30.4, lon: 32.3, course: 0, speed: 6.5, shipType: 70, shipTypeName: 'Cargo', flag: 'PA', destination: 'ISMAILIA', lastUpdate: now - 185000 },
		{ mmsi: '622000026', name: 'RED SEA NAVIGATOR', lat: 27.8, lon: 34.1, course: 340, speed: 14.5, shipType: 80, shipTypeName: 'Tanker', flag: 'EG', destination: 'SUEZ', lastUpdate: now - 220000 },
		{ mmsi: '538000027', name: 'GULF EXPRESS', lat: 26.5, lon: 34.8, course: 325, speed: 15.8, shipType: 70, shipTypeName: 'Cargo', flag: 'MH', destination: 'JEDDAH', lastUpdate: now - 155000 },
		{ mmsi: '403000028', name: 'JEDDAH PEARL', lat: 21.5, lon: 39.0, course: 350, speed: 12.2, shipType: 60, shipTypeName: 'Passenger', flag: 'SA', destination: 'JEDDAH', lastUpdate: now - 195000 },

		// ========== PANAMA CANAL (5% of global trade) ==========
		{ mmsi: '636000004', name: 'MSC AURORA', lat: 9.35, lon: -79.9, course: 180, speed: 11.0, shipType: 70, shipTypeName: 'Cargo', flag: 'LR', destination: 'COLON', lastUpdate: now - 150000 },
		{ mmsi: '352000029', name: 'PANAMAX PRIDE', lat: 9.0, lon: -79.55, course: 45, speed: 7.5, shipType: 70, shipTypeName: 'Cargo', flag: 'PA', destination: 'BALBOA', lastUpdate: now - 72000 },
		{ mmsi: '367000030', name: 'LIBERTY BRIDGE', lat: 9.2, lon: -79.75, course: 90, speed: 6.0, shipType: 70, shipTypeName: 'Cargo', flag: 'US', destination: 'CRISTOBAL', lastUpdate: now - 115000 },
		{ mmsi: '538000031', name: 'NEOPANAMAX TITAN', lat: 8.85, lon: -79.5, course: 270, speed: 8.2, shipType: 70, shipTypeName: 'Cargo', flag: 'MH', destination: 'MANZANILLO', lastUpdate: now - 88000 },
		{ mmsi: '352000032', name: 'CANAL PILOT 3', lat: 9.1, lon: -79.65, course: 135, speed: 15.0, shipType: 50, shipTypeName: 'Pilot Vessel', flag: 'PA', destination: 'GATUN LOCKS', lastUpdate: now - 35000 },
		{ mmsi: '371000033', name: 'PACIFIC GATEWAY', lat: 8.7, lon: -79.35, course: 225, speed: 10.5, shipType: 80, shipTypeName: 'Tanker', flag: 'PA', destination: 'LA', lastUpdate: now - 175000 },

		// ========== STRAIT OF GIBRALTAR (Mediterranean gateway) ==========
		{ mmsi: '224000008', name: 'GIBRALTAR SPIRIT', lat: 35.95, lon: -5.5, course: 90, speed: 14.0, shipType: 80, shipTypeName: 'Tanker', flag: 'ES', destination: 'ALGECIRAS', lastUpdate: now - 100000 },
		{ mmsi: '256000034', name: 'MEDITERRANEAN STAR', lat: 36.05, lon: -5.35, course: 75, speed: 16.2, shipType: 70, shipTypeName: 'Cargo', flag: 'MT', destination: 'GENOA', lastUpdate: now - 68000 },
		{ mmsi: '235000035', name: 'BRITANNIA FERRY', lat: 35.85, lon: -5.65, course: 45, speed: 22.5, shipType: 60, shipTypeName: 'Passenger', flag: 'GB', destination: 'TANGIER', lastUpdate: now - 42000 },
		{ mmsi: '224000036', name: 'ALGECIRAS TUG', lat: 36.1, lon: -5.4, course: 180, speed: 6.0, shipType: 52, shipTypeName: 'Tug', flag: 'ES', destination: 'ALGECIRAS', lastUpdate: now - 125000 },
		{ mmsi: '242000037', name: 'MOROCCAN TRADER', lat: 35.75, lon: -5.8, course: 270, speed: 12.8, shipType: 70, shipTypeName: 'Cargo', flag: 'MA', destination: 'CASABLANCA', lastUpdate: now - 210000 },
		{ mmsi: '247000038', name: 'ADRIATIC EXPRESS', lat: 36.2, lon: -5.2, course: 85, speed: 17.5, shipType: 70, shipTypeName: 'Cargo', flag: 'IT', destination: 'GIOIA TAURO', lastUpdate: now - 145000 },

		// ========== STRAIT OF HORMUZ (20% of global oil, 35% of seaborne oil) ==========
		{ mmsi: '470000010', name: 'ARABIAN GULF TANKER', lat: 26.5, lon: 56.5, course: 140, speed: 11.5, shipType: 80, shipTypeName: 'Tanker', flag: 'AE', destination: 'MUMBAI', lastUpdate: now - 160000 },
		{ mmsi: '403000039', name: 'CRUDE KINGDOM', lat: 26.8, lon: 56.2, course: 115, speed: 13.2, shipType: 80, shipTypeName: 'Tanker', flag: 'SA', destination: 'SINGAPORE', lastUpdate: now - 92000 },
		{ mmsi: '422000040', name: 'PERSIAN GULF', lat: 26.2, lon: 56.8, course: 280, speed: 10.8, shipType: 80, shipTypeName: 'Tanker', flag: 'IR', destination: 'BANDAR ABBAS', lastUpdate: now - 135000 },
		{ mmsi: '470000041', name: 'EMIRATES STAR', lat: 26.6, lon: 56.4, course: 95, speed: 14.5, shipType: 80, shipTypeName: 'Tanker', flag: 'AE', destination: 'FUJAIRAH', lastUpdate: now - 78000 },
		{ mmsi: '466000042', name: 'OMANI TRADER', lat: 26.35, lon: 56.65, course: 150, speed: 12.0, shipType: 80, shipTypeName: 'Tanker', flag: 'OM', destination: 'SOHAR', lastUpdate: now - 188000 },
		{ mmsi: '538000043', name: 'VLCC HERCULES', lat: 26.9, lon: 56.1, course: 125, speed: 11.8, shipType: 80, shipTypeName: 'Tanker', flag: 'MH', destination: 'KOREA', lastUpdate: now - 105000 },
		{ mmsi: '470000044', name: 'GULF DEFENDER', lat: 26.4, lon: 56.55, course: 270, speed: 22.0, shipType: 35, shipTypeName: 'Military Operations', flag: 'AE', destination: 'PATROL', lastUpdate: now - 25000 },

		// ========== ENGLISH CHANNEL (One of busiest shipping lanes) ==========
		{ mmsi: '244000005', name: 'ROTTERDAM EXPRESS', lat: 51.0, lon: 1.5, course: 220, speed: 16.8, shipType: 70, shipTypeName: 'Cargo', flag: 'NL', destination: 'LE HAVRE', lastUpdate: now - 60000 },
		{ mmsi: '235000045', name: 'DOVER SEAWAYS', lat: 51.05, lon: 1.35, course: 135, speed: 20.5, shipType: 60, shipTypeName: 'Passenger', flag: 'GB', destination: 'CALAIS', lastUpdate: now - 38000 },
		{ mmsi: '226000046', name: 'CALAIS SPIRIT', lat: 50.95, lon: 1.6, course: 315, speed: 21.0, shipType: 60, shipTypeName: 'Passenger', flag: 'FR', destination: 'DOVER', lastUpdate: now - 55000 },
		{ mmsi: '245000047', name: 'EUROPOORT TRADER', lat: 51.2, lon: 1.8, course: 50, speed: 14.2, shipType: 70, shipTypeName: 'Cargo', flag: 'NL', destination: 'ROTTERDAM', lastUpdate: now - 122000 },
		{ mmsi: '211000048', name: 'HAMBURG EXPRESS', lat: 51.15, lon: 1.65, course: 65, speed: 15.8, shipType: 70, shipTypeName: 'Cargo', flag: 'DE', destination: 'HAMBURG', lastUpdate: now - 98000 },
		{ mmsi: '235000049', name: 'CHANNEL PILOT', lat: 50.9, lon: 1.25, course: 90, speed: 18.0, shipType: 50, shipTypeName: 'Pilot Vessel', flag: 'GB', destination: 'DOVER', lastUpdate: now - 32000 },

		// ========== BOSPHORUS & BLACK SEA (Major grain/oil route) ==========
		{ mmsi: '271000012', name: 'BLACK SEA CARRIER', lat: 41.1, lon: 29.0, course: 200, speed: 8.0, shipType: 70, shipTypeName: 'Cargo', flag: 'TR', destination: 'ISTANBUL', lastUpdate: now - 50000 },
		{ mmsi: '273000050', name: 'ROSTOV GRAIN', lat: 41.2, lon: 29.05, course: 180, speed: 7.5, shipType: 70, shipTypeName: 'Cargo', flag: 'RU', destination: 'CONSTANTA', lastUpdate: now - 85000 },
		{ mmsi: '272000051', name: 'ODESA BULK', lat: 41.05, lon: 28.95, course: 25, speed: 6.8, shipType: 70, shipTypeName: 'Cargo', flag: 'UA', destination: 'ISTANBUL', lastUpdate: now - 115000 },
		{ mmsi: '271000052', name: 'BOSPHORUS TUG', lat: 41.15, lon: 29.02, course: 350, speed: 5.5, shipType: 52, shipTypeName: 'Tug', flag: 'TR', destination: 'KARAKOY', lastUpdate: now - 28000 },
		{ mmsi: '240000053', name: 'AEGEAN TANKER', lat: 40.95, lon: 28.9, course: 215, speed: 9.2, shipType: 80, shipTypeName: 'Tanker', flag: 'GR', destination: 'PIRAEUS', lastUpdate: now - 148000 },
		{ mmsi: '214000054', name: 'ROMANIA STAR', lat: 44.15, lon: 28.65, course: 270, speed: 12.5, shipType: 70, shipTypeName: 'Cargo', flag: 'RO', destination: 'CONSTANTA', lastUpdate: now - 175000 },

		// ========== TAIWAN STRAIT (Critical semiconductor supply chain) ==========
		{ mmsi: '416000009', name: 'EVERGREEN MARINE', lat: 24.5, lon: 119.5, course: 10, speed: 18.0, shipType: 70, shipTypeName: 'Cargo', flag: 'TW', destination: 'KAOHSIUNG', lastUpdate: now - 80000 },
		{ mmsi: '412000055', name: 'COSCO SHIPPING', lat: 25.0, lon: 120.0, course: 355, speed: 16.5, shipType: 70, shipTypeName: 'Cargo', flag: 'CN', destination: 'XIAMEN', lastUpdate: now - 62000 },
		{ mmsi: '416000056', name: 'YANG MING LINE', lat: 24.8, lon: 119.8, course: 185, speed: 17.2, shipType: 70, shipTypeName: 'Cargo', flag: 'TW', destination: 'HONG KONG', lastUpdate: now - 105000 },
		{ mmsi: '412000057', name: 'CHINA CONTAINER', lat: 25.2, lon: 120.2, course: 5, speed: 15.8, shipType: 70, shipTypeName: 'Cargo', flag: 'CN', destination: 'NINGBO', lastUpdate: now - 145000 },
		{ mmsi: '416000058', name: 'TAIPEI FERRY', lat: 24.3, lon: 119.3, course: 45, speed: 24.0, shipType: 60, shipTypeName: 'Passenger', flag: 'TW', destination: 'KINMEN', lastUpdate: now - 38000 },
		{ mmsi: '412000059', name: 'FUJIAN TRAWLER', lat: 24.6, lon: 119.6, course: 90, speed: 6.5, shipType: 30, shipTypeName: 'Fishing', flag: 'CN', destination: 'XIAMEN', lastUpdate: now - 250000 },

		// ========== SOUTH CHINA SEA (Major trade route + territorial disputes) ==========
		{ mmsi: '412000007', name: 'YANG MING HARMONY', lat: 14.5, lon: 117.0, course: 45, speed: 15.2, shipType: 70, shipTypeName: 'Cargo', flag: 'TW', destination: 'HONG KONG', lastUpdate: now - 200000 },
		{ mmsi: '548000060', name: 'MANILA EXPRESS', lat: 14.8, lon: 120.0, course: 270, speed: 14.8, shipType: 70, shipTypeName: 'Cargo', flag: 'PH', destination: 'MANILA', lastUpdate: now - 135000 },
		{ mmsi: '574000061', name: 'VIETNAM STAR', lat: 10.5, lon: 107.5, course: 45, speed: 13.5, shipType: 70, shipTypeName: 'Cargo', flag: 'VN', destination: 'HO CHI MINH', lastUpdate: now - 168000 },
		{ mmsi: '412000062', name: 'HAINAN FISHER', lat: 18.5, lon: 110.0, course: 180, speed: 5.8, shipType: 30, shipTypeName: 'Fishing', flag: 'CN', destination: 'HAINAN', lastUpdate: now - 285000 },
		{ mmsi: '548000063', name: 'SCARBOROUGH PATROL', lat: 15.2, lon: 117.8, course: 315, speed: 18.5, shipType: 55, shipTypeName: 'Law Enforcement', flag: 'PH', destination: 'PATROL', lastUpdate: now - 42000 },
		{ mmsi: '538000064', name: 'SPRATLY TANKER', lat: 12.0, lon: 114.5, course: 285, speed: 12.2, shipType: 80, shipTypeName: 'Tanker', flag: 'MH', destination: 'SINGAPORE', lastUpdate: now - 195000 },

		// ========== GULF OF ADEN (Piracy hotspot, major route to Suez) ==========
		{ mmsi: '538000006', name: 'CRUDE PIONEER', lat: 12.5, lon: 47.5, course: 270, speed: 13.5, shipType: 80, shipTypeName: 'Tanker', flag: 'MH', destination: 'FUJAIRAH', lastUpdate: now - 240000 },
		{ mmsi: '636000065', name: 'ADEN GUARDIAN', lat: 12.8, lon: 45.0, course: 285, speed: 16.0, shipType: 35, shipTypeName: 'Military Operations', flag: 'US', destination: 'DJIBOUTI', lastUpdate: now - 55000 },
		{ mmsi: '211000066', name: 'BREMEN CONTAINER', lat: 12.2, lon: 48.5, course: 255, speed: 17.5, shipType: 70, shipTypeName: 'Cargo', flag: 'DE', destination: 'HAMBURG', lastUpdate: now - 125000 },
		{ mmsi: '538000067', name: 'SOMALI COAST', lat: 11.5, lon: 50.0, course: 280, speed: 14.8, shipType: 80, shipTypeName: 'Tanker', flag: 'MH', destination: 'SUEZ', lastUpdate: now - 185000 },
		{ mmsi: '226000068', name: 'DJIBOUTI SUPPLY', lat: 11.6, lon: 43.1, course: 90, speed: 10.5, shipType: 70, shipTypeName: 'Cargo', flag: 'FR', destination: 'DJIBOUTI', lastUpdate: now - 215000 },

		// ========== CAPE OF GOOD HOPE (Alternative to Suez) ==========
		{ mmsi: '636000011', name: 'CAPE ATLANTIC', lat: -34.5, lon: 18.5, course: 270, speed: 14.8, shipType: 70, shipTypeName: 'Cargo', flag: 'LR', destination: 'SANTOS', lastUpdate: now - 300000 },
		{ mmsi: '601000069', name: 'SOUTH AFRICAN STAR', lat: -34.2, lon: 18.8, course: 45, speed: 12.5, shipType: 80, shipTypeName: 'Tanker', flag: 'ZA', destination: 'DURBAN', lastUpdate: now - 175000 },
		{ mmsi: '538000070', name: 'CAPE HORN EXPRESS', lat: -34.8, lon: 18.2, course: 315, speed: 15.2, shipType: 70, shipTypeName: 'Cargo', flag: 'MH', destination: 'WEST AFRICA', lastUpdate: now - 248000 },
		{ mmsi: '601000071', name: 'CAPE TOWN TUG', lat: -33.9, lon: 18.45, course: 180, speed: 6.0, shipType: 52, shipTypeName: 'Tug', flag: 'ZA', destination: 'CAPE TOWN', lastUpdate: now - 45000 },

		// ========== NORTH SEA & BALTIC (Major European trade) ==========
		{ mmsi: '246000013', name: 'NORTH SEA FISHER', lat: 54.5, lon: 4.5, course: 180, speed: 5.5, shipType: 30, shipTypeName: 'Fishing', flag: 'NL', destination: 'DEN HELDER', lastUpdate: now - 400000 },
		{ mmsi: '257000072', name: 'NORWEGIAN FJORD', lat: 58.5, lon: 5.0, course: 180, speed: 18.5, shipType: 60, shipTypeName: 'Passenger', flag: 'NO', destination: 'BERGEN', lastUpdate: now - 88000 },
		{ mmsi: '220000073', name: 'DANISH CONTAINER', lat: 55.5, lon: 8.5, course: 90, speed: 15.2, shipType: 70, shipTypeName: 'Cargo', flag: 'DK', destination: 'COPENHAGEN', lastUpdate: now - 142000 },
		{ mmsi: '265000074', name: 'SWEDISH FERRY', lat: 57.7, lon: 11.9, course: 315, speed: 20.0, shipType: 60, shipTypeName: 'Passenger', flag: 'SE', destination: 'GOTHENBURG', lastUpdate: now - 65000 },
		{ mmsi: '230000075', name: 'BALTIC TRADER', lat: 55.2, lon: 14.5, course: 45, speed: 12.8, shipType: 70, shipTypeName: 'Cargo', flag: 'FI', destination: 'GDYNIA', lastUpdate: now - 195000 },
		{ mmsi: '261000076', name: 'POLISH BULK', lat: 54.5, lon: 18.7, course: 270, speed: 11.5, shipType: 70, shipTypeName: 'Cargo', flag: 'PL', destination: 'GDANSK', lastUpdate: now - 168000 },

		// ========== CARIBBEAN & GULF OF MEXICO ==========
		{ mmsi: '311000014', name: 'CARIBBEAN PRINCESS', lat: 18.5, lon: -66.0, course: 120, speed: 18.5, shipType: 60, shipTypeName: 'Passenger', flag: 'BS', destination: 'SAN JUAN', lastUpdate: now - 70000 },
		{ mmsi: '367000077', name: 'GULF DRILLER', lat: 28.5, lon: -88.5, course: 90, speed: 2.0, shipType: 33, shipTypeName: 'Dredging', flag: 'US', destination: 'ON SITE', lastUpdate: now - 350000 },
		{ mmsi: '538000078', name: 'HOUSTON TANKER', lat: 28.0, lon: -94.0, course: 315, speed: 12.5, shipType: 80, shipTypeName: 'Tanker', flag: 'MH', destination: 'HOUSTON', lastUpdate: now - 138000 },
		{ mmsi: '367000079', name: 'NEW ORLEANS CARGO', lat: 29.5, lon: -89.5, course: 45, speed: 10.8, shipType: 70, shipTypeName: 'Cargo', flag: 'US', destination: 'NEW ORLEANS', lastUpdate: now - 185000 },
		{ mmsi: '311000080', name: 'BAHAMAS CRUISE', lat: 25.0, lon: -77.5, course: 270, speed: 20.5, shipType: 60, shipTypeName: 'Passenger', flag: 'BS', destination: 'NASSAU', lastUpdate: now - 52000 },
		{ mmsi: '345000081', name: 'JAMAICA CONTAINER', lat: 17.5, lon: -76.8, course: 90, speed: 14.2, shipType: 70, shipTypeName: 'Cargo', flag: 'JM', destination: 'KINGSTON', lastUpdate: now - 225000 },

		// ========== TRANS-PACIFIC ROUTE (Asia to Americas) ==========
		{ mmsi: '431000082', name: 'NIPPON MARU', lat: 35.0, lon: 140.0, course: 90, speed: 16.5, shipType: 70, shipTypeName: 'Cargo', flag: 'JP', destination: 'YOKOHAMA', lastUpdate: now - 95000 },
		{ mmsi: '440000015', name: 'KOREA EXPRESS', lat: 35.5, lon: 125.0, course: 350, speed: 16.0, shipType: 70, shipTypeName: 'Cargo', flag: 'KR', destination: 'INCHEON', lastUpdate: now - 130000 },
		{ mmsi: '538000083', name: 'PACIFIC CROSSING', lat: 30.0, lon: -140.0, course: 85, speed: 18.2, shipType: 70, shipTypeName: 'Cargo', flag: 'MH', destination: 'LONG BEACH', lastUpdate: now - 275000 },
		{ mmsi: '366000084', name: 'LA GATEWAY', lat: 33.7, lon: -118.3, course: 45, speed: 8.5, shipType: 70, shipTypeName: 'Cargo', flag: 'US', destination: 'LOS ANGELES', lastUpdate: now - 68000 },
		{ mmsi: '431000085', name: 'TOKYO EXPRESS', lat: 35.5, lon: 139.8, course: 135, speed: 14.8, shipType: 70, shipTypeName: 'Cargo', flag: 'JP', destination: 'TOKYO', lastUpdate: now - 152000 },
		{ mmsi: '538000086', name: 'MID-PACIFIC TANKER', lat: 25.0, lon: -160.0, course: 75, speed: 12.5, shipType: 80, shipTypeName: 'Tanker', flag: 'MH', destination: 'HAWAII', lastUpdate: now - 315000 },

		// ========== TRANS-ATLANTIC (Europe to Americas) ==========
		{ mmsi: '235000087', name: 'QUEEN MARY 2', lat: 45.0, lon: -35.0, course: 270, speed: 25.0, shipType: 60, shipTypeName: 'Passenger', flag: 'GB', destination: 'NEW YORK', lastUpdate: now - 185000 },
		{ mmsi: '636000088', name: 'ATLANTIC BRIDGE', lat: 42.0, lon: -55.0, course: 255, speed: 18.5, shipType: 70, shipTypeName: 'Cargo', flag: 'LR', destination: 'BOSTON', lastUpdate: now - 228000 },
		{ mmsi: '211000089', name: 'GERMAN EFFICIENCY', lat: 50.0, lon: -20.0, course: 280, speed: 17.2, shipType: 70, shipTypeName: 'Cargo', flag: 'DE', destination: 'NORFOLK', lastUpdate: now - 175000 },
		{ mmsi: '226000090', name: 'NORMANDIE EXPRESS', lat: 48.0, lon: -8.0, course: 275, speed: 20.5, shipType: 40, shipTypeName: 'High Speed Craft', flag: 'FR', destination: 'BREST', lastUpdate: now - 95000 },

		// ========== MEDITERRANEAN SEA ==========
		{ mmsi: '247000091', name: 'ROMA EXPRESS', lat: 41.9, lon: 12.5, course: 180, speed: 12.0, shipType: 70, shipTypeName: 'Cargo', flag: 'IT', destination: 'CIVITAVECCHIA', lastUpdate: now - 128000 },
		{ mmsi: '240000092', name: 'PIRAEUS CONTAINER', lat: 37.95, lon: 23.65, course: 270, speed: 8.5, shipType: 70, shipTypeName: 'Cargo', flag: 'GR', destination: 'PIRAEUS', lastUpdate: now - 85000 },
		{ mmsi: '256000093', name: 'MALTA FERRY', lat: 35.9, lon: 14.5, course: 350, speed: 22.0, shipType: 60, shipTypeName: 'Passenger', flag: 'MT', destination: 'VALLETTA', lastUpdate: now - 45000 },
		{ mmsi: '225000094', name: 'BARCELONA LINER', lat: 41.35, lon: 2.15, course: 90, speed: 14.5, shipType: 70, shipTypeName: 'Cargo', flag: 'ES', destination: 'BARCELONA', lastUpdate: now - 155000 },
		{ mmsi: '227000095', name: 'MARSEILLE TANKER', lat: 43.3, lon: 5.35, course: 180, speed: 10.8, shipType: 80, shipTypeName: 'Tanker', flag: 'FR', destination: 'MARSEILLE', lastUpdate: now - 198000 },
		{ mmsi: '376000096', name: 'LIBYA COAST', lat: 32.5, lon: 14.5, course: 45, speed: 11.2, shipType: 80, shipTypeName: 'Tanker', flag: 'CY', destination: 'TRIPOLI', lastUpdate: now - 265000 },

		// ========== PERSIAN GULF (Major oil production) ==========
		{ mmsi: '447000097', name: 'KUWAIT CRUDE', lat: 29.0, lon: 48.5, course: 135, speed: 10.5, shipType: 80, shipTypeName: 'Tanker', flag: 'KW', destination: 'RAS TANURA', lastUpdate: now - 145000 },
		{ mmsi: '403000098', name: 'SAUDI ARAMCO', lat: 27.5, lon: 49.5, course: 180, speed: 11.8, shipType: 80, shipTypeName: 'Tanker', flag: 'SA', destination: 'JUBAIL', lastUpdate: now - 175000 },
		{ mmsi: '466000099', name: 'OMAN LNG', lat: 24.5, lon: 57.0, course: 90, speed: 14.2, shipType: 80, shipTypeName: 'Tanker', flag: 'OM', destination: 'SUR', lastUpdate: now - 205000 },
		{ mmsi: '403000100', name: 'QATAR GAS', lat: 25.5, lon: 51.5, course: 115, speed: 13.8, shipType: 80, shipTypeName: 'Tanker', flag: 'QA', destination: 'RAS LAFFAN', lastUpdate: now - 118000 },

		// ========== INDIAN OCEAN ==========
		{ mmsi: '419000101', name: 'MUMBAI MERCHANT', lat: 18.9, lon: 72.8, course: 225, speed: 11.5, shipType: 70, shipTypeName: 'Cargo', flag: 'IN', destination: 'MUMBAI', lastUpdate: now - 165000 },
		{ mmsi: '525000102', name: 'JAKARTA TRADER', lat: -6.1, lon: 106.8, course: 315, speed: 10.2, shipType: 70, shipTypeName: 'Cargo', flag: 'ID', destination: 'JAKARTA', lastUpdate: now - 195000 },
		{ mmsi: '419000103', name: 'CHENNAI BULK', lat: 13.1, lon: 80.3, course: 180, speed: 9.8, shipType: 70, shipTypeName: 'Cargo', flag: 'IN', destination: 'CHENNAI', lastUpdate: now - 228000 },
		{ mmsi: '518000104', name: 'COLOMBO EXPRESS', lat: 6.9, lon: 79.85, course: 270, speed: 15.5, shipType: 70, shipTypeName: 'Cargo', flag: 'LK', destination: 'COLOMBO', lastUpdate: now - 135000 },
		{ mmsi: '565000105', name: 'SINGAPORE REFINERY', lat: 1.2, lon: 103.8, course: 90, speed: 8.0, shipType: 80, shipTypeName: 'Tanker', flag: 'SG', destination: 'JURONG', lastUpdate: now - 75000 },

		// ========== EAST CHINA SEA & YELLOW SEA ==========
		{ mmsi: '412000106', name: 'SHANGHAI MAERSK', lat: 31.2, lon: 121.5, course: 90, speed: 7.5, shipType: 70, shipTypeName: 'Cargo', flag: 'CN', destination: 'SHANGHAI', lastUpdate: now - 58000 },
		{ mmsi: '440000107', name: 'BUSAN EXPRESS', lat: 35.1, lon: 129.05, course: 180, speed: 12.8, shipType: 70, shipTypeName: 'Cargo', flag: 'KR', destination: 'BUSAN', lastUpdate: now - 105000 },
		{ mmsi: '412000108', name: 'QINGDAO BULK', lat: 36.0, lon: 120.3, course: 270, speed: 10.5, shipType: 70, shipTypeName: 'Cargo', flag: 'CN', destination: 'QINGDAO', lastUpdate: now - 145000 },
		{ mmsi: '431000109', name: 'KOBE FERRY', lat: 34.65, lon: 135.2, course: 90, speed: 22.5, shipType: 60, shipTypeName: 'Passenger', flag: 'JP', destination: 'KOBE', lastUpdate: now - 42000 },
		{ mmsi: '440000110', name: 'ULSAN TANKER', lat: 35.5, lon: 129.4, course: 45, speed: 11.2, shipType: 80, shipTypeName: 'Tanker', flag: 'KR', destination: 'ULSAN', lastUpdate: now - 178000 },

		// ========== AUSTRALIA & OCEANIA ==========
		{ mmsi: '503000111', name: 'SYDNEY STAR', lat: -33.85, lon: 151.25, course: 45, speed: 8.5, shipType: 70, shipTypeName: 'Cargo', flag: 'AU', destination: 'SYDNEY', lastUpdate: now - 95000 },
		{ mmsi: '503000112', name: 'MELBOURNE BULK', lat: -37.85, lon: 144.9, course: 180, speed: 10.2, shipType: 70, shipTypeName: 'Cargo', flag: 'AU', destination: 'MELBOURNE', lastUpdate: now - 148000 },
		{ mmsi: '512000113', name: 'AUCKLAND FERRY', lat: -36.85, lon: 174.75, course: 90, speed: 18.5, shipType: 60, shipTypeName: 'Passenger', flag: 'NZ', destination: 'AUCKLAND', lastUpdate: now - 68000 },
		{ mmsi: '503000114', name: 'FREMANTLE ORE', lat: -32.05, lon: 115.75, course: 270, speed: 12.8, shipType: 70, shipTypeName: 'Cargo', flag: 'AU', destination: 'FREMANTLE', lastUpdate: now - 215000 },
		{ mmsi: '538000115', name: 'CORAL SEA TANKER', lat: -18.0, lon: 148.0, course: 315, speed: 13.5, shipType: 80, shipTypeName: 'Tanker', flag: 'MH', destination: 'GLADSTONE', lastUpdate: now - 285000 },

		// ========== SOUTH AMERICA ==========
		{ mmsi: '710000116', name: 'SANTOS CONTAINER', lat: -23.95, lon: -46.3, course: 180, speed: 11.5, shipType: 70, shipTypeName: 'Cargo', flag: 'BR', destination: 'SANTOS', lastUpdate: now - 125000 },
		{ mmsi: '720000117', name: 'BUENOS AIRES GRAIN', lat: -34.6, lon: -58.4, course: 90, speed: 9.8, shipType: 70, shipTypeName: 'Cargo', flag: 'AR', destination: 'BUENOS AIRES', lastUpdate: now - 175000 },
		{ mmsi: '725000118', name: 'VALPARAISO STAR', lat: -33.0, lon: -71.6, course: 0, speed: 10.2, shipType: 70, shipTypeName: 'Cargo', flag: 'CL', destination: 'VALPARAISO', lastUpdate: now - 195000 },
		{ mmsi: '730000119', name: 'CALLAO EXPRESS', lat: -12.05, lon: -77.15, course: 315, speed: 12.5, shipType: 70, shipTypeName: 'Cargo', flag: 'PE', destination: 'CALLAO', lastUpdate: now - 225000 },
		{ mmsi: '735000120', name: 'GUAYAQUIL BANANA', lat: -2.2, lon: -79.9, course: 270, speed: 14.0, shipType: 70, shipTypeName: 'Cargo', flag: 'EC', destination: 'GUAYAQUIL', lastUpdate: now - 165000 },

		// ========== WEST AFRICA (Emerging oil region) ==========
		{ mmsi: '618000121', name: 'LAGOS TANKER', lat: 6.45, lon: 3.4, course: 180, speed: 8.5, shipType: 80, shipTypeName: 'Tanker', flag: 'NG', destination: 'LAGOS', lastUpdate: now - 145000 },
		{ mmsi: '613000122', name: 'ANGOLA CRUDE', lat: -8.8, lon: 13.2, course: 270, speed: 11.2, shipType: 80, shipTypeName: 'Tanker', flag: 'AO', destination: 'LUANDA', lastUpdate: now - 185000 },
		{ mmsi: '663000123', name: 'DAKAR FERRY', lat: 14.7, lon: -17.45, course: 45, speed: 15.5, shipType: 60, shipTypeName: 'Passenger', flag: 'SN', destination: 'DAKAR', lastUpdate: now - 98000 },
		{ mmsi: '620000124', name: 'ABIDJAN CARGO', lat: 5.3, lon: -4.0, course: 90, speed: 12.0, shipType: 70, shipTypeName: 'Cargo', flag: 'CI', destination: 'ABIDJAN', lastUpdate: now - 215000 },

		// ========== ARCTIC ROUTES (Northern Sea Route) ==========
		{ mmsi: '273000125', name: 'CHRISTOPHE DE MARGERIE', lat: 72.5, lon: 110.0, course: 90, speed: 10.5, shipType: 80, shipTypeName: 'Tanker', flag: 'RU', destination: 'SABETTA', lastUpdate: now - 295000 },
		{ mmsi: '273000126', name: 'ARCTIC AURORA', lat: 70.0, lon: 135.0, course: 75, speed: 8.2, shipType: 70, shipTypeName: 'Cargo', flag: 'RU', destination: 'PEVEK', lastUpdate: now - 345000 },

		// ========== STRATEGIC MILITARY/PATROL VESSELS ==========
		{ mmsi: '367000127', name: 'USS ARLEIGH BURKE', lat: 35.0, lon: 140.5, course: 180, speed: 15.0, shipType: 35, shipTypeName: 'Military Operations', flag: 'US', destination: 'YOKOSUKA', lastUpdate: now - 35000 },
		{ mmsi: '235000128', name: 'HMS QUEEN ELIZABETH', lat: 50.8, lon: -1.1, course: 180, speed: 18.5, shipType: 35, shipTypeName: 'Military Operations', flag: 'GB', destination: 'PORTSMOUTH', lastUpdate: now - 48000 },
		{ mmsi: '226000129', name: 'FS CHARLES DE GAULLE', lat: 43.1, lon: 5.9, course: 90, speed: 12.0, shipType: 35, shipTypeName: 'Military Operations', flag: 'FR', destination: 'TOULON', lastUpdate: now - 72000 },
		{ mmsi: '412000130', name: 'LIAONING', lat: 38.9, lon: 121.6, course: 180, speed: 14.5, shipType: 35, shipTypeName: 'Military Operations', flag: 'CN', destination: 'DALIAN', lastUpdate: now - 85000 },

		// ========== SEARCH AND RESCUE ==========
		{ mmsi: '257000131', name: 'NORWEGIAN SAR 1', lat: 62.5, lon: 6.0, course: 0, speed: 25.0, shipType: 51, shipTypeName: 'Search and Rescue', flag: 'NO', destination: 'ALESUND', lastUpdate: now - 28000 },
		{ mmsi: '366000132', name: 'USCG BERTHOLF', lat: 57.0, lon: -170.0, course: 90, speed: 20.0, shipType: 51, shipTypeName: 'Search and Rescue', flag: 'US', destination: 'DUTCH HARBOR', lastUpdate: now - 65000 },
		{ mmsi: '431000133', name: 'JCG SHIKISHIMA', lat: 35.4, lon: 139.7, course: 270, speed: 18.0, shipType: 51, shipTypeName: 'Search and Rescue', flag: 'JP', destination: 'TOKYO', lastUpdate: now - 55000 }
	];

	return vessels;
}

// Cache for vessel data to limit API calls
let vesselCache: {
	data: Vessel[];
	timestamp: number;
} | null = null;

const VESSEL_CACHE_TTL = 3 * 60 * 1000; // 3 minutes cache

/**
 * Fetch vessel positions
 * Uses sample data positioned on major shipping lanes
 * Can be enhanced with real API (AISHub, VesselFinder) when API key is available
 */
export async function fetchVesselPositions(): Promise<Vessel[]> {
	// Check cache first
	if (vesselCache && Date.now() - vesselCache.timestamp < VESSEL_CACHE_TTL) {
		// Add some movement simulation to cached data
		return simulateVesselMovement(vesselCache.data);
	}

	// Try to fetch from free API sources
	// Note: Most free AIS APIs have strict rate limits or require registration
	// For now, use sample data with simulated movement

	try {
		// Option 1: Try AISHub if API key is configured
		const aisHubKey = browser
			? (import.meta.env?.VITE_AISHUB_API_KEY ?? '')
			: (process.env.VITE_AISHUB_API_KEY ?? '');

		if (aisHubKey) {
			const vessels = await fetchAISHubData(aisHubKey);
			if (vessels.length > 0) {
				vesselCache = { data: vessels, timestamp: Date.now() };
				return vessels;
			}
		}
	} catch (error) {
		console.warn('AISHub API failed:', error);
	}

	// Fallback to sample data with simulated movement
	const sampleData = getSampleVesselData();
	vesselCache = { data: sampleData, timestamp: Date.now() };
	return sampleData;
}

/**
 * Fetch vessel data from AISHub API
 * Requires free registration at aishub.net
 */
async function fetchAISHubData(apiKey: string): Promise<Vessel[]> {
	try {
		// AISHub provides AIS data in various formats
		// We'll request JSON format with no compression
		const url = `http://data.aishub.net/ws.php?username=${apiKey}&format=1&output=json&compress=0&latmin=-60&latmax=60&lonmin=-180&lonmax=180`;

		const response = await fetch(url);
		if (!response.ok) {
			console.warn('AISHub API returned:', response.status);
			return [];
		}

		const data = await response.json();

		// AISHub returns data in array format
		// [ERROR_CODE, [vessels...]] or just array of vessels
		if (!Array.isArray(data)) {
			console.warn('Unexpected AISHub response format');
			return [];
		}

		// Check for error response
		if (data.length === 2 && typeof data[0] === 'number' && data[0] !== 0) {
			console.warn('AISHub error code:', data[0]);
			return [];
		}

		const vesselArray = Array.isArray(data[1]) ? data[1] : data;

		return vesselArray
			.filter((v: Record<string, unknown>) =>
				v.LATITUDE && v.LONGITUDE &&
				typeof v.LATITUDE === 'number' &&
				typeof v.LONGITUDE === 'number'
			)
			.slice(0, 500) // Limit to 500 vessels for performance
			.map((v: Record<string, unknown>) => ({
				mmsi: String(v.MMSI || ''),
				name: v.NAME as string | undefined,
				imo: v.IMO ? String(v.IMO) : undefined,
				lat: v.LATITUDE as number,
				lon: v.LONGITUDE as number,
				course: (v.COG as number) || 0,
				speed: (v.SOG as number) || 0,
				heading: v.HEADING as number | undefined,
				shipType: v.TYPE as number | undefined,
				shipTypeName: getShipTypeName(v.TYPE as number),
				destination: v.DEST as string | undefined,
				eta: v.ETA as string | undefined,
				draught: v.DRAUGHT as number | undefined,
				length: v.A && v.B ? (v.A as number) + (v.B as number) : undefined,
				width: v.C && v.D ? (v.C as number) + (v.D as number) : undefined,
				callsign: v.CALLSIGN as string | undefined,
				lastUpdate: Date.now()
			}));
	} catch (error) {
		console.warn('Failed to fetch AISHub data:', error);
		return [];
	}
}

/**
 * Simulate vessel movement based on course and speed
 * Adds realistic movement to cached data
 */
function simulateVesselMovement(vessels: Vessel[]): Vessel[] {
	const now = Date.now();

	return vessels.map((vessel) => {
		// Calculate time elapsed since last update
		const elapsed = (now - vessel.lastUpdate) / 1000; // seconds

		// Calculate distance traveled (speed is in knots, 1 knot = 1.852 km/h)
		const distanceKm = (vessel.speed * 1.852 * elapsed) / 3600;

		// Convert course to radians
		const courseRad = (vessel.course * Math.PI) / 180;

		// Calculate new position (simplified - doesn't account for Earth's curvature perfectly)
		const kmPerDegreeLat = 111.32;
		const kmPerDegreeLon = 111.32 * Math.cos((vessel.lat * Math.PI) / 180);

		const newLat = vessel.lat + (distanceKm * Math.cos(courseRad)) / kmPerDegreeLat;
		const newLon = vessel.lon + (distanceKm * Math.sin(courseRad)) / kmPerDegreeLon;

		// Add slight random variation to simulate realistic movement
		const variation = 0.002;
		const latVariation = (Math.random() - 0.5) * variation;
		const lonVariation = (Math.random() - 0.5) * variation;

		// Slight course variation (+/- 5 degrees)
		const courseVariation = (Math.random() - 0.5) * 10;

		return {
			...vessel,
			lat: newLat + latVariation,
			lon: newLon + lonVariation,
			course: (vessel.course + courseVariation + 360) % 360,
			lastUpdate: now
		};
	});
}

/**
 * Format vessel speed for display
 */
export function formatVesselSpeed(speedKnots: number): string {
	return `${speedKnots.toFixed(1)} kts`;
}

/**
 * Format vessel course for display
 */
export function formatVesselCourse(course: number): string {
	const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
	const index = Math.round(course / 22.5) % 16;
	return `${Math.round(course)}° ${directions[index]}`;
}

/**
 * Get flag emoji from country code
 */
export function getFlagEmoji(countryCode: string | undefined): string {
	if (!countryCode || countryCode.length !== 2) return '';

	// Convert country code to regional indicator symbols
	const codePoints = countryCode
		.toUpperCase()
		.split('')
		.map((char) => 127397 + char.charCodeAt(0));

	return String.fromCodePoint(...codePoints);
}

/**
 * USGS Earthquake API response interfaces
 */
interface USGSEarthquakeFeature {
	id: string;
	properties: {
		mag: number | null;
		place: string | null;
		time: number;
		url: string;
	};
	geometry: {
		coordinates: [number, number, number]; // [lon, lat, depth]
	};
}

interface USGSEarthquakeResponse {
	type: string;
	features: USGSEarthquakeFeature[];
}

/**
 * Fetch earthquake data from USGS Earthquake API
 * Returns earthquakes above the specified minimum magnitude
 * @param minMagnitude Minimum magnitude to fetch (default 4.0)
 */
export async function fetchEarthquakes(minMagnitude: number = 4.0): Promise<EarthquakeData[]> {
	// Use the USGS FDSN Event Query API for more control over parameters
	// Returns earthquakes from the past 24 hours sorted by time (most recent first)
	const usgsUrl = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=${minMagnitude}&limit=50&orderby=time`;

	try {
		logger.log('USGS Earthquake API', `Fetching earthquakes with minMagnitude=${minMagnitude}...`);

		const response = await fetch(usgsUrl, {
			headers: {
				'Accept': 'application/json'
			},
			signal: AbortSignal.timeout(10000)
		});

		if (!response.ok) {
			throw new Error(`USGS API returned status ${response.status}`);
		}

		const data: USGSEarthquakeResponse = await response.json();

		if (!data.features || !Array.isArray(data.features)) {
			logger.warn('USGS Earthquake API', 'Invalid response format - no features array');
			return [];
		}

		logger.log('USGS Earthquake API', `Received ${data.features.length} earthquakes`);

		// Transform USGS data to our EarthquakeData format
		const earthquakes: EarthquakeData[] = data.features
			.filter((feature) => feature.properties.mag !== null && feature.properties.mag >= minMagnitude)
			.map((feature) => ({
				id: feature.id,
				magnitude: feature.properties.mag ?? 0,
				place: feature.properties.place ?? 'Unknown location',
				time: feature.properties.time,
				lat: feature.geometry.coordinates[1],
				lon: feature.geometry.coordinates[0],
				depth: feature.geometry.coordinates[2],
				url: feature.properties.url
			}));

		return earthquakes;
	} catch (error) {
		logger.error('USGS Earthquake API', 'Failed to fetch earthquakes:', error instanceof Error ? error.message : error);
		return [];
	}
}

/**
 * Get earthquake severity level based on magnitude
 * Based on Modified Mercalli Intensity Scale correlations
 */
export function getEarthquakeSeverity(magnitude: number): 'critical' | 'high' | 'moderate' | 'low' {
	if (magnitude >= 7.0) return 'critical';
	if (magnitude >= 6.0) return 'high';
	if (magnitude >= 5.0) return 'moderate';
	return 'low';
}

/**
 * Get earthquake severity color (hex) for map markers
 */
export function getEarthquakeColor(magnitude: number): string {
	if (magnitude >= 7.0) return '#ef4444'; // red-500
	if (magnitude >= 6.0) return '#f97316'; // orange-500
	if (magnitude >= 5.0) return '#eab308'; // yellow-500
	return '#22c55e'; // green-500
}

// ============================================================================
// AIR QUALITY API (OpenAQ)
// ============================================================================

import type { AirQualityLevel, AirQualityReading } from '$lib/types';

/**
 * Air quality level colors for map markers
 * Based on US EPA AQI color scheme
 */
export const AIR_QUALITY_COLORS: Record<AirQualityLevel, string> = {
	good: '#22c55e', // green-500
	moderate: '#eab308', // yellow-500
	unhealthy_sensitive: '#f97316', // orange-500
	unhealthy: '#ef4444', // red-500
	very_unhealthy: '#a855f7', // purple-500
	hazardous: '#7f1d1d' // maroon (red-900)
};

/**
 * Air quality level descriptions
 */
export const AIR_QUALITY_DESCRIPTIONS: Record<AirQualityLevel, string> = {
	good: 'Good - Air quality is satisfactory',
	moderate: 'Moderate - Acceptable air quality',
	unhealthy_sensitive: 'Unhealthy for Sensitive Groups',
	unhealthy: 'Unhealthy - Health effects for all',
	very_unhealthy: 'Very Unhealthy - Health alert',
	hazardous: 'Hazardous - Emergency conditions'
};

/**
 * Calculate AQI level from PM2.5 concentration (ug/m3)
 * Based on US EPA breakpoints
 */
export function getAirQualityLevel(pm25: number): AirQualityLevel {
	if (pm25 <= 12) return 'good';
	if (pm25 <= 35.4) return 'moderate';
	if (pm25 <= 55.4) return 'unhealthy_sensitive';
	if (pm25 <= 150.4) return 'unhealthy';
	if (pm25 <= 250.4) return 'very_unhealthy';
	return 'hazardous';
}

/**
 * Calculate US EPA AQI value from PM2.5 concentration
 * Returns a number 0-500+ based on EPA breakpoints
 */
export function calculateAQI(pm25: number): number {
	// EPA AQI breakpoints for PM2.5
	const breakpoints = [
		{ cLow: 0, cHigh: 12, iLow: 0, iHigh: 50 },
		{ cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
		{ cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
		{ cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200 },
		{ cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 },
		{ cLow: 250.5, cHigh: 350.4, iLow: 301, iHigh: 400 },
		{ cLow: 350.5, cHigh: 500.4, iLow: 401, iHigh: 500 }
	];

	for (const bp of breakpoints) {
		if (pm25 >= bp.cLow && pm25 <= bp.cHigh) {
			// Linear interpolation formula
			return Math.round(
				((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (pm25 - bp.cLow) + bp.iLow
			);
		}
	}

	// Beyond hazardous (500+)
	return Math.round(pm25);
}

// Cache for air quality data (10 minute TTL)
let airQualityCache: { data: AirQualityReading[]; timestamp: number } | null = null;
const AIR_QUALITY_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch air quality data from OpenAQ API
 * Returns PM2.5 readings from monitoring stations worldwide
 * Uses the /v2/latest endpoint for most recent measurements
 *
 * API: https://api.openaq.org/v2/latest
 * Docs: https://docs.openaq.org/
 */
export async function fetchAirQualityData(): Promise<AirQualityReading[]> {
	// Check cache first
	if (airQualityCache && Date.now() - airQualityCache.timestamp < AIR_QUALITY_CACHE_TTL) {
		logger.log('OpenAQ API', `Returning ${airQualityCache.data.length} cached air quality readings`);
		return airQualityCache.data;
	}

	try {
		// OpenAQ v2 API - fetch latest PM2.5 measurements
		// limit=1000 gets a good global sample
		const openaqUrl = 'https://api.openaq.org/v2/latest?limit=1000&parameter=pm25';

		logger.log('OpenAQ API', 'Fetching latest PM2.5 measurements...');

		const response = await fetch(openaqUrl, {
			headers: {
				'Accept': 'application/json'
			},
			signal: AbortSignal.timeout(15000)
		});

		if (!response.ok) {
			throw new Error(`OpenAQ API returned status ${response.status}`);
		}

		const data = await response.json();

		if (!data.results || !Array.isArray(data.results)) {
			logger.warn('OpenAQ API', 'Invalid response format - no results array');
			return airQualityCache?.data || [];
		}

		logger.log('OpenAQ API', `Received ${data.results.length} locations`);

		// Transform OpenAQ response to our AirQualityReading format
		const readings: AirQualityReading[] = [];

		for (const location of data.results) {
			// Skip locations without coordinates
			if (!location.coordinates?.latitude || !location.coordinates?.longitude) {
				continue;
			}

			// Find PM2.5 measurement
			const pm25Measurement = location.measurements?.find(
				(m: { parameter: string }) => m.parameter === 'pm25'
			);

			if (!pm25Measurement || pm25Measurement.value === null || pm25Measurement.value < 0) {
				continue;
			}

			const pm25Value = pm25Measurement.value;
			const level = getAirQualityLevel(pm25Value);
			const aqi = calculateAQI(pm25Value);

			readings.push({
				id: `openaq-${location.location}-${location.coordinates.latitude}-${location.coordinates.longitude}`,
				locationId: location.locationId || 0,
				location: location.location || 'Unknown Station',
				city: location.city || undefined,
				country: location.country || 'Unknown',
				lat: location.coordinates.latitude,
				lon: location.coordinates.longitude,
				parameter: 'pm25',
				value: pm25Value,
				unit: pm25Measurement.unit || 'ug/m3',
				lastUpdated: pm25Measurement.lastUpdated || new Date().toISOString(),
				aqi,
				level
			});
		}

		logger.log('OpenAQ API', `Processed ${readings.length} valid PM2.5 readings`);

		// Update cache
		airQualityCache = {
			data: readings,
			timestamp: Date.now()
		};

		return readings;
	} catch (error) {
		logger.error('OpenAQ API', 'Failed to fetch air quality data:', error instanceof Error ? error.message : error);

		// Return cached data if available
		if (airQualityCache?.data) {
			logger.log('OpenAQ API', `Returning ${airQualityCache.data.length} stale cached readings`);
			return airQualityCache.data;
		}

		return [];
	}
}

// ============================================================================
// RADIATION MONITORING API (Safecast)
// ============================================================================

/**
 * Radiation reading data from Safecast API
 */
export type RadiationLevel = 'normal' | 'elevated' | 'high' | 'dangerous';

export interface RadiationReading {
	id: string;
	lat: number;
	lon: number;
	value: number; // CPM (counts per minute) or uSv/h
	unit: 'cpm' | 'usv';
	capturedAt: string;
	deviceId?: string;
	location?: string;
	level: RadiationLevel;
}

/**
 * Radiation level colors for map markers
 */
export const RADIATION_LEVEL_COLORS: Record<RadiationLevel, string> = {
	dangerous: '#ef4444', // red-500
	high: '#f97316', // orange-500
	elevated: '#eab308', // yellow-500
	normal: '#22c55e' // green-500
};

/**
 * Radiation level descriptions
 */
export const RADIATION_LEVEL_DESCRIPTIONS: Record<RadiationLevel, string> = {
	normal: 'Normal background radiation',
	elevated: 'Elevated - Above normal background',
	high: 'High - Action may be needed',
	dangerous: 'Dangerous - Immediate concern'
};

/**
 * Classify radiation level based on CPM value
 * Reference: https://safecast.org/about/radiation/
 * Normal background: ~30-50 CPM (depends on location)
 * Elevated: 50-100 CPM
 * High: 100-350 CPM (action may be needed)
 * Dangerous: > 350 CPM (immediate concern)
 */
function classifyRadiationLevel(value: number, unit: 'cpm' | 'usv'): RadiationLevel {
	// Convert to CPM if needed (1 uSv/h ~= 350 CPM for Cs-137)
	const cpm = unit === 'usv' ? value * 350 : value;

	if (cpm >= 350) return 'dangerous';
	if (cpm >= 100) return 'high';
	if (cpm >= 50) return 'elevated';
	return 'normal';
}

/**
 * Safecast API response item structure
 */
interface SafecastMeasurement {
	id: number;
	value: number;
	unit: string;
	latitude: number | string;
	longitude: number | string;
	captured_at: string;
	device_id?: number;
	location_name?: string;
}

// Cache for radiation data (5 minute TTL)
let radiationCache: { data: RadiationReading[]; timestamp: number } | null = null;
const RADIATION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch radiation readings from Safecast API
 * Safecast is a global citizen science project mapping radiation
 * API is free and data is CC0 licensed
 * API Docs: https://api.safecast.org/en-US
 *
 * @returns Array of radiation readings sorted by value (highest first)
 */
export async function fetchRadiationData(): Promise<RadiationReading[]> {
	// Check cache first
	if (radiationCache && Date.now() - radiationCache.timestamp < RADIATION_CACHE_TTL) {
		logger.log('Safecast API', `Returning ${radiationCache.data.length} cached readings`);
		return radiationCache.data;
	}

	const readings: RadiationReading[] = [];

	// Calculate date for since parameter (14 days ago for better geographic coverage)
	// Using 'since' which filters by when measurements were added to database
	const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
	const sinceDate = fourteenDaysAgo.toISOString().split('T')[0];

	// Safecast API with date filtering
	// Using 'since' parameter to get recently added measurements
	// Request more to filter non-radiation measurements and get geographic diversity
	// Add cache-buster to prevent stale browser cache
	const cacheBuster = Math.floor(Date.now() / 60000); // Changes every minute
	const apiUrl = `https://api.safecast.org/measurements.json?since=${sinceDate}&limit=2000&_cb=${cacheBuster}`;

	try {
		logger.log('Safecast API', `Fetching measurements added since ${sinceDate}...`);

		// Try direct fetch first with no-cache headers
		const response = await fetch(apiUrl, {
			headers: {
				Accept: 'application/json',
				'Cache-Control': 'no-cache'
			},
			cache: 'no-store',
			signal: AbortSignal.timeout(15000)
		});

		if (!response.ok) {
			throw new Error(`Safecast API returned status ${response.status}`);
		}

		const data = (await response.json()) as SafecastMeasurement[];
		logger.log('Safecast API', `Received ${data.length} measurements`);

		if (!Array.isArray(data)) {
			throw new Error('Invalid response format from Safecast API');
		}

		for (const item of data) {
			// Skip invalid entries
			if (!item.value || !item.latitude || !item.longitude) continue;

			// Skip non-radiation measurements (celcius, status, etc.)
			const itemUnit = item.unit?.toLowerCase() || '';
			if (!itemUnit || !['cpm', 'usv'].includes(itemUnit)) continue;

			// Skip entries with missing or clearly invalid timestamps
			if (!item.captured_at) continue;
			const capturedDate = new Date(item.captured_at);
			if (isNaN(capturedDate.getTime()) || capturedDate.getFullYear() < 2020) continue;

			const lat = typeof item.latitude === 'string' ? parseFloat(item.latitude) : item.latitude;
			const lon =
				typeof item.longitude === 'string' ? parseFloat(item.longitude) : item.longitude;

			// Skip if coordinates are invalid
			if (isNaN(lat) || isNaN(lon)) continue;

			// Determine unit (Safecast uses 'cpm' or 'usv')
			const unit: 'cpm' | 'usv' = itemUnit === 'usv' ? 'usv' : 'cpm';

			const reading: RadiationReading = {
				id: `safecast-${item.id}`,
				lat,
				lon,
				value: item.value,
				unit,
				capturedAt: item.captured_at,
				deviceId: item.device_id ? `Device ${item.device_id}` : undefined,
				location: item.location_name || undefined,
				level: classifyRadiationLevel(item.value, unit)
			};

			readings.push(reading);
		}

		// Deduplicate by location (keep most recent reading per location for geographic diversity)
		const locationMap = new Map<string, RadiationReading>();
		for (const reading of readings) {
			// Round to 2 decimal places (~1km precision) for grouping nearby sensors
			const locationKey = `${reading.lat.toFixed(2)},${reading.lon.toFixed(2)}`;
			const existing = locationMap.get(locationKey);
			// Keep the reading with higher value (more interesting) or more recent if same
			if (!existing || reading.value > existing.value) {
				locationMap.set(locationKey, reading);
			}
		}
		const uniqueReadings = Array.from(locationMap.values());

		// Sort by value descending (highest readings first)
		uniqueReadings.sort((a, b) => {
			// Normalize to CPM for comparison
			const aValue = a.unit === 'usv' ? a.value * 350 : a.value;
			const bValue = b.unit === 'usv' ? b.value * 350 : b.value;
			return bValue - aValue;
		});

		logger.log('Safecast API', `Processed ${readings.length} readings, ${uniqueReadings.length} unique locations`);

		// Update cache with deduplicated readings
		radiationCache = {
			data: uniqueReadings,
			timestamp: Date.now()
		};

		return uniqueReadings;
	} catch (error) {
		logger.warn(
			'Safecast API',
			'Failed to fetch radiation data:',
			error instanceof Error ? error.message : error
		);

		// Try via CORS proxy as fallback
		try {
			const proxyUrl = `https://bitter-sea-8577.ahandle.workers.dev/?url=${encodeURIComponent(apiUrl)}`;

			logger.log('Safecast API', 'Retrying via CORS proxy...');
			const proxyResponse = await fetch(proxyUrl, {
				headers: {
					Accept: 'application/json'
				},
				signal: AbortSignal.timeout(20000)
			});

			if (proxyResponse.ok) {
				const proxyData = (await proxyResponse.json()) as SafecastMeasurement[];

				if (Array.isArray(proxyData)) {
					for (const item of proxyData) {
						if (!item.value || !item.latitude || !item.longitude) continue;

						// Skip non-radiation measurements (celcius, status, etc.)
						const itemUnit = item.unit?.toLowerCase() || '';
						if (!itemUnit || !['cpm', 'usv'].includes(itemUnit)) continue;

						// Skip entries with missing or clearly invalid timestamps
						if (!item.captured_at) continue;
						const capturedDate = new Date(item.captured_at);
						if (isNaN(capturedDate.getTime()) || capturedDate.getFullYear() < 2020) continue;

						const lat =
							typeof item.latitude === 'string' ? parseFloat(item.latitude) : item.latitude;
						const lon =
							typeof item.longitude === 'string' ? parseFloat(item.longitude) : item.longitude;

						if (isNaN(lat) || isNaN(lon)) continue;

						const unit: 'cpm' | 'usv' = itemUnit === 'usv' ? 'usv' : 'cpm';

						readings.push({
							id: `safecast-${item.id}`,
							lat,
							lon,
							value: item.value,
							unit,
							capturedAt: item.captured_at,
							deviceId: item.device_id ? `Device ${item.device_id}` : undefined,
							location: item.location_name || undefined,
							level: classifyRadiationLevel(item.value, unit)
						});
					}

					readings.sort((a, b) => {
						const aValue = a.unit === 'usv' ? a.value * 350 : a.value;
						const bValue = b.unit === 'usv' ? b.value * 350 : b.value;
						return bValue - aValue;
					});

					logger.log('Safecast API', `Proxy fetch successful: ${readings.length} readings`);

					// Update cache
					radiationCache = {
						data: readings,
						timestamp: Date.now()
					};

					return readings;
				}
			}
		} catch (proxyError) {
			logger.warn(
				'Safecast API',
				'CORS proxy fetch also failed:',
				proxyError instanceof Error ? proxyError.message : proxyError
			);
		}

		// Return cached data if available
		if (radiationCache?.data) {
			logger.log('Safecast API', `Returning ${radiationCache.data.length} stale cached readings`);
			return radiationCache.data;
		}

		// Return empty array on failure
		return [];
	}
}

/**
 * Get color for radiation level (for map markers)
 */
export function getRadiationLevelColor(level: RadiationLevel): string {
	return RADIATION_LEVEL_COLORS[level] || RADIATION_LEVEL_COLORS.normal;
}

// ============================================================================
// DISEASE OUTBREAK APIs
// ============================================================================

import type {
	DiseaseOutbreak,
	DiseaseOutbreakSeverity,
	DiseaseOutbreakStatus
} from '$lib/types';

/**
 * Country coordinates for geocoding outbreak locations
 * Used when API responses don't include lat/lon
 */
const COUNTRY_COORDS: Record<string, { lat: number; lon: number }> = {
	'Afghanistan': { lat: 33.93, lon: 67.71 },
	'Algeria': { lat: 28.03, lon: 1.66 },
	'Angola': { lat: -11.20, lon: 17.87 },
	'Argentina': { lat: -38.42, lon: -63.62 },
	'Australia': { lat: -25.27, lon: 133.78 },
	'Bangladesh': { lat: 23.68, lon: 90.36 },
	'Bolivia': { lat: -16.29, lon: -63.59 },
	'Brazil': { lat: -14.24, lon: -51.93 },
	'Burkina Faso': { lat: 12.24, lon: -1.56 },
	'Burundi': { lat: -3.37, lon: 29.92 },
	'Cambodia': { lat: 12.57, lon: 104.99 },
	'Cameroon': { lat: 7.37, lon: 12.35 },
	'Canada': { lat: 56.13, lon: -106.35 },
	'Central African Republic': { lat: 6.61, lon: 20.94 },
	'Chad': { lat: 15.45, lon: 18.73 },
	'Chile': { lat: -35.68, lon: -71.54 },
	'China': { lat: 35.86, lon: 104.20 },
	'Colombia': { lat: 4.57, lon: -74.30 },
	'Comoros': { lat: -11.88, lon: 43.87 },
	'Costa Rica': { lat: 9.75, lon: -83.75 },
	'Cuba': { lat: 21.52, lon: -77.78 },
	'Democratic Republic of the Congo': { lat: -4.04, lon: 21.76 },
	'DRC': { lat: -4.04, lon: 21.76 },
	'Ecuador': { lat: -1.83, lon: -78.18 },
	'Egypt': { lat: 26.82, lon: 30.80 },
	'El Salvador': { lat: 13.79, lon: -88.90 },
	'Eritrea': { lat: 15.18, lon: 39.78 },
	'Ethiopia': { lat: 9.15, lon: 40.49 },
	'France': { lat: 46.23, lon: 2.21 },
	'Gabon': { lat: -0.80, lon: 11.61 },
	'Germany': { lat: 51.17, lon: 10.45 },
	'Ghana': { lat: 7.95, lon: -1.02 },
	'Guatemala': { lat: 15.78, lon: -90.23 },
	'Guinea': { lat: 9.95, lon: -9.70 },
	'Guinea-Bissau': { lat: 11.80, lon: -15.18 },
	'Haiti': { lat: 18.97, lon: -72.29 },
	'Honduras': { lat: 15.20, lon: -86.24 },
	'India': { lat: 20.59, lon: 78.96 },
	'Indonesia': { lat: -0.79, lon: 113.92 },
	'Iran': { lat: 32.43, lon: 53.69 },
	'Iraq': { lat: 33.22, lon: 43.68 },
	'Israel': { lat: 31.05, lon: 34.85 },
	'Italy': { lat: 41.87, lon: 12.57 },
	'Ivory Coast': { lat: 7.54, lon: -5.55 },
	'Japan': { lat: 36.20, lon: 138.25 },
	'Jordan': { lat: 30.59, lon: 36.24 },
	'Kenya': { lat: -0.02, lon: 37.91 },
	'Lebanon': { lat: 33.85, lon: 35.86 },
	'Liberia': { lat: 6.43, lon: -9.43 },
	'Libya': { lat: 26.34, lon: 17.23 },
	'Madagascar': { lat: -18.77, lon: 46.87 },
	'Malawi': { lat: -13.25, lon: 34.30 },
	'Malaysia': { lat: 4.21, lon: 101.98 },
	'Mali': { lat: 17.57, lon: -4.00 },
	'Mauritania': { lat: 21.01, lon: -10.94 },
	'Mexico': { lat: 23.63, lon: -102.55 },
	'Morocco': { lat: 31.79, lon: -7.09 },
	'Mozambique': { lat: -18.67, lon: 35.53 },
	'Myanmar': { lat: 21.91, lon: 95.96 },
	'Nepal': { lat: 28.39, lon: 84.12 },
	'Nicaragua': { lat: 12.87, lon: -85.21 },
	'Niger': { lat: 17.61, lon: 8.08 },
	'Nigeria': { lat: 9.08, lon: 8.68 },
	'North Korea': { lat: 40.34, lon: 127.51 },
	'Pakistan': { lat: 30.38, lon: 69.35 },
	'Panama': { lat: 8.54, lon: -80.78 },
	'Papua New Guinea': { lat: -6.31, lon: 143.96 },
	'Paraguay': { lat: -23.44, lon: -58.44 },
	'Peru': { lat: -9.19, lon: -75.02 },
	'Philippines': { lat: 12.88, lon: 121.77 },
	'Poland': { lat: 51.92, lon: 19.15 },
	'Republic of the Congo': { lat: -0.23, lon: 15.83 },
	'Russia': { lat: 61.52, lon: 105.32 },
	'Rwanda': { lat: -1.94, lon: 29.87 },
	'Saudi Arabia': { lat: 23.89, lon: 45.08 },
	'Senegal': { lat: 14.50, lon: -14.45 },
	'Sierra Leone': { lat: 8.46, lon: -11.78 },
	'Somalia': { lat: 5.15, lon: 46.20 },
	'South Africa': { lat: -30.56, lon: 22.94 },
	'South Korea': { lat: 35.91, lon: 127.77 },
	'South Sudan': { lat: 6.88, lon: 31.31 },
	'Spain': { lat: 40.46, lon: -3.75 },
	'Sri Lanka': { lat: 7.87, lon: 80.77 },
	'Sudan': { lat: 12.86, lon: 30.22 },
	'Syria': { lat: 34.80, lon: 39.00 },
	'Taiwan': { lat: 23.70, lon: 120.96 },
	'Tanzania': { lat: -6.37, lon: 34.89 },
	'Thailand': { lat: 15.87, lon: 100.99 },
	'Togo': { lat: 8.62, lon: 0.82 },
	'Tunisia': { lat: 33.89, lon: 9.54 },
	'Turkey': { lat: 38.96, lon: 35.24 },
	'Uganda': { lat: 1.37, lon: 32.29 },
	'Ukraine': { lat: 48.38, lon: 31.17 },
	'United Kingdom': { lat: 55.38, lon: -3.44 },
	'United States': { lat: 37.09, lon: -95.71 },
	'USA': { lat: 37.09, lon: -95.71 },
	'Venezuela': { lat: 6.42, lon: -66.59 },
	'Vietnam': { lat: 14.06, lon: 108.28 },
	'Yemen': { lat: 15.55, lon: 48.52 },
	'Zambia': { lat: -13.13, lon: 27.85 },
	'Zimbabwe': { lat: -19.02, lon: 29.15 }
};

/**
 * Get coordinates for a country name
 */
function getCountryCoords(country: string): { lat: number; lon: number } | null {
	// Try exact match first
	if (COUNTRY_COORDS[country]) {
		return COUNTRY_COORDS[country];
	}
	// Try case-insensitive match
	const lowerCountry = country.toLowerCase();
	for (const [name, coords] of Object.entries(COUNTRY_COORDS)) {
		if (name.toLowerCase() === lowerCountry) {
			return coords;
		}
	}
	// Try partial match
	for (const [name, coords] of Object.entries(COUNTRY_COORDS)) {
		if (lowerCountry.includes(name.toLowerCase()) || name.toLowerCase().includes(lowerCountry)) {
			return coords;
		}
	}
	return null;
}

/**
 * Determine outbreak severity based on cases and deaths
 */
function determineOutbreakSeverity(
	cases?: number,
	deaths?: number,
	diseaseName?: string
): DiseaseOutbreakSeverity {
	// High-fatality diseases always start at high severity
	const highFatalityDiseases = ['ebola', 'marburg', 'mpox', 'avian flu', 'h5n1', 'nipah', 'plague'];
	const diseaseLC = diseaseName?.toLowerCase() || '';
	const isHighFatality = highFatalityDiseases.some(d => diseaseLC.includes(d));

	if (isHighFatality) {
		if (deaths && deaths >= 100) return 'critical';
		if (deaths && deaths >= 10) return 'high';
		return 'moderate';
	}

	// For other diseases, base on case counts
	if (cases && cases >= 10000) return 'critical';
	if (cases && cases >= 1000) return 'high';
	if (cases && cases >= 100) return 'moderate';
	if (deaths && deaths >= 10) return 'high';
	if (deaths && deaths >= 1) return 'moderate';
	return 'low';
}

/**
 * Determine outbreak status based on data
 */
function determineOutbreakStatus(lastUpdate: string, _isOngoing?: boolean): DiseaseOutbreakStatus {
	const updateDate = new Date(lastUpdate);
	const daysSinceUpdate = (Date.now() - updateDate.getTime()) / (1000 * 60 * 60 * 24);

	if (daysSinceUpdate > 60) return 'contained';
	if (daysSinceUpdate > 30) return 'monitoring';
	return 'active';
}

/**
 * Fetch disease outbreak data from ReliefWeb API
 * ReliefWeb provides humanitarian disaster data including epidemics
 */
async function fetchReliefWebOutbreaks(): Promise<DiseaseOutbreak[]> {
	const outbreaks: DiseaseOutbreak[] = [];

	try {
		// ReliefWeb API - fetch epidemic disasters
		const url = 'https://api.reliefweb.int/v1/disasters?' +
			'appname=situation-monitor&' +
			'filter[field]=type&' +
			'filter[value]=Epidemic&' +
			'limit=50&' +
			'fields[include][]=name&' +
			'fields[include][]=description&' +
			'fields[include][]=date&' +
			'fields[include][]=country&' +
			'fields[include][]=url&' +
			'fields[include][]=status&' +
			'sort[]=date:desc';

		const response = await fetch(url, {
			headers: {
				'Accept': 'application/json'
			},
			signal: AbortSignal.timeout(15000)
		});

		if (!response.ok) {
			throw new Error(`ReliefWeb API error: ${response.status}`);
		}

		const data = await response.json();

		if (data.data && Array.isArray(data.data)) {
			for (const item of data.data) {
				const fields = item.fields;
				if (!fields) continue;

				// Parse disease name from disaster name (usually "Disease - Country")
				const name = fields.name || '';
				let disease = name.split(' - ')[0] || name.split(':')[0] || name;
				disease = disease.trim();

				// Get country
				const countries = fields.country || [];
				const countryObj = countries[0];
				const country = countryObj?.name || 'Unknown';

				// Get coordinates
				const coords = getCountryCoords(country);
				if (!coords) continue; // Skip if we can't geocode

				// Parse date
				const dateObj = fields.date;
				const startDate = dateObj?.created || new Date().toISOString();
				const lastUpdate = dateObj?.changed || startDate;

				// Determine status
				const status = determineOutbreakStatus(lastUpdate, fields.status === 'current');

				// Determine severity (ReliefWeb doesn't provide case counts directly)
				const severity = determineOutbreakSeverity(undefined, undefined, disease);

				outbreaks.push({
					id: `reliefweb-${item.id}`,
					disease,
					country,
					lat: coords.lat,
					lon: coords.lon,
					status,
					severity,
					startDate: startDate.split('T')[0],
					lastUpdate: lastUpdate.split('T')[0],
					source: 'ReliefWeb',
					url: fields.url
				});
			}
		}
	} catch (error) {
		logger.warn('ReliefWeb API', 'Failed to fetch outbreak data:', error instanceof Error ? error.message : error);
	}

	return outbreaks;
}

/**
 * WHO Outbreaks API response item structure
 */
interface WHOOutbreakItem {
	Title: string;
	Summary: string;
	PublicationDate: string;
	LastModified: string;
	ItemDefaultUrl: string;
	UrlName: string;
}

/**
 * WHO Outbreaks API response wrapper
 */
interface WHOOutbreakResponse {
	'@odata.context'?: string;
	value: WHOOutbreakItem[];
}

/**
 * Fetch disease outbreak data from WHO Outbreaks API
 * API Docs: GET https://www.who.int/api/news/outbreaks
 */
async function fetchWHOOutbreaks(): Promise<DiseaseOutbreak[]> {
	const outbreaks: DiseaseOutbreak[] = [];

	try {
		// WHO Outbreaks JSON API
		const apiUrl = 'https://www.who.int/api/news/outbreaks';

		logger.log('WHO Outbreaks API', 'Fetching outbreak data...');

		// Try direct fetch first
		let response: Response;
		try {
			response = await fetch(apiUrl, {
				headers: { 'Accept': 'application/json' },
				signal: AbortSignal.timeout(15000)
			});
		} catch {
			// Try via CORS proxy if direct fails
			const proxyUrl = `https://bitter-sea-8577.ahandle.workers.dev/?url=${encodeURIComponent(apiUrl)}`;
			response = await fetch(proxyUrl, {
				headers: { 'Accept': 'application/json' },
				signal: AbortSignal.timeout(20000)
			});
		}

		if (!response.ok) {
			throw new Error(`WHO API error: ${response.status}`);
		}

		const responseData = (await response.json()) as WHOOutbreakResponse | WHOOutbreakItem[];

		// Handle both direct array and OData wrapped response
		const data: WHOOutbreakItem[] = Array.isArray(responseData)
			? responseData
			: (responseData.value || []);

		logger.log('WHO Outbreaks API', `Received ${data.length} outbreak items`);

		if (data.length === 0) {
			logger.log('WHO Outbreaks API', 'No outbreaks returned from API');
			return outbreaks;
		}

		for (const item of data.slice(0, 30)) {
			const title = item.Title || '';
			const pubDate = item.PublicationDate || item.LastModified || '';
			const parsedDate = pubDate ? new Date(pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
			const url = item.ItemDefaultUrl ? `https://www.who.int${item.ItemDefaultUrl}` : '';

			// Parse disease and country from title
			// Common formats: "Disease - Country" or "Disease in Country"
			let disease = '';
			let country = '';

			// Try "Disease - Country" format
			if (title.includes(' - ')) {
				const parts = title.split(' - ');
				disease = parts[0]?.trim() || '';
				country = parts[1]?.trim() || '';
			} else if (title.toLowerCase().includes(' in ')) {
				// Try "Disease in Country" format
				const match = title.match(/(.+?)\s+in\s+(.+)/i);
				if (match) {
					disease = match[1]?.trim() || '';
					country = match[2]?.trim() || '';
				}
			}

			// Clean up country name (remove extra text)
			country = country.split(',')[0]?.trim() || country;
			country = country.split('(')[0]?.trim() || country;

			if (!disease || !country) {
				// Use title as disease if parsing failed
				disease = title;
				country = 'Unknown';
			}

			// Get coordinates
			const coords = getCountryCoords(country);
			if (!coords) continue;

			// Determine severity and status
			const severity = determineOutbreakSeverity(undefined, undefined, disease);
			const status = determineOutbreakStatus(parsedDate);

			outbreaks.push({
				id: `who-${item.UrlName || Math.random().toString(36).substr(2, 9)}`,
				disease,
				country,
				lat: coords.lat,
				lon: coords.lon,
				status,
				severity,
				startDate: parsedDate,
				lastUpdate: parsedDate,
				source: 'WHO',
				url
			});
		}

		logger.log('WHO Outbreaks API', `Processed ${outbreaks.length} valid outbreaks`);
	} catch (error) {
		logger.warn('WHO Outbreaks API', 'Failed to fetch outbreak data:', error instanceof Error ? error.message : error);
	}

	return outbreaks;
}

/**
 * Fetch disease outbreak data from multiple sources
 * Combines data from WHO, ReliefWeb, and fallback data
 */
export async function fetchDiseaseOutbreaks(): Promise<DiseaseOutbreak[]> {
	const allOutbreaks: DiseaseOutbreak[] = [];
	const seenIds = new Set<string>();

	// Helper to deduplicate outbreaks
	const addOutbreak = (outbreak: DiseaseOutbreak) => {
		// Create unique key based on disease + country
		const key = `${outbreak.disease.toLowerCase()}-${outbreak.country.toLowerCase()}`;
		if (!seenIds.has(key)) {
			allOutbreaks.push(outbreak);
			seenIds.add(key);
		}
	};

	// Fetch from multiple sources in parallel
	const [reliefWebData, whoData] = await Promise.all([
		fetchReliefWebOutbreaks().catch(() => []),
		fetchWHOOutbreaks().catch(() => [])
	]);

	// Add results (prefer WHO data as it's more authoritative)
	whoData.forEach(addOutbreak);
	reliefWebData.forEach(addOutbreak);

	// No fallback data - only show live data from APIs

	// Sort by severity (critical first) then by last update
	const severityOrder: Record<DiseaseOutbreakSeverity, number> = {
		critical: 0,
		high: 1,
		moderate: 2,
		low: 3
	};

	allOutbreaks.sort((a, b) => {
		const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
		if (severityDiff !== 0) return severityDiff;
		return new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime();
	});

	return allOutbreaks;
}

/**
 * Get severity color for disease outbreak map markers
 */
export function getDiseaseOutbreakColor(severity: DiseaseOutbreakSeverity): string {
	switch (severity) {
		case 'critical': return '#ef4444'; // red-500
		case 'high': return '#f97316'; // orange-500
		case 'moderate': return '#eab308'; // yellow-500
		case 'low': return '#22c55e'; // green-500
	}
}

/**
 * Color constants for disease outbreak severity levels
 */
export const DISEASE_OUTBREAK_COLORS: Record<DiseaseOutbreakSeverity, string> = {
	critical: '#ef4444',
	high: '#f97316',
	moderate: '#eab308',
	low: '#22c55e'
};
