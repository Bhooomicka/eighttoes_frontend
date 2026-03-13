import { useState, useEffect } from "react";
import { useAuth, API } from "@/App";
import axios from "axios";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, Plus, Minus, Check, X, AlertTriangle, 
  ChevronRight, User, Server, Clock
} from "lucide-react";
import { toast } from "sonner";

const PermissionModal = ({ open, onClose, hygieneItem, onSuccess }) => {
  const { token, user } = useAuth();
  const [currentPerms, setCurrentPerms] = useState([]);
  const [newPerms, setNewPerms] = useState([]);
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [newPermInput, setNewPermInput] = useState("");

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    if (hygieneItem?.details) {
      setCurrentPerms(hygieneItem.details.current_permissions || []);
      setNewPerms(hygieneItem.details.recommended_permissions || []);
    }
  }, [hygieneItem]);

  const addPermission = () => {
    if (newPermInput && !newPerms.includes(newPermInput)) {
      setNewPerms([...newPerms, newPermInput]);
      setNewPermInput("");
    }
  };

  const removePermission = (perm) => {
    setNewPerms(newPerms.filter(p => p !== perm));
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for the change");
      return;
    }

    setIsLoading(true);
    try {
      await axios.post(`${API}/permissions/change-request`, {
        account_id: hygieneItem.account_name,
        account_type: hygieneItem.account_type.toLowerCase().replace(" ", "_"),
        current_permissions: currentPerms,
        new_permissions: newPerms,
        reason: reason
      }, authHeaders);

      toast.success("Permission change applied", {
        description: "Access has been updated successfully"
      });
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error("Failed to apply permission change");
    } finally {
      setIsLoading(false);
    }
  };

  if (!hygieneItem) return null;

  const isAdmin = user?.role === "admin" || user?.role === "team_lead";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-card border-border" data-testid="permission-modal">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Modify Permissions
          </DialogTitle>
          <DialogDescription>
            {hygieneItem.account_name} ({hygieneItem.account_type})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Issue Banner */}
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
              <div>
                <p className="font-medium text-amber-500">Identified Issue</p>
                <p className="text-sm text-muted-foreground mt-1">{hygieneItem.issue}</p>
              </div>
            </div>
          </div>

          {/* Permission Comparison */}
          <div className="grid grid-cols-2 gap-6">
            {/* Current Permissions */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <X className="w-4 h-4 text-red-500" />
                Current Permissions (Remove)
              </Label>
              <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20 min-h-[150px]">
                <div className="flex flex-wrap gap-2">
                  {currentPerms.map((perm, i) => (
                    <Badge 
                      key={i} 
                      variant="outline" 
                      className="bg-red-500/10 text-red-400 border-red-500/30 line-through"
                    >
                      {perm}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* New Permissions */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                New Permissions (Apply)
              </Label>
              <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 min-h-[150px]">
                <div className="flex flex-wrap gap-2">
                  {newPerms.map((perm, i) => (
                    <Badge 
                      key={i} 
                      variant="outline" 
                      className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 cursor-pointer hover:bg-emerald-500/20"
                      onClick={() => removePermission(perm)}
                    >
                      {perm}
                      <X className="w-3 h-3 ml-1" />
                    </Badge>
                  ))}
                </div>
                
                {/* Add new permission */}
                <div className="flex gap-2 mt-3">
                  <Input
                    placeholder="Add permission..."
                    value={newPermInput}
                    onChange={(e) => setNewPermInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && addPermission()}
                    className="h-8 text-sm"
                  />
                  <Button size="sm" variant="outline" onClick={addPermission}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Change</Label>
            <Textarea
              id="reason"
              placeholder="Explain why these permissions are being changed..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Risk Score */}
          {hygieneItem.details?.risk_score && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">Risk Score</span>
              <span className={`text-lg font-bold ${
                hygieneItem.details.risk_score >= 80 ? 'text-red-500' :
                hygieneItem.details.risk_score >= 50 ? 'text-amber-500' : 'text-emerald-500'
              }`}>
                {hygieneItem.details.risk_score}%
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit}
            disabled={isLoading || !reason.trim()}
            className="bg-primary hover:bg-primary/90"
            data-testid="apply-permissions-btn"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Applying...
              </span>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                {isAdmin ? "Apply Changes" : "Submit for Approval"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PermissionModal;
