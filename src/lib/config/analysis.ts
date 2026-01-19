/**
 * Analysis configuration - correlation topics, narrative patterns, source classification
 */

export interface CorrelationTopic {
	id: string;
	patterns: RegExp[];
	category: string;
	weight?: number; // Higher weight = more significance in scoring
	predictiveIndicators?: string[]; // Phrases that suggest predictive value
}

export interface NarrativePattern {
	id: string;
	keywords: string[];
	category: string;
	severity: 'watch' | 'emerging' | 'spreading' | 'disinfo';
	amplificationPhrases?: string[]; // Phrases that suggest narrative spreading
	debunkIndicators?: string[]; // Phrases suggesting fact-checking/debunking
}

export interface SourceTypes {
	fringe: string[];
	alternative: string[];
	mainstream: string[];
	institutional: string[]; // Government, academic, official sources
	aggregator: string[]; // News aggregators
}

// Person role categories for better classification
export type PersonRole =
	| 'political'
	| 'tech'
	| 'finance'
	| 'military'
	| 'media'
	| 'central_bank'
	| 'international'
	| 'other';

// Sentiment indicators for person mentions
export interface SentimentIndicator {
	positive: string[];
	negative: string[];
	neutral: string[];
}

export const CORRELATION_TOPICS: CorrelationTopic[] = [
	// Economy & Finance Topics
	{
		id: 'tariffs',
		patterns: [/tariff/i, /trade war/i, /import tax/i, /customs duty/i, /trade barrier/i, /trade deficit/i, /trade deal/i, /trade negotiation/i],
		category: 'Economy',
		weight: 3,
		predictiveIndicators: ['expected to', 'planning', 'considering', 'may impose', 'threatens to']
	},
	{
		id: 'fed-rates',
		patterns: [/federal reserve/i, /interest rate/i, /rate cut/i, /rate hike/i, /powell/i, /fomc/i, /fed meeting/i, /monetary policy/i, /rate decision/i, /basis point/i],
		category: 'Economy',
		weight: 4,
		predictiveIndicators: ['expected', 'forecast', 'likely', 'anticipate', 'signal']
	},
	{
		id: 'inflation',
		patterns: [/inflation/i, /cpi\b/i, /consumer price/i, /cost of living/i, /pce\b/i, /price index/i, /deflation/i, /stagflation/i, /hyperinflation/i],
		category: 'Economy',
		weight: 3,
		predictiveIndicators: ['rising', 'falling', 'accelerating', 'cooling']
	},
	{
		id: 'recession',
		patterns: [/recession/i, /economic downturn/i, /gdp.*contract/i, /economic slowdown/i, /hard landing/i, /soft landing/i, /yield curve.*invert/i],
		category: 'Economy',
		weight: 4,
		predictiveIndicators: ['warning', 'risk', 'fears', 'imminent', 'averted']
	},
	{
		id: 'housing',
		patterns: [/housing market/i, /mortgage rate/i, /home price/i, /real estate.*crash/i, /housing bubble/i, /home sales/i, /housing starts/i, /foreclosure/i],
		category: 'Economy',
		weight: 2,
		predictiveIndicators: ['plunge', 'soar', 'crash', 'recovery']
	},
	{
		id: 'layoffs',
		patterns: [/layoff/i, /job cut/i, /workforce reduction/i, /downsizing/i, /restructuring/i, /headcount/i, /severance/i, /rif\b/i, /furlough/i],
		category: 'Business',
		weight: 2,
		predictiveIndicators: ['announces', 'planning', 'expected', 'imminent']
	},
	{
		id: 'bank-crisis',
		patterns: [/bank.*fail/i, /banking crisis/i, /fdic/i, /bank run/i, /bank collapse/i, /liquidity crisis/i, /bank stress/i, /deposit flight/i],
		category: 'Finance',
		weight: 5,
		predictiveIndicators: ['contagion', 'spreading', 'fears', 'risk']
	},
	{
		id: 'crypto',
		patterns: [/bitcoin/i, /crypto.*regulation/i, /ethereum/i, /sec.*crypto/i, /crypto crash/i, /stablecoin/i, /defi\b/i, /crypto exchange/i, /btc\b/i, /eth\b/i],
		category: 'Finance',
		weight: 2,
		predictiveIndicators: ['rally', 'crash', 'surge', 'plunge', 'breakout']
	},
	{
		id: 'supply-chain',
		patterns: [/supply chain/i, /shipping.*delay/i, /port.*congestion/i, /logistics.*crisis/i, /container shortage/i, /freight/i, /backlog/i, /shortage/i],
		category: 'Economy',
		weight: 3,
		predictiveIndicators: ['disruption', 'crisis', 'bottleneck', 'improving']
	},
	{
		id: 'debt-ceiling',
		patterns: [/debt ceiling/i, /debt limit/i, /government shutdown/i, /default.*treasury/i, /x-date/i, /extraordinary measures/i],
		category: 'Economy',
		weight: 5,
		predictiveIndicators: ['deadline', 'crisis', 'breach', 'deal']
	},
	// Tech Topics
	{
		id: 'ai-regulation',
		patterns: [/ai regulation/i, /artificial intelligence.*law/i, /ai safety/i, /ai governance/i, /ai policy/i, /ai act/i, /ai bill/i, /regulate ai/i],
		category: 'Tech',
		weight: 3,
		predictiveIndicators: ['proposed', 'draft', 'passed', 'enacted']
	},
	{
		id: 'ai-advancement',
		patterns: [/ai breakthrough/i, /gpt-?\d/i, /claude\s*\d/i, /llm\b/i, /large language model/i, /generative ai/i, /frontier model/i, /agi\b/i],
		category: 'Tech',
		weight: 2,
		predictiveIndicators: ['release', 'launch', 'announce', 'breakthrough']
	},
	{
		id: 'big-tech',
		patterns: [/antitrust.*tech/i, /google.*monopoly/i, /meta.*lawsuit/i, /apple.*doj/i, /tech.*breakup/i, /big tech.*regulation/i, /faang/i],
		category: 'Tech',
		weight: 3,
		predictiveIndicators: ['lawsuit', 'ruling', 'settlement', 'investigation']
	},
	{
		id: 'deepfake',
		patterns: [/deepfake/i, /ai.*misinformation/i, /synthetic media/i, /ai-generated.*fake/i, /voice clone/i, /face swap/i],
		category: 'Tech',
		weight: 2,
		predictiveIndicators: ['viral', 'spreading', 'detected', 'exposed']
	},
	{
		id: 'cyber-attack',
		patterns: [/cyber attack/i, /ransomware/i, /data breach/i, /hack.*million/i, /cyber.*infrastructure/i, /state-sponsored.*hack/i, /zero-day/i],
		category: 'Tech',
		weight: 4,
		predictiveIndicators: ['compromised', 'breached', 'targeted', 'ongoing']
	},
	// Geopolitics & Conflict
	{
		id: 'china-tensions',
		patterns: [/china.*taiwan/i, /south china sea/i, /us.*china/i, /beijing.*washington/i, /taiwan strait/i, /chip war/i, /tech war.*china/i, /decoupling.*china/i],
		category: 'Geopolitics',
		weight: 4,
		predictiveIndicators: ['escalation', 'tensions', 'military', 'sanctions']
	},
	{
		id: 'russia-ukraine',
		patterns: [/ukraine/i, /zelensky/i, /putin.*war/i, /crimea/i, /donbas/i, /kharkiv/i, /bakhmut/i, /counteroffensive/i, /wagner/i],
		category: 'Conflict',
		weight: 4,
		predictiveIndicators: ['offensive', 'advance', 'retreat', 'peace', 'ceasefire']
	},
	{
		id: 'israel-gaza',
		patterns: [/gaza/i, /hamas/i, /netanyahu/i, /israel.*attack/i, /hostage/i, /idf\b/i, /hezbollah/i, /west bank/i, /rafah/i, /humanitarian.*gaza/i],
		category: 'Conflict',
		weight: 4,
		predictiveIndicators: ['ceasefire', 'invasion', 'escalation', 'casualties']
	},
	{
		id: 'iran',
		patterns: [/iran.*nuclear/i, /tehran/i, /ayatollah/i, /iranian.*strike/i, /iran.*israel/i, /irgc\b/i, /houthi/i, /red sea.*attack/i, /iranian proxy/i],
		category: 'Geopolitics',
		weight: 4,
		predictiveIndicators: ['enrichment', 'strike', 'retaliation', 'tensions']
	},
	{
		id: 'north-korea',
		patterns: [/north korea/i, /kim jong/i, /pyongyang/i, /dprk/i, /icbm.*korea/i, /nuclear.*korea/i, /korean peninsula/i],
		category: 'Geopolitics',
		weight: 3,
		predictiveIndicators: ['missile', 'test', 'provocation', 'sanctions']
	},
	{
		id: 'nuclear',
		patterns: [/nuclear.*threat/i, /nuclear weapon/i, /atomic/i, /icbm/i, /nuclear war/i, /nuclear deterrent/i, /nuclear posture/i],
		category: 'Security',
		weight: 5,
		predictiveIndicators: ['threat', 'warning', 'alert', 'deployment']
	},
	// Politics
	{
		id: 'election',
		patterns: [/election/i, /polling/i, /campaign/i, /ballot/i, /voter/i, /swing state/i, /electoral/i, /primary/i, /caucus/i],
		category: 'Politics',
		weight: 3,
		predictiveIndicators: ['projected', 'forecast', 'leads', 'outcome']
	},
	{
		id: 'immigration',
		patterns: [/immigration/i, /border.*crisis/i, /migrant/i, /deportation/i, /asylum/i, /sanctuary/i, /undocumented/i, /visa/i],
		category: 'Politics',
		weight: 2,
		predictiveIndicators: ['surge', 'crackdown', 'policy', 'reform']
	},
	{
		id: 'impeachment',
		patterns: [/impeach/i, /articles of impeachment/i, /congressional investigation/i, /high crimes/i],
		category: 'Politics',
		weight: 4,
		predictiveIndicators: ['vote', 'inquiry', 'charges', 'trial']
	},
	// Health & Environment
	{
		id: 'pandemic',
		patterns: [/pandemic/i, /outbreak/i, /virus.*spread/i, /who.*emergency/i, /bird flu/i, /h5n1/i, /epidemic/i, /novel virus/i, /pathogen/i],
		category: 'Health',
		weight: 4,
		predictiveIndicators: ['outbreak', 'spreading', 'cases', 'emergency']
	},
	{
		id: 'climate',
		patterns: [/climate change/i, /wildfire/i, /hurricane/i, /extreme weather/i, /flood/i, /heat wave/i, /drought/i, /climate emergency/i, /carbon emission/i],
		category: 'Environment',
		weight: 2,
		predictiveIndicators: ['warning', 'record', 'catastrophic', 'unprecedented']
	},
	// Additional High-Impact Topics
	{
		id: 'oil-energy',
		patterns: [/oil price/i, /opec/i, /crude oil/i, /energy crisis/i, /natural gas/i, /lng\b/i, /petroleum/i, /oil supply/i],
		category: 'Economy',
		weight: 3,
		predictiveIndicators: ['surge', 'cut', 'production', 'demand']
	},
	{
		id: 'gold-commodities',
		patterns: [/gold price/i, /precious metal/i, /gold rally/i, /safe haven/i, /commodity.*surge/i, /silver price/i],
		category: 'Finance',
		weight: 2,
		predictiveIndicators: ['rally', 'flight to', 'record', 'demand']
	},
	{
		id: 'military-deployment',
		patterns: [/troop.*deploy/i, /military.*deploy/i, /naval.*fleet/i, /carrier group/i, /military buildup/i, /defense.*alert/i],
		category: 'Security',
		weight: 4,
		predictiveIndicators: ['mobilization', 'deployment', 'positioned', 'alert']
	},
	{
		id: 'sanctions',
		patterns: [/sanction/i, /economic.*restriction/i, /asset freeze/i, /trade.*restriction/i, /embargo/i, /export control/i],
		category: 'Geopolitics',
		weight: 3,
		predictiveIndicators: ['imposed', 'expanded', 'lifted', 'violated']
	}
];

