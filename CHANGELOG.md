# Changelog - Situation Monitor

## [2.1.0] - 2026-01-28

### Added - Military Ship Detection Advanced Features

#### 1. Threat Level Assessment System
- **Automated threat scoring** (0-100) based on multiple factors
- **Four threat levels:** Extreme (🚨), High (⚠️), Medium (👁️), Low (✅)
- **Scoring factors:**
  - Ship Type (0-30 points) - Carriers and submarines score highest
  - Location (0-25 points) - High-tension areas get priority
  - Proximity (0-25 points) - Distance to strategic hotspots
  - Velocity (0-10 points) - Fast-moving ships flagged
  - Formation (0-10 points) - Ships in strike groups
- **Reasoning output:** Human-readable explanations for each threat score
- Helper functions: `getThreatLevelColor()`, `getThreatLevelEmoji()`

#### 2. Fleet Formation Detection
- **Automatic detection** of ships traveling together (within 100km)
- **Formation types:**
  - 🛫 Carrier Strike Group (carrier + 3+ escorts)
  - ⚓ Naval Task Force (5+ ships)
  - 🚢 Amphibious Task Force (amphibious ship + escorts)
  - 👁️ Patrol Group (3-4 ships)
  - 🚢 Naval Convoy (2 ships)
- **Calculates:**
  - Center point (lat/lon)
  - Radius (max distance from center)
  - Average heading and velocity
  - Auto-generates formation names
- Helper function: `getFormationTypeEmoji()`

#### 3. Predictive Path Analysis
- **Project future positions** based on current trajectory
- Uses **great circle navigation** for accuracy
- **Confidence scoring** (0-1) based on:
  - Historical position data (5+ positions = +0.2)
  - Velocity data availability (+0.15)
  - Heading data availability (+0.15)
- Can predict hours or days ahead
- Returns `null` if insufficient data

#### 4. Historical Data Persistence
- **localStorage integration** for tracking history
- Stores last **50 positions per ship**
- **Auto-cleanup:** Removes data older than 30 days
- Survives browser restarts
- Functions: `saveTrackingHistory()`, `loadTrackingHistory()`, `cleanupTrackingHistory()`

#### 5. Ship Capabilities Database
- Pre-loaded database of **major warships** from 9 navies
- **Specifications include:**
  - Displacement, length, beam
  - Speed (knots), range (nautical miles)
  - Crew size
  - Armament systems and sensors
  - Aircraft capacity (fixed + rotary wing)
  - Commission date
- **Ships included:**
  - US Navy: Gerald R. Ford, Ronald Reagan, Nimitz, Arleigh Burke
  - Chinese Navy: Liaoning, Shandong
  - Royal Navy: Queen Elizabeth, Prince of Wales
  - Russian Navy: Admiral Kuznetsov, Pyotr Velikiy
  - French Navy: Charles de Gaulle
  - Indian Navy: Vikramaditya
  - Japanese MSDF: Izumo, Kaga
- Function: `getShipCapabilities()` with fuzzy matching

### Documentation
- Created `docs/MILITARY_SHIP_FEATURES.md` with:
  - Complete API reference
  - Usage examples for all features
  - Integration examples
  - Visualization tips
  - Performance considerations
  - Future enhancement ideas

### Technical Details
- **TypeScript:** All new types exported
- **Performance:** Optimized algorithms (formation detection O(n²))
- **Testing:** Passes `npm run check`
- **Commit:** 326e1c4

---

## [2.0.0] - 2026-01-27

### Added - Military Ship Detection Base System
- Expanded maritime location patterns (11 → 60+ locations)
- Expanded navy pattern matching (7 → 20 countries)
- Ship movement tracking over time (last 50 positions)
- Proximity alert thresholds (Critical/Warning/Watch)
- Velocity and heading calculations
- Visual movement tracks on map

---

## [1.0.0] - Initial Release
- Basic ship detection from news feeds
- Location extraction
- Ship type classification
- Map visualization
