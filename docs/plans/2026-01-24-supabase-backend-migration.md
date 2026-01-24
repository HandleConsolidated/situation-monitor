# Supabase Backend Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate all client-side API calls to a Supabase backend with Edge Functions that aggregate data on a schedule, reducing client load, avoiding rate limits, and enabling future scalability.

**Architecture:** Edge Functions fetch from 40+ external APIs on schedules, store in PostgreSQL, client fetches from single Supabase endpoint instead of hitting external APIs directly.

**Tech Stack:** Supabase (PostgreSQL + Edge Functions + pg_cron), Deno (Edge Functions runtime), TypeScript, existing SvelteKit frontend

---

## Phase 1: Supabase Project Setup

### Task 1.1: Create Supabase Project

**Steps:**
1. Go to https://supabase.com and create new project
2. Note down:
   - Project URL (`https://xxxxx.supabase.co`)
   - Anon public key (for client)
   - Service role key (for edge functions - keep secret)
3. Enable pg_cron extension in SQL Editor:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_cron;
   ```

**Deliverable:** Project created with credentials documented securely

---

### Task 1.2: Create Database Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

**SQL Schema:**

```sql
-- Market data (crypto, indices, sectors, commodities)
CREATE TABLE market_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('crypto', 'index', 'sector', 'commodity')),
  symbol TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(type, symbol)
);

CREATE INDEX idx_market_data_type ON market_data(type);
CREATE INDEX idx_market_data_updated ON market_data(updated_at DESC);

-- News items from RSS/GDELT
CREATE TABLE news_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('politics', 'tech', 'finance', 'gov', 'ai', 'intel')),
  title TEXT NOT NULL,
  link TEXT NOT NULL,
  source TEXT,
  published_at TIMESTAMPTZ,
  summary TEXT,
  image_url TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_news_category ON news_items(category);
CREATE INDEX idx_news_published ON news_items(published_at DESC);
CREATE INDEX idx_news_external ON news_items(external_id);

-- Polymarket predictions
CREATE TABLE predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT UNIQUE,
  title TEXT NOT NULL,
  category TEXT,
  probability NUMERIC,
  volume NUMERIC,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Whale transactions
CREATE TABLE whale_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tx_hash TEXT UNIQUE,
  token TEXT,
  amount NUMERIC,
  usd_value NUMERIC,
  from_address TEXT,
  to_address TEXT,
  transaction_type TEXT,
  data JSONB NOT NULL,
  timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_whale_timestamp ON whale_transactions(timestamp DESC);

-- Weather alerts
CREATE TABLE weather_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT UNIQUE NOT NULL,
  event TEXT NOT NULL,
  severity TEXT,
  urgency TEXT,
  certainty TEXT,
  area_desc TEXT,
  headline TEXT,
  description TEXT,
  instruction TEXT,
  onset TIMESTAMPTZ,
  expires TIMESTAMPTZ,
  geometry JSONB,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weather_severity ON weather_alerts(severity);
CREATE INDEX idx_weather_expires ON weather_alerts(expires);
CREATE INDEX idx_weather_event ON weather_alerts(event);

-- Earthquakes
CREATE TABLE earthquakes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT UNIQUE NOT NULL,
  magnitude NUMERIC NOT NULL,
  place TEXT,
  lat NUMERIC,
  lon NUMERIC,
  depth NUMERIC,
  timestamp TIMESTAMPTZ,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_earthquakes_mag ON earthquakes(magnitude DESC);
CREATE INDEX idx_earthquakes_time ON earthquakes(timestamp DESC);

-- Grid stress
CREATE TABLE grid_stress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  region TEXT UNIQUE NOT NULL,
  stress_level NUMERIC,
  status TEXT,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outages
CREATE TABLE outages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT UNIQUE,
  location TEXT,
  type TEXT,
  severity TEXT,
  lat NUMERIC,
  lon NUMERIC,
  data JSONB NOT NULL,
  detected_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Radiation readings
CREATE TABLE radiation_readings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id TEXT NOT NULL,
  location TEXT,
  country TEXT,
  lat NUMERIC,
  lon NUMERIC,
  value NUMERIC,
  unit TEXT,
  data JSONB NOT NULL,
  measured_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(station_id)
);

CREATE INDEX idx_radiation_country ON radiation_readings(country);

-- Disease outbreaks
CREATE TABLE disease_outbreaks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT UNIQUE,
  disease TEXT NOT NULL,
  location TEXT,
  country TEXT,
  cases INTEGER,
  deaths INTEGER,
  status TEXT,
  data JSONB NOT NULL,
  reported_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Government contracts
