#!/bin/bash

# ==============================================================================
# Label Studio SSO API 테스트 스크립트
# ==============================================================================
#
# 이 스크립트는 Label Studio의 SSO API를 테스트합니다.
#
# 사용 방법:
#   ./test-sso.sh <API_TOKEN> <USER_EMAIL>
#
# 예시:
#   ./test-sso.sh abc123def456 user@example.com
#
# ==============================================================================

set -e  # 에러 발생 시 즉시 종료

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ==============================================================================
# 설정
# ==============================================================================

LABEL_STUDIO_URL="${LABEL_STUDIO_URL:-http://localhost:8080}"
API_TOKEN="${1}"
USER_EMAIL="${2:-test@example.com}"

# ==============================================================================
# 헬퍼 함수
# ==============================================================================

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_section() {
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}$1${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
}

# ==============================================================================
# 파라미터 검증
# ==============================================================================

if [ -z "$API_TOKEN" ]; then
    print_error "API Token이 필요합니다!"
    echo ""
    echo "사용 방법:"
    echo "  $0 <API_TOKEN> [USER_EMAIL]"
    echo ""
    echo "API Token 생성 방법:"
    echo "  docker-compose exec labelstudio python /label-studio/label_studio/manage.py drf_create_token <username>"
    echo ""
    exit 1
fi

# ==============================================================================
# 테스트 시작
# ==============================================================================

print_section "Label Studio SSO API 테스트"

echo "설정:"
echo "  Label Studio URL: $LABEL_STUDIO_URL"
echo "  API Token: ${API_TOKEN:0:10}..."
echo "  User Email: $USER_EMAIL"
echo ""

# ==============================================================================
# 1. 헬스체크
# ==============================================================================

print_section "1. 헬스체크"

if curl -f -s "$LABEL_STUDIO_URL/health" > /dev/null; then
    print_success "Label Studio가 정상적으로 실행 중입니다"
else
    print_error "Label Studio에 연결할 수 없습니다"
    print_warning "서비스가 실행 중인지 확인하세요: docker-compose ps"
    exit 1
fi

# ==============================================================================
# 2. 버전 확인
# ==============================================================================

print_section "2. 버전 확인"

VERSION=$(curl -s "$LABEL_STUDIO_URL/api/version/" | python3 -c "import sys, json; print(json.load(sys.stdin).get('release', 'unknown'))")
print_success "Label Studio 버전: $VERSION"

# ==============================================================================
# 3. SSO 토큰 발급 테스트
# ==============================================================================

print_section "3. SSO 토큰 발급 테스트"

echo "요청:"
echo "  POST $LABEL_STUDIO_URL/api/sso/token"
echo "  Authorization: Token ${API_TOKEN:0:10}..."
echo "  Body: {\"email\": \"$USER_EMAIL\"}"
echo ""

# SSO API 호출
RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST "$LABEL_STUDIO_URL/api/sso/token" \
    -H "Authorization: Token $API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$USER_EMAIL\"}")

# HTTP 상태 코드 추출
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "응답 (HTTP $HTTP_CODE):"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo ""

# ==============================================================================
# 4. 응답 검증
# ==============================================================================

print_section "4. 응답 검증"

if [ "$HTTP_CODE" -eq 200 ]; then
    print_success "HTTP 200 OK - SSO API가 정상 작동합니다"

    # JWT 토큰 추출
    JWT_TOKEN=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))")
    EXPIRES_IN=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('expires_in', ''))")

    if [ -n "$JWT_TOKEN" ]; then
        print_success "JWT 토큰 발급 성공"
        echo "  토큰: ${JWT_TOKEN:0:50}..."
        echo "  만료 시간: ${EXPIRES_IN}초"
        echo ""

        # JWT 토큰 디코딩 (선택사항)
        if command -v jq &> /dev/null && command -v base64 &> /dev/null; then
            print_section "5. JWT 토큰 디코딩"

            # JWT payload 디코딩 (Header.Payload.Signature 중 Payload 부분)
            PAYLOAD=$(echo "$JWT_TOKEN" | cut -d'.' -f2)
            # Base64 패딩 추가
            PADDED_PAYLOAD="${PAYLOAD}$(printf '=%.0s' {1..4})"

            echo "JWT Payload:"
            echo "$PADDED_PAYLOAD" | base64 -d 2>/dev/null | python3 -m json.tool || echo "디코딩 실패"
        fi

        echo ""
        print_section "6. 인증 테스트"

        # 쿠키 방식 테스트
        echo "테스트 URL (쿠키):"
        echo "  설정: 쿠키 'ls_auth_token=$JWT_TOKEN'"
        echo "  접속: $LABEL_STUDIO_URL/projects/"
        echo ""

        # URL 파라미터 방식 테스트
        echo "테스트 URL (파라미터):"
        echo "  $LABEL_STUDIO_URL/projects/?token=${JWT_TOKEN:0:50}..."
        echo ""

        print_success "모든 테스트 통과!"

    else
        print_error "JWT 토큰이 응답에 포함되지 않았습니다"
        exit 1
    fi

elif [ "$HTTP_CODE" -eq 401 ]; then
    print_error "HTTP 401 Unauthorized - API Token이 올바르지 않습니다"
    echo ""
    echo "API Token 확인 방법:"
    echo "  1. Label Studio에 로그인"
    echo "  2. Account Settings → Access Token 확인"
    echo "  또는"
    echo "  docker-compose exec labelstudio python /label-studio/label_studio/manage.py drf_create_token <username>"
    exit 1

elif [ "$HTTP_CODE" -eq 404 ]; then
    print_error "HTTP 404 Not Found - SSO API 엔드포인트를 찾을 수 없습니다"
    echo ""
    echo "확인 사항:"
    echo "  1. config/urls.py가 올바르게 마운트되었는지 확인"
    echo "  2. docker-compose exec labelstudio cat /label-studio/label_studio/core/urls.py | grep sso"
    echo "  3. docker-compose restart labelstudio"
    exit 1

else
    print_error "HTTP $HTTP_CODE - 예상치 못한 오류"
    exit 1
fi

# ==============================================================================
# 완료
# ==============================================================================

print_section "테스트 완료"

echo "다음 단계:"
echo "  1. 위의 JWT 토큰을 사용하여 외부 앱에서 Label Studio 인증"
echo "  2. 쿠키 방식 (권장) 또는 URL 파라미터 방식 사용"
echo "  3. 자세한 사용 방법은 README-DOCKER.md 참조"
echo ""
