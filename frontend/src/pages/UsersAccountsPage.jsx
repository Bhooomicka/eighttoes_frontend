import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TEAM_USERS = [
  {
    id: "user-admin-001",
    name: "Bhooomicka",
    role: "admin",
    email: "bhooomickadg@gmail.com",
    access: "Full admin access across IAM, alerts, and compliance",
    tasks: ["Approve high-risk permission changes", "Review unresolved critical alerts"]
  },
  {
    id: "user-lead-001",
    name: "Margaret",
    role: "team_lead",
    email: "margaret.lead@company.com",
    access: "Team-level access for remediation and policy workflows",
    tasks: ["Triage medium-severity alerts", "Validate offboarding completion"]
  },
  {
    id: "user-member-001",
    name: "John Doe",
    role: "team_member",
    email: "john.doe@company.com",
    access: "Scoped operational access for assigned incidents",
    tasks: ["Rotate due credentials", "Investigate assigned anomaly alerts"]
  }
];

const getRoleLabel = (role) => {
  if (role === "admin") return "Administrator";
  if (role === "team_lead") return "Team Lead";
  return "Team Member";
};

const UsersAccountsPage = () => {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleSidebarNavigate = (label) => {
    if (label === "Users & Accounts") return;
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
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex" data-testid="users-accounts-page">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeSection="Users & Accounts"
        onNavigate={handleSidebarNavigate}
      />

      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? "ml-16" : "ml-64"}`}>
        <Header notifications={[]} />

        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-5xl mx-auto space-y-6">
            <section>
              <h1 className="text-3xl font-bold tracking-tight">Users & Accounts</h1>
              <p className="text-muted-foreground mt-1">Who has what access and what they are currently responsible for.</p>
            </section>

            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle className="text-base font-medium">User Access & Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Name</th>
                        <th className="py-2 pr-3 font-medium">Role</th>
                        <th className="py-2 pr-3 font-medium">Email</th>
                        <th className="py-2 pr-3 font-medium">Access</th>
                        <th className="py-2 pr-3 font-medium">Current Tasks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {TEAM_USERS.map((teamUser) => (
                        <tr key={teamUser.id} className="border-b border-border/50 last:border-0">
                          <td className="py-3 pr-3 font-medium">{teamUser.name}</td>
                          <td className="py-3 pr-3 text-muted-foreground">{getRoleLabel(teamUser.role)}</td>
                          <td className="py-3 pr-3 font-mono text-xs">{teamUser.email}</td>
                          <td className="py-3 pr-3 text-xs text-muted-foreground">{teamUser.access}</td>
                          <td className="py-3 pr-3">
                            <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground">
                              {teamUser.tasks.map((task) => (
                                <li key={task}>{task}</li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default UsersAccountsPage;
