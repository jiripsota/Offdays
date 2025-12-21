# Offdays Deployment Guide

## Quick Deploy

Deploy backend to Cloud Run with PostgreSQL:

```bash
cd backend
./deploy.sh
```

The script automatically:
1. Loads secrets from Google Secret Manager
2. Builds Docker image for AMD64 (Cloud Run)
3. Pushes to Google Container Registry
4. Deploys to Cloud Run with PostgreSQL connection

## Prerequisites

- **gcloud CLI** installed and authenticated
- **Docker Desktop** running
- **Google Cloud Project** `offdays` with enabled APIs
- **Secrets** stored in Secret Manager (see below)

## Secrets Setup

Required secrets in Google Secret Manager:

```bash
# Create secrets (one-time setup)
echo -n "your-db-password" | gcloud secrets create db-password --data-file=- --project=offdays
echo -n "your-secret-key" | gcloud secrets create app-secret-key --data-file=- --project=offdays
echo -n "your-client-id" | gcloud secrets create google-client-id --data-file=- --project=offdays
echo -n "your-client-secret" | gcloud secrets create google-client-secret --data-file=- --project=offdays
echo -n "your-fernet-key" | gcloud secrets create encryption-key --data-file=- --project=offdays
```

## Infrastructure

### Cloud SQL (PostgreSQL)
- **Instance**: `offdays-db`
- **Database**: `offdays`
- **User**: `offdays`
- **Region**: `europe-west1`

### Cloud Run
- **Service**: `offdays-backend`
- **URL**: `https://api.my.offdays.app`
- **Service Account**: `offdays-cloudrun@offdays.iam.gserviceaccount.com`

## Database Migrations

After deployment, run migrations:

```bash
# Connect to Cloud SQL via proxy
gcloud sql connect offdays-db --user=offdays --project=offdays

# Or run migrations via Cloud Run job (recommended)
gcloud run jobs create offdays-migrate \
  --image gcr.io/offdays/offdays-backend:latest \
  --command alembic \
  --args upgrade,head \
  --region europe-west1 \
  --project offdays

gcloud run jobs execute offdays-migrate --region europe-west1 --project offdays
```

## Monitoring

View logs:
```bash
gcloud run services logs read offdays-backend --region europe-west1 --project offdays
```

Check service status:
```bash
gcloud run services describe offdays-backend --region europe-west1 --project offdays
```

## Troubleshooting

**Docker not running:**
```bash
open -a Docker
```

**Secrets not found:**
```bash
gcloud secrets list --project=offdays
```

**Database connection issues:**
- Verify Cloud SQL instance is running
- Check service account has `roles/cloudsql.client`
- Verify `--add-cloudsql-instances` in deploy.sh

## Marketplace Configuration

For the app to be approved in Google Workspace Marketplace without rejection:

### 1. App Configuration
Go to **Google Cloud Console > Google Workspace Marketplace SDK > App Configuration**.

- [ ] **UNCHECK** "Google Workspace Add-on" (Sidebar).
  - *This removes the requirement for a manifest and sidebar integration.*
- [x] **CHECK** "Universal Navigation Extension".
  - *This enables the app launcher (waffle menu) icon.*

### 2. OAuth Scopes
Ensure these scopes are added in **Marketplace SDK** and **OAuth Consent Screen**:

**User Scopes (SSO):**
- `email` (`https://www.googleapis.com/auth/userinfo.email`)
- `profile` (`https://www.googleapis.com/auth/userinfo.profile`)
- `openid`

**Service Account Scopes:**
- `https://www.googleapis.com/auth/appsmarketplace.license` (For Licensing/Billing)
- `https://www.googleapis.com/auth/drive` (Optional: Only if using Google Drive storage adapter)
