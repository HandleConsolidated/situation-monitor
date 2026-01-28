-- Supabase Backend Migration - Initial Schema
-- This creates all tables needed for the situation monitor data aggregation

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

CREATE INDEX idx_predictions_category ON predictions(category);

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
CREATE INDEX idx_whale_token ON whale_transactions(token);

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

CREATE INDEX idx_outages_severity ON outages(severity);
CREATE INDEX idx_outages_detected ON outages(detected_at DESC);

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
CREATE INDEX idx_radiation_value ON radiation_readings(value DESC);

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

CREATE INDEX idx_outbreaks_disease ON disease_outbreaks(disease);
CREATE INDEX idx_outbreaks_country ON disease_outbreaks(country);

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
CREATE INDEX idx_contracts_agency ON gov_contracts(agency);

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
CREATE INDEX idx_layoffs_company ON layoffs(company);

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

CREATE INDEX idx_leaders_country ON world_leaders(country);

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

CREATE INDEX idx_cyclones_basin ON tropical_cyclones(basin);
CREATE INDEX idx_cyclones_category ON tropical_cyclones(category);

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

CREATE INDEX idx_outlooks_day ON convective_outlooks(day);
CREATE INDEX idx_outlooks_risk ON convective_outlooks(risk);

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

CREATE INDEX idx_conflicts_country ON conflicts(country);
CREATE INDEX idx_conflicts_intensity ON conflicts(intensity);

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

-- Apply update trigger to all tables (except sync_status)
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

-- Helper functions for sync status
CREATE OR REPLACE FUNCTION increment_run_count(fn_name TEXT)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE sync_status SET run_count = run_count + 1
  WHERE function_name = fn_name
  RETURNING run_count INTO new_count;
  RETURN COALESCE(new_count, 1);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_error_count(fn_name TEXT)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE sync_status SET error_count = error_count + 1
  WHERE function_name = fn_name
  RETURNING error_count INTO new_count;
  RETURN COALESCE(new_count, 1);
END;
$$ LANGUAGE plpgsql;
