import { Users, UserCheck, AlertTriangle, Key, TrendingUp, TrendingDown, ClipboardList, UserX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const MetricCard = ({ title, value, subtitle, icon: Icon, trend, trendValue, color, isPersonal }) => {
  if (value === null || value === undefined) return null;
  
  const isPositiveTrend = trend === 'up';
  
  return (
    <Card className="metric-card bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/30 cursor-pointer">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{typeof value === 'number' ? value.toLocaleString() : value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={`p-3 rounded-xl ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
        {trendValue && !isPersonal && (
          <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${
            isPositiveTrend ? 'text-emerald-500' : 'text-red-500'
          }`}>
            {isPositiveTrend ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span>{trendValue}% from last week</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const MetricsGrid = ({ metrics, isPersonalView }) => {
  if (!metrics) return null;

  // Different metrics for team members vs admin/lead
  const metricsConfig = isPersonalView ? [
    {
      title: "Your Open Alerts",
      value: metrics.flagged_accounts,
      subtitle: "Assigned to you",
      icon: AlertTriangle,
      color: "bg-amber-500",
    },
    {
      title: "Pending Offboarding",
      value: metrics.pending_offboarding,
      subtitle: "Awaiting revocation",
      icon: UserX,
      color: "bg-red-500",
    },
    {
      title: "Credentials Due",
      value: metrics.credentials_due_rotation,
      subtitle: "Rotation required",
      icon: Key,
      color: "bg-purple-500",
    },
    {
      title: "Hygiene Issues",
      value: metrics.hygiene_issues,
      subtitle: "Under your management",
      icon: ClipboardList,
      color: "bg-blue-500",
    }
  ] : [
    {
      title: "Total Active Users",
      value: metrics.total_active_users,
      subtitle: `${metrics.service_accounts} service accounts`,
      icon: Users,
      color: "bg-blue-500",
      trend: "up",
      trendValue: 12
    },
    {
      title: "Privileged Accounts",
      value: metrics.privileged_accounts,
      subtitle: "Currently active",
      icon: UserCheck,
      color: "bg-purple-500",
      trend: "down",
      trendValue: 3
    },
    {
      title: "Flagged Accounts",
      value: metrics.flagged_accounts,
      subtitle: "This week",
      icon: AlertTriangle,
      color: "bg-amber-500",
      trend: "up",
      trendValue: 8
    },
    {
      title: "Credentials Due",
      value: metrics.credentials_due_rotation,
      subtitle: "Rotation required",
      icon: Key,
      color: "bg-red-500",
      trend: "down",
      trendValue: 15
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="metrics-grid">
      {metricsConfig.map((metric, index) => (
        <MetricCard key={metric.title} {...metric} isPersonal={isPersonalView} />
      ))}
    </div>
  );
};

export default MetricsGrid;
