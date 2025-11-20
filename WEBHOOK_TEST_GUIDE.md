# Webhook 기능 테스트 가이드

이 가이드는 Label Studio Custom Image의 Webhook Payload 커스터마이징 기능과 샘플 앱의 실시간 Webhook Monitor를 테스트하는 방법을 설명합니다.

## 사전 준비

### 1. 서비스 실행 확인

```bash
# 서비스 상태 확인
docker compose ps

# 예상 출력:
# label-studio-app        Up (healthy)
# label-studio-backend    Up (healthy)
# label-studio-frontend   Up
# label-studio-postgres   Up (healthy)
```

### 2. Label Studio 접속

브라우저에서 http://label.hatiolab.localhost:8080 접속 후:

1. Admin 계정으로 로그인: `admin@hatiolab.com`
2. 프로젝트 생성 또는 기존 프로젝트 사용

### 3. API 토큰 확인

```bash
# .env 파일에서 API 토큰 확인
cat .env | grep LABEL_STUDIO_API_TOKEN

# 또는 새로 생성
docker compose exec labelstudio \
  python /label-studio/label_studio/manage.py drf_create_token admin@hatiolab.com
```

---

## 테스트 1: Webhook 등록

### 방법 A: curl 사용 (권장)

**로컬 개발 환경**:

```bash
# 환경 변수 설정
export LS_TOKEN="your_api_token_here"
export LS_URL="http://label.hatiolab.localhost:8080"

# Webhook 등록
curl -X POST "${LS_URL}/api/webhooks" \
  -H "Authorization: Token ${LS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://backend:3001/api/webhooks/annotation",
    "organization": 1,
    "project": 1,
    "active": true,
    "send_payload": true,
    "actions": [
      "ANNOTATION_CREATED",
      "ANNOTATION_UPDATED",
      "ANNOTATIONS_DELETED"
    ]
  }'
```

**성공 응답 예시:**

```json
{
  "id": 1,
  "url": "http://backend:3001/api/webhooks/annotation",
  "project": 1,
  "active": true,
  "send_payload": true,
  "actions": ["ANNOTATION_CREATED", "ANNOTATION_UPDATED", "ANNOTATIONS_DELETED"]
}
```

### 방법 B: Label Studio UI 사용

1. Label Studio에서 프로젝트 선택
2. Settings → Webhooks 탭
3. "Add Webhook" 클릭
4. 정보 입력:
   - **URL**: `http://backend:3001/api/webhooks/annotation`
   - **Send Payload**: ✅ 체크 (필수!)
   - **Actions**: ANNOTATION_CREATED, ANNOTATION_UPDATED, ANNOTATIONS_DELETED 선택
5. "Save" 클릭

### 등록 확인

```bash
# 등록된 Webhook 목록 확인
curl -X GET "${LS_URL}/api/webhooks" \
  -H "Authorization: Token ${LS_TOKEN}"
```

---

## 테스트 2: 샘플 앱에서 Webhook Monitor 실행

### 1. Frontend 접속

**로컬**: http://hatiolab.localhost:3000
**프로덕션**: https://app.hatiolab.com

### 2. 로그인

"Login as Admin" 또는 "Login as Annotator" 버튼 클릭

### 3. Webhook Monitor 탭 이동

상단의 "🔔 Webhook Monitor" 탭 클릭

### 4. 연결 상태 확인

우측 상단에 "🟢 Connected" 표시 확인

---

## 테스트 3: Annotation 이벤트 발생 및 수신

### 시나리오 A: 일반 사용자 (Annotator) 테스트

1. **Annotator로 로그인**

   ```
   - "Login as Annotator" 클릭
   - annotator@hatiolab.com
   ```

2. **프로젝트 선택**

   ```
   - "📁 Projects" 탭
   - 프로젝트 카드 클릭
   ```

3. **Annotation 생성**

   ```
   - Label Studio에서 Task 선택
   - Annotation 생성 (라벨 추가)
   - "Submit" 클릭
   ```

4. **Webhook Monitor 확인**
   ```
   - "🔔 Webhook Monitor" 탭으로 전환
   - 실시간으로 이벤트 표시됨
   ```

**예상 결과:**

```
🟢 ANNOTATION_CREATED  [14:32:15]
👤 annotator@hatiolab.com
ℹ️  is_superuser: false
✅ PROCESSED: Regular user annotation
```