// Narrative patterns - expanded with amplification phrases and debunk indicators
export const NARRATIVE_PATTERNS: NarrativePattern[] = [
	// Political Narratives
	{
		id: 'deep-state',
		keywords: ['deep state', 'shadow government', 'permanent state', 'bureaucracy corruption', 'unelected officials', 'administrative state', 'entrenched bureaucrats'],
		category: 'Political',
		severity: 'watch',
		amplificationPhrases: ['exposed', 'revealed', 'uncovered', 'proof'],
		debunkIndicators: ['conspiracy theory', 'debunked', 'false claim', 'no evidence']
	},
	{
		id: 'wef-agenda',
		keywords: ['great reset', 'world economic forum', 'davos', 'stakeholder capitalism', 'global governance', 'you will own nothing', 'agenda 2030'],
		category: 'Political',
		severity: 'watch',
		amplificationPhrases: ['plan', 'agenda', 'secret', 'revealed'],
		debunkIndicators: ['misrepresented', 'out of context', 'conspiracy']
	},
	{
		id: 'election-integrity',
		keywords: ['election fraud', 'rigged election', 'stolen election', 'voter fraud', 'election interference', 'voting machine', 'ballot harvesting', 'mail-in fraud', 'dead voters'],
		category: 'Political',
		severity: 'watch',
		amplificationPhrases: ['evidence', 'proof', 'whistleblower', 'exposed'],
		debunkIndicators: ['debunked', 'no evidence', 'baseless', 'false claims', 'fact check']
	},
	{
		id: 'government-overreach',
		keywords: ['tyranny', 'authoritarian', 'government control', 'police state', 'martial law', 'civil liberties', 'constitutional violation'],
		category: 'Political',
		severity: 'watch',
		amplificationPhrases: ['unprecedented', 'alarming', 'dangerous'],
		debunkIndicators: ['exaggerated', 'misleading', 'context']
	},
	// Finance & Economy Narratives
	{
		id: 'cbdc-control',
		keywords: ['cbdc', 'central bank digital', 'digital dollar', 'digital euro', 'digital yuan', 'programmable money', 'social credit', 'financial surveillance'],
		category: 'Finance',
		severity: 'watch',
		amplificationPhrases: ['control', 'track', 'surveillance', 'restrict'],
		debunkIndicators: ['privacy features', 'voluntary', 'misconception']
	},
	{
		id: 'dollar-decline',
		keywords: ['dollar collapse', 'dedollarization', 'brics currency', 'petrodollar', 'dollar reserve', 'us debt', 'dollar hegemony', 'yuan replacing'],
		category: 'Finance',
		severity: 'spreading',
		amplificationPhrases: ['imminent', 'accelerating', 'inevitable', 'historic shift'],
		debunkIndicators: ['overstated', 'unlikely', 'still dominant', 'premature']
	},
	{
		id: 'bank-instability',
		keywords: ['bank failure', 'bank run', 'banking crisis', 'bank collapse', 'financial crisis', 'credit crunch', 'systemic risk', 'contagion'],
		category: 'Finance',
		severity: 'watch',
		amplificationPhrases: ['spreading', 'next', 'imminent', 'panic'],
		debunkIndicators: ['contained', 'isolated', 'backstop', 'stable']
	},
	{
		id: 'inflation-spiral',
		keywords: ['hyperinflation', 'inflation spiral', 'currency debasement', 'money printing', 'fiat collapse', 'purchasing power'],
		category: 'Finance',
		severity: 'emerging',
		amplificationPhrases: ['soaring', 'out of control', 'crisis'],
		debunkIndicators: ['stabilizing', 'cooling', 'transitory', 'peaked']
	},
	// Health Narratives
	{
		id: 'bio-weapon',
		keywords: ['lab leak', 'bioweapon', 'gain of function', 'wuhan lab', 'virus origin', 'lab origin', 'engineered virus', 'bio-lab'],
		category: 'Health',
		severity: 'emerging',
		amplificationPhrases: ['evidence', 'investigation', 'covered up', 'leaked'],
		debunkIndicators: ['natural origin', 'no evidence', 'debunked', 'speculation']
	},
	{
		id: 'vaccine-concerns',
		keywords: ['vaccine injury', 'vaccine side effect', 'vaccine mandate', 'vaccine hesitancy', 'mrna concern', 'vaccine deaths', 'adverse event', 'vaers'],
		category: 'Health',
		severity: 'watch',
		amplificationPhrases: ['covered up', 'hidden', 'suppressed', 'exposed'],
		debunkIndicators: ['rare', 'safe', 'effective', 'misinformation', 'anti-vax']
	},
	{
		id: 'pandemic-threat',
		keywords: ['next pandemic', 'disease x', 'bird flu', 'h5n1', 'new virus', 'outbreak', 'epidemic', 'pandemic preparedness', 'novel pathogen'],
		category: 'Health',
		severity: 'emerging',
		amplificationPhrases: ['warning', 'experts fear', 'preparing', 'imminent'],
		debunkIndicators: ['low risk', 'contained', 'monitoring', 'precautionary']
	},
	{
		id: 'health-freedom',
		keywords: ['medical freedom', 'health freedom', 'bodily autonomy', 'informed consent', 'medical tyranny', 'forced treatment'],
		category: 'Health',
		severity: 'watch',
		amplificationPhrases: ['rights', 'freedom', 'choice'],
		debunkIndicators: ['public health', 'community protection', 'science-based']
	},
	// Tech & AI Narratives
	{
		id: 'ai-risk',
		keywords: ['ai risk', 'ai danger', 'ai threat', 'ai doom', 'ai extinction', 'superintelligence', 'agi', 'existential risk', 'ai takeover', 'ai apocalypse'],
		category: 'Tech',
		severity: 'emerging',
		amplificationPhrases: ['warning', 'experts fear', 'imminent', 'unstoppable'],
		debunkIndicators: ['overhyped', 'far off', 'speculation', 'science fiction']
	},
	{
		id: 'ai-consciousness',
		keywords: ['ai sentient', 'ai conscious', 'ai feelings', 'ai alive', 'machine consciousness', 'ai soul', 'ai awareness'],
		category: 'Tech',
		severity: 'emerging',
		amplificationPhrases: ['breakthrough', 'achieved', 'evidence'],
		debunkIndicators: ['simulation', 'illusion', 'not conscious', 'mimicking']
	},
	{
		id: 'job-automation',
		keywords: ['robots replacing', 'automation', 'job loss ai', 'ai replacing', 'workers displaced', 'unemployment ai', 'jobless future', 'ai layoffs'],
		category: 'Economy',
		severity: 'spreading',
		amplificationPhrases: ['wave', 'mass', 'millions', 'inevitable'],
		debunkIndicators: ['new jobs', 'augment', 'assist', 'overstated']
	},
	{
		id: 'surveillance',
		keywords: ['surveillance', 'privacy', 'spying', 'mass surveillance', 'data collection', 'tracking', 'facial recognition', 'social credit'],
		category: 'Society',
		severity: 'watch',
		amplificationPhrases: ['orwellian', 'big brother', 'dystopian', 'totalitarian'],
		debunkIndicators: ['security', 'safety', 'opt-out', 'regulations']
	},
	// Geopolitical Narratives
	{
		id: 'china-threat',
		keywords: ['china threat', 'taiwan invasion', 'china war', 'south china sea', 'chinese military', 'china aggression', 'chinese spy', 'ccp threat', 'chinese infiltration'],
		category: 'Geopolitical',
		severity: 'watch',
		amplificationPhrases: ['imminent', 'preparing', 'buildup', 'warning'],
		debunkIndicators: ['diplomacy', 'deterrence', 'overstated', 'rhetoric']
	},
	{
		id: 'nato-russia',
		keywords: ['nato expansion', 'nato provocation', 'russia nato', 'nato aggression', 'nuclear threat', 'world war', 'russian aggression', 'nato article 5'],
		category: 'Geopolitical',
		severity: 'watch',
		amplificationPhrases: ['escalation', 'brink', 'threat', 'provocation'],
		debunkIndicators: ['defensive', 'deterrence', 'rhetoric', 'unlikely']
	},
	{
		id: 'world-war',
		keywords: ['world war 3', 'ww3', 'global conflict', 'great power war', 'nuclear war', 'world war iii'],
		category: 'Geopolitical',
		severity: 'watch',
		amplificationPhrases: ['imminent', 'inevitable', 'brink', 'escalating'],
		debunkIndicators: ['unlikely', 'deterrence', 'diplomacy', 'hyperbole']
	},
	// Society & Environment Narratives
	{
		id: 'population-crisis',
		keywords: ['fertility crisis', 'birth rate', 'population decline', 'demographic crisis', 'aging population', 'population collapse', 'depopulation'],
		category: 'Society',
		severity: 'watch',
		amplificationPhrases: ['crisis', 'collapse', 'unsustainable', 'alarming'],
		debunkIndicators: ['stabilizing', 'adaptation', 'immigration', 'technology']
	},
	{
		id: 'food-security',
		keywords: ['food shortage', 'food crisis', 'famine', 'food supply', 'crop failure', 'food price', 'hunger', 'food insecurity', 'fertilizer shortage'],
		category: 'Economy',
		severity: 'emerging',
		amplificationPhrases: ['imminent', 'millions', 'crisis', 'catastrophic'],
		debunkIndicators: ['localized', 'recovery', 'aid', 'improving']
	},
	{
		id: 'energy-crisis',
		keywords: ['energy crisis', 'power grid', 'blackout', 'energy shortage', 'fuel shortage', 'oil crisis', 'gas crisis', 'grid collapse', 'energy emergency'],
		category: 'Economy',
		severity: 'spreading',
		amplificationPhrases: ['collapse', 'emergency', 'crisis', 'shortage'],
		debunkIndicators: ['reserves', 'stable', 'manageable', 'temporary']
	},
	{
		id: 'climate-alarmism',
		keywords: ['climate emergency', 'climate crisis', 'climate catastrophe', 'extinction', 'climate doom', 'uninhabitable', 'point of no return'],
		category: 'Environment',
		severity: 'spreading',
		amplificationPhrases: ['tipping point', 'irreversible', 'extinction', 'catastrophic'],
		debunkIndicators: ['adaptation', 'progress', 'technology', 'overstated']
	},
	{
		id: 'misinformation',
		keywords: ['misinformation', 'disinformation', 'fake news', 'propaganda', 'fact check', 'censorship', 'information war', 'psyop'],
		category: 'Society',
		severity: 'spreading',
		amplificationPhrases: ['spreading', 'viral', 'dangerous', 'coordinated'],
		debunkIndicators: ['verified', 'confirmed', 'accurate', 'context']
	},
	// Security Narratives
	{
		id: 'cyber-threat',
		keywords: ['cyber attack', 'hacking', 'ransomware', 'data breach', 'cyber warfare', 'critical infrastructure', 'cyber war', 'nation state hack'],
		category: 'Security',
		severity: 'emerging',
		amplificationPhrases: ['sophisticated', 'unprecedented', 'massive', 'critical'],
		debunkIndicators: ['contained', 'patched', 'isolated', 'prevented']
	},
	{
		id: 'emp-grid',
		keywords: ['emp attack', 'grid attack', 'infrastructure attack', 'power grid attack', 'electromagnetic pulse', 'grid down'],
		category: 'Security',
		severity: 'watch',
		amplificationPhrases: ['vulnerable', 'imminent', 'catastrophic'],
		debunkIndicators: ['unlikely', 'protected', 'resilient', 'hardened']
	},
	{
		id: 'terrorism',
		keywords: ['terrorist attack', 'terror threat', 'extremism', 'radicalization', 'domestic terrorism', 'terror cell'],
		category: 'Security',
		severity: 'watch',
		amplificationPhrases: ['imminent', 'credible threat', 'elevated', 'warning'],
		debunkIndicators: ['thwarted', 'no credible', 'precautionary', 'monitoring']
	}
];

