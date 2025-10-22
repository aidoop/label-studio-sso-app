# Label Studio SSO Sample App

> Label Studio 커스텀 이미지를 활용한 SSO 통합 샘플 애플리케이션

[![Docker](https://img.shields.io/badge/docker-compose-blue)](docker-compose.yml)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## 이 프로젝트는 무엇인가?

이 프로젝트는 **Label Studio Custom Image**를 사용하는 완전한 샘플 애플리케이션입니다.

### 구성 요소

```
Docker Compose 환경:
├── Label Studio Custom Image  → label-studio-custom:local (또는 ghcr.io/aidoop/label-studio-custom:1.20.0-sso.5)
├── Express.js Backend         → SSO 토큰 관리 (port 3001)
├── Vue 3 Frontend             → 사용자 인터페이스 (port 3000)
└── PostgreSQL 13.18           → 데이터베이스 (port 5432)
```

### 주요 기능 (Custom Image 제공)

이 샘플 앱은 다음 기능을 가진 **label-studio-custom** 이미지를 사용합니다:

- ✅ **SSO 인증** (label-studio-sso v6.0.7 - 커스텀 빌드)
  - Native JWT 기반 초기 인증
  - JWT → Django Session 전환 (성능 최적화)
  - JWT 토큰은 세션 생성 후 자동 삭제
  - 사용자 전환 시 JWT가 기존 세션보다 우선순위 보장
- ✅ **hideHeader 기능** - iframe에서 헤더 완전 제거
- ✅ **Annotation 소유권 제어** - 자신의 annotation만 수정 가능
- ✅ **원활한 사용자 전환** - 여러 사용자 계정 간 세션 충돌 없이 전환
- ✅ **Sentry 비활성화** - 개발 환경에서 외부 에러 추적 중단

## Quick Start

### 사전 요구사항

- Docker Desktop 설치
- 호스트 파일 설정

### 1. 호스트 설정

```bash
# /etc/hosts 파일에 다음 추가 (자동)
make setup-hosts
```

또는 수동으로:

```bash
sudo nano /etc/hosts

# 다음 라인 추가: (.localhost 로 끝나는 도메인이름인 경우는 꼭 추가하지 않아도 됨)
127.0.0.1 nubison.localhost
127.0.0.1 label.nubison.localhost
```

### 2. 환경 변수 설정

```bash
# .env 파일 생성
cp .env.example .env

# .env 파일 편집 (필요시)
```

### 3. Label Studio Custom Image 준비

#### Option A: 로컬에서 빌드 (개발용)

```bash
# label-studio-custom 저장소 클론
cd /Users/super/Documents/GitHub
git clone https://github.com/your-org/label-studio-custom.git
cd label-studio-custom

# 이미지 빌드
docker build -t label-studio-custom:local .
```

#### Option B: GitHub Container Registry에서 가져오기 (프로덕션)

```bash
# docker-compose.yml 수정
# image: label-studio-custom:local
# → image: ghcr.io/aidoop/label-studio-custom:1.20.0-sso.5

# 이미지 pull
docker pull ghcr.io/aidoop/label-studio-custom:1.20.0-sso.5
```

### 4. Docker Compose 실행

```bash
cd /Users/super/Documents/GitHub/label-studio-test-app

# 모든 서비스 시작
docker compose up -d

# 로그 확인
docker compose logs -f
```

### 5. 초기 사용자 생성

```bash
# 테스트 사용자 자동 생성
make setup
```

**생성되는 계정**:

| 이메일 | 비밀번호 | 역할 |
|--------|----------|------|
| `admin@nubison.io` | `admin123!` | Admin |
| `annotator@nubison.io` | `annotator123!` | Annotator |
| `manager@nubison.io` | `manager123!` | Manager |

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

- **Frontend**: http://nubison.localhost:3000
- **Label Studio**: http://label.nubison.localhost:8080

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
│  │     :8080 (label.nubison.localhost)       │            │
│  └─────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### SSO 인증 흐름

```
Frontend (Vue 3)
    ↓
    사용자 선택 (admin@nubison.io, annotator@nubison.io, manager@nubison.io)
    ↓
Backend (Express.js)
    ↓
    GET /api/sso/token?email=admin@nubison.io
    - Label Studio API로 JWT 토큰 요청
    - 기존 세션 쿠키 삭제 (sessionid, csrftoken)
    ↓
Label Studio API
    ↓
    POST /api/sso/token
    JWT 토큰 발급 (유효기간: 10분)
    ↓
Backend
    ↓
    쿠키 설정 (ls_auth_token)
    domain: .nubison.localhost
    httpOnly: false (디버깅용)
    ↓
Frontend
    ↓
    iframe 로드
    src: http://label.nubison.localhost:8080/projects/1?hideHeader=true
    key: email (사용자 변경 시 iframe 재생성)
    ↓
Label Studio Custom (label-studio-sso 미들웨어)
    ↓
    1. ls_auth_token 쿠키에서 JWT 검증
    2. JWT 유효 → Django 세션 생성 (sessionid)
    3. ls_auth_token 쿠키 삭제 (세션으로 전환)
    ↓
이후 요청들
    ↓
    Django Session만 사용 (빠른 인증, JWT 검증 불필요)
    세션 만료 전까지 유지
```

**인증 전환 메커니즘**:
- **초기 인증**: JWT 토큰 (ls_auth_token) → Django Session (sessionid)
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
            domain=settings.SESSION_COOKIE_DOMAIN  # .nubison.localhost
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
  res.clearCookie('sessionid', {
    domain: '.nubison.localhost',
    path: '/'
  });
  res.clearCookie('csrftoken', {
    domain: '.nubison.localhost',
    path: '/'
  });
}
```

**인증 흐름 전체 정리**:
1. 사용자 선택 → Backend가 기존 세션 쿠키 삭제
2. Backend가 새 JWT 발급 → ls_auth_token 쿠키 설정
3. Frontend iframe 재생성 (`:key="props.email"`)
4. Label Studio 접근 → 미들웨어가 JWT 검증
5. 인증 성공 → Django Session 생성 (sessionid)
6. 미들웨어가 ls_auth_token 자동 삭제
7. 이후 모든 요청은 sessionid만 사용 (빠름!)

## 주요 기능 테스트

### 1. SSO 사용자 전환

```
1. http://nubison.localhost:3000 접속
2. "Login as Admin" 버튼 클릭 (admin@nubison.io)
3. Label Studio에서 프로젝트 선택 및 annotation 생성
4. 브라우저 개발자 도구 → Application → Cookies 확인:
   - ls_auth_token: 초기 로그인 시 생성됨
   - sessionid: 첫 Label Studio 접근 후 생성됨
   - ls_auth_token: sessionid 생성 후 자동 삭제됨
5. "Logout" 버튼 클릭
6. "Login as Annotator" 버튼 클릭 (annotator@nubison.io)
7. iframe이 재생성되고 새로운 사용자로 전환됨 확인
8. 브라우저 콘솔에서 SSO 인증 로그 확인:
   [SSO Middleware] JWT token found in cookie 'ls_auth_token'
   [SSO Middleware] User auto-logged in via JWT: annotator@nubison.io
   [SSO Middleware] JWT → Session: Deleted token cookie 'ls_auth_token'
```

### 2. hideHeader 기능

Label Studio iframe에서 헤더가 숨겨진 것을 확인:

```
URL: http://label.nubison.localhost:8080/projects/1?hideHeader=true
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
│   │   ├── components/
│   │   │   └── LabelStudioWrapper.vue
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

1. [label-studio-custom](https://github.com/your-org/label-studio-custom) 저장소 클론
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
  "admin@nubison.io",
  "annotator@nubison.io",
  "manager@nubison.io"
];
```

**주요 엔드포인트**:
- `GET /api/sso/token?email=<email>` - JWT 토큰 발급/갱신
- `GET /api/projects` - 프로젝트 목록 조회
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
# image: ghcr.io/your-org/label-studio-custom:1.20.0-sso.1
```

### 헤더가 숨겨지지 않음

```bash
# 1. 브라우저 캐시 클리어
# Cmd + Shift + R (Mac) 또는 Ctrl + Shift + R (Windows)

# 2. URL에 hideHeader 파라미터 확인
# http://label.nubison.localhost:8080/projects/1?hideHeader=true

# 3. Custom Image가 최신인지 확인
docker images | grep label-studio-custom
```

## 프로덕션 배포

### 환경 변수 변경

```bash
# .env 파일
LABEL_STUDIO_HOST=https://labelstudio.yourdomain.com
SESSION_COOKIE_DOMAIN=.yourdomain.com
CSRF_COOKIE_DOMAIN=.yourdomain.com
SESSION_COOKIE_SECURE=true
```

### DNS 설정

```
app.yourdomain.com         → Frontend
api.yourdomain.com         → Backend
labelstudio.yourdomain.com → Label Studio
```

### HTTPS 설정

Nginx 또는 Traefik reverse proxy 사용 권장

## 참고 문서

### 이 프로젝트

- [customization/CUSTOMIZATION.md](customization/CUSTOMIZATION.md) - **상세 커스터마이징 문서**
- [QUICKSTART.md](./QUICKSTART.md) - 빠른 시작 가이드
- [CHANGELOG.md](./CHANGELOG.md) - 변경 이력

### Label Studio Custom Image

- [label-studio-custom](https://github.com/your-org/label-studio-custom) - 커스텀 이미지 저장소
- [Custom Image Documentation](https://github.com/your-org/label-studio-custom/blob/main/README.md)

### Label Studio 공식

- [Label Studio 공식 문서](https://labelstud.io/guide/)
- [label-studio-sso v6.0.7](https://pypi.org/project/label-studio-sso/6.0.7/)
- [Label Studio GitHub](https://github.com/HumanSignal/label-studio)

## 라이선스

MIT License

## 기여

버그 리포트 및 기능 제안은 Issues에 등록해주세요.