CREATE TABLE gov_contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT UNIQUE,
  recipient TEXT,
  agency TEXT,
  amount NUMERIC,
  description TEXT,
  award_date DATE,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contracts_amount ON gov_contracts(amount DESC);
CREATE INDEX idx_contracts_date ON gov_contracts(award_date DESC);

-- Layoffs
CREATE TABLE layoffs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT UNIQUE,
  company TEXT NOT NULL,
  count INTEGER,
  percentage NUMERIC,
  location TEXT,
  industry TEXT,
  data JSONB NOT NULL,
  announced_at DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_layoffs_date ON layoffs(announced_at DESC);

-- World leaders
CREATE TABLE world_leaders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  country TEXT UNIQUE NOT NULL,
  leader_name TEXT NOT NULL,
  title TEXT,
  party TEXT,
  took_office DATE,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Federal Reserve balance
CREATE TABLE fed_balance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  total_assets NUMERIC,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tropical cyclones
CREATE TABLE tropical_cyclones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  storm_id TEXT UNIQUE NOT NULL,
  name TEXT,
  basin TEXT,
  category TEXT,
  max_wind INTEGER,
  pressure INTEGER,
  lat NUMERIC,
  lon NUMERIC,
  forecast_track JSONB,
  forecast_cone JSONB,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convective outlooks (SPC)
CREATE TABLE convective_outlooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  day INTEGER NOT NULL,
  outlook_type TEXT NOT NULL,
  risk TEXT,
  geometry JSONB,
  valid_time TIMESTAMPTZ,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(day, outlook_type, risk)
);

-- Conflicts (VIEWS/UCDP)
CREATE TABLE conflicts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT UNIQUE,
  name TEXT,
  country TEXT,
  region TEXT,
  type TEXT,
  intensity TEXT,
  fatalities INTEGER,
  lat NUMERIC,
  lon NUMERIC,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync status tracking
