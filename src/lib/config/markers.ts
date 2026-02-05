/**
 * Standardized Marker Design System for MapLibre Globe Panel
 *
 * This configuration provides a unified, consistent visual language for all map markers.
 * Design principles:
 * - Dark-first theme (background #050505)
 * - Tactical/military aesthetic
 * - High contrast and visibility on dark backgrounds
 * - Consistent sizing hierarchy based on importance
 * - Harmonized color palette with clear semantic meaning
 */

// =============================================================================
// COLOR PALETTE
// =============================================================================

/**
 * Primary semantic colors used across the application
 * These are the base colors from which marker colors are derived
 */
export const PALETTE = {
	// Threat/severity colors (warm spectrum)
	critical: '#ef4444', // Red - immediate danger
	high: '#f97316', // Orange - high concern
	elevated: '#eab308', // Yellow/Amber - elevated attention
	low: '#22c55e', // Green - stable/monitoring

	// Infrastructure/category colors (cool spectrum)
	cyan: '#06b6d4', // Maritime, chokepoints, tech
	emerald: '#10b981', // Cables, success states
	blue: '#3b82f6', // Military, aviation
	purple: '#8b5cf6', // Tech news, special

	// Accent colors
	pink: '#ec4899', // Intel
	amber: '#f59e0b', // Government, nuclear warning
	slate: '#94a3b8', // Unknown/default

	// Background/UI colors
	darkBg: 'rgb(15 23 42 / 0.9)',
	stroke: '#ffffff',
	strokeDark: '#1e1b4b'
} as const;

// =============================================================================
// MARKER SIZE SYSTEM
// =============================================================================

/**
 * Standardized marker sizes based on importance hierarchy
 * Each level has base size and glow multiplier for consistent scaling
 */
export const MARKER_SIZES = {
	// Critical/primary markers - largest, most attention-grabbing
	xl: { base: 12, glow: 2.0, stroke: 2.5 },

	// Important infrastructure markers
	lg: { base: 10, glow: 1.8, stroke: 2 },

	// Standard markers
	md: { base: 8, glow: 1.6, stroke: 1.5 },

	// Secondary/supporting markers
	sm: { base: 6, glow: 1.4, stroke: 1 },

	// Small/dense data markers (aircraft, vessels)
	xs: { base: 4, glow: 1.2, stroke: 0.5 }
} as const;

// =============================================================================
// MARKER TYPE CONFIGURATIONS
// =============================================================================

export interface MarkerConfig {
	/** Display name for UI */
	label: string;
	/** Short label for legends */
	shortLabel: string;
	/** Primary color */
	color: string;
	/** Glow/halo color (usually same as color) */
	glowColor: string;
	/** Stroke/border color */
	strokeColor: string;
	/** Size configuration */
	size: typeof MARKER_SIZES[keyof typeof MARKER_SIZES];
	/** Fill opacity (0-1) */
	opacity: number;
	/** Glow opacity (0-1) */
	glowOpacity: number;
	/** Stroke opacity (0-1) */
	strokeOpacity: number;
	/** Visual style hint */
	style: 'filled' | 'outlined' | 'pulsing';
	/** Icon hint for future use */
	icon?: string;
}

/**
 * Comprehensive marker configuration for each marker type
 */
