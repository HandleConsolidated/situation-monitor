# Supabase Integration Plan for Aegis Situation Monitor

## Executive Summary

This plan outlines the architecture for migrating the Aegis Situation Monitor from client-side API fetching to a Supabase backend. The goal is to reduce browser load, centralize data fetching, enable caching/history, and improve performance.

---

## Current State Analysis

### Data Sources Inventory (30+ APIs)

| Category | Sources | Items/Cycle | Refresh | Auth Required |
|----------|---------|-------------|---------|---------------|
| News/Intel | GDELT + 30 RSS | 1,050 | 5 min | No |
| Markets | CoinGecko, Finnhub | 22 | 2 min | Finnhub key |
| Predictions | Polymarket | 100 | 5 min | No |
| Crypto Whales | Mempool, Blockchair | 40 | 5 min | No |
| Weather | NWS, NHC, SPC, USGS | 100+ | 5-10 min | No |
| Outages | IODA, OONI, WattTime | Variable | 5 min | WattTime creds |
| Maritime | AIS Stream | Continuous | Real-time | AIS key |
| Aviation | OpenSky | 10,000+ | 5 min | Optional |
| Webcams | Windy + curated | 200+ | 9 min | Windy key |
| Government | USASpending, FRED | 50+ | 30 min - 4 hr | FRED key |

### Current Pain Points
1. Each browser makes 30+ API calls per refresh cycle
2. No historical data storage
3. Rate limits hit frequently with multiple users
4. CORS proxy bottleneck (Cloudflare Worker)
5. Large payload sizes sent to each client
6. No data deduplication across sessions

---

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SUPABASE BACKEND                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Edge Fn   │  │   Edge Fn   │  │   Edge Fn   │             │
│  │   /news     │  │  /markets   │  │  /weather   │    ...      │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         ▼                ▼                ▼                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    PostgreSQL Database                   │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│  │  │  news   │ │ markets │ │ weather │ │ vessels │  ...  │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Realtime Subscriptions                      │   │
│  │        (Postgres Changes → WebSocket → Clients)          │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐                                               │
│  │  pg_cron    │  Scheduled data fetching (replaces client)   │
│  │  Workers    │                                               │
│  └─────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT (Browser)                           │
├─────────────────────────────────────────────────────────────────┤
│  - Subscribe to Realtime channels                               │
│  - Receive compressed/batched updates                           │
│  - Local caching with IndexedDB                                 │
│  - Minimal direct API calls                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Core Tables

