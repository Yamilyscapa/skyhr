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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Download,
  Loader2,
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
  downloadCsv,
} from "@/features/statistics/utils";
import { AttendanceTrendChart } from "@/features/statistics/charts/AttendanceTrendChart";
import { LocationStatusDistributionChart } from "@/features/statistics/charts/LocationStatusDistributionChart";
import { LocationRankingChart } from "@/features/statistics/charts/LocationRankingChart";
import { CostCompositionChart } from "@/features/statistics/charts/CostCompositionChart";
import { toast } from "sonner";

export const Route = createFileRoute("/$orgSlug/")({
  component: App,
  beforeLoad: async () => {},
});

function App() {
  const { orgSlug } = Route.useParams();
  const [selectedMonth, setSelectedMonth] = useState(() =>
    startOfMonth(new Date()),
  );
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

  const {
    data: organization,
    isLoading: isLoadingOrganization,
    isError: isErrorOrg,
  } = useQuery({
    queryKey: ["organization"],
    queryFn: async () => {
      const org = await getOrganization();
      return org?.data || null;
    },
  });

  const setOrganizationStore = useOrganizationStore(
    (state) => state.setOrganization,
  );
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
  const { startDate: previousStartDate, endDate: previousEndDate } = useMemo(
    () => getMonthRangeStrings(previousMonthDate),
    [previousMonthDate],
  );

  const {
    data: dashboardResponse,
    isLoading: isLoadingDashboard,
    isError: isErrorDashboard,
    error: errorDashboard,
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
    error: errorAttendance,
  } = useQuery({
    queryKey: [
      "statistics-attendance",
      organization?.id,
      selectedPeriod,
      startDate,
      endDate,
    ],
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
    error: errorCosts,
  } = useQuery({
    queryKey: [
      "statistics-costs",
      organization?.id,
      selectedPeriod,
      startDate,
      endDate,
    ],
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
    error: errorLocations,
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
    error: errorTrends,
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
    if (isErrorDashboard)
      toast.error(
        `Error cargando dashboard: ${(errorDashboard as Error)?.message || "Error desconocido"}`,
      );
    if (isErrorAttendance)
      toast.error(
        `Error cargando asistencia: ${(errorAttendance as Error)?.message || "Error desconocido"}`,
      );
    if (isErrorCosts)
      toast.error(
        `Error cargando costos: ${(errorCosts as Error)?.message || "Error desconocido"}`,
      );
    if (isErrorLocations)
      toast.error(
        `Error cargando ubicaciones: ${(errorLocations as Error)?.message || "Error desconocido"}`,
      );
    if (isErrorTrends)
      toast.error(
        `Error cargando tendencias: ${(errorTrends as Error)?.message || "Error desconocido"}`,
      );
    if (isErrorOrg) toast.error("Error cargando organización");
  }, [
    isErrorDashboard,
    isErrorAttendance,
    isErrorCosts,
    isErrorLocations,
    isErrorTrends,
    isErrorOrg,
    errorDashboard,
    errorAttendance,
    errorCosts,
    errorLocations,
    errorTrends,
  ]);

  // ============================================================================
  // CÁLCULOS DE ESTADÍSTICAS BASADOS EN DATOS REALES
  // ============================================================================

  const attendanceMetrics =
    attendanceResponse?.metrics ?? dashboardResponse?.metrics;
  const previousMetrics = previousAttendanceResponse?.metrics;
  const previousAttendanceRate = previousMetrics?.attendanceRate ?? null;
  const previousPunctualityIndex = previousMetrics?.punctualityIndex ?? null;
  const previousAbsenteeismRate =
    previousMetrics?.unjustifiedAbsenteeism ?? null;
  const globalAttendance = attendanceMetrics?.attendanceRate ?? 0;
  const globalAbsenteeism =
    attendanceMetrics?.unjustifiedAbsenteeism ??
    Math.max(0, 100 - globalAttendance);
  const punctualityIndex = attendanceMetrics?.punctualityIndex ?? 0;
  const coverageRate = attendanceMetrics?.coverageRate ?? 0;
  const reportCompliance = attendanceMetrics?.reportCompliance ?? 0;
  const averageDelays = attendanceMetrics?.averageDelays ?? 0;
  const operationalRotation = attendanceMetrics?.operationalRotation ?? 0;
  const trend =
    previousAttendanceRate !== null
      ? globalAttendance - previousAttendanceRate
      : null;
  const trafficLight =
    dashboardResponse?.traffic_light ??
    getTrafficLightFromAttendance(globalAttendance);
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
  const locationStatusCounts = useMemo(
    () => ({
      excellent: locationStats.filter(
        (location) => location.status === "excellent",
      ).length,
      acceptable: locationStats.filter(
        (location) => location.status === "acceptable",
      ).length,
      critical: locationStats.filter(
        (location) => location.status === "critical",
      ).length,
    }),
    [locationStats],
  );
  const topLocations = useMemo(
    () => locationStats.slice(0, 3),
    [locationStats],
  );
  const attendanceTrend =
    previousAttendanceRate !== null
      ? globalAttendance - previousAttendanceRate
      : null;
  const punctualityTrend =
    previousPunctualityIndex !== null
      ? punctualityIndex - previousPunctualityIndex
      : null;
  const absenteeismTrend =
    previousAbsenteeismRate !== null
      ? globalAbsenteeism - previousAbsenteeismRate
      : null;
  const trafficLightLabel =
    trafficLight === "green"
      ? "Verde"
      : trafficLight === "yellow"
        ? "Amarillo"
        : "Rojo";

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
          <h1 className="text-3xl font-bold tracking-tight">
            Dashboard de Estadísticas
          </h1>
          <p className="text-muted-foreground">
            Vista rápida de desempeño y análisis por sucursal. Mes seleccionado:{" "}
            <span className="font-medium text-foreground">
              {selectedMonthLabel}
            </span>
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
                <CardTitle className="text-sm font-medium">
                  Asistencia Global
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {globalAttendance.toFixed(1)}%
                </div>
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
                <CardTitle className="text-sm font-medium">
                  Ausentismo Promedio
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {globalAbsenteeism.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {globalAbsenteeism <= 5
                    ? "Dentro del objetivo (≤5%)"
                    : "Por encima del objetivo del 5%"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Puntualidad
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {punctualityIndex.toFixed(1)}%
                </div>
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
                <div className="text-2xl font-bold">
                  {coverageRate.toFixed(1)}%
                </div>
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
                  {dashboardAlerts.slice(0, 3).map((alert, index) => (
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
                      <p className="mt-1 text-sm text-foreground">
                        {alert.message}
                      </p>
                    </div>
                  ))}
                  {dashboardAlerts.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      Mostrando 3 de {dashboardAlerts.length} alertas.
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Las alertas se calculan automáticamente según las reglas de
                    estadísticas.
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
          <Tabs defaultValue="summary" className="space-y-4">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="summary">Resumen</TabsTrigger>
              <TabsTrigger value="analysis">Análisis</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Pulso general</CardTitle>
                    <CardDescription>
                      Estado global y métricas operativas principales.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
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
                          Semáforo {trafficLightLabel}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Calculado con la asistencia actual (
                          {globalAttendance.toFixed(1)}%).
                        </p>
                      </div>
                    </div>

                    {[
                      {
                        label: "Puntualidad",
                        value: punctualityIndex,
                        tone: "bg-blue-500",
                      },
                      {
                        label: "Cobertura",
                        value: coverageRate,
                        tone: "bg-emerald-500",
                      },
                      {
                        label: "Cumplimiento de reportes",
                        value: reportCompliance,
                        tone: "bg-indigo-500",
                      },
                      {
                        label: "Rotación operativa",
                        value: operationalRotation,
                        tone: "bg-orange-500",
                      },
                    ].map((item) => (
                      <div key={item.label} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{item.label}</span>
                          </div>
                          <span className="text-sm font-bold">
                            {item.value.toFixed(1)}%
                          </span>
                        </div>
                        <Progress
                          value={item.value}
                          className={`[&>div]:${item.tone}`}
                          aria-label={`${item.label}: ${item.value.toFixed(1)}%`}
                        />
                      </div>
                    ))}

                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-xs text-muted-foreground">
                        Retrasos promedio
                      </p>
                      <p className="text-lg font-bold text-orange-600">
                        {averageDelays.toFixed(1)} hrs
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Tendencia trimestral</CardTitle>
                    <CardDescription>
                      Evolución de asistencia en los últimos 3 meses.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {attendanceTrends.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Aún no hay información disponible para los meses
                        anteriores.
                      </div>
                    ) : (
                      <>
                        <AttendanceTrendChart points={attendanceTrends} />
                        {attendanceTrends.length >= 2 && (
                          <div className="mt-6 rounded-lg bg-muted p-4">
                            <div className="flex items-center gap-2">
                              {attendanceTrends[attendanceTrends.length - 1]
                                .value >= attendanceTrends[0].value ? (
                                <>
                                  <TrendingUp className="h-5 w-5 text-green-600" />
                                  <div>
                                    <div className="text-sm font-medium">
                                      Tendencia positiva
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      La asistencia mejoró{" "}
                                      {(
                                        attendanceTrends[
                                          attendanceTrends.length - 1
                                        ].value - attendanceTrends[0].value
                                      ).toFixed(1)}
                                      % en el trimestre.
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <TrendingDown className="h-5 w-5 text-red-600" />
                                  <div>
                                    <div className="text-sm font-medium">
                                      Tendencia negativa
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      La asistencia disminuyó{" "}
                                      {Math.abs(
                                        attendanceTrends[
                                          attendanceTrends.length - 1
                                        ].value - attendanceTrends[0].value,
                                      ).toFixed(1)}
                                      % en el trimestre.
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

                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>Desempeño por sucursal</CardTitle>
                    <CardDescription>
                      Distribución por niveles y sucursales mejor posicionadas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {locationStats.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No hay sucursales configuradas o sin datos de
                        asistencia.
                      </div>
                    ) : (
                      <div className="grid gap-6 lg:grid-cols-2">
                        <LocationStatusDistributionChart
                          counts={locationStatusCounts}
                          total={locationStats.length}
                        />

                        <div className="space-y-3">
                          <p className="text-sm font-semibold">
                            Top 3 del periodo
                          </p>
                          {topLocations.map((location, index) => {
                            const config = getStatusConfig(location.status);
                            const Icon = config.icon;

                            return (
                              <div
                                key={location.locationId}
                                className="rounded-lg border bg-muted/20 p-3"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-xs text-muted-foreground">
                                      Ranking #{location.rank ?? index + 1}
                                    </p>
                                    <p className="font-medium">
                                      {location.locationName}
                                    </p>
                                  </div>
                                  <Badge
                                    variant={config.badge as any}
                                    className="inline-flex items-center gap-1"
                                  >
                                    <Icon className="h-3 w-3" />
                                    {location.attendanceRate.toFixed(1)}%
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>Ubicaciones clave</CardTitle>
                    <CardDescription>
                      Mejor desempeño y puntos que requieren atención inmediata.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {locationsResponse?.best_performer ? (
                      <div className="rounded-lg border p-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase">
                            Mejor desempeño
                          </p>
                          <p className="text-lg font-semibold">
                            {locationsResponse.best_performer.locationName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Asistencia{" "}
                            {locationsResponse.best_performer.attendanceRate.toFixed(
                              1,
                            )}
                            %
                          </p>
                        </div>
                        <Badge variant="default" className="bg-emerald-600">
                          Ranking #{locationsResponse.best_performer.rank}
                        </Badge>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Sin información de ranking para este periodo.
                      </p>
                    )}

                    {(locationsResponse?.needs_attention ?? []).length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground uppercase">
                          Necesitan atención
                        </p>
                        <div className="grid gap-2 md:grid-cols-2">
                          {(locationsResponse?.needs_attention ?? [])
                            .slice(0, 4)
                            .map((location) => (
                              <div
                                key={location.locationId}
                                className="rounded-md border bg-muted/40 p-3"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">
                                    {location.locationName}
                                  </span>
                                  <Badge variant="destructive">
                                    #{location.rank}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Asistencia{" "}
                                  {location.attendanceRate.toFixed(1)}%
                                </p>
                              </div>
                            ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No hay sucursales en estado crítico para este periodo.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="analysis" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Comparativo mensual</CardTitle>
                  <CardDescription>
                    Variación frente al mes anterior para métricas clave.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Asistencia</p>
                        {attendanceTrend !== null && attendanceTrend >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-emerald-600" />
                        ) : attendanceTrend !== null ? (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <p className="mt-2 text-2xl font-bold">
                        {globalAttendance.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {attendanceTrend === null
                          ? "Sin datos del mes anterior"
                          : `${attendanceTrend >= 0 ? "+" : ""}${attendanceTrend.toFixed(1)}% vs mes anterior`}
                      </p>
                    </div>

                    <div className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Puntualidad</p>
                        {punctualityTrend !== null && punctualityTrend >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-blue-600" />
                        ) : punctualityTrend !== null ? (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <p className="mt-2 text-2xl font-bold">
                        {punctualityIndex.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {punctualityTrend === null
                          ? "Sin datos del mes anterior"
                          : `${punctualityTrend >= 0 ? "+" : ""}${punctualityTrend.toFixed(1)}% vs mes anterior`}
                      </p>
                    </div>

                    <div className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Ausentismo</p>
                        {absenteeismTrend !== null && absenteeismTrend <= 0 ? (
                          <TrendingDown className="h-4 w-4 text-emerald-600" />
                        ) : absenteeismTrend !== null ? (
                          <TrendingUp className="h-4 w-4 text-red-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <p className="mt-2 text-2xl font-bold">
                        {globalAbsenteeism.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {absenteeismTrend === null
                          ? "Sin datos del mes anterior"
                          : `${absenteeismTrend >= 0 ? "+" : ""}${absenteeismTrend.toFixed(1)}% vs mes anterior`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Ranking de sucursales</CardTitle>
                  <CardDescription>
                    Comparación por asistencia para detectar brechas de
                    desempeño.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <LocationRankingChart locations={locationStats} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Detalle por sucursal</CardTitle>
                  <CardDescription>
                    Desglose completo de asistencia, ausentismo y puntualidad.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {locationStats.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No hay sucursales configuradas o sin datos de asistencia.
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
                                <p className="text-xs text-muted-foreground">
                                  Ranking #{location.rank ?? index + 1}
                                </p>
                                <p className="text-lg font-semibold">
                                  {location.locationName}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Asistencia vs ausentismo del periodo
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-3xl font-bold">
                                  {location.attendanceRate.toFixed(1)}%
                                </p>
                                <Badge
                                  variant={config.badge as any}
                                  className="mt-1 inline-flex items-center gap-1"
                                >
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
                                <p className="text-xs text-muted-foreground">
                                  Asistencia
                                </p>
                                <p className="text-base font-semibold text-green-600">
                                  {location.attendanceRate.toFixed(1)}%
                                </p>
                              </div>
                              <div className="rounded-md bg-muted p-3">
                                <p className="text-xs text-muted-foreground">
                                  Ausentismo
                                </p>
                                <p className="text-base font-semibold text-red-600">
                                  {location.absenteeismRate.toFixed(1)}%
                                </p>
                              </div>
                              <div className="rounded-md bg-muted p-3">
                                <p className="text-xs text-muted-foreground">
                                  Puntualidad
                                </p>
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

              {!costsResponse ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Sin datos de costos</AlertTitle>
                  <AlertDescription>
                    Aún no hay información de costos disponible para este
                    periodo.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          Costo por ausentismo
                        </CardTitle>
                        <DollarSign className="h-4 w-4 text-red-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatCurrencyMXN(costsResponse.absenteeismCost)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Horas perdidas × salario promedio/hora.
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          Costo de horas extra
                        </CardTitle>
                        <Clock className="h-4 w-4 text-blue-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatCurrencyMXN(costsResponse.overtimeCost)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Horas extra × tarifa premium.
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          Impacto total
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
                      <CardTitle>Composición de costos</CardTitle>
                      <CardDescription>
                        Relación entre ausentismo y horas extra del periodo.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <CostCompositionChart costs={costsResponse} />
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
