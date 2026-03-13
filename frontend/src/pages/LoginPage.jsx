import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-lg">Loading...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await login(email, password);
      toast.success("Welcome back!", { description: "Successfully logged in" });
      navigate("/dashboard");
    } catch (err) {
      const message = err.response?.data?.detail || "Invalid credentials";
      setError(message);
      toast.error("Login failed", { description: message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div 
        className="hidden lg:flex lg:w-[60%] relative login-bg"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1660836814985-8523a0d713b5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MTJ8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGN5YmVyc2VjdXJpdHklMjBkaWdpdGFsJTIwbmV0d29yayUyMGJhY2tncm91bmQlMjBkYXJrfGVufDB8fHx8MTc3MzQwMjY1MHww&ixlib=rb-4.1.0&q=85')`
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-background/90 to-background/95" />
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
          <div className="max-w-lg text-center">
            <div className="flex items-center justify-center gap-3 mb-8">
              <ShieldCheck className="w-12 h-12 text-primary" strokeWidth={1.5} />
              <h1 className="text-4xl font-bold tracking-tight">Sentinel</h1>
            </div>
            <p className="text-xl text-white/80 mb-6 leading-relaxed">
              Cloud Identity Security Dashboard
            </p>
            <div className="space-y-4 text-left text-sm text-white/70">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10">
                <div className="w-2 h-2 mt-2 rounded-full bg-emerald-400" />
                <p>Real-time threat detection and anomaly monitoring</p>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10">
                <div className="w-2 h-2 mt-2 rounded-full bg-blue-400" />
                <p>Automated credential rotation and compliance tracking</p>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10">
                <div className="w-2 h-2 mt-2 rounded-full bg-purple-400" />
                <p>Access hygiene and privileged account management</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-2 mb-8 lg:hidden">
            <ShieldCheck className="w-8 h-8 text-primary" strokeWidth={1.5} />
            <h1 className="text-2xl font-bold">Sentinel</h1>
          </div>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-xl">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-2xl font-semibold tracking-tight">
                Welcome back
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Sign in to access your security dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11 bg-background border-input"
                      required
                      data-testid="login-email-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-11 bg-background border-input"
                      required
                      data-testid="login-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 btn-shine bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-lg shadow-primary/20"
                  disabled={isLoading}
                  data-testid="login-submit-button"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-xs text-center text-muted-foreground">
                  Protected by Sentinel Security. Enterprise-grade authentication.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