export const SOURCE_TYPES: SourceTypes = {
	fringe: [
		'zerohedge',
		'infowars',
		'naturalnews',
		'gateway pundit',
		'gatewaypundit',
		'breitbart',
		'epoch times',
		'epochtimes',
		'revolver',
		'dailycaller',
		'oann',
		'newsmax',
		'dailywire',
		'blaze',
		'federalist',
		'nationalfile'
	],
	alternative: [
		'substack',
		'rumble',
		'bitchute',
		'telegram',
		'gab',
		'gettr',
		'truth social',
		'locals',
		'odysee',
		'brighteon',
		'minds',
		'parler',
		'podcast',
		'newsletter'
	],
	mainstream: [
		'reuters',
		'associated press',
		'ap news',
		'apnews',
		'bbc',
		'cnn',
		'nytimes',
		'new york times',
		'nyt',
		'wsj',
		'wall street journal',
		'wapo',
		'washingtonpost',
		'washington post',
		'guardian',
		'theguardian',
		'abc news',
		'nbc news',
		'cbs news',
		'fox news',
		'npr',
		'pbs',
		'politico',
		'axios',
		'bloomberg',
		'cnbc',
		'forbes',
		'businessinsider',
		'business insider',
		'techcrunch',
		'theverge',
		'the verge',
		'wired',
		'arstechnica',
		'ars technica',
		'usa today',
		'time',
		'newsweek',
		'la times',
		'los angeles times',
		'chicago tribune',
		'atlantic',
		'new yorker',
		'economist',
		'financial times',
		'ft.com',
		'yahoo news',
		'huffpost',
		'huffington',
		'msnbc',
		'sky news',
		'afp',
		'france24',
		'dw.com',
		'al jazeera',
		'insider',
		'daily beast',
		'vox',
		'vice'
	],
	institutional: [
		'whitehouse',
		'white house',
		'state.gov',
		'defense.gov',
		'pentagon',
		'treasury.gov',
		'federalreserve',
		'federal reserve',
		'sec.gov',
		'fda.gov',
		'cdc.gov',
		'who.int',
		'un.org',
		'united nations',
		'nato',
		'imf',
		'worldbank',
		'world bank',
		'congress.gov',
		'senate.gov',
		'house.gov',
		'supremecourt',
		'justice.gov',
		'fbi.gov',
		'cia.gov',
		'nsa.gov',
		'dni.gov',
		'state department',
		'doj',
		'dhs',
		'government',
		'gov.uk',
		'.gov'
	],
	aggregator: [
		'google news',
		'news.google',
		'apple news',
		'flipboard',
		'feedly',
		'smartnews',
		'news360',
		'inoreader',
		'reddit',
		'twitter',
		'x.com',
		'facebook',
		'linkedin',
		'drudge',
		'memeorandum',
		'realclear',
		'alltop',
		'newsnow',
		'newsbreak',
		'ground news'
	]
};

