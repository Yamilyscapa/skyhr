<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '@sglara/cn';

	interface SidebarLinkProps {
		children: Snippet;
		href: string;
		style?: string;
	}

	const { children, href, style }: SidebarLinkProps = $props();
</script>

<li>
	<a
		class={cn(
			'block rounded-md p-2 py-1 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-700',
			style
		)}
		{href}>{@render children()}</a
	>
</li>
