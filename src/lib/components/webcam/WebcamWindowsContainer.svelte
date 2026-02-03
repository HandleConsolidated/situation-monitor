<script lang="ts">
	import { webcamWindows } from '$lib/stores/webcam';
	import WebcamWindow from './WebcamWindow.svelte';
</script>

<!-- Render all open webcam windows -->
{#each $webcamWindows as windowState, i (windowState.id)}
	<WebcamWindow {windowState} zIndex={i} />
{/each}