CREATE TABLE sync_status (
  function_name TEXT PRIMARY KEY,
  last_run TIMESTAMPTZ,
  last_success TIMESTAMPTZ,
  last_error TEXT,
  run_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  avg_duration_ms INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helper function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    AND table_name != 'sync_status'
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
      CREATE TRIGGER update_%I_updated_at
      BEFORE UPDATE ON %I
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    ', t, t, t, t);
  END LOOP;
END;
$$;
```

**Commit:** `feat(supabase): add initial database schema`

---

### Task 1.3: Set Up Row Level Security

**File:** `supabase/migrations/002_rls_policies.sql`

```sql
-- Enable RLS on all tables
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whale_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE earthquakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE grid_stress ENABLE ROW LEVEL SECURITY;
ALTER TABLE outages ENABLE ROW LEVEL SECURITY;
ALTER TABLE radiation_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE disease_outbreaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE gov_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE layoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE fed_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE tropical_cyclones ENABLE ROW LEVEL SECURITY;
ALTER TABLE convective_outlooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables (anon users can read)
CREATE POLICY "Public read access" ON market_data FOR SELECT USING (true);
CREATE POLICY "Public read access" ON news_items FOR SELECT USING (true);
CREATE POLICY "Public read access" ON predictions FOR SELECT USING (true);
CREATE POLICY "Public read access" ON whale_transactions FOR SELECT USING (true);
CREATE POLICY "Public read access" ON weather_alerts FOR SELECT USING (true);
CREATE POLICY "Public read access" ON earthquakes FOR SELECT USING (true);
CREATE POLICY "Public read access" ON grid_stress FOR SELECT USING (true);
CREATE POLICY "Public read access" ON outages FOR SELECT USING (true);
CREATE POLICY "Public read access" ON radiation_readings FOR SELECT USING (true);
CREATE POLICY "Public read access" ON disease_outbreaks FOR SELECT USING (true);
CREATE POLICY "Public read access" ON gov_contracts FOR SELECT USING (true);
CREATE POLICY "Public read access" ON layoffs FOR SELECT USING (true);
CREATE POLICY "Public read access" ON world_leaders FOR SELECT USING (true);
CREATE POLICY "Public read access" ON fed_balance FOR SELECT USING (true);
CREATE POLICY "Public read access" ON tropical_cyclones FOR SELECT USING (true);
CREATE POLICY "Public read access" ON convective_outlooks FOR SELECT USING (true);
CREATE POLICY "Public read access" ON conflicts FOR SELECT USING (true);
CREATE POLICY "Public read access" ON sync_status FOR SELECT USING (true);

-- Service role can do everything (for edge functions)
-- This is automatic with service_role key
```

**Commit:** `feat(supabase): add RLS policies for public read access`

---

### Task 1.4: Add Environment Variables

**Files:**
- Modify: `.env.example`
- Modify: `.env` (local only, don't commit)

**Add to `.env.example`:**

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Feature flag for gradual migration
VITE_USE_SUPABASE=false
```

**Commit:** `chore: add Supabase environment variables`

---

## Phase 2: Edge Functions

### Task 2.1: Set Up Edge Functions Project Structure

**Files to create:**

```
supabase/
├── functions/
│   ├── _shared/
│   │   ├── cors.ts
│   │   ├── supabase.ts
│   │   └── fetchers/
│   │       ├── markets.ts
│   │       ├── news.ts
│   │       ├── weather.ts
│   │       ├── hazards.ts
│   │       ├── intel.ts
│   │       ├── environmental.ts
│   │       ├── slow.ts
│   │       └── storms.ts
│   ├── sync-markets/
│   │   └── index.ts
│   ├── sync-news/
│   │   └── index.ts
│   ├── sync-weather/
│   │   └── index.ts
│   ├── sync-hazards/
│   │   └── index.ts
│   ├── sync-intel/
│   │   └── index.ts
│   ├── sync-environmental/
│   │   └── index.ts
│   ├── sync-slow/
│   │   └── index.ts
│   ├── sync-storms/
│   │   └── index.ts
│   └── sync-fed/
│       └── index.ts
└── config.toml
```

**Commit:** `feat(supabase): scaffold edge functions structure`

---

### Task 2.2: Create Shared Utilities

**File:** `supabase/functions/_shared/supabase.ts`

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function getSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

export function verifyAuth(req: Request): boolean {
  const authHeader = req.headers.get('Authorization')
  const cronSecret = Deno.env.get('CRON_SECRET')

  // Allow service role or cron secret
  return authHeader === `Bearer ${cronSecret}` ||
         authHeader === `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
}

export async function updateSyncStatus(
  functionName: string,
  success: boolean,
  durationMs: number,
  error?: string
) {
  const supabase = getSupabaseClient()

  await supabase.from('sync_status').upsert({
    function_name: functionName,
    last_run: new Date().toISOString(),
    last_success: success ? new Date().toISOString() : undefined,
    last_error: error || null,
    run_count: supabase.rpc('increment_run_count', { fn_name: functionName }),
    error_count: success ? undefined : supabase.rpc('increment_error_count', { fn_name: functionName }),
    avg_duration_ms: durationMs
  }, { onConflict: 'function_name' })
}
```

**File:** `supabase/functions/_shared/cors.ts`

```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

**Commit:** `feat(supabase): add shared edge function utilities`

---

### Task 2.3: Create Market Sync Function

**File:** `supabase/functions/_shared/fetchers/markets.ts`

```typescript
// Port from src/lib/api/markets.ts
// Simplified versions without client-side caching

const COINGECKO_API = 'https://api.coingecko.com/api/v3'
const YAHOO_CORS_PROXY = 'https://corsproxy.io/?'

export interface CryptoItem {
  symbol: string
  name: string
  price: number
  change24h: number
  marketCap: number
  volume: number
  image?: string
}

export interface MarketItem {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
}

export interface SectorPerformance {
  sector: string
  changePercent: number
}

export async function fetchCryptoPrices(): Promise<CryptoItem[]> {
  const response = await fetch(
    `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false`
  )

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`)
  }

  const data = await response.json()

  return data.map((coin: any) => ({
    symbol: coin.symbol.toUpperCase(),
    name: coin.name,
    price: coin.current_price,
    change24h: coin.price_change_percentage_24h || 0,
    marketCap: coin.market_cap,
    volume: coin.total_volume,
    image: coin.image
  }))
}

export async function fetchIndices(): Promise<MarketItem[]> {
  // Use fallback data or Yahoo Finance via proxy
  // Implementation mirrors src/lib/api/markets.ts
  const symbols = ['^GSPC', '^DJI', '^IXIC', '^RUT', '^VIX']

  // Simplified - use actual implementation from markets.ts
  return []
}

export async function fetchSectorPerformance(): Promise<SectorPerformance[]> {
  // Implementation mirrors src/lib/api/markets.ts
  return []
}

export async function fetchCommodities(): Promise<MarketItem[]> {
  // Implementation mirrors src/lib/api/markets.ts
  return []
}
```

**File:** `supabase/functions/sync-markets/index.ts`

```typescript
import { getSupabaseClient, verifyAuth, updateSyncStatus } from '../_shared/supabase.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { fetchCryptoPrices, fetchIndices, fetchSectorPerformance, fetchCommodities } from '../_shared/fetchers/markets.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    // Verify authorization
    if (!verifyAuth(req)) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    const supabase = getSupabaseClient()

    // Fetch all market data in parallel
    const [crypto, indices, sectors, commodities] = await Promise.allSettled([
      fetchCryptoPrices(),
      fetchIndices(),
      fetchSectorPerformance(),
      fetchCommodities()
    ])

    const records: any[] = []

    // Process crypto
    if (crypto.status === 'fulfilled') {
      records.push(...crypto.value.map(c => ({
        type: 'crypto',
        symbol: c.symbol,
        data: c
      })))
    }

    // Process indices
    if (indices.status === 'fulfilled') {
      records.push(...indices.value.map(i => ({
        type: 'index',
        symbol: i.symbol,
        data: i
      })))
    }

    // Process sectors
    if (sectors.status === 'fulfilled') {
      records.push(...sectors.value.map(s => ({
        type: 'sector',
        symbol: s.sector,
        data: s
      })))
    }

    // Process commodities
    if (commodities.status === 'fulfilled') {
      records.push(...commodities.value.map(c => ({
        type: 'commodity',
        symbol: c.symbol,
        data: c
      })))
    }

    // Upsert to database
    if (records.length > 0) {
      const { error } = await supabase
        .from('market_data')
        .upsert(records, { onConflict: 'type,symbol' })

      if (error) throw error
    }

    const duration = Date.now() - startTime
    await updateSyncStatus('sync-markets', true, duration)

    return new Response(
      JSON.stringify({ success: true, records: records.length, duration }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const duration = Date.now() - startTime
    await updateSyncStatus('sync-markets', false, duration, error.message)

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

**Commit:** `feat(supabase): add sync-markets edge function`

---

### Task 2.4: Create News Sync Function

**File:** `supabase/functions/_shared/fetchers/news.ts`

Port the RSS fetching logic from `src/lib/api/news.ts`:
- Fetch from 30+ RSS feeds
- Parse and normalize
- Deduplicate by title/link

**File:** `supabase/functions/sync-news/index.ts`

Similar pattern to sync-markets but for news_items table.

**Commit:** `feat(supabase): add sync-news edge function`

---

### Task 2.5: Create Weather Sync Function

**File:** `supabase/functions/_shared/fetchers/weather.ts`

Port from `src/lib/api/weather.ts`:
- Fetch all active alerts from NWS
- Parse alert features

**File:** `supabase/functions/sync-weather/index.ts`

**Commit:** `feat(supabase): add sync-weather edge function`

---

### Task 2.6: Create Hazards Sync Function

**File:** `supabase/functions/_shared/fetchers/hazards.ts`

Port from `src/lib/api/misc.ts`:
- fetchEarthquakes
- fetchAllGridStress
- fetchOutageData

**File:** `supabase/functions/sync-hazards/index.ts`

**Commit:** `feat(supabase): add sync-hazards edge function`

---

### Task 2.7: Create Intel Sync Function

**File:** `supabase/functions/_shared/fetchers/intel.ts`

Port from `src/lib/api/misc.ts`:
- fetchPolymarket
- fetchWhaleTransactions
- fetchVIEWSConflicts / fetchUCDPConflicts

**File:** `supabase/functions/sync-intel/index.ts`

**Commit:** `feat(supabase): add sync-intel edge function`

---

### Task 2.8: Create Environmental Sync Function

**File:** `supabase/functions/_shared/fetchers/environmental.ts`

Port from `src/lib/api/misc.ts`:
- fetchRadiationData
- fetchAirQualityData
- fetchDiseaseOutbreaks

**File:** `supabase/functions/sync-environmental/index.ts`

**Commit:** `feat(supabase): add sync-environmental edge function`

---

### Task 2.9: Create Slow Data Sync Function

**File:** `supabase/functions/_shared/fetchers/slow.ts`

Port from various files:
- fetchGovContracts
- fetchLayoffs
- fetchWorldLeaders

**File:** `supabase/functions/sync-slow/index.ts`

**Commit:** `feat(supabase): add sync-slow edge function`

---

### Task 2.10: Create Storms Sync Function

**File:** `supabase/functions/_shared/fetchers/storms.ts`

Port from `src/lib/api/storms.ts`:
- fetchActiveTropicalCyclones
- fetchAllDay1Outlooks

**File:** `supabase/functions/sync-storms/index.ts`

**Commit:** `feat(supabase): add sync-storms edge function`

---

### Task 2.11: Create Fed Sync Function

**File:** `supabase/functions/sync-fed/index.ts`

Port fetchFedBalanceData from misc.ts.

**Commit:** `feat(supabase): add sync-fed edge function`

---

### Task 2.12: Set Up pg_cron Schedules

**File:** `supabase/migrations/003_cron_schedules.sql`

```sql
-- Add helper functions for sync_status
CREATE OR REPLACE FUNCTION increment_run_count(fn_name TEXT)
RETURNS INTEGER AS $$
  UPDATE sync_status SET run_count = run_count + 1
  WHERE function_name = fn_name
  RETURNING run_count;
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION increment_error_count(fn_name TEXT)
RETURNS INTEGER AS $$
  UPDATE sync_status SET error_count = error_count + 1
  WHERE function_name = fn_name
  RETURNING error_count;
$$ LANGUAGE SQL;

-- Schedule cron jobs (adjust project ref)
-- Note: Replace 'your-project-ref' with actual project reference

SELECT cron.schedule(
  'sync-markets-job',
  '*/2 * * * *',  -- Every 2 minutes
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/sync-markets',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'sync-news-job',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/sync-news',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'sync-weather-job',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/sync-weather',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'sync-hazards-job',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/sync-hazards',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'sync-intel-job',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/sync-intel',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'sync-environmental-job',
  '*/15 * * * *',  -- Every 15 minutes
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/sync-environmental',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'sync-slow-job',
  '*/30 * * * *',  -- Every 30 minutes
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/sync-slow',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'sync-storms-job',
  '*/15 * * * *',  -- Every 15 minutes
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/sync-storms',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'sync-fed-job',
  '0 */4 * * *',  -- Every 4 hours
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/sync-fed',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
  );
  $$
);

-- Cleanup old data job (daily at 3am)
SELECT cron.schedule(
  'cleanup-old-data',
  '0 3 * * *',
  $$
  -- Delete news older than 7 days
  DELETE FROM news_items WHERE created_at < NOW() - INTERVAL '7 days';
  -- Delete whale transactions older than 7 days
  DELETE FROM whale_transactions WHERE timestamp < NOW() - INTERVAL '7 days';
  -- Delete expired weather alerts
  DELETE FROM weather_alerts WHERE expires < NOW() - INTERVAL '1 day';
  -- Delete old earthquakes
  DELETE FROM earthquakes WHERE timestamp < NOW() - INTERVAL '30 days';
  $$
);
```

**Commit:** `feat(supabase): add pg_cron schedules for sync functions`

---

## Phase 3: Client API Layer

### Task 3.1: Install Supabase Client

**Step 1:** Install dependency

```bash
npm install @supabase/supabase-js
```

**Step 2:** Create client

**File:** `src/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js'
import { browser } from '$app/environment'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = browser && supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export function isSupabaseEnabled(): boolean {
  return import.meta.env.VITE_USE_SUPABASE === 'true' && supabase !== null
}
```

**Commit:** `feat: add Supabase client setup`

---

### Task 3.2: Create Supabase API Functions

**File:** `src/lib/api/supabase-api.ts`

```typescript
import { supabase } from '$lib/supabase'
import type {
  CryptoItem, MarketItem, SectorPerformance,
  NewsItem, NewsCategory,
  Prediction, WhaleTransaction, Contract, Layoff,
  WeatherAlert, EarthquakeData, GridStressData, OutageData,
  RadiationReading, DiseaseOutbreak, WorldLeader, FedBalanceData
} from '$lib/types'
import type { TropicalCyclone, ConvectiveOutlook } from '$lib/types/storms'

// ============ Market Data ============

export async function fetchMarketDataFromSupabase() {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('market_data')
    .select('*')

  if (error) throw error

  return {
    crypto: data.filter(d => d.type === 'crypto').map(d => d.data as CryptoItem),
    indices: data.filter(d => d.type === 'index').map(d => d.data as MarketItem),
    sectors: data.filter(d => d.type === 'sector').map(d => d.data as SectorPerformance),
    commodities: data.filter(d => d.type === 'commodity').map(d => d.data as MarketItem)
  }
}

export async function fetchCryptoPricesFromSupabase(): Promise<CryptoItem[]> {
  const data = await fetchMarketDataFromSupabase()
  return data.crypto
}

export async function fetchIndicesFromSupabase(): Promise<MarketItem[]> {
  const data = await fetchMarketDataFromSupabase()
  return data.indices
}

export async function fetchSectorPerformanceFromSupabase(): Promise<SectorPerformance[]> {
  const data = await fetchMarketDataFromSupabase()
  return data.sectors
}

export async function fetchCommoditiesFromSupabase(): Promise<MarketItem[]> {
  const data = await fetchMarketDataFromSupabase()
  return data.commodities
}

// ============ News Data ============

export async function fetchNewsFromSupabase(category?: NewsCategory): Promise<NewsItem[]> {
  if (!supabase) throw new Error('Supabase not configured')

  let query = supabase
    .from('news_items')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(100)

  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query
  if (error) throw error

  return data.map(d => ({
    id: d.external_id || d.id,
    title: d.title,
    link: d.link,
    source: d.source,
    pubDate: d.published_at,
    summary: d.summary,
    imageUrl: d.image_url,
    category: d.category,
    ...d.data
  }))
}

export async function fetchAllNewsFromSupabase(): Promise<Record<NewsCategory, NewsItem[]>> {
  const allNews = await fetchNewsFromSupabase()

  const byCategory: Record<NewsCategory, NewsItem[]> = {
    politics: [],
    tech: [],
    finance: [],
    gov: [],
    ai: [],
    intel: []
  }

  for (const item of allNews) {
    if (item.category && byCategory[item.category as NewsCategory]) {
      byCategory[item.category as NewsCategory].push(item)
    }
  }

  return byCategory
}

// ============ Predictions & Trading ============

export async function fetchPolymarketFromSupabase(): Promise<Prediction[]> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('predictions')
    .select('*')
    .order('volume', { ascending: false })

  if (error) throw error
  return data.map(d => d.data as Prediction)
}

export async function fetchWhaleTransactionsFromSupabase(): Promise<WhaleTransaction[]> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('whale_transactions')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(100)

  if (error) throw error
  return data.map(d => d.data as WhaleTransaction)
}

