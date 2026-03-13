import { AlertTriangle, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip bg-card border border-border rounded-lg p-3 shadow-xl">
        <p className="text-sm font-medium mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground capitalize">{entry.dataKey}:</span>
            <span className="font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const ThreatSection = ({ alerts, chartData, onAlertClick, isPersonalView }) => {
  const getSeverityBadge = (severity) => {
    const styles = {
      high: "status-high",
      medium: "status-medium",
      low: "status-low"
    };
    return styles[severity] || styles.low;
  };

  const getStatusBadge = (status) => {
    const styles = {
      open: "bg-red-500/15 text-red-500 border-red-500/30",
      investigating: "bg-amber-500/15 text-amber-500 border-amber-500/30",
      resolved: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
      dismissed: "bg-gray-500/15 text-gray-500 border-gray-500/30"
    };
    return styles[status] || styles.open;
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-500" />
        {isPersonalView ? "Your Assigned Alerts" : "Threat & Anomaly Detection"}
      </h2>
      
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Alert Chart - Hide for personal view if no data */}
        {!isPersonalView && (
          <Card className="xl:col-span-3 bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Alerts Over Time (Last 7 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]" data-testid="alerts-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="highGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="mediumGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="lowGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      verticalAlign="top" 
                      height={36}
                      formatter={(value) => <span className="text-xs capitalize text-muted-foreground">{value}</span>}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="high" 
                      stroke="#ef4444" 
                      fill="url(#highGradient)" 
                      strokeWidth={2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="medium" 
                      stroke="#f59e0b" 
                      fill="url(#mediumGradient)" 
                      strokeWidth={2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="low" 
                      stroke="#10b981" 
                      fill="url(#lowGradient)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Alerts List */}
        <Card className={`${isPersonalView ? 'xl:col-span-5' : 'xl:col-span-2'} bg-card/50 backdrop-blur-sm border-border/50`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              {isPersonalView ? "Alerts Assigned to You" : "Recent Anomaly Alerts"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className={isPersonalView ? "h-[400px]" : "h-[300px]"}>
              <div className="space-y-1 p-4 pt-0" data-testid="alerts-list">
                {alerts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No alerts assigned to you
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer border border-transparent hover:border-primary/30"
                      onClick={() => onAlertClick(alert.id)}
                      data-testid={`alert-${alert.id}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-medium line-clamp-1">{alert.title}</p>
                        <div className="flex gap-1 shrink-0">
                          <Badge variant="outline" className={`text-[10px] ${getSeverityBadge(alert.severity)}`}>
                            {alert.severity}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] ${getStatusBadge(alert.status)}`}>
                            {alert.status}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{alert.description}</p>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
                        <span>{alert.source}</span>
                        <span>{formatTime(alert.timestamp)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ThreatSection;
