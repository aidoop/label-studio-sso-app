# Label Studio SSO 빠른 시작 가이드

## 🚀 5분 안에 시작하기

### 1단계: /etc/hosts 설정

**로컬 개발 환경**:

```bash
# macOS/Linux
sudo nano /etc/hosts

# 다음 2줄 추가:
127.0.0.1       hatiolab.localhost
127.0.0.1       label.hatiolab.localhost
```

**Windows**: 관리자 권한 메모장으로 `C:\Windows\System32\drivers\etc\hosts` 편집

**프로덕션 환경**:

DNS A 레코드 설정:
```
app.hatiolab.com     → <서버-IP>
label.hatiolab.com   → <서버-IP>
```

---

### 2단계: 환경 변수 설정

```bash
# .env 파일 생성 (권장)
cp .env.example .env

# 또는 최소 설정으로 시작 (로컬 개발용)
cat > .env << EOF
# 데이터베이스
POSTGRES_PASSWORD=postgres

# Label Studio 쿠키 설정 (서브도메인 간 공유)
SESSION_COOKIE_DOMAIN=.hatiolab.localhost
CSRF_COOKIE_DOMAIN=.hatiolab.localhost

# SSO App 설정 (도메인 구성)
FRONTEND_URL=http://hatiolab.localhost:3000
COOKIE_DOMAIN=.hatiolab.localhost
CORS_ORIGIN=http://hatiolab.localhost:3000

# Frontend 설정
VITE_LABEL_STUDIO_URL=http://label.hatiolab.localhost:8080
EOF
```

**프로덕션 환경**:

`.env.example` 파일을 복사한 후 도메인을 hatiolab.com으로 변경:

```bash
cp .env.example .env
nano .env

# 다음 변수들을 프로덕션 도메인으로 변경:
FRONTEND_URL=https://app.hatiolab.com
COOKIE_DOMAIN=.hatiolab.com
VITE_LABEL_STUDIO_URL=https://label.hatiolab.com
SESSION_COOKIE_SECURE=1
CSRF_COOKIE_SECURE=1
```

---

### 3단계: Docker Compose 실행

```bash
# 모든 서비스 시작
docker compose up -d

# 로그 확인 (선택사항)
docker compose logs -f

# 상태 확인
docker compose ps
```

**예상 출력**:
```
 Container label-studio-postgres  Running
 Container label-studio-app       Running
 Container label-studio-backend   Running
 Container label-studio-frontend  Running
```

---

### 4단계: 초기 설정

#### 4-1. 사용자 생성

```bash
make setup
```

**생성되는 계정**:

| 이메일 | 비밀번호 | 역할 |
|--------|----------|------|
| `admin@hatiolab.com` | `admin123!` | Admin |
| `annotator@hatiolab.com` | `annotator123!` | Annotator |
| `manager@hatiolab.com` | `manager123!` | Manager |

#### 4-2. API 토큰 생성

```bash
make create-token
```

**출력 예시**:
```
Token for admin@hatiolab.com: 1a2b3c4d5e6f7g8h9i0j
```

**.env 파일에 토큰 추가**:
```bash
echo "LABEL_STUDIO_API_TOKEN=1a2b3c4d5e6f7g8h9i0j" >> .env
```

**Backend 재시작**:
```bash
docker compose restart backend
```

---

### 5단계: 접속 및 테스트

#### Label Studio 직접 접속

**로컬 개발**:
```
http://label.hatiolab.localhost:8080
```

**프로덕션**:
```
https://label.hatiolab.com
```

- 위에서 생성한 계정으로 로그인
- 프로젝트 생성 및 작업 추가

#### 테스트 앱 접속

**로컬 개발**:
```
http://hatiolab.localhost:3000
```

**프로덕션**:
```
https://app.hatiolab.com
```

- 사용자 선택 (admin@hatiolab.com, annotator@hatiolab.com, manager@hatiolab.com)
- "Login as Admin" (또는 다른 사용자) 버튼 클릭
- Label Studio iframe 자동 로드

---

## ✨ 주요 기능 테스트

### 1. SSO 사용자 전환

```
1. http://hatiolab.localhost:3000 접속 (로컬) 또는 https://app.hatiolab.com (프로덕션)
2. "Login as Admin" 버튼 클릭 (admin@hatiolab.com)
3. Label Studio에서 annotation 생성
4. 브라우저 개발자 도구 → Application → Cookies 확인:
   - ls_auth_token: 초기 로그인 시 생성됨
   - ls_sessionid: 첫 Label Studio 접근 후 생성됨
   - ls_auth_token: ls_sessionid 생성 후 자동 삭제됨
5. "Logout" 버튼 클릭
6. "Login as Annotator" 버튼 클릭 (annotator@hatiolab.com)
7. iframe이 재생성되고 새로운 사용자로 전환됨 확인
8. 같은 task 열어서 다른 사용자로 로그인되었는지 확인
```

**콘솔 로그 확인**:
```
[SSO Middleware] JWT token found in cookie 'ls_auth_token'
[SSO Middleware] User auto-logged in via JWT: admin@hatiolab.com
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

---

## 🔧 자주 사용하는 명령어

### Docker Compose

```bash
# 서비스 시작
docker compose up -d

# 특정 서비스만 시작
docker compose up -d labelstudio
docker compose up -d backend

# 서비스 중지
docker compose down

# 서비스 재시작
docker compose restart labelstudio

# 로그 확인
docker compose logs -f labelstudio
docker compose logs --tail=100 backend

# 상태 확인
docker compose ps

# 완전 삭제 (볼륨 포함)
docker compose down -v
```

### Makefile 명령어

```bash
# 호스트 설정
make setup-hosts

