#!/bin/bash
set -e

# Social Media Agent - Local Development Script
# Usage: ./scripts/dev.sh [api|orchestrator|scheduler|all]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Default ports
API_PORT=8787
ORCH_PORT=8788
SCHED_PORT=8789

MODE="${1:-all}"

setup_local_db() {
  log_info "Setting up local D1 database..."
  cd "$ROOT_DIR/apps/api-worker"
  npx wrangler d1 execute social_agent_db --local --file=src/db/migrations/0001_init.sql 2>/dev/null || true
  log_success "Local database ready"
}

start_api() {
  log_info "Starting api-worker on port $API_PORT..."
  cd "$ROOT_DIR/apps/api-worker"
  npx wrangler dev src/index.ts --port $API_PORT \
    --var ORCHESTRATOR_BASE:http://127.0.0.1:$ORCH_PORT &
  echo $! > /tmp/social-agent-api.pid
}

start_orchestrator() {
  log_info "Starting orchestrator-worker on port $ORCH_PORT..."
  cd "$ROOT_DIR/apps/orchestrator-worker"
  npx wrangler dev src/index.ts --port $ORCH_PORT \
    --var API_BASE:http://127.0.0.1:$API_PORT &
  echo $! > /tmp/social-agent-orchestrator.pid
}

start_scheduler() {
  log_info "Starting scheduler-worker on port $SCHED_PORT..."
  cd "$ROOT_DIR/apps/scheduler-worker"
  npx wrangler dev src/index.ts --port $SCHED_PORT &
  echo $! > /tmp/social-agent-scheduler.pid
}

stop_all() {
  log_info "Stopping all workers..."
  for pid_file in /tmp/social-agent-*.pid; do
    if [ -f "$pid_file" ]; then
      pid=$(cat "$pid_file")
      kill "$pid" 2>/dev/null || true
      rm -f "$pid_file"
    fi
  done
  # Also kill any wrangler dev processes
  pkill -f "wrangler dev" 2>/dev/null || true
  log_success "All workers stopped"
}

show_help() {
  echo "Social Media Agent - Local Development"
  echo ""
  echo "Usage: ./scripts/dev.sh [command]"
  echo ""
  echo "Commands:"
  echo "  all          Start all workers (default)"
  echo "  api          Start only api-worker"
  echo "  orchestrator Start only orchestrator-worker"
  echo "  scheduler    Start only scheduler-worker"
  echo "  stop         Stop all running workers"
  echo "  help         Show this help"
  echo ""
  echo "Ports:"
  echo "  api-worker:          http://localhost:$API_PORT"
  echo "  orchestrator-worker: http://localhost:$ORCH_PORT"
  echo "  scheduler-worker:    http://localhost:$SCHED_PORT"
  echo ""
  echo "Test command:"
  echo '  curl -X POST http://localhost:8787/runs \'
  echo '    -H "content-type: application/json" \'
  echo '    -d '\''{"graph":{"id":"test","version":"1","nodes":[{"id":"draft","type":"draft_post"}],"edges":[]},"input":{"topic":"hello"}}'\'''
}

case "$MODE" in
  api)
    setup_local_db
    start_api
    wait
    ;;
  orchestrator)
    start_orchestrator
    wait
    ;;
  scheduler)
    start_scheduler
    wait
    ;;
  all)
    setup_local_db
    start_api
    sleep 2
    start_orchestrator
    sleep 2
    start_scheduler
    echo ""
    log_success "All workers started!"
    echo ""
    echo "Workers running:"
    echo "  api-worker:          http://localhost:$API_PORT"
    echo "  orchestrator-worker: http://localhost:$ORCH_PORT"
    echo "  scheduler-worker:    http://localhost:$SCHED_PORT"
    echo ""
    echo "Press Ctrl+C to stop all workers"
    wait
    ;;
  stop)
    stop_all
    ;;
  help|--help|-h)
    show_help
    ;;
  *)
    log_error "Unknown command: $MODE"
    show_help
    exit 1
    ;;
esac
