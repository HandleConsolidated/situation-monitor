<script lang="ts">
	interface Props {
		text: string;
		variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'critical' | 'neutral';
		size?: 'sm' | 'md';
	}

	let { text, variant = 'default', size = 'sm' }: Props = $props();

	const variantClasses: Record<string, string> = {
		critical: 'bg-red-950/50 text-red-500 border-red-800/50',
		danger: 'bg-red-950/50 text-red-500 border-red-800/50',
		warning: 'bg-amber-950/50 text-amber-500 border-amber-800/50',
		success: 'bg-emerald-950/50 text-emerald-500 border-emerald-800/50',
		neutral: 'bg-slate-800/50 text-slate-400 border-slate-700/50',
		default: 'bg-slate-800/50 text-slate-400 border-slate-700/50',
		info: 'bg-cyan-950/50 text-cyan-400 border-cyan-800/50'
	};

	const classes = $derived(variantClasses[variant] || variantClasses.default);
</script>

<span
	class="badge {size === 'md' ? 'badge--md' : 'badge--sm'} {classes}"
>
	{text}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		font-family: 'SF Mono', Monaco, monospace;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-radius: 2px;
		border-width: 1px;
		line-height: var(--lh-tight);
	}

	.badge--sm {
		font-size: var(--fs-2xs); /* 8px → 9px responsive */
		padding: var(--sp-xs) var(--sp-sm);
	}

	.badge--md {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		padding: var(--sp-xs) var(--sp-md);
	}
</style>
