import { useState } from "react";
import { UserX, Clock, FileWarning, ChevronRight, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import PermissionModal from "./PermissionModal";

const AccessHygiene = ({ data, onRefresh }) => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);

  if (!data) return null;

  const totalIssues = data.overprivileged_accounts + data.stale_accounts + data.policy_violations;

  const hygieneItems = [
    {
      icon: UserX,
      label: "Overprivileged Accounts",
      description: "Accounts with more access than needed",
      value: data.overprivileged_accounts,
      color: "text-amber-500",
      bgColor: "bg-amber-500",
      type: "overprivileged",
      percentage: Math.round((data.overprivileged_accounts / Math.max(1, totalIssues)) * 100)
    },
    {
      icon: Clock,
      label: "Stale Accounts",
      description: "Inactive for 30+ days",
      value: data.stale_accounts,
      color: "text-purple-500",
      bgColor: "bg-purple-500",
      type: "stale",
      percentage: Math.round((data.stale_accounts / Math.max(1, totalIssues)) * 100)
    },
    {
      icon: FileWarning,
      label: "Policy Violations",
      description: "Security policy breaches detected",
      value: data.policy_violations,
      color: "text-red-500",
      bgColor: "bg-red-500",
      type: "policy_violation",
      percentage: Math.round((data.policy_violations / Math.max(1, totalIssues)) * 100)
    }
  ];

  const handleItemClick = (item) => {
    if (item.type !== "overprivileged") return;

    if (data.items && data.items.length > 0) {
      const hygieneItem = data.items.find(i => i.type === "overprivileged");
      if (hygieneItem) {
        setSelectedItem(hygieneItem);
        setPermissionModalOpen(true);
        return;
      }
    }

    const fallbackHygieneItem = {
      id: "mock-overprivileged-001",
      type: "overprivileged",
      account_name: "prod-admin-service-account",
      account_type: "Service Account",
      issue: `${item.value || 0} overprivileged accounts detected requiring permission cleanup.`,
      details: {
        current_permissions: ["admin:*", "iam:PassRole", "kms:Decrypt", "s3:*"],
        recommended_permissions: ["iam:ReadOnly", "s3:GetObject", "kms:Decrypt"],
        risk_score: 86
      }
    };

    setSelectedItem(fallbackHygieneItem);
    setPermissionModalOpen(true);
  };

  const handlePermissionSuccess = () => {
    onRefresh?.();
  };

  return (
    <>
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 h-full">
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Access Hygiene
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5" data-testid="access-hygiene-content">
          {hygieneItems.map((item) => (
            <div 
              key={item.label} 
              className={`space-y-2 ${item.type === "overprivileged" ? "cursor-pointer hover:bg-muted/30 -mx-2 px-2 py-2 rounded-lg transition-colors" : ""}`}
              onClick={() => handleItemClick(item)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-muted ${item.color}`}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      {item.label}
                      {item.type === "overprivileged" && (
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                          Click to Fix
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{item.value}</span>
                  {item.type === "overprivileged" && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="relative">
                <Progress 
                  value={item.percentage} 
                  className="h-2 bg-muted"
                />
                <div 
                  className={`absolute top-0 left-0 h-2 rounded-full ${item.bgColor}`}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}

          {/* Detailed Items List */}
          {data.items && data.items.length > 0 && (
            <div className="pt-4 border-t border-border">
              <p className="text-sm font-medium mb-3">Issues Requiring Action</p>
              <ScrollArea className="h-[120px]">
                <div className="space-y-2">
                  {data.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedItem(item);
                        setPermissionModalOpen(true);
                      }}
                      data-testid={`hygiene-item-${item.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${
                          item.type === "overprivileged" ? "bg-amber-500/10 text-amber-500 border-amber-500/30" :
                          item.type === "stale" ? "bg-purple-500/10 text-purple-500 border-purple-500/30" :
                          "bg-red-500/10 text-red-500 border-red-500/30"
                        }`}>
                          {item.type.replace("_", " ")}
                        </Badge>
                        <span className="text-sm truncate max-w-[150px]">{item.account_name}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Issues</span>
              <span className="text-lg font-semibold">{totalIssues}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permission Modal */}
      <PermissionModal
        open={permissionModalOpen}
        onClose={() => setPermissionModalOpen(false)}
        hygieneItem={selectedItem}
        onSuccess={handlePermissionSuccess}
      />
    </>
  );
};

export default AccessHygiene;
