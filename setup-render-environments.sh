#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# setup-render-environments.sh
# ─────────────────────────────────────────────────────────────
# Creates 1 free PostgreSQL database + 2 web services (DEV + PROD)
# on Render.com using the REST API.
#
# Both services share ONE database with schema-based separation:
#   DEV  → vetcare-dev  → schema: vetcare_dev
#   PROD → vetcare-app  → schema: vetcare_prod
#
# Prerequisites:
#   1. Create a Render API key at https://dashboard.render.com/u/settings#api-keys
#   2. Run: export RENDER_API_KEY="rnd_xxxxx"
#   3. Run: bash setup-render-environments.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

API="https://api.render.com/v1"
REPO_URL="https://github.com/haikarthick/OnlineDoctorConsultation"

# ── Validate API key ──────────────────────────────────────────
if [ -z "${RENDER_API_KEY:-}" ]; then
  echo "══════════════════════════════════════════════════════════"
  echo "  RENDER_API_KEY not set!"
  echo ""
  echo "  1. Go to https://dashboard.render.com/u/settings#api-keys"
  echo "  2. Create an API key"
  echo "  3. Run:"
  echo "     export RENDER_API_KEY=\"rnd_xxxxx\""
  echo "     bash setup-render-environments.sh"
  echo "══════════════════════════════════════════════════════════"
  exit 1
fi

AUTH="Authorization: Bearer ${RENDER_API_KEY}"

# ── Helper: Render API call ───────────────────────────────────
render_api() {
  local method=$1 endpoint=$2 body=${3:-}
  if [ -n "$body" ]; then
    curl -sf -X "$method" "${API}${endpoint}" \
      -H "$AUTH" -H "Content-Type: application/json" \
      -d "$body"
  else
    curl -sf -X "$method" "${API}${endpoint}" -H "$AUTH"
  fi
}

# ── Check API connectivity ────────────────────────────────────
echo "Verifying Render API key..."
if ! render_api GET "/owners" > /dev/null 2>&1; then
  echo "Invalid API key or API unreachable"
  exit 1
fi
OWNER_ID=$(render_api GET "/owners" | python3 -c "import sys,json; owners=json.load(sys.stdin); print(owners[0]['owner']['id'])" 2>/dev/null || echo "")
echo "Authenticated (owner: ${OWNER_ID:-unknown})"

# ── Environment definitions ──────────────────────────────────
declare -A ENV_BRANCH=( [dev]=develop [prod]=main )
declare -A ENV_NODE=( [dev]=development [prod]=production )
declare -A ENV_SEED=( [dev]=true [prod]=false )
declare -A ENV_SCHEMA=( [dev]=vetcare_dev [prod]=vetcare_prod )
declare -A SVC_NAME=( [dev]=vetcare-dev [prod]=vetcare-app )

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  VetCare - Free-Tier Render Setup (1 DB + 2 Services)"
echo "══════════════════════════════════════════════════════════"
echo ""

# ── Find or create database ──────────────────────────────────
echo "━━━ Creating Database ━━━"
EXISTING_PG=$(render_api GET "/postgres" 2>/dev/null || echo "[]")
DB_NAME="vetcare-db"
echo -n "  $DB_NAME ... "

EXISTING_ID=$(echo "$EXISTING_PG" | python3 -c "
import sys, json
for pg in json.load(sys.stdin):
  if pg.get('postgres',{}).get('name') == '$DB_NAME':
    print(pg['postgres']['id'])
    break
" 2>/dev/null || echo "")

if [ -n "$EXISTING_ID" ]; then
  echo "exists ($EXISTING_ID)"
  DB_ID="$EXISTING_ID"
else
  RESULT=$(render_api POST "/postgres" "{
    \"name\": \"$DB_NAME\",
    \"databaseName\": \"vetcare\",
    \"databaseUser\": \"vetcare\",
    \"plan\": \"free\",
    \"region\": \"oregon\",
    \"version\": \"16\"
  }")
  DB_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['postgres']['id'])")
  echo "created ($DB_ID)"
fi

