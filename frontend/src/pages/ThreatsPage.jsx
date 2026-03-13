import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import ThreatSection from "@/components/dashboard/ThreatSection";
import DetailModal from "@/components/dashboard/DetailModal";

const mockAlerts = [
  {
    id: 1,
    title: "Suspicious Login Attempt",
    severity: "high",
    status: "open",
    description: "Multiple failed login attempts from unknown IP.",
    source: "SIEM",
    timestamp: new Date().toISOString()
  },
  {
    id: 2,
    title: "New Device Detected",
    severity: "medium",
    status: "investigating",
    description: "User account accessed from an unrecognized device.",
    source: "Identity Provider",
    timestamp: new Date().toISOString()
  }
];

const mockChartData = [
  { date: "2023-10-01", high: 2, medium: 5, low: 10 },
  { date: "2023-10-02", high: 1, medium: 3, low: 8 },
  { date: "2023-10-03", high: 4, medium: 2, low: 9 },
  { date: "2023-10-04", high: 0, medium: 4, low: 7 },
  { date: "2023-10-05", high: 2, medium: 6, low: 11 }
];

const ThreatsPage = () => {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState(null);

  const handleSidebarNavigate = (label) => {
    if (label === "Users & Accounts") {
      navigate("/users-accounts");
      return;
    }
    if (label === "Settings") {
      navigate("/settings");
      return;
    }
    if (label === "Threats") return;
    if (label === "Credentials") {
      navigate("/credentials");
      return;
    }
    if (label === "Compliance") {
      navigate("/compliance");
      return;
    }
    navigate("/dashboard");
  };

  const handleAlertClick = (id) => {
    const alert = mockAlerts.find((item) => item.id === id);
    if (!alert) return;

    setModalData({
      ...alert,
      assigned_name: "Test User",
      details: {
        recommended_action: "Review account activity and enforce MFA challenge."
      }
    });
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background flex" data-testid="threats-page">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeSection="Threats"
        onNavigate={handleSidebarNavigate}
      />

      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? "ml-16" : "ml-64"}`}>
        <Header notifications={[]} />

        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <section>
              <h1 className="text-3xl font-bold tracking-tight">Threats</h1>
              <p className="text-muted-foreground mt-1">Review and investigate anomaly alerts.</p>
            </section>

            <ThreatSection
              alerts={mockAlerts}
              chartData={mockChartData}
              onAlertClick={handleAlertClick}
              isPersonalView={false}
            />
          </div>
        </main>
      </div>

      <DetailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        data={modalData}
        type="alert"
        onAction={async () => {}}
        userRole="admin"
      />
    </div>
  );
};

export default ThreatsPage;