```sql
-- ============================================
-- NEWS & INTELLIGENCE
-- ============================================

CREATE TABLE news_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,           -- 'gdelt', 'rss:bbc', 'rss:cnbc', etc.
    category TEXT NOT NULL,         -- 'politics', 'tech', 'finance', etc.
    title TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    published_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    summary TEXT,
    image_url TEXT,
    sentiment_score REAL,           -- -1 to 1 (negative to positive)
    relevance_score REAL,           -- 0 to 1
    keywords TEXT[],
    locations TEXT[],               -- Extracted location mentions
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_news_category ON news_articles(category);
CREATE INDEX idx_news_published ON news_articles(published_at DESC);
CREATE INDEX idx_news_expires ON news_articles(expires_at);

-- ============================================
-- MARKET DATA
-- ============================================

CREATE TABLE market_prices (
    id SERIAL PRIMARY KEY,
    symbol TEXT NOT NULL,
    price DECIMAL(18, 8) NOT NULL,
    change_24h DECIMAL(10, 4),
    change_pct DECIMAL(8, 4),
    volume DECIMAL(24, 2),
    market_cap DECIMAL(24, 2),
    asset_type TEXT NOT NULL,       -- 'crypto', 'index', 'sector', 'commodity'
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(symbol, recorded_at)
);

CREATE INDEX idx_market_symbol ON market_prices(symbol);
CREATE INDEX idx_market_time ON market_prices(recorded_at DESC);

-- Latest prices view for quick access
CREATE VIEW market_prices_latest AS
SELECT DISTINCT ON (symbol) *
FROM market_prices
ORDER BY symbol, recorded_at DESC;

-- ============================================
-- PREDICTIONS (Polymarket)
-- ============================================

CREATE TABLE predictions (
    id TEXT PRIMARY KEY,            -- Polymarket event ID
    title TEXT NOT NULL,
    category TEXT,
    end_date TIMESTAMPTZ,
    probability DECIMAL(5, 4),      -- 0 to 1
    volume DECIMAL(18, 2),
    liquidity DECIMAL(18, 2),
    outcomes JSONB,                 -- Array of outcome objects
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_predictions_category ON predictions(category);
CREATE INDEX idx_predictions_probability ON predictions(probability DESC);

-- ============================================
-- WHALE TRANSACTIONS
-- ============================================

CREATE TABLE whale_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain TEXT NOT NULL,            -- 'btc', 'eth'
    tx_hash TEXT UNIQUE NOT NULL,
    value_native DECIMAL(24, 8),    -- Amount in BTC/ETH
    value_usd DECIMAL(18, 2),
    from_address TEXT,
    to_address TEXT,
    block_number BIGINT,
    block_time TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_whale_chain ON whale_transactions(chain);
CREATE INDEX idx_whale_value ON whale_transactions(value_usd DESC);
CREATE INDEX idx_whale_time ON whale_transactions(block_time DESC);

-- ============================================
-- WEATHER ALERTS
-- ============================================

CREATE TABLE weather_alerts (
    id TEXT PRIMARY KEY,            -- NWS alert ID
    event_type TEXT NOT NULL,       -- 'Tornado Warning', 'Hurricane Watch', etc.
    severity TEXT,                  -- 'Extreme', 'Severe', 'Moderate', 'Minor'
    certainty TEXT,
    urgency TEXT,
    headline TEXT,
    description TEXT,
    instruction TEXT,
    affected_zones TEXT[],
    geometry GEOGRAPHY(GEOMETRY, 4326),
    onset TIMESTAMPTZ,
    expires TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weather_severity ON weather_alerts(severity);
CREATE INDEX idx_weather_expires ON weather_alerts(expires);
CREATE INDEX idx_weather_geo ON weather_alerts USING GIST(geometry);

-- ============================================
-- TROPICAL CYCLONES
-- ============================================

CREATE TABLE tropical_cyclones (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    basin TEXT,                     -- 'atlantic', 'east_pacific'
    category INTEGER,               -- Saffir-Simpson (1-5) or -1 for TD, 0 for TS
    max_wind_mph INTEGER,
    movement_dir TEXT,
    movement_speed_mph INTEGER,
    min_pressure_mb INTEGER,
    current_lat DECIMAL(9, 6),
    current_lon DECIMAL(9, 6),
    forecast_track JSONB,           -- Array of forecast points
    forecast_cone GEOGRAPHY(POLYGON, 4326),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EARTHQUAKES
-- ============================================

CREATE TABLE earthquakes (
    id TEXT PRIMARY KEY,            -- USGS event ID
    magnitude DECIMAL(4, 2) NOT NULL,
    magnitude_type TEXT,            -- 'ml', 'mb', 'mw', etc.
    location TEXT,
    lat DECIMAL(9, 6) NOT NULL,
    lon DECIMAL(9, 6) NOT NULL,
    depth_km DECIMAL(8, 2),
    occurred_at TIMESTAMPTZ NOT NULL,
    tsunami_warning BOOLEAN DEFAULT FALSE,
    felt_reports INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_earthquake_mag ON earthquakes(magnitude DESC);
CREATE INDEX idx_earthquake_time ON earthquakes(occurred_at DESC);

-- ============================================
-- OUTAGES
-- ============================================

CREATE TABLE outages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,           -- 'ioda', 'ooni', 'watttime'
    outage_type TEXT,               -- 'internet', 'power', 'grid_stress'
    country_code TEXT,
    region TEXT,
    severity TEXT,                  -- 'total', 'major', 'partial'
    score DECIMAL(5, 2),            -- Source-specific severity score
    lat DECIMAL(9, 6),
    lon DECIMAL(9, 6),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source, country_code, started_at)
);

CREATE INDEX idx_outages_active ON outages(ended_at) WHERE ended_at IS NULL;
CREATE INDEX idx_outages_severity ON outages(severity);

-- ============================================
-- VESSELS (AIS)
-- ============================================

CREATE TABLE vessels (
    mmsi TEXT PRIMARY KEY,
    name TEXT,
    ship_type INTEGER,
    ship_type_name TEXT,            -- 'Tanker', 'Cargo', 'Military', etc.
    flag_country TEXT,
    imo TEXT,
    callsign TEXT,
    length_m INTEGER,
    width_m INTEGER,
    draft_m DECIMAL(5, 2),
    is_strategic BOOLEAN DEFAULT FALSE,
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vessel_positions (
    id BIGSERIAL PRIMARY KEY,
    mmsi TEXT NOT NULL REFERENCES vessels(mmsi),
    lat DECIMAL(9, 6) NOT NULL,
    lon DECIMAL(9, 6) NOT NULL,
    speed_knots DECIMAL(6, 2),
    course DECIMAL(6, 2),
    heading DECIMAL(6, 2),
    nav_status INTEGER,
    destination TEXT,
    eta TIMESTAMPTZ,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vessel_pos_mmsi ON vessel_positions(mmsi);
CREATE INDEX idx_vessel_pos_time ON vessel_positions(recorded_at DESC);
CREATE INDEX idx_vessel_pos_recent ON vessel_positions(mmsi, recorded_at DESC);

-- Partition by time for scalability
-- CREATE TABLE vessel_positions_y2024m01 PARTITION OF vessel_positions
--     FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- ============================================
-- AIRCRAFT (OpenSky)
-- ============================================

CREATE TABLE aircraft_positions (
    id BIGSERIAL PRIMARY KEY,
    icao24 TEXT NOT NULL,
    callsign TEXT,
    origin_country TEXT,
    lat DECIMAL(9, 6),
    lon DECIMAL(9, 6),
    altitude_m INTEGER,
    velocity_ms DECIMAL(8, 2),
    heading DECIMAL(6, 2),
    vertical_rate DECIMAL(8, 2),
    on_ground BOOLEAN,
    squawk TEXT,
    spi BOOLEAN,
    position_source INTEGER,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_aircraft_icao ON aircraft_positions(icao24);
CREATE INDEX idx_aircraft_time ON aircraft_positions(recorded_at DESC);

-- ============================================
-- WEBCAMS
-- ============================================

CREATE TABLE webcams (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,           -- 'windy', 'curated'
    name TEXT NOT NULL,
    country_code TEXT,
    region TEXT,
    lat DECIMAL(9, 6),
    lon DECIMAL(9, 6),
    stream_url TEXT,
    embed_url TEXT,
    thumbnail_url TEXT,
    category TEXT,                  -- 'strategic', 'weather', 'city', etc.
    is_active BOOLEAN DEFAULT TRUE,
    last_checked TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webcams_country ON webcams(country_code);
CREATE INDEX idx_webcams_active ON webcams(is_active) WHERE is_active = TRUE;

-- ============================================
-- GOVERNMENT CONTRACTS
-- ============================================

CREATE TABLE govt_contracts (
    id TEXT PRIMARY KEY,            -- USASpending award ID
    recipient_name TEXT,
    description TEXT,
    amount DECIMAL(18, 2),
    awarding_agency TEXT,
    naics_code TEXT,
    naics_description TEXT,
    award_date DATE,
    period_of_performance_start DATE,
    period_of_performance_end DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contracts_amount ON govt_contracts(amount DESC);
CREATE INDEX idx_contracts_date ON govt_contracts(award_date DESC);

-- ============================================
-- USER MONITORS (Custom watchlists)
-- ============================================

CREATE TABLE monitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,                   -- Optional: link to auth.users
    name TEXT NOT NULL,
    keywords TEXT[],
    locations TEXT[],
    sources TEXT[],
    alert_threshold TEXT,           -- 'any', 'high', 'critical'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- API FETCH HISTORY (Monitoring)
-- ============================================

CREATE TABLE api_fetch_log (
    id BIGSERIAL PRIMARY KEY,
    source TEXT NOT NULL,
    endpoint TEXT,
    status_code INTEGER,
    items_fetched INTEGER,
    duration_ms INTEGER,
    error_message TEXT,
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_log_source ON api_fetch_log(source);
CREATE INDEX idx_api_log_time ON api_fetch_log(fetched_at DESC);

-- ============================================
-- REALTIME BROADCAST CHANNEL
-- ============================================

-- For pushing batched updates to clients
CREATE TABLE realtime_updates (
    id BIGSERIAL PRIMARY KEY,
    channel TEXT NOT NULL,          -- 'news', 'markets', 'weather', etc.
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-delete old broadcasts
CREATE INDEX idx_realtime_created ON realtime_updates(created_at);
```

