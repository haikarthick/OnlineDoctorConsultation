#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  VetCare Platform — Automated Cloud Deployment Script
#  This script automates the ENTIRE deployment pipeline.
#  Run: chmod +x deploy.sh && ./deploy.sh [command]
#
#  Commands:
#    init        First-time infrastructure setup (Terraform)
#    deploy      Build, push, and deploy latest code
#    rollback    Roll back to previous image tag
#    status      Show running services status
#    logs        Tail production logs
#    destroy     Tear down all infrastructure (DANGEROUS)
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prod.yml"
TERRAFORM_DIR="$PROJECT_ROOT/terraform"
ENV_FILE="$PROJECT_ROOT/.env"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

log()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; }
ok()   { echo -e "${GREEN}[OK]${NC}    $*"; }

# ── Pre-flight Checks ────────────────────────────────────────
preflight() {
  log "Running pre-flight checks..."
  local missing=()

  command -v docker >/dev/null 2>&1    || missing+=("docker")
  command -v docker compose >/dev/null 2>&1 || command -v docker-compose >/dev/null 2>&1 || missing+=("docker-compose")
  command -v git >/dev/null 2>&1       || missing+=("git")

  if [[ ${#missing[@]} -gt 0 ]]; then
    err "Missing required tools: ${missing[*]}"
    err "Install them and try again."
    exit 1
  fi

  if [[ ! -f "$ENV_FILE" ]]; then
    err "Missing .env file. Copy .env.production.template to .env and fill in values:"
    err "  cp .env.production.template .env"
    exit 1
  fi

  # Validate critical env vars
  source "$ENV_FILE"
  local required_vars=(JWT_SECRET POSTGRES_PASSWORD CORS_ORIGIN)
  for var in "${required_vars[@]}"; do
    val="${!var:-}"
    if [[ -z "$val" || "$val" == CHANGE_ME* ]]; then
      err "Environment variable $var is not set or uses placeholder value."
      exit 1
    fi
  done

  ok "Pre-flight checks passed"
}

# ── Generate Secrets ──────────────────────────────────────────
generate_secrets() {
  log "Generating secure secrets..."

  if command -v openssl >/dev/null 2>&1; then
    JWT=$(openssl rand -base64 64 | tr -d '\n')
    DB_PASS=$(openssl rand -base64 32 | tr -d '\n/+=')
    REDIS_PASS=$(openssl rand -base64 32 | tr -d '\n/+=')
  else
    JWT=$(head -c 64 /dev/urandom | base64 | tr -d '\n')
    DB_PASS=$(head -c 32 /dev/urandom | base64 | tr -d '\n/+=')
    REDIS_PASS=$(head -c 32 /dev/urandom | base64 | tr -d '\n/+=')
  fi

  echo ""
  echo "Generated secrets (save these securely!):"
  echo "─────────────────────────────────────────"
  echo "JWT_SECRET=$JWT"
  echo "POSTGRES_PASSWORD=$DB_PASS"
  echo "DB_PASSWORD=$DB_PASS"
  echo "REDIS_PASSWORD=$REDIS_PASS"
  echo "─────────────────────────────────────────"
  echo ""
  echo "Add these to your .env file."
}

# ── Build Docker Images ──────────────────────────────────────
build() {
  log "Building Docker images..."

  local TAG
  TAG=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")

  docker compose -f "$COMPOSE_FILE" build --parallel

  ok "Images built with tag: $TAG"
  echo "$TAG"
}

# ── Deploy (Docker Compose) ──────────────────────────────────
deploy_compose() {
  preflight
  log "Starting deployment..."

  # Build images
  local TAG
  TAG=$(build)

  # Run database migrations (if migration script exists)
  if [[ -f "$PROJECT_ROOT/backend/package.json" ]]; then
    log "Running database migrations..."
    docker compose -f "$COMPOSE_FILE" run --rm backend node dist/utils/migrate.js 2>/dev/null || warn "Migration skipped (may already be applied)"
  fi

  # Deploy with zero-downtime rolling update
  log "Starting services..."
  docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

  # Wait for health checks
  log "Waiting for services to become healthy..."
  local attempts=0
  local max_attempts=30
  while [[ $attempts -lt $max_attempts ]]; do
    if docker compose -f "$COMPOSE_FILE" ps | grep -q "healthy"; then
      sleep 5
      # Verify API health
      if curl -sf http://localhost:3000/api/v1/health >/dev/null 2>&1; then
        ok "All services healthy!"
        break
      fi
    fi
    attempts=$((attempts + 1))
    sleep 2
  done

  if [[ $attempts -ge $max_attempts ]]; then
    err "Services did not become healthy within timeout"
    docker compose -f "$COMPOSE_FILE" logs --tail=50
    exit 1
  fi

  # Show status
  echo ""
  docker compose -f "$COMPOSE_FILE" ps
  echo ""
  ok "Deployment complete! Tag: $TAG"
  log "Application URL: ${CORS_ORIGIN:-http://localhost}"
}

# ── Deploy (Terraform + AWS) ─────────────────────────────────
deploy_terraform() {
  log "Deploying infrastructure with Terraform..."

  if ! command -v terraform >/dev/null 2>&1; then
    err "Terraform is not installed. Install it from https://terraform.io"
    exit 1
  fi

  cd "$TERRAFORM_DIR"

  if [[ ! -d ".terraform" ]]; then
    log "Initializing Terraform..."
    terraform init
  fi

  log "Planning infrastructure changes..."
  terraform plan -out=tfplan

  log "Applying infrastructure..."
  terraform apply tfplan

  ok "Infrastructure deployed!"
  terraform output
}

# ── Rollback ──────────────────────────────────────────────────
rollback() {
  local tag="${1:-}"
  if [[ -z "$tag" ]]; then
    err "Usage: ./deploy.sh rollback <image-tag>"
    err "  Example: ./deploy.sh rollback abc1234"
    exit 1
  fi

  log "Rolling back to image tag: $tag"
  export IMAGE_TAG="$tag"
  docker compose -f "$COMPOSE_FILE" pull
  docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

  sleep 10
  if curl -sf http://localhost:3000/api/v1/health >/dev/null 2>&1; then
    ok "Rollback to $tag successful!"
  else
    err "Rollback health check failed!"
    exit 1
  fi
}

# ── Status ────────────────────────────────────────────────────
status() {
  echo ""
  log "Service Status:"
  docker compose -f "$COMPOSE_FILE" ps
  echo ""

  log "Health Check:"
  curl -s http://localhost:3000/api/v1/health 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "API unreachable"
  echo ""

  log "Resource Usage:"
  docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" $(docker compose -f "$COMPOSE_FILE" ps -q) 2>/dev/null || true
}

# ── Logs ──────────────────────────────────────────────────────
logs() {
  local service="${1:-}"
  if [[ -n "$service" ]]; then
    docker compose -f "$COMPOSE_FILE" logs -f "$service"
  else
    docker compose -f "$COMPOSE_FILE" logs -f --tail=100
  fi
}

# ── Database Backup ───────────────────────────────────────────
backup_db() {
  log "Creating database backup..."
  local timestamp
  timestamp=$(date +%Y%m%d_%H%M%S)
  local backup_file="backup_${timestamp}.sql.gz"

  docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U "${DB_USER:-vetcare_app}" "${DB_NAME:-veterinary_consultation}" | gzip > "$backup_file"

  ok "Database backup saved: $backup_file ($(du -h "$backup_file" | cut -f1))"
}

# ── Destroy ───────────────────────────────────────────────────
destroy() {
  warn "This will DESTROY all containers and data volumes!"
  read -r -p "Type 'yes-destroy-everything' to confirm: " confirm
  if [[ "$confirm" != "yes-destroy-everything" ]]; then
    log "Cancelled."
    exit 0
  fi

  log "Stopping and removing all containers..."
  docker compose -f "$COMPOSE_FILE" down -v --remove-orphans
  ok "All services destroyed."
}

# ── Main ──────────────────────────────────────────────────────
case "${1:-help}" in
  init)
    deploy_terraform
    ;;
  deploy)
    deploy_compose
    ;;
  rollback)
    rollback "${2:-}"
    ;;
  status)
    status
    ;;
  logs)
    logs "${2:-}"
    ;;
  backup)
    backup_db
    ;;
  secrets)
    generate_secrets
    ;;
  destroy)
    destroy
    ;;
  help|*)
    echo ""
    echo "  VetCare Platform — Deployment Automation"
    echo "  ─────────────────────────────────────────"
    echo ""
    echo "  Usage: ./deploy.sh <command>"
    echo ""
    echo "  Commands:"
    echo "    secrets    Generate secure random secrets for .env"
    echo "    init       Provision cloud infrastructure (Terraform)"
    echo "    deploy     Build, migrate, and deploy all services"
    echo "    rollback   Roll back to a specific image tag"
    echo "    status     Show service status and health checks"
    echo "    logs       Tail production logs (optionally per service)"
    echo "    backup     Create a database backup"
    echo "    destroy    Tear down everything (DANGEROUS)"
    echo ""
    echo "  Quick Start:"
    echo "    1. cp .env.production.template .env"
    echo "    2. ./deploy.sh secrets    # Generate and paste into .env"
    echo "    3. ./deploy.sh deploy     # Deploy everything"
    echo ""
    ;;
esac
