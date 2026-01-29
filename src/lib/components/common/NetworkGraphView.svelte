<script lang="ts">
	import { onMount } from 'svelte';
	import type { NetworkGraph, GraphNode, GraphEdge } from '$lib/types/intelligence';

	export let graph: NetworkGraph;
	export let width = 800;
	export let height = 600;

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let hoveredNode: GraphNode | null = null;
	let selectedNode: GraphNode | null = null;

	// Force simulation parameters
	const REPULSION = 1000;
	const ATTRACTION = 0.01;
	const DAMPING = 0.9;
	const MIN_DISTANCE = 50;

	// Initialize node positions if not set
	$: if (graph) {
		graph.nodes.forEach((node, i) => {
			if (!node.position) {
				// Circular layout initially
				const angle = (i / graph.nodes.length) * 2 * Math.PI;
				const radius = Math.min(width, height) * 0.35;
				node.position = {
					x: width / 2 + Math.cos(angle) * radius,
					y: height / 2 + Math.sin(angle) * radius
				};
			}
			// Add velocity if not present
			if (!(node as any).vx) (node as any).vx = 0;
			if (!(node as any).vy) (node as any).vy = 0;
		});
	}

	onMount(() => {
		ctx = canvas.getContext('2d')!;
		let animationId: number;
		let running = true;

		function simulate() {
			if (!running) return;

			// Apply forces
			applyForces(graph);

			// Render
			render(graph);

			animationId = requestAnimationFrame(simulate);
		}

		simulate();

		return () => {
			running = false;
			cancelAnimationFrame(animationId);
		};
	});

	function applyForces(graph: NetworkGraph) {
		const nodes = graph.nodes as any[];

		// Repulsion between all nodes
		for (let i = 0; i < nodes.length; i++) {
			for (let j = i + 1; j < nodes.length; j++) {
				const nodeA = nodes[i];
				const nodeB = nodes[j];

				const dx = nodeB.position.x - nodeA.position.x;
				const dy = nodeB.position.y - nodeA.position.y;
				const distance = Math.sqrt(dx * dx + dy * dy) || 1;

				if (distance < MIN_DISTANCE) continue;

				const force = REPULSION / (distance * distance);
				const fx = (dx / distance) * force;
				const fy = (dy / distance) * force;

				nodeA.vx -= fx;
				nodeA.vy -= fy;
				nodeB.vx += fx;
				nodeB.vy += fy;
			}
		}

		// Attraction along edges
		graph.edges.forEach(edge => {
			const source = nodes.find(n => n.id === edge.source);
			const target = nodes.find(n => n.id === edge.target);
			if (!source || !target) return;

			const dx = target.position.x - source.position.x;
			const dy = target.position.y - source.position.y;
			const distance = Math.sqrt(dx * dx + dy * dy) || 1;

			const force = distance * ATTRACTION * edge.strength;
			const fx = (dx / distance) * force;
			const fy = (dy / distance) * force;

			source.vx += fx;
			source.vy += fy;
			target.vx -= fx;
			target.vy -= fy;
		});

		// Pull toward center (gently)
		nodes.forEach(node => {
			const dx = width / 2 - node.position.x;
			const dy = height / 2 - node.position.y;
			node.vx += dx * 0.001;
			node.vy += dy * 0.001;
		});

		// Update positions
		nodes.forEach(node => {
			node.position.x += node.vx;
			node.position.y += node.vy;

			// Damping
			node.vx *= DAMPING;
			node.vy *= DAMPING;

			// Boundary constraints
			const margin = 30;
			node.position.x = Math.max(margin, Math.min(width - margin, node.position.x));
			node.position.y = Math.max(margin, Math.min(height - margin, node.position.y));
		});
	}

	function render(graph: NetworkGraph) {
		ctx.clearRect(0, 0, width, height);

		// Draw edges first
		graph.edges.forEach(edge => {
			const source = graph.nodes.find(n => n.id === edge.source);
			const target = graph.nodes.find(n => n.id === edge.target);
			if (!source || !target || !source.position || !target.position) return;

			ctx.beginPath();
			ctx.moveTo(source.position.x, source.position.y);
			ctx.lineTo(target.position.x, target.position.y);

			const alpha = edge.strength * 0.6;
			ctx.strokeStyle = edge.color || `rgba(148, 163, 184, ${alpha})`;
			ctx.lineWidth = edge.strength * 2;
			ctx.stroke();

			// Draw arrow if directed
			if (!edge.bidirectional) {
				drawArrow(ctx, source.position, target.position);
			}
		});

		// Draw nodes
		graph.nodes.forEach(node => {
			if (!node.position) return;

			const radius = 5 + node.importance * 15;
			const isHovered = hoveredNode?.id === node.id;
			const isSelected = selectedNode?.id === node.id;

			ctx.beginPath();
			ctx.arc(node.position.x, node.position.y, radius, 0, 2 * Math.PI);

			// Node color by type
			const color = node.color || getNodeColor(node.type);
			ctx.fillStyle = isSelected ? '#3b82f6' : isHovered ? lighten(color) : color;
			ctx.fill();

			// Border
			if (isHovered || isSelected) {
				ctx.strokeStyle = '#fff';
				ctx.lineWidth = 2;
				ctx.stroke();
			}

			// Label
			ctx.fillStyle = '#fff';
			ctx.font = `${10 + node.importance * 4}px sans-serif`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(truncate(node.label, 20), node.position.x, node.position.y - radius - 10);
		});

		// Draw hover tooltip
		if (hoveredNode) {
			drawTooltip(ctx, hoveredNode);
		}
	}

	function drawArrow(
		ctx: CanvasRenderingContext2D,
		from: { x: number; y: number },
		to: { x: number; y: number }
	) {
		const headlen = 10;
		const angle = Math.atan2(to.y - from.y, to.x - from.x);

		// Arrow point is 80% along the edge
		const x = from.x + (to.x - from.x) * 0.8;
		const y = from.y + (to.y - from.y) * 0.8;

		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x - headlen * Math.cos(angle - Math.PI / 6), y - headlen * Math.sin(angle - Math.PI / 6));
		ctx.lineTo(x - headlen * Math.cos(angle + Math.PI / 6), y - headlen * Math.sin(angle + Math.PI / 6));
		ctx.closePath();
		ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
		ctx.fill();
	}

	function drawTooltip(ctx: CanvasRenderingContext2D, node: GraphNode) {
		if (!node.position) return;

		const padding = 8;
		const lines = [
			`${node.label}`,
			`Type: ${node.type}`,
			`Importance: ${Math.round(node.importance * 100)}%`
		];

		ctx.font = '12px sans-serif';
		const maxWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
		const boxWidth = maxWidth + padding * 2;
		const boxHeight = lines.length * 18 + padding * 2;

		let x = node.position.x + 20;
		let y = node.position.y - boxHeight / 2;

		// Keep tooltip in bounds
		if (x + boxWidth > width) x = node.position.x - boxWidth - 20;
		if (y < 0) y = 0;
		if (y + boxHeight > height) y = height - boxHeight;

		// Draw background
		ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
		ctx.fillRect(x, y, boxWidth, boxHeight);

		// Draw border
		ctx.strokeStyle = '#475569';
		ctx.lineWidth = 1;
		ctx.strokeRect(x, y, boxWidth, boxHeight);

		// Draw text
		ctx.fillStyle = '#fff';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';
		lines.forEach((line, i) => {
			ctx.fillText(line, x + padding, y + padding + i * 18);
		});
	}

	function getNodeColor(type: GraphNode['type']): string {
		const colors: Record<GraphNode['type'], string> = {
			event: '#ef4444',
			entity: '#3b82f6',
			location: '#10b981',
			person: '#f59e0b',
			organization: '#8b5cf6',
			ship: '#06b6d4',
			market: '#ec4899',
			topic: '#6366f1'
		};
		return colors[type] || '#64748b';
	}

	function lighten(color: string): string {
		// Simple lighten - just increase opacity
		if (color.startsWith('#')) {
			const r = parseInt(color.slice(1, 3), 16);
			const g = parseInt(color.slice(3, 5), 16);
			const b = parseInt(color.slice(5, 7), 16);
			return `rgb(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)})`;
		}
		return color;
	}

	function truncate(str: string, maxLen: number): string {
		return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
	}

	function handleMouseMove(e: MouseEvent) {
		const rect = canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		hoveredNode = graph.nodes.find(node => {
			if (!node.position) return false;
			const radius = 5 + node.importance * 15;
			const dx = x - node.position.x;
			const dy = y - node.position.y;
			return Math.sqrt(dx * dx + dy * dy) < radius;
		}) || null;

		canvas.style.cursor = hoveredNode ? 'pointer' : 'default';
	}

	function handleClick(e: MouseEvent) {
		const rect = canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		const clickedNode = graph.nodes.find(node => {
			if (!node.position) return false;
			const radius = 5 + node.importance * 15;
			const dx = x - node.position.x;
			const dy = y - node.position.y;
			return Math.sqrt(dx * dx + dy * dy) < radius;
		});

		selectedNode = clickedNode || null;
	}
