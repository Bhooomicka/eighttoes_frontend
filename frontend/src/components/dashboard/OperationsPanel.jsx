import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth, API } from "@/App";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Settings2, Save, CalendarClock } from "lucide-react";
import { toast } from "sonner";

const emptyWindow = { day_of_week: 1, start_hour: 2, end_hour: 4 };

const LOCAL_OPERATIONS_STORAGE_KEY = "sentinel-local-operations";

const DEFAULT_CONFIG = {
  safe_mode_enabled: false,
  peak_season_active: false,
  maintenance_windows: []
};

const isBackendUnavailable = (error) => error?.code === "ERR_NETWORK" || !error?.response;

const loadLocalConfig = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_OPERATIONS_STORAGE_KEY) || JSON.stringify(DEFAULT_CONFIG));
  } catch {
    return DEFAULT_CONFIG;
  }
};

const saveLocalConfig = (config) => {
  localStorage.setItem(LOCAL_OPERATIONS_STORAGE_KEY, JSON.stringify(config));
};

const dayLabel = (value) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][value] || "Day";

const OperationsPanel = () => {
  const { token, user } = useAuth();
  const [config, setConfig] = useState({
    safe_mode_enabled: false,
    peak_season_active: false,
    maintenance_windows: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
  const canEdit = user?.role === "admin";
  const isMockSession = token === "mock-token-12345";

  const fetchConfig = async () => {
    if (isMockSession) {
      setLoading(false);
      setConfig(loadLocalConfig());
      return;
    }
    try {
      setLoading(true);
      const response = await axios.get(`${API}/settings/operations`, authHeaders);
      setConfig(response.data);
      saveLocalConfig(response.data);
    } catch (error) {
      console.error("Failed to load operations config", error);
      if (isBackendUnavailable(error)) {
        setConfig(loadLocalConfig());
      } else {
        toast.error("Failed to load operations settings");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin" || user?.role === "team_lead") {
      fetchConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.role]);

  if (user?.role !== "admin" && user?.role !== "team_lead") {
    return null;
  }

  const updateWindow = (index, field, value) => {
    setConfig((current) => ({
      ...current,
      maintenance_windows: current.maintenance_windows.map((window, currentIndex) =>
        currentIndex === index ? { ...window, [field]: Number(value) } : window
      )
    }));
  };

  const addWindow = () => {
    setConfig((current) => ({
      ...current,
      maintenance_windows: [...current.maintenance_windows, { ...emptyWindow }]
    }));
  };

  const removeWindow = (index) => {
    setConfig((current) => ({
      ...current,
      maintenance_windows: current.maintenance_windows.filter((_, currentIndex) => currentIndex !== index)
    }));
  };

  const handleSave = async () => {
    if (!canEdit) return;

    if (isMockSession) {
      saveLocalConfig(config);
      toast.success("Operations settings saved locally (mock mode)");
      return;
    }

    setSaving(true);
    try {
      const response = await axios.put(`${API}/settings/operations`, config, authHeaders);
      setConfig(response.data.config);
      saveLocalConfig(response.data.config);
      toast.success("Operations settings updated");
    } catch (error) {
      console.error("Failed to save operations settings", error);
      if (isBackendUnavailable(error)) {
        saveLocalConfig(config);
        toast.success("Operations settings saved locally (offline mode)");
      } else {
        toast.error(error.response?.data?.detail || "Failed to save operations settings");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 h-full">
      <CardHeader>
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          Sales-Safe Operations
        </CardTitle>
        <CardDescription>
          Control safe mode and maintenance windows for queued permission changes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5" data-testid="operations-panel">
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 p-4">
          <div>
            <Label className="text-sm font-medium">Safe Mode</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Queue approved permission changes outside maintenance windows.
            </p>
          </div>
          <Switch
            checked={config.safe_mode_enabled}
            onCheckedChange={(checked) => setConfig((current) => ({ ...current, safe_mode_enabled: checked }))}
            disabled={!canEdit}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 p-4">
          <div>
            <Label className="text-sm font-medium">Peak Season Active</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Simulates Black Friday or other high-sensitivity retail periods.
            </p>
          </div>
          <Switch
            checked={config.peak_season_active}
            onCheckedChange={(checked) => setConfig((current) => ({ ...current, peak_season_active: checked }))}
            disabled={!canEdit}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Maintenance Windows</Label>
              <p className="text-xs text-muted-foreground mt-1">Queued changes are applied only during these windows.</p>
            </div>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={addWindow}>
                Add Window
              </Button>
            )}
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground">Loading operations settings...</div>
          ) : (
            <div className="space-y-3">
              {config.maintenance_windows.map((window, index) => (
                <div key={`${window.day_of_week}-${index}`} className="rounded-lg border border-border/60 bg-background/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                      <CalendarClock className="w-3 h-3 mr-1" />
                      Window {index + 1}
                    </Badge>
                    {canEdit && (
                      <Button size="sm" variant="ghost" onClick={() => removeWindow(index)}>
                        Remove
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Day</Label>
                      <Input
                        type="number"
                        min="0"
                        max="6"
                        value={window.day_of_week}
                        disabled={!canEdit}
                        onChange={(event) => updateWindow(index, "day_of_week", event.target.value)}
                      />
                      <p className="text-[11px] text-muted-foreground">{dayLabel(window.day_of_week)}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Start Hour</Label>
                      <Input
                        type="number"
                        min="0"
                        max="23"
                        value={window.start_hour}
                        disabled={!canEdit}
                        onChange={(event) => updateWindow(index, "start_hour", event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">End Hour</Label>
                      <Input
                        type="number"
                        min="0"
                        max="23"
                        value={window.end_hour}
                        disabled={!canEdit}
                        onChange={(event) => updateWindow(index, "end_hour", event.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {config.maintenance_windows.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No maintenance windows configured yet.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/30 p-4">
          <div>
            <p className="text-sm font-medium">Current Status</p>
            <p className="text-xs text-muted-foreground mt-1">
              {config.safe_mode_enabled && config.peak_season_active
                ? "Safe mode is actively queueing permission changes outside windows."
                : "Approved permission changes apply immediately unless you force scheduling."}
            </p>
          </div>
          <Badge variant="outline" className={config.safe_mode_enabled && config.peak_season_active ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"}>
            {config.safe_mode_enabled && config.peak_season_active ? "Queued Mode" : "Live Mode"}
          </Badge>
        </div>

        {canEdit && (
          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Operations Settings"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default OperationsPanel;
