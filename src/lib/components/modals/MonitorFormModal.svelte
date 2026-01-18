<script lang="ts">
	import Modal from './Modal.svelte';
	import { monitors } from '$lib/stores';
	import type { CustomMonitor } from '$lib/types';

	interface Props {
		open: boolean;
		onClose: () => void;
		editMonitor?: CustomMonitor | null;
	}

	let { open = false, onClose, editMonitor = null }: Props = $props();

	let name = $state('');
	let keywords = $state('');
	let enabled = $state(true);
	let color = $state('#06b6d4');
	let locationName = $state('');
	let locationLat = $state('');
	let locationLon = $state('');
	let error = $state('');

	// Preset colors for quick selection
	const PRESET_COLORS = [
		'#06b6d4', // cyan
		'#ef4444', // red
		'#f59e0b', // amber
		'#10b981', // emerald
		'#8b5cf6', // purple
		'#ec4899', // pink
		'#3b82f6', // blue
		'#f97316'  // orange
	];

	// Reset form when modal opens
	$effect(() => {
		if (open) {
			if (editMonitor) {
				name = editMonitor.name;
				keywords = editMonitor.keywords.join(', ');
				enabled = editMonitor.enabled;
				color = editMonitor.color || '#06b6d4';
				locationName = editMonitor.location?.name || '';
				locationLat = editMonitor.location?.lat?.toString() || '';
				locationLon = editMonitor.location?.lon?.toString() || '';
			} else {
				name = '';
				keywords = '';
				enabled = true;
				color = '#06b6d4';
				locationName = '';
				locationLat = '';
				locationLon = '';
			}
			error = '';
		}
	});

	function handleSubmit(e: Event) {
		e.preventDefault();

		const trimmedName = name.trim();
		const keywordList = keywords
			.split(',')
			.map((k) => k.trim().toLowerCase())
			.filter((k) => k.length > 0);

		if (!trimmedName) {
			error = 'Name is required';
			return;
		}

		if (keywordList.length === 0) {
			error = 'At least one keyword is required';
			return;
		}

		// Validate location if partially filled
		const hasLat = locationLat.trim().length > 0;
		const hasLon = locationLon.trim().length > 0;

		if ((hasLat || hasLon) && !(hasLat && hasLon)) {
			error = 'Both latitude and longitude are required for location';
			return;
		}

		const lat = parseFloat(locationLat);
		const lon = parseFloat(locationLon);

		if (hasLat && hasLon) {
			if (isNaN(lat) || lat < -90 || lat > 90) {
				error = 'Latitude must be between -90 and 90';
				return;
			}
			if (isNaN(lon) || lon < -180 || lon > 180) {
				error = 'Longitude must be between -180 and 180';
				return;
			}
		}

		// Build location object if coordinates provided
		const location = (hasLat && hasLon) ? {
			name: locationName.trim() || trimmedName,
			lat,
			lon
		} : undefined;

		if (editMonitor) {
			// Update existing monitor
			monitors.updateMonitor(editMonitor.id, {
				name: trimmedName,
				keywords: keywordList,
				enabled,
				color,
				location
			});
		} else {
			// Create new monitor
			const result = monitors.addMonitor({
				name: trimmedName,
				keywords: keywordList,
				enabled,
				color,
				location
			});

			if (!result) {
				error = 'Maximum number of monitors reached (20)';
				return;
			}
		}

		onClose();
	}

	function handleDelete() {
		if (editMonitor) {
			monitors.deleteMonitor(editMonitor.id);
			onClose();
		}
	}
</script>

