import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  AlertTriangle, CheckCircle2, XCircle, Clock, Shield, 
  User, MapPin, Server, Key, FileText, Activity,
  RefreshCw, Ban, Eye, UserMinus
} from "lucide-react";
import { toast } from "sonner";

const DetailModal = ({ open, onClose, data, type, onAction, userRole }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [revokeTimer, setRevokeTimer] = useState(null);
  const [revokeStartTime, setRevokeStartTime] = useState(null);

  if (!data) return null;

  const handleAction = async (action, actionData = {}) => {
    setIsLoading(true);
    try {
      await onAction(type, data.id, action, actionData);
      toast.success(
        action === "resolved" ? "Alert resolved successfully" :
        action === "investigating" ? "Alert marked as investigating" :
        action === "dismissed" ? "Alert dismissed" :
        "Action completed successfully"
      );
    } catch (error) {
      toast.error("Failed to perform action");
    } finally {
      setIsLoading(false);
    }
  };

  const startRevokeTimer = () => {
    const startTime = Date.now();
    setRevokeStartTime(startTime);
    setRevokeTimer(setInterval(() => {
      // Timer updates will cause re-render
    }, 100));
  };

  const completeRevoke = async () => {
    if (revokeTimer) {
      clearInterval(revokeTimer);
      const elapsed = Math.round((Date.now() - revokeStartTime) / 1000);
      setRevokeTimer(null);
      setRevokeStartTime(null);
      await handleAction("revoke", { access_revoked: true, revoke_time_seconds: elapsed });
    }
  };

  const getElapsedTime = () => {
    if (!revokeStartTime) return 0;
    return ((Date.now() - revokeStartTime) / 1000).toFixed(1);
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "high": return "bg-red-500/15 text-red-500 border-red-500/30";
      case "medium": return "bg-amber-500/15 text-amber-500 border-amber-500/30";
      case "low": return "bg-emerald-500/15 text-emerald-500 border-emerald-500/30";
      default: return "bg-blue-500/15 text-blue-500 border-blue-500/30";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "open": return "bg-red-500/15 text-red-500";
      case "investigating": return "bg-amber-500/15 text-amber-500";
      case "resolved": return "bg-emerald-500/15 text-emerald-500";
      case "dismissed": return "bg-gray-500/15 text-gray-500";
      default: return "bg-blue-500/15 text-blue-500";
    }
  };

  // Alert Detail View
  if (type === "alert") {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl bg-card border-border" data-testid="alert-detail-modal">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  {data.title}
                </DialogTitle>
                <DialogDescription className="mt-2">
                  {data.description}
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className={getSeverityColor(data.severity)}>
                  {data.severity}
                </Badge>
                <Badge variant="outline" className={getStatusColor(data.status)}>
                  {data.status}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Meta Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{new Date(data.timestamp).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Server className="w-4 h-4" />
                <span>Source: {data.source}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="w-4 h-4" />
                <span>Assigned to: {data.assigned_name}</span>
              </div>
            </div>

            <Separator />

            {/* Details Section */}
            {data.details && (
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Alert Details
                </h4>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                  {data.details.ip_address && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IP Address</span>
                      <span className="font-mono">{data.details.ip_address}</span>
                    </div>
                  )}
                  {data.details.failed_attempts && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Failed Attempts</span>
                      <span className="font-mono text-red-500">{data.details.failed_attempts}</span>
                    </div>
                  )}
                  {data.details.user && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">User</span>
                      <span className="font-mono">{data.details.user}</span>
                    </div>
                  )}
                  {data.details.attempted_resource && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Attempted Resource</span>
                      <span className="font-mono">{data.details.attempted_resource}</span>
                    </div>
                  )}
                  {data.details.service_account && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Service Account</span>
                      <span className="font-mono">{data.details.service_account}</span>
                    </div>
                  )}
                  {data.details.api_calls && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">API Calls</span>
                      <span className="font-mono">{data.details.api_calls} (baseline: {data.details.normal_baseline})</span>
                    </div>
                  )}
                  {data.details.geo_location && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location</span>
                      <span>{data.details.geo_location}</span>
                    </div>
                  )}
                  {data.details.location && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location</span>
                      <span>{data.details.location}</span>
                    </div>
                  )}
                  {data.details.device && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Device</span>
                      <span>{data.details.device}</span>
                    </div>
                  )}
                  {data.details.targeted_accounts && (
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground">Targeted Accounts</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {data.details.targeted_accounts.map((acc, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{acc}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Recommended Action */}
                {data.details.recommended_action && (
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                    <h5 className="font-medium text-primary flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4" />
                      Recommended Action
                    </h5>
                    <p className="text-sm">{data.details.recommended_action}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {data.status === "open" && (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => handleAction("investigating")}
                  disabled={isLoading}
                  data-testid="alert-investigate-btn"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Investigate
                </Button>
                <Button 
                  variant="outline"
                  className="text-muted-foreground"
                  onClick={() => handleAction("dismissed")}
                  disabled={isLoading}
                  data-testid="alert-dismiss-btn"
                >
                  <Ban className="w-4 h-4 mr-2" />
                  Dismiss
                </Button>
                <Button 
                  onClick={() => handleAction("resolved")}
                  disabled={isLoading}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  data-testid="alert-resolve-btn"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark Resolved
                </Button>
              </>
            )}
            {data.status === "investigating" && (
              <>
                <Button 
                  variant="outline"
                  className="text-muted-foreground"
                  onClick={() => handleAction("dismissed")}
                  disabled={isLoading}
                >
                  <Ban className="w-4 h-4 mr-2" />
                  Dismiss
                </Button>
                <Button 
                  onClick={() => handleAction("resolved")}
                  disabled={isLoading}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark Resolved
                </Button>
              </>
            )}
            {(data.status === "resolved" || data.status === "dismissed") && (
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Offboarding Detail View
  if (type === "offboarding") {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl bg-card border-border" data-testid="offboarding-detail-modal">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <UserMinus className="w-5 h-5 text-primary" />
              Offboarding: {data.name}
            </DialogTitle>
            <DialogDescription>
              {data.email} • {data.department}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Status */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm text-muted-foreground">Access Status</p>
                <p className="font-semibold flex items-center gap-2 mt-1">
                  {data.access_revoked ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      <span className="text-emerald-500">Revoked</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-red-500" />
                      <span className="text-red-500">Pending Revocation</span>
                    </>
                  )}
                </p>
              </div>
              {data.access_revoked && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Revoke Time</p>
                  <p className="text-2xl font-bold text-emerald-500 font-mono">{data.revoke_time_seconds}s</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Details */}
            {data.details && (
              <div className="space-y-3">
                <h4 className="font-semibold">Employee Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Position</p>
                    <p className="font-medium">{data.details.position}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Departure Date</p>
                    <p className="font-medium">{data.departure_date}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Exit Interview</p>
                    <p className="font-medium">{data.details.exit_interview}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Equipment Returned</p>
                    <p className="font-medium">{data.details.equipment_returned ? "Yes" : "No"}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-muted-foreground text-sm mb-2">Systems Access to Revoke</p>
                  <div className="flex flex-wrap gap-2">
                    {data.details.systems_access?.map((system, i) => (
                      <Badge 
                        key={i} 
                        variant="secondary"
                        className={data.access_revoked ? "bg-emerald-500/10 text-emerald-500 line-through" : ""}
                      >
                        {system}
                      </Badge>
                    ))}
                  </div>
                </div>

                {data.access_revoked && data.details.revoked_by && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 mt-4">
                    <p className="text-sm text-emerald-400">
                      Revoked by <span className="font-semibold">{data.details.revoked_by}</span> on{' '}
                      {new Date(data.details.revocation_timestamp).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            {!data.access_revoked && (
              <>
                {!revokeTimer ? (
                  <Button 
                    onClick={startRevokeTimer}
                    className="bg-red-600 hover:bg-red-700"
                    data-testid="start-revoke-btn"
                  >
                    <Key className="w-4 h-4 mr-2" />
                    Start Revocation
                  </Button>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Elapsed Time</p>
                      <p className="text-2xl font-bold font-mono text-primary">{getElapsedTime()}s</p>
                    </div>
                    <Button 
                      onClick={completeRevoke}
                      className="bg-emerald-600 hover:bg-emerald-700 animate-pulse"
                      disabled={isLoading}
                      data-testid="complete-revoke-btn"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Complete Revocation
                    </Button>
                  </div>
                )}
              </>
            )}
            {data.access_revoked && (
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Credential Detail View
  if (type === "credential") {
    const isOverdue = data.status === "overdue";
    
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl bg-card border-border" data-testid="credential-detail-modal">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <Key className="w-5 h-5 text-primary" />
                  {data.name}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {data.type} • {data.details?.service}
                </DialogDescription>
              </div>
              <Badge 
                variant="outline" 
                className={isOverdue ? "bg-red-500/15 text-red-500 border-red-500/30" : "bg-amber-500/15 text-amber-500 border-amber-500/30"}
              >
                {isOverdue ? "Overdue" : "Due Soon"}
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Rotation Status */}
            <div className={`p-4 rounded-lg ${isOverdue ? 'bg-red-500/10 border border-red-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className={`text-lg font-semibold ${isOverdue ? 'text-red-500' : 'text-amber-500'}`}>
                    {data.due_date}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Last Rotated</p>
                  <p className="font-medium">{data.details?.last_rotated}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Details */}
            {data.details && (
              <div className="space-y-3">
                <h4 className="font-semibold">Credential Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Environment</p>
                    <p className="font-medium">{data.details.environment}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Rotation Policy</p>
                    <p className="font-medium">{data.details.rotation_policy}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Managed By</p>
                    <p className="font-medium">{data.manager_name}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-muted-foreground text-sm mb-2">Associated Services</p>
                  <div className="flex flex-wrap gap-2">
                    {data.details.associated_services?.map((service, i) => (
                      <Badge key={i} variant="secondary">{service}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {data.status !== "rotated" && (
              <Button 
                onClick={() => handleAction("rotate")}
                disabled={isLoading}
                className="bg-primary hover:bg-primary/90"
                data-testid="rotate-credential-btn"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Mark as Rotated
              </Button>
            )}
            {data.status === "rotated" && (
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
};

export default DetailModal;
