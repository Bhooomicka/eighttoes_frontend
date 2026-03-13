from fastapi import FastAPI, APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import hashlib
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Secret
JWT_SECRET = os.environ.get('JWT_SECRET', 'sentinel-dashboard-secret-key-2024')
JWT_ALGORITHM = "HS256"

# Email Configuration (Resend - mocked for now)
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', None)
EMAIL_FROM = os.environ.get('EMAIL_FROM', 'alerts@sentinel-dashboard.com')

# Escalation Configuration
ESCALATION_HOURS = 1  # High severity alerts escalate after 1 hour

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Role Hierarchy
ROLE_HIERARCHY = {
    "admin": 3,
    "team_lead": 2,
    "team_member": 1
}

# Models
class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    token: str
    user: dict

class UpdateAlertRequest(BaseModel):
    status: str

class UpdateOffboardingRequest(BaseModel):
    access_revoked: bool
    revoke_time_seconds: Optional[int] = None

class UpdateCredentialRequest(BaseModel):
    rotated: bool

class NotificationPreferences(BaseModel):
    email_enabled: bool = True
    email_address: Optional[str] = None
    notify_high: bool = True
    notify_medium: bool = True
    notify_low: bool = True

# DevOps Webhook Models
class WebhookEvent(BaseModel):
    event_type: str  # deployment, incident, access_change, credential_rotation
    source: str  # jenkins, github, terraform, hr_system, okta
    payload: dict
    timestamp: Optional[str] = None

class HROffboardingRequest(BaseModel):
    employee_email: str
    employee_name: str
    department: str
    position: str
    departure_date: str
    systems_access: List[str]
    manager_email: Optional[str] = None
    hr_ticket_id: Optional[str] = None

class PermissionChangeRequest(BaseModel):
    account_id: str
    account_type: str  # user, service_account
    current_permissions: List[str]
    new_permissions: List[str]
    reason: str
    requested_by: Optional[str] = None

class IAMSyncRequest(BaseModel):
    provider: str  # okta, azure_ad, aws_iam, gcp_iam
    action: str  # sync_users, sync_groups, sync_permissions
    data: dict

class WebhookConfig(BaseModel):
    name: str
    url: str
    events: List[str]  # alert_created, alert_escalated, access_revoked, credential_rotated
    secret: Optional[str] = None
    active: bool = True

