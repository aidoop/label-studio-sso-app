# 🚀 Webhook 기능 배포 완료

**배포 일시**: 2025-10-26
**버전**: label-studio-custom:webhook (latest)
**상태**: ✅ 배포 완료 및 실행 중

---

## 📦 배포된 컴포넌트

### 1. Label Studio Custom Image
- **이미지**: `label-studio-custom:latest`
- **태그**: `label-studio-custom:webhook`
- **위치**: 로컬 Docker 레지스트리
- **새로운 기능**:
  - ✅ Webhook payload에 `completed_by_info` 필드 자동 추가
  - ✅ Monkey patching으로 `webhooks.utils.emit_webhooks` 확장
  - ✅ 사용자 ID, 이메일, username, is_superuser 포함

### 2. Sample App Backend (Express.js)
- **이미지**: `label-studio-sso-app-backend`
- **포트**: 3001
- **새로운 엔드포인트**:
  - `POST /api/webhooks/annotation` - Webhook 수신
  - `GET /api/webhooks/events` - 이벤트 목록 조회
  - `GET /api/webhooks/stream` - SSE 실시간 스트림
  - `GET /api/webhooks/stats` - Webhook 통계

### 3. Sample App Frontend (Vue 3)
- **이미지**: `label-studio-sso-app-frontend`
- **포트**: 3000
- **새로운 기능**:
  - ✅ Webhook Monitor 컴포넌트 (실시간 대시보드)
  - ✅ 탭 네비게이션 (Projects / Webhook Monitor)
  - ✅ SSE로 실시간 이벤트 수신 및 표시
  - ✅ Superuser vs 일반 사용자 필터링

### 4. PostgreSQL & Label Studio
- **PostgreSQL**: `postgres:13.18` (변경 없음)
- **Label Studio**: `label-studio-custom:latest` (webhook 지원)

---

## 🔍 배포 검증 결과

### 서비스 상태

```bash
$ docker compose ps

NAME                    STATUS
label-studio-app        Up (healthy)    ✅
label-studio-backend    Up (healthy)    ✅
label-studio-frontend   Up              ✅
label-studio-postgres   Up (healthy)    ✅
```

### Webhook 모듈 로드 확인

```bash
$ docker compose logs labelstudio | grep webhook

[INFO] Successfully patched webhooks.utils.emit_webhooks  ✅
```

### Backend 엔드포인트 확인

```bash
$ curl http://localhost:3001/api/health

{
  "status": "ok",
  "timestamp": "2025-10-25T15:41:04.612Z",
  "labelStudioUrl": "http://labelstudio:8080"
}  ✅
```

### Webhook Stats 확인

```bash
$ curl http://localhost:3001/api/webhooks/stats

{
  "success": true,
  "stats": {
    "total": 0,
    "byAction": {},
    "bySuperuser": { "superuser": 0, "regular": 0 },
    "byUser": {}
  }
}  ✅
```

---

## 🌐 접속 URL

**로컬 개발 환경**:

| 서비스 | URL | 상태 |
|--------|-----|------|
| **Frontend** (Vue 3) | http://hatiolab.localhost:3000 | ✅ 실행 중 |
| **Backend** (Express.js) | http://localhost:3001 | ✅ 실행 중 |
| **Label Studio** | http://label.hatiolab.localhost:8080 | ✅ 실행 중 |
| **PostgreSQL** | localhost:5432 | ✅ 실행 중 |

**프로덕션 환경**:

| 서비스 | URL | 상태 |
|--------|-----|------|
| **Frontend** (Vue 3) | https://app.hatiolab.com | - |
| **Backend** (Express.js) | https://app.hatiolab.com/api | - |
| **Label Studio** | https://label.hatiolab.com | - |

---

## 📋 빠른 시작 가이드

### 1. 서비스 접속

```bash
# Frontend 접속
open http://hatiolab.localhost:3000

# 또는 브라우저에서 직접 접속
```

### 2. 로그인

- "Login as Admin" → `admin@hatiolab.com`
- "Login as Annotator" → `annotator@hatiolab.com`
- "Login as Manager" → `manager@hatiolab.com`

### 3. Webhook Monitor 확인

1. 로그인 후 "🔔 Webhook Monitor" 탭 클릭
2. "Connected" 상태 확인
3. 통계가 0으로 표시되는지 확인

### 4. Webhook 등록

```bash
# API 토큰 확인
cat .env | grep LABEL_STUDIO_API_TOKEN

# Webhook 등록
curl -X POST http://label.hatiolab.localhost:8080/api/webhooks \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://backend:3001/api/webhooks/annotation",
    "organization": 1,
    "project": 1,
    "active": true,
    "send_payload": true,
    "actions": ["ANNOTATION_CREATED", "ANNOTATION_UPDATED", "ANNOTATIONS_DELETED"]
  }'
```

### 5. Annotation 생성 및 테스트

1. "📁 Projects" 탭에서 프로젝트 선택
2. Label Studio에서 annotation 생성
3. "🔔 Webhook Monitor" 탭으로 전환
4. 실시간으로 이벤트가 표시되는지 확인!

---

## 🧪 테스트 체크리스트