// Main character patterns for tracking prominent figures
export interface PersonPattern {
	pattern: RegExp;
	name: string;
	aliases?: string[]; // Alternative names/nicknames
	role: PersonRole;
	titles?: string[]; // Official titles (President, CEO, etc.)
}

// Sentiment indicators for analyzing tone around person mentions
export const SENTIMENT_INDICATORS: SentimentIndicator = {
	positive: [
		'praised', 'celebrated', 'hailed', 'lauded', 'applauded', 'commended', 'honored',
		'triumphant', 'victory', 'success', 'achievement', 'breakthrough', 'hero', 'wins',
		'praised by', 'supported by', 'backed by', 'endorsed', 'popular', 'approval',
		'brilliant', 'visionary', 'innovative', 'transformative', 'historic achievement'
	],
	negative: [
		'criticized', 'condemned', 'slammed', 'blasted', 'attacked', 'accused', 'denounced',
		'scandal', 'controversy', 'investigation', 'probe', 'indicted', 'charged', 'sued',
		'failure', 'disaster', 'crisis', 'backlash', 'outrage', 'fury', 'anger',
		'blamed', 'responsibility for', 'under fire', 'facing', 'troubled', 'embattled',
		'corrupt', 'incompetent', 'disgraced', 'impeach', 'resign', 'fired'
	],
	neutral: [
		'said', 'announced', 'stated', 'reported', 'according to', 'met with', 'visited',
		'scheduled', 'plans to', 'expected to', 'will', 'speaks', 'addresses', 'meets'
	]
};

