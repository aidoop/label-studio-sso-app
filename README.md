# Label Studio SSO Integration Test App

Label Studio를 iframe으로 임베딩하여 사용하는 테스트 애플리케이션입니다. SSO 인증, 헤더 숨김, Annotation 소유권 제어 등의 기능을 제공합니다.

## 📋 목차

- [아키텍처](#아키텍처)
- [주요 기능](#주요-기능)
- [빠른 시작](#빠른-시작)
- [상세 가이드](#상세-가이드)
- [커스터마이징](#커스터마이징)
- [문제 해결](#문제-해결)

## 아키텍처

### 서비스 구성

```
Docker Compose 환경:
├── nubison.localhost:3000        → Frontend (Vue 3 + Vite)
├── nubison.localhost:3001        → Backend (Express.js)
└── label.nubison.localhost:8080  → Label Studio 1.20.0 + PostgreSQL 13.18
```

### 서브도메인 쿠키 공유

모든 서비스가 `*.nubison.localhost` 서브도메인을 사용하여 쿠키를 공유합니다:

```javascript
// 쿠키 설정 예시
domain: ".nubison.localhost"  // 모든 *.nubison.localhost에서 접근 가능
```

## 주요 기능

### 1. **SSO 인증 (Native JWT)**

- **방식**: label-studio-sso v6.0.7 (Native JWT)
- **인증 흐름**:
  ```
  Frontend → Backend → Label Studio API
    ↓           ↓              ↓
  사용자 선택  JWT 요청   JWT 토큰 발급
                ↓
            쿠키 설정 (ls_auth_token)
                ↓
            iframe 자동 로그인
  ```
- **지원 사용자**:
  - `admin@hatiolab.com`
  - `user1@nubison.localhost`
  - `user2@nubison.localhost`
  - `annotator@nubison.localhost`

### 2. **hideHeader 기능**

iframe에서 Label Studio 헤더를 완전히 숨기는 기능:

- **URL 파라미터**: `?hideHeader=true`
- **구현 방식**: JavaScript로 `--header-height` CSS 변수 강제 0px 설정
- **효과**:
  - 헤더 완전 제거
  - 전체 화면 활용 (100vh)
  - 깔끔한 UI

### 3. **Annotation Ownership 제어**

사용자가 자신의 annotation만 수정/삭제할 수 있도록 제한:

- **보안 계층**:
  - ✅ **백엔드 API 보안**: `IsAnnotationOwnerOrReadOnly` permission
  - ✅ **완벽한 보안**: Postman, curl 등 직접 API 호출도 차단
- **사용자 경험**:
  - 자신의 annotation: 자유롭게 보기/수정/삭제
  - 다른 사람의 annotation: 보기만 가능, 수정 시도 시 403 에러
  - 관리자: 모든 annotation 수정 가능

### 4. **사용자 전환**

여러 사용자 계정 간 원활한 전환:

- Django 세션 쿠키 자동 클리어
- JWT 토큰 갱신
- iframe 자동 reload

## 빠른 시작

### 사전 요구사항

- Docker Desktop 설치
- 호스트 파일 설정 (자동 설정 스크립트 제공)

### 1. 호스트 설정

```bash
# /etc/hosts 파일에 다음 추가 (자동)
make setup-hosts
```

또는 수동으로:

```bash
sudo nano /etc/hosts

# 다음 라인 추가:
127.0.0.1 nubison.localhost
127.0.0.1 label.nubison.localhost
```

### 2. 환경 변수 설정

```bash
# .env 파일 생성
cp .env.example .env

# .env 파일 편집
# LABEL_STUDIO_API_TOKEN=<your-api-token>
```

**API 토큰 생성 방법**:

```bash
# Label Studio 컨테이너 실행 후
make create-token

# 생성된 토큰을 .env 파일에 복사
```

### 3. Docker Compose 실행

```bash
# 모든 서비스 시작
docker compose up -d

# 로그 확인
docker compose logs -f

# 상태 확인
docker compose ps
```

### 4. 접속

브라우저에서 http://nubison.localhost:3000 접속

## 상세 가이드

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

편의를 위한 Makefile 명령어:

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

### 사용자 관리

#### 초기 사용자 생성

```bash
make setup
```

다음 사용자가 자동으로 생성됩니다:

| 이메일 | 비밀번호 | 역할 |
|--------|----------|------|
| `admin@hatiolab.com` | `admin123` | Admin |
| `user1@nubison.localhost` | `user123` | User |
| `user2@nubison.localhost` | `user123` | User |
| `annotator@nubison.localhost` | `anno123` | Annotator |

#### 수동 사용자 생성

```bash
docker exec -it label-studio-app python manage.py createsuperuser
```

## 커스터마이징

### 디렉토리 구조

```
label-studio-test-app/
├── docker-compose.yml           # Docker Compose 설정
├── .env                         # 환경 변수
├── Dockerfile                   # Label Studio 커스텀 이미지
│
├── config/                      # Label Studio 설정
│   ├── label_studio.py         # Django settings (SSO 통합)
│   └── urls_simple.py          # URL 라우팅
│
├── custom-templates/            # 커스텀 템플릿
│   └── base.html               # hideHeader 기능
│
├── custom-permissions/          # Annotation 소유권 제어
│   ├── __init__.py
│   ├── apps.py
│   ├── permissions.py          # IsAnnotationOwnerOrReadOnly
│   └── mixins.py
│
├── custom-api/                  # API 오버라이드
│   ├── __init__.py
│   ├── urls.py
│   └── annotations.py          # AnnotationAPI override
│
├── backend/                     # Express.js 백엔드
│   ├── server.js               # SSO 토큰 관리
│   └── Dockerfile
│
├── frontend/                    # Vue 3 프론트엔드
│   ├── src/
│   │   └── components/
│   │       └── LabelStudioWrapper.vue
│   └── Dockerfile
│
└── scripts/                     # 초기화 스크립트
    └── setup.sh                # 사용자 생성
```

### hideHeader 기능 커스터마이징

**파일**: `custom-templates/base.html`

```javascript
// hideHeader 감지
function shouldHideHeader() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('hideHeader') === 'true';
}

// CSS 변수 강제 설정
document.documentElement.style.setProperty('--header-height', '0px', 'important');
```

### Annotation Permission 커스터마이징

**파일**: `custom-permissions/permissions.py`

```python
class IsAnnotationOwnerOrReadOnly(BasePermission):
    """
    사용자는 자신의 annotation만 수정/삭제할 수 있습니다.
    """
    def has_object_permission(self, request, view, obj):
        # 읽기는 모두 허용
        if request.method in SAFE_METHODS:
            return True

        # Admin은 모두 허용
        if request.user.is_staff or request.user.is_superuser:
            return True

        # 소유자만 수정/삭제 허용
        return obj.completed_by == request.user
```

### SSO 설정 커스터마이징

**파일**: `config/label_studio.py`

```python
# JWT SSO 설정
JWT_SSO_NATIVE_USER_ID_CLAIM = 'user_id'
JWT_SSO_COOKIE_NAME = 'ls_auth_token'
JWT_SSO_TOKEN_PARAM = 'token'
SSO_TOKEN_EXPIRY = 600  # 10분

# 사용자 자동 생성
SSO_AUTO_CREATE_USERS = True
```

**파일**: `backend/server.js`

```javascript
// 허용된 사용자 목록
const allowedUsers = [
  "admin@hatiolab.com",
  "user1@nubison.localhost",
  "user2@nubison.localhost",
  "annotator@nubison.localhost"
];
```

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
echo $LABEL_STUDIO_API_TOKEN

# 2. 토큰 재생성
make create-token

# 3. .env 파일 업데이트 후 backend 재시작
docker compose restart backend

# 4. 백엔드 로그 확인
docker compose logs -f backend
```

### 헤더가 숨겨지지 않음

```bash
# 1. 브라우저 캐시 클리어
# Cmd + Shift + R (Mac) 또는 Ctrl + Shift + R (Windows)

# 2. 컨테이너 재시작
docker compose restart labelstudio

# 3. URL에 hideHeader 파라미터 확인
# http://label.nubison.localhost:8080/projects/1?hideHeader=true
```

### Annotation 수정 권한 오류

이것은 정상 동작입니다:
- 다른 사용자의 annotation 수정 시도 → 403 Forbidden 에러
- 해결: 자신의 annotation만 수정하거나, admin 계정 사용

### 쿠키가 공유되지 않음

```bash
# 1. 서브도메인 확인
# 모든 서비스가 *.nubison.localhost 사용하는지 확인

# 2. 쿠키 도메인 확인
# 브라우저 개발자 도구 → Application → Cookies → .nubison.localhost

# 3. 환경 변수 확인
docker compose exec labelstudio env | grep COOKIE
```

### PostgreSQL 연결 오류

```bash
# 1. PostgreSQL 상태 확인
docker compose exec postgres pg_isready

# 2. 연결 정보 확인
docker compose exec labelstudio env | grep POSTGRES

# 3. PostgreSQL 재시작
docker compose restart postgres

# 4. 로그 확인
docker compose logs postgres
```

## 개발 환경

### 프론트엔드 개발

```bash
# 로컬에서 개발 서버 실행 (HMR)
cd frontend
npm install
npm run dev

# Docker에서는 자동으로 HMR 지원
```

### 백엔드 개발

```bash
# 로컬에서 개발 서버 실행
cd backend
npm install
npm run dev

# Docker에서는 nodemon으로 자동 재시작
```

### Label Studio 커스터마이징

```bash
# 1. custom-templates/ 또는 custom-permissions/ 수정

# 2. 컨테이너 재시작 (volume mount로 즉시 반영)
docker compose restart labelstudio

# 3. 변경사항 확인
docker compose logs -f labelstudio
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

- [README-DOCKER.md](./README-DOCKER.md) - Docker 상세 가이드
- [QUICKSTART.md](./QUICKSTART.md) - 빠른 시작 가이드
- [TEST_APP_GUIDE.md](./TEST_APP_GUIDE.md) - 상세 사용 가이드
- [Label Studio 공식 문서](https://labelstud.io/guide/)
- [label-studio-sso v6.0.7](https://pypi.org/project/label-studio-sso/6.0.7/)

## 라이선스

MIT License

## 기여

버그 리포트 및 기능 제안은 Issues에 등록해주세요.
