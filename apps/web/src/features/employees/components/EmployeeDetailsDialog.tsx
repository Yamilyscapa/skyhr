import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  MapPin, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Briefcase 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthPaginationControls } from "@/components/month-pagination-controls";
import {
  buildMonthOptions,
  formatMonthValue,
  getMonthRangeStrings,
  parseMonthValue,
} from "@/lib/month-utils";
import API from "@/api";
import type { Employee } from "../types";

type EmployeeDetailsDialogProps = {
  employee: Employee;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EmployeeDetailsDialog({
  employee,
  open,
  onOpenChange,
}: EmployeeDetailsDialogProps) {
  const geofences = employee.geofences ?? [];
  const statusLabel = employee.status === "active" ? "Activo" : "Pendiente";
  
  // Statistics State
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  
  const monthOptions = buildMonthOptions(selectedMonth);
  const selectedMonthValue = formatMonthValue(selectedMonth);

  // Fetch statistics
  const { data: statistics, isLoading: statsLoading } = useQuery({
    queryKey: ["user-statistics", employee.id, selectedMonthValue],
    queryFn: async () => {
      if (!employee.id) return null;
      const { startDate, endDate } = getMonthRangeStrings(selectedMonth);
      const response = await API.getUserStatistics(employee.id, {
        period: "monthly",
        start_date: startDate,
        end_date: endDate,
      });
      return response?.data;
    },
    enabled: open && !!employee.id,
  });

  const handleMonthSelect = (value: string) => {
    const newDate = parseMonthValue(value);
    if (newDate) {
      setSelectedMonth(newDate);
    }
  };

  const handlePreviousMonth = () => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    setSelectedMonth(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    setSelectedMonth(newDate);
  };

  // Metric helper
  const renderMetricCard = (
    title: string, 
    value: string | number, 
    Icon: React.ElementType, 
    colorClass: string,
    subtext?: string
  ) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${colorClass}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtext && (
          <p className="text-xs text-muted-foreground">
            {subtext}
          </p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalles de {employee.name || employee.email}</DialogTitle>
          <DialogDescription>
            Información general y estadísticas del colaborador.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="statistics">Estadísticas</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Estado</p>
                  <Badge
                    variant={employee.status === "active" ? "secondary" : "outline"}
                    className="mt-1"
                  >
                    {statusLabel}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rol</p>
                  <Badge variant="outline" className="mt-1 uppercase">
                    {employee.role || "Miembro"}
                  </Badge>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">Correo</p>
                <p className="font-medium break-all">{employee.email}</p>
              </div>
              
              {employee.shift && (
                <div>
                  <p className="text-sm text-muted-foreground">Turno</p>
                  <div className="mt-1 inline-flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
                    <span>{employee.shift.name}</span>
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: employee.shift.color }}
                    />
                  </div>
                </div>
              )}
              
              <div>
                <p className="text-sm text-muted-foreground mb-2">Ubicaciones Asignadas</p>
                {geofences.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {geofences.map((geofence) => (
                      <Badge
                        key={geofence.id}
                        variant="outline"
                        className="flex items-center gap-1 py-1 px-2"
                      >
                        <MapPin className="h-3 w-3 text-blue-500" />
                        {geofence.name || "Ubicación sin nombre"}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Sin ubicaciones asignadas
                  </p>
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="statistics" className="space-y-4 mt-4">
            <MonthPaginationControls
              selectedValue={selectedMonthValue}
              options={monthOptions}
              onPrevious={handlePreviousMonth}
              onNext={handleNextMonth}
              onSelect={handleMonthSelect}
              disableNext={selectedMonthValue === formatMonthValue(new Date())}
              className="mb-4"
            />
            
            {statsLoading ? (
              <div className="h-60 flex items-center justify-center">
                <p className="text-muted-foreground">Cargando estadísticas...</p>
              </div>
            ) : statistics ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {renderMetricCard(
                  "Asistencia",
                  `${statistics.metrics.attendanceRate.toFixed(1)}%`,
                  CheckCircle2,
                  "text-green-500",
                  "Tasa de asistencia"
                )}
                {renderMetricCard(
                  "Puntualidad",
                  `${statistics.metrics.punctualityRate.toFixed(1)}%`,
                  Clock,
                  "text-blue-500",
                  "Llegadas a tiempo"
                )}
                {renderMetricCard(
                  "Horas Trabajadas",
                  statistics.metrics.totalWorkHours.toFixed(1),
                  Briefcase,
                  "text-gray-500",
                  "Total de horas"
                )}
                {renderMetricCard(
                  "Retardos",
                  statistics.metrics.lateArrivals,
                  AlertCircle,
                  "text-yellow-500",
                  "Total de retardos"
                )}
                {renderMetricCard(
                  "Ausencias",
                  statistics.metrics.absences,
                  XCircle,
                  "text-red-500",
                  "Faltas injustificadas"
                )}
                 {renderMetricCard(
                  "Horas Extra",
                  statistics.metrics.overtimeHours.toFixed(1),
                  Clock,
                  "text-purple-500",
                  "Horas adicionales"
                )}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center rounded-md border border-dashed">
                <p className="text-muted-foreground text-sm">
                  No hay datos disponibles para este periodo
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
