# Military Ship Detection - Advanced Features

## Overview
The military ship detection system now includes advanced analytics for threat assessment, fleet formation detection, predictive path analysis, and historical data persistence.

## New Features

### 1. Threat Level Assessment System
Automatically calculates threat scores (0-100) based on multiple factors:

**Threat Factors:**
- **Ship Type** (0-30 points) - Carriers and submarines score highest
- **Location** (0-25 points) - Operating in high-tension areas
- **Proximity** (0-25 points) - Distance to strategic hotspots
- **Velocity** (0-10 points) - Speed of movement
- **Formation** (0-10 points) - Part of a strike group

**Threat Levels:**
- 🚨 **EXTREME** (75-100) - Immediate concern, requires monitoring
- ⚠️ **HIGH** (50-74) - Elevated threat, watch closely
- 👁️ **MEDIUM** (25-49) - Monitor situation
- ✅ **LOW** (0-24) - Routine operations

**Usage:**
```typescript
import { assessThreat } from '$lib/utils/military-ship-detection';

const threatAssessment = assessThreat(ship, hotspots);

console.log(`${threatAssessment.threatLevel} - Score: ${threatAssessment.threatScore}`);
console.log('Reasoning:', threatAssessment.reasoning);
```

**Example Output:**
```
HIGH - Score: 73
Reasoning: [
  "Aircraft carrier - strategic asset",
  "Operating in high-tension area: Taiwan Strait",
  "Critical proximity: 45km from Taiwan Strait",
  "High speed: 32 km/h"
]
```

---

### 2. Fleet Formation Detection
Automatically identifies groups of ships traveling together.

**Formation Types:**
- 🛫 **Carrier Strike Group** - Carrier + 3+ escorts
- ⚓ **Naval Task Force** - 5+ ships in formation
- 🚢 **Amphibious Task Force** - Amphibious ship + escorts
- 👁️ **Patrol Group** - 3-4 ships together
- 🚢 **Naval Convoy** - 2 ships in close proximity

**Detection Algorithm:**
- Groups ships by country
- Ships within 100km considered a formation
- Calculates center point, radius, avg heading/velocity
- Automatically names formations

**Usage:**
```typescript
import { detectFormations } from '$lib/utils/military-ship-detection';

const formations = detectFormations(ships);

formations.forEach(formation => {
  console.log(`${formation.name}`);
  console.log(`  Type: ${formation.formationType}`);
  console.log(`  Ships: ${formation.ships.length}`);
  console.log(`  Radius: ${Math.round(formation.radius)}km`);
  console.log(`  Heading: ${formation.heading?.toFixed(0)}°`);
  console.log(`  Speed: ${formation.velocity?.toFixed(1)} km/h`);
});
```

**Example Output:**
```
US Carrier Strike Group
  Type: carrier_group
  Ships: 5
  Radius: 35km
  Heading: 045°
  Speed: 28.5 km/h
```

---

### 3. Predictive Path Analysis
Project future ship positions based on current trajectory.

**Features:**
- Uses great circle navigation for accuracy
- Calculates confidence level (0-1) based on data quality
- Can predict hours or days ahead
- Factors in heading and velocity

**Confidence Calculation:**
- Base: 0.5
- +0.2 if 5+ historical positions
- +0.1 if 3+ historical positions
- +0.15 if velocity data available
- +0.15 if heading data available

**Usage:**
```typescript
import { predictPosition } from '$lib/utils/military-ship-detection';

// Predict position 24 hours from now
const prediction = predictPosition(ship, 24);

if (prediction) {
  console.log(`Predicted position in 24h:`);
  console.log(`  Lat: ${prediction.lat.toFixed(4)}°`);
  console.log(`  Lon: ${prediction.lon.toFixed(4)}°`);
  console.log(`  Confidence: ${(prediction.confidence * 100).toFixed(0)}%`);
  console.log(`  Time: ${prediction.timestamp}`);
}
```

**Example Output:**
```
Predicted position in 24h:
  Lat: 25.4523°
  Lon: 121.8932°
  Confidence: 85%
  Time: 2026-01-29T16:00:00.000Z
```

