# Quick Start - Advanced Intelligence Features

## 🎯 Getting Started

You now have 4 powerful intelligence features built into Situation Monitor. Here's how to use them:

---

## 1. Command Palette ⌘K - Your Speed Dial

**Open:** Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux)

### What You Can Do:
- **Navigate anywhere instantly**
  - Type "Taiwan" → Flies to Taiwan on map
  - Type "Ukraine" → Flies to Ukraine
  - Works for all 60+ hotspot locations
  
- **Control views**
  - "Show graph" → Opens network visualization
  - "Scenario" → Opens scenario builder
  - "Refresh" → Force data refresh
  - "Settings" → Opens settings
  
- **Filter data**
  - "Critical only" → Shows only critical signals (80+)
  - "Important" → Shows important+ signals (60+)
  - "Show all" → Disables filtering

### Tips:
- **Fuzzy search works!** Type "tw" to find "Taiwan"
- **Arrow keys** ↑↓ to navigate, **Enter** to execute, **Esc** to close
- **Recent commands** appear at the top (learns what you use)
- Hint always visible in bottom-right corner: `⌘K Command Palette`

---

## 2. Scenario Builder 🎯 - "What If" Analysis

**Open:** 
- Click **SCENARIOS** button in header (top-right)
- Or press `Cmd+K` → type "scenario"

### Pre-loaded Scenarios:
1. **⚔️ China Invades Taiwan**
   - Predicts: Market crash, chip shortage, military intervention
   - Tracks: Naval ship movements, diplomatic activity
   
2. **🌋 Major Earthquake in California**
   - Predicts: Tech sector disruption, infrastructure collapse
   - Tracks: Seismic activity, port operations
   
3. **💣 Iran-Israel Escalation**
   - Predicts: Oil spike ($75 → $180), regional war
   - Tracks: Military activity, missile strikes
   
4. **🦠 H5N1 Pandemic**
   - Predicts: Lockdowns, economic shutdown
   - Tracks: Disease outbreaks, travel restrictions
   
5. **💻 Cyberattack on US Grid**
   - Predicts: Massive blackouts, market paralysis
   - Tracks: Grid stress, cyber incidents

### How to Use:
1. **Browse scenarios** - Click any scenario card
2. **Check triggers** - See which conditions are met (✅ vs ⏳)
3. **View probability** - Shows % likelihood based on triggers
4. **Review impacts** - See predicted effects across:
   - Markets (with specific metrics: S&P 500, oil, etc.)
   - Military (intervention probability)
   - Supply chain (disruption points)
   - Diplomatic (sanctions, responses)
   - Humanitarian (casualties estimates)
5. **Learn from history** - Compare to similar past events
6. **Export** - Download as Markdown for briefings

### Status Indicators:
- **Draft** - Not yet monitoring
- **Active** - Currently tracking triggers
- **Archived** - Historical reference

---

## 3. Signal vs Noise Classifier 🔍 - Smart Filtering

**Automatically running** - Every news item gets scored 0-100

### How It Works:
Each item scored across 6 factors:
1. **Source Credibility** (25%) - Reuters/AP = 90, Twitter = 40
2. **Keyword Match** (20%) - "nuclear", "carrier", "invasion" boost score
3. **Recency** (15%) - <1 hour = 100, >3 days = 25
4. **Geographic Relevance** (10%) - Taiwan, Ukraine, Middle East = high
5. **User Interest** (10%) - Learns from your saves/dismissals
6. **Magnitude** (20%) - Event size/importance

### Classification Levels:
- 🚨 **Critical** (80-100) - Immediate attention
- ⚠️ **Important** (60-79) - High priority
- 👁️ **Relevant** (40-59) - Worth monitoring
- 🔇 **Noise** (0-39) - Can filter out

### To Enable Filtering:
Press `Cmd+K` → then:
- "Critical only" → Shows only 80+ score items
- "Important" → Shows 60+ score items
- "Show all" → Disables filtering

### It Learns From You:
- **Save** an item → Similar content scores higher next time
- **Dismiss** an item → Similar content scores lower
- Thresholds auto-adjust based on your behavior

