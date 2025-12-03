/**
 * Dashboard de estadísticas
 * Endpoints de estadísticas:
 * - GET /statistics/dashboard
 * - GET /statistics/attendance
 * - GET /statistics/costs
 * - GET /statistics/locations
 * - GET /statistics/trends
 */

import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { getOrganization } from "@/server/organization.server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  DollarSign, 
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Heart,
  Download,
  Loader2
} from "lucide-react";
import API, {
  AttendanceReportData,
  CostAnalysisData,
  DashboardStatistics,
  LocationComparisonData,
  StatisticsPeriod,
  TrendsAnalysisData,
} from "@/api";
import { useQuery } from "@tanstack/react-query";
import {
  buildMonthOptions,
  formatMonthLabel,
  formatMonthValue,
  getMonthRangeStrings,
  parseMonthValue,
  startOfMonth,
} from "@/lib/month-utils";
import { MonthPaginationControls } from "@/components/month-pagination-controls";
import { useUserStore } from "@/store/user-store";
import {
  useOrganizationStore,
  attachCurrentMemberData,
} from "@/store/organization-store";
import {
  LocationStats,
  getAttendanceStatus,
  getTrafficLightFromAttendance,
  formatCurrencyMXN,
  getStatusConfig,
  generateStatisticsCsv,
  downloadCsv
} from "@/features/statistics/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/$orgSlug/")({
  component: App,
  beforeLoad: async () => {
  },
});

