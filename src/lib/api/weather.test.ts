/**
 * Tests for Weather API functions
 * Tests extractForecastHighlights, generateBriefingText, generateBriefingMarkdown,
 * and parseAlertFeatures functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	extractForecastHighlights,
	generateBriefingText,
	generateBriefingMarkdown,
	parseAlertFeatures
} from './weather';
import type { ForecastPeriod, WeatherAlert, ForecastHighlight } from '$lib/types';

describe('Weather API', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	describe('extractForecastHighlights', () => {
		it('should extract temperature extremes from forecast periods', () => {
			const periods: ForecastPeriod[] = [
				createForecastPeriod({
					number: 1,
					name: 'Tonight',
					isDaytime: false,
					temperature: 15,
					shortForecast: 'Heavy Snow',
					detailedForecast: 'Heavy snow expected. 6 to 10 inches of snow accumulation.',
					probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 80 },
					windSpeed: '15 to 25 mph'
				}),
				createForecastPeriod({
					number: 2,
					name: 'Wednesday',
					isDaytime: true,
					temperature: 22,
					shortForecast: 'Snow Likely',
					detailedForecast: 'Snow likely in the morning.',
					probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 40 },
					windSpeed: '10 to 15 mph'
				})
			];

			const result = extractForecastHighlights('Kansas City', 'zone1', periods);

			expect(result).not.toBeNull();
			expect(result.temperature.low).toBe(15);
			expect(result.temperature.high).toBe(22);
			expect(result.precipitation.type).toBe('snow');
			expect(result.precipitation.chance).toBe(80);
		});

		it('should detect snow accumulation from detailed forecast', () => {
			const periods: ForecastPeriod[] = [
				createForecastPeriod({
					number: 1,
					name: 'Tonight',
					isDaytime: false,
					temperature: 20,
					shortForecast: 'Heavy Snow',
					detailedForecast: 'Heavy snow expected. 6 to 10 inches of snow accumulation.',
					probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 90 }
				})
			];

			const result = extractForecastHighlights('Test Location', 'zone1', periods);

			expect(result.precipitation.accumulation).toBe('6-10 inches');
		});

		it('should detect rain precipitation type', () => {
			const periods: ForecastPeriod[] = [
				createForecastPeriod({
					number: 1,
					name: 'Today',
					isDaytime: true,
					temperature: 55,
					shortForecast: 'Rain',
					detailedForecast: 'Rain likely throughout the day.',
					probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 70 }
				})
			];

			const result = extractForecastHighlights('Test Location', 'zone1', periods);

			expect(result.precipitation.type).toBe('rain');
		});

		it('should detect thunderstorm precipitation type', () => {
			const periods: ForecastPeriod[] = [
				createForecastPeriod({
					number: 1,
					name: 'This Afternoon',
					isDaytime: true,
					temperature: 85,
					shortForecast: 'Thunderstorms',
					detailedForecast: 'Scattered thunderstorms expected.',
					probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 60 }
				})
			];

			const result = extractForecastHighlights('Test Location', 'zone1', periods);

			expect(result.precipitation.type).toBe('thunderstorm');
		});

		it('should detect ice precipitation type', () => {
			const periods: ForecastPeriod[] = [
				createForecastPeriod({
					number: 1,
					name: 'Tonight',
					isDaytime: false,
					temperature: 32,
					shortForecast: 'Freezing Rain',
					detailedForecast: 'Ice accumulation expected.',
					probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 80 }
				})
			];

			const result = extractForecastHighlights('Test Location', 'zone1', periods);

			expect(result.precipitation.type).toBe('ice');
		});

		it('should extract wind gusts from detailed forecast', () => {
			const periods: ForecastPeriod[] = [
				createForecastPeriod({
					number: 1,
					name: 'Today',
					isDaytime: true,
					temperature: 45,
					shortForecast: 'Windy',
					detailedForecast: 'Windy conditions with gusts up to 45 mph.',
					windSpeed: '25 to 35 mph'
				})
			];

			const result = extractForecastHighlights('Test Location', 'zone1', periods);

			expect(result.wind.speed).toBe('25 to 35 mph');
			expect(result.wind.gusts).toBe('45 mph');
		});

		it('should return default highlight with message for empty periods', () => {
			const result = extractForecastHighlights('Test', 'zone1', []);

			expect(result.summary).toBe('No forecast data available');
			expect(result.temperature.high).toBeNull();
			expect(result.temperature.low).toBeNull();
		});

		it('should determine extreme severity for extreme heat', () => {
			const periods: ForecastPeriod[] = [
				createForecastPeriod({
					number: 1,
					name: 'Today',
					isDaytime: true,
					temperature: 110,
					shortForecast: 'Extreme Heat',
					detailedForecast: 'Dangerously hot conditions.'
				})
			];

			const result = extractForecastHighlights('Phoenix', 'zone1', periods);

			expect(result.severity).toBe('extreme');
		});

		it('should determine extreme severity for extreme cold', () => {
			const periods: ForecastPeriod[] = [
				createForecastPeriod({
					number: 1,
					name: 'Tonight',
					isDaytime: false,
					temperature: -15,
					shortForecast: 'Bitter Cold',
					detailedForecast: 'Dangerously cold wind chills.'
				})
			];

			const result = extractForecastHighlights('Minneapolis', 'zone1', periods);

			expect(result.severity).toBe('extreme');
		});

		it('should determine extreme severity for ice conditions', () => {
			const periods: ForecastPeriod[] = [
				createForecastPeriod({
					number: 1,
					name: 'Tonight',
					isDaytime: false,
					temperature: 30,
					shortForecast: 'Freezing Rain',
					detailedForecast: 'Significant ice accumulation expected.',
					probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 90 }
				})
			];

			const result = extractForecastHighlights('Test Location', 'zone1', periods);

			expect(result.severity).toBe('extreme');
		});

		it('should determine high severity for heavy snow with accumulation', () => {
			const periods: ForecastPeriod[] = [
				createForecastPeriod({
					number: 1,
					name: 'Tonight',
					isDaytime: false,
					temperature: 25,
					shortForecast: 'Heavy Snow',
					detailedForecast: '8 to 12 inches of snow expected.',
					probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 95 }
				})
			];

			const result = extractForecastHighlights('Denver', 'zone1', periods);

			expect(result.severity).toBe('high');
		});

		it('should determine moderate severity for moderate conditions', () => {
			const periods: ForecastPeriod[] = [
				createForecastPeriod({
					number: 1,
					name: 'Today',
					isDaytime: true,
					temperature: 98,
					shortForecast: 'Hot',
					detailedForecast: 'Very warm conditions.',
					probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 10 }
				})
			];

			const result = extractForecastHighlights('Dallas', 'zone1', periods);

			expect(result.severity).toBe('moderate');
		});

		it('should determine low severity for normal conditions', () => {
			const periods: ForecastPeriod[] = [
				createForecastPeriod({
					number: 1,
					name: 'Today',
					isDaytime: true,
					temperature: 72,
					shortForecast: 'Sunny',
					detailedForecast: 'Pleasant conditions expected.',
					probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 0 }
				})
			];

			const result = extractForecastHighlights('San Diego', 'zone1', periods);

			expect(result.severity).toBe('low');
		});
	});

	describe('generateBriefingText', () => {
		it('should generate briefing with alerts and forecasts', () => {
			const alerts: WeatherAlert[] = [
				createWeatherAlert({
					id: 'test-1',
					event: 'Winter Storm Warning',
					severity: 'Severe',
					areaDesc: 'Johnson County',
					headline: 'Winter Storm Warning in effect'
				})
			];

			const forecasts: ForecastHighlight[] = [
				{
					location: 'Kansas City',
					zoneId: 'zone1',
					summary: 'Heavy Snow',
					temperature: { high: 22, low: 15 },
					precipitation: { chance: 80, type: 'snow', accumulation: '6-10 inches' },
					wind: { speed: '15-25 mph', gusts: '35 mph' },
					timing: 'Tonight',
					severity: 'high'
				}
			];

			const result = generateBriefingText(alerts, forecasts);

			expect(result).toContain('WEATHER BRIEFING');
			expect(result).toContain('ACTIVE ALERTS');
			expect(result).toContain('Winter Storm Warning');
			expect(result).toContain('Johnson County');
			expect(result).toContain('Severity: Severe');
			expect(result).toContain('Kansas City');
			expect(result).toContain('6-10 inches');
			expect(result).toContain('END BRIEFING');
		});

		it('should show "NO ACTIVE ALERTS" when no alerts provided', () => {
			const result = generateBriefingText([], []);

			expect(result).toContain('WEATHER BRIEFING');
			expect(result).toContain('NO ACTIVE ALERTS');
		});

		it('should group alerts by event type', () => {
			const alerts: WeatherAlert[] = [
				createWeatherAlert({
					id: 'alert-1',
					event: 'Winter Storm Warning',
					severity: 'Severe',
					areaDesc: 'County A'
				}),
				createWeatherAlert({
					id: 'alert-2',
					event: 'Winter Storm Warning',
					severity: 'Moderate',
					areaDesc: 'County B'
				}),
				createWeatherAlert({
					id: 'alert-3',
					event: 'Flood Watch',
					severity: 'Moderate',
					areaDesc: 'County C'
				})
			];

			const result = generateBriefingText(alerts, []);

			expect(result).toContain('Winter Storm Warning (2)');
			expect(result).toContain('Flood Watch (1)');
		});

		it('should include forecast temperature information', () => {
			const forecasts: ForecastHighlight[] = [
				{
					location: 'Test City',
					zoneId: 'zone1',
					summary: 'Partly Cloudy',
					temperature: { high: 75, low: 55 },
					precipitation: { chance: 10, type: null, accumulation: null },
					wind: { speed: '5 mph', gusts: null },
					timing: 'Today',
					severity: 'low'
				}
			];

			const result = generateBriefingText([], forecasts);

			expect(result).toContain('Temperature: High: 75F / Low: 55F');
		});

		it('should include precipitation information when chance > 0', () => {
			const forecasts: ForecastHighlight[] = [
				{
					location: 'Test City',
					zoneId: 'zone1',
					summary: 'Rainy',
					temperature: { high: 60, low: 50 },
					precipitation: { chance: 70, type: 'rain', accumulation: null },
					wind: { speed: '10 mph', gusts: null },
					timing: 'Today',
					severity: 'moderate'
				}
			];

			const result = generateBriefingText([], forecasts);

			expect(result).toContain('Precipitation: 70% (rain)');
		});

		it('should include wind gust information when present', () => {
			const forecasts: ForecastHighlight[] = [
				{
					location: 'Test City',
					zoneId: 'zone1',
					summary: 'Windy',
					temperature: { high: 45, low: 35 },
					precipitation: { chance: 0, type: null, accumulation: null },
					wind: { speed: '25 mph', gusts: '40 mph' },
					timing: 'Today',
					severity: 'moderate'
				}
			];

			const result = generateBriefingText([], forecasts);

			expect(result).toContain('Wind: 25 mph, gusts to 40 mph');
		});
	});

	describe('generateBriefingMarkdown', () => {
		it('should generate markdown briefing with proper formatting', () => {
			const alerts: WeatherAlert[] = [
				createWeatherAlert({
					id: 'test-1',
					event: 'Tornado Warning',
					severity: 'Extreme',
					areaDesc: 'Moore County',
					headline: 'Tornado Warning issued',
					certainty: 'Observed',
					urgency: 'Immediate'
				})
			];

			const forecasts: ForecastHighlight[] = [
				{
					location: 'Oklahoma City',
					zoneId: 'zone1',
					summary: 'Severe Thunderstorms',
					temperature: { high: 85, low: 65 },
					precipitation: { chance: 80, type: 'thunderstorm', accumulation: null },
					wind: { speed: '30 mph', gusts: '60 mph' },
					timing: 'This Afternoon',
					severity: 'extreme'
				}
			];

			const result = generateBriefingMarkdown(alerts, forecasts);

			expect(result).toContain('# Weather Briefing');
			expect(result).toContain('## Active Alerts');
			expect(result).toContain('### Tornado Warning (1)');
			expect(result).toContain('**Moore County**');
			expect(result).toContain('`EXTREME`');
			expect(result).toContain('> Tornado Warning issued');
			expect(result).toContain('**Expires:**');
			expect(result).toContain('**Certainty:** Observed');
			expect(result).toContain('**Urgency:** Immediate');
			expect(result).toContain('## Forecast Highlights');
			expect(result).toContain('### Oklahoma City');
			expect(result).toContain('| Metric | Value |');
		});

		it('should show no active alerts message when empty', () => {
			const result = generateBriefingMarkdown([], []);

			expect(result).toContain('## Active Alerts');
			expect(result).toContain('*No active alerts at this time.*');
		});

		it('should include severity badges', () => {
			const alerts: WeatherAlert[] = [
				createWeatherAlert({ id: '1', event: 'Event A', severity: 'Extreme' }),
				createWeatherAlert({ id: '2', event: 'Event B', severity: 'Severe' }),
				createWeatherAlert({ id: '3', event: 'Event C', severity: 'Moderate' }),
				createWeatherAlert({ id: '4', event: 'Event D', severity: 'Minor' })
			];

			const result = generateBriefingMarkdown(alerts, []);

			expect(result).toContain('`EXTREME`');
			expect(result).toContain('`SEVERE`');
			expect(result).toContain('`MODERATE`');
			expect(result).toContain('`MINOR`');
		});

		it('should include forecast table with temperature', () => {
			const forecasts: ForecastHighlight[] = [
				{
					location: 'Test City',
					zoneId: 'zone1',
					summary: 'Clear',
					temperature: { high: 80, low: 60 },
					precipitation: { chance: 0, type: null, accumulation: null },
					wind: { speed: '5 mph', gusts: null },
					timing: 'Today',
					severity: 'low'
				}
			];

			const result = generateBriefingMarkdown([], forecasts);

			expect(result).toContain('| Temperature | High: 80F / Low: 60F |');
		});
	});

	describe('parseAlertFeatures', () => {
		it('should parse NWS GeoJSON alert features correctly', () => {
			const features = [
				{
					id: 'urn:oid:2.49.0.1.840.0.abc123',
					properties: {
						id: 'urn:oid:2.49.0.1.840.0.abc123',
						areaDesc: 'Johnson County; Wyandotte County',
						geocode: {
							SAME: ['020091'],
							UGC: ['KSZ104']
						},
						affectedZones: ['https://api.weather.gov/zones/forecast/KSZ104'],
						references: [],
						sent: '2024-01-22T10:00:00-06:00',
						effective: '2024-01-22T10:00:00-06:00',
						onset: '2024-01-22T18:00:00-06:00',
						expires: '2024-01-23T06:00:00-06:00',
						ends: '2024-01-23T12:00:00-06:00',
						status: 'Actual' as const,
						messageType: 'Alert' as const,
						category: 'Met',
						severity: 'Severe',
						certainty: 'Likely',
						urgency: 'Expected',
						event: 'Winter Storm Warning',
						sender: 'w-nws.webmaster@noaa.gov',
						senderName: 'NWS Kansas City MO',
						headline: 'Winter Storm Warning in effect',
						description: 'Heavy snow expected.',
						instruction: 'Avoid travel if possible.',
						response: 'Prepare',
						parameters: {}
					},
					geometry: null
				}
			];

			const result = parseAlertFeatures(features);

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('urn:oid:2.49.0.1.840.0.abc123');
			expect(result[0].event).toBe('Winter Storm Warning');
			expect(result[0].severity).toBe('Severe');
			expect(result[0].certainty).toBe('Likely');
			expect(result[0].urgency).toBe('Expected');
			expect(result[0].areaDesc).toBe('Johnson County; Wyandotte County');
			expect(result[0].headline).toBe('Winter Storm Warning in effect');
			expect(result[0].instruction).toBe('Avoid travel if possible.');
			expect(result[0].response).toBe('Prepare');
		});

		it('should handle missing optional fields', () => {
			const features = [
				{
					id: 'test-alert',
					properties: {
						id: 'test-alert',
						areaDesc: 'Test Area',
						geocode: { SAME: [], UGC: [] },
						affectedZones: [],
						references: [],
						sent: '2024-01-22T10:00:00-06:00',
						effective: '2024-01-22T10:00:00-06:00',
						onset: null,
						expires: '2024-01-23T06:00:00-06:00',
						ends: null,
						status: 'Actual' as const,
						messageType: 'Alert' as const,
						category: 'Met',
						severity: 'Moderate',
						certainty: 'Possible',
						urgency: 'Future',
						event: 'Test Event',
						sender: 'test@noaa.gov',
						senderName: 'NWS Test',
						headline: null,
						description: 'Test description.',
						instruction: null,
						response: 'Monitor',
						parameters: {}
					},
					geometry: null
				}
			];

			const result = parseAlertFeatures(features);

			expect(result[0].headline).toBeNull();
			expect(result[0].instruction).toBeNull();
			expect(result[0].onset).toBeNull();
			expect(result[0].ends).toBeNull();
		});

		it('should parse references correctly', () => {
			const features = [
				{
					id: 'update-alert',
					properties: {
						id: 'update-alert',
						areaDesc: 'Test Area',
						geocode: { SAME: [], UGC: [] },
						affectedZones: [],
						references: [
							{
								'@id': 'https://api.weather.gov/alerts/original-alert',
								identifier: 'original-alert',
								sender: 'w-nws.webmaster@noaa.gov',
								sent: '2024-01-22T08:00:00-06:00'
							}
						],
						sent: '2024-01-22T10:00:00-06:00',
						effective: '2024-01-22T10:00:00-06:00',
						onset: null,
						expires: '2024-01-23T06:00:00-06:00',
						ends: null,
						status: 'Actual' as const,
						messageType: 'Update' as const,
						category: 'Met',
						severity: 'Moderate',
						certainty: 'Possible',
						urgency: 'Future',
						event: 'Test Event',
						sender: 'test@noaa.gov',
						senderName: 'NWS Test',
						headline: null,
						description: 'Updated description.',
						instruction: null,
						response: 'Monitor',
						parameters: {}
					},
					geometry: null
				}
			];

			const result = parseAlertFeatures(features);

			expect(result[0].references).toHaveLength(1);
			expect(result[0].references[0].identifier).toBe('original-alert');
			expect(result[0].messageType).toBe('Update');
		});

		it('should return empty array for empty input', () => {
			const result = parseAlertFeatures([]);
			expect(result).toEqual([]);
		});
	});
});

/**
 * Helper to create a ForecastPeriod with sensible defaults
 */
