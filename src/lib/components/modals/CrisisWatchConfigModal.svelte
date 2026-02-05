<script lang="ts">
	import Modal from './Modal.svelte';
	import { crisisWatch, getDefaultConfig, type CrisisWatchConfig } from '$lib/stores/crisisWatch';
	import type { NewsItem } from '$lib/types';

	interface Props {
		open: boolean;
		onClose: () => void;
		configId: CrisisWatchConfig['id'] | null;
		allNews: NewsItem[];
	}

	let { open = false, onClose, configId = null, allNews = [] }: Props = $props();

	// Form state
	let title = $state('');
	let subtitle = $state('');
	let countryCode = $state('');
	let keywords = $state<string[]>([]);
	let newKeyword = $state('');
	let enabled = $state(true);
	let error = $state('');
	let countrySearch = $state('');
	let showCountryDropdown = $state(false);

	// Country list (common countries relevant to geopolitical monitoring)
	const COUNTRIES = [
		{ code: 'AF', name: 'Afghanistan' },
		{ code: 'AL', name: 'Albania' },
		{ code: 'DZ', name: 'Algeria' },
		{ code: 'AO', name: 'Angola' },
		{ code: 'AR', name: 'Argentina' },
		{ code: 'AM', name: 'Armenia' },
		{ code: 'AU', name: 'Australia' },
		{ code: 'AT', name: 'Austria' },
		{ code: 'AZ', name: 'Azerbaijan' },
		{ code: 'BY', name: 'Belarus' },
		{ code: 'BE', name: 'Belgium' },
		{ code: 'BD', name: 'Bangladesh' },
		{ code: 'BR', name: 'Brazil' },
		{ code: 'BG', name: 'Bulgaria' },
		{ code: 'MM', name: 'Myanmar (Burma)' },
		{ code: 'KH', name: 'Cambodia' },
		{ code: 'CM', name: 'Cameroon' },
		{ code: 'CA', name: 'Canada' },
		{ code: 'CF', name: 'Central African Republic' },
		{ code: 'TD', name: 'Chad' },
		{ code: 'CL', name: 'Chile' },
		{ code: 'CN', name: 'China' },
		{ code: 'CO', name: 'Colombia' },
		{ code: 'CD', name: 'Congo (DRC)' },
		{ code: 'CR', name: 'Costa Rica' },
		{ code: 'HR', name: 'Croatia' },
		{ code: 'CU', name: 'Cuba' },
		{ code: 'CY', name: 'Cyprus' },
		{ code: 'CZ', name: 'Czech Republic' },
		{ code: 'DK', name: 'Denmark' },
		{ code: 'DJ', name: 'Djibouti' },
		{ code: 'EC', name: 'Ecuador' },
		{ code: 'EG', name: 'Egypt' },
		{ code: 'SV', name: 'El Salvador' },
		{ code: 'ER', name: 'Eritrea' },
		{ code: 'EE', name: 'Estonia' },
		{ code: 'ET', name: 'Ethiopia' },
		{ code: 'FI', name: 'Finland' },
		{ code: 'FR', name: 'France' },
		{ code: 'GE', name: 'Georgia' },
		{ code: 'DE', name: 'Germany' },
		{ code: 'GH', name: 'Ghana' },
		{ code: 'GR', name: 'Greece' },
		{ code: 'GL', name: 'Greenland' },
		{ code: 'GT', name: 'Guatemala' },
		{ code: 'HT', name: 'Haiti' },
		{ code: 'HN', name: 'Honduras' },
		{ code: 'HK', name: 'Hong Kong' },
		{ code: 'HU', name: 'Hungary' },
		{ code: 'IS', name: 'Iceland' },
		{ code: 'IN', name: 'India' },
		{ code: 'ID', name: 'Indonesia' },
		{ code: 'IR', name: 'Iran' },
		{ code: 'IQ', name: 'Iraq' },
		{ code: 'IE', name: 'Ireland' },
		{ code: 'IL', name: 'Israel' },
		{ code: 'IT', name: 'Italy' },
		{ code: 'JP', name: 'Japan' },
		{ code: 'JO', name: 'Jordan' },
		{ code: 'KZ', name: 'Kazakhstan' },
		{ code: 'KE', name: 'Kenya' },
		{ code: 'KP', name: 'North Korea' },
		{ code: 'KR', name: 'South Korea' },
		{ code: 'KW', name: 'Kuwait' },
		{ code: 'KG', name: 'Kyrgyzstan' },
		{ code: 'LA', name: 'Laos' },
		{ code: 'LV', name: 'Latvia' },
		{ code: 'LB', name: 'Lebanon' },
		{ code: 'LY', name: 'Libya' },
		{ code: 'LT', name: 'Lithuania' },
		{ code: 'MK', name: 'North Macedonia' },
		{ code: 'MY', name: 'Malaysia' },
		{ code: 'ML', name: 'Mali' },
		{ code: 'MX', name: 'Mexico' },
		{ code: 'MD', name: 'Moldova' },
		{ code: 'MN', name: 'Mongolia' },
		{ code: 'ME', name: 'Montenegro' },
		{ code: 'MA', name: 'Morocco' },
		{ code: 'MZ', name: 'Mozambique' },
		{ code: 'NP', name: 'Nepal' },
		{ code: 'NL', name: 'Netherlands' },
		{ code: 'NZ', name: 'New Zealand' },
		{ code: 'NI', name: 'Nicaragua' },
		{ code: 'NE', name: 'Niger' },
		{ code: 'NG', name: 'Nigeria' },
		{ code: 'NO', name: 'Norway' },
		{ code: 'OM', name: 'Oman' },
		{ code: 'PK', name: 'Pakistan' },
		{ code: 'PS', name: 'Palestine' },
		{ code: 'PA', name: 'Panama' },
		{ code: 'PY', name: 'Paraguay' },
		{ code: 'PE', name: 'Peru' },
		{ code: 'PH', name: 'Philippines' },
		{ code: 'PL', name: 'Poland' },
		{ code: 'PT', name: 'Portugal' },
		{ code: 'QA', name: 'Qatar' },
		{ code: 'RO', name: 'Romania' },
		{ code: 'RU', name: 'Russia' },
		{ code: 'RW', name: 'Rwanda' },
		{ code: 'SA', name: 'Saudi Arabia' },
		{ code: 'SN', name: 'Senegal' },
		{ code: 'RS', name: 'Serbia' },
		{ code: 'SG', name: 'Singapore' },
		{ code: 'SK', name: 'Slovakia' },
		{ code: 'SI', name: 'Slovenia' },
		{ code: 'SO', name: 'Somalia' },
		{ code: 'ZA', name: 'South Africa' },
		{ code: 'SS', name: 'South Sudan' },
		{ code: 'ES', name: 'Spain' },
		{ code: 'LK', name: 'Sri Lanka' },
		{ code: 'SD', name: 'Sudan' },
		{ code: 'SE', name: 'Sweden' },
		{ code: 'CH', name: 'Switzerland' },
		{ code: 'SY', name: 'Syria' },
		{ code: 'TW', name: 'Taiwan' },
		{ code: 'TJ', name: 'Tajikistan' },
		{ code: 'TZ', name: 'Tanzania' },
		{ code: 'TH', name: 'Thailand' },
		{ code: 'TN', name: 'Tunisia' },
		{ code: 'TR', name: 'Turkey' },
		{ code: 'TM', name: 'Turkmenistan' },
		{ code: 'UA', name: 'Ukraine' },
		{ code: 'AE', name: 'United Arab Emirates' },
		{ code: 'GB', name: 'United Kingdom' },
		{ code: 'US', name: 'United States' },
		{ code: 'UY', name: 'Uruguay' },
		{ code: 'UZ', name: 'Uzbekistan' },
		{ code: 'VE', name: 'Venezuela' },
		{ code: 'VN', name: 'Vietnam' },
		{ code: 'YE', name: 'Yemen' },
		{ code: 'ZM', name: 'Zambia' },
		{ code: 'ZW', name: 'Zimbabwe' }
	];

	// Filtered countries based on search
	const filteredCountries = $derived(
		countrySearch.trim()
			? COUNTRIES.filter(
					(c) =>
						c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
						c.code.toLowerCase().includes(countrySearch.toLowerCase())
				)
			: COUNTRIES
	);

	// Get country name from code
	function getCountryName(code: string): string {
		return COUNTRIES.find((c) => c.code === code)?.name || code;
	}

	// Count matching news items
	const matchingNewsCount = $derived(() => {
		if (keywords.length === 0) return 0;
		return allNews.filter((n) => {
			const text = n.title.toLowerCase();
			return keywords.some((k) => text.includes(k.toLowerCase()));
		}).length;
	});

	// Reset form when modal opens
	$effect(() => {
		if (open && configId) {
			const config = crisisWatch.getConfig(configId);
			if (config) {
				title = config.title;
				subtitle = config.subtitle;
				countryCode = config.countryCode;
				keywords = [...config.keywords];
				enabled = config.enabled;
				countrySearch = getCountryName(config.countryCode);
			}
			error = '';
			newKeyword = '';
			showCountryDropdown = false;
		}
	});

	function handleSubmit(e: Event) {
		e.preventDefault();

		const trimmedTitle = title.trim();
		const trimmedSubtitle = subtitle.trim();

		if (!trimmedTitle) {
			error = 'Title is required';
			return;
		}

		if (!countryCode) {
			error = 'Please select a country';
			return;
		}

		if (keywords.length === 0) {
			error = 'At least one keyword is required';
			return;
		}

		if (configId) {
			crisisWatch.updateConfig(configId, {
				title: trimmedTitle,
				subtitle: trimmedSubtitle,
				countryCode,
				keywords,
				enabled
			});
		}

		onClose();
	}

	function handleAddKeyword() {
		const keyword = newKeyword.trim().toLowerCase();
		if (keyword && !keywords.includes(keyword)) {
			keywords = [...keywords, keyword];
			newKeyword = '';
		}
	}

	function handleKeywordKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleAddKeyword();
		}
	}

	function handleRemoveKeyword(keyword: string) {
		keywords = keywords.filter((k) => k !== keyword);
	}

	function handleCountrySelect(code: string, name: string) {
		countryCode = code;
		countrySearch = name;
		showCountryDropdown = false;
	}

	function handleResetToDefault() {
		if (!configId) return;

		const defaultConfig = getDefaultConfig(configId);
		if (defaultConfig) {
			title = defaultConfig.title;
			subtitle = defaultConfig.subtitle;
			countryCode = defaultConfig.countryCode;
			keywords = [...defaultConfig.keywords];
			enabled = defaultConfig.enabled;
			countrySearch = getCountryName(defaultConfig.countryCode);
			error = '';
		}
	}

	function handleCountryInputFocus() {
		showCountryDropdown = true;
	}

	function handleCountryInputBlur() {
		// Delay hiding to allow click on dropdown items
		setTimeout(() => {
			showCountryDropdown = false;
		}, 200);
	}