function App() {
  const { orgSlug } = Route.useParams();
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const selectedMonthValue = formatMonthValue(selectedMonth);
  const selectedMonthLabel = formatMonthLabel(selectedMonth);
  const monthOptions = useMemo(
    () => buildMonthOptions(selectedMonth),
    [selectedMonth],
  );
  const currentMonthValue = formatMonthValue(startOfMonth(new Date()));
  const isNextMonthDisabled = selectedMonthValue >= currentMonthValue;
  const previousMonthDate = useMemo(() => {
    const previous = startOfMonth(selectedMonth);
    previous.setMonth(previous.getMonth() - 1);
    return previous;
  }, [selectedMonth]);

  const handlePreviousMonth = () => {
    setSelectedMonth((prev) => {
      const next = startOfMonth(prev);
      next.setMonth(next.getMonth() - 1);
      return next;
    });
  };

  const handleNextMonth = () => {
    if (isNextMonthDisabled) {
      return;
    }
    setSelectedMonth((prev) => {
      const next = startOfMonth(prev);
      next.setMonth(next.getMonth() + 1);
      return next;
    });
  };

  const handleSelectMonth = (value: string) => {
    const parsed = parseMonthValue(value);
    if (parsed) {
      setSelectedMonth(parsed);
    }
  };

  const { data: organization, isLoading: isLoadingOrganization, isError: isErrorOrg } = useQuery({
    queryKey: ["organization"],
    queryFn: async () => {
      const org = await getOrganization();
      return org?.data || null;
    },
  });

  const setOrganizationStore = useOrganizationStore((state) => state.setOrganization);
  const user = useUserStore((state) => state.user);

  useEffect(() => {
    const enriched = attachCurrentMemberData(organization ?? null, user);
    setOrganizationStore(enriched);
  }, [organization, user, setOrganizationStore]);

  const selectedPeriod: StatisticsPeriod = "monthly";
  const { startDate, endDate } = useMemo(
    () => getMonthRangeStrings(selectedMonth),
    [selectedMonth],
  );
  const {
    startDate: previousStartDate,
    endDate: previousEndDate,
  } = useMemo(() => getMonthRangeStrings(previousMonthDate), [previousMonthDate]);

  const { 
    data: dashboardResponse, 
    isLoading: isLoadingDashboard, 
    isError: isErrorDashboard, 
    error: errorDashboard 
  } = useQuery({
    queryKey: ["statistics-dashboard", organization?.id, selectedPeriod],
    enabled: !!organization?.id,
    queryFn: async (): Promise<DashboardStatistics | undefined> => {
      const response = await API.getStatisticsDashboard({
        period: selectedPeriod,
      });
      return response?.data;
    },
  });

  const { 
    data: attendanceResponse, 
    isLoading: isLoadingAttendance, 
    isError: isErrorAttendance, 
    error: errorAttendance 
  } = useQuery({
    queryKey: ["statistics-attendance", organization?.id, selectedPeriod, startDate, endDate],
    enabled: !!organization?.id,
    queryFn: async (): Promise<AttendanceReportData | undefined> => {
      const response = await API.getStatisticsAttendance({
        period: selectedPeriod,
        start_date: startDate,
        end_date: endDate,
      });
      return response?.data;
    },
  });

  const { data: previousAttendanceResponse } = useQuery({
    queryKey: [
      "statistics-attendance-previous",
      organization?.id,
      selectedPeriod,
      previousStartDate,
      previousEndDate,
    ],
    enabled: !!organization?.id,
    queryFn: async (): Promise<AttendanceReportData | undefined> => {
      const response = await API.getStatisticsAttendance({
        period: selectedPeriod,
        start_date: previousStartDate,
        end_date: previousEndDate,
      });
      return response?.data;
    },
  });

  const { 
    data: costsResponse, 
    isLoading: isLoadingCosts, 
    isError: isErrorCosts, 
    error: errorCosts 
  } = useQuery({
    queryKey: ["statistics-costs", organization?.id, selectedPeriod, startDate, endDate],
    enabled: !!organization?.id,
    queryFn: async (): Promise<CostAnalysisData | undefined> => {
      const response = await API.getStatisticsCosts({
        period: selectedPeriod,
        start_date: startDate,
        end_date: endDate,
      });
      return response?.data;
    },
  });

  const { 
    data: locationsResponse, 
    isLoading: isLoadingLocations, 
    isError: isErrorLocations, 
    error: errorLocations 
  } = useQuery({
    queryKey: ["statistics-locations", organization?.id, selectedPeriod],
    enabled: !!organization?.id,
    queryFn: async (): Promise<LocationComparisonData | undefined> => {
      const response = await API.getStatisticsLocations({
        period: selectedPeriod,
      });
      return response?.data;
    },
  });

  const { 
    data: trendsResponse, 
    isLoading: isLoadingTrends, 
    isError: isErrorTrends, 
    error: errorTrends 
  } = useQuery({
    queryKey: ["statistics-trends", organization?.id],
    enabled: !!organization?.id,
    queryFn: async (): Promise<TrendsAnalysisData | undefined> => {
      const response = await API.getStatisticsTrends();
      return response?.data;
    },
  });

  // Manejo de errores con Toasts
  useEffect(() => {
    if (isErrorDashboard) toast.error(`Error cargando dashboard: ${(errorDashboard as Error)?.message || "Error desconocido"}`);
    if (isErrorAttendance) toast.error(`Error cargando asistencia: ${(errorAttendance as Error)?.message || "Error desconocido"}`);
    if (isErrorCosts) toast.error(`Error cargando costos: ${(errorCosts as Error)?.message || "Error desconocido"}`);
    if (isErrorLocations) toast.error(`Error cargando ubicaciones: ${(errorLocations as Error)?.message || "Error desconocido"}`);
    if (isErrorTrends) toast.error(`Error cargando tendencias: ${(errorTrends as Error)?.message || "Error desconocido"}`);
    if (isErrorOrg) toast.error("Error cargando organización");
  }, [isErrorDashboard, isErrorAttendance, isErrorCosts, isErrorLocations, isErrorTrends, isErrorOrg, errorDashboard, errorAttendance, errorCosts, errorLocations, errorTrends]);

  // ============================================================================
  // CÁLCULOS DE ESTADÍSTICAS BASADOS EN DATOS REALES
  // ============================================================================

  const attendanceMetrics = attendanceResponse?.metrics ?? dashboardResponse?.metrics;
  const previousMetrics = previousAttendanceResponse?.metrics;
  const previousAttendanceRate = previousMetrics?.attendanceRate ?? null;
  const previousPunctualityIndex = previousMetrics?.punctualityIndex ?? null;
  const previousAbsenteeismRate = previousMetrics?.unjustifiedAbsenteeism ?? null;
  const globalAttendance = attendanceMetrics?.attendanceRate ?? 0;
  const globalAbsenteeism =
    attendanceMetrics?.unjustifiedAbsenteeism ?? Math.max(0, 100 - globalAttendance);
  const punctualityIndex = attendanceMetrics?.punctualityIndex ?? 0;
  const coverageRate = attendanceMetrics?.coverageRate ?? 0;
  const reportCompliance = attendanceMetrics?.reportCompliance ?? 0;
  const averageDelays = attendanceMetrics?.averageDelays ?? 0;
  const operationalRotation = attendanceMetrics?.operationalRotation ?? 0;
  const trend =
    previousAttendanceRate !== null ? globalAttendance - previousAttendanceRate : null;
  const trafficLight =
    dashboardResponse?.traffic_light ?? getTrafficLightFromAttendance(globalAttendance);
  const dashboardAlerts = dashboardResponse?.alerts ?? [];

  const locationStats: LocationStats[] = useMemo(() => {
    return (locationsResponse?.rankings ?? []).map((location) => ({
      locationId: location.locationId,
      locationName: location.locationName,
      attendanceRate: location.attendanceRate,
      absenteeismRate: location.absenteeismRate,
      punctualityIndex: location.punctualityIndex,
      rank: location.rank,
      status: getAttendanceStatus(location.attendanceRate),
    }));
  }, [locationsResponse]);

  const attendanceTrends = trendsResponse?.attendance ?? [];
  const punctualityTrends = trendsResponse?.punctuality ?? [];
  const absenteeismTrends = trendsResponse?.absenteeism ?? [];

  const isLoading =
    isLoadingDashboard ||
    isLoadingAttendance ||
    isLoadingLocations ||
    isLoadingTrends ||
    isLoadingCosts ||
    isLoadingOrganization;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando estadísticas...</p>
        </div>
      </div>
    );
  }

  const hasNoData = !attendanceMetrics;

  // Función para exportar estadísticas a CSV
  const handleExportToCsv = () => {
    if (hasNoData) {
      toast.warning("No hay datos disponibles para exportar.");
      return;
    }

    try {
      const csvContent = generateStatisticsCsv({
        monthLabel: selectedMonthLabel,
        startDate,
        endDate,
        globalAttendance,
        globalAbsenteeism,
        punctualityIndex,
        coverageRate,
        reportCompliance,
        trafficLight,
        locationStats,
        costsResponse,
        attendanceTrends,
        punctualityTrends,
        absenteeismTrends,
      });

      downloadCsv(csvContent, `estadisticas-${selectedMonthValue}.csv`);
      toast.success("Estadísticas exportadas correctamente");
    } catch (error) {
      console.error(error);
      toast.error("Error al exportar estadísticas");
    }
  };

  return (
    <div className="space-y-6 p-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard de Estadísticas</h1>
          <p className="text-muted-foreground">
            Resumen completo de asistencia, costos e indicadores estratégicos. Mes seleccionado:{" "}
            <span className="font-medium text-foreground">{selectedMonthLabel}</span>
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            onClick={handleExportToCsv}
            variant="outline"
            disabled={hasNoData}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          <MonthPaginationControls
            selectedValue={selectedMonthValue}
            options={monthOptions}
            onPrevious={handlePreviousMonth}
            onNext={handleNextMonth}
            onSelect={handleSelectMonth}
            disableNext={isNextMonthDisabled}
          />
        </div>
      </div>

      {/* Mensaje cuando no hay datos para el mes seleccionado */}
      {hasNoData && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Aún no hay información disponible</AlertTitle>
          <AlertDescription>
            No hay datos de asistencia para {selectedMonthLabel}.
          </AlertDescription>
        </Alert>
      )}

      {/* Contenido de estadísticas - solo mostrar si hay datos */}
      {!hasNoData && (
        <>

      {/* Métricas Principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Asistencia Global</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{globalAttendance.toFixed(1)}%</div>
            {trend === null ? (
              <div className="flex items-center text-xs text-muted-foreground">
                Sin datos del periodo anterior
              </div>
            ) : (
              <div
                className={`flex items-center text-xs ${
                  trend >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {trend >= 0 ? (
                  <TrendingUp className="mr-1 h-3 w-3" />
                ) : (
                  <TrendingDown className="mr-1 h-3 w-3" />
                )}
                {trend >= 0 ? "+" : ""}
                {trend.toFixed(1)}% vs periodo anterior
              </div>
            )}
            <Progress 
              value={globalAttendance} 
              className="mt-2" 
              aria-label={`Progreso de asistencia global: ${globalAttendance.toFixed(1)}%`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ausentismo Promedio</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{globalAbsenteeism.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-2">
              {globalAbsenteeism <= 5 ? "Dentro del objetivo (≤5%)" : "Por encima del objetivo del 5%"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Puntualidad</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{punctualityIndex.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-2">
              Índice de puntualidad de la organización
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cobertura</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{coverageRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-2">
              Cumplimiento de turnos programados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      {dashboardAlerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-primary">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <CardTitle className="text-base">Alertas</CardTitle>
                <CardDescription>
                  {dashboardAlerts.length} alerta(s)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {dashboardAlerts.map((alert, index) => (
                <div
                  key={`${alert.type}-${index}`}
                  className="rounded-lg border bg-muted/30 p-3"
                >
                  <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <span>{alert.type}</span>
                    <Badge
                      variant={
                        alert.severity === "critical"
                          ? "destructive"
                          : alert.severity === "warning"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{alert.message}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Las alertas se calculan automáticamente según las reglas de estadísticas.
              </p>
              <Button size="sm" asChild>
                <Link to="/$orgSlug/attendance" params={{ orgSlug }}>
                  Gestionar asistencia
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs para diferentes secciones */}
      <Tabs defaultValue="attendance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="attendance">Asistencia</TabsTrigger>
          <TabsTrigger value="details">Detalles</TabsTrigger>
          <TabsTrigger value="costs">Costos</TabsTrigger>
          <TabsTrigger value="strategic">Indicadores Estratégicos</TabsTrigger>
        </TabsList>

        {/* Tab de Asistencia */}
        <TabsContent value="attendance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Resumen por ubicación */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Resumen de Ubicaciones</CardTitle>
                <CardDescription>
                  Detalle de asistencia y eventos por sucursal/geofence
                </CardDescription>
              </CardHeader>
              <CardContent>
                {locationStats.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay sucursales configuradas o sin datos de asistencia
                  </div>
                ) : (
                  <div className="space-y-4">
                    {locationStats.map((location, index) => {
                      const config = getStatusConfig(location.status);
                      const Icon = config.icon;
                      return (
                        <div
                          key={location.locationId}
                          className="rounded-lg border p-4 space-y-4"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-xs text-muted-foreground">Ranking #{location.rank ?? index + 1}</p>
                              <p className="text-lg font-semibold">{location.locationName}</p>
                              <p className="text-sm text-muted-foreground">
                                Asistencia vs ausentismo del periodo
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-3xl font-bold">{location.attendanceRate.toFixed(1)}%</p>
                              <Badge variant={config.badge as any} className="mt-1 inline-flex items-center gap-1">
                                <Icon className="h-3 w-3" />
                                {config.text}
                              </Badge>
                            </div>
                          </div>

                          <Progress
                            value={location.attendanceRate}
                            className="[&>div]:bg-linear-to-r [&>div]:from-green-500 [&>div]:to-emerald-600"
                            aria-label={`Asistencia en ${location.locationName}: ${location.attendanceRate.toFixed(1)}%`}
                          />

                          <div className="grid gap-3 md:grid-cols-3 text-sm">
                            <div className="rounded-md bg-muted p-3">
                              <p className="text-xs text-muted-foreground">Asistencia</p>
                              <p className="text-base font-semibold text-green-600">
                                {location.attendanceRate.toFixed(1)}%
                              </p>
                            </div>
                            <div className="rounded-md bg-muted p-3">
                              <p className="text-xs text-muted-foreground">Ausentismo</p>
                              <p className="text-base font-semibold text-red-600">
                                {location.absenteeismRate.toFixed(1)}%
                              </p>
                            </div>
                            <div className="rounded-md bg-muted p-3">
                              <p className="text-xs text-muted-foreground">Puntualidad</p>
                              <p className="text-base font-semibold text-blue-600">
                                {location.punctualityIndex.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tendencias Trimestrales */}
            <Card>
              <CardHeader>
                <CardTitle>Tendencias Trimestrales</CardTitle>
                <CardDescription>Evolución de los últimos 3 meses</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingTrends ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Cargando datos trimestrales...
                  </div>
                ) : attendanceTrends.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Aún no hay información disponible para los meses anteriores
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {attendanceTrends.map((month, index) => {
                        const prevMonth = attendanceTrends[index - 1];
                        const monthTrend = prevMonth
                          ? month.value - prevMonth.value
                          : 0;
                        return (
                          <div key={month.date} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium capitalize">{month.date}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold">
                                  {month.value.toFixed(1)}%
                                </span>
                                {index > 0 && (
                                  <span
                                    className={`text-xs ${
                                      monthTrend > 0 ? "text-green-600" : "text-red-600"
                                    }`}
                                  >
                                    {monthTrend > 0 ? "+" : ""}
                                    {monthTrend.toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            </div>
                            <Progress value={month.value} aria-label={`Tendencia ${month.date}: ${month.value.toFixed(1)}%`} />
                          </div>
                        );
                      })}
                    </div>
                    {attendanceTrends.length >= 2 && (
                      <div className="mt-6 rounded-lg bg-muted p-4">
                        <div className="flex items-center gap-2">
                          {attendanceTrends[attendanceTrends.length - 1].value >= 
                           attendanceTrends[0].value ? (
                            <>
                              <TrendingUp className="h-5 w-5 text-green-600" />
                              <div>
                                <div className="text-sm font-medium">Tendencia Positiva</div>
                                <div className="text-xs text-muted-foreground">
                                  La asistencia ha mejorado{" "}
                                  {(
                                    attendanceTrends[attendanceTrends.length - 1].value -
                                    attendanceTrends[0].value
                                  ).toFixed(1)}
                                  % en el trimestre
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <TrendingDown className="h-5 w-5 text-red-600" />
                              <div>
                                <div className="text-sm font-medium">Tendencia Negativa</div>
                                <div className="text-xs text-muted-foreground">
                                  La asistencia ha disminuido{" "}
                                  {Math.abs(
                                    attendanceTrends[attendanceTrends.length - 1].value -
                                      attendanceTrends[0].value
                                  ).toFixed(1)}
                                  % en el trimestre
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Semáforo de Desempeño */}
            <Card>
              <CardHeader>
                <CardTitle>Semáforo de Desempeño</CardTitle>
                <CardDescription>Distribución de sucursales por nivel</CardDescription>
              </CardHeader>
              <CardContent>
                {locationStats.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay datos para mostrar
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full bg-green-500" />
                          <span className="text-sm">Excelente (≥ 95%)</span>
                        </div>
                        <span className="text-sm font-bold">
                          {locationStats.filter((l) => l.status === "excellent").length}{" "}
                          {locationStats.filter((l) => l.status === "excellent").length === 1 
                            ? "sucursal" 
                            : "sucursales"}
                        </span>
                      </div>
                      <Progress
                        value={
                          locationStats.length > 0
                            ? (locationStats.filter((l) => l.status === "excellent").length /
                                locationStats.length) *
                              100
                            : 0
                        }
                        className="[&>div]:bg-green-500"
                        aria-label="Porcentaje de sucursales con desempeño excelente"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full bg-yellow-500" />
                          <span className="text-sm">Aceptable (90-94%)</span>
                        </div>
                        <span className="text-sm font-bold">
                          {locationStats.filter((l) => l.status === "acceptable").length}{" "}
                          {locationStats.filter((l) => l.status === "acceptable").length === 1 
                            ? "sucursal" 
                            : "sucursales"}
                        </span>
                      </div>
                      <Progress
                        value={
                          locationStats.length > 0
                            ? (locationStats.filter((l) => l.status === "acceptable").length /
                                locationStats.length) *
                              100
                            : 0
                        }
                        className="[&>div]:bg-yellow-500"
                        aria-label="Porcentaje de sucursales con desempeño aceptable"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full bg-red-500" />
                          <span className="text-sm">Crítico (&lt; 90%)</span>
                        </div>
                        <span className="text-sm font-bold">
                          {locationStats.filter((l) => l.status === "critical").length}{" "}
                          {locationStats.filter((l) => l.status === "critical").length === 1 
                            ? "sucursal" 
                            : "sucursales"}
                        </span>
                      </div>
                      <Progress
                        value={
                          locationStats.length > 0
                            ? (locationStats.filter((l) => l.status === "critical").length /
                                locationStats.length) *
                              100
                            : 0
                        }
                        className="[&>div]:bg-red-500"
                        aria-label="Porcentaje de sucursales con desempeño crítico"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab de Detalles */}
        <TabsContent value="details" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Indicadores clave</CardTitle>
                <CardDescription>
                  Métricas clave que reflejan el desempeño y la asistencia de tu
                  equipo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: "Puntualidad", value: punctualityIndex, tone: "bg-blue-500" },
                    { label: "Cobertura", value: coverageRate, tone: "bg-emerald-500" },
                    { label: "Cumplimiento de reportes", value: reportCompliance, tone: "bg-indigo-500" },
                    { label: "Ausentismo injustificado", value: globalAbsenteeism, tone: "bg-red-500" },
                  ].map((item) => (
                    <div key={item.label} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{item.label}</span>
                        </div>
                        <span className="text-sm font-bold">{item.value.toFixed(1)}%</span>
                      </div>
                      <Progress 
                        value={item.value} 
                        className={`[&>div]:${item.tone}`} 
                        aria-label={`${item.label}: ${item.value.toFixed(1)}%`}
                      />
                    </div>
                  ))}

                  <div className="grid gap-2">
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-xs text-muted-foreground">Retrasos promedio</p>
                      <p className="text-lg font-bold text-orange-600">{averageDelays.toFixed(1)} hrs</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Estado del semáforo</CardTitle>
                <CardDescription>
                  Estado calculado automáticamente según las reglas de asistencia
                  configuradas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`h-3 w-3 rounded-full ${
                      trafficLight === "green"
                        ? "bg-green-500"
                        : trafficLight === "yellow"
                          ? "bg-yellow-500"
                          : "bg-red-500"
                    }`}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-semibold">
                      Semáforo {trafficLight === "green" ? "Verde" : trafficLight === "yellow" ? "Amarillo" : "Rojo"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Calculado con la tasa de asistencia ({globalAttendance.toFixed(1)}%)
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase">Alertas</p>
                  {dashboardAlerts.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sin alertas registradas</p>
                  )}
                  {dashboardAlerts.slice(0, 3).map((alert, index) => (
                    <div key={`${alert.type}-${index}`} className="rounded-md border bg-muted/30 p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{alert.message}</span>
                        <Badge
                          variant={
                            alert.severity === "critical"
                              ? "destructive"
                              : alert.severity === "warning"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{alert.type}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          {!costsResponse ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Sin datos de costos</AlertTitle>
              <AlertDescription>
                Aún no hay información de costos disponible para este periodo.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Costo por Ausentismo
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrencyMXN(costsResponse.absenteeismCost)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Horas perdidas × salario promedio/hora
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Costo de Horas Extra
                    </CardTitle>
                    <Clock className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrencyMXN(costsResponse.overtimeCost)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Horas extra × tarifa premium
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Impacto Total
                    </CardTitle>
                    <Users className="h-4 w-4 text-emerald-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrencyMXN(costsResponse.totalCostImpact)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Moneda: {costsResponse.currency}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Detalle de costos</CardTitle>
                  <CardDescription>
                    Datos del módulo de estadísticas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 md:grid-cols-3">
                    <div className="rounded-lg bg-red-50 p-4 dark:bg-red-950">
                      <div className="text-sm text-red-900 dark:text-red-100">
                        Ausentismo
                      </div>
                      <div className="text-lg font-bold text-red-600">
                        {formatCurrencyMXN(costsResponse.absenteeismCost)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
                      <div className="text-sm text-blue-900 dark:text-blue-100">
                        Horas extra
                      </div>
                      <div className="text-lg font-bold text-blue-600">
                        {formatCurrencyMXN(costsResponse.overtimeCost)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-4 dark:bg-emerald-950">
                      <div className="text-sm text-emerald-900 dark:text-emerald-100">
                        Impacto total
                      </div>
                      <div className="text-lg font-bold text-emerald-600">
                        {formatCurrencyMXN(costsResponse.totalCostImpact)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

         <TabsContent value="strategic" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Asistencia Card */}
            {(() => {
              const lastMonthAttendance = globalAttendance;
              const previousMonthAttendance = previousAttendanceRate;
              const attendanceTrend =
                previousMonthAttendance !== null
                  ? lastMonthAttendance - previousMonthAttendance
                  : null;
              const hasTrendData = attendanceTrend !== null;

              return (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Asistencia</CardTitle>
                    {hasTrendData ? (
                      attendanceTrend >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {lastMonthAttendance.toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Último mes registrado
                    </p>
                    {hasTrendData ? (
                      <div
                        className={`flex items-center text-xs mt-2 ${
                          attendanceTrend >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {attendanceTrend >= 0 ? (
                          <TrendingUp className="mr-1 h-3 w-3" />
                        ) : (
                          <TrendingDown className="mr-1 h-3 w-3" />
                        )}
                        {attendanceTrend >= 0 ? "+" : ""}
                        {attendanceTrend.toFixed(1)}% vs mes anterior
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-2">
                        Sin datos del mes anterior para comparar
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Puntualidad Card */}
            {(() => {
              const lastMonthPunctuality = punctualityIndex;
              const previousMonthPunctuality = previousPunctualityIndex;
              const punctualityTrend =
                previousMonthPunctuality !== null
                  ? lastMonthPunctuality - previousMonthPunctuality
                  : null;
              const hasTrendData = punctualityTrend !== null;

              return (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Puntualidad</CardTitle>
                    {hasTrendData ? (
                      punctualityTrend >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {lastMonthPunctuality.toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Último mes registrado
                    </p>
                    {hasTrendData ? (
                      <div
                        className={`flex items-center text-xs mt-2 ${
                          punctualityTrend >= 0 ? "text-blue-600" : "text-red-600"
                        }`}
                      >
                        {punctualityTrend >= 0 ? (
                          <TrendingUp className="mr-1 h-3 w-3" />
                        ) : (
                          <TrendingDown className="mr-1 h-3 w-3" />
                        )}
                        {punctualityTrend >= 0 ? "+" : ""}
                        {punctualityTrend.toFixed(1)}% vs mes anterior
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-2">
                        Sin datos del mes anterior para comparar
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Ausentismo Card */}
            {(() => {
              const lastMonthAbsenteeism = globalAbsenteeism;
              const previousMonthAbsenteeism = previousAbsenteeismRate;
              const absenteeismTrend =
                previousMonthAbsenteeism !== null
                  ? lastMonthAbsenteeism - previousMonthAbsenteeism
                  : null;
              const hasTrendData = absenteeismTrend !== null;
              // For absenteeism, lower is better, so we invert the trend display

              return (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ausentismo</CardTitle>
                    {hasTrendData ? (
                      absenteeismTrend <= 0 ? (
                        <TrendingDown className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <TrendingUp className="h-4 w-4 text-red-600" />
                      )
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {lastMonthAbsenteeism.toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Último mes registrado
                    </p>
                    {hasTrendData ? (
                      <div
                        className={`flex items-center text-xs mt-2 ${
                          absenteeismTrend <= 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {absenteeismTrend <= 0 ? (
                          <TrendingDown className="mr-1 h-3 w-3" />
                        ) : (
                          <TrendingUp className="mr-1 h-3 w-3" />
                        )}
                        {absenteeismTrend >= 0 ? "+" : ""}
                        {absenteeismTrend.toFixed(1)}% vs mes anterior
                        <span className="ml-1 text-muted-foreground">
                          ({absenteeismTrend <= 0 ? "mejoró" : "empeoró"})
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-2">
                        Sin datos del mes anterior para comparar
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })()}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Mejores y peores ubicaciones</CardTitle>
              <CardDescription>
                Ubicaciones ordenadas según su desempeño en asistencia y
                puntualidad.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {locationsResponse?.best_performer ? (
                <div className="rounded-lg border p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Mejor desempeño</p>
                    <p className="text-lg font-semibold">
                      {locationsResponse.best_performer.locationName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Asistencia {locationsResponse.best_performer.attendanceRate.toFixed(1)}%
                    </p>
                  </div>
                  <Badge variant="default" className="bg-emerald-600">
                    Ranking #{locationsResponse.best_performer.rank}
                  </Badge>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin información de ranking</p>
              )}

              {(locationsResponse?.needs_attention ?? []).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase">Necesitan atención</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {(locationsResponse?.needs_attention ?? []).map((location) => (
                      <div key={location.locationId} className="rounded-md border bg-muted/40 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{location.locationName}</span>
                          <Badge variant="destructive">#{location.rank}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Asistencia {location.attendanceRate.toFixed(1)}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
        </>
      )}
    </div>
  );
}
