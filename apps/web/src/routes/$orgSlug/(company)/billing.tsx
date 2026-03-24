import { createFileRoute } from "@tanstack/react-router";
import { OrganizationBillingPage } from "@/features/billing/pages/OrganizationBillingPage";

export const Route = createFileRoute("/$orgSlug/(company)/billing")({
  component: OrganizationBillingPage,
});
