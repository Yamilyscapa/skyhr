<script lang="ts">
	import type { Snippet } from 'svelte';

	interface ButtonProps {
		children: Snippet;
		disabled?: boolean;
		full?: boolean;
		href?: string | null;
	}

	const { disabled = false, children, full = false, href = null }: ButtonProps = $props();

	const styles = {
		base: `w-fit block text-center bg-brand text-white px-8 py-2 rounded-full cursor-pointer text-md ${full ? ' w-full' : ''}`
	};
</script>

{#if href}
	<a {href} class={styles.base}>
		{@render children()}
	</a>
{:else}
	<button class={styles.base} {disabled}>
		{@render children()}
	</button>
{/if}