// ============ Weather ============

export async function fetchWeatherAlertsFromSupabase(): Promise<WeatherAlert[]> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('weather_alerts')
    .select('*')
    .gt('expires', new Date().toISOString())
    .order('severity', { ascending: true })

  if (error) throw error
  return data.map(d => d.data as WeatherAlert)
}

// ============ Hazards ============

export async function fetchEarthquakesFromSupabase(minMagnitude = 4.0): Promise<EarthquakeData[]> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('earthquakes')
    .select('*')
    .gte('magnitude', minMagnitude)
    .order('timestamp', { ascending: false })
    .limit(200)

  if (error) throw error
  return data.map(d => d.data as EarthquakeData)
}

export async function fetchGridStressFromSupabase(): Promise<GridStressData[]> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('grid_stress')
    .select('*')

  if (error) throw error
  return data.map(d => d.data as GridStressData)
}

export async function fetchOutagesFromSupabase(): Promise<OutageData[]> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('outages')
    .select('*')
    .order('detected_at', { ascending: false })

  if (error) throw error
  return data.map(d => d.data as OutageData)
}

// ============ Environmental ============

export async function fetchRadiationFromSupabase(): Promise<RadiationReading[]> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('radiation_readings')
    .select('*')

  if (error) throw error
  return data.map(d => d.data as RadiationReading)
}