<Modal {open} title={editMonitor ? 'Edit Monitor' : 'Create Monitor'} {onClose}>
	<form class="monitor-form" onsubmit={handleSubmit}>
		{#if error}
			<div class="form-error">{error}</div>
		{/if}

		<div class="form-group">
			<label for="monitor-name">Name</label>
			<input
				id="monitor-name"
				type="text"
				bind:value={name}
				placeholder="e.g., Ukraine Crisis"
				maxlength="50"
			/>
		</div>

		<div class="form-group">
			<label for="monitor-keywords">Keywords (comma separated)</label>
			<input
				id="monitor-keywords"
				type="text"
				bind:value={keywords}
				placeholder="e.g., ukraine, zelensky, kyiv"
			/>
			<p class="form-hint">News matching any of these keywords will appear in your monitor</p>
		</div>

		<div class="form-group">
			<label>Color</label>
			<div class="color-picker">
				{#each PRESET_COLORS as presetColor}
					<button
						type="button"
						class="color-swatch"
						class:selected={color === presetColor}
						style="background: {presetColor}; box-shadow: 0 0 8px {presetColor}"
						onclick={() => color = presetColor}
						aria-label="Select color {presetColor}"
					></button>
				{/each}
				<input
					type="color"
					class="color-input"
					bind:value={color}
					title="Custom color"
				/>
			</div>
		</div>

		<div class="form-group location-group">
			<label>Map Location <span class="optional">(optional - for map marker)</span></label>
			<div class="location-inputs">
				<input
					type="text"
					bind:value={locationName}
					placeholder="Location name (e.g., Kyiv)"
					class="location-name-input"
				/>
				<div class="coords-row">
					<input
						type="text"
						bind:value={locationLat}
						placeholder="Latitude"
						class="coord-input"
					/>
					<input
						type="text"
						bind:value={locationLon}
						placeholder="Longitude"
						class="coord-input"
					/>
				</div>
			</div>
			<p class="form-hint">Add coordinates to show this monitor as a marker on the globe</p>
		</div>

		<div class="form-group">
			<label class="checkbox-label">
				<input type="checkbox" bind:checked={enabled} />
				<span>Enabled</span>
			</label>
		</div>

		<div class="form-actions">
			{#if editMonitor}
				<button type="button" class="delete-btn" onclick={handleDelete}> Delete </button>
			{/if}
			<button type="button" class="cancel-btn" onclick={onClose}> Cancel </button>
			<button type="submit" class="submit-btn">
				{editMonitor ? 'Save Changes' : 'Create Monitor'}
			</button>
		</div>
	</form>
</Modal>

<style>
	.monitor-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.form-error {
		background: rgba(255, 68, 68, 0.1);
		border: 1px solid rgba(255, 68, 68, 0.3);
		border-radius: 4px;
		padding: 0.5rem;
		color: var(--danger);
		font-size: 0.7rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.form-group label {
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.form-group input[type='text'] {
		padding: 0.5rem;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text-primary);
		font-size: 0.75rem;
	}

	.form-group input[type='text']:focus {
		outline: none;
		border-color: var(--accent);
	}

	.form-hint {
		font-size: 0.6rem;
		color: var(--text-muted);
		margin: 0;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-size: 0.7rem;
		color: var(--text-primary);
	}

	.checkbox-label input {
		accent-color: var(--accent);
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.cancel-btn,
	.submit-btn,
	.delete-btn {
		padding: 0.5rem 1rem;
		border-radius: 4px;
		font-size: 0.7rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.cancel-btn {
		background: transparent;
		border: 1px solid var(--border);
		color: var(--text-secondary);
	}

	.cancel-btn:hover {
		background: var(--border);
		color: var(--text-primary);
	}

	.submit-btn {
		background: var(--accent);
		border: 1px solid var(--accent);
		color: white;
	}

	.submit-btn:hover {
		filter: brightness(1.1);
	}

	.delete-btn {
		background: transparent;
		border: 1px solid rgba(255, 68, 68, 0.3);
		color: var(--danger);
		margin-right: auto;
	}

	.delete-btn:hover {
		background: rgba(255, 68, 68, 0.1);
	}

	/* Color Picker */
	.color-picker {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-wrap: wrap;
	}

	.color-swatch {
		width: 24px;
		height: 24px;
		border-radius: 4px;
		border: 2px solid transparent;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.color-swatch:hover {
		transform: scale(1.1);
	}

	.color-swatch.selected {
		border-color: white;
		transform: scale(1.15);
	}

	.color-input {
		width: 24px;
		height: 24px;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 4px;
		cursor: pointer;
		background: transparent;
	}

	.color-input::-webkit-color-swatch-wrapper {
		padding: 2px;
	}

	.color-input::-webkit-color-swatch {
		border-radius: 2px;
		border: none;
	}

	/* Location Inputs */
	.location-group .optional {
		font-size: 0.6rem;
		color: var(--text-muted);
		font-weight: normal;
	}

	.location-inputs {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.location-name-input {
		padding: 0.5rem;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text-primary);
		font-size: 0.75rem;
	}

	.location-name-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.coords-row {
		display: flex;
		gap: 0.375rem;
	}

	.coord-input {
		flex: 1;
		padding: 0.5rem;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text-primary);
		font-size: 0.75rem;
		font-family: 'SF Mono', Monaco, monospace;
	}

	.coord-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.coord-input::placeholder {
		font-family: inherit;
	}
</style>
