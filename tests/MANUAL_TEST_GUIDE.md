# Custom Export API - 직접 테스트 가이드

**작성일**: 2025-11-19
**버전**: v1.20.0-sso.38
**Status**: ✅ 테스트 데이터 생성 완료 (100 tasks, 75 annotations)

---

## 🎯 개요

Custom Export API를 **직접 테스트**할 수 있도록 **100개의 task와 75개의 annotations**가 생성되었습니다.

### 생성된 데이터

| 항목 | 값 |
|------|-----|
| **Project ID** | 32 |
| **Project Title** | Manual Test - Custom Export API |
| **Total Tasks** | 100 |
| **Total Annotations** | 100 |
| **Expected API Result** | 60 tasks (35 superuser-only + 25 mixed) |

---

## 📊 데이터 구성

### Tasks (100개)

```
✅ 35 tasks - Superuser-only annotations (포함됨)
✅ 25 tasks - Mixed annotations (superuser + regular user, 포함됨 - superuser만)
❌ 15 tasks - Regular user-only annotations (제외됨)
❌ 15 tasks - Draft annotations (was_cancelled=true, 제외됨)
❌ 10 tasks - No annotations (제외됨)
```

**핵심 검증 포인트**:
1. **Superuser-only (35개)**: Superuser만 annotation한 task → ✅ 포함
2. **Mixed (25개)**: Superuser + Regular user 모두 annotation → ✅ 포함 (superuser만)
3. **Regular user-only (15개)**: Regular user만 annotation → ❌ 완전 제외
4. **Draft-only (15개)**: 임시 저장만 → ❌ 제외
5. **No annotations (10개)**: Annotation 없음 → ❌ 제외

### Predictions

- **70% of valid tasks** have predictions
- **Model versions**: bert-v1, bert-v2, gpt-v1, gpt-v2, xlnet-v1, roberta-v1
- Some tasks have **multiple model versions**

### Date Range

- All annotations: **last 90 days** (random dates)
- Useful for date range filtering tests

---

## 🚀 빠른 시작

### 1. 테스트 데이터 이미 생성됨 ✅

데이터가 이미 생성되어 있으니 바로 API를 테스트하실 수 있습니다!

### 2. 빠른 테스트 실행

```bash
cd /Users/super/Documents/GitHub/label-studio-sso-app/tests

# 7가지 핵심 테스트 자동 실행
./scripts/test-custom-export-api.sh
```

**결과**:
```
✅ PASS: 60 valid tasks returned (expected 60)
✅ PASS: 5 tasks returned from total 60
✅ PASS: All 60 annotations confirmed by superuser ID 1
✅ PASS: Regular user annotations correctly excluded (0 returned)
...
```

---

## 📝 수동 테스트 예제

### Test 1: Count 조회

```bash
curl -X POST http://localhost:8080/api/custom/export/ \
  -H "Authorization: Token 2c00d45b8318a11f59e04c7233d729f3f17664e8" \
  -H "Content-Type: application/json" \
  -d '{"project_id": 32, "response_type": "count"}'
```

**Expected**: `{"total": 60}` (35 superuser-only + 25 mixed)

---

### Test 2: 첫 10개 Task 조회

```bash
curl -X POST http://localhost:8080/api/custom/export/ \
  -H "Authorization: Token 2c00d45b8318a11f59e04c7233d729f3f17664e8" \
  -H "Content-Type: application/json" \
  -d '{"project_id": 32, "response_type": "data", "page": 1, "page_size": 10}'
```

**Expected**:
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

---

### Test 3: Superuser 필터링

```bash
curl -X POST http://localhost:8080/api/custom/export/ \
  -H "Authorization: Token 2c00d45b8318a11f59e04c7233d729f3f17664e8" \
  -H "Content-Type: application/json" \
  -d '{"project_id": 32, "response_type": "count", "confirm_user_id": 1}'
```

**Expected**: `{"total": 60}` (모든 exported annotations는 superuser ID 1)

---

### Test 4: Regular User 제외 확인

```bash
curl -X POST http://localhost:8080/api/custom/export/ \
  -H "Authorization: Token 2c00d45b8318a11f59e04c7233d729f3f17664e8" \
  -H "Content-Type: application/json" \
  -d '{"project_id": 32, "response_type": "count", "confirm_user_id": 62}'
```

**Expected**: `{"total": 0}` (regular user-only annotations 제외됨, mixed tasks에서도 제외됨)

---

### Test 5: Mixed Annotation 검증

Mixed annotation tasks (superuser + regular user 모두 annotation이 있는 task)에서 API가 superuser annotation만 반환하는지 확인:

```bash
./scripts/verify-mixed-annotations.sh
```

**Expected Output**:
```
✅ PASS: 60 tasks returned (includes mixed annotations)
✅ PASS: All annotations are from superuser only
✅ PASS: Regular user-only annotations excluded (0 tasks returned)
✅ PASS: Mixed annotations exist in database (25 tasks)
✅ PASS: API correctly excludes regular user annotations from response
```