export async function fetchDiseaseOutbreaksFromSupabase(): Promise<DiseaseOutbreak[]> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('disease_outbreaks')
    .select('*')
    .order('reported_at', { ascending: false })

  if (error) throw error
  return data.map(d => d.data as DiseaseOutbreak)
}

// ============ Government & Economy ============

export async function fetchGovContractsFromSupabase(): Promise<Contract[]> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('gov_contracts')
    .select('*')
    .order('amount', { ascending: false })
    .limit(100)

  if (error) throw error
  return data.map(d => d.data as Contract)
}

export async function fetchLayoffsFromSupabase(): Promise<Layoff[]> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('layoffs')
    .select('*')
    .order('announced_at', { ascending: false })
    .limit(100)

  if (error) throw error
  return data.map(d => d.data as Layoff)
}

export async function fetchWorldLeadersFromSupabase(): Promise<WorldLeader[]> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('world_leaders')
    .select('*')
    .order('country')

  if (error) throw error
  return data.map(d => d.data as WorldLeader)
}

export async function fetchFedBalanceFromSupabase(): Promise<FedBalanceData | null> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('fed_balance')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // No rows
    throw error
  }
  return data.data as FedBalanceData
}

// ============ Storms ============

export async function fetchTropicalCyclonesFromSupabase(): Promise<TropicalCyclone[]> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('tropical_cyclones')
    .select('*')

  if (error) throw error
  return data.map(d => d.data as TropicalCyclone)
}