</script>

<div class="network-graph-container">
	<canvas
		bind:this={canvas}
		{width}
		{height}
		class="bg-slate-900 rounded-lg border border-slate-700"
		on:mousemove={handleMouseMove}
		on:click={handleClick}
	/>

	{#if selectedNode}
		<div class="mt-4 p-4 bg-slate-800 rounded-lg border border-slate-700">
			<h3 class="font-semibold text-white mb-2">{selectedNode.label}</h3>
			<div class="text-sm text-slate-300 space-y-1">
				<div><span class="text-slate-400">Type:</span> {selectedNode.type}</div>
				<div><span class="text-slate-400">Category:</span> {selectedNode.category || 'N/A'}</div>
				<div><span class="text-slate-400">Importance:</span> {Math.round(selectedNode.importance * 100)}%</div>
				{#if Object.keys(selectedNode.properties).length > 0}
					<div class="mt-2 pt-2 border-t border-slate-700">
						<div class="text-slate-400 text-xs mb-1">Properties:</div>
						{#each Object.entries(selectedNode.properties) as [key, value]}
							<div class="text-xs"><span class="text-slate-500">{key}:</span> {value}</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<div class="mt-4 flex gap-2 text-xs text-slate-400">
		<div class="flex items-center gap-1">
			<div class="w-3 h-3 rounded-full bg-red-500"></div>
			<span>Events</span>
		</div>
		<div class="flex items-center gap-1">
			<div class="w-3 h-3 rounded-full bg-blue-500"></div>
			<span>Entities</span>
		</div>
		<div class="flex items-center gap-1">
			<div class="w-3 h-3 rounded-full bg-green-500"></div>
			<span>Locations</span>
		</div>
		<div class="flex items-center gap-1">
			<div class="w-3 h-3 rounded-full bg-cyan-500"></div>
			<span>Ships</span>
		</div>
		<div class="flex items-center gap-1">
			<div class="w-3 h-3 rounded-full bg-indigo-500"></div>
			<span>Topics</span>
		</div>
	</div>
</div>

<style>
	.network-graph-container {
		@apply w-full;
	}
</style>
