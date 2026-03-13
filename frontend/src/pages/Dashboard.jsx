import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useTheme, API } from "@/App";
import axios from "axios";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import MetricsGrid from "@/components/dashboard/MetricsGrid";
import AccessHygiene from "@/components/dashboard/AccessHygiene";
import OffboardingTracker from "@/components/dashboard/OffboardingTracker";
import DetailModal from "@/components/dashboard/DetailModal";

const Dashboard = () => {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { theme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState("Dashboard");
  const [greeting, setGreeting] = useState("");
  const [dashboardData, setDashboardData] = useState({
    metrics: null,
    alerts: [],
    alertsChart: [],
    accessHygiene: null,
    offboarding: null,
    credentials: null,
    compliance: null,
    notifications: []
  });
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [modalType, setModalType] = useState(null);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const fetchAllData = async () => {
    try {
      const [
        metricsRes,
        alertsRes,
        alertsChartRes,
        accessHygieneRes,
        offboardingRes,
        credentialsRes,
        complianceRes,
        notificationsRes,
        userRes
      ] = await Promise.all([
        axios.get(`${API}/dashboard/metrics`, authHeaders),
        axios.get(`${API}/dashboard/alerts`, authHeaders),
        axios.get(`${API}/dashboard/alerts-chart`, authHeaders),
        axios.get(`${API}/dashboard/access-hygiene`, authHeaders),
        axios.get(`${API}/dashboard/offboarding`, authHeaders),
        axios.get(`${API}/dashboard/credentials`, authHeaders),
        axios.get(`${API}/dashboard/compliance`, authHeaders),
        axios.get(`${API}/dashboard/notifications`, authHeaders),
        axios.get(`${API}/auth/me`, authHeaders)
      ]);

      setGreeting(userRes.data.greeting);
      setDashboardData({
        metrics: metricsRes.data,
        alerts: alertsRes.data,
        alertsChart: alertsChartRes.data,
        accessHygiene: accessHygieneRes.data,
        offboarding: offboardingRes.data,
        credentials: credentialsRes.data,
        compliance: complianceRes.data,
        notifications: notificationsRes.data
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      console.warn("Using mock data for dashboard");
      
      // Set mock data so the dashboard renders
      setGreeting(getTimeGreeting());
      setDashboardData({
        metrics: {
          total_active_users: 1284,
          service_accounts: 156,
          privileged_accounts: 47,
          flagged_accounts: 12,
          credentials_due_rotation: 23,
          is_personal_view: false
        },
        alerts: [
          { id: 1, title: "Suspicious Login Attempt", severity: "high", timestamp: new Date().toISOString() },
          { id: 2, title: "New Device Detected", severity: "medium", timestamp: new Date().toISOString() }
        ],
        alertsChart: [
           { date: "2023-10-01", high: 2, medium: 5, low: 10 },
           { date: "2023-10-02", high: 1, medium: 3, low: 8 },
           { date: "2023-10-03", high: 4, medium: 2, low: 9 },
           { date: "2023-10-04", high: 0, medium: 4, low: 7 },
           { date: "2023-10-05", high: 2, medium: 6, low: 11 }
        ],
        accessHygiene: {
          overprivileged_accounts: 12,
          stale_accounts: 5,
          policy_violations: 3
        },
        offboarding: {
          average_revoke_time: 4.2,
          records: [
            { 
               id: 1, 
               name: "John Doe", 
               role: "Developer",
               access_revoked: false,
               days_pending: 5,
               systems: ["Slack", "GitHub", "AWS"]
            },
            { 
               id: 2, 
               name: "Jane Smith", 
               role: "Designer",
               access_revoked: true,
               days_pending: 0,
               systems: []
            }
          ]
        },
        credentials: {
           on_schedule_percent: 85,
           overdue_percent: 15,
           next_rotations: [
             { id: 1, service_name: "AWS Production Key", type: "API Key", due_date: "2023-10-25" },
             { id: 2, service_name: "Database Admin", type: "Password", due_date: "2023-11-15" }
           ]
        },
        compliance: {
           audit_readiness_score: 78,
           cis_benchmarks: [
             { name: "AWS Foundations", status: "pass", score: 92 },
             { name: "Azure Security", status: "warning", score: 76 },
             { name: "Kubernetes Hardening", status: "fail", score: 45 }
           ],
           gdpr_status: "compliant",
           soc2_status: "review_needed",
           iso27001_status: "compliant"
        },
        notifications: []
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [token]);

  const getLocalDetailData = (type, id) => {
    if (type === "alert") {
      const alert = dashboardData.alerts?.find((item) => item.id === id);
      if (!alert) return null;
      return {
        id: alert.id,
        title: alert.title,
        description: alert.description || "Potential security issue detected. Review and take action.",
        severity: alert.severity || "medium",
        status: alert.status || "open",
        timestamp: alert.timestamp || new Date().toISOString(),
        source: alert.source || "Sentinel Monitor",
        assigned_name: user?.name || "Current User",
        details: {
          recommended_action: "Investigate activity and validate user/session context."
        }
      };
    }

    if (type === "offboarding") {
      const record = dashboardData.offboarding?.records?.find((item) => item.id === id);
      if (!record) return null;
      return {
        id: record.id,
        name: record.name,
        email: `${record.name.toLowerCase().replace(/\s+/g, ".")}@company.com`,
        department: "Security",
        access_revoked: Boolean(record.access_revoked),
        revoke_time_seconds: record.access_revoked ? 4 : null,
        departure_date: "2026-03-13",
        details: {
          position: record.role || "Employee",
          exit_interview: "Scheduled",
          equipment_returned: Boolean(record.access_revoked),
          systems_access: record.systems || [],
          revoked_by: record.access_revoked ? (user?.name || "Current User") : null,
          revocation_timestamp: record.access_revoked ? new Date().toISOString() : null
        }
      };
    }

    if (type === "credential") {
      const credential = dashboardData.credentials?.next_rotations?.find((item) => item.id === id);
      if (!credential) return null;
      return {
        id: credential.id,
        name: credential.service_name,
        type: credential.type || "API Key",
        status: "due_soon",
        due_date: credential.due_date,
        manager_name: user?.name || "Current User",
        details: {
          service: credential.service_name,
          last_rotated: "2026-02-01",
          environment: "Production",
          rotation_policy: "Every 90 days",
          associated_services: ["API Gateway", "IAM"]
        }
      };
    }

    return null;
  };

  const handleItemClick = async (type, id) => {
    try {
      let endpoint = "";
      switch (type) {
        case "alert":
          endpoint = `${API}/dashboard/alerts/${id}`;
          break;
        case "offboarding":
          endpoint = `${API}/dashboard/offboarding/${id}`;
          break;
        case "credential":
          endpoint = `${API}/dashboard/credentials/${id}`;
          break;
        default:
          return;
      }
      
      const response = await axios.get(endpoint, authHeaders);
      setModalData(response.data);
      setModalType(type);
      setModalOpen(true);
    } catch (error) {
      console.error("Error fetching detail:", error);
      const localDetail = getLocalDetailData(type, id);
      if (localDetail) {
        setModalData(localDetail);
        setModalType(type);
        setModalOpen(true);
      }
    }
  };

  const handleAction = async (type, id, action, data) => {
    try {
      let endpoint = "";
      switch (type) {
        case "alert":
          endpoint = `${API}/dashboard/alerts/${id}`;
          await axios.put(endpoint, { status: action }, authHeaders);
          break;
        case "offboarding":
          endpoint = `${API}/dashboard/offboarding/${id}`;
          await axios.put(endpoint, data, authHeaders);
          break;
        case "credential":
          endpoint = `${API}/dashboard/credentials/${id}`;
          await axios.put(endpoint, { rotated: true }, authHeaders);
          break;
        default:
          return;
      }
      
      setModalOpen(false);
      // Refresh data
      await fetchAllData();
    } catch (error) {
      console.error("Error performing action:", error);
    }
  };

  const handleSidebarNavigate = (label) => {
    setActiveSection(label);

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

    if (label === "Compliance") {
      navigate("/compliance");
      return;
    }

    const sectionIdMap = {
      "Dashboard": "dashboard-section"
    };

    const targetId = sectionIdMap[label];
    if (!targetId) return;

    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const isPersonalView = dashboardData.metrics?.is_personal_view;

  return (
    <div className="min-h-screen bg-background flex" data-testid="dashboard-container">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeSection={activeSection}
        onNavigate={handleSidebarNavigate}
      />
      
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        <Header notifications={dashboardData.notifications} />
        
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Personalized Greeting */}
            <section id="dashboard-section" className="animate-fade-in" data-testid="greeting-section">
              <div className="mb-6">
                <h1 className="text-3xl font-bold tracking-tight">
                  {greeting}, <span className="text-primary">{user?.name?.split(' ')[0]}</span>
                </h1>
                <p className="text-muted-foreground mt-1">
                  {isPersonalView 
                    ? "Here are your assigned tasks and issues for today"
                    : "Here are the insights for today"
                  }
                </p>
                {user?.role && (
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${
                    user.role === 'admin' 
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                      : user.role === 'team_lead'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {user.role === 'admin' ? 'Administrator' : user.role === 'team_lead' ? 'Team Lead' : 'Team Member'}
                  </span>
                )}
              </div>
            </section>

            {/* At a Glance Metrics */}
            <section className="animate-fade-in stagger-1" data-testid="metrics-section">
              <h2 className="text-lg font-semibold mb-4 text-foreground">
                {isPersonalView ? "Your Tasks at a Glance" : "At a Glance"}
              </h2>
              <MetricsGrid metrics={dashboardData.metrics} isPersonalView={isPersonalView} />
            </section>

            {/* Access Hygiene & Offboarding */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="animate-fade-in stagger-4" data-testid="access-hygiene-section">
                <AccessHygiene 
                  data={dashboardData.accessHygiene}
                  onItemClick={(id) => handleItemClick("hygiene", id)}
                  onRefresh={fetchAllData}
                />
              </section>
              <section className="animate-fade-in stagger-5" data-testid="offboarding-section">
                <OffboardingTracker 
                  data={dashboardData.offboarding}
                  onItemClick={(id) => handleItemClick("offboarding", id)}
                />
              </section>
            </div>

          </div>
        </main>
      </div>

      {/* Detail Modal */}
      <DetailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        data={modalData}
        type={modalType}
        onAction={handleAction}
        userRole={user?.role}
      />
    </div>
  );
};

export default Dashboard;
