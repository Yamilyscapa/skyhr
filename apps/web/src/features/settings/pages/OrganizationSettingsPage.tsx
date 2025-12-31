import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import API, { type OrganizationSettings as ApiOrganizationSettings } from "@/api";
import { authClient } from "@/lib/auth-client";
import {
  useIsOrgAdmin,
  useOrganizationStore,
  type Organization,
  attachCurrentMemberData,
} from "@/store/organization-store";
import { useUserStore } from "@/store/user-store";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

type FormState = {
  name: string;
  logo: string;
  supportEmail: string;
  gracePeriodMinutes: string;
  extraHourCost: string;
};

type OrganizationMetadata = Record<string, any> & {
  supportEmail?: string;
};

const DEFAULT_FORM_STATE: FormState = {
  name: "",
  logo: "",
  supportEmail: "",
  gracePeriodMinutes: "",
  extraHourCost: "",
};

function parseMetadata(metadata: unknown): OrganizationMetadata {
  if (!metadata) {
    return {};
  }

  if (typeof metadata === "string") {
    try {
      return JSON.parse(metadata) ?? {};
    } catch (error) {
      console.warn("Failed to parse organization metadata", error);
      return {};
    }
  }

  if (typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as OrganizationMetadata;
  }

  return {};
}

function buildFormState(
  organization: Organization | null,
  metadata: OrganizationMetadata,
  settings: ApiOrganizationSettings | null,
): FormState {
  if (!organization) {
    return DEFAULT_FORM_STATE;
  }

  const gracePeriodValue =
    settings?.grace_period_minutes !== undefined &&
    settings?.grace_period_minutes !== null
      ? String(settings.grace_period_minutes)
      : "";
  const extraHourCostValue =
    settings?.extra_hour_cost !== undefined &&
    settings?.extra_hour_cost !== null
      ? String(settings.extra_hour_cost)
      : "";

  return {
    name: organization.name ?? "",
    logo: organization.logo ?? "",
    supportEmail: metadata.supportEmail ?? "",
    gracePeriodMinutes: gracePeriodValue,
    extraHourCost: extraHourCostValue,
  };
}

