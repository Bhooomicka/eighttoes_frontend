# Sentinel Dashboard - AWS Deployment Guide

## AWS Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AWS Cloud Infrastructure                          │
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   CloudFront │    │     ECS      │    │   DocumentDB │              │
│  │     (CDN)    │───▶│   Fargate    │───▶│  or MongoDB  │              │
│  │   + S3       │    │  (Backend)   │    │    Atlas     │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│         │                   │                                           │
│         │            ┌──────▼──────┐                                   │
│         │            │     ALB     │                                   │
│         │            │ (Load Bal.) │                                   │
│         │            └─────────────┘                                   │
│         │                   │                                           │
│  ┌──────▼──────┐    ┌──────▼──────┐    ┌──────────────┐              │
│  │    WAF      │    │   Cognito   │    │   Secrets    │              │
│  │ (Security)  │    │   (Auth)    │    │   Manager    │              │
│  └─────────────┘    └─────────────┘    └──────────────┘              │
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │  CloudWatch  │    │    SNS      │    │   EventBridge│              │
│  │ (Monitoring) │    │  (Alerts)   │    │  (Triggers)  │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [VPC and Network Setup](#2-vpc-and-network-setup)
3. [Database Setup (DocumentDB/MongoDB Atlas)](#3-database-setup)
4. [Backend Deployment (ECS Fargate)](#4-backend-deployment-ecs-fargate)
5. [Frontend Deployment (S3 + CloudFront)](#5-frontend-deployment-s3--cloudfront)
6. [Security Configuration](#6-security-configuration)
7. [CI/CD with AWS CodePipeline](#7-cicd-with-aws-codepipeline)
8. [Monitoring and Alerting](#8-monitoring-and-alerting)
9. [DevOps Integration](#9-devops-integration)
10. [Terraform Infrastructure](#10-terraform-infrastructure)
11. [Cost Optimization](#11-cost-optimization)

---

## 1. Prerequisites

### AWS CLI Setup
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure credentials
aws configure
# Enter: AWS Access Key ID, Secret Access Key, Region (us-east-1), Output format (json)

# Verify
aws sts get-caller-identity
```

### Required Tools
```bash
# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Terraform (for IaC)
wget https://releases.hashicorp.com/terraform/1.7.0/terraform_1.7.0_linux_amd64.zip
unzip terraform_1.7.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# eksctl (optional, for EKS)
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin
```

---

## 2. VPC and Network Setup

### Create VPC with CloudFormation
```yaml
# vpc-stack.yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: Sentinel Dashboard VPC

Parameters:
  Environment:
    Type: String
    Default: production

Resources:
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub sentinel-vpc-${Environment}

  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [0, !GetAZs '']
      CidrBlock: 10.0.1.0/24
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: sentinel-public-1

  PublicSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [1, !GetAZs '']
      CidrBlock: 10.0.2.0/24
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: sentinel-public-2

  PrivateSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [0, !GetAZs '']
      CidrBlock: 10.0.10.0/24
      Tags:
        - Key: Name
          Value: sentinel-private-1

  PrivateSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [1, !GetAZs '']
      CidrBlock: 10.0.11.0/24
      Tags:
        - Key: Name
          Value: sentinel-private-2

  InternetGateway:
    Type: AWS::EC2::InternetGateway

  AttachGateway:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref VPC
      InternetGatewayId: !Ref InternetGateway

  NATGateway:
    Type: AWS::EC2::NatGateway
    Properties:
      AllocationId: !GetAtt NATGatewayEIP.AllocationId
      SubnetId: !Ref PublicSubnet1

  NATGatewayEIP:
    Type: AWS::EC2::EIP
    Properties:
      Domain: vpc

Outputs:
  VpcId:
    Value: !Ref VPC
    Export:
      Name: !Sub ${Environment}-VpcId
  PublicSubnets:
    Value: !Join [',', [!Ref PublicSubnet1, !Ref PublicSubnet2]]
    Export:
      Name: !Sub ${Environment}-PublicSubnets
  PrivateSubnets:
    Value: !Join [',', [!Ref PrivateSubnet1, !Ref PrivateSubnet2]]
    Export:
      Name: !Sub ${Environment}-PrivateSubnets
```

Deploy:
```bash
aws cloudformation create-stack \
  --stack-name sentinel-vpc \
  --template-body file://vpc-stack.yaml \
  --parameters ParameterKey=Environment,ParameterValue=production
```

---

## 3. Database Setup

### Option A: Amazon DocumentDB (MongoDB-compatible)
```bash
# Create DocumentDB cluster
aws docdb create-db-cluster \
  --db-cluster-identifier sentinel-docdb \
  --engine docdb \
  --master-username sentinel_admin \
  --master-user-password <STRONG_PASSWORD> \
  --vpc-security-group-ids sg-xxxxxxxx \
  --db-subnet-group-name sentinel-db-subnet-group

# Create instance
aws docdb create-db-instance \
  --db-instance-identifier sentinel-docdb-instance \
  --db-instance-class db.r5.large \
  --engine docdb \
  --db-cluster-identifier sentinel-docdb
```

### Option B: MongoDB Atlas with AWS PrivateLink
```bash
# 1. Create MongoDB Atlas cluster in AWS region (us-east-1)
# 2. Enable AWS PrivateLink in Atlas
# 3. Create VPC Endpoint in AWS:

aws ec2 create-vpc-endpoint \
  --vpc-id vpc-xxxxxxxx \
  --service-name com.mongodb.atlas.us-east-1 \
  --vpc-endpoint-type Interface \
  --subnet-ids subnet-xxxxxxxx subnet-yyyyyyyy \
  --security-group-ids sg-xxxxxxxx
```

### Connection String Format
```
# DocumentDB
mongodb://sentinel_admin:<password>@sentinel-docdb.cluster-xxxxx.us-east-1.docdb.amazonaws.com:27017/?tls=true&tlsCAFile=global-bundle.pem&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false

# MongoDB Atlas with PrivateLink
mongodb+srv://sentinel_app:<password>@cluster0-pl-xxxxx.mongodb.net/sentinel_prod?retryWrites=true&w=majority
```

---

## 4. Backend Deployment (ECS Fargate)

### Create ECR Repository
```bash
aws ecr create-repository \
  --repository-name sentinel-backend \
  --image-scanning-configuration scanOnPush=true
```

### Dockerfile for AWS
```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# For DocumentDB TLS
RUN wget https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

# Copy application
COPY . .

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/ || exit 1

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"]
```

### Build and Push
```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

# Build and push
docker build -t sentinel-backend ./backend
docker tag sentinel-backend:latest <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/sentinel-backend:latest
docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/sentinel-backend:latest
```

### ECS Task Definition
```json
{
  "family": "sentinel-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/sentinelTaskRole",
  "containerDefinitions": [
    {
      "name": "sentinel-backend",
      "image": "<ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/sentinel-backend:latest",
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "DB_NAME", "value": "sentinel_prod"}
      ],
      "secrets": [
        {
          "name": "MONGO_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:<ACCOUNT_ID>:secret:sentinel/mongo-url"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:<ACCOUNT_ID>:secret:sentinel/jwt-secret"
        },
        {
          "name": "RESEND_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:<ACCOUNT_ID>:secret:sentinel/resend-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/sentinel-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8080/api/ || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

### Create ECS Service
```bash
# Create cluster
aws ecs create-cluster --cluster-name sentinel-cluster

# Register task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service with ALB
aws ecs create-service \
  --cluster sentinel-cluster \
  --service-name sentinel-backend \
  --task-definition sentinel-backend:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx,subnet-yyyyy],securityGroups=[sg-xxxxx],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:us-east-1:<ACCOUNT_ID>:targetgroup/sentinel-backend-tg/xxxxx,containerName=sentinel-backend,containerPort=8080"
```

---

## 5. Frontend Deployment (S3 + CloudFront)

### Create S3 Bucket
```bash
# Create bucket
aws s3 mb s3://sentinel-dashboard-frontend-prod --region us-east-1

# Enable static website hosting
aws s3 website s3://sentinel-dashboard-frontend-prod \
  --index-document index.html \
  --error-document index.html

# Bucket policy for CloudFront
cat > bucket-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontAccess",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::sentinel-dashboard-frontend-prod/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::<ACCOUNT_ID>:distribution/<DISTRIBUTION_ID>"
        }
      }
    }
  ]
}
EOF

aws s3api put-bucket-policy --bucket sentinel-dashboard-frontend-prod --policy file://bucket-policy.json
```

### Build and Deploy Frontend
```bash
cd frontend

# Set production environment
echo "REACT_APP_BACKEND_URL=https://api.sentinel-dashboard.com" > .env.production

# Build
yarn build

# Upload to S3
aws s3 sync build/ s3://sentinel-dashboard-frontend-prod/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id <DISTRIBUTION_ID> \
  --paths "/*"
```

### CloudFront Distribution
```bash
aws cloudfront create-distribution \
  --distribution-config '{
    "CallerReference": "sentinel-frontend-'$(date +%s)'",
    "Origins": {
      "Quantity": 1,
      "Items": [
        {
          "Id": "S3-sentinel-frontend",
          "DomainName": "sentinel-dashboard-frontend-prod.s3.amazonaws.com",
          "S3OriginConfig": {
            "OriginAccessIdentity": ""
          },
          "OriginAccessControlId": "<OAC_ID>"
        }
      ]
    },
    "DefaultCacheBehavior": {
      "TargetOriginId": "S3-sentinel-frontend",
      "ViewerProtocolPolicy": "redirect-to-https",
      "AllowedMethods": {
        "Quantity": 2,
        "Items": ["GET", "HEAD"]
      },
      "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
      "Compress": true
    },
    "DefaultRootObject": "index.html",
    "CustomErrorResponses": {
      "Quantity": 1,
      "Items": [
        {
          "ErrorCode": 404,
          "ResponsePagePath": "/index.html",
          "ResponseCode": "200",
          "ErrorCachingMinTTL": 300
        }
      ]
    },
    "Enabled": true,
    "PriceClass": "PriceClass_100",
    "ViewerCertificate": {
      "ACMCertificateArn": "<ACM_CERT_ARN>",
      "SSLSupportMethod": "sni-only",
      "MinimumProtocolVersion": "TLSv1.2_2021"
    }
  }'
```

---

## 6. Security Configuration

### AWS WAF Rules
```bash
# Create Web ACL
aws wafv2 create-web-acl \
  --name sentinel-waf \
  --scope CLOUDFRONT \
  --default-action Allow={} \
  --visibility-config SampledRequestsEnabled=true,CloudWatchMetricsEnabled=true,MetricName=sentinel-waf \
  --rules '[
    {
      "Name": "AWS-AWSManagedRulesCommonRuleSet",
      "Priority": 1,
      "Statement": {
        "ManagedRuleGroupStatement": {
          "VendorName": "AWS",
          "Name": "AWSManagedRulesCommonRuleSet"
        }
      },
      "OverrideAction": {"None": {}},
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "CommonRuleSet"
      }
    },
    {
      "Name": "RateLimit",
      "Priority": 2,
      "Statement": {
        "RateBasedStatement": {
          "Limit": 2000,
          "AggregateKeyType": "IP"
        }
      },
      "Action": {"Block": {}},
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "RateLimit"
      }
    }
  ]'
```

### Secrets Manager
```bash
# Store secrets
aws secretsmanager create-secret \
  --name sentinel/mongo-url \
  --secret-string "mongodb+srv://..."

aws secretsmanager create-secret \
  --name sentinel/jwt-secret \
  --secret-string "$(openssl rand -hex 32)"

aws secretsmanager create-secret \
  --name sentinel/resend-key \
  --secret-string "re_xxxxxxxxxxxxx"
```

### IAM Roles
```json
// sentinelTaskRole policy
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:<ACCOUNT_ID>:secret:sentinel/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "sns:Publish"
      ],
      "Resource": [
        "arn:aws:sns:us-east-1:<ACCOUNT_ID>:sentinel-alerts"
      ]
    }
  ]
}
```

---

## 7. CI/CD with AWS CodePipeline

### buildspec.yml for Backend
```yaml
version: 0.2

phases:
  pre_build:
    commands:
      - echo Logging in to Amazon ECR...
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com
      - REPOSITORY_URI=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/sentinel-backend
      - COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)
      - IMAGE_TAG=${COMMIT_HASH:=latest}
  build:
    commands:
      - echo Build started on `date`
      - cd backend
      - docker build -t $REPOSITORY_URI:latest .
      - docker tag $REPOSITORY_URI:latest $REPOSITORY_URI:$IMAGE_TAG
  post_build:
    commands:
      - echo Pushing Docker image...
      - docker push $REPOSITORY_URI:latest
      - docker push $REPOSITORY_URI:$IMAGE_TAG
      - echo Writing image definitions file...
      - printf '[{"name":"sentinel-backend","imageUri":"%s"}]' $REPOSITORY_URI:$IMAGE_TAG > imagedefinitions.json
artifacts:
  files: imagedefinitions.json
```

### CodePipeline CloudFormation
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: Sentinel CI/CD Pipeline

Resources:
  CodePipeline:
    Type: AWS::CodePipeline::Pipeline
    Properties:
      Name: sentinel-pipeline
      RoleArn: !GetAtt CodePipelineRole.Arn
      Stages:
        - Name: Source
          Actions:
            - Name: SourceAction
              ActionTypeId:
                Category: Source
                Owner: AWS
                Provider: CodeStarSourceConnection
                Version: '1'
              Configuration:
                ConnectionArn: !Ref GitHubConnection
                FullRepositoryId: "your-org/sentinel-dashboard"
                BranchName: main
              OutputArtifacts:
                - Name: SourceOutput
        - Name: Build
          Actions:
            - Name: BuildBackend
              ActionTypeId:
                Category: Build
                Owner: AWS
                Provider: CodeBuild
                Version: '1'
              Configuration:
                ProjectName: !Ref BackendBuildProject
              InputArtifacts:
                - Name: SourceOutput
              OutputArtifacts:
                - Name: BuildOutput
        - Name: Deploy
          Actions:
            - Name: DeployToECS
              ActionTypeId:
                Category: Deploy
                Owner: AWS
                Provider: ECS
                Version: '1'
              Configuration:
                ClusterName: sentinel-cluster
                ServiceName: sentinel-backend
              InputArtifacts:
                - Name: BuildOutput
```

---

## 8. Monitoring and Alerting

### CloudWatch Alarms
```bash
# High CPU alarm
aws cloudwatch put-metric-alarm \
  --alarm-name sentinel-high-cpu \
  --alarm-description "CPU utilization exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=ClusterName,Value=sentinel-cluster Name=ServiceName,Value=sentinel-backend \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:us-east-1:<ACCOUNT_ID>:sentinel-alerts

# Error rate alarm
aws cloudwatch put-metric-alarm \
  --alarm-name sentinel-error-rate \
  --alarm-description "5xx error rate exceeds 5%" \
  --metric-name HTTPCode_Target_5XX_Count \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 60 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=LoadBalancer,Value=app/sentinel-alb/xxxxx \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:us-east-1:<ACCOUNT_ID>:sentinel-alerts
```

### CloudWatch Dashboard
```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ECS", "CPUUtilization", "ClusterName", "sentinel-cluster", "ServiceName", "sentinel-backend"],
          [".", "MemoryUtilization", ".", ".", ".", "."]
        ],
        "title": "ECS Resource Utilization",
        "period": 300
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", "app/sentinel-alb/xxxxx"],
          [".", "HTTPCode_Target_2XX_Count", ".", "."],
          [".", "HTTPCode_Target_5XX_Count", ".", "."]
        ],
        "title": "ALB Request Metrics",
        "period": 60
      }
    }
  ]
}
```

---

## 9. DevOps Integration

### EventBridge Rules for Automation
```bash
# Trigger on ECS deployment
aws events put-rule \
  --name sentinel-deployment-trigger \
  --event-pattern '{
    "source": ["aws.ecs"],
    "detail-type": ["ECS Deployment State Change"],
    "detail": {
      "clusterArn": ["arn:aws:ecs:us-east-1:<ACCOUNT_ID>:cluster/sentinel-cluster"]
    }
  }'

# Connect to Lambda for notifications
aws events put-targets \
  --rule sentinel-deployment-trigger \
  --targets "Id"="1","Arn"="arn:aws:lambda:us-east-1:<ACCOUNT_ID>:function:sentinel-notify"
```

### SNS Topics for Alerts
```bash
# Create topic
aws sns create-topic --name sentinel-alerts

# Subscribe email
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:<ACCOUNT_ID>:sentinel-alerts \
  --protocol email \
  --notification-endpoint alerts@yourdomain.com

# Subscribe to Slack (via Lambda)
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:<ACCOUNT_ID>:sentinel-alerts \
  --protocol lambda \
  --notification-endpoint arn:aws:lambda:us-east-1:<ACCOUNT_ID>:function:slack-notifier
```

---

## 10. Terraform Infrastructure

### Main Terraform Configuration
```hcl
# main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket = "sentinel-terraform-state"
    key    = "prod/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
}

module "vpc" {
  source = "./modules/vpc"
  
  environment = var.environment
  vpc_cidr    = "10.0.0.0/16"
}

module "ecs" {
  source = "./modules/ecs"
  
  environment       = var.environment
  vpc_id            = module.vpc.vpc_id
  private_subnets   = module.vpc.private_subnets
  public_subnets    = module.vpc.public_subnets
  container_image   = var.backend_image
  desired_count     = var.ecs_desired_count
}

module "frontend" {
  source = "./modules/frontend"
  
  environment     = var.environment
  domain_name     = var.domain_name
  certificate_arn = var.acm_certificate_arn
}

module "monitoring" {
  source = "./modules/monitoring"
  
  environment    = var.environment
  ecs_cluster    = module.ecs.cluster_name
  ecs_service    = module.ecs.service_name
  alert_email    = var.alert_email
}
```

### Variables
```hcl
# variables.tf
variable "aws_region" {
  default = "us-east-1"
}

variable "environment" {
  default = "production"
}

variable "backend_image" {
  description = "ECR image URI for backend"
}

variable "ecs_desired_count" {
  default = 2
}

variable "domain_name" {
  description = "Domain name for the application"
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
}

variable "alert_email" {
  description = "Email for alerts"
}
```

### Deploy with Terraform
```bash
cd terraform

# Initialize
terraform init

# Plan
terraform plan -var-file=prod.tfvars

# Apply
terraform apply -var-file=prod.tfvars
```

---

## 11. Cost Optimization

### Estimated Monthly Costs

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| ECS Fargate | 2 tasks, 0.5 vCPU, 1GB | ~$30 |
| ALB | 1 load balancer | ~$22 |
| CloudFront | 50GB transfer | ~$4 |
| S3 | 1GB storage | ~$0.02 |
| DocumentDB | db.r5.large | ~$190 |
| MongoDB Atlas | M10 (alternative) | ~$57 |
| Secrets Manager | 5 secrets | ~$2 |
| CloudWatch | Logs + Metrics | ~$10 |
| WAF | Basic rules | ~$5 |
| **Total (DocumentDB)** | | **~$263/month** |
| **Total (Atlas)** | | **~$130/month** |

### Cost Saving Tips

1. **Use MongoDB Atlas** instead of DocumentDB for ~50% savings
2. **Reserved Capacity** for Fargate (up to 50% savings)
3. **S3 Intelligent-Tiering** for infrequent access
4. **CloudFront Price Class 100** (US/EU only)
5. **Spot instances** for dev/staging environments

---

## Quick Reference Commands

```bash
# Deploy backend
./scripts/deploy-backend.sh

# Deploy frontend
./scripts/deploy-frontend.sh

# View logs
aws logs tail /ecs/sentinel-backend --follow

# Scale service
aws ecs update-service --cluster sentinel-cluster --service sentinel-backend --desired-count 4

# Force new deployment
aws ecs update-service --cluster sentinel-cluster --service sentinel-backend --force-new-deployment

# Check service status
aws ecs describe-services --cluster sentinel-cluster --services sentinel-backend
```

---

**Document Version:** 1.0  
**Last Updated:** March 2026  
**Compatible with:** AWS, Terraform 1.7+
