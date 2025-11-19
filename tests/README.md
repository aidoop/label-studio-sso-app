# Label Studio Custom - Integration Tests

이 디렉토리는 `label-studio-custom` 프로젝트의 모든 커스터마이징 기능을 검증하는 통합 테스트를 포함합니다.

## 테스트 범위

### 1. Version API - Custom Version Override
- ✅ 커스텀 버전 정보 반환 검증
- ✅ `release` 필드 오버라이드 확인
- ✅ `base_release`, `custom_version`, `custom_features` 필드 존재 확인

### 2. Admin User APIs
- ✅ 관리자 전용 사용자 목록 API (`/api/admin/users/list`)
- ✅ `is_superuser`, `is_staff`, `is_active` 필드 포함 확인
- ✅ 사용자 생성 API (`/api/custom/users/`)
- ✅ 슈퍼유저 승격/강등 API (`/api/admin/users/promote`, `/api/admin/users/demote`)

### 3. User CRUD Operations
- ✅ GET: 사용자 상세 조회
- ✅ PATCH: 사용자 정보 수정
- ✅ DELETE: 사용자 삭제 (v1.20.0-sso.36 수정 사항)

### 4. SSO Token Validation
- ✅ 기존 사용자 SSO 토큰 생성
- ✅ 존재하지 않는 사용자 처리 (HTTP 422)

### 5. Active Organization Signal
- ✅ 사용자 생성 시 자동 organization 할당 확인

### 6. Custom Export API (60 Tests Total)

#### 6.1 Comprehensive Tests (27 tests)
- ✅ **검수자(Superuser) Annotation만 반환** - is_superuser=True 확인
- ✅ **Annotation 없는 Task 제외** - 필수 필터 검증
- ✅ **임시 저장(Draft) Annotation 제외** - was_cancelled=False 확인
- ✅ **response_type='count' 기능** - 건수 조회 (페이징 계획용)
- ✅ **response_type='data' 기능** - 전체 데이터 반환
- ✅ **날짜 범위 필터링** - search_from, search_to, search_date_field
- ✅ **모델 버전 필터링** - model_version으로 prediction 필터
- ✅ **승인자 필터링** - confirm_user_id로 검수자별 필터
- ✅ **페이징 기능** - page, page_size 지원 (timeout 방지)
- ✅ **복합 필터** - 여러 필터 동시 적용
- ✅ **에러 처리** - 유효성 검증 및 에러 메시지
- ✅ **성능 및 데이터 무결성** - count/data 일관성 확인
- ✅ **실제 사용 사례** - MLOps 워크플로우 검증

**테스트 데이터**: 20개 tasks (10 valid + 10 invalid scenarios)

#### 6.2 Advanced Tests (33 tests)
- ✅ **엣지 케이스** - 빈 프로젝트, 경계값 페이지, 최소/최대 page_size
- ✅ **복잡한 Annotation 시나리오** - 혼합 annotation, 다중 superuser
- ✅ **다중 Prediction 시나리오** - 3개 모델 버전, null 처리
- ✅ **날짜 경계값 테스트** - 정확한 경계, 부분 날짜 범위, 역순 날짜
- ✅ **입력 유효성 검증** - 음수/0 값, 잘못된 형식
- ✅ **SQL Injection 보안** - 8가지 공격 패턴 차단 확인
- ✅ **동시 요청 처리** - 5개 병렬 요청 일관성 확인
- ✅ **특수 문자 처리** - Unicode, emoji, HTML 태그
- ✅ **대용량 데이터 시뮬레이션** - 큰 page_size 성능 테스트
- ✅ **일관성 테스트** - 동일 요청 반복 시 일관된 결과

**테스트 데이터**: 8+ tasks (다양한 엣지 케이스)

**총 테스트 케이스**: 60개 (27 comprehensive + 33 advanced)
**Pass Rate**: 100% (60/60)

### 7. Security Headers (iframe support)
- ✅ Content-Security-Policy 헤더 확인
- ✅ X-Frame-Options 헤더 확인

### 8. Prediction Model Version
- ✅ Prediction 조회 시 `model_version` 필드 정상 반환 확인
- ⚠️  **참고**: v1.20.0-sso.37부터 AIV Prefix 기능 제거됨

### 9. Media Upload API
- ✅ 미디어 업로드 API 접근성 확인
- ✅ 배열 및 File 객체 처리

### 10. Health Check
- ✅ Label Studio 헬스 체크 엔드포인트

## 사전 요구사항

- Node.js 18 이상
- Docker & Docker Compose
- 실행 중인 Label Studio Custom 컨테이너

## 설치

```bash
cd tests
npm install  # package.json 의존성이 있는 경우 (현재는 Node.js 내장 테스트 사용)
```

## 사용 방법

### 방법 1: 기존 개발 환경 사용

기존에 실행 중인 Docker 컨테이너를 대상으로 테스트:

```bash
# 1. 컨테이너가 실행 중인지 확인
docker ps | grep label-studio

# 2. 테스트 실행
cd tests
./run-tests.sh

# 상세 출력
./run-tests.sh --verbose

# Watch 모드 (파일 변경 시 자동 재실행)
./run-tests.sh --watch
```

### 방법 2: 독립 테스트 환경 사용

테스트 전용 Docker 환경을 시작하고 테스트:

```bash
cd tests

# 1. 테스트 환경 시작
docker compose -f docker-compose.test.yml up -d

# 2. 컨테이너가 준비될 때까지 대기 (약 30초)
docker compose -f docker-compose.test.yml logs -f labelstudio-test

# 3. 테스트 실행
LABEL_STUDIO_URL=http://localhost:8081 ./run-tests.sh

# 4. 테스트 환경 종료
docker compose -f docker-compose.test.yml down

# 데이터 볼륨까지 삭제
docker compose -f docker-compose.test.yml down -v
```

