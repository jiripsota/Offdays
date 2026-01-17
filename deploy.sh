#!/bin/bash
set -euo pipefail

# --- Configuration ---
PROJECT_ID="vaultiqo"
REGION="europe-west1"
# Change this to your actual Cloud SQL instance name
DB_INSTANCE_NAME="offdays-db" 

BACKEND_IMAGE="gcr.io/${PROJECT_ID}/offdays-backend:latest"
FRONTEND_IMAGE="gcr.io/${PROJECT_ID}/offdays-frontend:latest"
CLOUDSQL_INSTANCE="${PROJECT_ID}:${REGION}:${DB_INSTANCE_NAME}"

# Frontend Domain Configuration
FRONTEND_URL="https://app.offdays.cz"
API_BASE_URL="https://api.app.offdays.cz"

echo "🔐 Loading database password from Google Secret Manager..."
DB_PASSWORD="$(gcloud secrets versions access latest --secret="db-password" --project="${PROJECT_ID}")"

# Connection string for PostgreSQL (Unix socket for Cloud Run)
DATABASE_URL="postgresql+psycopg://offdays:${DB_PASSWORD}@/offdays?host=/cloudsql/${CLOUDSQL_INSTANCE}"

echo "🚀 Starting deployment for Offdays on project: ${PROJECT_ID}"

# -------------------------
# 1. Build & Push Backend
# -------------------------
echo "📦 Building Backend Image..."
gcloud builds submit backend --tag "${BACKEND_IMAGE}" --project "${PROJECT_ID}"

# -------------------------
# 2. Run Database Migrations
# -------------------------
# We use a Cloud Run Job for one-off migrations
echo "🐜 Creating/Updating Migration Job..."
gcloud run jobs deploy offdays-migrate \
  --project "${PROJECT_ID}" \
  --image "${BACKEND_IMAGE}" \
  --region "${REGION}" \
  --command "alembic" \
  --args "upgrade,head" \
  --max-retries 0 \
  --set-cloudsql-instances "${CLOUDSQL_INSTANCE}" \
  --set-env-vars "DATABASE_URL=${DATABASE_URL}" \
  --set-secrets "SECRET_KEY=app-secret-key:latest" \
  --wait

echo "🐜 Executing Migrations..."
gcloud run jobs execute offdays-migrate \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --wait

# -------------------------
# 3. Build & Push Frontend
# -------------------------
echo "📦 Building Frontend Image..."
# We pass the API URL as a build argument so Vite can bake it into the static files
gcloud builds submit frontend \
  --project "${PROJECT_ID}" \
  --config frontend/cloudbuild.yaml \
  --substitutions=_VITE_API_BASE_URL="${API_BASE_URL}"

# -------------------------
# 4. Deploy Backend Service
# -------------------------
echo "🚢 Deploying Backend to Cloud Run..."
gcloud run deploy offdays-backend \
  --project "${PROJECT_ID}" \
  --image "${BACKEND_IMAGE}" \
  --region "${REGION}" \
  --allow-unauthenticated \
  --add-cloudsql-instances "${CLOUDSQL_INSTANCE}" \
  --set-env-vars "DATABASE_URL=${DATABASE_URL}" \
  --set-env-vars "GOOGLE_REDIRECT_URI=${API_BASE_URL}/auth/callback" \
  --set-env-vars "FRONTEND_URL=${FRONTEND_URL}" \
  --set-env-vars "COOKIE_SECURE=true" \
  --set-secrets "GOOGLE_CLIENT_ID=google-client-id:latest" \
  --set-secrets "GOOGLE_CLIENT_SECRET=google-client-secret:latest" \
  --set-secrets "SECRET_KEY=app-secret-key:latest" \
  --set-secrets "SMTP_PASSWORD=smtp-password:latest" \
  --service-account "vaultiqo-cloudrun@${PROJECT_ID}.iam.gserviceaccount.com"

# -------------------------
# 5. Deploy Frontend Service
# -------------------------
echo "🚢 Deploying Frontend to Cloud Run..."
gcloud run deploy offdays-frontend \
  --project "${PROJECT_ID}" \
  --image "${FRONTEND_IMAGE}" \
  --region "${REGION}" \
  --allow-unauthenticated

echo "✅ Deployment complete!"
echo "🌍 Service URLs (ensure domain mapping is configured):"
echo "   - Backend: ${API_BASE_URL}"
echo "   - Frontend: ${FRONTEND_URL}"