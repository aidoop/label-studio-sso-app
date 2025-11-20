# Custom Export API Integration Tests

## 테스트 개요

이 디렉토리는 label-studio-custom의 Custom Export API를 포괄적으로 검증하는 2개의 테스트 파일을 포함합니다.

### 테스트 파일 구성

1. **custom-export-api.test.js** (27 tests) - 기본 기능 및 요구사항 검증
2. **custom-export-api-advanced.test.js** (33 tests) - 엣지 케이스 및 보안 테스트

**총 60개 테스트 (100% 통과)**

---

## Test Suite 1: Comprehensive Tests (27 tests)

**파일**: `custom-export-api.test.js`

이 테스트는 label-studio-custom의 Custom Export API 핵심 요구사항을 검증합니다.

### 검증 항목

1. **검수자(Superuser) Annotation만 반환**

   - is_superuser=True인 사용자의 annotation만 포함
   - 일반 사용자의 annotation 자동 제외

2. **Annotation 없는 Task 제외**

   - 필수 필터로 annotation이 있는 task만 반환

3. **임시 저장(Draft) Annotation 제외**

   - was_cancelled=False인 submit된 annotation만 포함

4. **건수 조회 기능 (response_type='count')**

   - 페이징 전 총 건수 파악 (timeout 방지)
   - Task 직렬화 없이 빠른 count 쿼리

5. **전체 데이터 반환 (response_type='data')**

   - annotations, predictions 포함 전체 데이터
   - 기본 동작 (response_type 생략 시)

6. **다양한 필터링 옵션**

   - 날짜 범위: search_from, search_to, search_date_field
   - 모델 버전: model_version
   - 승인자: confirm_user_id
   - 복합 필터: 여러 조건 동시 적용

7. **페이징 기능**

   - page, page_size 파라미터
   - has_next, has_previous, total_pages 메타데이터
   - 대용량 데이터 timeout 방지

8. **에러 처리**
   - 유효성 검증
   - SQL Injection 방지
   - 명확한 에러 메시지

## 테스트 데이터

### 생성되는 테스트 데이터 (20개 tasks)

#### Group 1: Valid Tasks (10개) - 반환되어야 함

- 검수자(superuser)의 submit된 annotation 포함
- 일부는 prediction도 포함 (model_version: bert-v1, bert-v2)
- 날짜 분산 (각 날짜별 1개씩)

#### Group 2: Regular User Tasks (3개) - 제외되어야 함

- 일반 사용자(is_superuser=False)의 annotation만 포함
- Custom Export API에서 자동 제외

#### Group 3: Draft Tasks (3개) - 제외되어야 함

- 검수자의 annotation이지만 was_cancelled=True (임시 저장)
- Submit되지 않은 draft annotation 제외

#### Group 4: No Annotation Tasks (4개) - 제외되어야 함

- Annotation이 아예 없는 task
- 필수 필터에 의해 제외

## 테스트 케이스 (27개)

### 1. Basic Functionality (3 tests)

- Count-only response (response_type='count')
- Full data response (response_type='data')
- Default behavior (no response_type)

### 2. Superuser Annotation Filtering (3 tests)

- Only superuser annotations returned
- Tasks without annotations excluded
- Draft/cancelled annotations excluded

### 3. Date Range Filtering (3 tests)

- Date range filter (search_from, search_to)
- Custom date field (search_date_field)
- Invalid field name validation (SQL injection prevention)

### 4. Model Version Filtering (2 tests)

- Filter by model_version
- Verify predictions included

### 5. Confirm User ID Filtering (2 tests)

- Filter by superuser ID
- Filter by regular user ID (should return empty)

### 6. Pagination (4 tests)

- Basic pagination (page 1, page 2)
- Validation (page/page_size required together)
- Large page_size handling
- Maximum page_size rejection (>10000)

### 7. Combined Filters (2 tests)

- Multiple filters together
- Count + pagination workflow

### 8. Error Handling (3 tests)

- Non-existent project (404)
- Missing required field (400)
- Invalid response_type (400)

### 9. Performance & Data Integrity (2 tests)

- Count/data consistency
- Required fields validation

### 10. Real-world Use Cases (3 tests)

- MLOps model training workflow
- Model performance calculation
- Large dataset export (timeout prevention)

---

## Test Suite 2: Advanced Tests (33 tests)

**파일**: `custom-export-api-advanced.test.js`

이 테스트는 엣지 케이스, 보안, 성능을 집중적으로 검증합니다.

### 테스트 그룹

### 1. Edge Cases - Empty and Boundary Conditions (4 tests)

- Empty project (no tasks)
- Page number beyond available pages
- Minimum page_size (1)
- Maximum page_size (10000)

### 2. Complex Annotation Scenarios (2 tests)

- Task with mixed valid/invalid annotations
- Task with multiple valid superuser annotations

### 3. Multiple Predictions Scenarios (3 tests)

- Include all predictions when no filter
- Filter by specific model_version
- Handle task with null model_version

### 4. Date Boundary Testing (4 tests)

- Exact boundary dates (inclusive)
- search_from without search_to
- search_to without search_from
- Inverted date range (from > to)