export async function fetchConvectiveOutlooksFromSupabase(): Promise<ConvectiveOutlook[]> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('convective_outlooks')
    .select('*')

  if (error) throw error
  return data.map(d => d.data as ConvectiveOutlook)
}

// ============ Sync Status ============

export async function fetchSyncStatus() {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('sync_status')
    .select('*')

  if (error) throw error
  return data
}
```

**Commit:** `feat: add Supabase API fetch functions`

---

### Task 3.3: Create Switchable API Wrappers

**File:** `src/lib/api/switchable.ts`

```typescript
/**
 * Switchable API layer that routes between direct API calls and Supabase
 * based on VITE_USE_SUPABASE feature flag
 */

import { isSupabaseEnabled } from '$lib/supabase'

// Import original functions
import {
  fetchCryptoPrices as fetchCryptoDirect,
  fetchIndices as fetchIndicesDirect,
  fetchSectorPerformance as fetchSectorsDirect,
  fetchCommodities as fetchCommoditiesDirect
} from './markets'

import {
  fetchAllNews as fetchNewsDirect,
  fetchCategoryNews as fetchCategoryNewsDirect
} from './news'

import {
  fetchPolymarket as fetchPolymarketDirect,
  fetchWhaleTransactions as fetchWhalesDirect,
  fetchGovContracts as fetchContractsDirect,
  fetchLayoffs as fetchLayoffsDirect,
  fetchEarthquakes as fetchEarthquakesDirect,
  fetchRadiationData as fetchRadiationDirect,
  fetchDiseaseOutbreaks as fetchOutbreaksDirect,
  fetchAllGridStress as fetchGridStressDirect,
  fetchOutageData as fetchOutagesDirect,
  fetchFedBalanceData as fetchFedDirect
} from './misc'

