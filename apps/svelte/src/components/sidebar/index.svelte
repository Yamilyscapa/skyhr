<script lang="ts">
	import SidebarLink from './sidebar-link.svelte';
	import { User, Users } from '@lucide/svelte';
</script>

<aside class="w-64 h-[calc(100vh-1rem)] sticky left-0 top-0 bg-gray-50 border border-gray-200 p-4 m-2 rounded-lg flex flex-col">
	<nav class="flex flex-col gap-4 h-full">
        <p>SkyHR</p>

		<ul class="flex flex-col gap-2 text-gray-600 hover:text-brand transition-colors duration-200">
			<li class="flex items-center gap-2">
				<User class="w-4 h-4" />
				<p class="text-sm">Gestionar personas</p>
			</li>
			<SidebarLink href="/attendance">Asistencia</SidebarLink>
			<SidebarLink href="/employees">Empleados</SidebarLink>
			<SidebarLink href="/visitors">Visitantes</SidebarLink>
			<SidebarLink href="/permissions">Permisos</SidebarLink>
		</ul>

		<ul class="flex flex-col gap-2 text-gray-600 hover:text-brand transition-colors duration-200">
			<li class="flex items-center gap-2">
				<Users class="w-4 h-4" />
				<p class="text-sm">Gestionar organización</p>
			</li>
			<SidebarLink href="/locations">Sucursales</SidebarLink>
			<SidebarLink href="/schedules">Horarios</SidebarLink>
			<SidebarLink href="/announcements">Anuncios</SidebarLink>
		</ul>

		<footer class="mt-auto bg-gray-100 px-2 py-4 rounded-lg flex items-center gap-2 align-self-end"> 
			<div class="user_icon flex items-center justify-center w-10 h-10 bg-white rounded-full">
				<User class="w-5 h-5" color="#4B5563" />
			</div>
			<div class="user_info flex flex-col gap-1">
				<p class="text-sm font-medium">John Doe</p>
				<p class="text-xs text-gray-500">john.doe@example.com</p>
			</div>
		</footer>
	</nav>
</aside>