### 5. Input Validation - Invalid Formats (5 tests)

- Invalid date format
- Negative page number
- Zero page number
- Negative page_size
- Zero page_size

### 6. SQL Injection & Security Tests (8 tests)

8가지 SQL injection 공격 패턴 차단 확인:
- `'; DROP TABLE tasks; --`
- `1' OR '1'='1`
- `admin'--`
- `'; DELETE FROM annotations; --`
- `../../../etc/passwd`
- `<script>alert('xss')</script>`
- `1 UNION SELECT * FROM users`
- `source_created_at; DROP TABLE`

### 7. Concurrent Request Handling (2 tests)

- Multiple concurrent requests consistency
- Concurrent count + data requests

### 8. Special Characters in Data (1 test)

- Unicode, emojis, HTML tags, escape sequences

### 9. Large Dataset Simulation (2 tests)

- Non-paginated request handling
- Very large page_size performance

### 10. Consistency Tests (2 tests)

- Multiple identical requests return same results
- Count-data consistency with filters

---

## 실행 방법

### 모든 테스트 실행 (추천)

```bash
cd tests
npm run test:verbose integration/custom-export-api*.test.js
```

### 개별 테스트 실행

#### Comprehensive Tests (27 tests)

```bash
cd tests
npm run test:verbose integration/custom-export-api.test.js
```

#### Advanced Tests (33 tests)

```bash
cd tests
npm run test:verbose integration/custom-export-api-advanced.test.js
```

### 직접 실행 (Node.js)

```bash
cd tests
node --test --test-reporter=spec integration/custom-export-api.test.js
node --test --test-reporter=spec integration/custom-export-api-advanced.test.js
```

## 예상 결과

### Comprehensive Tests
```
✔ Custom Export API - Comprehensive Integration Tests (~2.8s)
  ✓ tests 27
  ✓ suites 11
  ✓ pass 27
  ✓ fail 0
```

### Advanced Tests
```
✔ Custom Export API - Advanced Integration Tests (~2.6s)
  ✓ tests 33
  ✓ suites 11
  ✓ pass 33
  ✓ fail 0
```

### 전체 결과
```
Total: 60/60 tests passed (100%)
Execution time: ~5.4 seconds
```

### 주요 검증 결과

#### Comprehensive Tests
1. **10개 valid tasks** 반환 확인
2. **10개 invalid tasks** (regular user 3 + draft 3 + no annotation 4) 제외 확인
3. **response_type='count'** 성능 최적화 확인
4. **페이징** 정상 동작 확인
5. **복합 필터** 조합 확인
6. **MLOps 워크플로우** 검증

#### Advanced Tests
1. **엣지 케이스** 경계값 처리 확인
2. **SQL injection** 8가지 공격 패턴 차단 확인
3. **동시 요청** 5개 병렬 처리 확인
4. **특수 문자** Unicode/emoji 처리 확인
5. **대용량 데이터** 성능 확인
6. **일관성** 반복 요청 시 동일 결과 확인

## 테스트 환경

- Label Studio Custom: 1.20.0-sso.38 (test)
- Node.js: >=18.0.0
- Docker Compose
- 실행 중인 label-studio-custom 컨테이너

## 문제 해결

### 테스트 실패 시

1. Label Studio가 실행 중인지 확인

   ```bash
   curl http://localhost:8080/health
   ```

2. API 토큰 확인

   ```bash
   echo $LABEL_STUDIO_API_TOKEN
   ```

3. Docker 로그 확인
   ```bash
   docker logs label-studio-app
   ```

### 테스트 데이터 정리

테스트는 자동으로 cleanup하지만, 수동 정리가 필요한 경우:

```bash
# 프로젝트 목록 확인
curl -H "Authorization: Token YOUR_TOKEN" http://localhost:8080/api/projects/

# 특정 프로젝트 삭제
curl -X DELETE -H "Authorization: Token YOUR_TOKEN" \
  http://localhost:8080/api/projects/{project_id}/
```

## CI/CD 통합

GitHub Actions 예시:

```yaml
- name: Run Custom Export API Tests
  run: |
    cd tests
    # Comprehensive tests
    npm run test:verbose integration/custom-export-api.test.js
    # Advanced tests
    npm run test:verbose integration/custom-export-api-advanced.test.js

    # Or run both at once
    npm run test:verbose integration/custom-export-api*.test.js
```

## 관련 문서

### Test Reports
- **Final Test Report**: `/tests/CUSTOM_EXPORT_API_FINAL_TEST_REPORT.md` - 전체 60개 테스트 종합 보고서
- **Test Summary**: `/tests/CUSTOM_EXPORT_API_TEST_SUMMARY.md` - 초기 테스트 요약
- **Test Scenarios Explained**: `/tests/integration/TEST_SCENARIOS_EXPLAINED.md` - 테스트 시나리오 설명

### API Documentation
- Custom Export API 변경 사항: `/label-studio-custom/CUSTOM_EXPORT_API_CHANGES.md`
- Integration Test Report: `/label-studio-custom/INTEGRATION_TEST_REPORT.md`
- API Implementation: `/label-studio-custom/custom-api/export.py`
