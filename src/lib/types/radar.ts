/**
 * Radar animation types for RainViewer integration
 */

/**
 * Radar animation frame from RainViewer
 */
export interface RadarFrame {
	timestamp: number;
	path: string;
	tileUrl: string;
	type: 'past' | 'nowcast';
}

/**
 * Complete radar animation data
 */
export interface RadarAnimationData {
	frames: RadarFrame[];
	currentIndex: number;
	isPlaying: boolean;
	playbackSpeed: number; // frames per second
	host: string;
}

/**
 * Radar animation controls
 */
export interface RadarAnimationControls {
	play: () => void;
	pause: () => void;
	stepForward: () => void;
	stepBackward: () => void;
	goToFrame: (index: number) => void;
	setSpeed: (fps: number) => void;
}
