<!-- Sidebar Provider -->
<script lang="ts">
    import { setContext } from 'svelte';
    import Sidebar from './components/sidebar.svelte';
    
    let { children, collapsed = $bindable(false) } = $props();
    
    setContext('sidebar', { collapsed });
</script>

<div class="sidebar-container" class:collapsed>
    <Sidebar />
    <main class="content">
        {@render children()}
    </main>
</div>

<style lang="scss">
    .sidebar-container {
        display: grid;
        grid-template-columns: var(--sidebar-width) 1fr;
        grid-template-rows: 100vh;
        grid-template-areas: "sidebar content";
        width: 100%;
        height: 100vh;
        overflow: hidden;
        transition: grid-template-columns 0.3s ease;
        
        &.collapsed {
            grid-template-columns: 0 1fr;
        }
    }
    
    .content {
        grid-area: content;
        overflow-y: auto;
        overflow-x: hidden;
        height: 100vh;
        width: 100%;
    }
    
    @media (max-width: 768px) {
        .sidebar-container {
            grid-template-columns: 1fr;
            grid-template-areas: "content";
        }
    }
</style>