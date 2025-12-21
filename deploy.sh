#!/bin/bash
set -euo pipefail

PROJECT_ID="vaultiqo"
REGION="europe-west1"
DB_INSTANCE_NAMPROJECT_ID="gcloud builds submit --tag "gcr.io/${PROJECT_ID}/offdays-migrate" backend/:latest"
BACKEND_IMAGE="gcr.io/${PROJECT_ID}/offdays-backend:latest"
FRONTEND_IMAGE="gcr.io/${PROJECT_ID}/offdays-frontend:latest"
CLOUDSQL_INSTANCE="${PROJECT_ID}:${REGION}:${DB_INSTANCE_NAME}"

echo "🔐 Loading secrets from Google Secret Manager..."
DB_PASSWORD="$(gcloud secrets versions access latest --secret="db-password" --project="${PROJECT_ID}")"

echo "🚀 Starting deployment for Vaultiqo..."

# Build DATABASE_URL once and reuse for migrations + backend deploy
DATABASE_URL="postgresql+psycopg://offdays:${DB_PASSWORD}@/offdays?host=/cloudsql/${CLOUDSQL_INSTANCE}"

if [[ "${DATABASE_URL}" == *"SECRET_KEY="* ]]; then
  echo "ERROR: DATABASE_URL unexpectedly contains SECRET_KEY. Aborting."
  exit 1
fi

# -------------------------
# Run Tests (Frontend & Backend)
# -------------------------
# Fail script if tests fail
echo "🧪 Running Tests..."

echo "   Running Backend Tests..."
(cd backend && source .venv/bin/activate && python -m pytest -q)

echo "   Running Frontend Tests..."
(cd frontend && npm run test -- --run --reporter=dot)

echo "✅ Tests passed! Proceeding with build..."

echo "📦 Building Backend..."
gcloud builds submit backend --tag "${BACKEND_IMAGE}"

echo "📦 Building Frontend..."
gcloud builds submit frontend \
  --config frontend/cloudbuild.yaml \
  --substitutions=_VITE_API_BASE_URL="https://api.my.vaultiqo.app"

# -------------------------
# Run Database Migrations (Cloud Run Job)
# -------------------------
echo "🐜 Creating/Updating Migration Job..."
gcloud run jobs deploy vaultiqo-migrate \
  --project "${PROJECT_ID}" \
  --image "${BACKEND_IMAGE}" \
  --region "${REGION}" \
  --command "alembic" \
  --args "upgrade,head" \
  --max-retries 0 \
  --set-cloudsql-instances "${PROJECT_ID}:${REGION}:${DB_INSTANCE_NAME}" \
  --set-env-vars "DATABASE_URL=${DATABASE_URL}" \
  --set-secrets "SECRET_KEY=app-secret-key:latest" \
  --set-secrets "ENCRYPTION_KEY=encryption-key:latest" \
  --wait

echo "🐜 Executing Migrations..."
gcloud run jobs execute vaultiqo-migrate \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --wait

# -------------------------
# Deploy Backend
# -------------------------
echo "🚢# Deploys the Offdays application to Google Cloud Run..."
gcloud run deploy vaultiqo-backend \
  --project "${PROJECT_ID}" \
  --image "${BACKEND_IMAGE}" \
  --region "${REGION}" \
  --allow-unauthenticated \
  --add-cloudsql-instances "${CLOUDSQL_INSTANCE}" \
  --set-env-vars "DATABASE_URL=${DATABASE_URL}" \
  --set-env-vars "GOOGLE_REDIRECT_URI=https://api.my.vaultiqo.app/auth/callback" \
  --set-env-vars "FRONTEND_URL=https://my.vaultiqo.app" \
  --set-secrets "GOOGLE_CLIENT_ID=google-client-id:latest" \
  --set-secrets "GOOGLE_CLIENT_SECRET=google-client-secret:latest" \
  --set-secrets "SECRET_KEY=app-secret-key:latest" \
  --set-secrets "ENCRYPTION_KEY=encryption-key:latest" \
  --service-account "vaultiqo-cloudrun@vaultiqo.iam.gserviceaccount.com"

# -------------------------
# Deploy Frontend
# -------------------------
echo "🚢 Deploying Frontend to Cloud Run..."
gcloud run deploy vaultiqo-frontend \
  --project "${PROJECT_ID}" \
  --image "${FRONTEND_IMAGE}" \
  --region "${REGION}" \
  --allow-unauthenticated

echo "✅ Deployment complete!"
echo "🌍 Map domains:"
echo "   - api.my.vaultiqo.app  → vaultiqo-backend"
echo "   - my.vaultiqo.app      → vaultiqo-frontend"