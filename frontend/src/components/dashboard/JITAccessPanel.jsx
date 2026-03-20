import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth, API } from "@/App";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldAlert, Plus, Clock3, CheckCircle2, XCircle, Ban } from "lucide-react";
import { toast } from "sonner";

const STATUS_STYLES = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  rejected: "bg-red-500/10 text-red-400 border-red-500/30",
  revoked: "bg-slate-500/10 text-slate-300 border-slate-500/30",
  expired: "bg-purple-500/10 text-purple-400 border-purple-500/30"
};

const LOCAL_JIT_STORAGE_KEY = "sentinel-local-jit-requests";

const isBackendUnavailable = (error) => error?.code === "ERR_NETWORK" || !error?.response;

const loadLocalRequests = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_JIT_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveLocalRequests = (requests) => {
  localStorage.setItem(LOCAL_JIT_STORAGE_KEY, JSON.stringify(requests));
};

const INITIAL_FORM = {
  account_id: "",
  account_type: "user",
  access_level: "admin",
  resource_scope: "",
  justification: "",
  duration_minutes: 60
};

const JITAccessPanel = () => {
  const { token, user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
  const canApprove = user?.role === "admin" || user?.role === "team_lead";
  const isMockSession = token === "mock-token-12345";

  const fetchRequests = async () => {
    if (isMockSession) {
      setLoading(false);
      setRequests(loadLocalRequests());
      return;
    }
    try {
      setLoading(true);
      const response = await axios.get(`${API}/jit-access/requests`, authHeaders);
      setRequests(response.data || []);
      saveLocalRequests(response.data || []);
    } catch (error) {
      console.error("Failed to load JIT access requests", error);
      if (isBackendUnavailable(error)) {
        setRequests(loadLocalRequests());
      } else {
        toast.error("Failed to load JIT access requests");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const resetForm = () => setForm(INITIAL_FORM);

  const handleCreate = async () => {
    if (!form.account_id.trim() || !form.justification.trim()) {
      toast.error("Account and justification are required");
      return;
    }

    if (isMockSession) {
      const now = new Date();
      const canAutoActivate = canApprove;
      const localItem = {
        id: `local-jit-${Date.now()}`,
        account_id: form.account_id.trim(),
        account_type: form.account_type,
        access_level: form.access_level,
        resource_scope: form.resource_scope
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        justification: form.justification.trim(),
        duration_minutes: Number(form.duration_minutes),
        requested_by: user?.id || "local-user",
        requested_at: now.toISOString(),
        status: canAutoActivate ? "active" : "pending",
        expires_at: canAutoActivate
          ? new Date(now.getTime() + Number(form.duration_minutes) * 60 * 1000).toISOString()
          : null
      };
      const next = [localItem, ...requests];
      setRequests(next);
      saveLocalRequests(next);
      setOpen(false);
      resetForm();
      toast.success("JIT request saved locally (mock mode)");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        account_id: form.account_id.trim(),
        account_type: form.account_type,
        access_level: form.access_level,
        resource_scope: form.resource_scope
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        justification: form.justification.trim(),
        duration_minutes: Number(form.duration_minutes)
      };
      const response = await axios.post(`${API}/jit-access/requests`, payload, authHeaders);
      toast.success(
        response.data.status === "active" ? "Privileged access granted" : "JIT access request submitted"
      );
      setOpen(false);
      resetForm();
      await fetchRequests();
    } catch (error) {
      console.error("Failed to create JIT request", error);
      if (isBackendUnavailable(error)) {
        const now = new Date();
        const canAutoActivate = canApprove;
        const localItem = {
          id: `local-jit-${Date.now()}`,
          account_id: form.account_id.trim(),
          account_type: form.account_type,
          access_level: form.access_level,
          resource_scope: form.resource_scope
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          justification: form.justification.trim(),
          duration_minutes: Number(form.duration_minutes),
          requested_by: user?.id || "local-user",
          requested_at: now.toISOString(),
          status: canAutoActivate ? "active" : "pending",
          expires_at: canAutoActivate
            ? new Date(now.getTime() + Number(form.duration_minutes) * 60 * 1000).toISOString()
            : null
        };
        const next = [localItem, ...requests];
        setRequests(next);
        saveLocalRequests(next);
        setOpen(false);
        resetForm();
        toast.success("JIT request saved locally (offline mode)");
      } else {
        toast.error(error.response?.data?.detail || "Failed to submit request");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecision = async (requestId, action) => {
    if (isMockSession) {
      const statusByAction = {
        approve: "active",
        reject: "rejected",
        revoke: "revoked"
      };
      const next = requests.map((item) =>
        item.id === requestId
          ? {
              ...item,
              status: statusByAction[action] || item.status,
              expires_at:
                action === "approve"
                  ? new Date(Date.now() + Number(item.duration_minutes || 60) * 60 * 1000).toISOString()
                  : item.expires_at
            }
          : item
      );
      setRequests(next);
      saveLocalRequests(next);
      toast.success(`Request ${action}d (mock mode)`);
      return;
    }

    try {
      await axios.put(`${API}/jit-access/${requestId}/${action}`, { notes: `${action} from dashboard` }, authHeaders);
      toast.success(`Request ${action}d`);
      await fetchRequests();
    } catch (error) {
      console.error(`Failed to ${action} JIT request`, error);
      if (isBackendUnavailable(error)) {
        const statusByAction = {
          approve: "active",
          reject: "rejected",
          revoke: "revoked"
        };
        const next = requests.map((item) =>
          item.id === requestId
            ? {
                ...item,
                status: statusByAction[action] || item.status,
                expires_at:
                  action === "approve"
                    ? new Date(Date.now() + Number(item.duration_minutes || 60) * 60 * 1000).toISOString()
                    : item.expires_at
              }
            : item
        );
        setRequests(next);
        saveLocalRequests(next);
        toast.success(`Request ${action}d (offline mode)`);
      } else {
        toast.error(error.response?.data?.detail || `Failed to ${action} request`);
      }
    }
  };

  const formatExpiry = (value) => {
    if (!value) return "Awaiting approval";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  };

  return (
    <>
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 h-full">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-primary" />
              JIT Privileged Access
            </CardTitle>
            <CardDescription className="mt-1">
              Request, approve, and revoke short-lived privileged access.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setOpen(true)} data-testid="open-jit-modal">
            <Plus className="w-4 h-4 mr-2" />
            Request
          </Button>
        </CardHeader>
        <CardContent className="space-y-4" data-testid="jit-access-panel">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-xl font-semibold">{requests.filter((item) => item.status === "pending").length}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="text-xl font-semibold">{requests.filter((item) => item.status === "active").length}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <p className="text-xs text-muted-foreground">Expired</p>
              <p className="text-xl font-semibold">{requests.filter((item) => item.status === "expired").length}</p>
            </div>
          </div>

          <ScrollArea className="h-[250px] pr-3">
            <div className="space-y-3">
              {!loading && requests.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No JIT access requests yet.
                </div>
              )}

              {requests.map((request) => (
                <div key={request.id} className="rounded-lg border border-border/60 bg-background/30 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{request.account_id}</p>
                      <p className="text-xs text-muted-foreground">
                        {request.account_type} · {request.access_level}
                      </p>
                    </div>
                    <Badge variant="outline" className={STATUS_STYLES[request.status] || STATUS_STYLES.revoked}>
                      {request.status}
                    </Badge>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="line-clamp-2">{request.justification}</p>
                    <p className="flex items-center gap-1">
                      <Clock3 className="w-3 h-3" />
                      Expires: {formatExpiry(request.expires_at)}
                    </p>
                  </div>

                  {canApprove && (
                    <div className="flex flex-wrap gap-2">
                      {request.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => handleDecision(request.id, "approve")}>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDecision(request.id, "reject")}>
                            <XCircle className="w-4 h-4 mr-2" />
                            Reject
                          </Button>
                        </>
                      )}
                      {request.status === "active" && (
                        <Button size="sm" variant="outline" onClick={() => handleDecision(request.id, "revoke")}>
                          <Ban className="w-4 h-4 mr-2" />
                          Revoke
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl bg-card border-border">
          <DialogHeader>
            <DialogTitle>Request Privileged Access</DialogTitle>
            <DialogDescription>
              Create a short-lived access request so you can test the JIT backend flow end to end.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="jit-account-id">Account ID</Label>
              <Input
                id="jit-account-id"
                value={form.account_id}
                onChange={(event) => setForm((current) => ({ ...current, account_id: event.target.value }))}
                placeholder="john.doe@company.com or prod-admin-bot"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Account Type</Label>
                <Select
                  value={form.account_type}
                  onValueChange={(value) => setForm((current) => ({ ...current, account_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="service_account">Service Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Access Level</Label>
                <Select
                  value={form.access_level}
                  onValueChange={(value) => setForm((current) => ({ ...current, access_level: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="incident_response">Incident Response</SelectItem>
                    <SelectItem value="security_audit">Security Audit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="jit-duration">Duration</Label>
                <Input
                  id="jit-duration"
                  type="number"
                  min="15"
                  max="480"
                  value={form.duration_minutes}
                  onChange={(event) => setForm((current) => ({ ...current, duration_minutes: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jit-scope">Resource Scope</Label>
              <Input
                id="jit-scope"
                value={form.resource_scope}
                onChange={(event) => setForm((current) => ({ ...current, resource_scope: event.target.value }))}
                placeholder="iam:prod-admin, ec2:billing, s3:customer-exports"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="jit-justification">Justification</Label>
              <Textarea
                id="jit-justification"
                value={form.justification}
                onChange={(event) => setForm((current) => ({ ...current, justification: event.target.value }))}
                placeholder="Need temporary elevated access to investigate a GuardDuty finding"
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default JITAccessPanel;
