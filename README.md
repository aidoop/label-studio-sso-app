# Label Studio SSO Sample App

> Label Studio 커스텀 이미지를 활용한 SSO 통합 샘플 애플리케이션

[![Docker](https://img.shields.io/badge/docker-compose-blue)](docker-compose.yml)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## 이 프로젝트는 무엇인가?

이 프로젝트는 **Label Studio Custom Image**를 사용하는 완전한 샘플 애플리케이션입니다.

### 구성 요소

```
Docker Compose 환경:
├── Label Studio Custom Image  → ghcr.io/aidoop/label-studio-custom:1.20.0-sso.32 (GitHub Container Registry)
├── Express.js Backend         → SSO 토큰 관리 + Webhook 수신 (port 3001)
├── Vue 3 Frontend             → 사용자 인터페이스 + Webhook Monitor (port 3000)
└── PostgreSQL 13.18           → 데이터베이스 (port 5432)
```

### 주요 기능 (Custom Image 제공)

이 샘플 앱은 다음 기능을 가진 **label-studio-custom** 이미지를 사용합니다:

- ✅ **SSO 인증** (label-studio-sso v6.0.8 - 커스텀 빌드)
  - Native JWT 기반 초기 인증
  - JWT → Django Session 전환 (성능 최적화)
  - JWT 토큰은 세션 생성 후 자동 삭제
  - 사용자 전환 시 JWT가 기존 세션보다 우선순위 보장
- ✅ **hideHeader 기능** - iframe에서 헤더 완전 제거
- ✅ **Annotation 소유권 제어** - 자신의 annotation만 수정 가능
- ✅ **Webhook Payload 커스터마이징** - annotation 이벤트에 사용자 정보 자동 추가
  - `completed_by_info` 필드로 사용자 이메일, username, is_superuser 제공
  - MLOps 시스템에서 별도 API 호출 없이 사용자 정보 확인
- ✅ **실시간 Webhook Monitor** - annotation 이벤트 실시간 모니터링 대시보드
  - Server-Sent Events (SSE)로 실시간 푸시
  - Superuser vs 일반 사용자 필터링
  - 이벤트 통계 및 히스토리
- ✅ **Custom Export API (MLOps 통합)** - 필터링된 Task Export API
  - Label Studio 오리지널 Serializer 사용 (표준 호환)
  - 날짜 범위, 모델 버전, 승인자 필터링 ⭐ **v1.20.0-sso.12: 타임존 처리 개선**
  - ISO 8601 타임존 지원 (`2025-01-15T10:30:45+09:00`)
  - PostgreSQL `timestamptz` 사용으로 정확한 타임존 비교
  - 선택적 페이징 지원
  - N+1 쿼리 최적화
  - 엔드포인트: `POST /api/custom/export/`
- ✅ **정적 파일 수집** ⭐ **v1.20.0-sso.12: collectstatic 추가**
  - 빌드 시 정적 파일(JavaScript, CSS) 자동 수집
  - `sw.js` 파일 404 오류 해결
  - 웹 인터페이스 정상 작동 보장
- ✅ **Admin User Management API** ⭐ **v1.20.0-sso.29+**
  - Superuser 생성, 승격, 강등 API
  - 사용자 목록 조회 (is_superuser 포함)
  - API 토큰 자동 생성
  - 엔드포인트: `POST /api/admin/users/create-superuser`, `GET /api/admin/users/list`
- ✅ **Auto Organization Assignment** ⭐ **v1.20.0-sso.27+**
  - Django Signals를 통한 자동 organization 설정
  - 사용자 생성 시 생성자의 organization에 자동 추가
  - active_organization 자동 설정으로 로그인 불가 문제 방지
- ✅ **Custom Version API** ⭐ **v1.20.0-sso.30+**
  - UI에 커스텀 버전 표시 (v1.20.0-sso.32)
  - release 필드 오버라이드로 UI 하단에 커스텀 버전 표시
  - 엔드포인트: `GET /api/version`
- ✅ **원활한 사용자 전환** - 여러 사용자 계정 간 세션 충돌 없이 전환
- ✅ **Sentry 비활성화** - 개발 환경에서 외부 에러 추적 중단

## Quick Start

### 사전 요구사항

- Docker Desktop 설치
- 호스트 파일 설정

### 1. 호스트 설정

**로컬 개발 환경 (테스트용)**:

```bash
sudo nano /etc/hosts

# 다음 라인 추가: (.localhost 로 끝나는 도메인이름인 경우는 꼭 추가하지 않아도 됨)
127.0.0.1 hatiolab.localhost
127.0.0.1 label.hatiolab.localhost
```

**프로덕션 환경**:

DNS A 레코드 설정:
```
app.hatiolab.com     → <서버-IP>
label.hatiolab.com   → <서버-IP>
```

### 2. 환경 변수 설정

```bash
# .env 파일 생성
cp .env.example .env

# .env 파일 편집 (필요시)
# nano .env
```

**주요 환경변수** (로컬 개발 환경 - hatiolab.localhost):

```bash
# SSO App 도메인 설정
FRONTEND_URL=http://hatiolab.localhost:3000      # SSO 앱 프론트엔드 URL
COOKIE_DOMAIN=.hatiolab.localhost                # 쿠키 공유 도메인
CORS_ORIGIN=http://hatiolab.localhost:3000       # CORS 허용 도메인

# Label Studio URL
VITE_LABEL_STUDIO_URL=http://label.hatiolab.localhost:8080

# Label Studio API Token (초기 설정 후 발급)
LABEL_STUDIO_API_TOKEN=YOUR_API_TOKEN_HERE
```

**프로덕션 환경 예시** (hatiolab.com):

```bash
# SSO App 도메인 설정
FRONTEND_URL=https://app.hatiolab.com           # SSO 앱 프론트엔드 URL
COOKIE_DOMAIN=.hatiolab.com                      # 쿠키 공유 도메인
CORS_ORIGIN=https://app.hatiolab.com             # CORS 허용 도메인

# Label Studio URL
VITE_LABEL_STUDIO_URL=https://label.hatiolab.com

# Cookie Secure 플래그 (HTTPS 필수)
SESSION_COOKIE_SECURE=true
CSRF_COOKIE_SECURE=true

# Label Studio API Token
LABEL_STUDIO_API_TOKEN=<production-token>
```

> **중요**: 모든 도메인 관련 하드코딩이 환경변수로 대체되었습니다. 로컬 개발 시에는 hatiolab.localhost를 사용하고, 프로덕션에서는 hatiolab.com으로 `.env` 파일을 통해 설정합니다.

### 3. Label Studio Custom Image 준비

#### Option A: 로컬에서 빌드 (개발용)

```bash
# label-studio-custom 저장소 클론
cd /Users/super/Documents/GitHub
git clone https://github.com/aidoop/label-studio-custom.git
cd label-studio-custom

# 이미지 빌드
docker build -t label-studio-custom:local .
```

#### Option B: GitHub Container Registry에서 가져오기 (권장)

```bash
# docker-compose.yml에서 이미 설정되어 있음:
# image: ghcr.io/aidoop/label-studio-custom:1.20.0-sso.32

# 이미지 pull
docker pull ghcr.io/aidoop/label-studio-custom:1.20.0-sso.32
# 또는 latest 태그 사용 (프로덕션에서는 특정 버전 권장)
docker pull ghcr.io/aidoop/label-studio-custom:latest
```

### 4. Docker Compose 실행

#### 프로덕션 환경 (배포된 이미지) - 권장

배포된 이미지를 사용하여 실행 (기본):

```bash
cd /Users/super/Documents/GitHub/label-studio-test-app

# 모든 서비스 시작
docker compose up -d

# 로그 확인
docker compose logs -f

# 중지
docker compose down
```

**사용되는 이미지**:
- `ghcr.io/aidoop/label-studio-custom:1.20.0-sso.32` - Label Studio
- `ghcr.io/aidoop/label-studio-sso-app:1.0.0` - SSO Sample App
- `postgres:13.18` - PostgreSQL

#### 개발 환경 (로컬 빌드)

로컬에서 코드를 수정하면서 개발:

```bash
# 개발 모드로 실행 (코드 변경 시 자동 반영)
docker compose -f docker-compose.dev.yml up -d

# 로그 확인
docker compose -f docker-compose.dev.yml logs -f

# 중지
docker compose -f docker-compose.dev.yml down
```

### 5. 초기 사용자 생성

```bash
# 테스트 사용자 자동 생성
make setup
```

**생성되는 계정**:

| 이메일 | 비밀번호 | 역할 |
|--------|----------|------|
| `admin@hatiolab.com` | `admin123!` | Admin |
| `annotator@hatiolab.com` | `annotator123!` | Annotator |
| `manager@hatiolab.com` | `manager123!` | Manager |

### 6. API 토큰 생성

```bash
# API 토큰 생성
make create-token

# 생성된 토큰을 .env 파일에 추가
echo "LABEL_STUDIO_API_TOKEN=<your-token>" >> .env

# Backend 재시작
docker compose restart backend
```

### 7. 접속

브라우저에서 다음 URL 접속:

**로컬 개발 환경**:
- **Frontend**: http://hatiolab.localhost:3000
- **Label Studio**: http://label.hatiolab.localhost:8080

**프로덕션 환경**:
- **Frontend**: https://app.hatiolab.com
- **Label Studio**: https://label.hatiolab.com

## 아키텍처

### 서비스 구성

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Compose                          │
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   │
│  │  PostgreSQL  │   │   Backend    │   │  Frontend    │   │
│  │   :5432      │   │  Express.js  │   │   Vue 3      │   │
│  │              │◄──┤   :3001      │◄──┤   :3000      │   │
│  └──────────────┘   └──────┬───────┘   └──────────────┘   │
│         ▲                  │                                │
│         │                  │                                │
│         │                  ▼                                │
│  ┌──────┴─────────────────────────────────────┐            │
│  │     Label Studio Custom Image              │            │
│  │     (label-studio-custom:local)            │            │
│  │                                             │            │
│  │  • SSO 인증 (Native JWT)                   │            │
│  │  • hideHeader 기능                         │            │
│  │  • Annotation 소유권 제어                  │            │
│  │                                             │            │
│  │     :8080 (label.hatiolab.localhost)      │            │
│  └─────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### SSO 인증 흐름

```
Frontend (Vue 3)
    ↓
    사용자 선택 (admin@hatiolab.com, annotator@hatiolab.com, manager@hatiolab.com)
    ↓
Backend (Express.js)
    ↓
    GET /api/sso/token?email=admin@hatiolab.com
    - Label Studio API로 JWT 토큰 요청
    - 기존 세션 쿠키 삭제 (ls_sessionid, ls_csrftoken)
    ↓
Label Studio API
    ↓
    POST /api/sso/token
    JWT 토큰 발급 (유효기간: 10분)
    ↓
Backend
    ↓
    쿠키 설정 (ls_auth_token)
    domain: .hatiolab.localhost (로컬) 또는 .hatiolab.com (프로덕션)
    httpOnly: false (디버깅용)
    ↓
Frontend
    ↓
    iframe 로드
    src: http://label.hatiolab.localhost:8080/projects/1?hideHeader=true (로컬)
    src: https://label.hatiolab.com/projects/1?hideHeader=true (프로덕션)
    key: email (사용자 변경 시 iframe 재생성)
    ↓
Label Studio Custom (label-studio-sso 미들웨어)
    ↓
    1. ls_auth_token 쿠키에서 JWT 검증
    2. JWT 유효 → Django 세션 생성 (ls_sessionid)
    3. ls_auth_token 쿠키 삭제 (세션으로 전환)
    ↓
이후 요청들
    ↓
    Django Session만 사용 (빠른 인증, JWT 검증 불필요)
    세션 만료 전까지 유지
```

**인증 전환 메커니즘**:
- **초기 인증**: JWT 토큰 (ls_auth_token) → Django Session (ls_sessionid)
- **사용자 전환**: 새 JWT 발급 → iframe 재생성 → 새 세션 생성
- **성능 최적화**: JWT 검증은 최초 1회만, 이후 세션 사용

### 핵심 구현 상세

#### 1. label-studio-sso 커스텀 미들웨어

**파일**: `label-studio-sso/label_studio_sso/middleware.py`

**주요 변경사항**:
```python
# middleware.py - process_request()
def process_request(self, request):
    # JWT 토큰이 있으면 기존 세션을 무시하고 JWT로 인증
    # (기존 if request.user.is_authenticated: return 로직 제거)

    token = request.COOKIES.get(cookie_name)  # ls_auth_token
    if token:
        user = self.jwt_backend.authenticate(request, token=token)
        if user:
            login(request, user, backend=auth_backend)
            request._jwt_authenticated = True  # 플래그 설정
```

```python
# middleware.py - process_response()
def process_response(self, request, response):
    # JWT 인증 성공 후 세션 생성 → JWT 토큰 쿠키 삭제
    if getattr(request, "_jwt_authenticated", False):
        response.delete_cookie(
            cookie_name,  # ls_auth_token
            path="/",
            domain=settings.SESSION_COOKIE_DOMAIN  # .hatiolab.localhost (로컬) 또는 .hatiolab.com (프로덕션)
        )
```

**왜 이렇게 구현했나?**
- 사용자 전환 시 기존 세션이 남아있어도 새 JWT가 우선순위를 가짐
- JWT 검증 후 Django Session으로 전환하여 성능 향상
- 불필요한 JWT 토큰 쿠키는 자동 삭제하여 보안 강화

#### 2. Frontend iframe 재생성

**파일**: `frontend/src/components/LabelStudioWrapper.vue`

```vue
<iframe
  :key="props.email"  ← 사용자 변경 시 완전히 새로운 iframe 생성
  :src="iframeUrl"
  ...
></iframe>
```

**왜 key를 사용하나?**
- Vue의 key 변경 시 컴포넌트를 완전히 재생성
- 사용자 전환 시 iframe 내부 상태 완전 초기화
- 새 사용자의 JWT로 깨끗한 인증 시작

#### 3. Backend 세션 쿠키 삭제

**파일**: `backend/server.js`

```javascript
function clearSessionCookies(res) {
  // 사용자 전환 시 기존 Label Studio 세션 쿠키 삭제
  res.clearCookie('ls_sessionid', {
    domain: COOKIE_DOMAIN,  // .hatiolab.localhost (로컬) 또는 .hatiolab.com (프로덕션)
    path: '/'
  });
  res.clearCookie('ls_csrftoken', {
    domain: COOKIE_DOMAIN,  // 환경변수로 설정
    path: '/'
  });
}
```

**인증 흐름 전체 정리**:
1. 사용자 선택 → Backend가 기존 세션 쿠키 삭제
2. Backend가 새 JWT 발급 → ls_auth_token 쿠키 설정
3. Frontend iframe 재생성 (`:key="props.email"`)
4. Label Studio 접근 → 미들웨어가 JWT 검증
5. 인증 성공 → Django Session 생성 (ls_sessionid)
6. 미들웨어가 ls_auth_token 자동 삭제
7. 이후 모든 요청은 ls_sessionid만 사용 (빠름!)

## 주요 기능 테스트

### 1. SSO 사용자 전환

```
1. http://hatiolab.localhost:3000 접속 (로컬 개발)
   또는 https://app.hatiolab.com 접속 (프로덕션)
2. "Login as Admin" 버튼 클릭 (admin@hatiolab.com)
3. Label Studio에서 프로젝트 선택 및 annotation 생성
4. 브라우저 개발자 도구 → Application → Cookies 확인:
   - ls_auth_token: 초기 로그인 시 생성됨
   - ls_sessionid: 첫 Label Studio 접근 후 생성됨
   - ls_auth_token: ls_sessionid 생성 후 자동 삭제됨
5. "Logout" 버튼 클릭
6. "Login as Annotator" 버튼 클릭 (annotator@hatiolab.com)
7. iframe이 재생성되고 새로운 사용자로 전환됨 확인
8. 브라우저 콘솔에서 SSO 인증 로그 확인:
   [SSO Middleware] JWT token found in cookie 'ls_auth_token'
   [SSO Middleware] User auto-logged in via JWT: annotator@hatiolab.com
   [SSO Middleware] JWT → Session: Deleted token cookie 'ls_auth_token'
```

### 2. hideHeader 기능

Label Studio iframe에서 헤더가 숨겨진 것을 확인:

```
로컬: http://label.hatiolab.localhost:8080/projects/1?hideHeader=true
프로덕션: https://label.hatiolab.com/projects/1?hideHeader=true
```

### 3. Annotation Ownership 제어

```
1. admin으로 annotation 생성
2. user1으로 로그인
3. admin이 만든 annotation 열기
4. 수정 시도 → 403 에러 발생 (정상)
5. user1 자신의 annotation 생성
6. 수정/삭제 가능 (정상)
```

### 4. Webhook Monitor (실시간 이벤트 모니터링)

#### Webhook 등록

먼저 Label Studio에서 webhook을 등록합니다:

```bash
# API 토큰 확인
cat .env | grep LABEL_STUDIO_API_TOKEN

# Webhook 등록 (curl 사용)
# 로컬 개발 환경
curl -X POST http://label.hatiolab.localhost:8080/api/webhooks \
  -H "Authorization: Token YOUR_API_TOKEN" \
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

# 프로덕션 환경
curl -X POST https://label.hatiolab.com/api/webhooks \
  -H "Authorization: Token YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://app.hatiolab.com/api/webhooks/annotation",
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

**주의사항**:
- `send_payload: true`로 설정해야 `completed_by_info` 필드가 포함됩니다
- `url`은 Docker 네트워크 내부 주소를 사용 (`backend:3001`)
- 프로젝트마다 별도로 webhook을 등록해야 합니다

#### Webhook Monitor 사용

1. **접속**:
   - 로컬: http://hatiolab.localhost:3000 로그인 후 "🔔 Webhook Monitor" 탭 클릭
   - 프로덕션: https://app.hatiolab.com 로그인 후 "🔔 Webhook Monitor" 탭 클릭

2. **실시간 모니터링**:
   - SSE (Server-Sent Events)로 실시간 이벤트 자동 표시
   - 연결 상태: 우측 상단 "Connected" 표시 확인

3. **Annotation 생성 테스트**:
   ```
   1. "📁 Projects" 탭에서 프로젝트 선택
   2. Label Studio에서 annotation 생성/수정/삭제
   3. "🔔 Webhook Monitor" 탭으로 전환
   4. 실시간으로 이벤트가 표시되는 것을 확인
   ```

4. **이벤트 필터링**:
   - **All Events**: 모든 이벤트 표시
   - **Regular Users**: 일반 사용자 이벤트만 표시
   - **Superuser Only**: Admin 이벤트만 표시

5. **이벤트 정보 확인**:
   ```json
   {
     "action": "ANNOTATION_CREATED",
     "annotation": {
       "id": 17,
       "completed_by_info": {
         "id": 1,
         "email": "annotator@hatiolab.com",
         "username": "annotator1",
         "is_superuser": false
       }
     }
   }
   ```

6. **Superuser 필터링 시연**:
   ```
   1. Admin으로 로그인하여 annotation 생성
      → "⚠️ SKIPPED: Admin annotation" 표시

   2. Annotator로 로그인하여 annotation 생성
      → "✅ PROCESSED: Regular user annotation" 표시
   ```

#### Backend 로그 확인

```bash
# Webhook 수신 로그 확인
docker compose logs -f backend

# 예상 출력:
============================================================
[Webhook] Received annotation event
============================================================
Action: ANNOTATION_CREATED
User Info:
  - Email: annotator@hatiolab.com
  - Username: annotator1
  - Is Superuser: false
  ✅ PROCESSED: Regular user annotation
Annotation ID: 17
Task ID: 19
============================================================
```

#### Webhook Endpoints

샘플 앱의 Backend에서 제공하는 Webhook 관련 엔드포인트:

- `POST /api/webhooks/annotation` - Label Studio에서 호출 (Webhook 수신)
- `GET /api/webhooks/events` - 이벤트 목록 조회
- `GET /api/webhooks/stream` - SSE 실시간 스트림
- `GET /api/webhooks/stats` - Webhook 통계

#### MLOps 시나리오 시뮬레이션

이 Webhook Monitor는 다음과 같은 MLOps 시나리오를 시뮬레이션합니다:

```javascript
// backend/server.js의 Webhook Handler 예시
if (userInfo.is_superuser) {
  console.log("⚠️  SKIPPED: Admin user annotation");
  // Admin annotation은 모델 성능 계산에서 제외
} else {
  console.log("✅ PROCESSED: Regular user annotation");
  // 일반 사용자 annotation만 사용하여 모델 성능 계산
  // calculateModelPerformance(payload);
}
```

**실무 활용 예시**:
1. Annotator가 annotation 생성 → Webhook 발생
2. MLOps 시스템이 annotation 수신
3. `completed_by_info.is_superuser === false` 확인
4. AI 모델 예측 결과와 비교하여 성능 계산
5. 백엔드에 성능 지표 전송
6. 성능 저하 시 알림 메일 발송

## 개발 가이드

### 디렉토리 구조

```
label-studio-sso-app/
├── docker-compose.yml           # 전체 스택 설정
├── .env.example                 # 환경 변수 템플릿
├── Makefile                     # 편의 명령어
│
├── backend/                     # Express.js SSO 백엔드
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   └── ...
│
├── frontend/                    # Vue 3 프론트엔드
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   ├── src/
│   │   ├── App.vue             # 메인 앱 (탭 네비게이션)
│   │   ├── components/
│   │   │   ├── LabelStudioWrapper.vue  # Label Studio iframe
│   │   │   └── WebhookMonitor.vue      # Webhook 실시간 모니터
│   │   └── ...
│   └── ...
│
└── docs/                        # 문서
    ├── QUICKSTART.md
    └── TROUBLESHOOTING.md
```

### Docker Compose 명령어

```bash
# 서비스 시작
docker compose up -d

# 특정 서비스만 시작
docker compose up -d labelstudio
docker compose up -d backend
docker compose up -d frontend

# 서비스 재시작
docker compose restart labelstudio

# 서비스 중지
docker compose down

# 볼륨까지 삭제
docker compose down -v

# 로그 확인
docker compose logs -f labelstudio
docker compose logs --tail=100 backend

# 상태 확인
docker compose ps
```

### Makefile 명령어

```bash
# 호스트 설정
make setup-hosts

# 초기 설정 (사용자 생성)
make setup

# API 토큰 생성
make create-token

# 로그 확인
make logs

# 데이터베이스 초기화
make reset-db
```

### 로컬 개발

#### Frontend 개발

```bash
cd frontend
npm install
npm run dev

# 브라우저에서 http://localhost:3000 접속
```

#### Backend 개발

```bash
cd backend
npm install
npm run dev

# API: http://localhost:3001
```

## 커스터마이징

### Label Studio Custom Image 수정

이 샘플 앱이 사용하는 Label Studio Custom Image를 수정하려면:

1. [label-studio-custom](https://github.com/aidoop/label-studio-custom) 저장소 클론
2. 커스터마이징 수정 (config/, custom-permissions/, custom-api/, custom-templates/)
3. 로컬에서 이미지 빌드:
   ```bash
   docker build -t label-studio-custom:local .
   ```
4. 샘플 앱에서 재시작:
   ```bash
   cd /Users/super/Documents/GitHub/label-studio-test-app
   docker compose restart labelstudio
   ```

### Backend SSO 로직 수정

**파일**: `backend/server.js`

```javascript
// 허용된 사용자 목록
const allowedUsers = [
  "admin@hatiolab.com",
  "annotator@hatiolab.com",
  "manager@hatiolab.com"
];
```

**주요 엔드포인트**:
- `GET /api/sso/token?email=<email>` - JWT 토큰 발급/갱신
- `GET /api/projects` - 프로젝트 목록 조회
- `POST /api/webhooks/annotation` - Webhook 이벤트 수신
- `GET /api/webhooks/events` - Webhook 이벤트 목록 조회
- `GET /api/webhooks/stream` - SSE 실시간 스트림
- `GET /api/health` - 헬스체크

### Frontend UI 수정

**파일**: `frontend/src/components/LabelStudioWrapper.vue`

```vue
<!-- 사용자 전환 시 iframe 재생성 -->
<iframe
  :key="props.email"
  :src="iframeUrl"
  ...
></iframe>
```

```javascript
// hideHeader 파라미터 추가
const params = new URLSearchParams();
params.set("hideHeader", "true");
params.set("_t", Date.now().toString());

iframeUrl.value = `${LABEL_STUDIO_URL}/projects/${
  props.projectId
}?${params.toString()}`;
```

**주요 구현**:
- `:key="props.email"`: 사용자 변경 시 iframe 완전히 재생성
- Django Session 사용으로 JWT 자동 갱신 로직 제거

## 문제 해결

### Label Studio 컨테이너가 시작되지 않음

```bash
# 로그 확인
docker compose logs labelstudio

# PostgreSQL 연결 확인
docker compose exec postgres pg_isready

# 볼륨 초기화
docker compose down -v
docker compose up -d
```

### SSO 로그인 실패

```bash
# 1. API 토큰 확인
cat .env | grep API_TOKEN

# 2. 토큰 재생성
make create-token

# 3. .env 파일 업데이트 후 backend 재시작
docker compose restart backend

# 4. 백엔드 로그 확인
docker compose logs -f backend
```

### 이미지를 찾을 수 없음 (Image not found)

```bash
# Option A: 로컬에서 빌드
cd /Users/super/Documents/GitHub/label-studio-custom
docker build -t label-studio-custom:local .

# Option B: docker-compose.yml에서 이미지 주소 확인
# image: ghcr.io/aidoop/label-studio-custom:1.20.0-sso.32
```

### 헤더가 숨겨지지 않음

```bash
# 1. 브라우저 캐시 클리어
# Cmd + Shift + R (Mac) 또는 Ctrl + Shift + R (Windows)

# 2. URL에 hideHeader 파라미터 확인
# 로컬: http://label.hatiolab.localhost:8080/projects/1?hideHeader=true
# 프로덕션: https://label.hatiolab.com/projects/1?hideHeader=true

# 3. Custom Image가 최신인지 확인
docker images | grep label-studio-custom
```

## 프로덕션 배포

### 환경 변수 변경

프로덕션 환경에서는 `.env` 파일에 다음 변수들을 설정합니다:

**예시: hatiolab.com 도메인**

```bash
# ==============================================================================
# SSO App 설정
# ==============================================================================
FRONTEND_URL=https://app.hatiolab.com
COOKIE_DOMAIN=.hatiolab.com
CORS_ORIGIN=https://app.hatiolab.com

# ==============================================================================
# Label Studio 설정
# ==============================================================================
# Label Studio 접속 URL
LABEL_STUDIO_HOST=https://label.hatiolab.com
VITE_LABEL_STUDIO_URL=https://label.hatiolab.com

# 쿠키 보안 설정 (HTTPS 필수)
SESSION_COOKIE_DOMAIN=.hatiolab.com
CSRF_COOKIE_DOMAIN=.hatiolab.com
SESSION_COOKIE_SECURE=1
CSRF_COOKIE_SECURE=1

# ==============================================================================
# API Token
# ==============================================================================
LABEL_STUDIO_API_TOKEN=<production-api-token>

# ==============================================================================
# 데이터베이스
# ==============================================================================
POSTGRES_DB=labelstudio_prod
POSTGRES_USER=labelstudio
POSTGRES_PASSWORD=<strong-password>
```

### DNS 설정

**도메인 구조** (hatiolab.com 예시):

```
app.hatiolab.com           → SSO App Frontend (포트 3000)
label.hatiolab.com         → Label Studio (포트 8080)
```

**A 레코드 설정**:
```
app.hatiolab.com           → <서버-IP>
label.hatiolab.com         → <서버-IP>
```

### HTTPS 설정

Nginx 또는 Traefik reverse proxy 사용 권장:

**Nginx 설정 예시**:

```nginx
# app.hatiolab.com (SSO App)
server {
    listen 443 ssl http2;
    server_name app.hatiolab.com;

    ssl_certificate /etc/letsencrypt/live/app.hatiolab.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.hatiolab.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# label.hatiolab.com (Label Studio)
server {
    listen 443 ssl http2;
    server_name label.hatiolab.com;

    ssl_certificate /etc/letsencrypt/live/label.hatiolab.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/label.hatiolab.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 배포 체크리스트

- [ ] DNS A 레코드 설정 완료
- [ ] SSL/TLS 인증서 발급 (Let's Encrypt 권장)
- [ ] `.env` 파일 환경변수 설정 완료
- [ ] `SESSION_COOKIE_SECURE=1` 및 `CSRF_COOKIE_SECURE=1` 설정
- [ ] 강력한 데이터베이스 비밀번호 설정
- [ ] Label Studio API 토큰 발급 및 설정
- [ ] 방화벽 규칙 설정 (포트 80, 443만 개방)
- [ ] 정기 백업 설정 (PostgreSQL 볼륨)

## 업그레이드 가이드

### v1.20.0-sso.13 → v1.20.0-sso.14

**주요 변경사항:**
- ✅ sw.js 파일 라우팅 경로 수정
- ✅ Service Worker 500 Internal Server Error 해결
- ✅ URL 패턴에서 정확한 정적 파일 경로 사용 (`static_build/js/sw.js`)

**업그레이드 방법:**

```bash
# 1. docker-compose.yml에서 이미지 버전 확인
# image: ghcr.io/aidoop/label-studio-custom:1.20.0-sso.14

# 2. 컨테이너 업데이트
docker compose down
docker compose pull labelstudio
docker compose up -d

# 3. 동작 확인
# Service Worker 파일 정상 로드 확인
curl -I http://localhost:8080/sw.js
# HTTP 200 OK 응답 확인
```

### v1.20.0-sso.12 → v1.20.0-sso.13

**주요 변경사항:**
- ✅ 쿠키 이름 충돌 방지: `ls_sessionid`, `ls_csrftoken`
- ✅ 같은 도메인에서 여러 Django 앱 실행 시 충돌 방지
- ✅ label-studio-sso v6.0.7 패키지 업데이트
- ✅ SESSION_COOKIE_NAME, CSRF_COOKIE_NAME 설정 추가

**업그레이드 방법:**

```bash
# 1. docker-compose.yml에서 이미지 버전 확인
# image: ghcr.io/aidoop/label-studio-custom:1.20.0-sso.13

# 2. 기존 세션 쿠키 자동 정리됨 (사용자 재로그인 필요)
# 3. 컨테이너 업데이트
docker compose down
docker compose pull labelstudio
docker compose up -d

# 4. 동작 확인
# - 브라우저 개발자 도구 → Application → Cookies
# - 새로운 쿠키 이름 확인: ls_sessionid, ls_csrftoken
```

### v1.20.0-sso.11 → v1.20.0-sso.12

**주요 변경사항:**
- ✅ Static Files Collection 추가 (`sw.js` 파일 404 오류 해결)
- ✅ Custom Export API 날짜 필터 타임존 처리 개선
- ✅ 프로젝트 구조 개선 (scripts/ 디렉토리 통합)

**업그레이드 방법:**

```bash
# 1. docker-compose.yml 확인
# image: ghcr.io/aidoop/label-studio-custom:1.20.0-sso.13

# 2. 컨테이너 중지 및 이미지 업데이트
docker compose down
docker compose pull labelstudio

# 3. 컨테이너 재시작
docker compose up -d

# 4. 로그 확인
docker compose logs -f labelstudio

# 5. 동작 확인
# - 웹 인터페이스 접속 확인
# - Custom Export API 날짜 필터 테스트
curl -X POST http://localhost:8080/api/custom/export/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 1,
    "search_from": "2025-01-15T10:00:00+09:00",
    "search_to": "2025-01-20T18:00:00+09:00"
  }'
```

**주의사항:**
- 데이터베이스 백업 권장
- 다운타임 없이 업그레이드 가능 (데이터베이스 스키마 변경 없음)

## 참고 문서

### 이 프로젝트

- [QUICKSTART.md](./QUICKSTART.md) - 빠른 시작 가이드
- [CHANGELOG.md](./CHANGELOG.md) - 변경 이력

### Label Studio Custom Image

- [label-studio-custom](https://github.com/aidoop/label-studio-custom) - 커스텀 이미지 저장소
- [Custom Image Documentation](https://github.com/aidoop/label-studio-custom/blob/main/README.md)

### Label Studio 공식

- [Label Studio 공식 문서](https://labelstud.io/guide/)
- [label-studio-sso v6.0.7](https://pypi.org/project/label-studio-sso/6.0.7/)
- [Label Studio GitHub](https://github.com/HumanSignal/label-studio)

## 라이선스

MIT License

## 기여

버그 리포트 및 기능 제안은 Issues에 등록해주세요.
