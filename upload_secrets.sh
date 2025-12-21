#!/bin/bash
set -e

PROJECT_ID="offdays"
SECRETS_FILE="secrets.json"

if [ ! -f "$SECRETS_FILE" ]; then
    echo "Error: $SECRETS_FILE not found!"
    exit 1
fi

echo "Using Project ID: $PROJECT_ID"
echo "Reading secrets from $SECRETS_FILE..."

# Function to get secret value from JSON using python
get_secret_value() {
    local key=$1
    python3 -c "import sys, json; print(json.load(open('$SECRETS_FILE')).get('$key', ''))"
}

# Function to safely create and add version
upload_secret() {
    local name=$1
    local value=$(get_secret_value "$name")
    
    if [ -z "$value" ]; then
        echo "⚠️  Warning: Secret '$name' not found in $SECRETS_FILE or is empty. Skipping."
        return
    fi
    
    echo "Processing $name..."
    # Create secret if it doesn't exist
    gcloud secrets create "$name" --project="$PROJECT_ID" --replication-policy="automatic" --quiet 2>/dev/null || true
    
    # Add new version
    echo -n "$value" | gcloud secrets versions add "$name" --project="$PROJECT_ID" --data-file=-
    echo "✅ $name updated"
}

# List of secrets to upload
# These match the keys in secrets.json
SECRETS=(
    "google-client-id"
    "google-client-secret"
    "app-secret-key"
    "encryption-key"
    "db-password"
)

# Uploads secrets from secrets.json to Google Secret Manager for Offdays.
for secret in "${SECRETS[@]}"; do
    upload_secret "$secret"
done

echo ""
echo "🎉 All secrets processed!"