import { fetchWorldLeaders as fetchLeadersDirect } from './leaders'
import { fetchAllActiveAlerts as fetchAlertsDirect } from './weather'
import { fetchActiveTropicalCyclones as fetchCyclonesDirect, fetchAllDay1Outlooks as fetchOutlooksDirect } from './storms'

// Import Supabase functions
import {
  fetchCryptoPricesFromSupabase,
  fetchIndicesFromSupabase,
  fetchSectorPerformanceFromSupabase,
  fetchCommoditiesFromSupabase,
  fetchAllNewsFromSupabase,
  fetchNewsFromSupabase,
  fetchPolymarketFromSupabase,
  fetchWhaleTransactionsFromSupabase,
  fetchGovContractsFromSupabase,
  fetchLayoffsFromSupabase,
  fetchEarthquakesFromSupabase,
  fetchRadiationFromSupabase,
  fetchDiseaseOutbreaksFromSupabase,
  fetchGridStressFromSupabase,
  fetchOutagesFromSupabase,
  fetchFedBalanceFromSupabase,
  fetchWorldLeadersFromSupabase,
  fetchWeatherAlertsFromSupabase,
  fetchTropicalCyclonesFromSupabase,
  fetchConvectiveOutlooksFromSupabase
} from './supabase-api'

// ============ Switchable Exports ============

export async function fetchCryptoPrices() {
  return isSupabaseEnabled() ? fetchCryptoPricesFromSupabase() : fetchCryptoDirect()
}

export async function fetchIndices() {
  return isSupabaseEnabled() ? fetchIndicesFromSupabase() : fetchIndicesDirect()
}

export async function fetchSectorPerformance() {
  return isSupabaseEnabled() ? fetchSectorPerformanceFromSupabase() : fetchSectorsDirect()
}

export async function fetchCommodities() {
  return isSupabaseEnabled() ? fetchCommoditiesFromSupabase() : fetchCommoditiesDirect()
}

export async function fetchAllNews() {
  return isSupabaseEnabled() ? fetchAllNewsFromSupabase() : fetchNewsDirect()
}

export async function fetchCategoryNews(category: string) {
  return isSupabaseEnabled() ? fetchNewsFromSupabase(category as any) : fetchCategoryNewsDirect(category as any)
}

export async function fetchPolymarket() {
  return isSupabaseEnabled() ? fetchPolymarketFromSupabase() : fetchPolymarketDirect()
}

