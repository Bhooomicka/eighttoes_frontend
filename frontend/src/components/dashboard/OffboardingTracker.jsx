import { UserMinus, CheckCircle2, XCircle, Clock, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const OffboardingTracker = ({ data, onItemClick }) => {
  if (!data) return null;

  const { records, average_revoke_time } = data;

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <UserMinus className="w-4 h-4 text-primary" />
            Offboarding Tracker
          </CardTitle>
          <div className="flex items-center gap-2 text-xs">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Avg. revoke time:</span>
            <span className="font-mono font-semibold text-emerald-500">{average_revoke_time}s</span>
          </div>
        </div>
      </CardHeader>
      <CardContent data-testid="offboarding-content">
        <ScrollArea className="h-[220px]">
          <div className="space-y-3">
            {records.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No offboarding records assigned to you
              </div>
            ) : (
              records.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => onItemClick(record.id)}
                  data-testid={`offboarding-${record.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${record.access_revoked ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                      {record.access_revoked ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{record.name}</p>
                      <p className="text-xs text-muted-foreground">{record.department}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Badge 
                        variant="outline" 
                        className={record.access_revoked ? 'status-pass' : 'status-fail'}
                      >
                        {record.access_revoked ? 'Revoked' : 'Pending'}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {record.access_revoked ? (
                          <span className="font-mono text-emerald-500">{record.revoke_time_seconds}s</span>
                        ) : (
                          <span>Left: {record.departure_date}</span>
                        )}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="mt-4 pt-4 border-t border-border">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-emerald-500">
                {records.filter(r => r.access_revoked).length}
              </p>
              <p className="text-xs text-muted-foreground">Access Revoked</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-500">
                {records.filter(r => !r.access_revoked).length}
              </p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OffboardingTracker;
