import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, QrCode, Loader2 } from "lucide-react";
import type { Location } from "../types";
import API from "@/api";

type LocationQrViewerProps = {
  location: Location;
  onDownload: (location: Location) => void;
};

export function LocationQrViewer({
  location,
  onDownload,
}: LocationQrViewerProps) {
  const [open, setOpen] = useState(false);
  const [presignedUrl, setPresignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch presigned URL when dialog opens
  useEffect(() => {
    if (open && location.qr_code_url) {
      setIsLoading(true);
      setError(null);
      
      API.getQrPresignedUrl(location.qr_code_url)
        .then((response) => {
          setPresignedUrl(response.url);
        })
        .catch((err) => {
          console.error("Failed to fetch presigned URL:", err);
          setError("No se pudo cargar el código QR");
          // Fallback to stored URL for development
          setPresignedUrl(location.qr_code_url ?? null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, location.qr_code_url]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setPresignedUrl(null);
      setError(null);
    }
  }, [open]);

  if (!location.qr_code_url) {
    return <span className="text-sm text-gray-400">No disponible</span>;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <QrCode className="h-4 w-4" />
          Ver QR
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Código QR - {location.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="bg-white p-4 rounded-lg border min-h-[272px] min-w-[272px] flex items-center justify-center">
            {isLoading ? (
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            ) : error && !presignedUrl ? (
              <span className="text-sm text-red-500">{error}</span>
            ) : presignedUrl ? (
              <img
                src={presignedUrl}
                alt={`QR Code for ${location.name}`}
                className="w-64 h-64 object-contain"
              />
            ) : null}
          </div>
          <Button 
            onClick={() => onDownload(location)} 
            className="w-full gap-2"
            disabled={isLoading}
          >
            <Download className="h-4 w-4" />
            Descargar QR
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