export function OrganizationSettingsPage() {
  const { organization, setOrganization } = useOrganizationStore();
  const user = useUserStore((state) => state.user);
  const canEdit = useIsOrgAdmin();
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [organizationSettings, setOrganizationSettings] = useState<ApiOrganizationSettings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsReloadKey, setSettingsReloadKey] = useState(0);

  const metadata = useMemo(
    () => parseMetadata(organization?.metadata),
    [organization?.metadata, organization?.id],
  );

  const metadataSignature = useMemo(
    () => JSON.stringify(metadata),
    [metadata],
  );

  const organizationSettingsSignature = useMemo(
    () => JSON.stringify(organizationSettings ?? null),
    [organizationSettings],
  );

  const initialState = useMemo(
    () => buildFormState(organization, metadata, organizationSettings),
    [
      organization?.id,
      organization?.name,
      organization?.slug,
      organization?.logo,
      metadataSignature,
      organizationSettingsSignature,
    ],
  );

  const [formState, setFormState] = useState<FormState>(initialState);

  useEffect(() => {
    setFormState(initialState);
  }, [initialState]);

  useEffect(() => {
    let ignore = false;
    if (organization || isBootstrapping) {
      return;
    }

    const fetchOrganization = async () => {
      setIsBootstrapping(true);
      try {
        const result = await authClient.organization.getFullOrganization();
        if (!ignore) {
          const enriched = attachCurrentMemberData(result?.data ?? null, user);
          setOrganization(enriched);
        }
      } catch (error) {
        console.error("Failed to load organization", error);
      } finally {
        if (!ignore) {
          setIsBootstrapping(false);
        }
      }
    };

    void fetchOrganization();

    return () => {
      ignore = true;
    };
  }, [organization, isBootstrapping, setOrganization, user]);

  useEffect(() => {
    if (!organization?.id) {
      setOrganizationSettings(null);
      setHasLoadedSettings(false);
      setIsLoadingSettings(false);
      setSettingsError(null);
      return;
    }

    let ignore = false;
    setIsLoadingSettings(true);
    setSettingsError(null);
    setHasLoadedSettings(false);

    const fetchSettings = async () => {
      try {
        const response = await API.getOrganizationSettings(organization.id);
        if (!ignore) {
          setOrganizationSettings(response?.data ?? null);
        }
      } catch (error) {
        console.error("Failed to load organization settings", error);
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo cargar la configuración de asistencia.";
        if (!ignore) {
          setSettingsError(message);
        }
        toast.error(message);
      } finally {
        if (!ignore) {
          setIsLoadingSettings(false);
          setHasLoadedSettings(true);
        }
      }
    };

    void fetchSettings();

    return () => {
      ignore = true;
    };
  }, [organization?.id, settingsReloadKey]);

  const isDirty = useMemo(() => {
    return JSON.stringify(formState) !== JSON.stringify(initialState);
  }, [formState, initialState]);

  const showSkeleton =
    (!organization && (isBootstrapping || isSaving)) ||
    (Boolean(organization) && (!hasLoadedSettings || isLoadingSettings));

  const handleReloadSettings = () => {
    setOrganizationSettings(null);
    setHasLoadedSettings(false);
    setSettingsReloadKey((prev) => prev + 1);
  };

  const updateField = (field: keyof FormState) => (value: string) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization?.id) {
      toast.error("No hay una organización activa para actualizar.");
      return;
    }

    if (!formState.name.trim()) {
      toast.error("El nombre de la organización es obligatorio.");
      return;
    }

    const normalizedName = formState.name.trim();
    const normalizedLogo = formState.logo.trim();
    const supportEmail = formState.supportEmail.trim();
    const gracePeriodInput = formState.gracePeriodMinutes.trim();
    const extraHourCostInput = formState.extraHourCost.trim();

    if (!gracePeriodInput) {
      toast.error("El tiempo de tolerancia es obligatorio.");
      return;
    }

    const gracePeriodMinutes = Number(gracePeriodInput);
    if (
      Number.isNaN(gracePeriodMinutes) ||
      gracePeriodMinutes < 0 ||
      gracePeriodMinutes > 60
    ) {
      toast.error("El tiempo de tolerancia debe estar entre 0 y 60 minutos.");
      return;
    }

    let extraHourCost = 0;
    if (extraHourCostInput) {
      extraHourCost = Number(extraHourCostInput);
      if (Number.isNaN(extraHourCost) || extraHourCost < 0) {
        toast.error("La tarifa estándar de horas extra debe ser un número mayor o igual a 0.");
        return;
      }
      extraHourCost = Number(extraHourCost.toFixed(2));
    } else if (organizationSettings?.extra_hour_cost) {
      extraHourCost = organizationSettings.extra_hour_cost;
    }

    const metadataPayload: OrganizationMetadata = {
      ...metadata,
    };

    if (supportEmail) {
      metadataPayload.supportEmail = supportEmail;
    } else {
      delete metadataPayload.supportEmail;
    }

    setIsSaving(true);
    try {
      const result = await authClient.organization.update({
        data: {
          name: normalizedName,
          logo: normalizedLogo || undefined,
          metadata: metadataPayload,
        },
      });

      if (result.error) {
        throw new Error(
          result.error.message ||
            "No se pudieron guardar los cambios de la organización.",
        );
      }

      const settingsResponse = await API.updateOrganizationSettings(organization.id, {
        grace_period_minutes: Math.round(gracePeriodMinutes),
        extra_hour_cost: extraHourCost,
      });

      if (settingsResponse?.data) {
        setOrganizationSettings(settingsResponse.data);
      }

      const refreshed = await authClient.organization.getFullOrganization();
      const enriched = attachCurrentMemberData(refreshed?.data ?? null, user);
      setOrganization(enriched);

      toast.success("Configuración de la organización actualizada.");
    } catch (error) {
      console.error("Failed to update organization", error);
      const message =
        error instanceof Error
          ? error.message
          : "Ocurrió un error al guardar la configuración.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  if (!organization && !isBootstrapping && !showSkeleton) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Sin organización activa</CardTitle>
            <CardDescription>
              Necesitas crear o activar una organización antes de configurar los
              ajustes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Si recientemente aceptaste una invitación, recarga la página o
              selecciona una organización existente.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link to="/(organization)/create-organization">
                Crear organización
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 pb-16">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          Configuración de la organización
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Actualiza la información de tu organización y configura los parámetros
          de tiempo y nómina que se utilizan en los reportes y cálculos del
          sistema.
        </p>
      </div>

      {!canEdit && organization && (
        <Alert variant="warning" className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-400/50 dark:bg-amber-400/10 dark:text-amber-100">
          <ShieldAlert className="size-4" />
          <AlertTitle>Modo de solo lectura</AlertTitle>
          <AlertDescription>
            Necesitas ser administrador o propietario para editar la
            configuración de la organización. Puedes revisar los valores
            actuales, pero no realizar cambios.
          </AlertDescription>
        </Alert>
      )}

      {settingsError && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo cargar la configuración de asistencia</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>{settingsError}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={handleReloadSettings}
              disabled={isLoadingSettings}
            >
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {showSkeleton || !organization ? (
        <SettingsSkeleton />
      ) : (
        <form className="space-y-6" onSubmit={(event) => void handleSubmit(event)}>
          <Card>
            <CardHeader>
              <CardTitle>Datos generales</CardTitle>
              <CardDescription>
                Esta información se comparte con todo tu equipo y estará
                disponible en todas las aplicaciones conectadas a tu organización.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="org-name">Nombre legal</FieldLabel>
                  <Input
                    id="org-name"
                    value={formState.name}
                    onChange={(event) => updateField("name")(event.target.value)}
                    placeholder="Mi Empresa S.A."
                    disabled={!canEdit || isSaving}
                    required
                  />
                  <FieldDescription>
                    Mostramos este nombre en el sidebar, facturas y reportes.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="org-slug">Apodo / slug</FieldLabel>
                  <Input
                    id="org-slug"
                    value={organization?.slug ?? ""}
                    disabled
                    readOnly
                  />
                  <FieldDescription>
                    Este identificador se define al crear la organización y no se
                    puede modificar.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="org-logo">Logo</FieldLabel>
                  <Input
                    id="org-logo"
                    value={formState.logo}
                    onChange={(event) => updateField("logo")(event.target.value)}
                    placeholder="https://mi-cdn.com/logo.png"
                    disabled={!canEdit || isSaving}
                  />
                  <FieldDescription>
                    Aceptamos imágenes alojadas en HTTPS. Déjalo vacío para usar
                    las iniciales de la organización.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tiempo y nómina</CardTitle>
              <CardDescription>
                Configura los parámetros de tiempo y nómina que se utilizan en los
                cálculos de asistencia y reportes financieros.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="org-support-email">
                    Email de contacto
                  </FieldLabel>
                  <Input
                    id="org-support-email"
                    type="email"
                    value={formState.supportEmail}
                    onChange={(event) =>
                      updateField("supportEmail")(event.target.value)
                    }
                    placeholder="recursos.humanos@miempresa.com"
                    disabled={!canEdit || isSaving}
                  />
                  <FieldDescription>
                    Mostramos este correo en notificaciones automáticas para que
                    el equipo sepa a quién escribir.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="org-grace-period">
                    Tiempo de tolerancia (minutos)
                  </FieldLabel>
                  <Input
                    id="org-grace-period"
                    type="number"
                    min={0}
                    max={60}
                    step={1}
                    value={formState.gracePeriodMinutes}
                    onChange={(event) =>
                      updateField("gracePeriodMinutes")(event.target.value)
                    }
                    placeholder="5"
                    disabled={!canEdit || isSaving}
                    required
                  />
                  <FieldDescription>
                    Minutos de gracia que permitimos antes de marcar un registro
                    como llegada tarde en los reportes de asistencia.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="org-overtime">
                    Tarifa estándar de horas extra
                  </FieldLabel>
                  <Input
                    id="org-overtime"
                    type="number"
                    min={0}
                    step="0.01"
                    value={formState.extraHourCost}
                    onChange={(event) =>
                      updateField("extraHourCost")(event.target.value)
                    }
                    placeholder="150.00"
                    disabled={!canEdit || isSaving}
                  />
                  <FieldDescription>
                    Importe por hora que usaremos como referencia para estimar el
                    costo de horas extra en tableros y reportes.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">
                Esta información se guarda junto con los datos de tu organización
                y estará disponible para otros servicios conectados.
              </p>
            </CardFooter>
          </Card>

          <Separator />

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormState(initialState)}
              disabled={!isDirty || isSaving}
            >
              Restablecer cambios
            </Button>
            <Button
              type="submit"
              disabled={!canEdit || !isDirty || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="grid gap-6">
      {[0, 1].map((card) => (
        <Card key={card}>
          <CardHeader className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[0, 1, 2].map((field) => (
              <div key={field} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
