import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import ComplianceStatus from "@/components/dashboard/ComplianceStatus";

const mockCompliance = {
  audit_readiness_score: 78,
  cis_benchmarks: [
    { name: "AWS Foundations", status: "pass", score: 92 },
    { name: "Azure Security", status: "warning", score: 76 },
    { name: "Kubernetes Hardening", status: "fail", score: 45 }
  ],
  gdpr_status: "compliant",
  soc2_status: "review_needed",
  iso27001_status: "compliant"
};

const CompliancePage = () => {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleSidebarNavigate = (label) => {
    if (label === "Users & Accounts") {
      navigate("/users-accounts");
      return;
    }
    if (label === "Settings") {
      navigate("/settings");
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
    if (label === "Compliance") return;
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex" data-testid="compliance-page">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeSection="Compliance"
        onNavigate={handleSidebarNavigate}
      />

      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? "ml-16" : "ml-64"}`}>
        <Header notifications={[]} />

        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <section>
              <h1 className="text-3xl font-bold tracking-tight">Compliance</h1>
              <p className="text-muted-foreground mt-1">View benchmark posture and audit readiness.</p>
            </section>

            <ComplianceStatus data={mockCompliance} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default CompliancePage;
