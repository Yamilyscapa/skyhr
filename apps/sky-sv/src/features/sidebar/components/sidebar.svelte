<script lang="ts">
    import { getContext } from 'svelte';
    
    const sidebarContext = getContext<{ collapsed: boolean }>('sidebar');
    $: collapsed = sidebarContext?.collapsed ?? false;
</script>

<aside class="sidebar" class:collapsed style:grid-area="sidebar">
    <nav>
        <ul>
            <li>
                <a href="/">
                    <span>Home</span>
                </a>
            </li>
        </ul>
    </nav>
</aside>

<style lang="scss">
    .sidebar {
        grid-area: sidebar;
        width: var(--sidebar-width);
        height: 100vh;
        padding: var(--spacing-2);
        overflow-y: auto;
        overflow-x: hidden;
        transition: transform 0.3s ease, opacity 0.3s ease;
        
        &.collapsed {
            opacity: 0;
            pointer-events: none;
            transform: translateX(-100%);
        }
        
        nav {
            width: 100%;
            height: 100%;
            background-color: #fafafa;
            border-radius: var(--spacing-2);
            padding: var(--spacing-3);
            border: 1px solid #d2d2d2;
        }
    }
    
    @media (max-width: 768px) {
        .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            z-index: 1000;
            box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
            
            &.collapsed {
                transform: translateX(-100%);
            }
        }
    }
</style> 