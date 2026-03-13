import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/App";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

const SettingsPage = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState(() => {
    const saved = localStorage.getItem("sentinel-notification-settings");
    return saved
      ? JSON.parse(saved)
      : {
          emailEnabled: true,
          high: true,
          medium: true,
          low: true
        };
  });

  useEffect(() => {
    localStorage.setItem("sentinel-notification-settings", JSON.stringify(notificationSettings));
  }, [notificationSettings]);

  const handleSidebarNavigate = (label) => {
    if (label === "Settings") return;
    if (label === "Users & Accounts") {
      navigate("/users-accounts");
      return;
    }
    if (label === "Threats") {
      navigate("/threats");
      return;
    }
    if (label === "Credentials") {
      navigate("/credentials");
      return;
    }
    if (label === "Compliance") {
      navigate("/compliance");
      return;
    }
    navigate("/dashboard");
  };

  const toggleThemeMode = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const updateNotificationSetting = (key, value) => {
    setNotificationSettings((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="min-h-screen bg-background flex" data-testid="settings-page">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeSection="Settings"
        onNavigate={handleSidebarNavigate}
      />

      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? "ml-16" : "ml-64"}`}>
        <Header notifications={[]} />

        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-5xl mx-auto space-y-6">
            <section>
              <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
              <p className="text-muted-foreground mt-1">Manage theme and alert notification preferences.</p>
            </section>

            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle className="text-base font-medium">Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
                  <div>
                    <p className="font-medium">Theme</p>
                    <p className="text-sm text-muted-foreground">Current mode: {theme}</p>
                  </div>
                  <Button onClick={toggleThemeMode} variant="outline">
                    Switch to {theme === "dark" ? "Light" : "Dark"} Mode
                  </Button>
                </div>

                <div className="space-y-4 rounded-lg border border-border/60 p-4">
                  <div>
                    <p className="font-medium">Alert Notifications</p>
                    <p className="text-sm text-muted-foreground">Choose which alert severities you want to receive.</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Enable Email Notifications</span>
                    <Switch
                      checked={notificationSettings.emailEnabled}
                      onCheckedChange={(checked) => updateNotificationSetting("emailEnabled", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">High Severity Alerts</span>
                    <Switch
                      checked={notificationSettings.high}
                      onCheckedChange={(checked) => updateNotificationSetting("high", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Medium Severity Alerts</span>
                    <Switch
                      checked={notificationSettings.medium}
                      onCheckedChange={(checked) => updateNotificationSetting("medium", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Low Severity Alerts</span>
                    <Switch
                      checked={notificationSettings.low}
                      onCheckedChange={(checked) => updateNotificationSetting("low", checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SettingsPage;
