#!/bin/bash

##############################################################################
# Label Studio Custom Integration Tests Runner
##############################################################################
#
# 이 스크립트는 로컬 Docker 컨테이너를 대상으로 통합 테스트를 실행합니다.
#
# 사용법:
#   ./run-tests.sh                  # 기본 테스트 실행
#   ./run-tests.sh --verbose        # 상세 출력
#   ./run-tests.sh --watch          # Watch 모드
#
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Label Studio Custom - Integration Tests                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Load environment variables
if [ -f "../.env" ]; then
    echo -e "${BLUE}→${NC} Loading environment variables from ../.env"
    set -a
    source ../.env 2>/dev/null || true
    set +a
fi

# Set default values
export LABEL_STUDIO_URL="${LABEL_STUDIO_URL:-http://localhost:8080}"
export LABEL_STUDIO_API_TOKEN="${LABEL_STUDIO_API_TOKEN:-2c00d45b8318a11f59e04c7233d729f3f17664e8}"

echo -e "${BLUE}→${NC} Target: ${LABEL_STUDIO_URL}"
echo ""

# Check if Label Studio is running
echo -e "${BLUE}→${NC} Checking Label Studio availability..."
if ! curl -s -f "${LABEL_STUDIO_URL}/health" > /dev/null 2>&1; then
    echo -e "${RED}✗${NC} Label Studio is not accessible at ${LABEL_STUDIO_URL}"
    echo -e "${YELLOW}ℹ${NC} Please ensure Docker containers are running:"
    echo ""
    echo "  cd .."
    echo "  docker compose up -d"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓${NC} Label Studio is running"
echo ""

# Check Node.js version
echo -e "${BLUE}→${NC} Checking Node.js version..."
NODE_VERSION=$(node --version)
echo -e "${GREEN}✓${NC} Node.js ${NODE_VERSION}"
echo ""

# Run tests based on arguments
MODE="test"
if [ "$1" == "--verbose" ]; then
    MODE="test:verbose"
elif [ "$1" == "--watch" ]; then
    MODE="test:watch"
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Running Tests...                                              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Run tests
npm run "$MODE"

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✓ All tests passed!                                          ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ✗ Tests failed                                                ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
fi

exit $EXIT_CODE
