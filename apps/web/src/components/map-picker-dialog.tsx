import { memo, useEffect, useMemo, useState } from "react";
import { MapPicker, LocationData } from "./map-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface MapPickerDialogProps {
  trigger?: React.ReactNode;
  initialLocation?: LocationData;
  onConfirm: (location: LocationData) => void;
  title?: string;
  description?: string;
}

function MapPickerDialogComponent({
  trigger,
  initialLocation,
  onConfirm,
  title = "Seleccionar ubicación",
  description = "Haz clic en el mapa para seleccionar la ubicación de la sucursal y ajusta el radio del área de cobertura.",
}: MapPickerDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<
    LocationData | undefined
  >(initialLocation);
  const hasLocation = useMemo(
    () => selectedLocation ?? initialLocation,
    [initialLocation, selectedLocation],
  );

  useEffect(() => {
    if (!open && !Object.is(selectedLocation, initialLocation)) {
      setSelectedLocation(initialLocation);
    }
  }, [initialLocation, open, selectedLocation]);

  const handleConfirm = () => {
    const locationToConfirm = hasLocation;
    if (locationToConfirm) {
      onConfirm(locationToConfirm);
      setOpen(false);
    }
  };

  const handleLocationChange = (location: LocationData) => {
    setSelectedLocation(location);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Seleccionar ubicación</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[calc(100vh-4rem)] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="py-4 overflow-y-auto flex-1 min-h-0">
          {open ? (
            <MapPicker
              initialLocation={hasLocation}
              onLocationChange={handleLocationChange}
            />
          ) : null}
        </div>
        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!hasLocation}>
            Confirmar ubicación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const MapPickerDialog = memo(MapPickerDialogComponent);