export async function fetchWhaleTransactions() {
  return isSupabaseEnabled() ? fetchWhaleTransactionsFromSupabase() : fetchWhalesDirect()
}

export async function fetchGovContracts() {
  return isSupabaseEnabled() ? fetchGovContractsFromSupabase() : fetchContractsDirect()
}

export async function fetchLayoffs() {
  return isSupabaseEnabled() ? fetchLayoffsFromSupabase() : fetchLayoffsDirect()
}

export async function fetchEarthquakes(minMagnitude = 4.0) {
  return isSupabaseEnabled() ? fetchEarthquakesFromSupabase(minMagnitude) : fetchEarthquakesDirect(minMagnitude)
}

export async function fetchRadiationData() {
  return isSupabaseEnabled() ? fetchRadiationFromSupabase() : fetchRadiationDirect()
}

export async function fetchDiseaseOutbreaks() {
  return isSupabaseEnabled() ? fetchDiseaseOutbreaksFromSupabase() : fetchOutbreaksDirect()
}

export async function fetchAllGridStress() {
  return isSupabaseEnabled() ? fetchGridStressFromSupabase() : fetchGridStressDirect()
}

export async function fetchOutageData() {
  return isSupabaseEnabled() ? fetchOutagesFromSupabase() : fetchOutagesDirect()
}

export async function fetchFedBalanceData() {
  return isSupabaseEnabled() ? fetchFedBalanceFromSupabase() : fetchFedDirect()
}

export async function fetchWorldLeaders() {
  return isSupabaseEnabled() ? fetchWorldLeadersFromSupabase() : fetchLeadersDirect()
}

export async function fetchAllActiveAlerts() {
  return isSupabaseEnabled() ? fetchWeatherAlertsFromSupabase() : fetchAlertsDirect()
}

export async function fetchActiveTropicalCyclones() {
  return isSupabaseEnabled() ? fetchTropicalCyclonesFromSupabase() : fetchCyclonesDirect()
}

export async function fetchAllDay1Outlooks() {
  return isSupabaseEnabled() ? fetchConvectiveOutlooksFromSupabase() : fetchOutlooksDirect()
}
```

**Commit:** `feat: add switchable API layer with feature flag`

---

### Task 3.4: Update API Barrel Export

**File:** Modify `src/lib/api/index.ts`

Add switchable exports alongside original exports, with clear documentation.

**Commit:** `feat: export switchable API functions`

---

## Phase 4: Gradual Migration

### Task 4.1: Enable Supabase for Markets Only

**Steps:**
1. Set `VITE_USE_SUPABASE=true` in `.env`
2. Update components to use switchable imports
3. Monitor for issues
4. Verify data matches between old and new

**Commit:** `feat: enable Supabase backend for market data`

---

### Task 4.2-4.8: Enable Remaining Data Types

Repeat for each category:
- News
- Weather/Hazards
- Intel (Polymarket, Whales, Conflicts)
- Environmental (Radiation, Outbreaks)
- Slow data (Contracts, Layoffs, Leaders)
- Storms

Each gets its own commit and testing period.

---

## Phase 5: Cleanup

### Task 5.1: Remove Feature Flag

Once stable, make Supabase the default and remove the feature flag logic.

**Commit:** `refactor: remove Supabase feature flag, use as default`

---

### Task 5.2: Delete Old Code

Remove:
- `src/lib/api/cached.ts`
- `src/lib/services/api-cache.ts`
- Old fetch functions that are no longer used
- Simplify `misc.ts` significantly

**Commit:** `refactor: remove legacy direct API code`

---

### Task 5.3: Add Monitoring Dashboard (Optional)

Create a simple admin page to view sync status:
- Last sync times
- Error counts
- Data freshness

**Commit:** `feat: add sync status monitoring page`

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 4 | Supabase project setup, schema, RLS, env vars |
| 2 | 12 | Edge functions for all data types + cron |
| 3 | 4 | Client Supabase layer + switchable wrappers |
| 4 | 8 | Gradual migration per data type |
| 5 | 3 | Cleanup old code, optional monitoring |

**Total: 31 tasks**

**Data NOT migrated (stays direct):**
- Aircraft positions (real-time WebSocket)
- Vessel positions (real-time)
- Radar tiles (CDN)
- Zone geometry (on-demand)

**Benefits after migration:**
- Single API endpoint instead of 40+
- No client-side rate limiting issues
- Faster initial load (data pre-fetched)
- Centralized error handling
- Easy to add caching headers
- Foundation for user accounts, saved preferences, etc.