</script>

<Modal {open} title="Configure Crisis Watch" {onClose}>
	<form class="crisis-form" onsubmit={handleSubmit}>
		{#if error}
			<div class="form-error">{error}</div>
		{/if}

		<div class="form-group">
			<label for="crisis-title">Title</label>
			<input
				id="crisis-title"
				type="text"
				bind:value={title}
				placeholder="e.g., Ukraine Crisis"
				maxlength="50"
			/>
		</div>

		<div class="form-group">
			<label for="crisis-subtitle">Subtitle</label>
			<input
				id="crisis-subtitle"
				type="text"
				bind:value={subtitle}
				placeholder="e.g., Conflict monitoring"
				maxlength="100"
			/>
		</div>

		<div class="form-group">
			<label for="crisis-country">Country/Region</label>
			<div class="country-select-wrapper">
				<input
					id="crisis-country"
					type="text"
					bind:value={countrySearch}
					placeholder="Search countries..."
					onfocus={handleCountryInputFocus}
					onblur={handleCountryInputBlur}
					autocomplete="off"
				/>
				{#if showCountryDropdown && filteredCountries.length > 0}
					<div class="country-dropdown">
						{#each filteredCountries.slice(0, 10) as country}
							<button
								type="button"
								class="country-option"
								class:selected={country.code === countryCode}
								onmousedown={() => handleCountrySelect(country.code, country.name)}
							>
								<span class="country-code">{country.code}</span>
								<span class="country-name">{country.name}</span>
							</button>
						{/each}
						{#if filteredCountries.length > 10}
							<div class="country-more">+{filteredCountries.length - 10} more...</div>
						{/if}
					</div>
				{/if}
			</div>
			{#if countryCode}
				<p class="form-hint">Selected: {getCountryName(countryCode)} ({countryCode})</p>
			{/if}
		</div>

		<div class="form-group">
			<label for="crisis-keywords">Keywords</label>
			<div class="keyword-input-row">
				<input
					id="crisis-keywords"
					type="text"
					bind:value={newKeyword}
					placeholder="Add keyword..."
					onkeydown={handleKeywordKeydown}
				/>
				<button type="button" class="add-keyword-btn" onclick={handleAddKeyword}> + </button>
			</div>
			<p class="form-hint">Press Enter or click + to add. News matching any keyword will appear.</p>

			{#if keywords.length > 0}
				<div class="keyword-tags">
					{#each keywords as keyword}
						<span class="keyword-tag">
							{keyword}
							<button
								type="button"
								class="remove-keyword"
								onclick={() => handleRemoveKeyword(keyword)}
								aria-label="Remove {keyword}"
							>
								x
							</button>
						</span>
					{/each}
				</div>
			{/if}
		</div>

		<div class="form-group">
			<label class="checkbox-label">
				<input type="checkbox" bind:checked={enabled} />
				<span>Enabled</span>
			</label>
		</div>

		<!-- Preview -->
		<div class="preview-section">
			<div class="preview-label">PREVIEW</div>
			<div class="preview-stats">
				<span class="preview-stat">
					<span class="stat-value">{keywords.length}</span>
					<span class="stat-label">keywords</span>
				</span>
				<span class="preview-stat">
					<span class="stat-value">{matchingNewsCount()}</span>
					<span class="stat-label">matching news</span>
				</span>
			</div>
		</div>

		<div class="form-actions">
			<button type="button" class="reset-btn" onclick={handleResetToDefault}> Reset to Default </button>
			<button type="button" class="cancel-btn" onclick={onClose}> Cancel </button>
			<button type="submit" class="submit-btn"> Save Changes </button>
		</div>
	</form>
</Modal>

<style>
	.crisis-form {
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

	/* Country Select */
	.country-select-wrapper {
		position: relative;
	}

	.country-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background: rgb(15 23 42);
		border: 1px solid var(--border);
		border-top: none;
		border-radius: 0 0 4px 4px;
		max-height: 200px;
		overflow-y: auto;
		z-index: 100;
	}

	.country-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.5rem;
		background: none;
		border: none;
		color: var(--text-primary);
		font-size: 0.7rem;
		cursor: pointer;
		text-align: left;
		transition: background 0.15s;
	}

	.country-option:hover,
	.country-option.selected {
		background: rgb(30 41 59);
	}

	.country-option.selected {
		color: var(--accent);
	}

	.country-code {
		font-family: 'SF Mono', Monaco, monospace;
		font-size: 0.65rem;
		color: var(--text-muted);
		background: rgb(51 65 85 / 0.5);
		padding: 0.125rem 0.25rem;
		border-radius: 2px;
	}

	.country-name {
		flex: 1;
	}

	.country-more {
		padding: 0.375rem 0.5rem;
		font-size: 0.6rem;
		color: var(--text-muted);
		text-align: center;
		border-top: 1px solid var(--border);
	}

	/* Keyword Input */
	.keyword-input-row {
		display: flex;
		gap: 0.375rem;
	}

	.keyword-input-row input {
		flex: 1;
	}

	.add-keyword-btn {
		padding: 0.5rem 0.75rem;
		background: var(--accent);
		border: 1px solid var(--accent);
		border-radius: 4px;
		color: white;
		font-size: 0.8rem;
		font-weight: bold;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.add-keyword-btn:hover {
		filter: brightness(1.1);
	}

	/* Keyword Tags */
	.keyword-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-top: 0.5rem;
	}

	.keyword-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		background: rgb(34 211 238 / 0.1);
		border: 1px solid rgb(34 211 238 / 0.3);
		border-radius: 4px;
		color: rgb(34 211 238);
		font-size: 0.65rem;
		font-family: 'SF Mono', Monaco, monospace;
	}

	.remove-keyword {
		background: none;
		border: none;
		color: rgb(34 211 238 / 0.7);
		cursor: pointer;
		padding: 0;
		font-size: 0.6rem;
		line-height: 1;
		margin-left: 0.125rem;
	}

	.remove-keyword:hover {
		color: rgb(248 113 113);
	}

	/* Checkbox */
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

	/* Preview Section */
	.preview-section {
		background: rgb(15 23 42);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 0.75rem;
	}

	.preview-label {
		font-size: 0.6rem;
		font-weight: 700;
		color: var(--text-muted);
		letter-spacing: 0.1em;
		margin-bottom: 0.5rem;
	}

	.preview-stats {
		display: flex;
		gap: 1.5rem;
	}

	.preview-stat {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.stat-value {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--accent);
		font-family: 'SF Mono', Monaco, monospace;
	}

	.stat-label {
		font-size: 0.6rem;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Form Actions */
	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.cancel-btn,
	.submit-btn,
	.reset-btn {
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

	.reset-btn {
		background: transparent;
		border: 1px solid rgba(251, 191, 36, 0.3);
		color: rgb(251 191 36);
		margin-right: auto;
	}

	.reset-btn:hover {
		background: rgba(251, 191, 36, 0.1);
	}
</style>
