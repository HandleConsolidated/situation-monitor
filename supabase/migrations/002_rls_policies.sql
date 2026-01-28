-- Row Level Security Policies
-- All tables have public read access, write access only via service role

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

-- Note: Service role key bypasses RLS automatically
-- No explicit write policies needed for edge functions using service role