export const PERSON_PATTERNS: PersonPattern[] = [
	// US Political Figures
	{
		pattern: /\b(?:donald\s+)?trump\b|\bdjt\b|\b45(?:th)?\s*(?:president)?\b|\bpotus\s*45\b/gi,
		name: 'Donald Trump',
		aliases: ['Trump', 'DJT', 'Donald Trump', 'President Trump', 'Former President Trump'],
		role: 'political',
		titles: ['President', 'Former President']
	},
	{
		pattern: /\b(?:joe\s+)?biden\b|\bjrb\b|\b46(?:th)?\s*(?:president)?\b|\bpotus\s*46\b/gi,
		name: 'Joe Biden',
		aliases: ['Biden', 'JRB', 'Joseph Biden', 'President Biden'],
		role: 'political',
		titles: ['President']
	},
	{
		pattern: /\b(?:kamala\s+)?harris\b|\bvp\s*harris\b|\bvice\s*president\s*harris\b/gi,
		name: 'Kamala Harris',
		aliases: ['Harris', 'VP Harris', 'Vice President Harris'],
		role: 'political',
		titles: ['Vice President']
	},
	{
		pattern: /\b(?:nancy\s+)?pelosi\b|\bspeaker\s*pelosi\b/gi,
		name: 'Nancy Pelosi',
		aliases: ['Pelosi', 'Speaker Pelosi'],
		role: 'political',
		titles: ['Speaker', 'Former Speaker']
	},
	{
		pattern: /\b(?:mitch\s+)?mcconnell\b|\bsenator\s*mcconnell\b/gi,
		name: 'Mitch McConnell',
		aliases: ['McConnell', 'Senator McConnell'],
		role: 'political',
		titles: ['Senator', 'Senate Minority Leader']
	},
	{
		pattern: /\b(?:mike\s+)?johnson\b(?=\s*(?:speaker|house|gop|republican))/gi,
		name: 'Mike Johnson',
		aliases: ['Speaker Johnson'],
		role: 'political',
		titles: ['Speaker']
	},
	{
		pattern: /\b(?:ron\s+)?desantis\b|\bgov(?:ernor)?\s*desantis\b/gi,
		name: 'Ron DeSantis',
		aliases: ['DeSantis', 'Governor DeSantis'],
		role: 'political',
		titles: ['Governor']
	},
	{
		pattern: /\b(?:gavin\s+)?newsom\b|\bgov(?:ernor)?\s*newsom\b/gi,
		name: 'Gavin Newsom',
		aliases: ['Newsom', 'Governor Newsom'],
		role: 'political',
		titles: ['Governor']
	},
	{
		pattern: /\baoc\b|\b(?:alexandria\s+)?ocasio[\s-]*cortez\b/gi,
		name: 'Alexandria Ocasio-Cortez',
		aliases: ['AOC', 'Ocasio-Cortez'],
		role: 'political',
		titles: ['Representative', 'Congresswoman']
	},
	{
		pattern: /\b(?:bernie\s+)?sanders\b|\bsenator\s*sanders\b/gi,
		name: 'Bernie Sanders',
		aliases: ['Sanders', 'Senator Sanders'],
		role: 'political',
		titles: ['Senator']
	},
	{
		pattern: /\b(?:ted\s+)?cruz\b|\bsenator\s*cruz\b/gi,
		name: 'Ted Cruz',
		aliases: ['Cruz', 'Senator Cruz'],
		role: 'political',
		titles: ['Senator']
	},
	{
		pattern: /\b(?:marco\s+)?rubio\b|\bsenator\s*rubio\b/gi,
		name: 'Marco Rubio',
		aliases: ['Rubio', 'Senator Rubio'],
		role: 'political',
		titles: ['Senator']
	},
	{
		pattern: /\b(?:nikki\s+)?haley\b|\bambassador\s*haley\b/gi,
		name: 'Nikki Haley',
		aliases: ['Haley', 'Ambassador Haley'],
		role: 'political',
		titles: ['Ambassador', 'Former Governor']
	},
	{
		pattern: /\b(?:vivek\s+)?ramaswamy\b/gi,
		name: 'Vivek Ramaswamy',
		aliases: ['Ramaswamy'],
		role: 'political',
		titles: []
	},
	{
		pattern: /\b(?:jd\s+)?vance\b|\bsenator\s*vance\b/gi,
		name: 'JD Vance',
		aliases: ['Vance', 'Senator Vance'],
		role: 'political',
		titles: ['Senator']
	},
	// US Government/Finance Officials
	{
		pattern: /\b(?:janet\s+)?yellen\b|\btreasury\s*(?:sec(?:retary)?)?\s*yellen\b/gi,
		name: 'Janet Yellen',
		aliases: ['Yellen', 'Secretary Yellen', 'Treasury Secretary Yellen'],
		role: 'finance',
		titles: ['Treasury Secretary']
	},
	{
		pattern: /\b(?:jerome\s+)?powell\b|\bfed\s*(?:chair(?:man)?)?\s*powell\b/gi,
		name: 'Jerome Powell',
		aliases: ['Powell', 'Fed Chair Powell', 'Chairman Powell'],
		role: 'finance',
		titles: ['Fed Chair', 'Federal Reserve Chairman']
	},
	{
		pattern: /\b(?:gary\s+)?gensler\b|\bsec\s*(?:chair(?:man)?)?\s*gensler\b/gi,
		name: 'Gary Gensler',
		aliases: ['Gensler', 'SEC Chair Gensler'],
		role: 'finance',
		titles: ['SEC Chair']
	},
	{
		pattern: /\b(?:antony|tony)\s+blinken\b|\bsec(?:retary)?\s*(?:of\s*)?state\s*blinken\b/gi,
		name: 'Antony Blinken',
		aliases: ['Blinken', 'Secretary Blinken'],
		role: 'political',
		titles: ['Secretary of State']
	},
	{
		pattern: /\b(?:lloyd\s+)?austin\b|\bdefense\s*sec(?:retary)?\s*austin\b|\bsecdef\s*austin\b/gi,
		name: 'Lloyd Austin',
		aliases: ['Austin', 'Secretary Austin', 'SecDef Austin'],
		role: 'military',
		titles: ['Secretary of Defense', 'Defense Secretary']
	},
	{
		pattern: /\b(?:merrick\s+)?garland\b|\battorney\s*general\s*garland\b|\bag\s*garland\b/gi,
		name: 'Merrick Garland',
		aliases: ['Garland', 'AG Garland', 'Attorney General Garland'],
		role: 'political',
		titles: ['Attorney General']
	},
	// World Leaders
	{
		pattern: /\b(?:vladimir\s+)?putin\b|\brussian?\s*president\b|\bkremlin\s*(?:leader)?\b/gi,
		name: 'Vladimir Putin',
		aliases: ['Putin', 'President Putin', 'Russian President'],
		role: 'political',
		titles: ['President']
	},
	{
		pattern: /\b(?:volodymyr\s+)?zelensky\b|\bzelenskyy\b|\bukrainian?\s*president\b/gi,
		name: 'Volodymyr Zelensky',
		aliases: ['Zelensky', 'Zelenskyy', 'President Zelensky', 'Ukrainian President'],
		role: 'political',
		titles: ['President']
	},
	{
		pattern: /\bxi\s*jinping\b|\bpresident\s*xi\b|\bchinese\s*president\b|\bccp\s*leader\b/gi,
		name: 'Xi Jinping',
		aliases: ['Xi', 'President Xi', 'Chinese President'],
		role: 'political',
		titles: ['President', 'General Secretary']
	},
	{
		pattern: /\b(?:benjamin\s+)?netanyahu\b|\bbibi\b|\bisraeli?\s*(?:pm|prime\s*minister)\b/gi,
		name: 'Benjamin Netanyahu',
		aliases: ['Netanyahu', 'Bibi', 'PM Netanyahu', 'Israeli PM'],
		role: 'political',
		titles: ['Prime Minister']
	},
	{
		pattern: /\bkim\s*jong[\s-]*un\b|\bnorth\s*korean?\s*(?:leader|dictator)\b|\bdprk\s*leader\b/gi,
		name: 'Kim Jong Un',
		aliases: ['Kim', 'Kim Jong Un', 'North Korean Leader'],
		role: 'political',
		titles: ['Supreme Leader']
	},
	{
		pattern: /\b(?:recep\s*tayyip\s+)?erdogan\b|\bturkish?\s*president\b/gi,
		name: 'Recep Tayyip Erdogan',
		aliases: ['Erdogan', 'President Erdogan', 'Turkish President'],
		role: 'political',
		titles: ['President']
	},
	{
		pattern: /\b(?:narendra\s+)?modi\b|\bindian?\s*(?:pm|prime\s*minister)\b/gi,
		name: 'Narendra Modi',
		aliases: ['Modi', 'PM Modi', 'Indian PM'],
		role: 'political',
		titles: ['Prime Minister']
	},
	{
		pattern: /\b(?:keir\s+)?starmer\b|\buk\s*(?:pm|prime\s*minister)\b|\bbritish?\s*(?:pm|prime\s*minister)\b/gi,
		name: 'Keir Starmer',
		aliases: ['Starmer', 'PM Starmer', 'UK PM'],
		role: 'political',
		titles: ['Prime Minister']
	},
	{
		pattern: /\b(?:emmanuel\s+)?macron\b|\bfrench\s*president\b/gi,
		name: 'Emmanuel Macron',
		aliases: ['Macron', 'President Macron', 'French President'],
		role: 'political',
		titles: ['President']
	},
	{
		pattern: /\b(?:olaf\s+)?scholz\b|\bgerman\s*chancellor\b/gi,
		name: 'Olaf Scholz',
		aliases: ['Scholz', 'Chancellor Scholz', 'German Chancellor'],
		role: 'political',
		titles: ['Chancellor']
	},
	{
		pattern: /\b(?:mohammed\s+bin\s+salman|mbs)\b|\bsaudi\s*(?:crown\s*)?prince\b/gi,
		name: 'Mohammed bin Salman',
		aliases: ['MBS', 'Crown Prince', 'Saudi Crown Prince'],
		role: 'political',
		titles: ['Crown Prince']
	},
	{
		pattern: /\b(?:ali\s+)?khamenei\b|\bsupreme\s*leader\b|\biranian?\s*(?:supreme\s*)?leader\b/gi,
		name: 'Ali Khamenei',
		aliases: ['Khamenei', 'Supreme Leader', 'Iranian Leader'],
		role: 'political',
		titles: ['Supreme Leader']
	},
	{
		pattern: /\b(?:justin\s+)?trudeau\b|\bcanadian?\s*(?:pm|prime\s*minister)\b/gi,
		name: 'Justin Trudeau',
		aliases: ['Trudeau', 'PM Trudeau', 'Canadian PM'],
		role: 'political',
		titles: ['Prime Minister']
	},
	// Tech Leaders
	{
		pattern: /\b(?:elon\s+)?musk\b|\btesla\s*ceo\b|\bspacex\s*(?:ceo|founder)\b/gi,
		name: 'Elon Musk',
		aliases: ['Musk', 'Elon', 'Tesla CEO', 'SpaceX CEO'],
		role: 'tech',
		titles: ['CEO', 'Founder']
	},
	{
		pattern: /\b(?:sam\s+)?altman\b|\bopenai\s*ceo\b/gi,
		name: 'Sam Altman',
		aliases: ['Altman', 'OpenAI CEO'],
		role: 'tech',
		titles: ['CEO']
	},
	{
		pattern: /\b(?:mark\s+)?zuckerberg\b|\bzuck\b|\bmeta\s*ceo\b|\bfacebook\s*(?:ceo|founder)\b/gi,
		name: 'Mark Zuckerberg',
		aliases: ['Zuckerberg', 'Zuck', 'Meta CEO', 'Facebook CEO'],
		role: 'tech',
		titles: ['CEO', 'Founder']
	},
	{
		pattern: /\b(?:jeff\s+)?bezos\b|\bamazon\s*(?:ceo|founder)\b/gi,
		name: 'Jeff Bezos',
		aliases: ['Bezos', 'Amazon Founder'],
		role: 'tech',
		titles: ['Founder', 'Executive Chairman']
	},
	{
		pattern: /\b(?:tim\s+)?cook\b|\bapple\s*ceo\b/gi,
		name: 'Tim Cook',
		aliases: ['Tim Cook', 'Apple CEO'],
		role: 'tech',
		titles: ['CEO']
	},
	{
		pattern: /\b(?:satya\s+)?nadella\b|\bmicrosoft\s*ceo\b/gi,
		name: 'Satya Nadella',
		aliases: ['Nadella', 'Microsoft CEO'],
		role: 'tech',
		titles: ['CEO']
	},
	{
		pattern: /\b(?:sundar\s+)?pichai\b|\bgoogle\s*ceo\b|\balphabet\s*ceo\b/gi,
		name: 'Sundar Pichai',
		aliases: ['Pichai', 'Google CEO', 'Alphabet CEO'],
		role: 'tech',
		titles: ['CEO']
	},
	{
		pattern: /\b(?:jensen\s+)?huang\b|\bnvidia\s*ceo\b/gi,
		name: 'Jensen Huang',
		aliases: ['Huang', 'NVIDIA CEO'],
		role: 'tech',
		titles: ['CEO', 'Founder']
	},
	{
		pattern: /\b(?:dario\s+)?amodei\b|\banthropic\s*ceo\b/gi,
		name: 'Dario Amodei',
		aliases: ['Amodei', 'Anthropic CEO'],
		role: 'tech',
		titles: ['CEO', 'Co-founder']
	},
	{
		pattern: /\b(?:demis\s+)?hassabis\b|\bdeepmi?nd\s*(?:ceo|founder)\b/gi,
		name: 'Demis Hassabis',
		aliases: ['Hassabis', 'DeepMind CEO'],
		role: 'tech',
		titles: ['CEO', 'Co-founder']
	},
	{
		pattern: /\b(?:andy\s+)?jassy\b|\bamazon\s*ceo\b/gi,
		name: 'Andy Jassy',
		aliases: ['Jassy', 'Amazon CEO'],
		role: 'tech',
		titles: ['CEO']
	},
	{
		pattern: /\b(?:lisa\s+)?su\b|\bamd\s*ceo\b/gi,
		name: 'Lisa Su',
		aliases: ['Su', 'AMD CEO'],
		role: 'tech',
		titles: ['CEO']
	},
	{
		pattern: /\b(?:pat\s+)?gelsinger\b|\bintel\s*ceo\b/gi,
		name: 'Pat Gelsinger',
		aliases: ['Gelsinger', 'Intel CEO'],
		role: 'tech',
		titles: ['CEO']
	},
	{
		pattern: /\b(?:arvind\s+)?krishna\b|\bibm\s*ceo\b/gi,
		name: 'Arvind Krishna',
		aliases: ['Krishna', 'IBM CEO'],
		role: 'tech',
		titles: ['CEO']
	},
	// Finance/Business Leaders
	{
		pattern: /\b(?:warren\s+)?buffett\b|\bberkshire\s*(?:hathaway)?\s*(?:ceo|chairman)\b|\boracle\s*of\s*omaha\b/gi,
		name: 'Warren Buffett',
		aliases: ['Buffett', 'Oracle of Omaha', 'Berkshire CEO'],
		role: 'finance',
		titles: ['CEO', 'Chairman']
	},
	{
		pattern: /\b(?:jamie\s+)?dimon\b|\bjpmorgan\s*ceo\b|\bjp\s*morgan\s*(?:chase\s*)?ceo\b/gi,
		name: 'Jamie Dimon',
		aliases: ['Dimon', 'JPMorgan CEO'],
		role: 'finance',
		titles: ['CEO', 'Chairman']
	},
	{
		pattern: /\b(?:larry\s+)?fink\b|\bblackrock\s*ceo\b/gi,
		name: 'Larry Fink',
		aliases: ['Fink', 'BlackRock CEO'],
		role: 'finance',
		titles: ['CEO', 'Chairman']
	},
	{
		pattern: /\b(?:brian\s+)?moynihan\b|\bbank\s*of\s*america\s*ceo\b|\bbofa\s*ceo\b/gi,
		name: 'Brian Moynihan',
		aliases: ['Moynihan', 'BofA CEO', 'Bank of America CEO'],
		role: 'finance',
		titles: ['CEO']
	},
	{
		pattern: /\b(?:david\s+)?solomon\b|\bgoldman\s*(?:sachs\s*)?ceo\b/gi,
		name: 'David Solomon',
		aliases: ['Solomon', 'Goldman CEO', 'Goldman Sachs CEO'],
		role: 'finance',
		titles: ['CEO']
	},
	{
		pattern: /\b(?:jane\s+)?fraser\b|\bcitigroup\s*ceo\b|\bciti\s*ceo\b/gi,
		name: 'Jane Fraser',
		aliases: ['Fraser', 'Citi CEO', 'Citigroup CEO'],
		role: 'finance',
		titles: ['CEO']
	},
	{
		pattern: /\b(?:ray\s+)?dalio\b|\bbridgewater\s*(?:founder)?\b/gi,
		name: 'Ray Dalio',
		aliases: ['Dalio', 'Bridgewater Founder'],
		role: 'finance',
		titles: ['Founder', 'Co-CIO']
	},
	{
		pattern: /\b(?:cathie\s+)?wood\b|\bark\s*invest\b|\bark\s*ceo\b/gi,
		name: 'Cathie Wood',
		aliases: ['Wood', 'Cathie Wood', 'ARK CEO'],
		role: 'finance',
		titles: ['CEO', 'CIO']
	},
	{
		pattern: /\b(?:michael\s+)?saylor\b|\bmicrostrategy\b/gi,
		name: 'Michael Saylor',
		aliases: ['Saylor', 'MicroStrategy'],
		role: 'finance',
		titles: ['Executive Chairman']
	},
	// Media/Cultural Figures
	{
		pattern: /\b(?:tucker\s+)?carlson\b/gi,
		name: 'Tucker Carlson',
		aliases: ['Carlson', 'Tucker'],
		role: 'media',
		titles: ['Host']
	},
	{
		pattern: /\b(?:joe\s+)?rogan\b|\bjre\b/gi,
		name: 'Joe Rogan',
		aliases: ['Rogan', 'JRE'],
		role: 'media',
		titles: ['Host', 'Podcaster']
	},
	{
		pattern: /\b(?:jordan\s+)?peterson\b|\bdr\.?\s*peterson\b/gi,
		name: 'Jordan Peterson',
		aliases: ['Peterson', 'Dr. Peterson'],
		role: 'media',
		titles: ['Dr.', 'Professor']
	},
	{
		pattern: /\b(?:ben\s+)?shapiro\b|\bdaily\s*wire\b/gi,
		name: 'Ben Shapiro',
		aliases: ['Shapiro'],
		role: 'media',
		titles: ['Host', 'Editor']
	},
	// ============================================
	// Additional World Leaders (from WORLD_LEADERS)
	// ============================================
	{
		pattern: /\b(?:giorgia\s+)?meloni\b|\bitalian?\s*(?:pm|prime\s*minister)\b|\bitaly\s*prime\s*minister\b/gi,
		name: 'Giorgia Meloni',
		aliases: ['Meloni', 'Italian PM', 'Italy Prime Minister'],
		role: 'political',
		titles: ['Prime Minister']
	},
	{
		pattern: /\b(?:javier\s+)?milei\b|\bargentin(?:a|e)\s*president\b/gi,
		name: 'Javier Milei',
		aliases: ['Milei', 'Argentina President'],
		role: 'political',
		titles: ['President']
	},
	{
		pattern: /\blula\b|\bluiz\s*in[aá]cio\s*lula\b|\bbrazil(?:ian)?\s*president\b/gi,
		name: 'Luiz Inacio Lula da Silva',
		aliases: ['Lula', 'Brazil President', 'Brazilian President'],
		role: 'political',
		titles: ['President']
	},
	{
		pattern: /\b(?:mark\s+)?carney\b|\bcanadian?\s*(?:pm|prime\s*minister)\b(?!.*trudeau)/gi,
		name: 'Mark Carney',
		aliases: ['Carney', 'Canadian PM', 'Canada Prime Minister'],
		role: 'political',
		titles: ['Prime Minister']
	},
	{
		pattern: /\b(?:shigeru\s+)?ishiba\b|\bjapan(?:ese)?\s*(?:pm|prime\s*minister)\b/gi,
		name: 'Shigeru Ishiba',
		aliases: ['Ishiba', 'Japanese PM', 'Japan Prime Minister'],
		role: 'political',
		titles: ['Prime Minister']
	},
	{
		pattern: /\blai\s*ching[\s-]*te\b|\btaiwan(?:ese)?\s*president\b/gi,
		name: 'Lai Ching-te',
		aliases: ['Lai', 'Taiwan President', 'Taiwanese President'],
		role: 'political',
		titles: ['President']
	},
	// ============================================
	// US Cabinet Members (Trump Administration 2025)
	// ============================================
	{
		pattern: /\b(?:marco\s+)?rubio\b(?=\s*(?:secretary|state|foreign))|(?:secretary\s*(?:of\s*)?state\s*rubio)\b/gi,
		name: 'Marco Rubio',
		aliases: ['Rubio', 'Secretary Rubio', 'Secretary of State Rubio'],
		role: 'political',
		titles: ['Secretary of State', 'Senator']
	},
	{
		pattern: /\b(?:pete\s+)?hegseth\b|\bdefense\s*sec(?:retary)?\s*hegseth\b|\bsecdef\s*hegseth\b/gi,
		name: 'Pete Hegseth',
		aliases: ['Hegseth', 'Secretary Hegseth', 'SecDef Hegseth'],
		role: 'military',
		titles: ['Secretary of Defense', 'Defense Secretary']
	},
	{
		pattern: /\b(?:scott\s+)?bessent\b|\btreasury\s*sec(?:retary)?\s*bessent\b/gi,
		name: 'Scott Bessent',
		aliases: ['Bessent', 'Secretary Bessent', 'Treasury Secretary Bessent'],
		role: 'finance',
		titles: ['Treasury Secretary']
	},
	{
		pattern: /\b(?:pam\s+)?bondi\b|\battorney\s*general\s*bondi\b|\bag\s*bondi\b/gi,
		name: 'Pam Bondi',
		aliases: ['Bondi', 'AG Bondi', 'Attorney General Bondi'],
		role: 'political',
		titles: ['Attorney General']
	},
	{
		pattern: /\b(?:kristi\s+)?noem\b|\bdhs\s*sec(?:retary)?\s*noem\b|\bhomeland\s*security\s*noem\b/gi,
		name: 'Kristi Noem',
		aliases: ['Noem', 'Secretary Noem', 'DHS Secretary Noem'],
		role: 'political',
		titles: ['Secretary of Homeland Security']
	},
	{
		pattern: /\b(?:robert\s+f\.?\s+)?kennedy\s*jr\.?\b|\brfk\s*jr\.?\b|\bhhs\s*sec(?:retary)?\s*kennedy\b/gi,
		name: 'Robert F. Kennedy Jr.',
		aliases: ['RFK Jr', 'Kennedy Jr', 'Bobby Kennedy'],
		role: 'political',
		titles: ['Secretary of HHS']
	},
	{
		pattern: /\b(?:tulsi\s+)?gabbard\b|\bdni\s*gabbard\b|\bintelligence\s*director\s*gabbard\b/gi,
		name: 'Tulsi Gabbard',
		aliases: ['Gabbard', 'DNI Gabbard'],
		role: 'political',
		titles: ['Director of National Intelligence']
	},
	{
		pattern: /\b(?:john\s+)?ratcliffe\b|\bcia\s*director\s*ratcliffe\b/gi,
		name: 'John Ratcliffe',
		aliases: ['Ratcliffe', 'CIA Director Ratcliffe'],
		role: 'political',
		titles: ['CIA Director']
	},
	{
		pattern: /\b(?:kash\s+)?patel\b|\bfbi\s*director\s*patel\b/gi,
		name: 'Kash Patel',
		aliases: ['Patel', 'FBI Director Patel'],
		role: 'political',
		titles: ['FBI Director']
	},
	{
		pattern: /\b(?:doug\s+)?burgum\b|\binterior\s*sec(?:retary)?\s*burgum\b/gi,
		name: 'Doug Burgum',
		aliases: ['Burgum', 'Secretary Burgum'],
		role: 'political',
		titles: ['Secretary of the Interior']
	},
	{
		pattern: /\b(?:chris\s+)?wright\b|\benergy\s*sec(?:retary)?\s*wright\b/gi,
		name: 'Chris Wright',
		aliases: ['Wright', 'Energy Secretary Wright'],
		role: 'political',
		titles: ['Secretary of Energy']
	},
	{
		pattern: /\b(?:linda\s+)?mcmahon\b|\beducation\s*sec(?:retary)?\s*mcmahon\b/gi,
		name: 'Linda McMahon',
		aliases: ['McMahon', 'Education Secretary McMahon'],
		role: 'political',
		titles: ['Secretary of Education']
	},
	{
		pattern: /\b(?:howard\s+)?lutnick\b|\bcommerce\s*sec(?:retary)?\s*lutnick\b/gi,
		name: 'Howard Lutnick',
		aliases: ['Lutnick', 'Commerce Secretary Lutnick'],
		role: 'political',
		titles: ['Secretary of Commerce']
	},
	// ============================================
	// Central Bankers
	// ============================================
	{
		pattern: /\b(?:christine\s+)?lagarde\b|\becb\s*(?:president|chief)\b|\beuropean\s*central\s*bank\s*(?:president|head)\b/gi,
		name: 'Christine Lagarde',
		aliases: ['Lagarde', 'ECB President', 'ECB Chief'],
		role: 'central_bank',
		titles: ['ECB President', 'European Central Bank President']
	},
	{
		pattern: /\b(?:andrew\s+)?bailey\b|\bboe\s*(?:governor)\b|\bbank\s*of\s*england\s*governor\b/gi,
		name: 'Andrew Bailey',
		aliases: ['Bailey', 'BOE Governor', 'Bank of England Governor'],
		role: 'central_bank',
		titles: ['Governor', 'Bank of England Governor']
	},
	{
		pattern: /\b(?:kazuo\s+)?ueda\b|\bboj\s*(?:governor)\b|\bbank\s*of\s*japan\s*governor\b/gi,
		name: 'Kazuo Ueda',
		aliases: ['Ueda', 'BOJ Governor', 'Bank of Japan Governor'],
		role: 'central_bank',
		titles: ['Governor', 'Bank of Japan Governor']
	},
	{
		pattern: /\b(?:yi\s+)?gang\b|\bpboc\s*(?:governor)\b|\bpeople'?s?\s*bank\s*of\s*china\b/gi,
		name: 'Yi Gang',
		aliases: ['Yi Gang', 'PBOC Governor'],
		role: 'central_bank',
		titles: ['Governor', 'PBOC Governor']
	},
	{
		pattern: /\b(?:shaktikanta\s+)?das\b|\brbi\s*(?:governor)\b|\breserve\s*bank\s*of\s*india\b/gi,
		name: 'Shaktikanta Das',
		aliases: ['Das', 'RBI Governor'],
		role: 'central_bank',
		titles: ['Governor', 'RBI Governor']
	},
	{
		pattern: /\b(?:tiff\s+)?macklem\b|\bbank\s*of\s*canada\s*governor\b|\bboc\s*governor\b/gi,
		name: 'Tiff Macklem',
		aliases: ['Macklem', 'BOC Governor', 'Bank of Canada Governor'],
		role: 'central_bank',
		titles: ['Governor', 'Bank of Canada Governor']
	},
	// ============================================
	// International Organization Leaders
	// ============================================
	{
		pattern: /\b(?:ant[oó]nio\s+)?guterres\b|\bun\s*secretary[\s-]*general\b|\bunited\s*nations\s*(?:chief|head|secretary)\b/gi,
		name: 'Antonio Guterres',
		aliases: ['Guterres', 'UN Secretary-General', 'UN Chief'],
		role: 'international',
		titles: ['Secretary-General', 'UN Secretary-General']
	},
	{
		pattern: /\b(?:tedros\s+(?:adhanom\s+)?)?ghebreyesus\b|\bwho\s*(?:director|chief|head)\b|\bworld\s*health\s*organization\s*(?:director|chief|head)\b/gi,
		name: 'Tedros Adhanom Ghebreyesus',
		aliases: ['Tedros', 'WHO Director', 'WHO Chief'],
		role: 'international',
		titles: ['Director-General', 'WHO Director-General']
	},
	{
		pattern: /\b(?:kristalina\s+)?georgieva\b|\bimf\s*(?:chief|head|director|managing)\b|\binternational\s*monetary\s*fund\s*(?:chief|head|director)\b/gi,
		name: 'Kristalina Georgieva',
		aliases: ['Georgieva', 'IMF Chief', 'IMF Managing Director'],
		role: 'international',
		titles: ['Managing Director', 'IMF Managing Director']
	},
	{
		pattern: /\b(?:ajay\s+)?banga\b|\bworld\s*bank\s*(?:president|chief|head)\b/gi,
		name: 'Ajay Banga',
		aliases: ['Banga', 'World Bank President'],
		role: 'international',
		titles: ['President', 'World Bank President']
	},
	{
		pattern: /\b(?:mark\s+)?rutte\b|\bnato\s*(?:secretary[\s-]*general|chief|head)\b/gi,
		name: 'Mark Rutte',
		aliases: ['Rutte', 'NATO Secretary General', 'NATO Chief'],
		role: 'international',
		titles: ['Secretary General', 'NATO Secretary General']
	},
	{
		pattern: /\b(?:ursula\s+)?(?:von\s+der\s+)?leyen\b|\beu\s*commission\s*president\b|\beuropean\s*commission\s*president\b/gi,
		name: 'Ursula von der Leyen',
		aliases: ['von der Leyen', 'EU Commission President'],
		role: 'international',
		titles: ['President', 'European Commission President']
	},
	{
		pattern: /\b(?:charles\s+)?michel\b|\beu\s*council\s*president\b|\beuropean\s*council\s*president\b/gi,
		name: 'Charles Michel',
		aliases: ['Michel', 'EU Council President'],
		role: 'international',
		titles: ['President', 'European Council President']
	},
	{
		pattern: /\bngozi\s*okonjo[\s-]*iweala\b|\bwto\s*(?:director|chief|head)\b|\bworld\s*trade\s*organization\s*(?:director|chief|head)\b/gi,
		name: 'Ngozi Okonjo-Iweala',
		aliases: ['Okonjo-Iweala', 'WTO Director', 'WTO Chief'],
		role: 'international',
		titles: ['Director-General', 'WTO Director-General']
	},
	// ============================================
	// Military Leaders
	// ============================================
	{
		pattern: /\b(?:charles\s+q\.?\s+)?brown\s*jr\.?\b(?=.*(?:chairman|joint\s*chiefs|military|cjcs))|(?:chairman\s*(?:of\s*)?(?:the\s*)?joint\s*chiefs)\b/gi,
		name: 'Charles Q. Brown Jr.',
		aliases: ['General Brown', 'CJCS Brown', 'Chairman Brown'],
		role: 'military',
		titles: ['General', 'Chairman of the Joint Chiefs of Staff']
	},
	{
		pattern: /\b(?:christopher\s+)?cavoli\b|\bsaceur\b|\beucom\s*commander\b/gi,
		name: 'Christopher Cavoli',
		aliases: ['General Cavoli', 'SACEUR'],
		role: 'military',
		titles: ['General', 'SACEUR', 'Supreme Allied Commander Europe']
	},
	{
		pattern: /\b(?:valery|valeriy)\s*(?:zaluzhny|zaluzhnyi)\b|\bukrainian?\s*(?:general|military\s*commander)\b/gi,
		name: 'Valery Zaluzhny',
		aliases: ['Zaluzhny', 'General Zaluzhny'],
		role: 'military',
		titles: ['General', 'Commander-in-Chief of the Armed Forces of Ukraine']
	},
	{
		pattern: /\b(?:oleksandr\s+)?syrsky\b|\bukrain(?:ian|e)\s*(?:army\s*)?commander\b/gi,
		name: 'Oleksandr Syrsky',
		aliases: ['Syrsky', 'General Syrsky'],
		role: 'military',
		titles: ['General', 'Commander-in-Chief of the Armed Forces of Ukraine']
	},
	{
		pattern: /\b(?:valery\s+)?gerasimov\b|\brussian?\s*(?:general|chief\s*of\s*(?:general\s*)?staff|military\s*commander)\b/gi,
		name: 'Valery Gerasimov',
		aliases: ['Gerasimov', 'General Gerasimov'],
		role: 'military',
		titles: ['General', 'Chief of the General Staff of the Russian Armed Forces']
	},
	// ============================================
	// Additional Tech Leaders
	// ============================================
	{
		pattern: /\b(?:daniel?\s+)?ek\b|\bspotify\s*(?:ceo|founder)\b/gi,
		name: 'Daniel Ek',
		aliases: ['Ek', 'Spotify CEO'],
		role: 'tech',
		titles: ['CEO', 'Co-founder']
	},
	{
		pattern: /\b(?:brian\s+)?chesky\b|\bairbnb\s*(?:ceo|founder)\b/gi,
		name: 'Brian Chesky',
		aliases: ['Chesky', 'Airbnb CEO'],
		role: 'tech',
		titles: ['CEO', 'Co-founder']
	},
	{
		pattern: /\b(?:dara\s+)?khosrowshahi\b|\buber\s*ceo\b/gi,
		name: 'Dara Khosrowshahi',
		aliases: ['Khosrowshahi', 'Uber CEO'],
		role: 'tech',
		titles: ['CEO']
	},
	{
		pattern: /\b(?:evan\s+)?spiegel\b|\bsnap(?:chat)?\s*(?:ceo|founder)\b/gi,
		name: 'Evan Spiegel',
		aliases: ['Spiegel', 'Snap CEO', 'Snapchat CEO'],
		role: 'tech',
		titles: ['CEO', 'Co-founder']
	},
	{
		pattern: /\b(?:reed\s+)?hastings\b|\bnetflix\s*(?:ceo|founder|co-?ceo)\b/gi,
		name: 'Reed Hastings',
		aliases: ['Hastings', 'Netflix Founder'],
		role: 'tech',
		titles: ['Co-founder', 'Executive Chairman']
	},
	{
		pattern: /\b(?:bob\s+)?iger\b|\bdisney\s*ceo\b/gi,
		name: 'Bob Iger',
		aliases: ['Iger', 'Disney CEO'],
		role: 'tech',
		titles: ['CEO']
	},
	// ============================================
	// Additional Business/Finance Leaders
	// ============================================
	{
		pattern: /\b(?:mary\s+)?barra\b|\bgm\s*ceo\b|\bgeneral\s*motors\s*ceo\b/gi,
		name: 'Mary Barra',
		aliases: ['Barra', 'GM CEO', 'General Motors CEO'],
		role: 'finance',
		titles: ['CEO']
	},
	{
		pattern: /\b(?:jim\s+)?farley\b|\bford\s*ceo\b/gi,
		name: 'Jim Farley',
		aliases: ['Farley', 'Ford CEO'],
		role: 'finance',
		titles: ['CEO']
	},
	{
		pattern: /\b(?:doug\s+)?mcmillon\b|\bwalmart\s*ceo\b/gi,
		name: 'Doug McMillon',
		aliases: ['McMillon', 'Walmart CEO'],
		role: 'finance',
		titles: ['CEO']
	},
	{
		pattern: /\b(?:brian\s+)?niccol\b|\bstarbucks\s*ceo\b/gi,
		name: 'Brian Niccol',
		aliases: ['Niccol', 'Starbucks CEO'],
		role: 'finance',
		titles: ['CEO']
	},
	{
		pattern: /\b(?:albert\s+)?bourla\b|\bpfizer\s*ceo\b/gi,
		name: 'Albert Bourla',
		aliases: ['Bourla', 'Pfizer CEO'],
		role: 'finance',
		titles: ['CEO']
	}
];
