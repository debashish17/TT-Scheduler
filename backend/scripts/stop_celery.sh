#!/bin/bash
# Celery Worker Stop Script
# Gracefully stops all Celery workers and services

echo "Stopping TT-Scheduler Celery Workers..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Change to backend directory
cd "$(dirname "$0")/.."

# Function to stop a worker gracefully
stop_worker() {
    local pidfile=$1
    local name=$2

    if [ -f "$pidfile" ]; then
        pid=$(cat "$pidfile")
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${YELLOW}Stopping $name (PID: $pid)...${NC}"
            kill -TERM $pid

            # Wait for graceful shutdown (max 30 seconds)
            for i in {1..30}; do
                if ! ps -p $pid > /dev/null 2>&1; then
                    echo -e "${GREEN}✓ $name stopped${NC}"
                    rm -f "$pidfile"
                    return 0
                fi
                sleep 1
            done

            # Force kill if still running
            if ps -p $pid > /dev/null 2>&1; then
                echo -e "${RED}Force killing $name...${NC}"
                kill -9 $pid
                rm -f "$pidfile"
            fi
        else
            echo -e "${YELLOW}$name is not running (stale PID file)${NC}"
            rm -f "$pidfile"
        fi
    else
        echo -e "${YELLOW}$name PID file not found${NC}"
    fi
}

# Stop all workers
stop_worker "pids/celery_timetable.pid" "Timetable Worker"
stop_worker "pids/celery_dataproc.pid" "Data Processing Worker"
stop_worker "pids/celery_analytics.pid" "Analytics Worker"
stop_worker "pids/celery_notifications.pid" "Notifications Worker"
stop_worker "pids/celery_beat.pid" "Celery Beat"
stop_worker "pids/celery_flower.pid" "Flower Monitoring"

# Kill any remaining Celery processes
echo -e "${YELLOW}Checking for remaining Celery processes...${NC}"
remaining=$(pgrep -f "celery worker" | wc -l)
if [ $remaining -gt 0 ]; then
    echo -e "${RED}Found $remaining remaining Celery processes. Force killing...${NC}"
    pkill -9 -f "celery worker"
    pkill -9 -f "celery beat"
    pkill -9 -f "celery flower"
fi

# Clean up PID files
rm -f pids/celery_*.pid

echo ""
echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}All Celery Workers Stopped!${NC}"
echo -e "${GREEN}==================================${NC}"
echo ""

# Show remaining processes
running=$(pgrep -f "celery" | wc -l)
if [ $running -gt 0 ]; then
    echo -e "${YELLOW}Warning: $running Celery-related processes still running${NC}"
    echo "Use 'ps aux | grep celery' to investigate"
else
    echo -e "${GREEN}No Celery processes running${NC}"
fi