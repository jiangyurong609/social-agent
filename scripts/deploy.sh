#!/bin/bash
set -e

# Social Media Agent - Cloudflare Deployment Script
# Usage: ./scripts/deploy.sh [--skip-db] [--skip-migrations]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
SKIP_DB=false
SKIP_MIGRATIONS=false
for arg in "$@"; do
  case $arg in
    --skip-db) SKIP_DB=true ;;
    --skip-migrations) SKIP_MIGRATIONS=true ;;
  esac
done

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if wrangler is available
if ! command -v npx &> /dev/null; then
  log_error "npx not found. Please install Node.js and npm."
  exit 1
fi

echo ""
echo "========================================"
echo "  Social Media Agent - Cloudflare Deploy"
echo "========================================"
echo ""

# Step 1: Build all packages
log_info "Building all packages..."
cd "$ROOT_DIR"
pnpm build
log_success "Build completed"

# Step 2: Create D1 Database (if not skipped)
if [ "$SKIP_DB" = false ]; then
  log_info "Creating D1 database..."
  cd "$ROOT_DIR/apps/api-worker"

  # Check if database already exists
  DB_LIST=$(npx wrangler d1 list 2>/dev/null || echo "")
  if echo "$DB_LIST" | grep -q "social_agent_db"; then
    log_warn "Database 'social_agent_db' already exists"
    # Extract database ID
    DB_ID=$(echo "$DB_LIST" | grep "social_agent_db" | awk '{print $1}')
  else
    log_info "Creating new D1 database 'social_agent_db'..."
    DB_OUTPUT=$(npx wrangler d1 create social_agent_db 2>&1)
    echo "$DB_OUTPUT"
    DB_ID=$(echo "$DB_OUTPUT" | grep "database_id" | sed 's/.*database_id = "\([^"]*\)".*/\1/' | head -1)

    if [ -z "$DB_ID" ]; then
      log_error "Failed to extract database ID. Please create manually:"
      echo "  npx wrangler d1 create social_agent_db"
      echo "  Then update apps/api-worker/wrangler.toml with the database_id"
      exit 1
    fi
  fi

  log_success "Database ID: $DB_ID"

  # Update wrangler.toml with database ID
  if [ -n "$DB_ID" ]; then
    log_info "Updating wrangler.toml with database ID..."
    sed -i.bak "s/database_id = \"YOUR_D1_DATABASE_ID\"/database_id = \"$DB_ID\"/" wrangler.toml
    sed -i.bak "s/database_id = \"xxxx-xxxx\"/database_id = \"$DB_ID\"/" wrangler.toml
    rm -f wrangler.toml.bak
    log_success "wrangler.toml updated"
  fi
fi

# Step 3: Apply D1 Migrations (if not skipped)
if [ "$SKIP_MIGRATIONS" = false ]; then
  log_info "Applying D1 migrations to remote database..."
  cd "$ROOT_DIR/apps/api-worker"
  npx wrangler d1 execute social_agent_db --remote --file=src/db/migrations/0001_init.sql || {
    log_warn "Migrations may have already been applied or failed. Continuing..."
  }
  log_success "Migrations applied"
fi

# Step 4: Deploy API Worker
log_info "Deploying api-worker..."
cd "$ROOT_DIR/apps/api-worker"
API_DEPLOY_OUTPUT=$(npx wrangler deploy 2>&1)
echo "$API_DEPLOY_OUTPUT"
API_URL=$(echo "$API_DEPLOY_OUTPUT" | grep -oE "https://[a-zA-Z0-9.-]+\.workers\.dev" | head -1)
log_success "api-worker deployed: $API_URL"

# Step 5: Deploy Orchestrator Worker
log_info "Deploying orchestrator-worker..."
cd "$ROOT_DIR/apps/orchestrator-worker"
ORCH_DEPLOY_OUTPUT=$(npx wrangler deploy 2>&1)
echo "$ORCH_DEPLOY_OUTPUT"
ORCH_URL=$(echo "$ORCH_DEPLOY_OUTPUT" | grep -oE "https://[a-zA-Z0-9.-]+\.workers\.dev" | head -1)
log_success "orchestrator-worker deployed: $ORCH_URL"

# Step 6: Deploy Scheduler Worker
log_info "Deploying scheduler-worker..."
cd "$ROOT_DIR/apps/scheduler-worker"
SCHED_DEPLOY_OUTPUT=$(npx wrangler deploy 2>&1)
echo "$SCHED_DEPLOY_OUTPUT"
SCHED_URL=$(echo "$SCHED_DEPLOY_OUTPUT" | grep -oE "https://[a-zA-Z0-9.-]+\.workers\.dev" | head -1)
log_success "scheduler-worker deployed: $SCHED_URL"

# Step 7: Update environment variables
echo ""
log_info "Setting environment variables..."

if [ -n "$ORCH_URL" ]; then
  log_info "Setting ORCHESTRATOR_BASE in api-worker..."
  cd "$ROOT_DIR/apps/api-worker"
  echo "$ORCH_URL" | npx wrangler secret put ORCHESTRATOR_BASE 2>/dev/null || {
    log_warn "Could not set ORCHESTRATOR_BASE automatically. Set it manually:"
    echo "  cd apps/api-worker && echo '$ORCH_URL' | npx wrangler secret put ORCHESTRATOR_BASE"
  }
fi

if [ -n "$API_URL" ]; then
  log_info "Setting API_BASE in orchestrator-worker..."
  cd "$ROOT_DIR/apps/orchestrator-worker"
  echo "$API_URL" | npx wrangler secret put API_BASE 2>/dev/null || {
    log_warn "Could not set API_BASE automatically. Set it manually:"
    echo "  cd apps/orchestrator-worker && echo '$API_URL' | npx wrangler secret put API_BASE"
  }
fi

# Summary
echo ""
echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo ""
echo "Deployed Workers:"
echo "  API Worker:          ${API_URL:-'(check output above)'}"
echo "  Orchestrator Worker: ${ORCH_URL:-'(check output above)'}"
echo "  Scheduler Worker:    ${SCHED_URL:-'(check output above)'}"
echo ""
echo "Test the deployment:"
echo "  curl ${API_URL:-'<API_URL>'}/"
echo ""
echo "  curl -X POST ${API_URL:-'<API_URL>'}/runs \\"
echo "    -H 'content-type: application/json' \\"
echo "    -d '{\"graph\":{\"id\":\"test\",\"version\":\"1\",\"nodes\":[{\"id\":\"draft\",\"type\":\"draft_post\"}],\"edges\":[]},\"input\":{\"topic\":\"hello\"}}'"
echo ""
log_success "Done!"
