// src/lib/api/storms.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	fetchActiveTropicalCyclones,
	fetchConvectiveOutlooks,
	fetchAllDay1Outlooks
} from './storms';

describe('fetchActiveTropicalCyclones', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('should fetch and parse active tropical cyclones from NHC', async () => {
		const mockAtlanticGeoJson = {
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature',
					properties: {
						STORMNAME: 'MILTON',
						STORMNUM: 14,
						BASIN: 'AL',
						LAT: 25.5,
						LON: -85.2,
						MAXWIND: 85,
						GUST: 105,
						MSLP: 970,
						STORMTYPE: 'HU',
						DVLBL: 'H1',
						VALIDTIME: '2024-10-08T12:00:00Z',
						DESSION: 'E',
						SSNUM: 4,
						FHOUR: 0
					},
					geometry: {
						type: 'Point',
						coordinates: [-85.2, 25.5]
					}
				}
			]
		};

		const mockEastPacificGeoJson = {
			type: 'FeatureCollection',
			features: [] // No storms in East Pacific
		};

		// Mock fetch to return different data for Atlantic vs East Pacific
		global.fetch = vi.fn().mockImplementation((url: string) => {
			if (url.includes('Atl_trop')) {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve(mockAtlanticGeoJson)
				});
			}
			return Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockEastPacificGeoJson)
			});
		});

		const result = await fetchActiveTropicalCyclones();

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('MILTON');
		expect(result[0].currentIntensity.category).toBe('H1');
		expect(result[0].basin).toBe('AL');
	});

	it('should return empty array when no active storms', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ type: 'FeatureCollection', features: [] })
		});

		const result = await fetchActiveTropicalCyclones();

		expect(result).toEqual([]);
	});

	it('should handle API errors gracefully', async () => {
		global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

		const result = await fetchActiveTropicalCyclones();

		expect(result).toEqual([]);
	});

	it('should group multiple forecast points by storm', async () => {
		const mockAtlanticGeoJson = {
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature',
					properties: {
						STORMNAME: 'HELENE',
						STORMNUM: 9,
						BASIN: 'AL',
						LAT: 26.0,
						LON: -86.0,
						MAXWIND: 65,
						GUST: 80,
						MSLP: 985,
						STORMTYPE: 'TS',
						DVLBL: 'TS',
						VALIDTIME: '2024-10-08T12:00:00Z',
						DESSION: 'N',
						SSNUM: 10,
						FHOUR: 0
					},
					geometry: { type: 'Point', coordinates: [-86.0, 26.0] }
				},
				{
					type: 'Feature',
					properties: {
						STORMNAME: 'HELENE',
						STORMNUM: 9,
						BASIN: 'AL',
						LAT: 27.0,
						LON: -85.5,
						MAXWIND: 75,
						GUST: 90,
						MSLP: 980,
						STORMTYPE: 'HU',
						DVLBL: 'H1',
						VALIDTIME: '2024-10-09T00:00:00Z',
						DESSION: 'N',
						SSNUM: 10,
						FHOUR: 12
					},
					geometry: { type: 'Point', coordinates: [-85.5, 27.0] }
				}
			]
		};

		const mockEmptyGeoJson = { type: 'FeatureCollection', features: [] };

		global.fetch = vi.fn().mockImplementation((url: string) => {
			if (url.includes('Atl_trop')) {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve(mockAtlanticGeoJson)
				});
			}
			return Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockEmptyGeoJson)
			});
		});

		const result = await fetchActiveTropicalCyclones();

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('HELENE');
		expect(result[0].forecastTrack).toHaveLength(2);
		expect(result[0].forecastTrack[0].forecastHour).toBe(0);
		expect(result[0].forecastTrack[1].forecastHour).toBe(12);
	});

	it('should parse all cyclone category types correctly', async () => {
		const testCases = [
			{ stormType: 'TD', dvlbl: 'TD', expected: 'TD' },
			{ stormType: 'TS', dvlbl: 'TS', expected: 'TS' },
			{ stormType: 'HU', dvlbl: 'H1', expected: 'H1' },
			{ stormType: 'HU', dvlbl: 'H2', expected: 'H2' },
			{ stormType: 'HU', dvlbl: 'H3', expected: 'H3' },
			{ stormType: 'HU', dvlbl: 'H4', expected: 'H4' },
			{ stormType: 'HU', dvlbl: 'H5', expected: 'H5' },
			{ stormType: 'EX', dvlbl: 'EX', expected: 'EX' },
			{ stormType: 'SD', dvlbl: 'SD', expected: 'SD' },
			{ stormType: 'SS', dvlbl: 'SS', expected: 'SS' },
			{ stormType: 'PT', dvlbl: 'PT', expected: 'PTC' }
		];

		const mockEmptyGeoJson = { type: 'FeatureCollection', features: [] };

		for (const tc of testCases) {
			const mockGeoJson = {
				type: 'FeatureCollection',
				features: [
					{
						type: 'Feature',
						properties: {
							STORMNAME: 'TEST',
							STORMNUM: 1,
							BASIN: 'AL',
							LAT: 25.0,
							LON: -80.0,
							MAXWIND: 50,
							GUST: null,
							MSLP: null,
							STORMTYPE: tc.stormType,
							DVLBL: tc.dvlbl,
							VALIDTIME: '2024-01-01T00:00:00Z',
							DESSION: 'N',
							SSNUM: 5,
							FHOUR: 0
						},
						geometry: { type: 'Point', coordinates: [-80.0, 25.0] }
					}
				]
			};

			global.fetch = vi.fn().mockImplementation((url: string) => {
				if (url.includes('Atl_trop')) {
					return Promise.resolve({
						ok: true,
						json: () => Promise.resolve(mockGeoJson)
					});
				}
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve(mockEmptyGeoJson)
				});
			});

			const result = await fetchActiveTropicalCyclones();
			expect(result[0].currentIntensity.category).toBe(tc.expected);
		}
	});
});