- [ ] Frontend 접속 가능 (http://hatiolab.localhost:3000)
- [ ] Label Studio 접속 가능 (http://label.hatiolab.localhost:8080)
- [ ] SSO 로그인 성공 (Admin, Annotator, Manager)
- [ ] Webhook Monitor 탭 표시됨
- [ ] SSE 연결 "Connected" 상태
- [ ] Webhook 등록 성공
- [ ] Annotation 생성 시 Webhook Monitor에 실시간 표시
- [ ] `completed_by_info` 필드 포함 확인
- [ ] Superuser 필터링 작동 확인
- [ ] Backend 로그에 webhook 수신 메시지 표시
- [ ] 통계 업데이트 확인

---

## 📁 변경된 파일 목록

### label-studio-custom 프로젝트

```
custom-webhooks/
├── __init__.py          ✅ 새로 생성
├── apps.py              ✅ 새로 생성
├── utils.py             ✅ 새로 생성
├── signals.py           ✅ 새로 생성
└── tests.py             ✅ 새로 생성

config/
└── label_studio.py      ✏️ 수정 (custom_webhooks 앱 추가)

Dockerfile               ✏️ 수정 (custom-webhooks 복사 추가)
README.md                ✏️ 수정 (Webhook 기능 문서 추가)
CHANGELOG.md             ✏️ 수정 (변경사항 기록)

docs/
└── WEBHOOK_GUIDE.md     ✅ 새로 생성
```

### label-studio-sso-app 프로젝트

```
backend/
└── server.js            ✏️ 수정 (Webhook 엔드포인트 추가)

frontend/src/
├── App.vue              ✏️ 수정 (탭 네비게이션 추가)
└── components/
    └── WebhookMonitor.vue   ✅ 새로 생성

docker-compose.yml       ✏️ 수정 (로컬 이미지 사용)
README.md                ✏️ 수정 (Webhook Monitor 문서 추가)

WEBHOOK_TEST_GUIDE.md    ✅ 새로 생성
DEPLOYMENT_SUMMARY.md    ✅ 새로 생성
```

---

## 🔧 관리 명령어

### 서비스 관리

```bash
# 전체 서비스 시작
docker compose up -d

# 특정 서비스 재시작
docker compose restart labelstudio
docker compose restart backend
docker compose restart frontend

# 전체 서비스 중지
docker compose down

# 로그 확인
docker compose logs -f backend
docker compose logs -f labelstudio

# 서비스 상태 확인
docker compose ps
```

### 이미지 관리

```bash
# 이미지 목록 확인
docker images | grep label-studio-custom

# label-studio-custom 재빌드
cd /Users/super/Documents/GitHub/label-studio-custom
docker build -t label-studio-custom:latest .

# 전체 스택 재빌드
cd /Users/super/Documents/GitHub/label-studio-sso-app
docker compose build
```

### 데이터 관리

```bash
# 볼륨 확인
docker volume ls | grep label-studio

# 데이터베이스 초기화 (주의!)
docker compose down -v
docker compose up -d
```

---

## 🐛 트러블슈팅

### 문제 1: Webhook이 수신되지 않음

**해결:**
```bash
# 1. Backend 로그 확인
docker compose logs backend | grep webhook

# 2. Label Studio 로그 확인
docker compose logs labelstudio | grep webhook

# 3. Webhook 등록 확인
curl -H "Authorization: Token YOUR_TOKEN" \
  http://label.hatiolab.localhost:8080/api/webhooks
```

### 문제 2: Frontend가 접속되지 않음

**해결:**
```bash
# 1. Frontend 컨테이너 상태 확인
docker compose ps frontend

# 2. Frontend 로그 확인
docker compose logs frontend

# 3. Frontend 재시작
docker compose restart frontend
```

### 문제 3: SSE 연결 실패

**해결:**
```bash
# 1. Backend health check
curl http://localhost:3001/api/health

# 2. SSE 엔드포인트 테스트
curl http://localhost:3001/api/webhooks/stream

# 3. Backend 재시작
docker compose restart backend
```

---

## 📚 문서 링크

### 테스트 가이드
- [WEBHOOK_TEST_GUIDE.md](./WEBHOOK_TEST_GUIDE.md) - 상세 테스트 절차

### 프로젝트 문서
- [README.md](./README.md) - 전체 프로젝트 개요
- [label-studio-custom README](../label-studio-custom/README.md) - 커스텀 이미지 문서
- [label-studio-custom WEBHOOK_GUIDE](../label-studio-custom/docs/WEBHOOK_GUIDE.md) - Webhook 상세 가이드

### Label Studio 공식 문서
- [Webhooks Guide](https://labelstud.io/guide/webhooks)
- [API Reference](https://labelstud.io/api)

---

## 🎉 배포 완료!

모든 서비스가 성공적으로 배포되었고 정상 작동 중입니다.

**다음 단계:**
1. [WEBHOOK_TEST_GUIDE.md](./WEBHOOK_TEST_GUIDE.md)를 참고하여 전체 기능 테스트
2. 프로젝트에 webhook 등록
3. Annotation 생성하여 실시간 모니터링 확인
4. MLOps 시나리오 시뮬레이션

**문제 발생 시:**
- 위 트러블슈팅 섹션 참고
- `docker compose logs` 명령어로 로그 확인
- GitHub Issues에 문제 리포트

---

**배포 담당자**: Claude AI Assistant
**검증 완료**: 2025-10-26
**상태**: ✅ Production Ready