---

### 4. Historical Data Persistence
Ship tracking history is automatically saved to localStorage and survives page refreshes.

**Features:**
- Stores last 50 positions per ship
- Auto-cleanup of data older than 30 days
- Survives browser restarts
- Efficient JSON serialization

**Usage:**
```typescript
import { 
  saveTrackingHistory, 
  loadTrackingHistory, 
  cleanupTrackingHistory 
} from '$lib/utils/military-ship-detection';

// Load history on app startup
loadTrackingHistory();

// Cleanup old data periodically
setInterval(() => {
  cleanupTrackingHistory();
  saveTrackingHistory();
}, 24 * 60 * 60 * 1000); // Daily
```

**Data Structure:**
```json
{
  "US-USS-Ronald-Reagan": [
    {
      "lat": 13.45,
      "lon": 144.75,
      "location": "Guam",
      "timestamp": "2026-01-27T10:00:00Z",
      "source": "https://news.com/article"
    },
    {
      "lat": 15.2,
      "lon": 145.8,
      "location": "Philippine Sea",
      "timestamp": "2026-01-28T08:00:00Z",
      "source": "https://news.com/article2"
    }
  ]
}
```

---

### 5. Ship Capabilities Database
Pre-loaded database of major warships with detailed specifications.

**Included Ships:**
- **US Navy:** Gerald R. Ford, Ronald Reagan, Nimitz, Arleigh Burke
- **Chinese Navy:** Liaoning, Shandong
- **Royal Navy:** Queen Elizabeth, Prince of Wales
- **Russian Navy:** Admiral Kuznetsov, Pyotr Velikiy
- **French Navy:** Charles de Gaulle
- **Indian Navy:** Vikramaditya
- **Japanese MSDF:** Izumo, Kaga

**Capabilities Data:**
- Displacement (tons)
- Length, beam (meters)
- Speed (knots), range (nautical miles)
- Crew size
- Armament systems
- Sensors and radars
- Aircraft capacity (fixed + rotary wing)
- Commission date

**Usage:**
```typescript
import { getShipCapabilities } from '$lib/utils/military-ship-detection';

const capabilities = getShipCapabilities('USS Ronald Reagan');

if (capabilities) {
  console.log(`Displacement: ${capabilities.displacement} tons`);
  console.log(`Length: ${capabilities.length}m`);
  console.log(`Speed: ${capabilities.speed} knots`);
  console.log(`Aircraft: ${capabilities.aircraft?.fixed} fixed-wing`);
  console.log(`Armament:`, capabilities.armament);
}
```

**Example Output:**
```
Displacement: 97000 tons
Length: 333m
Speed: 30 knots
Aircraft: 90 fixed-wing
Armament: ['RIM-162 ESSM', 'RIM-116 RAM']
```

---

## Complete Integration Example

```typescript
import { 
  detectMilitaryShipsWithTracking,
  assessThreat,
  detectFormations,
  predictPosition,
  getShipCapabilities,
  loadTrackingHistory,
  saveTrackingHistory,
  getThreatLevelColor,
  getThreatLevelEmoji,
  getFormationTypeEmoji
} from '$lib/utils/military-ship-detection';

// Load persisted tracking data
loadTrackingHistory();

// Detect ships from news feeds
const ships = detectMilitaryShipsWithTracking(newsItems);

// Assess threats
const hotspots = [
  { name: 'Taiwan Strait', lat: 25.0, lon: 120.0 },
  { name: 'South China Sea', lat: 12.0, lon: 114.0 }
];

const threats = ships.map(ship => assessThreat(ship, hotspots));

// Filter high-priority threats
const highThreats = threats.filter(t => 
  t.threatLevel === 'extreme' || t.threatLevel === 'high'
);

console.log(`⚠️ High-Priority Threats: ${highThreats.length}`);

// Detect formations
const formations = detectFormations(ships);

console.log(`🛫 Detected Formations: ${formations.length}`);

formations.forEach(formation => {
  console.log(`${getFormationTypeEmoji(formation.formationType)} ${formation.name}`);
});

// Predict positions
ships.forEach(ship => {
  const prediction24h = predictPosition(ship, 24);
  
  if (prediction24h && prediction24h.confidence > 0.7) {
    console.log(`📍 ${ship.name} predicted at ${prediction24h.lat.toFixed(2)}, ${prediction24h.lon.toFixed(2)} in 24h`);
  }
  
  // Get ship capabilities
  const capabilities = getShipCapabilities(ship.name);
  if (capabilities) {
    console.log(`  ⚓ ${capabilities.displacement} tons, ${capabilities.speed} knots`);
  }
});

// Save updated tracking data
saveTrackingHistory();
```

