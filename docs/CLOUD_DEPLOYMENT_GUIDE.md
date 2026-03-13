# Sentinel Cloud Identity Dashboard - Cloud Deployment Guide

## Document Overview

This guide provides comprehensive instructions for deploying the Sentinel Dashboard to cloud infrastructure, specifically focusing on **Google Cloud Platform (GCP)**. It also covers AWS and Azure alternatives where applicable.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Google Cloud Platform Deployment](#3-google-cloud-platform-deployment)
4. [Database Migration (MongoDB Atlas)](#4-database-migration-mongodb-atlas)
5. [Environment Configuration](#5-environment-configuration)
6. [Email Service Integration (Resend)](#6-email-service-integration-resend)
7. [CI/CD Pipeline Setup](#7-cicd-pipeline-setup)
8. [Security Best Practices](#8-security-best-practices)
9. [Monitoring & Logging](#9-monitoring--logging)
10. [Scaling Considerations](#10-scaling-considerations)
11. [Cost Estimation](#11-cost-estimation)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Architecture Overview

### Current Stack
```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│  React + Tailwind CSS + Shadcn/UI + Recharts                    │
│  Port: 3000                                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
│  FastAPI + Python 3.11                                          │
│  Port: 8001                                                      │
│  - JWT Authentication                                            │
│  - Role-based Access Control                                     │
│  - Escalation Service (Background Task)                          │
│  - Email Service (Resend Integration)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASE                                  │
│  MongoDB (Local → MongoDB Atlas for Production)                  │
│  Collections: users, alerts, offboarding, credentials,           │
│               access_hygiene, activity_log, email_log            │
└─────────────────────────────────────────────────────────────────┘
```

### Target Cloud Architecture (GCP)
```
┌─────────────────────────────────────────────────────────────────┐
│                    Google Cloud Platform                         │
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Cloud     │    │   Cloud     │    │  MongoDB    │         │
│  │   Storage   │───▶│    Run      │───▶│   Atlas     │         │
│  │  (Frontend) │    │  (Backend)  │    │ (Database)  │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│         │                  │                  │                  │
│         └──────────────────┼──────────────────┘                  │
│                            │                                     │
│                    ┌───────▼───────┐                            │
│                    │ Cloud Load    │                            │
│                    │  Balancer     │                            │
│                    └───────────────┘                            │
│                            │                                     │
│                    ┌───────▼───────┐                            │
│                    │ Cloud CDN     │                            │
│                    └───────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Prerequisites

### Required Accounts
- [ ] Google Cloud Platform account (with billing enabled)
- [ ] MongoDB Atlas account (free tier available)
- [ ] Resend account (for email notifications)
- [ ] GitHub/GitLab account (for CI/CD)
- [ ] Docker Hub account (optional, for custom images)

### Required Tools (Install on local machine)
```bash
# Google Cloud SDK
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init

# Docker
# Download from https://docs.docker.com/get-docker/

# Node.js (v18+)
# Download from https://nodejs.org/

# Python 3.11+
# Download from https://python.org/
```

### Verify Installations
```bash
gcloud --version
docker --version
node --version
python3 --version
```

---

## 3. Google Cloud Platform Deployment

### 3.1 Initial Setup

```bash
# Login to GCP
gcloud auth login

# Create new project
gcloud projects create sentinel-dashboard-prod --name="Sentinel Dashboard"

# Set project
gcloud config set project sentinel-dashboard-prod

# Enable required APIs
gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com \
    cloudresourcemanager.googleapis.com \
    containerregistry.googleapis.com
```

### 3.2 Backend Deployment (Cloud Run)

#### Create Dockerfile for Backend
Create `/app/backend/Dockerfile`:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8080

# Run the application
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"]
```

#### Build and Deploy
```bash
cd /app/backend

# Build container image
gcloud builds submit --tag gcr.io/sentinel-dashboard-prod/backend

# Deploy to Cloud Run
gcloud run deploy sentinel-backend \
    --image gcr.io/sentinel-dashboard-prod/backend \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars "MONGO_URL=<YOUR_MONGODB_ATLAS_URL>" \
    --set-env-vars "DB_NAME=sentinel_prod" \
    --set-env-vars "JWT_SECRET=<YOUR_SECRET_KEY>" \
    --set-env-vars "RESEND_API_KEY=<YOUR_RESEND_KEY>" \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 1 \
    --max-instances 10
```

#### Get Backend URL
```bash
gcloud run services describe sentinel-backend --region us-central1 --format='value(status.url)'
# Output: https://sentinel-backend-xxxxx-uc.a.run.app
```

### 3.3 Frontend Deployment (Cloud Storage + CDN)

#### Build Frontend for Production
```bash
cd /app/frontend

# Update .env for production
echo "REACT_APP_BACKEND_URL=https://sentinel-backend-xxxxx-uc.a.run.app" > .env.production

# Build
yarn build
```

#### Deploy to Cloud Storage
```bash
# Create bucket
gsutil mb -l us-central1 gs://sentinel-dashboard-frontend

# Enable website hosting
gsutil web set -m index.html -e index.html gs://sentinel-dashboard-frontend

# Upload build files
gsutil -m cp -r build/* gs://sentinel-dashboard-frontend/

# Make public
gsutil iam ch allUsers:objectViewer gs://sentinel-dashboard-frontend
```

#### Setup Cloud CDN (Optional but Recommended)
```bash
# Create backend bucket
gcloud compute backend-buckets create sentinel-frontend-bucket \
    --gcs-bucket-name=sentinel-dashboard-frontend \
    --enable-cdn

# Create URL map
gcloud compute url-maps create sentinel-lb \
    --default-backend-bucket=sentinel-frontend-bucket

# Create HTTPS proxy (requires SSL certificate)
gcloud compute target-https-proxies create sentinel-https-proxy \
    --url-map=sentinel-lb \
    --ssl-certificates=sentinel-cert

# Create forwarding rule
gcloud compute forwarding-rules create sentinel-https-rule \
    --target-https-proxy=sentinel-https-proxy \
    --ports=443 \
    --global
```

### 3.4 Custom Domain Setup

```bash
# Verify domain ownership
gcloud domains verify yourdomain.com

# Create managed SSL certificate
gcloud compute ssl-certificates create sentinel-cert \
    --domains=dashboard.yourdomain.com \
    --global

# Update DNS records (in your domain registrar):
# Type: A, Name: dashboard, Value: <Load Balancer IP>
# Type: AAAA, Name: dashboard, Value: <Load Balancer IPv6>
```

---

## 4. Database Migration (MongoDB Atlas)

### 4.1 Create MongoDB Atlas Cluster

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create new project: "Sentinel Dashboard"
3. Create cluster:
   - Provider: Google Cloud
   - Region: us-central1 (same as Cloud Run)
   - Tier: M10 (Production) or M0 (Free for testing)

### 4.2 Configure Network Access

```
# In Atlas Dashboard → Network Access → Add IP Address
# Add Cloud Run's IP range or use 0.0.0.0/0 for testing (NOT recommended for production)

# For production, use VPC Peering:
# 1. Create VPC connector in GCP
# 2. Configure private endpoint in Atlas
```

### 4.3 Create Database User

```
# In Atlas Dashboard → Database Access → Add Database User
Username: sentinel_app
Password: <STRONG_PASSWORD>
Role: readWrite@sentinel_prod
```

### 4.4 Get Connection String

```
# Format:
mongodb+srv://sentinel_app:<PASSWORD>@cluster0.xxxxx.mongodb.net/sentinel_prod?retryWrites=true&w=majority

# Add to Cloud Run environment:
gcloud run services update sentinel-backend \
    --set-env-vars "MONGO_URL=mongodb+srv://sentinel_app:<PASSWORD>@cluster0.xxxxx.mongodb.net/sentinel_prod?retryWrites=true&w=majority"
```

### 4.5 Data Migration Script

Create `/app/scripts/migrate_data.py`:
```python
"""
Data Migration Script - Local MongoDB to Atlas
"""
import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

# Source (local)
SOURCE_URL = "mongodb://localhost:27017"
SOURCE_DB = "test_database"

# Target (Atlas)
TARGET_URL = os.environ.get("MONGO_ATLAS_URL")
TARGET_DB = "sentinel_prod"

def migrate():
    source_client = MongoClient(SOURCE_URL)
    target_client = MongoClient(TARGET_URL)
    
    source_db = source_client[SOURCE_DB]
    target_db = target_client[TARGET_DB]
    
    collections = ["users", "alerts", "offboarding", "credentials", 
                   "access_hygiene", "activity_log", "email_log"]
    
    for collection_name in collections:
        print(f"Migrating {collection_name}...")
        source_collection = source_db[collection_name]
        target_collection = target_db[collection_name]
        
        # Clear target (optional)
        target_collection.delete_many({})
        
        # Copy documents
        documents = list(source_collection.find())
        if documents:
            # Remove _id to let Atlas generate new ones
            for doc in documents:
                doc.pop('_id', None)
            target_collection.insert_many(documents)
        
        print(f"  Migrated {len(documents)} documents")
    
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
```

Run migration:
```bash
export MONGO_ATLAS_URL="mongodb+srv://..."
python3 scripts/migrate_data.py
```

---

## 5. Environment Configuration

### 5.1 Using Google Secret Manager (Recommended)

```bash
# Create secrets
echo -n "your-jwt-secret" | gcloud secrets create jwt-secret --data-file=-
echo -n "mongodb+srv://..." | gcloud secrets create mongo-url --data-file=-
echo -n "re_xxxx" | gcloud secrets create resend-api-key --data-file=-

# Grant Cloud Run access
gcloud secrets add-iam-policy-binding jwt-secret \
    --member="serviceAccount:sentinel-dashboard-prod@appspot.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# Update Cloud Run to use secrets
gcloud run services update sentinel-backend \
    --set-secrets="JWT_SECRET=jwt-secret:latest,MONGO_URL=mongo-url:latest,RESEND_API_KEY=resend-api-key:latest"
```

### 5.2 Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGO_URL` | MongoDB connection string | `mongodb+srv://...` |
| `DB_NAME` | Database name | `sentinel_prod` |
| `JWT_SECRET` | Secret for JWT signing | `<random-256-bit-string>` |
| `RESEND_API_KEY` | Resend API key for emails | `re_xxxxxxxxxxxx` |
| `EMAIL_FROM` | Sender email address | `alerts@yourdomain.com` |
| `CORS_ORIGINS` | Allowed CORS origins | `https://dashboard.yourdomain.com` |

### 5.3 Generate Secure JWT Secret

```bash
# Generate random secret
python3 -c "import secrets; print(secrets.token_hex(32))"
```

---

## 6. Email Service Integration (Resend)

### 6.1 Setup Resend Account

1. Go to [Resend](https://resend.com)
2. Sign up / Login
3. Verify your domain:
   - Add DNS records (TXT, CNAME) as provided
   - Wait for verification (usually 24-48 hours)

### 6.2 Get API Key

1. Dashboard → API Keys → Create API Key
2. Copy the key (starts with `re_`)
3. Add to Secret Manager (see section 5.1)

### 6.3 Configure Sender Domain

```
# DNS Records to add:
# 1. SPF Record
Type: TXT
Name: @
Value: v=spf1 include:_spf.resend.com ~all

# 2. DKIM Record
Type: CNAME
Name: resend._domainkey
Value: <provided by Resend>

# 3. Return-Path
Type: CNAME
Name: bounces
Value: <provided by Resend>
```

### 6.4 Test Email Sending

```bash
curl -X POST 'https://api.resend.com/emails' \
    -H 'Authorization: Bearer re_xxxxx' \
    -H 'Content-Type: application/json' \
    -d '{
        "from": "alerts@yourdomain.com",
        "to": ["test@example.com"],
        "subject": "Test Alert",
        "html": "<p>This is a test email from Sentinel Dashboard</p>"
    }'
```

---

## 7. CI/CD Pipeline Setup

### 7.1 GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to GCP

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  PROJECT_ID: sentinel-dashboard-prod
  REGION: us-central1
  BACKEND_SERVICE: sentinel-backend
  FRONTEND_BUCKET: sentinel-dashboard-frontend

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - id: auth
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2
      
      - name: Build and Push
        run: |
          cd backend
          gcloud builds submit --tag gcr.io/$PROJECT_ID/backend
      
      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy $BACKEND_SERVICE \
            --image gcr.io/$PROJECT_ID/backend \
            --region $REGION \
            --platform managed

  deploy-frontend:
    runs-on: ubuntu-latest
    needs: deploy-backend
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'yarn'
          cache-dependency-path: frontend/yarn.lock
      
      - name: Install and Build
        run: |
          cd frontend
          yarn install
          echo "REACT_APP_BACKEND_URL=${{ secrets.BACKEND_URL }}" > .env.production
          yarn build
      
      - id: auth
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - name: Upload to Cloud Storage
        run: |
          gsutil -m cp -r frontend/build/* gs://$FRONTEND_BUCKET/
```

### 7.2 Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `GCP_SA_KEY` | Service account JSON key |
| `BACKEND_URL` | Cloud Run backend URL |

### 7.3 Create Service Account for CI/CD

```bash
# Create service account
gcloud iam service-accounts create github-actions \
    --display-name="GitHub Actions"

# Grant permissions
gcloud projects add-iam-policy-binding sentinel-dashboard-prod \
    --member="serviceAccount:github-actions@sentinel-dashboard-prod.iam.gserviceaccount.com" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding sentinel-dashboard-prod \
    --member="serviceAccount:github-actions@sentinel-dashboard-prod.iam.gserviceaccount.com" \
    --role="roles/storage.admin"

gcloud projects add-iam-policy-binding sentinel-dashboard-prod \
    --member="serviceAccount:github-actions@sentinel-dashboard-prod.iam.gserviceaccount.com" \
    --role="roles/cloudbuild.builds.editor"

# Create key
gcloud iam service-accounts keys create github-actions-key.json \
    --iam-account=github-actions@sentinel-dashboard-prod.iam.gserviceaccount.com

# Add to GitHub Secrets (copy content of github-actions-key.json)
```

---

## 8. Security Best Practices

### 8.1 Authentication & Authorization

```python
# Already implemented in server.py:
# - JWT token authentication
# - Role-based access control (admin, team_lead, team_member)
# - Password hashing (SHA-256)

# Recommendations for production:
# 1. Use bcrypt instead of SHA-256 for passwords
# 2. Implement refresh tokens
# 3. Add rate limiting
# 4. Enable MFA for admin accounts
```

### 8.2 Network Security

```bash
# 1. Use VPC for Cloud Run
gcloud compute networks vpc-access connectors create sentinel-connector \
    --region us-central1 \
    --network default \
    --range 10.8.0.0/28

gcloud run services update sentinel-backend \
    --vpc-connector sentinel-connector \
    --vpc-egress all-traffic

# 2. Configure Cloud Armor (DDoS protection)
gcloud compute security-policies create sentinel-security-policy \
    --description "Security policy for Sentinel Dashboard"

gcloud compute security-policies rules create 1000 \
    --security-policy sentinel-security-policy \
    --expression "origin.region_code == 'CN'" \
    --action "deny-403" \
    --description "Block traffic from specific regions"
```

### 8.3 Data Security

```bash
# 1. Enable encryption at rest (MongoDB Atlas)
# Already enabled by default

# 2. Enable audit logging
gcloud logging sinks create sentinel-audit-sink \
    bigquery.googleapis.com/projects/sentinel-dashboard-prod/datasets/audit_logs \
    --log-filter='resource.type="cloud_run_revision"'

# 3. Configure IAM properly
# Principle of least privilege
```

### 8.4 Secret Management

```bash
# Never commit secrets to git
# Use .gitignore:
.env
.env.local
.env.production
*.key
*.pem
secrets/

# Always use Secret Manager in production
```

---

## 9. Monitoring & Logging

### 9.1 Cloud Monitoring Setup

```bash
# Create uptime check
gcloud monitoring uptime-check-configs create sentinel-backend-uptime \
    --display-name="Sentinel Backend Health" \
    --resource-type=uptime-url \
    --monitored-resource="host=sentinel-backend-xxxxx-uc.a.run.app,project_id=sentinel-dashboard-prod" \
    --http-check-path="/api/" \
    --check-interval=60s
```

### 9.2 Alerting Policies

```bash
# Create alert for high error rate
gcloud alpha monitoring policies create \
    --display-name="High Error Rate Alert" \
    --condition-display-name="Error rate > 5%" \
    --condition-filter='resource.type="cloud_run_revision" AND metric.type="run.googleapis.com/request_count" AND metric.labels.response_code_class="5xx"' \
    --condition-threshold-value=0.05 \
    --condition-threshold-comparison=COMPARISON_GT \
    --notification-channels=<CHANNEL_ID>
```

### 9.3 Log-based Metrics

```bash
# Create metric for escalated alerts
gcloud logging metrics create escalated_alerts \
    --description="Count of escalated alerts" \
    --log-filter='jsonPayload.action="Alert Escalated"'
```

### 9.4 Dashboard

Create custom dashboard in Cloud Console:
1. Go to Monitoring → Dashboards
2. Create Dashboard
3. Add widgets:
   - Request count
   - Error rate
   - Latency (p50, p95, p99)
   - Active instances
   - Memory utilization

---

## 10. Scaling Considerations

### 10.1 Auto-scaling Configuration

```bash
# Cloud Run auto-scaling
gcloud run services update sentinel-backend \
    --min-instances 1 \
    --max-instances 100 \
    --concurrency 80 \
    --cpu-throttling
```

### 10.2 Database Scaling (MongoDB Atlas)

```
# Scaling options:
1. Vertical: Upgrade cluster tier (M10 → M20 → M30)
2. Horizontal: Enable sharding for large collections
3. Read replicas: Add secondary nodes for read-heavy workloads

# Recommended indexes:
db.alerts.createIndex({ "assigned_to": 1, "status": 1 })
db.alerts.createIndex({ "severity": 1, "timestamp": -1 })
db.offboarding.createIndex({ "managed_by": 1, "access_revoked": 1 })
db.credentials.createIndex({ "managed_by": 1, "status": 1 })
```

### 10.3 CDN and Caching

```bash
# Enable Cloud CDN
gcloud compute backend-services update sentinel-backend-service \
    --enable-cdn \
    --cache-mode=CACHE_ALL_STATIC

# Configure cache TTL
gcloud compute backend-services update sentinel-backend-service \
    --default-ttl=3600 \
    --max-ttl=86400
```

---

## 11. Cost Estimation

### Monthly Cost Breakdown (Estimated)

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| Cloud Run | 1 vCPU, 512MB, min 1 instance | ~$30-50 |
| Cloud Storage | 1GB frontend assets | ~$0.02 |
| Cloud CDN | 10GB egress | ~$0.85 |
| MongoDB Atlas | M10 cluster | ~$57 |
| Cloud Load Balancer | 1 forwarding rule | ~$18 |
| Secret Manager | 10 secrets, 10K accesses | ~$0.60 |
| **Total** | | **~$110-130/month** |

### Cost Optimization Tips

1. Use committed use discounts for Cloud Run
2. Start with M0 (free) MongoDB Atlas for development
3. Enable Cloud Storage lifecycle policies
4. Use regional (not multi-regional) resources
5. Set up budget alerts

```bash
# Create budget alert
gcloud billing budgets create \
    --billing-account=<BILLING_ACCOUNT_ID> \
    --display-name="Sentinel Monthly Budget" \
    --budget-amount=150USD \
    --threshold-rules-percent=50,80,100
```

---

## 12. Troubleshooting

### Common Issues

#### 1. Cloud Run Deployment Fails
```bash
# Check build logs
gcloud builds list --limit=5
gcloud builds log <BUILD_ID>

# Common fixes:
# - Check Dockerfile syntax
# - Ensure requirements.txt is complete
# - Verify port configuration (8080 for Cloud Run)
```

#### 2. MongoDB Connection Issues
```bash
# Test connection
python3 -c "from pymongo import MongoClient; c = MongoClient('mongodb+srv://...'); print(c.admin.command('ping'))"

# Common fixes:
# - Check IP whitelist in Atlas
# - Verify credentials
# - Check network connectivity (VPC peering)
```

#### 3. CORS Errors
```python
# Ensure CORS_ORIGINS is set correctly
# In server.py:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://dashboard.yourdomain.com"],  # Not "*" in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### 4. Email Not Sending
```bash
# Check email logs
curl -H "Authorization: Bearer <TOKEN>" \
    https://sentinel-backend-xxxxx-uc.a.run.app/api/dashboard/email-log

# Verify Resend API key
curl -X POST 'https://api.resend.com/emails' \
    -H 'Authorization: Bearer re_xxxxx' \
    -d '{"from":"test@yourdomain.com","to":["test@test.com"],"subject":"Test","html":"Test"}'
```

#### 5. Escalation Not Working
```bash
# Check Cloud Run logs
gcloud logging read 'resource.type="cloud_run_revision" AND textPayload:"escalat"' --limit=20

# Verify background task is running (check startup logs)
```

### Support Resources

- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [Resend Documentation](https://resend.com/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

---

## Quick Start Checklist

- [ ] Create GCP project and enable APIs
- [ ] Set up MongoDB Atlas cluster
- [ ] Create Resend account and verify domain
- [ ] Configure secrets in Secret Manager
- [ ] Deploy backend to Cloud Run
- [ ] Deploy frontend to Cloud Storage
- [ ] Set up custom domain with SSL
- [ ] Configure monitoring and alerts
- [ ] Set up CI/CD pipeline
- [ ] Test all functionality

---

**Document Version:** 1.0  
**Last Updated:** March 2026  
**Author:** Sentinel Dashboard Team
