<script lang="ts">
	import { Panel } from '$lib/components/common';
	import { onMount } from 'svelte';

	interface DiplomaticEvent {
		id: string;
		type: 'un-meeting' | 'state-visit' | 'treaty' | 'summit' | 'crisis-talks' | 'sanctions';
		title: string;
		description: string;
		participants: string[];
		location: string;
		country: string;
		date: string;
		status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
		importance: 'critical' | 'high' | 'medium' | 'low';
		outcome?: string;
	}

	let events = $state<DiplomaticEvent[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let lastUpdated = $state<Date | null>(null);

	const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

	async function fetchEvents() {
		loading = true;
		error = null;

		try {
			// TODO: Integrate with diplomatic activity feeds
			// Sources: UN meeting schedules, state.gov, diplomatic cables, news
			events = generateMockEvents();
			lastUpdated = new Date();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to fetch diplomatic activity';
		} finally {
			loading = false;
		}
	}

	function generateMockEvents(): DiplomaticEvent[] {
		return [
			{
				id: 'dip-001',
				type: 'un-meeting',
				title: 'UN Security Council Emergency Session',
				description: 'Emergency meeting on regional conflict escalation',
				participants: ['US', 'China', 'Russia', 'UK', 'France'],
				location: 'New York',
				country: 'United States',
				date: new Date().toISOString(),
				status: 'ongoing',
				importance: 'critical'
			},
			{
				id: 'dip-002',
				type: 'state-visit',
				title: 'Presidential State Visit',
				description: 'Bilateral trade and security discussions',
				participants: ['United States', 'India'],
				location: 'New Delhi',
				country: 'India',
				date: new Date(Date.now() + 86400000 * 3).toISOString(),
				status: 'scheduled',
				importance: 'high'
			},
			{
				id: 'dip-003',
				type: 'treaty',
				title: 'Climate Accord Negotiations',
				description: 'Multi-lateral climate agreement discussions',
				participants: ['EU', 'US', 'China', 'India', 'Brazil'],
				location: 'Geneva',
				country: 'Switzerland',
				date: new Date(Date.now() + 86400000 * 7).toISOString(),
				status: 'scheduled',
				importance: 'high'
			}
		];
	}

	onMount(() => {
		fetchEvents();
		const interval = setInterval(fetchEvents, REFRESH_INTERVAL);
		return () => clearInterval(interval);
	});

	const upcomingEvents = $derived(events.filter(e => e.status === 'scheduled' || e.status === 'ongoing'));
	const criticalCount = $derived(events.filter(e => e.importance === 'critical').length);

	function getTypeIcon(type: string): string {
		switch (type) {
			case 'un-meeting': return '🏛️';
			case 'state-visit': return '🤝';
			case 'treaty': return '📜';
			case 'summit': return '🌐';
			case 'crisis-talks': return '⚠️';
			case 'sanctions': return '🚫';
			default: return '📍';
		}
	}

	function getImportanceColor(importance: string): string {
		switch (importance) {
			case 'critical': return '#dc2626';
			case 'high': return '#f97316';
			case 'medium': return '#eab308';
			case 'low': return '#10b981';
			default: return '#6b7280';
		}
	}

	function formatDate(dateStr: string): string {
		try {
			const date = new Date(dateStr);
			const now = new Date();
			const diffMs = date.getTime() - now.getTime();
			const diffDays = Math.floor(diffMs / 86400000);
			
			if (diffDays < 0) return 'Completed';
			if (diffDays === 0) return 'Today';
			if (diffDays === 1) return 'Tomorrow';
			if (diffDays < 7) return `In ${diffDays} days`;
			return date.toLocaleDateString();
		} catch {
			return '--';
		}
	}

	function formatType(type: string): string {
		return type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
	}
</script>

<Panel 
	id="diplomatic-activity" 
	title="Diplomatic Activity" 
	count={criticalCount > 0 ? criticalCount : null}
	{loading} 
	{error}
>
	{#if events.length === 0 && !loading}
		<div class="no-events">
			<div class="icon">🕊️</div>
			<div class="message">No major diplomatic activity</div>
		</div>
	{:else}
		<div class="events-content">
			<!-- Upcoming Highlights -->
			{#if upcomingEvents.length > 0}
				<div class="upcoming-banner">
					<span class="banner-icon">📅</span>
					<span class="banner-text">
						{upcomingEvents.length} upcoming event{upcomingEvents.length > 1 ? 's' : ''}
					</span>
				</div>
			{/if}

			<!-- Events List -->
			<div class="events-list">
				{#each events.slice(0, 10) as event}
					<button
						class="event-item {event.importance}"
						style="border-left-color: {getImportanceColor(event.importance)}"
					>
						<div class="event-header">
							<span class="event-icon">{getTypeIcon(event.type)}</span>
							<div class="event-info">
								<div class="event-title">{event.title}</div>
								<div class="event-type">{formatType(event.type)}</div>
							</div>
							<div class="event-status {event.status}">
								{event.status.toUpperCase()}
							</div>
						</div>
						
						<div class="event-description">{event.description}</div>
						
						<div class="event-details">
							<div class="detail-item">
								<span class="detail-label">📍</span>
								<span class="detail-value">{event.location}</span>
							</div>
							<div class="detail-item">
								<span class="detail-label">📅</span>
								<span class="detail-value">{formatDate(event.date)}</span>
							</div>
						</div>

						<div class="participants">
							{#each event.participants as participant}
								<span class="participant-tag">{participant}</span>
							{/each}
						</div>

						{#if event.outcome}
							<div class="outcome">
								<span class="outcome-label">Outcome:</span>
								<span class="outcome-text">{event.outcome}</span>
							</div>
						{/if}
					</button>
				{/each}
			</div>

			{#if lastUpdated}
				<div class="footer-info">
					Updated {lastUpdated.toLocaleTimeString()}
				</div>
			{/if}
		</div>
	{/if}
</Panel>

<style>
	.no-events {
		padding: 3rem 1rem;
		text-align: center;
		color: var(--text-secondary);
	}

	.no-events .icon {
		font-size: 3rem;
		margin-bottom: 1rem;
		opacity: 0.5;
	}

	.no-events .message {
		font-size: 0.875rem;
	}

	.events-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.upcoming-banner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: rgba(59, 130, 246, 0.15);
		border: 1px solid rgba(59, 130, 246, 0.3);
		border-radius: 4px;
	}

	.banner-icon {
		font-size: 1.25rem;
	}

	.banner-text {
		font-size: 0.875rem;
		font-weight: 600;
		color: #60a5fa;
	}

	.events-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.event-item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-left: 3px solid;
		border-radius: 4px;
		background: rgba(0, 0, 0, 0.2);
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: left;
		color: inherit;
		font-family: inherit;
	}

	.event-item:hover {
		background: rgba(255, 255, 255, 0.05);
		transform: translateX(2px);
	}

	.event-header {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.event-icon {
		font-size: 1.25rem;
		flex-shrink: 0;
	}

	.event-info {
		flex: 1;
		min-width: 0;
	}

	.event-title {
		font-weight: 600;
		font-size: 0.875rem;
		margin-bottom: 0.125rem;
	}

	.event-type {
		font-size: 0.75rem;
		opacity: 0.7;
		text-transform: uppercase;
	}

	.event-status {
		padding: 0.25rem 0.5rem;
		border-radius: 3px;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.event-status.scheduled {
		background: rgba(59, 130, 246, 0.2);
		border: 1px solid rgba(59, 130, 246, 0.4);
		color: #60a5fa;
	}

	.event-status.ongoing {
		background: rgba(249, 115, 22, 0.2);
		border: 1px solid rgba(249, 115, 22, 0.4);
		color: #fb923c;
	}

	.event-status.completed {
		background: rgba(16, 185, 129, 0.2);
		border: 1px solid rgba(16, 185, 129, 0.4);
		color: #34d399;
	}

	.event-description {
		font-size: 0.75rem;
		opacity: 0.8;
		line-height: 1.4;
	}

	.event-details {
		display: flex;
		gap: 1rem;
		font-size: 0.7rem;
		opacity: 0.7;
	}

	.detail-item {
		display: flex;
		gap: 0.375rem;
		align-items: center;
	}

	.detail-value {
		font-family: var(--font-mono);
	}

	.participants {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.participant-tag {
		display: inline-block;
		padding: 0.125rem 0.5rem;
		background: rgba(147, 51, 234, 0.15);
		border: 1px solid rgba(147, 51, 234, 0.3);
		border-radius: 3px;
		font-size: 0.7rem;
		color: #a78bfa;
	}

	.outcome {
		padding: 0.5rem;
		background: rgba(16, 185, 129, 0.1);
		border: 1px solid rgba(16, 185, 129, 0.2);
		border-radius: 3px;
		font-size: 0.75rem;
	}

	.outcome-label {
		font-weight: 600;
		color: #34d399;
		margin-right: 0.5rem;
	}

	.outcome-text {
		opacity: 0.9;
	}

	.footer-info {
		padding-top: 0.5rem;
		text-align: center;
		font-size: 0.75rem;
		opacity: 0.5;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}
</style>
