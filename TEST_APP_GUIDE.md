# 테스트 애플리케이션 실행 가이드

이 가이드는 Label Studio SSO 테스트를 위한 **테스트 애플리케이션** 실행 방법입니다.

## 📋 구조

```
메인 앱 (Frontend): http://nubison.localhost:3000
Backend API:         http://localhost:3001
Label Studio:        http://label.nubison.localhost:8080
```

---

## 🚀 실행 방법

### 1단계: Label Studio 실행 및 API Token 생성

먼저 Label Studio를 실행하고 API Token을 생성해야 합니다.

```bash
# Label Studio 실행
cd /Users/super/Documents/GitHub/label-studio-test-app
docker-compose up -d --build

# 초기 사용자 생성
make init-users

# API Token 생성
make create-token
# 이메일 입력: admin@nubison.localhost
# 출력된 토큰 복사
```

---

### 2단계: Backend 설정 및 실행

```bash
# Backend 디렉토리로 이동
cd /Users/super/Documents/GitHub/label-studio-test-app/backend

# .env 파일 수정
nano .env

# LABEL_STUDIO_API_TOKEN에 복사한 토큰 입력
LABEL_STUDIO_API_TOKEN=<복사한-토큰>

# 저장: Ctrl+X, Y, Enter
```

**Backend 실행:**

```bash
# 패키지 설치 (최초 1회)
npm install

# 서버 실행
npm start
```

**성공 메시지:**

```
╔════════════════════════════════════════════════════════════╗
║  Label Studio Test Backend                                 ║
╠════════════════════════════════════════════════════════════╣
║  Server:           http://localhost:3001                   ║
║  Label Studio:     http://label.nubison.localhost:8080     ║
║                                                            ║
║  Endpoints:                                                ║
║    GET  /api/sso/setup    - Setup SSO authentication       ║
║    GET  /api/health       - Health check                   ║
║    GET  /api/cookies      - View cookies (debug)           ║
╚════════════════════════════════════════════════════════════╝
```

---

### 3단계: Frontend 실행

**새 터미널 탭/창 열기:**

```bash
# Frontend 디렉토리로 이동
cd /Users/super/Documents/GitHub/label-studio-test-app/frontend

# 패키지 설치 (최초 1회)
npm install

# 개발 서버 실행
npm run dev
```

**성공 메시지:**

```
  VITE v... ready in ...ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

---

### 4단계: /etc/hosts 추가 설정

메인 앱을 위한 도메인도 추가해야 합니다.

```bash
sudo nano /etc/hosts
```

**다음 라인 확인/추가:**

```
127.0.0.1       nubison.localhost
127.0.0.1       label.nubison.localhost
```

---

### 5단계: 브라우저 접속

#### 메인 앱 (Frontend)

```
http://nubison.localhost:3000
```

또는

```
http://localhost:3000
```

#### Backend API 확인

```
http://localhost:3001/api/health
```

#### Label Studio

```
http://label.nubison.localhost:8080
```

---

## 🧪 SSO 테스트 흐름

### 1. SSO 설정 API 호출

**브라우저 또는 curl로 호출:**

```bash
# 기본 사용자 (admin@nubison.localhost)
curl http://localhost:3001/api/sso/setup

# 특정 사용자 지정
curl "http://localhost:3001/api/sso/setup?email=user1@nubison.localhost"
```

**응답:**

```json
{
  "success": true,
  "message": "SSO token setup complete",
  "user": "admin@nubison.localhost",
  "expiresIn": 600
}
```

이 API는:

1. Label Studio에서 JWT 토큰을 발급받음
2. `.nubison.localhost` 도메인으로 쿠키 설정
3. 모든 `*.nubison.localhost` 서브도메인에서 사용 가능

### 2. Label Studio 자동 로그인 확인

SSO 설정 후:

```
http://label.nubison.localhost:8080
```

**자동으로 로그인된 상태**로 Label Studio가 열립니다! ✅

---

## 📁 Frontend에서 사용 예시

```javascript
// SSO 설정
const setupSSO = async (userEmail) => {
  const response = await fetch(
    `http://nubison.localhost:3001/api/sso/setup?email=${userEmail}`,
    { credentials: "include" } // 쿠키 포함
  );

  const data = await response.json();

  if (data.success) {
    // Label Studio로 리다이렉트 또는 iframe 열기
    window.location.href = "http://label.nubison.localhost:8080";

    // 또는 iframe
    const iframe = document.createElement("iframe");
    iframe.src = "http://label.nubison.localhost:8080";
    document.body.appendChild(iframe);
  }
};

// 사용
setupSSO("admin@nubison.localhost");
```

---

## 🔧 유용한 Backend API

### Health Check

```bash
curl http://localhost:3001/api/health
```

### 쿠키 확인 (디버깅)

```bash
curl -b cookies.txt http://localhost:3001/api/cookies
```

### Label Studio 프로젝트 목록

```bash
curl http://localhost:3001/api/projects
```

---

## 🔍 문제 해결

### Backend가 Label Studio에 연결 안 됨

**증상:** `Failed to get SSO token from Label Studio`

**해결:**

1. Label Studio 실행 확인: `docker-compose ps`
2. API Token 확인: `backend/.env`의 `LABEL_STUDIO_API_TOKEN`
3. URL 확인: `http://label.nubison.localhost:8080`이 접속 가능한지

### 쿠키가 공유되지 않음

**증상:** Label Studio 접속 시 로그인 화면이 뜸

**해결:**

1. 브라우저 개발자 도구 (F12) → Application → Cookies 확인
2. `ls_auth_token` 쿠키의 Domain이 `.nubison.localhost`인지 확인
3. Frontend와 Label Studio를 **같은 브라우저**에서 접속

### CORS 에러

**증상:** `Access to fetch at ... has been blocked by CORS policy`

**해결:**
Backend의 CORS 설정 확인:

```javascript
cors({
  origin: "http://nubison.localhost:3000",
  credentials: true,
});
```

---

## 📊 전체 흐름도

```
1. 사용자가 http://nubison.localhost:3000 접속 (Frontend)
   ↓
2. Frontend에서 SSO 설정 버튼 클릭
   ↓
3. Backend API 호출: GET /api/sso/setup?email=admin@nubison.localhost
   ↓
4. Backend → Label Studio API 호출: POST /api/sso/token
   ↓
5. Label Studio가 JWT 토큰 발급
   ↓
6. Backend가 .nubison.localhost 도메인으로 쿠키 설정
   ↓
7. Frontend에서 Label Studio로 리다이렉트/iframe
   ↓
8. Label Studio가 쿠키의 JWT 토큰 인식
   ↓
9. 자동 로그인 완료! ✅
```

---

## 🎯 빠른 시작 (전체 명령어)

```bash
# 터미널 1: Label Studio
cd /Users/super/Documents/GitHub/label-studio-test-app
docker-compose up -d --build
make init-users
make create-token  # 토큰 복사

# 터미널 2: Backend
cd /Users/super/Documents/GitHub/label-studio-test-app/backend
nano .env  # 토큰 입력
npm install
npm start

# 터미널 3: Frontend
cd /Users/super/Documents/GitHub/label-studio-test-app/frontend
npm install
npm run dev

# 브라우저:
# http://nubison.localhost:3000 (메인 앱)
# http://label.nubison.localhost:8080 (Label Studio)
```

---

**이제 SSO 통합이 완벽하게 작동합니다!** 🎉