# Email Service (Mocked - ready for Resend integration)
class EmailService:
    @staticmethod
    async def send_email(to: str, subject: str, html_content: str):
        """
        Send email using Resend API
        Currently MOCKED - add RESEND_API_KEY to .env to enable
        """
        if RESEND_API_KEY:
            try:
                import httpx
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        "https://api.resend.com/emails",
                        headers={
                            "Authorization": f"Bearer {RESEND_API_KEY}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "from": EMAIL_FROM,
                            "to": [to],
                            "subject": subject,
                            "html": html_content
                        }
                    )
                    return response.status_code == 200
            except Exception as e:
                logging.error(f"Email send failed: {e}")
                return False
        else:
            # Mocked - log the email instead
            logging.info(f"[MOCKED EMAIL] To: {to}, Subject: {subject}")
            # Store in DB for demo purposes
            await db.email_log.insert_one({
                "id": str(uuid.uuid4()),
                "to": to,
                "subject": subject,
                "html_content": html_content,
                "status": "mocked",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            return True

    @staticmethod
    def generate_alert_email(alert: dict, escalated: bool = False) -> tuple:
        """Generate email content for alerts"""
        severity_colors = {
            "high": "#ef4444",
            "medium": "#f59e0b",
            "low": "#10b981"
        }
        color = severity_colors.get(alert.get("severity", "low"), "#3b82f6")
        
        subject = f"{'🚨 ESCALATED: ' if escalated else ''}[{alert['severity'].upper()}] {alert['title']}"
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 24px; }}
                .header {{ border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 16px; }}
                .severity {{ display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: {color}20; color: {color}; }}
                .title {{ font-size: 20px; font-weight: 600; margin: 12px 0; }}
                .description {{ color: #94a3b8; line-height: 1.6; }}
                .details {{ background: #0f172a; border-radius: 8px; padding: 16px; margin: 16px 0; }}
                .detail-row {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #334155; }}
                .detail-label {{ color: #64748b; }}
                .detail-value {{ color: #f8fafc; font-family: monospace; }}
                .action-box {{ background: #3b82f620; border: 1px solid #3b82f640; border-radius: 8px; padding: 16px; margin-top: 16px; }}
                .action-title {{ color: #3b82f6; font-weight: 600; margin-bottom: 8px; }}
                .btn {{ display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }}
                .footer {{ margin-top: 24px; padding-top: 16px; border-top: 1px solid #334155; color: #64748b; font-size: 12px; }}
                .escalation-banner {{ background: #ef444420; border: 1px solid #ef4444; border-radius: 8px; padding: 12px; margin-bottom: 16px; color: #ef4444; font-weight: 600; }}
            </style>
        </head>
        <body>
            <div class="container">
                {'<div class="escalation-banner">⚠️ This alert has been ESCALATED due to no response for ' + str(ESCALATION_HOURS) + ' hour(s)</div>' if escalated else ''}
                <div class="header">
                    <span class="severity">{alert['severity'].upper()}</span>
                    <h1 class="title">{alert['title']}</h1>
                    <p class="description">{alert['description']}</p>
                </div>
                
                <div class="details">
                    <div class="detail-row">
                        <span class="detail-label">Source</span>
                        <span class="detail-value">{alert.get('source', 'Unknown')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Timestamp</span>
                        <span class="detail-value">{alert.get('timestamp', 'N/A')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Assigned To</span>
                        <span class="detail-value">{alert.get('assigned_name', 'Unassigned')}</span>
                    </div>
                </div>
                
                {f'''<div class="action-box">
                    <div class="action-title">🛡️ Recommended Action</div>
                    <p>{alert.get('details', {}).get('recommended_action', 'Review and investigate this alert')}</p>
                </div>''' if alert.get('details', {}).get('recommended_action') else ''}
                
                <a href="#" class="btn">View in Dashboard</a>
                
                <div class="footer">
                    <p>Sentinel Cloud Identity Security Dashboard</p>
                    <p>This is an automated alert notification. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """
        return subject, html

# Escalation Service
class EscalationService:
    @staticmethod
    async def check_and_escalate():
        """Check for alerts that need escalation"""
        escalation_threshold = datetime.now(timezone.utc) - timedelta(hours=ESCALATION_HOURS)
        
        # Find high severity alerts that are still open and older than threshold
        alerts_to_escalate = await db.alerts.find({
            "severity": "high",
            "status": "open",
            "escalated": {"$ne": True},
            "timestamp": {"$lt": escalation_threshold.isoformat()}
        }, {"_id": 0}).to_list(100)
        
        for alert in alerts_to_escalate:
            # Mark as escalated
            await db.alerts.update_one(
                {"id": alert["id"]},
                {"$set": {"escalated": True, "escalated_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            # Get team leads to notify
            team_leads = await db.users.find({"role": "team_lead"}, {"_id": 0}).to_list(100)
            admins = await db.users.find({"role": "admin"}, {"_id": 0}).to_list(100)
            
            # Send escalation emails
            subject, html = EmailService.generate_alert_email(alert, escalated=True)
            for user in team_leads + admins:
                await EmailService.send_email(user["email"], subject, html)
            
            # Log escalation
            await db.activity_log.insert_one({
                "id": str(uuid.uuid4()),
                "action": "Alert Escalated",
                "item_type": "alert",
                "item_id": alert["id"],
                "user_id": "system",
                "user_name": "System",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "details": f"High severity alert '{alert['title']}' escalated after {ESCALATION_HOURS} hour(s) without response"
            })
            
            logging.info(f"Escalated alert: {alert['id']} - {alert['title']}")

# Background task to run escalation check periodically
async def escalation_checker():
    """Background task that checks for escalations every 5 minutes"""
    while True:
        try:
            await EscalationService.check_and_escalate()
        except Exception as e:
            logging.error(f"Escalation check failed: {e}")
        await asyncio.sleep(300)  # Check every 5 minutes

# Helper functions
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_time_greeting():
    hour = datetime.now().hour
    if hour < 12:
        return "Good Morning"
    elif hour < 17:
        return "Good Afternoon"
    else:
        return "Good Evening"

# Sample Team Data
TEAM_USERS = [
    {
        "id": "user-admin-001",
        "email": "bhooomickadg@gmail.com",
        "password": hash_password("12345"),
        "name": "Bhoomi Kadge",
        "role": "admin",
        "department": "Security",
        "avatar": "https://images.unsplash.com/photo-1589220286904-3dcef62c68ee?w=100&h=100&fit=crop",
        "notification_prefs": {"email_enabled": True, "notify_high": True, "notify_medium": True, "notify_low": True}
    },
    {
        "id": "user-lead-001",
        "email": "sarah.lead@company.com",
        "password": hash_password("lead123"),
        "name": "Sarah Mitchell",
        "role": "team_lead",
        "department": "Security Operations",
        "avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
        "notification_prefs": {"email_enabled": True, "notify_high": True, "notify_medium": True, "notify_low": False}
    },
    {
        "id": "user-member-001",
        "email": "john.doe@company.com",
        "password": hash_password("member123"),
        "name": "John Doe",
        "role": "team_member",
        "department": "IAM",
        "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
        "notification_prefs": {"email_enabled": True, "notify_high": True, "notify_medium": True, "notify_low": True}
    },
    {
        "id": "user-member-002",
        "email": "emily.chen@company.com",
        "password": hash_password("member123"),
        "name": "Emily Chen",
        "role": "team_member",
        "department": "Compliance",
        "avatar": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
        "notification_prefs": {"email_enabled": True, "notify_high": True, "notify_medium": False, "notify_low": False}
    },
    {
        "id": "user-member-003",
        "email": "mike.wilson@company.com",
        "password": hash_password("member123"),
        "name": "Mike Wilson",
        "role": "team_member",
        "department": "Infrastructure",
        "avatar": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
        "notification_prefs": {"email_enabled": True, "notify_high": True, "notify_medium": True, "notify_low": True}
    }
]

# Initialize users and data
async def init_data():
    # Initialize users
    for user in TEAM_USERS:
        existing = await db.users.find_one({"email": user["email"]}, {"_id": 0})
        if not existing:
            await db.users.insert_one(user)
    
    # Initialize alerts if not exists
    alerts_count = await db.alerts.count_documents({})
    if alerts_count == 0:
        alerts = [
            {"id": "alert-001", "title": "Suspicious Login Detected", "description": "Multiple failed login attempts from IP 192.168.1.45 targeting admin accounts. Potential brute force attack detected.", "severity": "high", "timestamp": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(), "source": "Auth System", "status": "open", "escalated": False, "assigned_to": "user-member-001", "assigned_name": "John Doe", "details": {"ip_address": "192.168.1.45", "failed_attempts": 47, "targeted_accounts": ["admin@company.com", "root@company.com"], "geo_location": "Unknown VPN", "recommended_action": "Block IP and reset affected passwords"}},
            {"id": "alert-002", "title": "Privilege Escalation Attempt", "description": "User john.doe@company.com attempted to access admin resources without authorization.", "severity": "high", "timestamp": (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat(), "source": "IAM", "status": "open", "escalated": False, "assigned_to": "user-member-001", "assigned_name": "John Doe", "details": {"user": "john.doe@company.com", "attempted_resource": "/admin/user-management", "current_role": "team_member", "required_role": "admin", "recommended_action": "Review user permissions and investigate intent"}},
            {"id": "alert-003", "title": "Unusual API Activity", "description": "Service account sa-billing made 500+ API calls in 1 hour, exceeding normal baseline by 400%.", "severity": "medium", "timestamp": (datetime.now(timezone.utc) - timedelta(hours=5)).isoformat(), "source": "API Gateway", "status": "investigating", "escalated": False, "assigned_to": "user-member-002", "assigned_name": "Emily Chen", "details": {"service_account": "sa-billing", "api_calls": 523, "normal_baseline": 120, "endpoints_accessed": ["/api/invoices", "/api/payments", "/api/customers"], "recommended_action": "Review service account activity and rate limit if necessary"}},
            {"id": "alert-004", "title": "New Device Login", "description": "Admin user logged in from new device in Germany. First login from this region.", "severity": "medium", "timestamp": (datetime.now(timezone.utc) - timedelta(hours=8)).isoformat(), "source": "Auth System", "status": "open", "escalated": False, "assigned_to": "user-lead-001", "assigned_name": "Sarah Mitchell", "details": {"user": "admin@company.com", "device": "MacBook Pro - Chrome 120", "location": "Berlin, Germany", "previous_locations": ["New York, USA", "London, UK"], "recommended_action": "Verify with user if this was authorized"}},
            {"id": "alert-005", "title": "Password Policy Violation", "description": "User sarah.smith@company.com using password that doesn't meet complexity requirements.", "severity": "low", "timestamp": (datetime.now(timezone.utc) - timedelta(hours=12)).isoformat(), "source": "IAM", "status": "open", "escalated": False, "assigned_to": "user-member-003", "assigned_name": "Mike Wilson", "details": {"user": "sarah.smith@company.com", "violation": "Password less than 12 characters", "last_password_change": "45 days ago", "recommended_action": "Force password reset on next login"}},
            {"id": "alert-006", "title": "Stale Service Account Access", "description": "Service account sa-legacy-app hasn't been used in 90 days but still has production access.", "severity": "low", "timestamp": (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat(), "source": "IAM", "status": "open", "escalated": False, "assigned_to": "user-member-002", "assigned_name": "Emily Chen", "details": {"service_account": "sa-legacy-app", "last_used": "90 days ago", "permissions": ["read:production", "write:logs"], "recommended_action": "Disable account and archive credentials"}},
        ]
        await db.alerts.insert_many(alerts)
        
        # Send notification emails for new alerts
        for alert in alerts:
            await send_alert_notification(alert)
    
    # Initialize offboarding records
    offboarding_count = await db.offboarding.count_documents({})
    if offboarding_count == 0:
        offboarding = [
            {"id": "off-001", "name": "Mike Johnson", "email": "mike.johnson@company.com", "department": "Engineering", "departure_date": (datetime.now(timezone.utc) - timedelta(days=2)).strftime("%Y-%m-%d"), "access_revoked": True, "revoke_time_seconds": 45, "managed_by": "user-member-001", "manager_name": "John Doe", "details": {"position": "Senior Developer", "systems_access": ["GitHub", "AWS", "Jira", "Slack"], "revoked_by": "John Doe", "revocation_timestamp": (datetime.now(timezone.utc) - timedelta(days=2, hours=1)).isoformat(), "exit_interview": "Completed", "equipment_returned": True}},
            {"id": "off-002", "name": "Lisa Chen", "email": "lisa.chen@company.com", "department": "Marketing", "departure_date": (datetime.now(timezone.utc) - timedelta(days=5)).strftime("%Y-%m-%d"), "access_revoked": True, "revoke_time_seconds": 32, "managed_by": "user-member-002", "manager_name": "Emily Chen", "details": {"position": "Marketing Manager", "systems_access": ["HubSpot", "Google Ads", "Slack", "Notion"], "revoked_by": "Emily Chen", "revocation_timestamp": (datetime.now(timezone.utc) - timedelta(days=5, hours=2)).isoformat(), "exit_interview": "Completed", "equipment_returned": True}},
            {"id": "off-003", "name": "Robert Kim", "email": "robert.kim@company.com", "department": "Finance", "departure_date": (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d"), "access_revoked": True, "revoke_time_seconds": 58, "managed_by": "user-member-003", "manager_name": "Mike Wilson", "details": {"position": "Financial Analyst", "systems_access": ["SAP", "Excel Online", "PowerBI", "Slack"], "revoked_by": "Mike Wilson", "revocation_timestamp": (datetime.now(timezone.utc) - timedelta(days=7, hours=3)).isoformat(), "exit_interview": "Completed", "equipment_returned": True}},
            {"id": "off-004", "name": "Emma Davis", "email": "emma.davis@company.com", "department": "HR", "departure_date": (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d"), "access_revoked": False, "revoke_time_seconds": 0, "managed_by": "user-member-001", "manager_name": "John Doe", "details": {"position": "HR Coordinator", "systems_access": ["Workday", "BambooHR", "Slack", "DocuSign"], "revoked_by": None, "revocation_timestamp": None, "exit_interview": "Pending", "equipment_returned": False}},
            {"id": "off-005", "name": "Alex Turner", "email": "alex.turner@company.com", "department": "Sales", "departure_date": (datetime.now(timezone.utc)).strftime("%Y-%m-%d"), "access_revoked": False, "revoke_time_seconds": 0, "managed_by": "user-member-002", "manager_name": "Emily Chen", "details": {"position": "Sales Representative", "systems_access": ["Salesforce", "Outreach", "Slack", "Zoom"], "revoked_by": None, "revocation_timestamp": None, "exit_interview": "Scheduled", "equipment_returned": False}},
        ]
        await db.offboarding.insert_many(offboarding)
    
    # Initialize credentials
    credentials_count = await db.credentials.count_documents({})
    if credentials_count == 0:
        credentials = [
            {"id": "cred-001", "name": "AWS Production Keys", "type": "API Key", "due_date": (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%d"), "status": "pending", "managed_by": "user-member-001", "manager_name": "John Doe", "details": {"environment": "Production", "service": "AWS IAM", "last_rotated": (datetime.now(timezone.utc) - timedelta(days=87)).strftime("%Y-%m-%d"), "rotation_policy": "90 days", "associated_services": ["EC2", "S3", "Lambda", "RDS"]}},
            {"id": "cred-002", "name": "Database Admin Password", "type": "Password", "due_date": (datetime.now(timezone.utc) + timedelta(days=5)).strftime("%Y-%m-%d"), "status": "pending", "managed_by": "user-member-003", "manager_name": "Mike Wilson", "details": {"environment": "Production", "service": "PostgreSQL", "last_rotated": (datetime.now(timezone.utc) - timedelta(days=55)).strftime("%Y-%m-%d"), "rotation_policy": "60 days", "associated_services": ["Main DB", "Analytics DB"]}},
            {"id": "cred-003", "name": "GCP Service Account", "type": "Service Account", "due_date": (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d"), "status": "pending", "managed_by": "user-member-002", "manager_name": "Emily Chen", "details": {"environment": "Production", "service": "Google Cloud", "last_rotated": (datetime.now(timezone.utc) - timedelta(days=83)).strftime("%Y-%m-%d"), "rotation_policy": "90 days", "associated_services": ["BigQuery", "Cloud Functions", "Pub/Sub"]}},
            {"id": "cred-004", "name": "Stripe API Key", "type": "API Key", "due_date": (datetime.now(timezone.utc) - timedelta(days=2)).strftime("%Y-%m-%d"), "status": "overdue", "managed_by": "user-member-001", "manager_name": "John Doe", "details": {"environment": "Production", "service": "Stripe", "last_rotated": (datetime.now(timezone.utc) - timedelta(days=92)).strftime("%Y-%m-%d"), "rotation_policy": "90 days", "associated_services": ["Payments", "Subscriptions"]}},
            {"id": "cred-005", "name": "SendGrid SMTP Key", "type": "API Key", "due_date": (datetime.now(timezone.utc) - timedelta(days=5)).strftime("%Y-%m-%d"), "status": "overdue", "managed_by": "user-member-002", "manager_name": "Emily Chen", "details": {"environment": "Production", "service": "SendGrid", "last_rotated": (datetime.now(timezone.utc) - timedelta(days=95)).strftime("%Y-%m-%d"), "rotation_policy": "90 days", "associated_services": ["Email Notifications", "Marketing Emails"]}},
        ]
        await db.credentials.insert_many(credentials)
    
    # Initialize access hygiene data
    hygiene_count = await db.access_hygiene.count_documents({})
    if hygiene_count == 0:
        hygiene_items = [
            {"id": "hyg-001", "type": "overprivileged", "account_name": "dev-ops-bot", "account_type": "Service Account", "issue": "Has admin access but only needs read permissions", "managed_by": "user-member-001", "manager_name": "John Doe", "details": {"current_permissions": ["admin:*", "read:*", "write:*"], "recommended_permissions": ["read:logs", "read:metrics"], "risk_score": 85, "last_activity": (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()}},
            {"id": "hyg-002", "type": "overprivileged", "account_name": "sarah.smith@company.com", "account_type": "User", "issue": "Developer with production database write access", "managed_by": "user-member-002", "manager_name": "Emily Chen", "details": {"current_permissions": ["db:write:production", "db:read:*"], "recommended_permissions": ["db:read:staging", "db:write:staging"], "risk_score": 72, "last_activity": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()}},
            {"id": "hyg-003", "type": "stale", "account_name": "contractor-2023", "account_type": "User", "issue": "No login activity for 45 days", "managed_by": "user-member-003", "manager_name": "Mike Wilson", "details": {"last_login": (datetime.now(timezone.utc) - timedelta(days=45)).isoformat(), "account_created": (datetime.now(timezone.utc) - timedelta(days=180)).isoformat(), "permissions": ["read:docs", "write:reports"], "risk_score": 45}},
            {"id": "hyg-004", "type": "stale", "account_name": "sa-old-monitoring", "account_type": "Service Account", "issue": "Service account for decommissioned system", "managed_by": "user-member-001", "manager_name": "John Doe", "details": {"last_login": (datetime.now(timezone.utc) - timedelta(days=90)).isoformat(), "account_created": (datetime.now(timezone.utc) - timedelta(days=365)).isoformat(), "permissions": ["monitoring:*"], "risk_score": 60}},
            {"id": "hyg-005", "type": "policy_violation", "account_name": "intern-temp", "account_type": "User", "issue": "Shared credentials detected", "managed_by": "user-member-002", "manager_name": "Emily Chen", "details": {"violation_type": "Credential Sharing", "detected_ips": ["192.168.1.10", "192.168.1.25", "10.0.0.15"], "detection_timestamp": (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat(), "risk_score": 90}},
        ]
        await db.access_hygiene.insert_many(hygiene_items)

    # Initialize activity log
    activity_count = await db.activity_log.count_documents({})
    if activity_count == 0:
        activities = [
            {"id": "act-001", "action": "Alert Resolved", "item_type": "alert", "item_id": "alert-007", "user_id": "user-member-001", "user_name": "John Doe", "timestamp": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(), "details": "Marked suspicious login alert as resolved after IP block"},
            {"id": "act-002", "action": "Access Revoked", "item_type": "offboarding", "item_id": "off-001", "user_id": "user-member-001", "user_name": "John Doe", "timestamp": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(), "details": "Revoked access for Mike Johnson in 45 seconds"},
            {"id": "act-003", "action": "Credential Rotated", "item_type": "credential", "item_id": "cred-006", "user_id": "user-member-002", "user_name": "Emily Chen", "timestamp": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(), "details": "Rotated GitHub API key ahead of schedule"},
        ]
        await db.activity_log.insert_many(activities)

async def send_alert_notification(alert: dict):
    """Send email notification for a new alert"""
    # Get assigned user
    if alert.get("assigned_to"):
        user = await db.users.find_one({"id": alert["assigned_to"]}, {"_id": 0})
        if user and user.get("notification_prefs", {}).get("email_enabled"):
            prefs = user.get("notification_prefs", {})
            severity = alert.get("severity", "low")
            
            # Check if user wants notifications for this severity
            should_notify = (
                (severity == "high" and prefs.get("notify_high", True)) or
                (severity == "medium" and prefs.get("notify_medium", True)) or
                (severity == "low" and prefs.get("notify_low", True))
            )
            
            if should_notify:
                subject, html = EmailService.generate_alert_email(alert)
                await EmailService.send_email(user["email"], subject, html)

# Auth Routes
@api_router.post("/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    await init_data()
    user = await db.users.find_one({"email": request.email}, {"_id": 0})
    if not user or user["password"] != hash_password(request.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["email"], user["role"])
    return LoginResponse(
        token=token,
        user={
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "department": user["department"],
            "avatar": user["avatar"]
        }
    )

@api_router.get("/auth/me")
async def get_me(payload: dict = Depends(verify_token)):
    user = await db.users.find_one({"email": payload["email"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user["greeting"] = get_time_greeting()
    return user

@api_router.get("/team/members")
async def get_team_members(payload: dict = Depends(verify_token)):
    if payload["role"] not in ["admin", "team_lead"]:
        raise HTTPException(status_code=403, detail="Access denied")
    members = await db.users.find({}, {"_id": 0, "password": 0}).to_list(100)
    return members

# Dashboard Routes
@api_router.get("/dashboard/metrics")
async def get_metrics(payload: dict = Depends(verify_token)):
    user_role = payload["role"]
    user_id = payload["user_id"]
    
    if user_role == "team_member":
        my_alerts = await db.alerts.count_documents({"assigned_to": user_id, "status": "open"})
        my_offboarding = await db.offboarding.count_documents({"managed_by": user_id, "access_revoked": False})
        my_credentials = await db.credentials.count_documents({"managed_by": user_id, "status": {"$in": ["pending", "overdue"]}})
        my_hygiene = await db.access_hygiene.count_documents({"managed_by": user_id})
        
        return {
            "total_active_users": None,
            "service_accounts": None,
            "privileged_accounts": None,
            "flagged_accounts": my_alerts,
            "credentials_due_rotation": my_credentials,
            "pending_offboarding": my_offboarding,
            "hygiene_issues": my_hygiene,
            "is_personal_view": True
        }
    else:
        return {
            "total_active_users": 1284,
            "service_accounts": 156,
            "privileged_accounts": 47,
            "flagged_accounts": 12,
            "credentials_due_rotation": 23,
            "pending_offboarding": 2,
            "hygiene_issues": 109,
            "is_personal_view": False
        }

@api_router.get("/dashboard/alerts")
async def get_alerts(payload: dict = Depends(verify_token)):
    user_role = payload["role"]
    user_id = payload["user_id"]
    
    if user_role == "team_member":
        alerts = await db.alerts.find({"assigned_to": user_id}, {"_id": 0}).to_list(100)
    else:
        alerts = await db.alerts.find({}, {"_id": 0}).to_list(100)
    
    return alerts

@api_router.get("/dashboard/alerts/{alert_id}")
async def get_alert_detail(alert_id: str, payload: dict = Depends(verify_token)):
    alert = await db.alerts.find_one({"id": alert_id}, {"_id": 0})
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    if payload["role"] == "team_member" and alert.get("assigned_to") != payload["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return alert

@api_router.put("/dashboard/alerts/{alert_id}")
async def update_alert(alert_id: str, request: UpdateAlertRequest, payload: dict = Depends(verify_token)):
    alert = await db.alerts.find_one({"id": alert_id}, {"_id": 0})
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    if payload["role"] == "team_member" and alert.get("assigned_to") != payload["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.alerts.update_one({"id": alert_id}, {"$set": {"status": request.status}})
    
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    await db.activity_log.insert_one({
        "id": str(uuid.uuid4()),
        "action": f"Alert {request.status.title()}",
        "item_type": "alert",
        "item_id": alert_id,
        "user_id": payload["user_id"],
        "user_name": user["name"] if user else "Unknown",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "details": f"Changed alert '{alert['title']}' status to {request.status}"
    })
    
    return {"success": True, "status": request.status}

@api_router.get("/dashboard/alerts-chart")
async def get_alerts_chart(payload: dict = Depends(verify_token)):
    import random
    chart_data = []
    for i in range(6, -1, -1):
        date = datetime.now(timezone.utc) - timedelta(days=i)
        chart_data.append({
            "date": date.strftime("%a"),
            "high": random.randint(2, 8),
            "medium": random.randint(5, 15),
            "low": random.randint(10, 25)
        })
    return chart_data

@api_router.get("/dashboard/access-hygiene")
async def get_access_hygiene(payload: dict = Depends(verify_token)):
    user_role = payload["role"]
    user_id = payload["user_id"]
    
    if user_role == "team_member":
        items = await db.access_hygiene.find({"managed_by": user_id}, {"_id": 0}).to_list(100)
    else:
        items = await db.access_hygiene.find({}, {"_id": 0}).to_list(100)
    
    overprivileged = len([i for i in items if i["type"] == "overprivileged"])
    stale = len([i for i in items if i["type"] == "stale"])
    violations = len([i for i in items if i["type"] == "policy_violation"])
    
    return {
        "overprivileged_accounts": overprivileged if user_role == "team_member" else 34,
        "stale_accounts": stale if user_role == "team_member" else 67,
        "policy_violations": violations if user_role == "team_member" else 8,
        "items": items
    }

@api_router.get("/dashboard/offboarding")
async def get_offboarding(payload: dict = Depends(verify_token)):
    user_role = payload["role"]
    user_id = payload["user_id"]
    
    if user_role == "team_member":
        records = await db.offboarding.find({"managed_by": user_id}, {"_id": 0}).to_list(100)
    else:
        records = await db.offboarding.find({}, {"_id": 0}).to_list(100)
    
    revoked_records = [r for r in records if r["access_revoked"]]
    avg_time = sum(r["revoke_time_seconds"] for r in revoked_records) // max(1, len(revoked_records)) if revoked_records else 0
    
    return {"records": records, "average_revoke_time": avg_time}

@api_router.get("/dashboard/offboarding/{record_id}")
async def get_offboarding_detail(record_id: str, payload: dict = Depends(verify_token)):
    record = await db.offboarding.find_one({"id": record_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    if payload["role"] == "team_member" and record.get("managed_by") != payload["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return record

@api_router.put("/dashboard/offboarding/{record_id}")
async def update_offboarding(record_id: str, request: UpdateOffboardingRequest, payload: dict = Depends(verify_token)):
    record = await db.offboarding.find_one({"id": record_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    if payload["role"] == "team_member" and record.get("managed_by") != payload["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    
    update_data = {
        "access_revoked": request.access_revoked,
        "revoke_time_seconds": request.revoke_time_seconds or 0,
        "details.revoked_by": user["name"] if user else "Unknown",
        "details.revocation_timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.offboarding.update_one({"id": record_id}, {"$set": update_data})
    
    await db.activity_log.insert_one({
        "id": str(uuid.uuid4()),
        "action": "Access Revoked",
        "item_type": "offboarding",
        "item_id": record_id,
        "user_id": payload["user_id"],
        "user_name": user["name"] if user else "Unknown",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "details": f"Revoked access for {record['name']} in {request.revoke_time_seconds or 0} seconds"
    })
    
    return {"success": True}

@api_router.get("/dashboard/credentials")
async def get_credentials(payload: dict = Depends(verify_token)):
    user_role = payload["role"]
    user_id = payload["user_id"]
    
    if user_role == "team_member":
        creds = await db.credentials.find({"managed_by": user_id}, {"_id": 0}).to_list(100)
    else:
        creds = await db.credentials.find({}, {"_id": 0}).to_list(100)
    
    pending = len([c for c in creds if c["status"] == "pending"])
    overdue = len([c for c in creds if c["status"] == "overdue"])
    total = max(1, pending + overdue)
    
    return {
        "on_schedule_percent": 78 if user_role != "team_member" else round((pending / total) * 100),
        "overdue_percent": 22 if user_role != "team_member" else round((overdue / total) * 100),
        "next_rotations": creds
    }

@api_router.get("/dashboard/credentials/{cred_id}")
async def get_credential_detail(cred_id: str, payload: dict = Depends(verify_token)):
    cred = await db.credentials.find_one({"id": cred_id}, {"_id": 0})
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    if payload["role"] == "team_member" and cred.get("managed_by") != payload["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return cred

@api_router.put("/dashboard/credentials/{cred_id}")
async def update_credential(cred_id: str, request: UpdateCredentialRequest, payload: dict = Depends(verify_token)):
    cred = await db.credentials.find_one({"id": cred_id}, {"_id": 0})
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    if payload["role"] == "team_member" and cred.get("managed_by") != payload["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    
    if request.rotated:
        new_due_date = (datetime.now(timezone.utc) + timedelta(days=90)).strftime("%Y-%m-%d")
        await db.credentials.update_one({"id": cred_id}, {"$set": {
            "status": "rotated",
            "due_date": new_due_date,
            "details.last_rotated": datetime.now(timezone.utc).strftime("%Y-%m-%d")
        }})
        
        await db.activity_log.insert_one({
            "id": str(uuid.uuid4()),
            "action": "Credential Rotated",
            "item_type": "credential",
            "item_id": cred_id,
            "user_id": payload["user_id"],
            "user_name": user["name"] if user else "Unknown",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": f"Rotated credential '{cred['name']}'"
        })
    
    return {"success": True}

@api_router.get("/dashboard/compliance")
async def get_compliance(payload: dict = Depends(verify_token)):
    return {
        "cis_benchmarks": [
            {"name": "Identity Management", "status": "pass", "score": 95},
            {"name": "Access Control", "status": "pass", "score": 88},
            {"name": "Audit Logging", "status": "pass", "score": "92"},
            {"name": "Data Protection", "status": "warning", "score": 75},
            {"name": "Network Security", "status": "fail", "score": 45},
        ],
        "audit_readiness_score": 82
    }

@api_router.get("/dashboard/notifications")
async def get_notifications(payload: dict = Depends(verify_token)):
    return [
        {"id": "1", "title": "Security Alert", "message": "Critical vulnerability detected in auth system", "severity": "high", "timestamp": (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat(), "read": False},
        {"id": "2", "title": "Compliance Update", "message": "CIS benchmark scan completed", "severity": "low", "timestamp": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(), "read": False},
        {"id": "3", "title": "Access Request", "message": "New privileged access request pending", "severity": "medium", "timestamp": (datetime.now(timezone.utc) - timedelta(hours=4)).isoformat(), "read": True},
        {"id": "4", "title": "System Maintenance", "message": "Scheduled maintenance in 24 hours", "severity": "low", "timestamp": (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat(), "read": True},
    ]

@api_router.get("/dashboard/activity-log")
async def get_activity_log(payload: dict = Depends(verify_token)):
    if payload["role"] == "team_member":
        activities = await db.activity_log.find({"user_id": payload["user_id"]}, {"_id": 0}).sort("timestamp", -1).to_list(50)
    else:
        activities = await db.activity_log.find({}, {"_id": 0}).sort("timestamp", -1).to_list(50)
    return activities

@api_router.get("/dashboard/email-log")
async def get_email_log(payload: dict = Depends(verify_token)):
    """Get email log (for admin to see mocked emails)"""
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    emails = await db.email_log.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    return emails

@api_router.get("/settings/notifications")
async def get_notification_settings(payload: dict = Depends(verify_token)):
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    return user.get("notification_prefs", {
        "email_enabled": True,
        "notify_high": True,
        "notify_medium": True,
        "notify_low": True
    })

@api_router.put("/settings/notifications")
async def update_notification_settings(prefs: NotificationPreferences, payload: dict = Depends(verify_token)):
    await db.users.update_one(
        {"id": payload["user_id"]},
        {"$set": {"notification_prefs": prefs.model_dump()}}
    )
    return {"success": True}

# =============================================================================
# DEVOPS WEBHOOK APIs - For CI/CD and External System Integration
# =============================================================================

@api_router.post("/webhooks/incoming")
async def receive_webhook(event: WebhookEvent):
    """
    Receive webhooks from external systems (Jenkins, GitHub, Terraform, etc.)
    This endpoint can be called without authentication for automated systems.
    Use webhook secrets for validation in production.
    """
    event_id = str(uuid.uuid4())
    timestamp = event.timestamp or datetime.now(timezone.utc).isoformat()
    
    # Log the webhook event
    await db.webhook_events.insert_one({
        "id": event_id,
        "event_type": event.event_type,
        "source": event.source,
        "payload": event.payload,
        "timestamp": timestamp,
        "processed": False
    })
    
    # Process based on event type
    if event.event_type == "deployment":
        # Track deployment events
        await db.activity_log.insert_one({
            "id": str(uuid.uuid4()),
            "action": "Deployment Event",
            "item_type": "deployment",
            "item_id": event.payload.get("deployment_id", event_id),
            "user_id": "system",
            "user_name": f"CI/CD ({event.source})",
            "timestamp": timestamp,
            "details": f"Deployment from {event.source}: {event.payload.get('environment', 'unknown')} - {event.payload.get('status', 'unknown')}"
        })
    
    elif event.event_type == "incident":
        # Create alert from incident
        severity = event.payload.get("severity", "medium")
        alert = {
            "id": f"alert-webhook-{event_id[:8]}",
            "title": event.payload.get("title", "External Incident"),
            "description": event.payload.get("description", "Incident reported via webhook"),
            "severity": severity,
            "timestamp": timestamp,
            "source": event.source,
            "status": "open",
            "escalated": False,
            "assigned_to": None,
            "assigned_name": "Unassigned",
            "details": event.payload
        }
        await db.alerts.insert_one(alert)
        await send_alert_notification(alert)
    
    elif event.event_type == "access_change":
        # Log access changes from IAM systems
        await db.activity_log.insert_one({
            "id": str(uuid.uuid4()),
            "action": "Access Change (External)",
            "item_type": "iam_event",
            "item_id": event.payload.get("user_id", event_id),
            "user_id": "system",
            "user_name": f"IAM ({event.source})",
            "timestamp": timestamp,
            "details": f"Access change: {event.payload.get('change_type', 'unknown')} for {event.payload.get('user_email', 'unknown')}"
        })
    
    # Mark as processed
    await db.webhook_events.update_one({"id": event_id}, {"$set": {"processed": True}})
    
    return {"success": True, "event_id": event_id, "message": f"Webhook event '{event.event_type}' processed"}

@api_router.get("/webhooks/events")
async def list_webhook_events(payload: dict = Depends(verify_token)):
    """List received webhook events (admin only)"""
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    events = await db.webhook_events.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    return events

# =============================================================================
# HR SYSTEM INTEGRATION - Automated Offboarding
# =============================================================================

@api_router.post("/integrations/hr/offboarding")
async def hr_offboarding_trigger(request: HROffboardingRequest):
    """
    Receive offboarding requests from HR systems (Workday, BambooHR, etc.)
    Automatically creates offboarding record and assigns to team member.
    """
    offboarding_id = f"off-hr-{str(uuid.uuid4())[:8]}"
    
    # Find a team member to assign (round-robin or least loaded)
    team_members = await db.users.find({"role": "team_member"}, {"_id": 0}).to_list(100)
    if team_members:
        # Simple assignment - could be enhanced with workload balancing
        import random
        assignee = random.choice(team_members)
    else:
        assignee = {"id": "unassigned", "name": "Unassigned"}
    
    offboarding_record = {
        "id": offboarding_id,
        "name": request.employee_name,
        "email": request.employee_email,
        "department": request.department,
        "departure_date": request.departure_date,
        "access_revoked": False,
        "revoke_time_seconds": 0,
        "managed_by": assignee["id"],
        "manager_name": assignee["name"],
        "hr_ticket_id": request.hr_ticket_id,
        "source": "hr_integration",
        "details": {
            "position": request.position,
            "systems_access": request.systems_access,
            "revoked_by": None,
            "revocation_timestamp": None,
            "exit_interview": "Pending",
            "equipment_returned": False
        }
    }
    
    await db.offboarding.insert_one(offboarding_record)
    
    # Notify assigned team member
    if assignee["id"] != "unassigned":
        await EmailService.send_email(
            assignee.get("email", ""),
            f"[ACTION REQUIRED] Offboarding: {request.employee_name}",
            f"""
            <h2>New Offboarding Assignment</h2>
            <p>You have been assigned to revoke access for:</p>
            <ul>
                <li><strong>Name:</strong> {request.employee_name}</li>
                <li><strong>Department:</strong> {request.department}</li>
                <li><strong>Departure Date:</strong> {request.departure_date}</li>
                <li><strong>Systems:</strong> {', '.join(request.systems_access)}</li>
            </ul>
            <p>Please complete the access revocation as soon as possible.</p>
            """
        )
    
    # Log activity
    await db.activity_log.insert_one({
        "id": str(uuid.uuid4()),
        "action": "HR Offboarding Created",
        "item_type": "offboarding",
        "item_id": offboarding_id,
        "user_id": "system",
        "user_name": "HR System",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "details": f"Offboarding created for {request.employee_name} via HR integration"
    })
    
    return {
        "success": True,
        "offboarding_id": offboarding_id,
        "assigned_to": assignee["name"],
        "message": "Offboarding record created and assigned"
    }

# =============================================================================
# IAM PROVIDER INTEGRATION - Okta, Azure AD, AWS IAM, GCP IAM
# =============================================================================

@api_router.post("/integrations/iam/sync")
async def iam_sync(request: IAMSyncRequest, payload: dict = Depends(verify_token)):
    """
    Sync users, groups, or permissions from IAM providers.
    This endpoint would connect to real IAM APIs in production.
    """
    if payload["role"] not in ["admin", "team_lead"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    sync_id = str(uuid.uuid4())
    
    # Log sync request
    sync_record = {
        "id": sync_id,
        "provider": request.provider,
        "action": request.action,
        "status": "pending",
        "initiated_by": payload["user_id"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": request.data,
        "results": None
    }
    await db.iam_sync_logs.insert_one(sync_record)
    
    # Simulate sync based on provider (would be real API calls in production)
    results = {
        "provider": request.provider,
        "action": request.action,
        "status": "completed",
        "summary": {}
    }
    
    if request.action == "sync_users":
        # In production: Call Okta/Azure AD API to get users
        results["summary"] = {
            "total_users": request.data.get("user_count", 0),
            "new_users": request.data.get("new_count", 0),
            "updated_users": request.data.get("updated_count", 0),
            "deactivated_users": request.data.get("deactivated_count", 0)
        }
    elif request.action == "sync_groups":
        results["summary"] = {
            "total_groups": request.data.get("group_count", 0),
            "synced_memberships": request.data.get("membership_count", 0)
        }
    elif request.action == "sync_permissions":
        results["summary"] = {
            "policies_synced": request.data.get("policy_count", 0),
            "roles_updated": request.data.get("role_count", 0)
        }
    
    # Update sync record
    await db.iam_sync_logs.update_one(
        {"id": sync_id},
        {"$set": {"status": "completed", "results": results}}
    )
    
    # Log activity
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    await db.activity_log.insert_one({
        "id": str(uuid.uuid4()),
        "action": f"IAM Sync ({request.provider})",
        "item_type": "iam_sync",
        "item_id": sync_id,
        "user_id": payload["user_id"],
        "user_name": user["name"] if user else "Unknown",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "details": f"Synced {request.action} from {request.provider}"
    })
    
    return {"success": True, "sync_id": sync_id, "results": results}

@api_router.get("/integrations/iam/sync-logs")
async def get_iam_sync_logs(payload: dict = Depends(verify_token)):
    """Get IAM sync history"""
    if payload["role"] not in ["admin", "team_lead"]:
        raise HTTPException(status_code=403, detail="Access denied")
    logs = await db.iam_sync_logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(50)
    return logs

# =============================================================================
# PERMISSION MANAGEMENT - Modify Access Levels
# =============================================================================

@api_router.post("/permissions/change-request")
async def create_permission_change(request: PermissionChangeRequest, payload: dict = Depends(verify_token)):
    """
    Create a permission change request.
    Admin/Team Lead can approve, or it goes through approval workflow.
    """
    change_id = str(uuid.uuid4())
    
    change_record = {
        "id": change_id,
        "account_id": request.account_id,
        "account_type": request.account_type,
        "current_permissions": request.current_permissions,
        "new_permissions": request.new_permissions,
        "reason": request.reason,
        "requested_by": payload["user_id"],
        "status": "pending" if payload["role"] == "team_member" else "approved",
        "approved_by": payload["user_id"] if payload["role"] != "team_member" else None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "applied": False
    }
    
    await db.permission_changes.insert_one(change_record)
    
    # Auto-apply if requested by admin/team_lead
    if payload["role"] in ["admin", "team_lead"]:
        # In production: Call IAM API to apply changes
        await db.permission_changes.update_one(
            {"id": change_id},
            {"$set": {"applied": True, "applied_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Update access_hygiene if this resolves an overprivileged account
        await db.access_hygiene.delete_one({"account_name": request.account_id, "type": "overprivileged"})
    
    # Log activity
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    await db.activity_log.insert_one({
        "id": str(uuid.uuid4()),
        "action": "Permission Change Request",
        "item_type": "permission",
        "item_id": change_id,
        "user_id": payload["user_id"],
        "user_name": user["name"] if user else "Unknown",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "details": f"Permission change for {request.account_id}: {len(request.current_permissions)} -> {len(request.new_permissions)} permissions"
    })
    
    return {
        "success": True,
        "change_id": change_id,
        "status": change_record["status"],
        "applied": change_record["applied"] if payload["role"] != "team_member" else False
    }

@api_router.get("/permissions/pending")
async def get_pending_permission_changes(payload: dict = Depends(verify_token)):
    """Get pending permission change requests"""
    if payload["role"] not in ["admin", "team_lead"]:
        raise HTTPException(status_code=403, detail="Access denied")
    pending = await db.permission_changes.find({"status": "pending"}, {"_id": 0}).to_list(100)
    return pending

@api_router.put("/permissions/{change_id}/approve")
async def approve_permission_change(change_id: str, payload: dict = Depends(verify_token)):
    """Approve a permission change request"""
    if payload["role"] not in ["admin", "team_lead"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    change = await db.permission_changes.find_one({"id": change_id}, {"_id": 0})
    if not change:
        raise HTTPException(status_code=404, detail="Change request not found")
    
    await db.permission_changes.update_one(
        {"id": change_id},
        {"$set": {
            "status": "approved",
            "approved_by": payload["user_id"],
            "applied": True,
            "applied_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log activity
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    await db.activity_log.insert_one({
        "id": str(uuid.uuid4()),
        "action": "Permission Change Approved",
        "item_type": "permission",
        "item_id": change_id,
        "user_id": payload["user_id"],
        "user_name": user["name"] if user else "Unknown",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "details": f"Approved permission change for {change['account_id']}"
    })
    
    return {"success": True, "message": "Permission change approved and applied"}

@api_router.put("/permissions/{change_id}/reject")
async def reject_permission_change(change_id: str, payload: dict = Depends(verify_token)):
    """Reject a permission change request"""
    if payload["role"] not in ["admin", "team_lead"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.permission_changes.update_one(
        {"id": change_id},
        {"$set": {"status": "rejected", "rejected_by": payload["user_id"]}}
    )
    
    return {"success": True, "message": "Permission change rejected"}

# =============================================================================
# OUTGOING WEBHOOKS - Notify External Systems
# =============================================================================

@api_router.get("/webhooks/config")
async def get_webhook_configs(payload: dict = Depends(verify_token)):
    """Get configured outgoing webhooks"""
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    configs = await db.webhook_configs.find({}, {"_id": 0}).to_list(100)
    return configs

@api_router.post("/webhooks/config")
async def create_webhook_config(config: WebhookConfig, payload: dict = Depends(verify_token)):
    """Create outgoing webhook configuration"""
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    webhook_id = str(uuid.uuid4())
    webhook_data = config.model_dump()
    webhook_data["id"] = webhook_id
    webhook_data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.webhook_configs.insert_one(webhook_data)
    
    return {"success": True, "webhook_id": webhook_id}

@api_router.delete("/webhooks/config/{webhook_id}")
async def delete_webhook_config(webhook_id: str, payload: dict = Depends(verify_token)):
    """Delete outgoing webhook configuration"""
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.webhook_configs.delete_one({"id": webhook_id})
    return {"success": True}

async def trigger_outgoing_webhooks(event_type: str, data: dict):
    """Trigger all configured webhooks for an event type"""
    configs = await db.webhook_configs.find({"active": True, "events": event_type}, {"_id": 0}).to_list(100)
    
    for config in configs:
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                headers = {"Content-Type": "application/json"}
                if config.get("secret"):
                    import hmac
                    import json
                    signature = hmac.new(
                        config["secret"].encode(),
                        json.dumps(data).encode(),
                        "sha256"
                    ).hexdigest()
                    headers["X-Webhook-Signature"] = signature
                
                await client.post(
                    config["url"],
                    json={"event": event_type, "data": data, "timestamp": datetime.now(timezone.utc).isoformat()},
                    headers=headers,
                    timeout=10
                )
        except Exception as e:
            logging.error(f"Webhook delivery failed to {config['url']}: {e}")

# =============================================================================
# API HEALTH & STATUS
# =============================================================================

@api_router.get("/health")
async def health_check():
    """Health check endpoint for load balancers and monitoring"""
    try:
        # Check database connection
        await db.command("ping")
        db_status = "healthy"
    except Exception:
        db_status = "unhealthy"
    
    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "database": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0"
    }

@api_router.get("/")
async def root():
    return {"message": "Sentinel Dashboard API", "version": "1.0.0"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    await init_data()
    # Start escalation checker in background
    asyncio.create_task(escalation_checker())

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