echo ""
echo "━━━ Waiting for database to be available ━━━"
echo -n "  $DB_NAME ... "
for i in $(seq 1 30); do
  STATUS=$(render_api GET "/postgres/${DB_ID}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "pending")
  if [ "$STATUS" = "available" ] || [ "$STATUS" = "running" ]; then
    break
  fi
  sleep 5
done
CONN_INFO=$(render_api GET "/postgres/${DB_ID}/connection-info" 2>/dev/null || echo "{}")
INTERNAL_CONN=$(echo "$CONN_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('internalConnectionString',''))" 2>/dev/null || echo "")
EXTERNAL_CONN=$(echo "$CONN_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('externalConnectionString',''))" 2>/dev/null || echo "")
DB_CONN_STRING="${INTERNAL_CONN:-$EXTERNAL_CONN}"
echo "ready"

# ── Find or create web services ──────────────────────────────
declare -A SVC_ID
declare -A DEPLOY_HOOKS

echo ""
echo "━━━ Creating Web Services ━━━"
EXISTING_SVCS=$(render_api GET "/services?type=web_service&limit=50" 2>/dev/null || echo "[]")

for ENV in dev prod; do
  NAME="${SVC_NAME[$ENV]}"
  echo -n "  $NAME (branch: ${ENV_BRANCH[$ENV]}) ... "

  EXISTING_SVC_ID=$(echo "$EXISTING_SVCS" | python3 -c "
import sys, json
for svc in json.load(sys.stdin):
  if svc.get('service',{}).get('name') == '$NAME':
    print(svc['service']['id'])
    break
" 2>/dev/null || echo "")

  if [ -n "$EXISTING_SVC_ID" ]; then
    echo "exists ($EXISTING_SVC_ID)"
    SVC_ID[$ENV]="$EXISTING_SVC_ID"
  else
    RESULT=$(render_api POST "/services" "{
      \"type\": \"web_service\",
      \"name\": \"$NAME\",
      \"repo\": \"$REPO_URL\",
      \"branch\": \"${ENV_BRANCH[$ENV]}\",
      \"plan\": \"free\",
      \"runtime\": \"node\",
      \"region\": \"oregon\",
      \"buildCommand\": \"chmod +x render-build.sh && ./render-build.sh\",
      \"startCommand\": \"chmod +x render-start.sh && ./render-start.sh\",
      \"envVars\": [
        {\"key\": \"DATABASE_URL\", \"value\": \"${DB_CONN_STRING}\"},
        {\"key\": \"DB_SCHEMA\", \"value\": \"${ENV_SCHEMA[$ENV]}\"},
        {\"key\": \"NODE_ENV\", \"value\": \"${ENV_NODE[$ENV]}\"},
        {\"key\": \"SEED_ON_STARTUP\", \"value\": \"${ENV_SEED[$ENV]}\"}
      ],
      \"autoDeploy\": \"yes\"
    }")
    CREATED_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['service']['id'])")
    echo "created ($CREATED_ID)"
    SVC_ID[$ENV]="$CREATED_ID"
  fi

  # Get deploy hook
  SVC_DETAILS=$(render_api GET "/services/${SVC_ID[$ENV]}" 2>/dev/null || echo "{}")
  HOOK=$(echo "$SVC_DETAILS" | python3 -c "import sys,json; svc=json.load(sys.stdin); print(svc.get('deployHookUrl', svc.get('service',{}).get('deployHookUrl','')))" 2>/dev/null || echo "")
  DEPLOY_HOOKS[$ENV]="$HOOK"
done

# ── Summary ──────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════"
echo "  ALL RESOURCES CREATED!"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "┌──────────┬──────────────────────┬──────────────┬──────────────────┐"
echo "│ Env      │ Service              │ Branch       │ DB Schema        │"
echo "├──────────┼──────────────────────┼──────────────┼──────────────────┤"
for ENV in dev prod; do
  printf "│ %-8s │ %-20s │ %-12s │ %-16s │\n" "$ENV" "${SVC_NAME[$ENV]}" "${ENV_BRANCH[$ENV]}" "${ENV_SCHEMA[$ENV]}"
done
echo "└──────────┴──────────────────────┴──────────────┴──────────────────┘"

echo ""
echo "━━━ Deploy Hook URLs ━━━"
echo "Add these as GitHub Secrets (repo Settings > Secrets > Actions):"
echo ""
for ENV in dev prod; do
  SECRET_NAME="RENDER_DEPLOY_HOOK_$(echo $ENV | tr a-z A-Z)"
  echo "  $SECRET_NAME"
  echo "    ${DEPLOY_HOOKS[$ENV]}"
  echo ""
done

echo "━━━ Service URLs ━━━"
for ENV in dev prod; do
  echo "  ${SVC_NAME[$ENV]}: https://${SVC_NAME[$ENV]}.onrender.com"
done
echo ""
if command -v gh &> /dev/null; then
  echo ""
  read -p "🔧 Set GitHub secrets automatically using 'gh' CLI? (y/n): " -r REPLY
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    for ENV in dev test demo prod; do
      SECRET_NAME="RENDER_DEPLOY_HOOK_$(echo $ENV | tr a-z A-Z)"
      if [ "$ENV" = "prod" ]; then SECRET_NAME="RENDER_DEPLOY_HOOK_PROD"; fi
      gh secret set "$SECRET_NAME" --body "${DEPLOY_HOOKS[$ENV]}"
      echo "  ✅ $SECRET_NAME → set"
    done
    echo ""
    echo "✅ All GitHub secrets configured!"
  fi
else
  echo "💡 Tip: Install GitHub CLI (gh) to auto-set secrets:"
  echo "   https://cli.github.com/"
fi

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  Setup complete! Push to 'develop' to deploy to DEV."
echo "══════════════════════════════════════════════════════════"