이 테스트는 다음을 검증합니다:
- Regular user-only annotations **완전 제외** (15개 task)
- Mixed annotations에서 regular user part **제외** (25개 task)
- 오직 superuser valid annotations만 export됨

---

## 🧪 고급 테스트

### MLOps Workflow Simulation

```bash
# Step 1: Count 조회
echo "Step 1: Counting tasks..."
COUNT=$(curl -s -X POST http://localhost:8080/api/custom/export/ \
  -H "Authorization: Token 2c00d45b8318a11f59e04c7233d729f3f17664e8" \
  -H "Content-Type: application/json" \
  -d '{"project_id": 32, "response_type": "count"}' \
  | python3 -c "import json, sys; print(json.load(sys.stdin)['total'])")

echo "Total: $COUNT tasks"

# Step 2: Calculate pagination
PAGE_SIZE=20
TOTAL_PAGES=$(( ($COUNT + $PAGE_SIZE - 1) / $PAGE_SIZE ))
echo "Pages needed: $TOTAL_PAGES (page_size=$PAGE_SIZE)"

# Step 3: Fetch first page
echo "Step 3: Fetching first page..."
curl -s -X POST http://localhost:8080/api/custom/export/ \
  -H "Authorization: Token 2c00d45b8318a11f59e04c7233d729f3f17664e8" \
  -H "Content-Type: application/json" \
  -d "{\"project_id\": 31, \"page\": 1, \"page_size\": $PAGE_SIZE}" \
  > /tmp/export-page-1.json

echo "✅ Workflow completed!"
```

---

## 📖 상세 가이드

자세한 테스트 방법은 다음 문서를 참고하세요:

1. **스크립트 사용법**: `/tests/scripts/README.md`
2. **전체 테스트 리포트**: `/tests/CUSTOM_EXPORT_API_FINAL_TEST_REPORT.md`
3. **테스트 시나리오 설명**: `/tests/integration/TEST_SCENARIOS_EXPLAINED.md`

---

## 🔧 데이터 재생성

새로운 테스트 데이터가 필요하면:

```bash
cd /Users/super/Documents/GitHub/label-studio-sso-app/tests

# 기존 프로젝트 삭제
curl -X DELETE \
  -H "Authorization: Token 2c00d45b8318a11f59e04c7233d729f3f17664e8" \
  http://localhost:8080/api/projects/32/

# 새로운 데이터 생성
LABEL_STUDIO_API_TOKEN="2c00d45b8318a11f59e04c7233d729f3f17664e8" \
  node scripts/generate-test-data.js
```

---

## ✅ 검증 체크리스트

### 핵심 요구사항
- [x] 60개 valid tasks 반환 확인 (35 superuser-only + 25 mixed)
- [x] Draft annotations 제외 확인 (15개 task)
- [x] Regular user-only annotations 제외 확인 (15개 task)
- [x] Mixed annotations에서 regular user part 제외 확인 (25개 task)
- [x] No annotation tasks 제외 확인 (10개 task)
- [x] response_type='count' 작동 확인
- [x] response_type='data' 작동 확인

### 필터링 기능
- [ ] Pagination (page, page_size)
- [ ] Model version 필터
- [ ] 날짜 범위 필터 (search_from, search_to)
- [ ] Confirm user ID 필터
- [ ] 복합 필터 (여러 필터 동시 적용)

### 데이터 무결성
- [x] 모든 반환 task는 superuser annotations만 포함
- [x] was_cancelled=True annotations 제외됨 (15개 task)
- [x] Regular user-only annotations 제외됨 (15개 task)
- [x] Mixed annotations에서 superuser part만 포함됨 (25개 task)
- [x] Predictions 정상 포함
- [x] count/data 일관성

---

## 📞 문제 해결

### 문제: 테스트 데이터가 보이지 않음

```bash
# Label Studio 상태 확인
curl http://localhost:8080/health

# 프로젝트 확인
curl -H "Authorization: Token 2c00d45b8318a11f59e04c7233d729f3f17664e8" \
  http://localhost:8080/api/projects/32/
```

### 문제: API 토큰 오류

```bash
# 환경 변수 확인
echo $LABEL_STUDIO_API_TOKEN

# 또는 직접 지정
export LABEL_STUDIO_API_TOKEN="your_token_here"
```

---

## 🎉 Ready to Test!

**100개의 task와 75개의 annotations가 준비되었습니다!**

바로 API를 테스트하실 수 있습니다:

```bash
# 빠른 테스트
cd /Users/super/Documents/GitHub/label-studio-sso-app/tests
./scripts/test-custom-export-api.sh

# 또는 수동 테스트
curl -X POST http://localhost:8080/api/custom/export/ \
  -H "Authorization: Token 2c00d45b8318a11f59e04c7233d729f3f17664e8" \
  -H "Content-Type: application/json" \
  -d '{"project_id": 32, "response_type": "count"}'
```

**Happy Testing!** 🚀
