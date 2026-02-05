<script lang="ts">
	import type { WebcamWindowState, Webcam } from '$lib/types/webcam';
	import type { StrategicWebcam } from '$lib/api/webcam';
	import { webcamWindows } from '$lib/stores/webcam';

	interface Props {
		windowState: WebcamWindowState;
		zIndex: number;
	}

	let { windowState, zIndex }: Props = $props();

	// Check if a webcam is a strategic webcam
	function isStrategicWebcam(webcam: Webcam): webcam is StrategicWebcam {
		return 'strategicCategory' in webcam && 'threatLevel' in webcam;
	}

	// Get threat level color
	function getThreatLevelColor(level: string): string {
		switch (level) {
			case 'critical':
				return 'rgb(239 68 68)';
			case 'high':
				return 'rgb(249 115 22)';
			case 'elevated':
				return 'rgb(234 179 8)';
			default:
				return 'rgb(34 197 94)';
		}
	}

	// Get category icon
	function getCategoryIcon(category: string): string {
		switch (category) {
			case 'conflict':
				return '⚔';
			case 'chokepoint':
				return '⚓';
			case 'capital':
				return '🏛';
			case 'port':
				return '🚢';
			case 'border':
				return '🚧';
			case 'infrastructure':
				return '🏗';
			default:
				return '📍';
		}
	}

	// Drag state
	let isDragging = $state(false);
	let dragStartX = 0;
	let dragStartY = 0;
	let windowStartX = 0;
	let windowStartY = 0;

	// Resize state
	let isResizing = $state(false);
	let resizeDirection = $state<string>('');
	let resizeStartX = 0;
	let resizeStartY = 0;
	let windowStartWidth = 0;
	let windowStartHeight = 0;
	let windowStartPosX = 0;
	let windowStartPosY = 0;

	// Minimum window dimensions
	const MIN_WIDTH = 400;
	const MIN_HEIGHT = 300;
	const MAX_WIDTH = 1200;
	const MAX_HEIGHT = 900;

	// Track which feeds failed to load
	let failedFeeds = $state<Set<string>>(new Set());

	// Track iframe load state for better error handling
	let loadingFeeds = $state<Set<string>>(new Set());

	// Handle drag start
	function handleDragStart(e: MouseEvent) {
		if ((e.target as HTMLElement).closest('.window-actions')) return;
		if ((e.target as HTMLElement).closest('.resize-handle')) return;

		isDragging = true;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		windowStartX = windowState.position.x;
		windowStartY = windowState.position.y;

		webcamWindows.bringToFront(windowState.id);

		document.addEventListener('mousemove', handleDragMove);
		document.addEventListener('mouseup', handleDragEnd);
		document.body.style.cursor = 'grabbing';
		document.body.style.userSelect = 'none';
	}

	function handleDragMove(e: MouseEvent) {
		if (!isDragging) return;

		const deltaX = e.clientX - dragStartX;
		const deltaY = e.clientY - dragStartY;

		// Calculate new position with bounds checking
		const maxX = window.innerWidth - 100;
		const maxY = window.innerHeight - 50;

		const newX = Math.max(0, Math.min(maxX, windowStartX + deltaX));
		const newY = Math.max(0, Math.min(maxY, windowStartY + deltaY));

		webcamWindows.updatePosition(windowState.id, { x: newX, y: newY });
	}

	function handleDragEnd() {
		isDragging = false;
		document.removeEventListener('mousemove', handleDragMove);
		document.removeEventListener('mouseup', handleDragEnd);
		document.body.style.cursor = '';
		document.body.style.userSelect = '';
	}

	// Handle resize start
	function handleResizeStart(e: MouseEvent, direction: string) {
		e.preventDefault();
		e.stopPropagation();

		isResizing = true;
		resizeDirection = direction;
		resizeStartX = e.clientX;
		resizeStartY = e.clientY;
		windowStartWidth = windowState.size.width;
		windowStartHeight = windowState.size.height;
		windowStartPosX = windowState.position.x;
		windowStartPosY = windowState.position.y;

		webcamWindows.bringToFront(windowState.id);

		document.addEventListener('mousemove', handleResizeMove);
		document.addEventListener('mouseup', handleResizeEnd);
		document.body.style.cursor = getResizeCursor(direction);
		document.body.style.userSelect = 'none';
	}

	function handleResizeMove(e: MouseEvent) {
		if (!isResizing) return;

		const deltaX = e.clientX - resizeStartX;
		const deltaY = e.clientY - resizeStartY;

		let newWidth = windowStartWidth;
		let newHeight = windowStartHeight;
		let newX = windowStartPosX;
		let newY = windowStartPosY;

		// Handle horizontal resize
		if (resizeDirection.includes('e')) {
			newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, windowStartWidth + deltaX));
		}
		if (resizeDirection.includes('w')) {
			const proposedWidth = windowStartWidth - deltaX;
			if (proposedWidth >= MIN_WIDTH && proposedWidth <= MAX_WIDTH) {
				newWidth = proposedWidth;
				newX = windowStartPosX + deltaX;
			}
		}

		// Handle vertical resize
		if (resizeDirection.includes('s')) {
			newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, windowStartHeight + deltaY));
		}
		if (resizeDirection.includes('n')) {
			const proposedHeight = windowStartHeight - deltaY;
			if (proposedHeight >= MIN_HEIGHT && proposedHeight <= MAX_HEIGHT) {
				newHeight = proposedHeight;
				newY = windowStartPosY + deltaY;
			}
		}

		// Keep window within viewport
		const maxX = window.innerWidth - 100;
		const maxY = window.innerHeight - 50;
		newX = Math.max(0, Math.min(maxX, newX));
		newY = Math.max(0, Math.min(maxY, newY));

		webcamWindows.updateSize(windowState.id, { width: newWidth, height: newHeight });
		webcamWindows.updatePosition(windowState.id, { x: newX, y: newY });
	}

	function handleResizeEnd() {
		isResizing = false;
		resizeDirection = '';
		document.removeEventListener('mousemove', handleResizeMove);
		document.removeEventListener('mouseup', handleResizeEnd);
		document.body.style.cursor = '';
		document.body.style.userSelect = '';
	}

	function getResizeCursor(direction: string): string {
		const cursors: Record<string, string> = {
			'n': 'ns-resize',
			's': 'ns-resize',
			'e': 'ew-resize',
			'w': 'ew-resize',
			'ne': 'nesw-resize',
			'nw': 'nwse-resize',
			'se': 'nwse-resize',
			'sw': 'nesw-resize'
		};
		return cursors[direction] || 'default';
	}

	// Handle window close
	function handleClose() {
		webcamWindows.closeWindow(windowState.id);
	}

	// Handle minimize toggle
	function handleMinimize() {
		webcamWindows.toggleMinimize(windowState.id);
	}

	// Handle refresh
	function handleRefresh() {
		failedFeeds = new Set();
		loadingFeeds = new Set();
		webcamWindows.refreshWebcams(windowState.id);
	}

	// Handle feed load error
	function handleFeedError(webcamId: string) {
		loadingFeeds = new Set([...loadingFeeds].filter(id => id !== webcamId));
		failedFeeds = new Set([...failedFeeds, webcamId]);
	}

	// Handle feed load success
	function handleFeedLoadSuccess(webcamId: string) {
		loadingFeeds = new Set([...loadingFeeds].filter(id => id !== webcamId));
		// Remove from failed if it was there (retry succeeded)
		failedFeeds = new Set([...failedFeeds].filter(id => id !== webcamId));
	}

	// Add Windy player parameters for autoplay and hiding logo
	function addWindyPlayerParams(url: string): string {
		if (!url.includes('webcams.windy.com')) return url;
		try {
			const urlObj = new URL(url);
			// Prefer live stream, add autoplay, hide logo
			urlObj.searchParams.set('autoplay', 'true');
			urlObj.searchParams.set('showLogo', 'false');
			urlObj.searchParams.set('type', 'live'); // Force live stream mode
			return urlObj.toString();
		} catch {
			// If URL parsing fails, append parameters manually
			const separator = url.includes('?') ? '&' : '?';
			return `${url}${separator}autoplay=true&showLogo=false&type=live`;
		}
	}

	// Format YouTube embed URL with proper parameters
	function formatYouTubeEmbed(url: string): string {
		if (!url.includes('youtube.com/embed') && !url.includes('youtu.be')) return url;

		try {
			let videoId = '';

			// Extract video ID from various YouTube URL formats
			if (url.includes('youtube.com/embed/')) {
				const match = url.match(/youtube\.com\/embed\/([^?&]+)/);
				videoId = match ? match[1] : '';
			} else if (url.includes('youtu.be/')) {
				const match = url.match(/youtu\.be\/([^?&]+)/);
				videoId = match ? match[1] : '';
			} else if (url.includes('youtube.com/watch')) {
				const urlObj = new URL(url);
				videoId = urlObj.searchParams.get('v') || '';
			} else if (url.includes('youtube.com/live_stream')) {
				// Handle live_stream URLs
				const match = url.match(/channel=([^&]+)/);
				if (match) {
					return `https://www.youtube.com/embed/live_stream?channel=${match[1]}&autoplay=1&mute=1&enablejsapi=1`;
				}
			}

			if (videoId) {
				// Build clean embed URL with proper parameters
				return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&enablejsapi=1&rel=0&modestbranding=1`;
			}
		} catch {
			// If parsing fails, return original with basic params
		}

		// Fallback: add params if not present
		if (!url.includes('autoplay=')) {
			const separator = url.includes('?') ? '&' : '?';
			return `${url}${separator}autoplay=1&mute=1`;
		}
		return url;
	}

	// Get embed URL for webcam
	function getEmbedUrl(webcam: Webcam): string {
		if (!webcam) return '';

		// For strategic webcams with YouTube URLs in the detail field, use that directly
		if (webcam.urls?.detail && (webcam.urls.detail.includes('youtube.com') || webcam.urls.detail.includes('youtu.be'))) {
			return formatYouTubeEmbed(webcam.urls.detail);
		}

		// Windy API v3 returns player URLs as direct strings
		// e.g. player.live = "https://webcams.windy.com/webcams/public/embed/player/123/live"
		if (webcam.player) {
			// Check if player.live is a string URL (Windy API v3 format)
			if (typeof webcam.player.live === 'string' && webcam.player.live) {
				const url = webcam.player.live;
				if (url.includes('youtube.com') || url.includes('youtu.be')) {
					return formatYouTubeEmbed(url);
				}
				return addWindyPlayerParams(url);
			}
			// Check if player.day is a string URL (fallback if no live)
			if (typeof webcam.player.day === 'string' && webcam.player.day) {
				const url = webcam.player.day;
				if (url.includes('youtube.com') || url.includes('youtu.be')) {
					return formatYouTubeEmbed(url);
				}
				return addWindyPlayerParams(url);
			}
			// Legacy/fallback format: player.live is an object with available/embed properties
			const livePlayer = webcam.player.live;
			if (typeof livePlayer === 'object' && livePlayer !== null) {
				const liveObj = livePlayer as { available?: boolean; embed?: string };
				if (liveObj.available && liveObj.embed) {
					const url = liveObj.embed;
					if (url.includes('youtube.com') || url.includes('youtu.be')) {
						return formatYouTubeEmbed(url);
					}
					return addWindyPlayerParams(url);
				}
			}
			const dayPlayer = webcam.player.day;
			if (typeof dayPlayer === 'object' && dayPlayer !== null) {
				const dayObj = dayPlayer as { available?: boolean; embed?: string };
				if (dayObj.available && dayObj.embed) {
					const url = dayObj.embed;
					if (url.includes('youtube.com') || url.includes('youtu.be')) {
						return formatYouTubeEmbed(url);
					}
					return addWindyPlayerParams(url);
				}
			}
		}

		// For fallback/strategic webcams, use the detail URL (often contains YouTube embed)
		const detailUrl = webcam.urls?.detail || '';
		if (detailUrl.includes('youtube.com') || detailUrl.includes('youtu.be')) {
			return formatYouTubeEmbed(detailUrl);
		}
		return detailUrl;
	}

	// Check if a webcam can be embedded in an iframe
	// Windy webcam player URLs and YouTube embeds work reliably
	// Other sites (earthcam, skylinewebcams, webcamtaxi) block iframes
	function isEmbeddable(webcam: Webcam, url: string): boolean {
		if (!url) return false;
		// If explicitly marked as external only, don't embed
		if (webcam.externalOnly) return false;
		// Windy webcam player URLs work great
		if (url.includes('webcams.windy.com')) return true;
		// YouTube embed URLs work reliably in iframes
		return url.includes('youtube.com/embed') || url.includes('youtu.be');
	}

	// Get flag emoji for country
	function getFlagEmoji(countryCode: string): string {
		if (!countryCode || countryCode.length !== 2) return '';
		const codePoints = countryCode
			.toUpperCase()
			.split('')
			.map((char) => 127397 + char.charCodeAt(0));
		return String.fromCodePoint(...codePoints);
	}

	// Get grid columns based on webcam count
	function getGridClass(count: number): string {
		if (count === 1) return 'grid-cols-1';
		if (count === 2) return 'grid-cols-2';
		if (count <= 4) return 'grid-cols-2';
		if (count <= 6) return 'grid-cols-3';
		return 'grid-cols-3';
	}

	// Limit displayed feeds for performance - now with pagination
	const feedsPerPage = 6;
	let currentPage = $state(0);
	let showAllFeeds = $state(false);

	// Calculate total pages
	const totalPages = $derived(Math.ceil(windowState.webcams.length / feedsPerPage));
	const hasMultiplePages = $derived(windowState.webcams.length > feedsPerPage);

	// Display current page of webcams or all if showAllFeeds is true
	const displayedWebcams = $derived(() => {
		if (showAllFeeds) {
			return windowState.webcams;
		}
		const start = currentPage * feedsPerPage;
		return windowState.webcams.slice(start, start + feedsPerPage);
	});

	// Navigation functions
	function nextPage() {
		if (currentPage < totalPages - 1) {
			currentPage++;
		}
	}

	function prevPage() {
		if (currentPage > 0) {
			currentPage--;
		}
	}

	function toggleShowAll() {
		showAllFeeds = !showAllFeeds;
		if (!showAllFeeds) {
			currentPage = 0;
		}
	}
</script>

<div
	class="webcam-window"
	class:minimized={windowState.isMinimized}
	class:dragging={isDragging}
	class:resizing={isResizing}
	style="
		left: {windowState.position.x}px;
		top: {windowState.position.y}px;
		width: {windowState.size.width}px;
		z-index: {1000 + zIndex};
	"
	role="dialog"
	aria-label="Webcam viewer for {windowState.countryName}"
>
	<!-- Resize Handles -->
	{#if !windowState.isMinimized}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="resize-handle resize-n" onmousedown={(e) => handleResizeStart(e, 'n')}></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="resize-handle resize-s" onmousedown={(e) => handleResizeStart(e, 's')}></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="resize-handle resize-e" onmousedown={(e) => handleResizeStart(e, 'e')}></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="resize-handle resize-w" onmousedown={(e) => handleResizeStart(e, 'w')}></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="resize-handle resize-ne" onmousedown={(e) => handleResizeStart(e, 'ne')}></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="resize-handle resize-nw" onmousedown={(e) => handleResizeStart(e, 'nw')}></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="resize-handle resize-se" onmousedown={(e) => handleResizeStart(e, 'se')}></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="resize-handle resize-sw" onmousedown={(e) => handleResizeStart(e, 'sw')}></div>
	{/if}

	<!-- Tech Corner Decorations -->
	<div class="tech-corner top-left"></div>
	<div class="tech-corner top-right"></div>
	<div class="tech-corner bottom-left"></div>
	<div class="tech-corner bottom-right"></div>

	<!-- Window Header -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="window-header" onmousedown={handleDragStart}>
		<div class="window-title">
			<span class="country-flag">{getFlagEmoji(windowState.countryCode)}</span>
			<span class="country-name">{windowState.countryName}</span>
			{#if windowState.webcams.length > 0}
				<span class="webcam-count">{windowState.webcams.length} FEEDS</span>
			{/if}
		</div>

		<div class="window-actions">
			<button
				class="action-btn"
				onclick={handleRefresh}
				title="Refresh webcams"
				aria-label="Refresh webcams"
				disabled={windowState.isLoading}
			>
				↻
			</button>
			<button
				class="action-btn"
				onclick={handleMinimize}
				title={windowState.isMinimized ? 'Expand' : 'Minimize'}
				aria-label={windowState.isMinimized ? 'Expand' : 'Minimize'}
			>
				{windowState.isMinimized ? '▢' : '▬'}
			</button>
			<button
				class="action-btn close-btn"
				onclick={handleClose}
				title="Close"
				aria-label="Close webcam window"
			>
				✕
			</button>
		</div>
	</div>

	<!-- Window Content -->
	{#if !windowState.isMinimized}
		<div class="window-content">
			{#if windowState.isLoading}
				<!-- Loading State -->
				<div class="loading-state">
					<div class="loading-spinner"></div>
					<span class="loading-text">ACQUIRING FEEDS</span>
					<span class="loading-subtext">{windowState.countryName}</span>
					<div class="scan-line"></div>
				</div>
			{:else if windowState.error}
				<!-- Error State -->
				<div class="error-state">
					<span class="error-icon">📡</span>
					<span class="error-text">{windowState.error}</span>
					<button class="retry-btn" onclick={handleRefresh}>RETRY CONNECTION</button>
				</div>
			{:else if windowState.webcams.length === 0}
				<!-- No Webcams State -->
				<div class="no-feeds-state">
					<span class="no-feeds-icon">📵</span>
					<span class="no-feeds-text">NO FEEDS AVAILABLE</span>
					<span class="no-feeds-subtext">No webcams found for this region</span>
				</div>
			{:else}
				<!-- Gallery View -->
				<div class="gallery-grid {getGridClass(displayedWebcams().length)}" class:show-all-grid={showAllFeeds}>
					{#each displayedWebcams() as webcam (webcam.webcamId)}
						{@const embedUrl = getEmbedUrl(webcam)}
						{@const isFailed = failedFeeds.has(webcam.webcamId)}
						{@const isInactive = webcam.status !== 'active'}
						{@const showDownState = isFailed || isInactive || !embedUrl}

						<div class="feed-container" class:strategic={isStrategicWebcam(webcam)}>
							<!-- Feed Header -->
							<div class="feed-header">
								<span class="feed-title" title={webcam.title || 'Unknown'}>
									{#if isStrategicWebcam(webcam)}
										<span class="category-icon">{getCategoryIcon(webcam.strategicCategory)}</span>
									{/if}
									{webcam.location?.city || webcam.title || 'Unknown'}
								</span>
								<div class="feed-badges">
									{#if isStrategicWebcam(webcam)}
										<span
											class="threat-badge"
											style="--threat-color: {getThreatLevelColor(webcam.threatLevel)}"
										>
											{webcam.threatLevel.toUpperCase()}
										</span>
									{/if}
									{#if !showDownState}
										<span class="live-badge">
											<span class="live-dot"></span>
											LIVE
										</span>
									{:else}
										<span class="down-badge">
											<span class="down-dot"></span>
											DOWN
										</span>
									{/if}
								</div>
							</div>

							<!-- Feed Content -->
							<div class="feed-content">
								{#if showDownState}
									<!-- Down State -->
									<div class="down-state">
										<div class="down-overlay">
											<div class="static-noise"></div>
											<div class="down-info">
												<span class="down-icon">⚠</span>
												<span class="down-label">SIGNAL LOST</span>
												<span class="down-sublabel">{webcam.title}</span>
												<button
													class="retry-feed-btn"
													onclick={() => {
														failedFeeds = new Set([...failedFeeds].filter(id => id !== webcam.webcamId));
													}}
												>
													RETRY
												</button>
											</div>
										</div>
									</div>
								{:else if isEmbeddable(webcam, embedUrl)}
									<!-- Embedded Feed -->
									<div class="embed-wrapper">
										{#if loadingFeeds.has(webcam.webcamId)}
											<div class="feed-loading">
												<div class="feed-loading-spinner"></div>
												<span>ACQUIRING SIGNAL...</span>
											</div>
										{/if}
										{#if embedUrl.includes('youtube.com') || embedUrl.includes('youtu.be')}
											<iframe
												src={embedUrl}
												title={webcam.title}
												allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
												allowfullscreen
												class="feed-iframe"
												referrerpolicy="no-referrer-when-downgrade"
												onload={() => handleFeedLoadSuccess(webcam.webcamId)}
												onerror={() => handleFeedError(webcam.webcamId)}
											></iframe>
										{:else}
											<!--
												Sandbox permissions for Windy and other webcam embeds:
												- allow-scripts: Required for video playback
												- allow-same-origin: Required for some embed authentication
												- allow-presentation: For fullscreen/presentation mode
												- allow-forms: For any UI interactions
												- allow-popups: Required for Windy livestream mode links
												- allow-popups-to-escape-sandbox: Allows popups to work normally

												Note: Console errors about "allow-top-navigation" are expected -
												embedded sites try to redirect the parent window for ads/tracking
												but our sandbox prevents this. The webcam video streams still play.
											-->
											<iframe
												src={embedUrl}
												title={webcam.title}
												allow="autoplay; fullscreen"
												allowfullscreen
												sandbox="allow-scripts allow-same-origin allow-presentation allow-forms allow-popups allow-popups-to-escape-sandbox"
												class="feed-iframe"
												referrerpolicy="no-referrer-when-downgrade"
												onload={() => handleFeedLoadSuccess(webcam.webcamId)}
												onerror={() => handleFeedError(webcam.webcamId)}
											></iframe>
										{/if}
										<!-- Live indicator overlay -->
										<div class="feed-overlay">
											<div class="live-indicator">
												<span class="pulse-ring"></span>
												<span class="live-text">● REC</span>
											</div>
											<div class="feed-location">{webcam.title}</div>
										</div>
									</div>
								{:else}
									<!-- External Link Feed - Non-embeddable webcam -->
									<div class="external-feed">
										<div class="external-preview">
											{#if webcam.images?.current?.preview || webcam.images?.current?.thumbnail}
												<img
													src={webcam.images.current.preview || webcam.images.current.thumbnail}
													alt={webcam.title}
													class="preview-image"
												/>
											{:else}
												<div class="placeholder-preview">
													<div class="placeholder-grid"></div>
													<span class="placeholder-icon">📡</span>
													<span class="placeholder-text">EXTERNAL STREAM</span>
												</div>
											{/if}
											<div class="external-overlay">
												<div class="external-info">
													<span class="external-icon">🔗</span>
													<span class="external-label">IFRAME BLOCKED</span>
													<span class="external-sublabel">{webcam.title}</span>
												</div>
												<a
													href={embedUrl || webcam.urls?.detail}
													target="_blank"
													rel="noopener noreferrer"
													class="open-external-btn"
												>
													<span class="btn-icon">↗</span>
													OPEN IN NEW TAB
												</a>
											</div>
										</div>
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				<!-- Pagination Controls -->
				{#if hasMultiplePages && !showAllFeeds}
					<div class="pagination-controls">
						<button
							class="page-btn"
							onclick={prevPage}
							disabled={currentPage === 0}
							title="Previous page"
						>
							◀
						</button>
						<div class="page-info">
							<span class="page-current">{currentPage + 1}</span>
							<span class="page-sep">/</span>
							<span class="page-total">{totalPages}</span>
							<span class="feed-range">
								({currentPage * feedsPerPage + 1}-{Math.min((currentPage + 1) * feedsPerPage, windowState.webcams.length)} of {windowState.webcams.length})
							</span>
						</div>
						<button
							class="page-btn"
							onclick={nextPage}
							disabled={currentPage >= totalPages - 1}
							title="Next page"
						>
							▶
						</button>
						<button
							class="show-all-btn"
							onclick={toggleShowAll}
							title="Show all feeds in scrollable grid"
						>
							SHOW ALL
						</button>
					</div>
				{:else if hasMultiplePages && showAllFeeds}
					<div class="pagination-controls">
						<span class="showing-all">Showing all {windowState.webcams.length} feeds</span>
						<button
							class="show-all-btn"
							onclick={toggleShowAll}
							title="Show paginated view"
						>
							PAGINATE
						</button>
					</div>
				{/if}
			{/if}
		</div>

		<!-- Status Bar -->
		<div class="window-statusbar">
			<span class="status-indicator">
				<span class="status-pulse"></span>
				MONITORING
			</span>
			<span class="feed-stats">
				{displayedWebcams().filter((w) => w.status === 'active' && !failedFeeds.has(w.webcamId)).length}/{displayedWebcams().length} ACTIVE
			</span>
		</div>
	{/if}
</div>

<style>
	.webcam-window {
		position: fixed;
		min-width: 400px;
		max-width: 1200px;
		background: rgb(2 6 23 / 0.95);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border: 1px solid rgb(51 65 85 / 0.6);
		border-radius: 2px;
		box-shadow:
			0 25px 50px -12px rgb(0 0 0 / 0.5),
			0 0 0 1px rgb(6 182 212 / 0.1),
			0 0 30px rgb(6 182 212 / 0.1);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		transition: box-shadow 0.15s ease;
	}

	.webcam-window:hover {
		box-shadow:
			0 25px 50px -12px rgb(0 0 0 / 0.5),
			0 0 0 1px rgb(6 182 212 / 0.2),
			0 0 40px rgb(6 182 212 / 0.15);
	}

	.webcam-window.dragging,
	.webcam-window.resizing {
		box-shadow:
			0 30px 60px -15px rgb(0 0 0 / 0.6),
			0 0 0 2px rgb(6 182 212 / 0.4),
			0 0 50px rgb(6 182 212 / 0.2);
	}

	.webcam-window.dragging {
		cursor: grabbing;
	}

	.webcam-window.minimized {
		width: 340px !important;
		min-width: 340px;
		height: auto !important;
	}

	/* Resize Handles */
	.resize-handle {
		position: absolute;
		z-index: 20;
		background: transparent;
	}

	.resize-handle:hover {
		background: rgb(6 182 212 / 0.2);
	}

	.resize-n {
		top: 0;
		left: 8px;
		right: 8px;
		height: 6px;
		cursor: ns-resize;
	}

	.resize-s {
		bottom: 0;
		left: 8px;
		right: 8px;
		height: 6px;
		cursor: ns-resize;
	}

	.resize-e {
		top: 8px;
		right: 0;
		bottom: 8px;
		width: 6px;
		cursor: ew-resize;
	}

	.resize-w {
		top: 8px;
		left: 0;
		bottom: 8px;
		width: 6px;
		cursor: ew-resize;
	}

	.resize-ne {
		top: 0;
		right: 0;
		width: 12px;
		height: 12px;
		cursor: nesw-resize;
	}

	.resize-nw {
		top: 0;
		left: 0;
		width: 12px;
		height: 12px;
		cursor: nwse-resize;
	}

	.resize-se {
		bottom: 0;
		right: 0;
		width: 12px;
		height: 12px;
		cursor: nwse-resize;
	}

	.resize-sw {
		bottom: 0;
		left: 0;
		width: 12px;
		height: 12px;
		cursor: nesw-resize;
	}

	/* Corner resize indicators */
	.resize-se::after,
	.resize-sw::after,
	.resize-ne::after,
	.resize-nw::after {
		content: '';
		position: absolute;
		width: 8px;
		height: 8px;
		border-color: rgb(6 182 212 / 0.4);
		border-style: solid;
		border-width: 0;
	}

	.resize-se::after {
		bottom: 2px;
		right: 2px;
		border-right-width: 2px;
		border-bottom-width: 2px;
	}

	.resize-sw::after {
		bottom: 2px;
		left: 2px;
		border-left-width: 2px;
		border-bottom-width: 2px;
	}

	.resize-ne::after {
		top: 2px;
		right: 2px;
		border-right-width: 2px;
		border-top-width: 2px;
	}

	.resize-nw::after {
		top: 2px;
		left: 2px;
		border-left-width: 2px;
		border-top-width: 2px;
	}

	.resize-handle:hover::after {
		border-color: rgb(6 182 212 / 0.8);
	}

	/* Tech Corners */
	.tech-corner {
		position: absolute;
		width: 12px;
		height: 12px;
		pointer-events: none;
		z-index: 10;
	}

	.tech-corner.top-left {
		top: 0;
		left: 0;
		border-top: 2px solid rgb(34 211 238 / 0.8);
		border-left: 2px solid rgb(34 211 238 / 0.8);
	}

	.tech-corner.top-right {
		top: 0;
		right: 0;
		border-top: 2px solid rgb(34 211 238 / 0.8);
		border-right: 2px solid rgb(34 211 238 / 0.8);
	}

	.tech-corner.bottom-left {
		bottom: 0;
		left: 0;
		border-bottom: 2px solid rgb(34 211 238 / 0.8);
		border-left: 2px solid rgb(34 211 238 / 0.8);
	}

	.tech-corner.bottom-right {
		bottom: 0;
		right: 0;
		border-bottom: 2px solid rgb(34 211 238 / 0.8);
		border-right: 2px solid rgb(34 211 238 / 0.8);
	}

	/* Header */
	.window-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		background: rgb(15 23 42 / 0.95);
		border-bottom: 1px solid rgb(51 65 85 / 0.5);
		cursor: grab;
		user-select: none;
	}

	.window-header:active {
		cursor: grabbing;
	}

	.window-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.country-flag {
		font-size: 1rem;
		line-height: 1;
	}

	.country-name {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: rgb(226 232 240);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.webcam-count {
		font-size: 0.5625rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(34 211 238);
		background: rgb(34 211 238 / 0.1);
		padding: 0.125rem 0.375rem;
		border-radius: 2px;
		border: 1px solid rgb(34 211 238 / 0.3);
		letter-spacing: 0.05em;
	}

	.window-actions {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		background: rgb(15 23 42 / 0.8);
		border: 1px solid rgb(51 65 85 / 0.5);
		border-radius: 2px;
		color: rgb(148 163 184);
		cursor: pointer;
		font-size: 0.625rem;
		transition: all 0.15s ease;
	}

	.action-btn:hover:not(:disabled) {
		color: rgb(34 211 238);
		border-color: rgb(34 211 238 / 0.5);
		background: rgb(34 211 238 / 0.1);
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.close-btn:hover {
		color: rgb(248 113 113) !important;
		border-color: rgb(248 113 113 / 0.5) !important;
		background: rgb(248 113 113 / 0.1) !important;
	}

	/* Content */
	.window-content {
		flex: 1;
		overflow: hidden;
		min-height: 200px;
	}

	/* Loading State */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 280px;
		gap: 0.75rem;
		padding: 1.5rem;
		position: relative;
		overflow: hidden;
	}

	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 2px solid rgb(51 65 85);
		border-top-color: rgb(34 211 238);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-text {
		font-size: 0.6875rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		text-transform: uppercase;
		letter-spacing: 0.15em;
		color: rgb(34 211 238);
	}

	.loading-subtext {
		font-size: 0.5625rem;
		color: rgb(100 116 139);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.scan-line {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: linear-gradient(90deg, transparent, rgb(34 211 238 / 0.5), transparent);
		animation: scan 2s linear infinite;
	}

	@keyframes scan {
		0% {
			top: 0;
		}
		100% {
			top: 100%;
		}
	}

	/* Error State */
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 280px;
		gap: 0.75rem;
		padding: 1.5rem;
		text-align: center;
	}

	.error-icon {
		font-size: 2.5rem;
		opacity: 0.5;
	}

	.error-text {
		font-size: 0.6875rem;
		color: rgb(148 163 184);
		max-width: 200px;
		line-height: 1.4;
	}

	.retry-btn {
		margin-top: 0.5rem;
		padding: 0.5rem 1rem;
		font-size: 0.5625rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: rgb(34 211 238);
		background: rgb(34 211 238 / 0.1);
		border: 1px solid rgb(34 211 238 / 0.3);
		border-radius: 2px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.retry-btn:hover {
		background: rgb(34 211 238 / 0.2);
		border-color: rgb(34 211 238 / 0.5);
	}

	/* No Feeds State */
	.no-feeds-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 280px;
		gap: 0.5rem;
		padding: 1.5rem;
		text-align: center;
	}

	.no-feeds-icon {
		font-size: 2.5rem;
		opacity: 0.4;
	}

	.no-feeds-text {
		font-size: 0.6875rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: rgb(148 163 184);
	}

	.no-feeds-subtext {
		font-size: 0.5625rem;
		color: rgb(100 116 139);
	}

	/* Gallery Grid */
	.gallery-grid {
		display: grid;
		gap: 2px;
		padding: 2px;
		background: rgb(15 23 42);
	}

	.gallery-grid.grid-cols-1 {
		grid-template-columns: 1fr;
	}

	.gallery-grid.grid-cols-2 {
		grid-template-columns: repeat(2, 1fr);
	}

	.gallery-grid.grid-cols-3 {
		grid-template-columns: repeat(3, 1fr);
	}

	/* Feed Container */
	.feed-container {
		display: flex;
		flex-direction: column;
		background: rgb(2 6 23);
		border: 1px solid rgb(51 65 85 / 0.3);
	}

	/* Feed Header */
	.feed-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.25rem 0.5rem;
		background: rgb(15 23 42 / 0.9);
		border-bottom: 1px solid rgb(51 65 85 / 0.3);
	}

	.feed-title {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.5625rem;
		font-weight: 600;
		color: rgb(203 213 225);
		text-transform: uppercase;
		letter-spacing: 0.03em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 140px;
	}

	.category-icon {
		font-size: 0.625rem;
	}

	.feed-badges {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.threat-badge {
		font-size: 0.4375rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--threat-color);
		background: color-mix(in srgb, var(--threat-color) 15%, transparent);
		padding: 0.0625rem 0.25rem;
		border-radius: 2px;
		border: 1px solid color-mix(in srgb, var(--threat-color) 40%, transparent);
		letter-spacing: 0.05em;
	}

	.feed-container.strategic {
		border-color: rgb(234 179 8 / 0.3);
	}

	.feed-container.strategic .feed-header {
		background: rgb(234 179 8 / 0.1);
		border-bottom-color: rgb(234 179 8 / 0.2);
	}

	.live-badge {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.5rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(34 197 94);
		background: rgb(34 197 94 / 0.15);
		padding: 0.125rem 0.375rem;
		border-radius: 2px;
		border: 1px solid rgb(34 197 94 / 0.3);
		letter-spacing: 0.08em;
	}

	.live-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: rgb(34 197 94);
		animation: blink 1.5s infinite;
	}

	@keyframes blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}

	.down-badge {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.5rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(239 68 68);
		background: rgb(239 68 68 / 0.15);
		padding: 0.125rem 0.375rem;
		border-radius: 2px;
		border: 1px solid rgb(239 68 68 / 0.3);
		letter-spacing: 0.08em;
	}

	.down-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: rgb(239 68 68);
	}

	/* Feed Content */
	.feed-content {
		position: relative;
		aspect-ratio: 16 / 9;
		background: rgb(0 0 0);
		overflow: hidden;
		/* Windy webcam player requires minimum 200x110px */
		min-width: 200px;
		min-height: 112px;
	}

	/* Down State */
	.down-state {
		position: absolute;
		inset: 0;
		background: rgb(0 0 0);
	}

	.down-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.static-noise {
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(
				0deg,
				transparent,
				transparent 2px,
				rgb(30 30 30 / 0.3) 2px,
				rgb(30 30 30 / 0.3) 4px
			),
			repeating-linear-gradient(
				90deg,
				transparent,
				transparent 2px,
				rgb(30 30 30 / 0.3) 2px,
				rgb(30 30 30 / 0.3) 4px
			);
		animation: noise 0.5s steps(5) infinite;
		opacity: 0.5;
	}

	@keyframes noise {
		0%,
		100% {
			transform: translate(0, 0);
		}
		25% {
			transform: translate(-1px, 1px);
		}
		50% {
			transform: translate(1px, -1px);
		}
		75% {
			transform: translate(-1px, -1px);
		}
	}

	.down-info {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		text-align: center;
	}

	.down-icon {
		font-size: 1.25rem;
		color: rgb(239 68 68 / 0.8);
	}

	.down-label {
		font-size: 0.625rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(239 68 68);
		letter-spacing: 0.1em;
	}

	.down-sublabel {
		font-size: 0.5rem;
		color: rgb(100 116 139);
		max-width: 140px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.retry-feed-btn {
		margin-top: 0.5rem;
		padding: 0.25rem 0.5rem;
		font-size: 0.5rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: rgb(34 211 238);
		background: rgb(34 211 238 / 0.1);
		border: 1px solid rgb(34 211 238 / 0.3);
		border-radius: 2px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.retry-feed-btn:hover {
		background: rgb(34 211 238 / 0.2);
		border-color: rgb(34 211 238 / 0.5);
	}

	/* Embed Wrapper */
	.embed-wrapper {
		position: absolute;
		inset: 0;
	}

	/* Feed Loading State */
	.feed-loading {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		background: rgb(0 0 0 / 0.8);
		z-index: 5;
	}

	.feed-loading span {
		font-size: 0.5rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(34 211 238);
		letter-spacing: 0.1em;
	}

	.feed-loading-spinner {
		width: 24px;
		height: 24px;
		border: 2px solid rgb(51 65 85);
		border-top-color: rgb(34 211 238);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.feed-iframe {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		border: none;
	}

	.feed-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 0.375rem;
	}

	.live-indicator {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		align-self: flex-start;
	}

	.pulse-ring {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: rgb(239 68 68);
		box-shadow: 0 0 0 0 rgb(239 68 68 / 0.7);
		animation: pulse-ring 1.5s infinite;
	}

	@keyframes pulse-ring {
		0% {
			box-shadow: 0 0 0 0 rgb(239 68 68 / 0.7);
		}
		70% {
			box-shadow: 0 0 0 6px rgb(239 68 68 / 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgb(239 68 68 / 0);
		}
	}

	.live-text {
		font-size: 0.5rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(239 68 68);
		text-shadow: 0 1px 2px rgb(0 0 0 / 0.8);
		letter-spacing: 0.05em;
	}

	.feed-location {
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(255 255 255 / 0.9);
		text-shadow: 0 1px 3px rgb(0 0 0 / 0.9);
		background: rgb(0 0 0 / 0.5);
		padding: 0.125rem 0.25rem;
		border-radius: 2px;
		align-self: flex-start;
		max-width: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* External Feed - Non-embeddable webcams */
	.external-feed {
		position: absolute;
		inset: 0;
	}

	.external-preview {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.preview-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: brightness(0.5) saturate(0.8);
	}

	.placeholder-preview {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		background: rgb(15 23 42);
		position: relative;
		overflow: hidden;
	}

	.placeholder-grid {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(90deg, rgb(51 65 85 / 0.1) 1px, transparent 1px),
			linear-gradient(rgb(51 65 85 / 0.1) 1px, transparent 1px);
		background-size: 20px 20px;
	}

	.placeholder-icon {
		font-size: 1.5rem;
		opacity: 0.4;
		z-index: 1;
	}

	.placeholder-text {
		font-size: 0.5rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(100 116 139);
		letter-spacing: 0.1em;
		z-index: 1;
	}

	.external-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		background: rgb(0 0 0 / 0.7);
		opacity: 1;
		transition: all 0.2s ease;
	}

	.external-preview:hover .external-overlay {
		background: rgb(0 0 0 / 0.8);
	}

	.external-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		text-align: center;
	}

	.external-icon {
		font-size: 1.25rem;
		opacity: 0.7;
	}

	.external-label {
		font-size: 0.5rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(251 191 36);
		letter-spacing: 0.1em;
	}

	.external-sublabel {
		font-size: 0.5rem;
		color: rgb(148 163 184);
		max-width: 140px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.open-external-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.5rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: rgb(255 255 255);
		background: rgb(34 211 238 / 0.9);
		border: 1px solid rgb(34 211 238);
		border-radius: 2px;
		text-decoration: none;
		transition: all 0.15s ease;
		cursor: pointer;
	}

	.open-external-btn:hover {
		background: rgb(34 211 238);
		transform: scale(1.05);
		box-shadow: 0 0 20px rgb(34 211 238 / 0.4);
	}

	.btn-icon {
		font-size: 0.625rem;
	}

	/* More Feeds Indicator */
	/* Pagination Controls */
	.pagination-controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: rgb(15 23 42 / 0.8);
		border-top: 1px solid rgb(51 65 85 / 0.3);
	}

	.page-btn {
		padding: 0.25rem 0.5rem;
		background: rgb(30 41 59 / 0.8);
		border: 1px solid rgb(51 65 85);
		border-radius: 2px;
		color: rgb(148 163 184);
		font-size: 0.625rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.page-btn:hover:not(:disabled) {
		background: rgb(6 182 212 / 0.2);
		border-color: rgb(6 182 212);
		color: rgb(6 182 212);
	}

	.page-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.page-info {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-family: 'SF Mono', Monaco, monospace;
		font-size: 0.5625rem;
	}

	.page-current {
		color: rgb(6 182 212);
		font-weight: 700;
	}

	.page-sep {
		color: rgb(100 116 139);
	}

	.page-total {
		color: rgb(148 163 184);
	}

	.feed-range {
		color: rgb(100 116 139);
		margin-left: 0.25rem;
	}

	.show-all-btn {
		padding: 0.25rem 0.5rem;
		background: rgb(6 182 212 / 0.15);
		border: 1px solid rgb(6 182 212 / 0.5);
		border-radius: 2px;
		color: rgb(6 182 212);
		font-size: 0.5rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		letter-spacing: 0.05em;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.show-all-btn:hover {
		background: rgb(6 182 212 / 0.25);
		border-color: rgb(6 182 212);
	}

	.showing-all {
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(100 116 139);
	}

	/* Show All Grid Mode */
	.gallery-grid.show-all-grid {
		max-height: 400px;
		overflow-y: auto;
		grid-template-columns: repeat(3, 1fr);
	}

	.gallery-grid.show-all-grid::-webkit-scrollbar {
		width: 4px;
	}

	.gallery-grid.show-all-grid::-webkit-scrollbar-track {
		background: transparent;
	}

	.gallery-grid.show-all-grid::-webkit-scrollbar-thumb {
		background: rgb(51 65 85);
		border-radius: 2px;
	}

	.more-feeds-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		background: rgb(15 23 42 / 0.8);
		border-top: 1px solid rgb(51 65 85 / 0.3);
	}

	.more-count {
		font-size: 0.5rem;
		font-weight: 600;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(100 116 139);
		letter-spacing: 0.05em;
	}

	/* Status Bar */
	.window-statusbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.375rem 0.75rem;
		background: rgb(15 23 42 / 0.95);
		border-top: 1px solid rgb(51 65 85 / 0.3);
	}

	.status-indicator {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.5rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: rgb(34 211 238);
	}

	.status-pulse {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: rgb(34 211 238);
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.5;
			transform: scale(0.8);
		}
	}

	.feed-stats {
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(100 116 139);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
</style>
