import { Key, CheckCircle2, AlertCircle, Calendar, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CredentialRotation = ({ data, onItemClick }) => {
  if (!data) return null;

  const { on_schedule_percent, overdue_percent, next_rotations } = data;

  const getTypeIcon = (type) => {
    switch (type) {
      case 'API Key':
        return <Key className="w-3 h-3" />;
      case 'Password':
        return <AlertCircle className="w-3 h-3" />;
      default:
        return <Key className="w-3 h-3" />;
    }
  };

  const getDaysUntil = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 h-full">
      <CardHeader>
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          Credential Rotation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6" data-testid="credentials-content">
        {/* Progress Bars */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">On Schedule</span>
              <span className="font-medium text-emerald-500">{on_schedule_percent}%</span>
            </div>
            <div className="relative h-3 rounded-full bg-muted overflow-hidden">
              <div 
                className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full transition-all duration-1000"
                style={{ width: `${on_schedule_percent}%` }}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overdue</span>
              <span className="font-medium text-red-500">{overdue_percent}%</span>
            </div>
            <div className="relative h-3 rounded-full bg-muted overflow-hidden">
              <div 
                className="absolute top-0 left-0 h-full bg-red-500 rounded-full transition-all duration-1000"
                style={{ width: `${overdue_percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Next Rotations */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            Upcoming Rotations
          </h4>
          <div className="space-y-2">
            {next_rotations.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No credentials assigned to you
              </div>
            ) : (
              next_rotations.map((rotation, index) => {
                const daysUntil = getDaysUntil(rotation.due_date);
                const isOverdue = rotation.status === "overdue" || daysUntil < 0;
                const isUrgent = daysUntil <= 3 && daysUntil >= 0;
                
                return (
                  <div 
                    key={rotation.id || index}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
                    onClick={() => onItemClick(rotation.id)}
                    data-testid={`credential-${rotation.id || index}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        isOverdue 
                          ? 'bg-red-500/10 text-red-500' 
                          : isUrgent 
                            ? 'bg-amber-500/10 text-amber-500' 
                            : 'bg-primary/10 text-primary'
                      }`}>
                        {getTypeIcon(rotation.type)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{rotation.name}</p>
                        <p className="text-xs text-muted-foreground">{rotation.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={
                        isOverdue 
                          ? 'bg-red-500/15 text-red-500 border-red-500/30' 
                          : isUrgent 
                            ? 'status-warning' 
                            : 'status-low'
                      }>
                        {isOverdue ? 'Overdue' : `${daysUntil}d`}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CredentialRotation;
