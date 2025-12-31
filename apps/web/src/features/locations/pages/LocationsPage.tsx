import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPickerDialog } from "@/components/map-picker-dialog";
import type { LocationData } from "@/components/map-picker";
import { Separator } from "@/components/ui/separator";
import { DataTableCard } from "@/components/ui/data-table-card";
import { DataTableToolbar } from "@/components/ui/data-table-toolbar";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Copy, Download } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useOrganizationStore } from "@/store/organization-store";
import { usePageLoading } from "@/contexts/page-loading-context";
import { LocationDetailsDialog } from "../components/LocationDetailsDialog";
import { createLocationColumns } from "../components/LocationColumns";
import { downloadQrCode } from "../utils";
import type { Location } from "../types";
import { createLocation } from "../data";
import { useLocations, LOCATIONS_QUERY_KEY } from "../hooks/useLocations";

export function LocationsPage() {
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [detailsLocation, setDetailsLocation] = useState<Location | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const { organization } = useOrganizationStore();
  const queryClient = useQueryClient();
  const locationsQuery = useLocations(organization?.id);
  const locations = locationsQuery.data ?? [];
  
  // Page loading context
  const { setPageLoading } = usePageLoading();
  
  // Register loading state - block navigation while data is loading
  useEffect(() => {
    setPageLoading(locationsQuery.isLoading);
  }, [locationsQuery.isLoading, setPageLoading]);

  const handleViewLocationDetails = (location: Location) => {
    setDetailsLocation(location);
  };

  const handleOpenLocationMap = (location: Location) => {
    if (!location.center_latitude || !location.center_longitude) {
      alert("No hay coordenadas disponibles para esta ubicación.");
      return;
    }

    const url = `https://www.google.com/maps?q=${location.center_latitude},${location.center_longitude}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDownloadLocationQr = (location: Location) => {
    downloadQrCode(location);
  };

  const filteredLocations = useMemo(() => {
    const term = tableSearch.trim().toLowerCase();
    if (!term) return locations;
    return locations.filter((location) =>
      location.name.toLowerCase().includes(term),
    );
  }, [locations, tableSearch]);

  const columns = createLocationColumns({
    onView: handleViewLocationDetails,
    onOpenMap: handleOpenLocationMap,
    onDownloadQr: handleDownloadLocationQr,
  });

  const table = useReactTable({
    data: filteredLocations,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSorting: true,
    enableRowSelection: true,
  });

  const getSelectedLocations = () =>
    table.getSelectedRowModel().rows.map((row) => row.original);

  const handleBulkDownloadQrs = () => {
    const selected = getSelectedLocations();
    if (selected.length === 0) {
      alert("Selecciona al menos una sucursal.");
      return;
    }

    const withQr = selected.filter((location) => location.qr_code_url);
    if (withQr.length === 0) {
      alert("Las sucursales seleccionadas no tienen códigos QR disponibles.");
      return;
    }

    setIsBulkProcessing(true);
    try {
      withQr.forEach((location, index) => {
        setTimeout(() => downloadQrCode(location), index * 150);
      });
    } finally {
      setTimeout(() => setIsBulkProcessing(false), withQr.length * 150 + 300);
    }
  };

  const handleBulkCopyCoordinates = async () => {
    const selected = getSelectedLocations();
    if (selected.length === 0) {
      alert("Selecciona al menos una sucursal.");
      return;
    }

    const coordinates = selected
      .filter(
        (location) => location.center_latitude && location.center_longitude,
      )
      .map(
        (location) =>
          `${location.name}: ${location.center_latitude}, ${location.center_longitude}`,
      );

    if (coordinates.length === 0) {
      alert("No hay coordenadas disponibles para copiar.");
      return;
    }

    const text = coordinates.join("\n");

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        alert("Coordenadas copiadas al portapapeles");
        return;
      } catch (error) {
        console.error("Error copiando coordenadas:", error);
      }
    }

    window.prompt("Copia manualmente las coordenadas:", text);
  };

  const locationBulkActions = [
    {
      label: "Descargar QRs",
      icon: Download,
      action: handleBulkDownloadQrs,
      disabled: isBulkProcessing,
    },
    {
      label: "Copiar coordenadas",
      icon: Copy,
      action: handleBulkCopyCoordinates,
      disabled: isBulkProcessing,
    },
  ];

  const handleLocationConfirm = (location: LocationData) => {
    setLocationData(location);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!name) {
      alert("El nombre de la sucursal es requerido");
      return;
    }

    if (!locationData) {
      alert("La ubicación en el mapa es requerida");
      return;
    }

    if (!organization?.id) {
      alert("No se encontró la organización");
      return;
    }

    setIsSubmitting(true);
    try {
      await createLocation({
        name,
        latitude: locationData.latitude.toString(),
        longitude: locationData.longitude.toString(),
        radius: locationData.radius,
        organizationId: organization.id,
      });
      alert("Sucursal creada exitosamente");
      setName("");
      setLocationData(null);
      // Invalidate and refetch locations
      await queryClient.invalidateQueries({
        queryKey: LOCATIONS_QUERY_KEY,
        exact: false,
      });
    } catch (error) {
      alert("Error al crear la sucursal. Por favor, intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-6 pb-12">
      <Card>
        <CardHeader>
          <CardTitle>Agregar sucursal</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <Field>
              <Label htmlFor="location-name">Nombre de la sucursal</Label>
              <Input
                id="location-name"
                type="text"
                placeholder="Ejemplo: Sucursal Centro"
                autoComplete="off"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="location-map">Ubicación en el mapa</Label>
              <div className="space-y-2">
                <MapPickerDialog
                  trigger={
                    <Button
                      id="location-map"
                      type="button"
                      variant="outline"
                      className="w-fit"
                    >
                      {locationData
                        ? "Cambiar ubicación en el mapa"
                        : "Seleccionar ubicación en el mapa"}
                    </Button>
                  }
                  initialLocation={locationData || undefined}
                  onConfirm={handleLocationConfirm}
                />
              </div>
            </Field>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creando..." : "Agregar sucursal"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator className="my-8" />

      <DataTableToolbar
        search={{
          value: tableSearch,
          onChange: setTableSearch,
          placeholder: "Buscar sucursales",
        }}
        refresh={{ onClick: () => void locationsQuery.refetch(), isRefreshing: locationsQuery.isLoading }}
      />

      <DataTableCard
        title="Sucursales"
        table={table}
        selectedCount={table.getSelectedRowModel().rows.length}
        bulkActionLabel="Acciones masivas"
        bulkActions={locationBulkActions}
      />

      <LocationDetailsDialog
        location={detailsLocation}
        open={Boolean(detailsLocation)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailsLocation(null);
          }
        }}
      />
    </div>
  );
}
