import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchRadarAnimationData } from './misc';

describe('fetchRadarAnimationData', () => {
	const originalFetch = global.fetch;

	beforeEach(() => {
		vi.resetAllMocks();
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it('should return all past and nowcast frames with tile URLs', async () => {
		const mockData = {
			version: '2.0',
			generated: 1706000000,
			host: 'https://tilecache.rainviewer.com',
			radar: {
				past: [
					{ time: 1706000000, path: '/v2/radar/1706000000' },
					{ time: 1706000600, path: '/v2/radar/1706000600' }
				],
				nowcast: [{ time: 1706001200, path: '/v2/radar/1706001200' }]
			}
		};

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockData)
		});

		const result = await fetchRadarAnimationData();

		expect(result).not.toBeNull();
		expect(result!.frames).toHaveLength(3);
		expect(result!.frames[0].type).toBe('past');
		expect(result!.frames[1].type).toBe('past');
		expect(result!.frames[2].type).toBe('nowcast');
		expect(result!.frames[0].tileUrl).toContain('256/{z}/{x}/{y}');
		expect(result!.frames[0].timestamp).toBe(1706000000);
		expect(result!.host).toBe('https://tilecache.rainviewer.com');
	});

	it('should return null when API fails', async () => {
		global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

		const result = await fetchRadarAnimationData();

		expect(result).toBeNull();
	});

	it('should return null when no past frames exist', async () => {
		const mockData = {
			version: '2.0',
			generated: 1706000000,
			host: 'https://tilecache.rainviewer.com',
			radar: {
				past: [],
				nowcast: []
			}
		};

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockData)
		});

		const result = await fetchRadarAnimationData();

		expect(result).toBeNull();
	});

	it('should set currentIndex to most recent frame', async () => {
		const mockData = {
			version: '2.0',
			generated: 1706000000,
			host: 'https://tilecache.rainviewer.com',
			radar: {
				past: [
					{ time: 1706000000, path: '/v2/radar/1706000000' },
					{ time: 1706000600, path: '/v2/radar/1706000600' },
					{ time: 1706001200, path: '/v2/radar/1706001200' }
				],
				nowcast: [
					{ time: 1706001800, path: '/v2/radar/1706001800' },
					{ time: 1706002400, path: '/v2/radar/1706002400' }
				]
			}
		};

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockData)
		});

		const result = await fetchRadarAnimationData();

		expect(result).not.toBeNull();
		expect(result!.frames).toHaveLength(5);
		expect(result!.currentIndex).toBe(4); // Last frame index
		expect(result!.isPlaying).toBe(false);
		expect(result!.playbackSpeed).toBe(1);
	});

	it('should build correct tile URLs for each frame', async () => {
		const mockData = {
			version: '2.0',
			generated: 1706000000,
			host: 'https://tilecache.rainviewer.com',
			radar: {
				past: [{ time: 1706000000, path: '/v2/radar/1706000000' }],
				nowcast: [{ time: 1706001200, path: '/v2/radar/nowcast/1706001200' }]
			}
		};

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockData)
		});

		const result = await fetchRadarAnimationData();

		expect(result).not.toBeNull();
		expect(result!.frames[0].tileUrl).toBe(
			'https://tilecache.rainviewer.com/v2/radar/1706000000/256/{z}/{x}/{y}/2/1_0.png'
		);
		expect(result!.frames[1].tileUrl).toBe(
			'https://tilecache.rainviewer.com/v2/radar/nowcast/1706001200/256/{z}/{x}/{y}/2/1_0.png'
		);
	});

	it('should handle network errors gracefully', async () => {
		global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

		const result = await fetchRadarAnimationData();

		expect(result).toBeNull();
	});
});