## 환경 변수

테스트 실행 시 다음 환경 변수를 설정할 수 있습니다:

```bash
# Label Studio URL (기본값: http://localhost:8080)
export LABEL_STUDIO_URL=http://localhost:8081

# API Token (기본값: 개발 환경 토큰)
export LABEL_STUDIO_API_TOKEN=your_api_token_here

# 테스트 실행
./run-tests.sh
```

또는 `.env` 파일을 프로젝트 루트에 생성:

```env
LABEL_STUDIO_URL=http://localhost:8080
LABEL_STUDIO_API_TOKEN=2c00d45b8318a11f59e04c7233d729f3f17664e8
```

## 테스트 결과 예시

```
╔════════════════════════════════════════════════════════════════╗
║  Label Studio Custom - Integration Tests                      ║
╚════════════════════════════════════════════════════════════════╝

→ Target: http://localhost:8080
→ Checking Label Studio availability...
✓ Label Studio is running
→ Checking Node.js version...
✓ Node.js v20.10.0

╔════════════════════════════════════════════════════════════════╗
║  Running Tests...                                              ║
╚════════════════════════════════════════════════════════════════╝

▶ Label Studio Custom - Integration Tests
  ▶ 1. Version API - Custom Version Override
    ✔ should return custom version information
      ✓ Version: 1.20.0-sso.36
      ✓ Custom Version: 1.20.0-sso.36
      ✓ Edition: Community + SSO Custom
      ✓ Features: 7 custom features
    ✔ should have base_release field as backup
      ✓ Base Release: 1.20.0

  ▶ 2. Admin User APIs
    ✔ should list all users with superuser info (Admin only)
      ✓ Found 14 users
      ✓ User fields: id, email, is_superuser, is_staff, is_active
    ✔ should create a new user
      ✓ Created user ID: 29
    ✔ should promote user to superuser
      ✓ Promoted user 29 to superuser
    ✔ should demote user from superuser
      ✓ Demoted user 29 from superuser

  ▶ 3. User CRUD Operations
    ✔ should get user details
      ✓ Retrieved user: test_integration_1731567890123@nubison.io
    ✔ should update user information (PATCH)
      ✓ Updated user name to: Updated Name
    ✔ should delete user (DELETE)
      ✓ Deleted user 29

  ... (more tests)

╔════════════════════════════════════════════════════════════════╗
║  ✓ All tests passed!                                          ║
╚════════════════════════════════════════════════════════════════╝
```

## 디렉토리 구조

```
tests/
├── README.md                          # 이 파일
├── package.json                       # Node.js 테스트 설정
├── run-tests.sh                       # 테스트 실행 스크립트
├── docker-compose.test.yml            # 테스트 환경 Docker 구성
└── integration/
    ├── label-studio-custom.test.js    # 통합 테스트 스위트 (일반)
    └── custom-export-api.test.js      # Custom Export API 전용 테스트 (27 tests)
```

## CI/CD 통합

GitHub Actions 또는 다른 CI/CD 파이프라인에서 테스트를 실행할 수 있습니다:

```yaml
# .github/workflows/test.yml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Set up Docker
        uses: docker/setup-buildx-action@v2

      - name: Start test environment
        run: |
          cd tests
          docker compose -f docker-compose.test.yml up -d

      - name: Wait for services
        run: |
          timeout 60 bash -c 'until docker compose -f tests/docker-compose.test.yml exec -T labelstudio-test curl -f http://localhost:8080/health; do sleep 2; done'

      - name: Run integration tests
        run: |
          cd tests
          LABEL_STUDIO_URL=http://localhost:8081 ./run-tests.sh

      - name: Cleanup
        if: always()
        run: |
          cd tests
          docker compose -f docker-compose.test.yml down -v
```

## 테스트 추가하기

새로운 커스터마이징 기능을 추가한 경우, 해당 테스트를 추가하세요:

```javascript
// integration/label-studio-custom.test.js

describe('11. New Custom Feature', () => {
  it('should test new feature', async () => {
    const res = await request('GET', '/api/custom/new-feature');

    assert.strictEqual(res.status, 200);
    assert.ok(res.data.feature_data, 'feature data should exist');

    console.log(`  ✓ New feature test passed`);
  });
});
```

## 트러블슈팅

### 테스트가 실패하는 경우

1. **Label Studio가 실행 중인지 확인**:
   ```bash
   curl http://localhost:8080/health
   ```

2. **API 토큰이 유효한지 확인**:
   ```bash
   curl -H "Authorization: Token YOUR_TOKEN" http://localhost:8080/api/users/
   ```

3. **포트 충돌 확인**:
   ```bash
   # 8080 포트가 사용 중인지 확인
   lsof -i :8080

   # 다른 포트 사용
   LABEL_STUDIO_URL=http://localhost:8081 ./run-tests.sh
   ```

4. **Docker 로그 확인**:
   ```bash
   docker compose logs labelstudio
   ```

### 테스트 환경 초기화

테스트 데이터를 완전히 초기화하려면:

```bash
# 테스트 환경 중지 및 볼륨 삭제
docker compose -f docker-compose.test.yml down -v

# 다시 시작
docker compose -f docker-compose.test.yml up -d
```

## 라이선스

이 테스트 코드는 label-studio-sso-app 프로젝트의 일부입니다.

## 기여

테스트 개선 사항이나 버그 리포트는 이슈 또는 PR로 제출해주세요.