### 시나리오 B: Superuser (Admin) 테스트

1. **Admin으로 로그인**

   ```
   - "Logout" 클릭
   - "Login as Admin" 클릭
   ```

2. **Annotation 생성**

   ```
   - 프로젝트 선택
   - Annotation 생성
   ```

3. **Webhook Monitor 확인**

**예상 결과:**

```
🟢 ANNOTATION_CREATED  [14:35:22]
👤 admin@hatiolab.com
ℹ️  is_superuser: true
⚠️ SKIPPED: Admin annotation (not used for model performance)
```

### 시나리오 C: 필터링 테스트

1. **여러 사용자로 Annotation 생성**

   ```
   - Admin: 3개 annotation
   - Annotator: 5개 annotation
   - Manager: 2개 annotation
   ```

2. **필터 적용**

   ```
   - "All Events" 클릭 → 10개 표시
   - "Regular Users" 클릭 → 7개 표시 (Annotator + Manager)
   - "Superuser Only" 클릭 → 3개 표시 (Admin만)
   ```

3. **통계 확인**
   ```
   📊 Statistics
   Total Events: 10
   Superuser: 3  |  Users: 7
   ```

---

## 테스트 4: Backend 로그 확인

### 실시간 로그 모니터링

```bash
# Backend 로그 스트리밍
docker compose logs -f backend

# Label Studio 로그 스트리밍
docker compose logs -f labelstudio
```

### Backend Webhook 수신 로그

Annotation 생성 시 Backend 콘솔 출력:

```
============================================================
[Webhook] Received annotation event
============================================================
Action: ANNOTATION_CREATED
User Info:
  - Email: annotator@hatiolab.com
  - Username: annotator1
  - Is Superuser: false
  ✅ PROCESSED: Regular user annotation
Annotation ID: 23
Task ID: 5
============================================================
[Webhook] Broadcasted to 1 SSE clients
```

### Label Studio Webhook 전송 로그

```bash
# Label Studio 로그에서 webhook 관련 로그 필터링
docker compose logs labelstudio | grep -i webhook

# 예상 출력:
# Successfully patched webhooks.utils.emit_webhooks
# Enriched webhook payload for event: ANNOTATION_CREATED
```

---

## 테스트 5: Payload 구조 확인

### 방법 A: Browser Developer Tools

1. Webhook Monitor 탭에서 이벤트 클릭
2. F12 → Console 탭
3. 이벤트 객체 확인

### 방법 B: Backend API 직접 호출

```bash
# 최근 이벤트 조회
curl http://localhost:3001/api/webhooks/events

# 예상 응답:
{
  "success": true,
  "events": [
    {
      "action": "ANNOTATION_CREATED",
      "annotation": {
        "id": 23,
        "task": 5,
        "completed_by": 2,
        "completed_by_info": {
          "id": 2,
          "email": "annotator@hatiolab.com",
          "username": "annotator1",
          "is_superuser": false
        },
        "created_at": "2025-10-26T05:32:15.123Z"
      },
      "receivedAt": "2025-10-26T05:32:15.456Z",
      "id": 1635234735456
    }
  ],
  "total": 1,
  "stats": {
    "total": 1,
    "byAction": { "ANNOTATION_CREATED": 1 },
    "bySuperuser": { "superuser": 0, "regular": 1 },
    "byUser": { "annotator@hatiolab.com": 1 }
  }
}
```

### 방법 C: 직접 Webhook 테스트

Backend에 직접 webhook payload 전송:

```bash
curl -X POST http://localhost:3001/api/webhooks/annotation \
  -H "Content-Type: application/json" \
  -d '{
    "action": "ANNOTATION_CREATED",
    "annotation": {
      "id": 999,
      "task": 1,
      "completed_by": 1,
      "completed_by_info": {
        "id": 1,
        "email": "test@example.com",
        "username": "testuser",
        "is_superuser": false
      }
    }
  }'

# 성공 응답:
# {"success":true,"message":"Webhook received","eventId":...}
```

---

## 테스트 6: completed_by_info 필드 검증

### Label Studio에서 직접 확인

1. **Webhook 수신 시 payload 로깅 활성화**

Backend의 `server.js`에서 전체 payload 출력:

```javascript
// backend/server.js - /api/webhooks/annotation 엔드포인트
console.log("Full Payload:", JSON.stringify(payload, null, 2));
```

