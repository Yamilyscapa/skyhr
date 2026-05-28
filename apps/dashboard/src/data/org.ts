import type { AdminUser, Org } from "./types";

export const org: Org = {
  id: "org_skyhr_demo",
  name: "Grupo Aurora",
  slug: "grupo-aurora",
  plan: "Business",
  seatsUsed: 48,
  seatsTotal: 60,
};

export const currentAdmin: AdminUser = {
  id: "usr_admin_01",
  name: "Daniela Reyes",
  email: "daniela.reyes@grupoaurora.mx",
  role: "Administradora",
};

export const locations = [
  "Oficina Central",
  "Planta Norte",
  "Sucursal Polanco",
  "Almacén Sur",
] as const;