### Cleanup Functions

```sql
-- Auto-cleanup expired data
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
    -- Delete expired news
    DELETE FROM news_articles WHERE expires_at < NOW();

    -- Delete old market prices (keep 7 days)
    DELETE FROM market_prices WHERE recorded_at < NOW() - INTERVAL '7 days';

    -- Delete old vessel positions (keep 24 hours)
    DELETE FROM vessel_positions WHERE recorded_at < NOW() - INTERVAL '24 hours';

    -- Delete old aircraft positions (keep 1 hour)
    DELETE FROM aircraft_positions WHERE recorded_at < NOW() - INTERVAL '1 hour';

    -- Delete old whale transactions (keep 30 days)
    DELETE FROM whale_transactions WHERE fetched_at < NOW() - INTERVAL '30 days';

    -- Delete old API logs (keep 7 days)
    DELETE FROM api_fetch_log WHERE fetched_at < NOW() - INTERVAL '7 days';

    -- Delete old realtime updates (keep 5 minutes)
    DELETE FROM realtime_updates WHERE created_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup every hour
SELECT cron.schedule('cleanup-expired', '0 * * * *', 'SELECT cleanup_expired_data()');
```

---

## Edge Functions

### 1. News Fetcher (`/functions/fetch-news`)

```typescript
// supabase/functions/fetch-news/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GDELT_BASE = 'https://api.gdeltproject.org/api/v2/doc/doc';
const CATEGORIES = ['politics', 'tech', 'finance', 'gov', 'ai', 'intel'];

serve(async (req) => {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const results = await Promise.allSettled(
        CATEGORIES.map(cat => fetchCategory(cat))
    );

    const articles = results
        .filter(r => r.status === 'fulfilled')
        .flatMap(r => r.value);

    // Upsert to database
    const { error } = await supabase
        .from('news_articles')
        .upsert(articles, { onConflict: 'url' });

    // Broadcast update
    await supabase.channel('news').send({
        type: 'broadcast',
        event: 'update',
        payload: { count: articles.length, timestamp: new Date() }
    });

    return new Response(JSON.stringify({
        success: !error,
        count: articles.length
    }));
});
```