### Example:
```
Signal Strength: 85/100
Classification: Critical
Reasoning: Reuters, Critical keywords ("carrier"), Taiwan Strait, <1hr old

Factors:
  Source: Reuters (90 × 0.25 = 22.5)
  Keywords: "carrier" detected (95 × 0.20 = 19.0)
  Recency: <1 hour (100 × 0.15 = 15.0)
  Location: Taiwan Strait (90 × 0.10 = 9.0)
  User Interest: High (80 × 0.10 = 8.0)
  Total: 85/100
```

---

## 4. Network Graph 🌐 - Relationship Mapping

**Open:**
- Click **GRAPH** button in header
- Or press `Cmd+K` → type "graph"

### What You See:
An interactive force-directed graph showing relationships between:
- 🔴 **Events** (news stories)
- 🩵 **Ships** (military vessels)
- 🟢 **Locations** (Taiwan, Ukraine, etc.)
- 🟣 **Topics** (Military, Economy, etc.)
- 🔵 **Entities** (Organizations, people)

### How to Use:
- **Hover** over nodes → See details
- **Click** nodes → Select and view properties
- **Watch** the simulation → Related items cluster together
- **Larger nodes** = More important
- **Thicker edges** = Stronger relationships

### What the Graph Reveals:
- **Clusters** - Groups of related events
- **Hubs** - Most-connected nodes (key players/locations)
- **Patterns** - How events, ships, and locations connect

### Example Insights:
```
USS Ronald Reagan (ship) 
  ↔ Taiwan Strait (location)
  ↔ "Carrier deployment" (event)
  ↔ United States (organization)
  ↔ Military (topic)
  
= Shows the carrier is connected to Taiwan tensions
```

### Performance:
- Smoothly handles up to 200 nodes
- Currently shows last 50 news items (can adjust)
- Auto-refreshes on data updates

---

## 💡 Power User Workflows

### Morning Briefing Routine:
1. Press `Cmd+K` → "critical only"
2. Review 5-10 critical signals (ignoring 90% noise)
3. Check active scenarios: `Cmd+K` → "scenario"
4. If any scenario >70% → Export for team briefing
5. Press `Cmd+K` → "show all" to return to normal view

### Crisis Monitoring:
1. See alert about Taiwan
2. Press `Cmd+K` → "Taiwan" (flies map to location)
3. Click **GRAPH** → See all related entities
4. Click **SCENARIOS** → Check "Taiwan Invasion" probability
5. Export scenario → Share with stakeholders

### Research Mode:
1. Open **Network Graph**
2. Hover on interesting nodes
3. Click to see full details
4. Identify clusters of related activity
5. Export graph as JSON for analysis

---

## 📋 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K` / `Ctrl+K` | Open command palette |
| `Cmd+R` | Refresh all data |
| `Cmd+,` | Open settings |
| `↑` `↓` | Navigate command palette |
| `Enter` | Execute command |
| `Esc` | Close command palette |

---

## 🎓 Pro Tips

1. **Learn the Command Palette** - It's your fastest way to do ANYTHING
2. **Filter aggressively** - 90% of news is noise. Focus on the 10% that matters
3. **Activate scenarios for things you care about** - Get probability updates
4. **Use Network Graph for research** - See patterns you'd miss in lists
5. **Export scenarios** - Great for briefing documents/presentations
6. **The classifier learns** - Train it by saving good stuff, dismissing noise

---

## 🚀 Next Steps

- Explore the command palette: `Cmd+K` and try typing different keywords
- Activate a scenario you care about (Taiwan? California earthquake?)
- Filter to "Critical only" and see how much cleaner your feed gets
- Open the network graph and explore connections

**Remember:** Press `Cmd+K` for anything. It's your control center.

---

*For detailed documentation, see:*
- `ADVANCED_FEATURES.md` - Full technical docs
- `MILITARY_SHIP_FEATURES.md` - Ship tracking details
- `CHANGELOG.md` - Version history