2. **Annotation 생성 후 로그 확인**

```bash
docker compose logs backend | grep "Full Payload" -A 30
```

3. **completed_by_info 필드 확인**

```json
{
  "action": "ANNOTATION_CREATED",
  "annotation": {
    "completed_by_info": {
      "id": 2,
      "email": "annotator@hatiolab.com",
      "username": "annotator1",
      "is_superuser": false
    }
  }
}
```

### send_payload 옵션 검증

**send_payload: false인 경우:**

```json
{
  "action": "ANNOTATION_CREATED"
}
```

→ ❌ `completed_by_info` 없음

**send_payload: true인 경우:**

```json
{
  "action": "ANNOTATION_CREATED",
  "annotation": {
    "completed_by_info": { ... }
  }
}
```

→ ✅ `completed_by_info` 포함

---

## 트러블슈팅

### 1. Webhook이 수신되지 않음

**확인 사항:**

```bash
# 1. Webhook 등록 확인
curl -H "Authorization: Token ${LS_TOKEN}" \
  ${LS_URL}/api/webhooks

# 2. Backend 헬스체크
curl http://localhost:3001/api/health

# 3. Docker 네트워크 연결 확인
docker compose exec labelstudio ping backend -c 3

# 4. Webhook URL 확인 (Docker 네트워크 내부 주소 사용)
# ✅ 올바른 URL: http://backend:3001/api/webhooks/annotation
# ❌ 잘못된 URL: http://localhost:3001/api/webhooks/annotation
```

### 2. completed_by_info가 없음

**원인:**

- `send_payload: false`로 설정됨

**해결:**

```bash
# Webhook 업데이트
curl -X PATCH ${LS_URL}/api/webhooks/1 \
  -H "Authorization: Token ${LS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"send_payload": true}'
```

### 3. SSE 연결이 끊김

**증상:**

- Webhook Monitor에 "Disconnected" 표시

**해결:**

```bash
# 1. Backend 재시작
docker compose restart backend

# 2. Frontend 페이지 새로고침 (F5)

# 3. SSE 연결 확인
docker compose logs backend | grep "SSE"
```

### 4. Label Studio에서 custom_webhooks 모듈 로드 실패

**확인:**

```bash
# 로그 확인
docker compose logs labelstudio | grep "custom_webhooks"

# 예상 출력:
# Successfully patched webhooks.utils.emit_webhooks
```

**해결:**

```bash
# 1. 이미지 재빌드
cd /Users/super/Documents/GitHub/label-studio-custom
docker build -t label-studio-custom:latest .

# 2. 컨테이너 재시작
cd /Users/super/Documents/GitHub/label-studio-sso-app
docker compose down
docker compose up -d
```

---

## 성공 기준

✅ **모든 테스트를 통과하면 다음이 확인됩니다:**

1. Label Studio의 webhook에 `completed_by_info` 필드가 포함됨
2. Backend가 실시간으로 webhook 이벤트를 수신함
3. Frontend가 SSE로 실시간 이벤트를 표시함
4. Superuser와 일반 사용자 필터링이 작동함

---

## 다음 단계

### 프로덕션 배포

1. **Label Studio Custom Image 배포**

   ```bash
   cd /Users/super/Documents/GitHub/label-studio-custom
   docker tag label-studio-custom:latest your-registry/label-studio-custom:1.20.0-sso.38
   docker push your-registry/label-studio-custom:1.20.0-sso.38
   ```

2. **환경 변수 설정**

   ```bash
   # .env 파일 업데이트
   LABEL_STUDIO_HOST=https://labelstudio.yourdomain.com
   SESSION_COOKIE_DOMAIN=.yourdomain.com
   SESSION_COOKIE_SECURE=true
   ```

3. **HTTPS 설정**
   - Nginx reverse proxy 설정
   - SSL 인증서 적용

### 모니터링

- Backend webhook 수신 로그 수집
- Webhook 처리 시간 메트릭
- 에러율 모니터링

---

## 참고 자료

- [Label Studio Webhook 공식 문서](https://labelstud.io/guide/webhooks)
- [label-studio-custom README](../label-studio-custom/README.md)
- [Webhook 커스터마이징 가이드](../label-studio-custom/docs/WEBHOOK_GUIDE.md)