### 2. Market Data Fetcher (`/functions/fetch-markets`)

```typescript
// supabase/functions/fetch-markets/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price';

serve(async (req) => {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch crypto
    const cryptoRes = await fetch(
        `${COINGECKO_URL}?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true`
    );
    const cryptoData = await cryptoRes.json();

    // Fetch stocks (batch to avoid rate limits)
    const symbols = ['DIA', 'SPY', 'QQQ', 'IWM', 'XLK', 'XLF', 'XLV'];
    const stockData = await fetchStocksBatched(symbols, FINNHUB_KEY);

    // Transform and insert
    const prices = [
        ...transformCrypto(cryptoData),
        ...transformStocks(stockData)
    ];

    await supabase.from('market_prices').insert(prices);

    // Broadcast to clients
    await supabase.channel('markets').send({
        type: 'broadcast',
        event: 'update',
        payload: prices
    });

    return new Response(JSON.stringify({ success: true, count: prices.length }));
});
```

### 3. AIS Stream Processor (`/functions/ais-stream`)

```typescript
// supabase/functions/ais-stream/index.ts
// This runs as a long-lived Edge Function with WebSocket

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const AIS_KEY = Deno.env.get('AIS_STREAM_KEY');
const BATCH_SIZE = 100;
const BATCH_INTERVAL = 5000; // 5 seconds

serve(async (req) => {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');
    let batch: any[] = [];

    ws.onopen = () => {
        ws.send(JSON.stringify({
            APIKey: AIS_KEY,
            BoundingBoxes: [[[-180, -90], [180, 90]]],
            FilterMessageTypes: ['PositionReport']
        }));
    };

    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        if (isStrategicVessel(data)) {
            batch.push(transformAISMessage(data));

            if (batch.length >= BATCH_SIZE) {
                await flushBatch(supabase, batch);
                batch = [];
            }
        }
    };

    // Flush every 5 seconds
    setInterval(async () => {
        if (batch.length > 0) {
            await flushBatch(supabase, batch);
            batch = [];
        }
    }, BATCH_INTERVAL);

    return new Response('AIS stream started');
});

async function flushBatch(supabase: any, batch: any[]) {
    // Upsert vessels
    const vessels = batch.map(b => ({
        mmsi: b.mmsi,
        name: b.name,
        ship_type: b.shipType,
        is_strategic: true,
        last_updated: new Date()
    }));
    await supabase.from('vessels').upsert(vessels, { onConflict: 'mmsi' });

    // Insert positions
    const positions = batch.map(b => ({
        mmsi: b.mmsi,
        lat: b.lat,
        lon: b.lon,
        speed_knots: b.speed,
        course: b.course,
        heading: b.heading
    }));
    await supabase.from('vessel_positions').insert(positions);

    // Broadcast to clients
    await supabase.channel('vessels').send({
        type: 'broadcast',
        event: 'update',
        payload: { count: batch.length, vessels: vessels.slice(0, 10) }
    });
}
```