export const MARKER_CONFIGS: Record<string, MarkerConfig> = {
	// -------------------------------------------------------------------------
	// GEOPOLITICAL HOTSPOTS (by threat level)
	// -------------------------------------------------------------------------
	'hotspot-critical': {
		label: 'Critical Hotspot',
		shortLabel: 'Critical',
		color: PALETTE.critical,
		glowColor: PALETTE.critical,
		strokeColor: PALETTE.critical,
		size: MARKER_SIZES.xl,
		opacity: 0.95,
		glowOpacity: 0.35,
		strokeOpacity: 0.6,
		style: 'pulsing',
		icon: 'alert-triangle'
	},
	'hotspot-high': {
		label: 'High Threat Hotspot',
		shortLabel: 'High',
		color: '#ff6b6b', // Lighter red for distinction
		glowColor: '#ff6b6b',
		strokeColor: '#ff6b6b',
		size: MARKER_SIZES.lg,
		opacity: 0.9,
		glowOpacity: 0.3,
		strokeOpacity: 0.5,
		style: 'filled',
		icon: 'alert-circle'
	},
	'hotspot-elevated': {
		label: 'Elevated Hotspot',
		shortLabel: 'Elevated',
		color: PALETTE.elevated,
		glowColor: PALETTE.elevated,
		strokeColor: PALETTE.elevated,
		size: MARKER_SIZES.md,
		opacity: 0.85,
		glowOpacity: 0.25,
		strokeOpacity: 0.4,
		style: 'filled',
		icon: 'eye'
	},
	'hotspot-low': {
		label: 'Monitored Location',
		shortLabel: 'Low',
		color: PALETTE.low,
		glowColor: PALETTE.low,
		strokeColor: PALETTE.low,
		size: MARKER_SIZES.sm,
		opacity: 0.75,
		glowOpacity: 0.2,
		strokeOpacity: 0.3,
		style: 'filled',
		icon: 'radio'
	},

	// -------------------------------------------------------------------------
	// INFRASTRUCTURE
	// -------------------------------------------------------------------------
	chokepoint: {
		label: 'Maritime Chokepoint',
		shortLabel: 'Chokepoint',
		color: PALETTE.cyan,
		glowColor: PALETTE.cyan,
		strokeColor: PALETTE.cyan,
		size: MARKER_SIZES.lg,
		opacity: 0.2, // Hollow/outlined style
		glowOpacity: 0.25,
		strokeOpacity: 1.0,
		style: 'outlined',
		icon: 'anchor'
	},
	cable: {
		label: 'Undersea Cable Landing',
		shortLabel: 'Cable',
		color: PALETTE.emerald,
		glowColor: PALETTE.emerald,
		strokeColor: PALETTE.emerald,
		size: MARKER_SIZES.sm,
		opacity: 0.8,
		glowOpacity: 0.2,
		strokeOpacity: 0.4,
		style: 'filled',
		icon: 'cable'
	},
	nuclear: {
		label: 'Nuclear Facility',
		shortLabel: 'Nuclear',
		color: PALETTE.high, // Orange for nuclear warning
		glowColor: PALETTE.high,
		strokeColor: PALETTE.amber,
		size: MARKER_SIZES.lg,
		opacity: 0.9,
		glowOpacity: 0.3,
		strokeOpacity: 0.9,
		style: 'filled',
		icon: 'radiation'
	},
	military: {
		label: 'Military Installation',
		shortLabel: 'Military',
		color: PALETTE.blue,
		glowColor: PALETTE.blue,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.md,
		opacity: 0.85,
		glowOpacity: 0.2,
		strokeOpacity: 0.6,
		style: 'filled',
		icon: 'shield'
	},

	// -------------------------------------------------------------------------
	// OUTAGES & DISRUPTIONS
	// -------------------------------------------------------------------------
	'outage-total': {
		label: 'Total Outage',
		shortLabel: 'Total',
		color: '#dc2626', // Darker red
		glowColor: '#dc2626',
		strokeColor: PALETTE.strokeDark,
		size: MARKER_SIZES.xl,
		opacity: 0.9,
		glowOpacity: 0.35,
		strokeOpacity: 0.9,
		style: 'pulsing',
		icon: 'zap-off'
	},
	'outage-major': {
		label: 'Major Outage',
		shortLabel: 'Major',
		color: '#ea580c', // Dark orange
		glowColor: '#ea580c',
		strokeColor: PALETTE.strokeDark,
		size: MARKER_SIZES.lg,
		opacity: 0.85,
		glowOpacity: 0.3,
		strokeOpacity: 0.9,
		style: 'filled',
		icon: 'zap'
	},
	'outage-partial': {
		label: 'Partial Outage',
		shortLabel: 'Partial',
		color: '#ca8a04', // Dark yellow
		glowColor: '#ca8a04',
		strokeColor: PALETTE.strokeDark,
		size: MARKER_SIZES.md,
		opacity: 0.8,
		glowOpacity: 0.25,
		strokeOpacity: 0.9,
		style: 'filled',
		icon: 'activity'
	},

	// -------------------------------------------------------------------------
	// NATURAL HAZARDS
	// -------------------------------------------------------------------------
	'volcano-warning': {
		label: 'Volcano Warning',
		shortLabel: 'Warning',
		color: PALETTE.critical,
		glowColor: PALETTE.critical,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.xl,
		opacity: 0.95,
		glowOpacity: 0.35,
		strokeOpacity: 0.7,
		style: 'pulsing',
		icon: 'mountain'
	},
	'volcano-watch': {
		label: 'Volcano Watch',
		shortLabel: 'Watch',
		color: PALETTE.high,
		glowColor: PALETTE.high,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.lg,
		opacity: 0.9,
		glowOpacity: 0.3,
		strokeOpacity: 0.6,
		style: 'filled',
		icon: 'mountain'
	},
	'volcano-advisory': {
		label: 'Volcano Advisory',
		shortLabel: 'Advisory',
		color: PALETTE.elevated,
		glowColor: PALETTE.elevated,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.md,
		opacity: 0.85,
		glowOpacity: 0.25,
		strokeOpacity: 0.5,
		style: 'filled',
		icon: 'mountain'
	},
	'earthquake-major': {
		label: 'Major Earthquake',
		shortLabel: 'Major',
		color: '#dc2626',
		glowColor: '#dc2626',
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.lg,
		opacity: 0.95,
		glowOpacity: 0.3,
		strokeOpacity: 0.6,
		style: 'pulsing',
		icon: 'activity'
	},
	'earthquake-strong': {
		label: 'Strong Earthquake',
		shortLabel: 'Strong',
		color: PALETTE.critical,
		glowColor: PALETTE.critical,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.md,
		opacity: 0.9,
		glowOpacity: 0.25,
		strokeOpacity: 0.5,
		style: 'filled',
		icon: 'activity'
	},
	'earthquake-moderate': {
		label: 'Moderate Earthquake',
		shortLabel: 'Moderate',
		color: PALETTE.high,
		glowColor: PALETTE.high,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.sm,
		opacity: 0.85,
		glowOpacity: 0.2,
		strokeOpacity: 0.4,
		style: 'filled',
		icon: 'activity'
	},
	'earthquake-light': {
		label: 'Light Earthquake',
		shortLabel: 'Light',
		color: PALETTE.elevated,
		glowColor: PALETTE.elevated,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.xs,
		opacity: 0.75,
		glowOpacity: 0.15,
		strokeOpacity: 0.3,
		style: 'filled',
		icon: 'activity'
	},

	// -------------------------------------------------------------------------
	// HEALTH & ENVIRONMENT
	// -------------------------------------------------------------------------
	'radiation-dangerous': {
		label: 'Dangerous Radiation',
		shortLabel: 'Dangerous',
		color: PALETTE.critical,
		glowColor: PALETTE.critical,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.xl,
		opacity: 0.9,
		glowOpacity: 0.35,
		strokeOpacity: 0.6,
		style: 'pulsing',
		icon: 'alert-octagon'
	},
	'radiation-high': {
		label: 'High Radiation',
		shortLabel: 'High',
		color: PALETTE.high,
		glowColor: PALETTE.high,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.lg,
		opacity: 0.85,
		glowOpacity: 0.3,
		strokeOpacity: 0.5,
		style: 'filled',
		icon: 'alert-circle'
	},
	'radiation-elevated': {
		label: 'Elevated Radiation',
		shortLabel: 'Elevated',
		color: PALETTE.elevated,
		glowColor: PALETTE.elevated,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.md,
		opacity: 0.8,
		glowOpacity: 0.25,
		strokeOpacity: 0.4,
		style: 'filled',
		icon: 'info'
	},
	'radiation-normal': {
		label: 'Normal Radiation',
		shortLabel: 'Normal',
		color: PALETTE.low,
		glowColor: PALETTE.low,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.sm,
		opacity: 0.7,
		glowOpacity: 0.15,
		strokeOpacity: 0.3,
		style: 'filled',
		icon: 'check'
	},
	'disease-critical': {
		label: 'Critical Outbreak',
		shortLabel: 'Critical',
		color: PALETTE.critical,
		glowColor: PALETTE.critical,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.xl,
		opacity: 0.9,
		glowOpacity: 0.35,
		strokeOpacity: 0.6,
		style: 'pulsing',
		icon: 'heart-pulse'
	},
	'disease-high': {
		label: 'High Outbreak',
		shortLabel: 'High',
		color: PALETTE.high,
		glowColor: PALETTE.high,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.lg,
		opacity: 0.85,
		glowOpacity: 0.3,
		strokeOpacity: 0.5,
		style: 'filled',
		icon: 'heart-pulse'
	},
	'disease-moderate': {
		label: 'Moderate Outbreak',
		shortLabel: 'Moderate',
		color: PALETTE.elevated,
		glowColor: PALETTE.elevated,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.md,
		opacity: 0.8,
		glowOpacity: 0.25,
		strokeOpacity: 0.4,
		style: 'filled',
		icon: 'heart-pulse'
	},
	'disease-low': {
		label: 'Low Outbreak',
		shortLabel: 'Low',
		color: PALETTE.low,
		glowColor: PALETTE.low,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.sm,
		opacity: 0.7,
		glowOpacity: 0.15,
		strokeOpacity: 0.3,
		style: 'filled',
		icon: 'heart'
	},

	// -------------------------------------------------------------------------
	// TRANSPORTATION
	// -------------------------------------------------------------------------
	'vessel-tanker': {
		label: 'Tanker Vessel',
		shortLabel: 'Tanker',
		color: PALETTE.high, // Orange - hazmat concern
		glowColor: PALETTE.high,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.sm,
		opacity: 0.9,
		glowOpacity: 0.15,
		strokeOpacity: 0.5,
		style: 'filled',
		icon: 'ship'
	},
	'vessel-cargo': {
		label: 'Cargo Vessel',
		shortLabel: 'Cargo',
		color: PALETTE.blue,
		glowColor: PALETTE.blue,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.sm,
		opacity: 0.9,
		glowOpacity: 0.15,
		strokeOpacity: 0.5,
		style: 'filled',
		icon: 'package'
	},
	'vessel-passenger': {
		label: 'Passenger Vessel',
		shortLabel: 'Passenger',
		color: PALETTE.low,
		glowColor: PALETTE.low,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.sm,
		opacity: 0.9,
		glowOpacity: 0.15,
		strokeOpacity: 0.5,
		style: 'filled',
		icon: 'users'
	},
	'vessel-military': {
		label: 'Military Vessel',
		shortLabel: 'Military',
		color: '#6366f1', // Indigo for military
		glowColor: '#6366f1',
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.md,
		opacity: 0.95,
		glowOpacity: 0.25,
		strokeOpacity: 0.6,
		style: 'filled',
		icon: 'shield'
	},
	'vessel-special': {
		label: 'Special Craft',
		shortLabel: 'Special',
		color: PALETTE.cyan,
		glowColor: PALETTE.cyan,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.sm,
		opacity: 0.85,
		glowOpacity: 0.15,
		strokeOpacity: 0.5,
		style: 'filled',
		icon: 'anchor'
	},
	'vessel-fishing': {
		label: 'Fishing Vessel',
		shortLabel: 'Fishing',
		color: '#a855f7', // Purple
		glowColor: '#a855f7',
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.xs,
		opacity: 0.8,
		glowOpacity: 0.1,
		strokeOpacity: 0.4,
		style: 'filled',
		icon: 'fish'
	},
	'vessel-unknown': {
		label: 'Unknown Vessel',
		shortLabel: 'Unknown',
		color: PALETTE.slate,
		glowColor: PALETTE.slate,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.xs,
		opacity: 0.7,
		glowOpacity: 0.1,
		strokeOpacity: 0.3,
		style: 'filled',
		icon: 'help-circle'
	},
	aircraft: {
		label: 'Aircraft',
		shortLabel: 'Aircraft',
		color: PALETTE.blue, // Default, overridden by altitude
		glowColor: PALETTE.blue,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.xs,
		opacity: 0.9,
		glowOpacity: 0.1,
		strokeOpacity: 0.5,
		style: 'filled',
		icon: 'plane'
	},

	// -------------------------------------------------------------------------
	// NEWS & INTELLIGENCE
	// -------------------------------------------------------------------------
	'news-politics': {
		label: 'Politics News',
		shortLabel: 'Politics',
		color: '#ef4444', // Red
		glowColor: '#ef4444',
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.sm,
		opacity: 0.85,
		glowOpacity: 0.3,
		strokeOpacity: 0.5,
		style: 'filled',
		icon: 'landmark'
	},
	'news-tech': {
		label: 'Tech News',
		shortLabel: 'Tech',
		color: PALETTE.purple,
		glowColor: PALETTE.purple,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.sm,
		opacity: 0.85,
		glowOpacity: 0.3,
		strokeOpacity: 0.5,
		style: 'filled',
		icon: 'cpu'
	},
	'news-finance': {
		label: 'Finance News',
		shortLabel: 'Finance',
		color: PALETTE.emerald,
		glowColor: PALETTE.emerald,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.sm,
		opacity: 0.85,
		glowOpacity: 0.3,
		strokeOpacity: 0.5,
		style: 'filled',
		icon: 'trending-up'
	},
	'news-gov': {
		label: 'Government News',
		shortLabel: 'Gov',
		color: PALETTE.amber,
		glowColor: PALETTE.amber,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.sm,
		opacity: 0.85,
		glowOpacity: 0.3,
		strokeOpacity: 0.5,
		style: 'filled',
		icon: 'building'
	},
	'news-ai': {
		label: 'AI News',
		shortLabel: 'AI',
		color: PALETTE.cyan,
		glowColor: PALETTE.cyan,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.sm,
		opacity: 0.85,
		glowOpacity: 0.3,
		strokeOpacity: 0.5,
		style: 'filled',
		icon: 'brain'
	},
	'news-intel': {
		label: 'Intel News',
		shortLabel: 'Intel',
		color: PALETTE.pink,
		glowColor: PALETTE.pink,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.sm,
		opacity: 0.85,
		glowOpacity: 0.3,
		strokeOpacity: 0.5,
		style: 'filled',
		icon: 'eye'
	},
	'news-alert': {
		label: 'Alert',
		shortLabel: 'Alert',
		color: PALETTE.critical,
		glowColor: PALETTE.critical,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.md,
		opacity: 0.95,
		glowOpacity: 0.4,
		strokeOpacity: 0.6,
		style: 'pulsing',
		icon: 'bell'
	},

	// -------------------------------------------------------------------------
	// CUSTOM & SPECIAL
	// -------------------------------------------------------------------------
	monitor: {
		label: 'Custom Monitor',
		shortLabel: 'Monitor',
		color: PALETTE.cyan,
		glowColor: PALETTE.cyan,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.lg,
		opacity: 0.9,
		glowOpacity: 0.25,
		strokeOpacity: 0.7,
		style: 'filled',
		icon: 'search'
	},
	'conflict-critical': {
		label: 'Critical Conflict Zone',
		shortLabel: 'Critical',
		color: '#dc2626',
		glowColor: '#dc2626',
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.xl,
		opacity: 0.9,
		glowOpacity: 0.35,
		strokeOpacity: 0.6,
		style: 'pulsing',
		icon: 'crosshair'
	},
	'conflict-high': {
		label: 'High Conflict Zone',
		shortLabel: 'High',
		color: PALETTE.critical,
		glowColor: PALETTE.critical,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.lg,
		opacity: 0.9,
		glowOpacity: 0.3,
		strokeOpacity: 0.5,
		style: 'filled',
		icon: 'crosshair'
	},
	'conflict-elevated': {
		label: 'Elevated Conflict Zone',
		shortLabel: 'Elevated',
		color: PALETTE.high,
		glowColor: PALETTE.high,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.md,
		opacity: 0.85,
		glowOpacity: 0.25,
		strokeOpacity: 0.4,
		style: 'filled',
		icon: 'crosshair'
	},
	'conflict-low': {
		label: 'Low Conflict Zone',
		shortLabel: 'Low',
		color: PALETTE.elevated,
		glowColor: PALETTE.elevated,
		strokeColor: PALETTE.stroke,
		size: MARKER_SIZES.sm,
		opacity: 0.8,
		glowOpacity: 0.2,
		strokeOpacity: 0.3,
		style: 'filled',
		icon: 'crosshair'
	}
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get marker configuration by type key
 */
export function getMarkerConfig(type: string): MarkerConfig {
	return (
		MARKER_CONFIGS[type] ||
		MARKER_CONFIGS['vessel-unknown'] || {
			label: 'Unknown',
			shortLabel: 'Unknown',
			color: PALETTE.slate,
			glowColor: PALETTE.slate,
			strokeColor: PALETTE.stroke,
			size: MARKER_SIZES.sm,
			opacity: 0.7,
			glowOpacity: 0.15,
			strokeOpacity: 0.3,
			style: 'filled'
		}
	);
}

/**
 * Get hotspot marker config based on threat level
 */
export function getHotspotMarkerConfig(level: 'critical' | 'high' | 'elevated' | 'low'): MarkerConfig {
	return MARKER_CONFIGS[`hotspot-${level}`] || MARKER_CONFIGS['hotspot-low'];
}

/**
 * Get outage marker config based on severity
 */
export function getOutageMarkerConfig(severity: 'total' | 'major' | 'partial'): MarkerConfig {
	return MARKER_CONFIGS[`outage-${severity}`] || MARKER_CONFIGS['outage-partial'];
}

/**
 * Get volcano marker config based on alert level
 */
export function getVolcanoMarkerConfig(alertLevel: string): MarkerConfig {
	if (alertLevel === 'WARNING') return MARKER_CONFIGS['volcano-warning'];
	if (alertLevel === 'WATCH') return MARKER_CONFIGS['volcano-watch'];
	return MARKER_CONFIGS['volcano-advisory'];
}

/**
 * Get earthquake marker config based on magnitude
 */
export function getEarthquakeMarkerConfig(magnitude: number): MarkerConfig {
	if (magnitude >= 7.0) return MARKER_CONFIGS['earthquake-major'];
	if (magnitude >= 6.0) return MARKER_CONFIGS['earthquake-strong'];
	if (magnitude >= 5.0) return MARKER_CONFIGS['earthquake-moderate'];
	return MARKER_CONFIGS['earthquake-light'];
}

/**
 * Get radiation marker config based on level
 */
export function getRadiationMarkerConfig(level: string): MarkerConfig {
	return MARKER_CONFIGS[`radiation-${level}`] || MARKER_CONFIGS['radiation-normal'];
}

/**
 * Get disease marker config based on severity
 */
export function getDiseaseMarkerConfig(severity: string): MarkerConfig {
	return MARKER_CONFIGS[`disease-${severity}`] || MARKER_CONFIGS['disease-low'];
}

/**
 * Get vessel marker config based on ship type code
 */
export function getVesselMarkerConfig(typeCode: number | undefined): MarkerConfig {
	if (!typeCode) return MARKER_CONFIGS['vessel-unknown'];

	// Tankers (80-89)
	if (typeCode >= 80 && typeCode <= 89) return MARKER_CONFIGS['vessel-tanker'];
	// Cargo (70-79)
	if (typeCode >= 70 && typeCode <= 79) return MARKER_CONFIGS['vessel-cargo'];
	// Passenger (60-69)
	if (typeCode >= 60 && typeCode <= 69) return MARKER_CONFIGS['vessel-passenger'];
	// Special craft - SAR, tug, pilot (50-59)
	if (typeCode >= 50 && typeCode <= 59) return MARKER_CONFIGS['vessel-special'];
	// High-speed craft (40-49)
	if (typeCode >= 40 && typeCode <= 49) return MARKER_CONFIGS['vessel-special'];
	// Military (35-39)
	if (typeCode >= 35 && typeCode <= 39) return MARKER_CONFIGS['vessel-military'];
	// Fishing (30)
	if (typeCode === 30) return MARKER_CONFIGS['vessel-fishing'];
	// Law enforcement (55) - already in special range

	return MARKER_CONFIGS['vessel-unknown'];
}

/**
 * Get news marker config based on category
 */
export function getNewsMarkerConfig(category: string, hasAlert: boolean = false): MarkerConfig {
	if (hasAlert) return MARKER_CONFIGS['news-alert'];
	return MARKER_CONFIGS[`news-${category}`] || MARKER_CONFIGS['news-politics'];
}

/**
 * Get conflict marker config based on intensity
 */
export function getConflictMarkerConfig(intensity: string): MarkerConfig {
	return MARKER_CONFIGS[`conflict-${intensity}`] || MARKER_CONFIGS['conflict-low'];
}

// =============================================================================
// ARC CONFIGURATIONS
// =============================================================================

export const ARC_STYLES = {
	threat: {
		color: '#ef4444',
		width: 2,
		glowWidth: 10,
		opacity: 0.8,
		glowOpacity: 0.15
	},
	tension: {
		color: '#fbbf24',
		width: 2,
		glowWidth: 8,
		opacity: 0.7,
		glowOpacity: 0.12
	},
	conflict: {
		color: '#f97316',
		width: 2,
		glowWidth: 8,
		opacity: 0.7,
		glowOpacity: 0.2
	}
} as const;

// =============================================================================
// LEGEND CONFIGURATION
// =============================================================================

export const LEGEND_SECTIONS = {
	threatLevels: {
		title: 'THREAT LEVELS',
		items: [
			{ key: 'critical', label: 'Critical', color: PALETTE.critical },
			{ key: 'high', label: 'High', color: '#ff6b6b' },
			{ key: 'elevated', label: 'Elevated', color: PALETTE.elevated },
			{ key: 'low', label: 'Low', color: PALETTE.low }
		]
	},
	infrastructure: {
		title: 'INFRASTRUCTURE',
		items: [
			{ key: 'chokepoint', label: 'Chokepoint', color: PALETTE.cyan },
			{ key: 'cable', label: 'Cable Landing', color: PALETTE.emerald },
			{ key: 'nuclear', label: 'Nuclear Site', color: PALETTE.high },
			{ key: 'military', label: 'Military Base', color: PALETTE.blue }
		]
	},
	newsFeeds: {
		title: 'NEWS FEEDS',
		items: [
			{ key: 'politics', label: 'Politics', color: '#ef4444' },
			{ key: 'tech', label: 'Tech', color: PALETTE.purple },
			{ key: 'finance', label: 'Finance', color: PALETTE.emerald },
			{ key: 'gov', label: 'Government', color: PALETTE.amber },
			{ key: 'ai', label: 'AI', color: PALETTE.cyan },
			{ key: 'intel', label: 'Intel', color: PALETTE.pink }
		]
	},
	vessels: {
		title: 'VESSELS',
		items: [
			{ key: 'tanker', label: 'Tanker', color: PALETTE.high },
			{ key: 'cargo', label: 'Cargo', color: PALETTE.blue },
			{ key: 'passenger', label: 'Passenger', color: PALETTE.low },
			{ key: 'military', label: 'Military', color: '#6366f1' },
			{ key: 'special', label: 'Special', color: PALETTE.cyan }
		]
	},
	hazards: {
		title: 'NATURAL HAZARDS',
		items: [
			{ key: 'volcano', label: 'Volcano', color: PALETTE.high },
			{ key: 'earthquake', label: 'Earthquake', color: PALETTE.critical },
			{ key: 'outage', label: 'Outage', color: '#ea580c' }
		]
	}
} as const;
