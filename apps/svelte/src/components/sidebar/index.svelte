<script lang="ts">
	import SidebarLink from './sidebar-link.svelte';
	import { User, Users } from '@lucide/svelte';
</script>

<aside
	class="sticky top-0 left-0 m-2 flex h-[calc(100vh-1rem)] w-64 flex-col rounded-lg border border-gray-200 bg-gray-50 p-4"
>
	<nav class="flex h-full flex-col gap-4">
		<p>SkyHR</p>

		<ul class="flex flex-col gap-2 text-gray-600 transition-colors duration-200 hover:text-brand">
			<li class="flex items-center gap-2">
				<User class="h-4 w-4" />
				<p class="text-sm">Gestionar personas</p>
			</li>
			<SidebarLink href="/attendance">Asistencia</SidebarLink>
			<SidebarLink href="/employees">Empleados</SidebarLink>
			<SidebarLink href="/visitors">Visitantes</SidebarLink>
			<SidebarLink href="/permissions">Permisos</SidebarLink>
		</ul>

		<ul class="flex flex-col gap-2 text-gray-600 transition-colors duration-200 hover:text-brand">
			<li class="flex items-center gap-2">
				<Users class="h-4 w-4" />
				<p class="text-sm">Gestionar organización</p>
			</li>
			<SidebarLink href="/locations">Sucursales</SidebarLink>
			<SidebarLink href="/schedules">Horarios</SidebarLink>
			<SidebarLink href="/announcements">Anuncios</SidebarLink>
		</ul>

		<footer class="align-self-end mt-auto flex items-center gap-2 rounded-lg bg-gray-100 px-2 py-4">
			<div class="user_icon flex h-10 w-10 items-center justify-center rounded-full bg-white">
				<User class="h-5 w-5" color="#4B5563" />
			</div>
			<div class="user_info flex flex-col gap-1">
				<p class="text-sm font-medium">John Doe</p>
				<p class="text-xs text-gray-500">john.doe@example.com</p>
			</div>
		</footer>
	</nav>
</aside>