---

## Scheduled Jobs (pg_cron)

```sql
-- Schedule data fetching
SELECT cron.schedule('fetch-news', '*/5 * * * *',
    $$SELECT net.http_post(
        'https://your-project.supabase.co/functions/v1/fetch-news',
        '{}',
        'application/json',
        ARRAY[('Authorization', 'Bearer ' || current_setting('app.service_key'))]
    )$$
);

SELECT cron.schedule('fetch-markets', '*/2 * * * *',
    $$SELECT net.http_post(
        'https://your-project.supabase.co/functions/v1/fetch-markets',
        '{}',
        'application/json',
        ARRAY[('Authorization', 'Bearer ' || current_setting('app.service_key'))]
    )$$
);

SELECT cron.schedule('fetch-weather', '*/10 * * * *',
    $$SELECT net.http_post(
        'https://your-project.supabase.co/functions/v1/fetch-weather',
        '{}',
        'application/json',
        ARRAY[('Authorization', 'Bearer ' || current_setting('app.service_key'))]
    )$$
);

SELECT cron.schedule('fetch-earthquakes', '*/5 * * * *',
    $$SELECT net.http_post(
        'https://your-project.supabase.co/functions/v1/fetch-earthquakes',
        '{}',
        'application/json',
        ARRAY[('Authorization', 'Bearer ' || current_setting('app.service_key'))]
    )$$
);
```

---

## Client-Side Integration

### Supabase Client Setup

```typescript
// src/lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    }
});
```

### Realtime Subscriptions

```typescript
// src/lib/supabase/subscriptions.ts
import { supabase } from './client';
import { newsStore, marketsStore, vesselsStore } from '$stores';

export function initRealtimeSubscriptions() {
    // News updates
    supabase
        .channel('news')
        .on('broadcast', { event: 'update' }, async () => {
            const { data } = await supabase
                .from('news_articles')
                .select('*')
                .order('published_at', { ascending: false })
                .limit(150);
            newsStore.set(data);
        })
        .subscribe();

    // Market updates
    supabase
        .channel('markets')
        .on('broadcast', { event: 'update' }, (payload) => {
            marketsStore.update(payload.payload);
        })
        .subscribe();

    // Vessel updates (throttled)
    supabase
        .channel('vessels')
        .on('broadcast', { event: 'update' }, (payload) => {
            vesselsStore.update(payload.payload);
        })
        .subscribe();
}
```

### Data Fetching Service

```typescript
// src/lib/supabase/api.ts
import { supabase } from './client';

export const api = {
    // Initial data load
    async getNews(category?: string) {
        const query = supabase
            .from('news_articles')
            .select('*')
            .order('published_at', { ascending: false })
            .limit(150);

        if (category) {
            query.eq('category', category);
        }

        return query;
    },

    async getMarkets() {
        return supabase
            .from('market_prices_latest')
            .select('*');
    },

    async getVessels() {
        return supabase
            .from('vessels')
            .select(`
                *,
                vessel_positions (
                    lat, lon, speed_knots, course, recorded_at
                )
            `)
            .eq('is_strategic', true)
            .order('last_updated', { ascending: false })
            .limit(500);
    },

    async getWeatherAlerts() {
        return supabase
            .from('weather_alerts')
            .select('*')
            .gt('expires', new Date().toISOString())
            .order('severity');
    },

    async getEarthquakes(minMagnitude = 4.0) {
        return supabase
            .from('earthquakes')
            .select('*')
            .gte('magnitude', minMagnitude)
            .gte('occurred_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .order('occurred_at', { ascending: false });
    }
};
```

---

## Data Compression Strategies

### 1. Delta Updates
Only send changed fields instead of full objects:

```typescript
// Server-side
function computeDelta(previous: MarketPrice, current: MarketPrice) {
    const delta: Partial<MarketPrice> = { symbol: current.symbol };
    if (previous.price !== current.price) delta.price = current.price;
    if (previous.change_pct !== current.change_pct) delta.change_pct = current.change_pct;
    return Object.keys(delta).length > 1 ? delta : null;
}
```

### 2. Binary Protocol (MessagePack)
For high-frequency data like vessels:

```typescript
import { encode, decode } from '@msgpack/msgpack';

// Server: ~40% smaller than JSON
const compressed = encode(vesselPositions);

// Client
const positions = decode(compressed);
```

### 3. Geo-Clustering
Aggregate nearby vessels/events:

```sql
-- Cluster vessels by grid cell
SELECT
    ST_SnapToGrid(ST_Point(lon, lat), 0.5) as cell,
    COUNT(*) as vessel_count,
    array_agg(mmsi) as mmsis
FROM vessels
GROUP BY cell;
```

### 4. Time-Based Aggregation
Roll up historical data:

```sql
-- Aggregate hourly market prices
INSERT INTO market_prices_hourly
SELECT
    symbol,
    date_trunc('hour', recorded_at) as hour,
    AVG(price) as avg_price,
    MIN(price) as low,
    MAX(price) as high,
    'hourly' as resolution
FROM market_prices
WHERE recorded_at < NOW() - INTERVAL '1 day'
GROUP BY symbol, date_trunc('hour', recorded_at);
```

---

## Route Architecture

```
/api/v1/
├── /news
│   ├── GET /          → Latest news (paginated)
│   ├── GET /:id       → Single article
│   └── GET /category/:cat → By category
│
├── /markets
│   ├── GET /          → All latest prices
│   ├── GET /crypto    → Crypto only
│   ├── GET /stocks    → Stocks only
│   └── GET /history/:symbol → Historical prices
│
├── /weather
│   ├── GET /alerts    → Active alerts
│   ├── GET /hurricanes → Active cyclones
│   └── GET /radar     → Radar tile metadata
│
├── /vessels
│   ├── GET /          → Strategic vessels (paginated)
│   ├── GET /:mmsi     → Single vessel with track
│   └── WS /stream     → Realtime position updates
│
├── /outages
│   ├── GET /          → Active outages
│   └── GET /grid      → Grid stress by region
│
├── /predictions
│   └── GET /          → Polymarket events
│
└── /monitors
    ├── GET /          → User's monitors
    ├── POST /         → Create monitor
    └── DELETE /:id    → Delete monitor
```

---

## Migration Steps

### Phase 1: Setup (Week 1)
1. Create Supabase project
2. Run schema migrations
3. Set up environment variables
4. Deploy initial Edge Functions

### Phase 2: Parallel Operation (Week 2-3)
1. Deploy Edge Functions for each data source
2. Set up pg_cron schedules
3. Keep client-side fetching as fallback
4. Monitor data quality

### Phase 3: Client Migration (Week 3-4)
1. Add Supabase client to frontend
2. Implement realtime subscriptions
3. Create new API service layer
4. A/B test performance

### Phase 4: Cutover (Week 4-5)
1. Remove client-side API calls
2. Remove Cloudflare Worker (or repurpose)
3. Enable all scheduled jobs
4. Monitor and optimize

---

## Performance Targets

| Metric | Current | Target |
|--------|---------|--------|
| Initial load time | 5-8s | <2s |
| Data freshness | 5 min | 30s (realtime) |
| Client API calls | 30+/cycle | 1 (initial) |
| Bandwidth/client | ~600KB/cycle | ~50KB (delta) |
| Rate limit issues | Frequent | None |

---

## Environment Variables

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Server-side (Edge Functions)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
FINNHUB_API_KEY=...
AIS_STREAM_KEY=...
WATTTIME_USERNAME=...
WATTTIME_PASSWORD=...
WINDY_API_KEY=...
FRED_API_KEY=...
PULSE_API_KEY=...
```

---

## Security Considerations

1. **Row Level Security (RLS)**: Enable on all tables
2. **API Keys**: Store in Supabase secrets, never expose
3. **Rate Limiting**: Use Supabase's built-in rate limiting
4. **Input Validation**: Validate all Edge Function inputs
5. **CORS**: Configure allowed origins in Supabase dashboard

---

## Cost Estimation

| Resource | Estimated Usage | Cost (Pro Plan) |
|----------|----------------|-----------------|
| Database | 5GB | Included |
| Edge Functions | 500k invocations/mo | Included |
| Realtime | 200 concurrent | Included |
| Bandwidth | 50GB/mo | Included |
| **Total** | | ~$25/mo |

---

## Next Steps

1. [ ] Create Supabase project
2. [ ] Run database migrations
3. [ ] Deploy first Edge Function (news)
4. [ ] Test realtime subscriptions
5. [ ] Migrate one data source at a time
6. [ ] Monitor performance and iterate