# 초기 사용자 생성
make setup

# API 토큰 생성
make create-token

# 로그 확인
make logs

# 데이터베이스 초기화
make reset-db
```

### 컨테이너 접속

```bash
# Label Studio 컨테이너
docker exec -it label-studio-app bash

# PostgreSQL 컨테이너
docker exec -it label-studio-postgres psql -U postgres -d labelstudio

# Backend 컨테이너
docker exec -it label-studio-backend sh

# Frontend 컨테이너
docker exec -it label-studio-frontend sh
```

---

## 🆘 문제 해결

### 도메인 접속 안 됨

```bash
# 1. /etc/hosts 확인
cat /etc/hosts | grep hatiolab

# 2. 올바른 항목이 있는지 확인
# 127.0.0.1 hatiolab.localhost
# 127.0.0.1 label.hatiolab.localhost

# 3. DNS 캐시 초기화
# macOS
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Linux
sudo systemd-resolve --flush-caches

# Windows
ipconfig /flushdns
```

### 컨테이너가 시작되지 않음

```bash
# 1. 로그 확인
docker compose logs labelstudio

# 2. PostgreSQL 먼저 확인
docker compose ps postgres
docker compose exec postgres pg_isready

# 3. 볼륨 초기화 후 재시작
docker compose down -v
docker compose up -d

# 4. 포트 충돌 확인
lsof -i :8080  # Label Studio
lsof -i :3000  # Frontend
lsof -i :3001  # Backend
lsof -i :5432  # PostgreSQL
```

### SSO 로그인 실패

```bash
# 1. API 토큰 확인
cat .env | grep API_TOKEN

# 2. 토큰이 없으면 생성
make create-token

# 3. .env 파일에 추가
echo "LABEL_STUDIO_API_TOKEN=your-token-here" >> .env

# 4. Backend 재시작
docker compose restart backend

# 5. Backend 로그 확인
docker compose logs -f backend
```

### 쿠키 공유 안 됨

```bash
# 1. 환경 변수 확인
docker compose exec labelstudio env | grep COOKIE

# 2. 올바른 값 확인
# SESSION_COOKIE_DOMAIN=.hatiolab.localhost (로컬) / .hatiolab.com (프로덕션)
# CSRF_COOKIE_DOMAIN=.hatiolab.localhost (로컬) / .hatiolab.com (프로덕션)

# 3. 브라우저 개발자 도구에서 쿠키 확인
# F12 → Application → Cookies → .hatiolab.localhost (로컬) / .hatiolab.com (프로덕션)
# 초기: ls_auth_token 쿠키 확인
# 이후: ls_sessionid 쿠키 확인 (ls_auth_token은 자동 삭제됨)

# 4. 서비스 재시작
docker compose restart labelstudio
```

### 사용자 전환이 안 됨

```bash
# 1. 브라우저 콘솔에서 에러 확인
# F12 → Console

# 2. iframe이 재생성되는지 확인
# Vue DevTools 또는 Elements 탭에서 iframe의 key 속성 변경 확인

# 3. 쿠키 확인
# F12 → Application → Cookies
# ls_sessionid와 ls_csrftoken이 삭제되고 새 ls_auth_token이 생성되는지 확인

# 4. Backend 로그 확인
docker compose logs -f backend

# 5. Label Studio 로그 확인
docker compose logs -f labelstudio | grep "SSO Middleware"
```

### 헤더가 숨겨지지 않음

```bash
# 1. 브라우저 캐시 클리어
# Cmd + Shift + R (Mac)
# Ctrl + Shift + R (Windows/Linux)

# 2. 컨테이너 재시작
docker compose restart labelstudio

# 3. URL 파라미터 확인
# ?hideHeader=true 가 있는지 확인

# 4. custom-templates/base.html 마운트 확인
docker exec label-studio-app ls -la /label-studio/label_studio/templates/base.html
```

### Annotation 수정 불가 (403 에러)

이것은 **정상 동작**입니다:
```
다른 사용자의 annotation 수정 시도 → 403 Forbidden

해결 방법:
1. 자신의 annotation만 수정
2. 또는 admin 계정으로 로그인
```

---

## 📊 서비스 URL 정리

**로컬 개발 환경**:

| 서비스 | URL | 용도 |
|--------|-----|------|
| Frontend | http://hatiolab.localhost:3000 | 테스트 앱 |
| Backend | http://hatiolab.localhost:3001 | SSO API |
| Label Studio | http://label.hatiolab.localhost:8080 | Label Studio |
| PostgreSQL | localhost:5432 | 데이터베이스 |

**프로덕션 환경**:

| 서비스 | URL | 용도 |
|--------|-----|------|
| Frontend | https://app.hatiolab.com | 테스트 앱 |
| Backend | https://app.hatiolab.com/api | SSO API |
| Label Studio | https://label.hatiolab.com | Label Studio |

---

## 🎯 다음 단계

1. **프로젝트 생성**: Label Studio에서 프로젝트 생성
2. **작업 추가**: 데이터 업로드 및 작업 생성
3. **레이블링 설정**: Labeling interface 설정
4. **테스트**: 여러 사용자로 로그인하여 annotation 생성

---

## 📚 상세 문서

- [README.md](./README.md) - 프로젝트 전체 가이드
- [README-DOCKER.md](./README-DOCKER.md) - Docker 상세 가이드
- [TEST_APP_GUIDE.md](./TEST_APP_GUIDE.md) - 테스트 앱 상세 가이드
- [CHANGELOG.md](./CHANGELOG.md) - 변경 이력

---

**도움이 필요하면**: Issues에 문의하세요!
