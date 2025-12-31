<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import SidebarProvider from '../features/sidebar/index.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<SidebarProvider>
    {@render children()}
</SidebarProvider>