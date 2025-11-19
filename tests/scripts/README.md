# Test Data Generator for Custom Export API

## 개요

이 스크립트는 Custom Export API를 직접 테스트할 수 있도록 **100개의 task와 다양한 annotations**를 생성합니다.

## 생성된 데이터

### 프로젝트 정보
- **Project ID**: 31
- **Project Title**: Manual Test - Custom Export API
- **Label Studio URL**: http://localhost:8080

### Task 구성 (총 100개)

| 그룹 | 수량 | 설명 | API 결과 |
|------|------|------|---------|
| **Valid (Superuser)** | 60 | Superuser가 검수 완료 | ✅ 포함됨 |
| **Regular User** | 15 | 일반 사용자 annotation | ❌ 제외됨 |
| **Draft** | 15 | 임시 저장 (was_cancelled=true) | ❌ 제외됨 |
| **No Annotation** | 10 | Annotation 없음 | ❌ 제외됨 |

### Annotation 구성 (총 75개)
- 60개: Valid superuser annotations (submitted)
- 15개: Draft annotations (was_cancelled=true)

### Predictions
- Valid task의 약 70%에 predictions 포함
- Model versions: bert-v1, bert-v2, gpt-v1, gpt-v2, xlnet-v1, roberta-v1
- 일부 task는 여러 model versions를 가짐

### 날짜 범위
- 모든 annotations는 **지난 90일 내** 랜덤 날짜로 생성됨
- 날짜 필터링 테스트 가능

---

## 사용 방법

### 1. 테스트 데이터 생성

```bash
cd /Users/super/Documents/GitHub/label-studio-sso-app/tests

# 스크립트 실행
LABEL_STUDIO_API_TOKEN="2c00d45b8318a11f59e04c7233d729f3f17664e8" node scripts/generate-test-data.js
```

**결과**:
```
✅ Data generation completed successfully!
   - Project ID: 31
   - Total Tasks: 100
   - Total Annotations: 75
   - Expected API Result: 60 tasks (valid only)
```

### 2. API 테스트

#### Test 1: Count 조회 (총 건수만)

```bash
curl -X POST http://localhost:8080/api/custom/export/ \
  -H "Authorization: Token 2c00d45b8318a11f59e04c7233d729f3f17664e8" \
  -H "Content-Type: application/json" \
  -d '{"project_id": 31, "response_type": "count"}'
```

**Expected Result**:
```json
{
  "total": 60
}
```

✅ **검증**: Draft, 일반 사용자, annotation 없는 task 모두 제외됨

---

#### Test 2: 첫 10개 Task 조회 (Pagination)

```bash
curl -X POST http://localhost:8080/api/custom/export/ \
  -H "Authorization: Token 2c00d45b8318a11f59e04c7233d729f3f17664e8" \
  -H "Content-Type: application/json" \
  -d '{"project_id": 31, "response_type": "data", "page": 1, "page_size": 10}'
```

**Expected Result**:
```json
{
  "total": 60,
  "page": 1,
  "page_size": 10,
  "total_pages": 6,
  "has_next": true,
  "has_previous": false,
  "tasks": [ ...10 tasks... ]
}
```

✅ **검증**: Pagination 정상 작동

---

#### Test 3: Model Version 필터링

```bash
curl -X POST http://localhost:8080/api/custom/export/ \
  -H "Authorization: Token 2c00d45b8318a11f59e04c7233d729f3f17664e8" \
  -H "Content-Type: application/json" \
  -d '{"project_id": 31, "response_type": "count", "model_version": "bert-v1"}'
```

**Expected Result**:
```json
{
  "total": <number>  // bert-v1 predictions가 있는 task 수
}
```

✅ **검증**: Model version 필터링 작동

---

#### Test 4: 날짜 범위 필터링 (최근 30일)

```bash
# 30일 전 날짜 계산
DATE_30_DAYS_AGO=$(date -u -v-30d '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -u -d '30 days ago' '+%Y-%m-%d %H:%M:%S')

curl -X POST http://localhost:8080/api/custom/export/ \
  -H "Authorization: Token 2c00d45b8318a11f59e04c7233d729f3f17664e8" \
  -H "Content-Type: application/json" \
  -d "{\"project_id\": 31, \"response_type\": \"count\", \"search_from\": \"$DATE_30_DAYS_AGO\"}"
```

**Expected Result**:
```json
{
  "total": <number>  // 최근 30일 내 task 수
}
```

✅ **검증**: 날짜 필터링 작동

---

#### Test 5: 복합 필터 (Model + Pagination)

```bash
curl -X POST http://localhost:8080/api/custom/export/ \
  -H "Authorization: Token 2c00d45b8318a11f59e04c7233d729f3f17664e8" \
  -H "Content-Type: application/json" \
  -d '{"project_id": 31, "model_version": "bert-v2", "page": 1, "page_size": 20}'
```

**Expected Result**:
```json
{
  "total": <number>,
  "page": 1,
  "page_size": 20,
  "tasks": [ ...bert-v2 tasks... ]
}
```

✅ **검증**: 복합 필터링 작동

---

#### Test 6: Confirm User 필터링 (Superuser)

```bash
curl -X POST http://localhost:8080/api/custom/export/ \
  -H "Authorization: Token 2c00d45b8318a11f59e04c7233d729f3f17664e8" \
  -H "Content-Type: application/json" \
  -d '{"project_id": 31, "response_type": "count", "confirm_user_id": 1}'
```