---

## Visualization Tips

### Map Markers
Use threat level colors for ship markers:
```typescript
const markerColor = getThreatLevelColor(threatAssessment.threatLevel);
```

### Formation Display
Draw circles around formations:
```typescript
formations.forEach(formation => {
  drawCircle(formation.centerLat, formation.centerLon, formation.radius, {
    color: getCountryColor(formation.country),
    opacity: 0.3
  });
});
```

### Predicted Paths
Draw dashed lines from current to predicted position:
```typescript
const prediction = predictPosition(ship, 24);
if (prediction) {
  drawDashedLine(
    [ship.lat, ship.lon],
    [prediction.lat, prediction.lon],
    { opacity: prediction.confidence }
  );
}
```

---

## Performance Considerations

- **Formation Detection:** O(n²) complexity - consider running periodically, not on every update
- **Threat Assessment:** O(n×m) where m = hotspots - lightweight, run frequently
- **localStorage:** Limited to ~5MB - cleanup old data regularly
- **Prediction:** Very fast, can run on every ship update

---

## Future Enhancements

Potential additions:
- 🔮 Multi-step prediction (predict 3, 6, 12, 24 hours)
- 🎯 Collision detection between predicted paths
- 📊 Historical trend analysis (ship activity over weeks/months)
- 🌐 Integration with real AIS transponder data
- 🤖 Natural language queries ("Show US carriers near Taiwan")
- 📧 Email/SMS alerts for critical threats
- 📈 Threat timeline visualization
- 🗺️ Restricted zone alerts (e.g., territorial waters)

---

## API Reference

### Main Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `detectMilitaryShipsWithTracking()` | Detect ships from news + update tracking | `DetectedMilitaryShip[]` |
| `assessThreat()` | Calculate threat score for a ship | `ThreatAssessment` |
| `detectFormations()` | Find groups of ships | `ShipFormation[]` |
| `predictPosition()` | Project future position | `PredictedPosition \| null` |
| `getShipCapabilities()` | Lookup ship specs | `ShipCapabilities \| null` |
| `checkProximityAlerts()` | Find ships near hotspots | `ProximityAlert[]` |
| `saveTrackingHistory()` | Persist data to localStorage | `void` |
| `loadTrackingHistory()` | Load data from localStorage | `void` |
| `cleanupTrackingHistory()` | Remove old data (30+ days) | `void` |

### Helper Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `getThreatLevelColor()` | Get color for threat level | `string` (hex) |
| `getThreatLevelEmoji()` | Get emoji for threat level | `string` |
| `getFormationTypeEmoji()` | Get emoji for formation type | `string` |
| `getShipTypeColor()` | Get color for ship type | `string` (hex) |
| `getShipTypeIcon()` | Get icon for ship type | `string` |
| `getProximityAlertColor()` | Get color for proximity alert | `string` (hex) |
| `formatProximityAlert()` | Format alert message | `string` |

---

## Testing

```bash
# Run TypeScript type checking
npm run check

# Run unit tests (if available)
npm test

# Build for production
npm run build
```

---

## Notes

- All coordinates use WGS84 datum (standard GPS)
- Distances calculated using Haversine formula (great circle)
- Headings in degrees (0-360°, 0 = North, 90 = East)
- Velocity in km/h (convert to knots: × 0.539957)
- Timestamps in ISO 8601 format (UTC)
