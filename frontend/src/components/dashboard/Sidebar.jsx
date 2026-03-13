import { ShieldCheck, LayoutDashboard, Users, AlertTriangle, Key, FileText, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: Users, label: "Users & Accounts" },
  { icon: AlertTriangle, label: "Threats" },
  { icon: Key, label: "Credentials" },
  { icon: FileText, label: "Compliance" },
  { icon: Settings, label: "Settings" },
];

const Sidebar = ({ collapsed, onToggle, activeSection = "Dashboard", onNavigate }) => {
  return (
    <aside 
      className={`fixed top-0 left-0 h-screen bg-card/50 backdrop-blur-xl border-r border-border flex flex-col transition-all duration-300 z-40 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
      data-testid="sidebar"
    >
      {/* Logo */}
      <div className={`h-16 flex items-center border-b border-border px-4 ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <ShieldCheck className="w-8 h-8 text-primary shrink-0" strokeWidth={1.5} />
        {!collapsed && (
          <span className="text-xl font-bold tracking-tight">Sentinel</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        <TooltipProvider delayDuration={0}>
          {menuItems.map((item) => {
            const isActive = activeSection === item.label;
            return (
            <Tooltip key={item.label}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onNavigate?.(item.label)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 sidebar-link ${
                    isActive
                      ? 'active bg-primary/10 text-primary' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  } ${collapsed ? 'justify-center' : ''}`}
                  data-testid={`sidebar-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-primary' : ''}`} />
                  {!collapsed && (
                    <span className="text-sm font-medium">{item.label}</span>
                  )}
                </button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right" className="bg-popover border-border">
                  <p>{item.label}</p>
                </TooltipContent>
              )}
            </Tooltip>
            );
          })}
        </TooltipProvider>
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className={`w-full flex items-center gap-2 text-muted-foreground hover:text-foreground ${collapsed ? 'justify-center' : ''}`}
          data-testid="sidebar-toggle"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-sm">Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