function createForecastPeriod(overrides: Partial<ForecastPeriod> = {}): ForecastPeriod {
	return {
		number: 1,
		name: 'Today',
		startTime: '2024-01-22T06:00:00',
		endTime: '2024-01-22T18:00:00',
		isDaytime: true,
		temperature: 70,
		temperatureUnit: 'F',
		temperatureTrend: null,
		probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 0 },
		dewpoint: { unitCode: 'wmoUnit:degC', value: 10 },
		relativeHumidity: { unitCode: 'wmoUnit:percent', value: 50 },
		windSpeed: '10 mph',
		windDirection: 'N',
		icon: 'https://api.weather.gov/icons/land/day/skc',
		shortForecast: 'Sunny',
		detailedForecast: 'Sunny with a high near 70.',
		...overrides
	};
}

/**
 * Helper to create a WeatherAlert with sensible defaults
 */
function createWeatherAlert(overrides: Partial<WeatherAlert> = {}): WeatherAlert {
	return {
		id: 'test-alert-' + Math.random().toString(36).substring(7),
		areaDesc: 'Test County',
		geocode: { SAME: [], UGC: [] },
		affectedZones: [],
		references: [],
		sent: '2024-01-22T10:00:00-06:00',
		effective: '2024-01-22T10:00:00-06:00',
		onset: null,
		expires: '2024-01-23T06:00:00-06:00',
		ends: null,
		status: 'Actual',
		messageType: 'Alert',
		category: 'Met',
		severity: 'Moderate',
		certainty: 'Likely',
		urgency: 'Expected',
		event: 'Test Event',
		sender: 'test@noaa.gov',
		senderName: 'NWS Test',
		headline: null,
		description: 'Test description.',
		instruction: null,
		response: 'Monitor',
		parameters: {},
		geometry: null,
		...overrides
	};
}
