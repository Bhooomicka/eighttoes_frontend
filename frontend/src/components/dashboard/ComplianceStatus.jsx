import { FileText, CheckCircle2, AlertTriangle, XCircle, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const ComplianceStatus = ({ data }) => {
  if (!data) return null;

  const { cis_benchmarks, audit_readiness_score } = data;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'fail':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const getProgressColor = (score) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 h-full">
      <CardHeader>
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Compliance Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6" data-testid="compliance-content">
        {/* Audit Readiness Score */}
        <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-muted-foreground">Audit Readiness Score</p>
              <p className={`text-3xl font-bold ${getScoreColor(audit_readiness_score)}`}>
                {audit_readiness_score}%
              </p>
            </div>
            <div className="p-3 rounded-xl bg-primary/10">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
          </div>
          <div className="relative h-2 rounded-full bg-muted overflow-hidden">
            <div 
              className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${getProgressColor(audit_readiness_score)}`}
              style={{ width: `${audit_readiness_score}%` }}
            />
          </div>
        </div>

        {/* CIS Benchmarks */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">CIS Benchmarks</h4>
          <div className="space-y-2">
            {cis_benchmarks.map((benchmark, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(benchmark.status)}
                  <span className="text-sm">{benchmark.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-20">
                    <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
                      <div 
                        className={`absolute top-0 left-0 h-full rounded-full ${getProgressColor(benchmark.score)}`}
                        style={{ width: `${benchmark.score}%` }}
                      />
                    </div>
                  </div>
                  <span className={`text-sm font-mono ${getScoreColor(benchmark.score)}`}>
                    {benchmark.score}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="pt-4 border-t border-border">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xl font-bold text-emerald-500">
                {cis_benchmarks.filter(b => b.status === 'pass').length}
              </p>
              <p className="text-xs text-muted-foreground">Passed</p>
            </div>
            <div>
              <p className="text-xl font-bold text-amber-500">
                {cis_benchmarks.filter(b => b.status === 'warning').length}
              </p>
              <p className="text-xs text-muted-foreground">Warning</p>
            </div>
            <div>
              <p className="text-xl font-bold text-red-500">
                {cis_benchmarks.filter(b => b.status === 'fail').length}
              </p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ComplianceStatus;
