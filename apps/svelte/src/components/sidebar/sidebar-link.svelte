<script lang="ts">
    import type { Snippet } from "svelte";
    import { cn } from "@sglara/cn";

    interface SidebarLinkProps {
        children: Snippet;
        href: string;
        style?: string;
    }

    const { children, href, style }: SidebarLinkProps = $props();
</script>

<li>
    <a class={cn("text-sm block p-2 py-1 rounded-md text-gray-600 hover:text-gray-700 hover:bg-gray-100", style)} href={href}>{@render children()}</a>
</li>