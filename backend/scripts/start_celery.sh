#!/bin/bash
# Celery Worker Startup Script
# Starts Celery workers for different task queues

# Exit on error
set -e

echo "Starting TT-Scheduler Celery Workers..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Redis is running
echo -e "${YELLOW}Checking Redis connection...${NC}"
if ! redis-cli ping > /dev/null 2>&1; then
    echo "Error: Redis is not running. Please start Redis first."
    echo "Run: redis-server"
    exit 1
fi
echo -e "${GREEN}✓ Redis is running${NC}"

# Set working directory
cd "$(dirname "$0")/.."

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
    echo -e "${GREEN}✓ Virtual environment activated${NC}"
elif [ -d ".venv" ]; then
    source .venv/bin/activate
    echo -e "${GREEN}✓ Virtual environment activated${NC}"
fi

# Export Python path
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Kill any existing Celery workers
echo -e "${YELLOW}Stopping any existing Celery workers...${NC}"
pkill -f "celery worker" || true
sleep 2

# Start Celery worker for timetable generation (high priority queue)
echo -e "${YELLOW}Starting Timetable Generation Worker...${NC}"
celery -A app.celery_app worker \
    --loglevel=info \
    --queues=timetable_generation \
    --concurrency=2 \
    --pool=prefork \
    --max-tasks-per-child=50 \
    --time-limit=3600 \
    --soft-time-limit=3300 \
    --hostname=timetable@%h \
    --logfile=logs/celery_timetable.log \
    --pidfile=pids/celery_timetable.pid \
    --detach

sleep 1
echo -e "${GREEN}✓ Timetable Generation Worker started${NC}"

# Start Celery worker for data processing
echo -e "${YELLOW}Starting Data Processing Worker...${NC}"
celery -A app.celery_app worker \
    --loglevel=info \
    --queues=data_processing \
    --concurrency=4 \
    --pool=prefork \
    --max-tasks-per-child=100 \
    --time-limit=1800 \
    --soft-time-limit=1650 \
    --hostname=dataproc@%h \
    --logfile=logs/celery_dataproc.log \
    --pidfile=pids/celery_dataproc.pid \
    --detach

sleep 1
echo -e "${GREEN}✓ Data Processing Worker started${NC}"

# Start Celery worker for analytics
echo -e "${YELLOW}Starting Analytics Worker...${NC}"
celery -A app.celery_app worker \
    --loglevel=info \
    --queues=analytics \
    --concurrency=2 \
    --pool=prefork \
    --max-tasks-per-child=50 \
    --time-limit=1800 \
    --soft-time-limit=1650 \
    --hostname=analytics@%h \
    --logfile=logs/celery_analytics.log \
    --pidfile=pids/celery_analytics.pid \
    --detach

sleep 1
echo -e "${GREEN}✓ Analytics Worker started${NC}"

# Start Celery worker for notifications
echo -e "${YELLOW}Starting Notifications Worker...${NC}"
celery -A app.celery_app worker \
    --loglevel=info \
    --queues=notifications \
    --concurrency=4 \
    --pool=prefork \
    --max-tasks-per-child=200 \
    --time-limit=300 \
    --soft-time-limit=270 \
    --hostname=notifications@%h \
    --logfile=logs/celery_notifications.log \
    --pidfile=pids/celery_notifications.pid \
    --detach

sleep 1
echo -e "${GREEN}✓ Notifications Worker started${NC}"

# Start Celery Beat for scheduled tasks (optional)
echo -e "${YELLOW}Starting Celery Beat Scheduler...${NC}"
celery -A app.celery_app beat \
    --loglevel=info \
    --logfile=logs/celery_beat.log \
    --pidfile=pids/celery_beat.pid \
    --detach

sleep 1
echo -e "${GREEN}✓ Celery Beat Scheduler started${NC}"

# Display worker status
echo ""
echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}All Celery Workers Started!${NC}"
echo -e "${GREEN}==================================${NC}"
echo ""

# Show active workers
echo "Active Workers:"
celery -A app.celery_app inspect active_queues

echo ""
echo "To monitor workers, run:"
echo "  celery -A app.celery_app flower          # Web-based monitoring"
echo "  celery -A app.celery_app inspect active  # CLI monitoring"
echo ""
echo "To stop all workers, run:"
echo "  ./scripts/stop_celery.sh"
echo ""

# Start Flower monitoring (optional)
read -p "Start Flower web monitoring? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Starting Flower...${NC}"
    celery -A app.celery_app flower \
        --port=5555 \
        --broker=redis://localhost:6379/0 \
        --logfile=logs/celery_flower.log \
        --pidfile=pids/celery_flower.pid \
        --detach

    sleep 2
    echo -e "${GREEN}✓ Flower started at http://localhost:5555${NC}"
fi

echo ""
echo -e "${GREEN}Setup complete! Workers are running in the background.${NC}"