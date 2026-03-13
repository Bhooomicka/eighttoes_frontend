import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import CredentialRotation from "@/components/dashboard/CredentialRotation";
import DetailModal from "@/components/dashboard/DetailModal";

const mockCredentials = {
  on_schedule_percent: 85,
  overdue_percent: 15,
  next_rotations: [
    { id: 1, service_name: "AWS Production Key", type: "API Key", due_date: "2023-10-25" },
    { id: 2, service_name: "Database Admin", type: "Password", due_date: "2023-11-15" }
  ]
};

const CredentialsPage = () => {
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
    if (label === "Threats") {
      navigate("/threats");
      return;
    }
    if (label === "Credentials") return;
    if (label === "Compliance") {
      navigate("/compliance");
      return;
    }
    navigate("/dashboard");
  };

  const handleCredentialClick = (id) => {
    const credential = mockCredentials.next_rotations.find((item) => item.id === id);
    if (!credential) return;

    setModalData({
      id: credential.id,
      name: credential.service_name,
      type: credential.type,
      status: "due_soon",
      due_date: credential.due_date,
      manager_name: "Test User",
      details: {
        service: credential.service_name,
        last_rotated: "2026-02-01",
        environment: "Production",
        rotation_policy: "Every 90 days",
        associated_services: ["API Gateway", "IAM"]
      }
    });
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background flex" data-testid="credentials-page">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeSection="Credentials"
        onNavigate={handleSidebarNavigate}
      />

      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? "ml-16" : "ml-64"}`}>
        <Header notifications={[]} />

        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <section>
              <h1 className="text-3xl font-bold tracking-tight">Credentials</h1>
              <p className="text-muted-foreground mt-1">Track upcoming credential rotations and status.</p>
            </section>

            <CredentialRotation data={mockCredentials} onItemClick={handleCredentialClick} />
          </div>
        </main>
      </div>

      <DetailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        data={modalData}
        type="credential"
        onAction={async () => {}}
        userRole="admin"
      />
    </div>
  );
};

export default CredentialsPage;