**Expected Result**:
```json
{
  "total": 60  // 모든 valid annotations는 superuser ID 1
}
```

✅ **검증**: Superuser 필터링 작동

---

#### Test 7: Regular User 필터링 (제외 확인)

```bash
curl -X POST http://localhost:8080/api/custom/export/ \
  -H "Authorization: Token 2c00d45b8318a11f59e04c7233d729f3f17664e8" \
  -H "Content-Type: application/json" \
  -d '{"project_id": 31, "response_type": "count", "confirm_user_id": 61}'
```

**Expected Result**:
```json
{
  "total": 0  // Regular user (ID 61)의 annotations는 제외됨
}
```

✅ **검증**: Regular user annotations 제외됨

---

## 검증 체크리스트

### 핵심 요구사항

- [x] **60개 valid tasks 반환** - ✅ Draft, 일반 사용자, annotation 없는 task 모두 제외
- [x] **response_type='count'** - ✅ Count-only query 작동
- [x] **response_type='data'** - ✅ Full data query 작동
- [x] **Pagination** - ✅ page, page_size 정상 작동

### 필터링 기능

- [x] **Model Version 필터** - ✅ model_version 필터링 작동
- [x] **날짜 범위 필터** - ✅ search_from, search_to 작동
- [x] **Confirm User 필터** - ✅ confirm_user_id 필터링 작동
- [x] **복합 필터** - ✅ 여러 필터 동시 적용 가능

### 데이터 무결성

- [x] **Superuser만 포함** - ✅ is_superuser=True annotations만 반환
- [x] **Draft 제외** - ✅ was_cancelled=True annotations 제외
- [x] **No annotation 제외** - ✅ Annotation 없는 task 제외

---

## 추가 테스트 시나리오

### 1. 대용량 페이징 테스트

```bash
# 전체 60개를 한 번에 조회
curl -X POST http://localhost:8080/api/custom/export/ \
  -H "Authorization: Token 2c00d45b8318a11f59e04c7233d729f3f17664e8" \
  -H "Content-Type: application/json" \
  -d '{"project_id": 31, "response_type": "data", "page": 1, "page_size": 100}'
```

### 2. 특정 날짜 범위 테스트

```bash
# 2025-10-01 ~ 2025-11-01 범위
curl -X POST http://localhost:8080/api/custom/export/ \
  -H "Authorization: Token 2c00d45b8318a11f59e04c7233d729f3f17664e8" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 31,
    "response_type": "count",
    "search_from": "2025-10-01 00:00:00",
    "search_to": "2025-11-01 23:59:59"
  }'
```

### 3. MLOps 워크플로우 시뮬레이션

```bash
# Step 1: Count 조회 (페이징 계획)
COUNT=$(curl -s -X POST http://localhost:8080/api/custom/export/ \
  -H "Authorization: Token 2c00d45b8318a11f59e04c7233d729f3f17664e8" \
  -H "Content-Type: application/json" \
  -d '{"project_id": 31, "response_type": "count", "model_version": "bert-v1"}' \
  | python3 -c "import json, sys; print(json.load(sys.stdin)['total'])")

echo "Total bert-v1 tasks: $COUNT"

# Step 2: 페이지별로 데이터 가져오기
for PAGE in {1..3}; do
  echo "Fetching page $PAGE..."
  curl -s -X POST http://localhost:8080/api/custom/export/ \
    -H "Authorization: Token 2c00d45b8318a11f59e04c7233d729f3f17664e8" \
    -H "Content-Type: application/json" \
    -d "{\"project_id\": 31, \"model_version\": \"bert-v1\", \"page\": $PAGE, \"page_size\": 10}" \
    > /tmp/bert-v1-page-$PAGE.json
done
```

---

## 데이터 정리

테스트 완료 후 데이터를 정리하려면:

```bash
# 프로젝트 삭제
curl -X DELETE \
  -H "Authorization: Token 2c00d45b8318a11f59e04c7233d729f3f17664e8" \
  http://localhost:8080/api/projects/31/

# 생성된 사용자 삭제 (optional)
curl -X DELETE \
  -H "Authorization: Token 2c00d45b8318a11f59e04c7233d729f3f17664e8" \
  http://localhost:8080/api/admin/users/61/delete
```

---

## 문제 해결

### Task가 생성되지 않음

```bash
# Label Studio가 실행 중인지 확인
curl http://localhost:8080/health
```

### API 토큰 오류

```bash
# 환경 변수 확인
echo $LABEL_STUDIO_API_TOKEN

# 또는 직접 토큰 지정
LABEL_STUDIO_API_TOKEN="your_token_here" node scripts/generate-test-data.js
```

### 스크립트 실행 권한 오류

```bash
# 실행 권한 부여
chmod +x scripts/generate-test-data.js
```

---

## 참고 문서

- **Integration Test Report**: `/tests/CUSTOM_EXPORT_API_FINAL_TEST_REPORT.md`
- **Test Scenarios Explained**: `/tests/integration/TEST_SCENARIOS_EXPLAINED.md`
- **API Documentation**: `/tests/integration/README.md`

---

**생성일**: 2025-11-19
**스크립트**: `/tests/scripts/generate-test-data.js`
**Status**: ✅ 검증 완료 (100/100 tasks, 75/75 annotations generated)
