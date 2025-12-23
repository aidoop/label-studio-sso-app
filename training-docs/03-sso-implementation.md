# SSO 구현 방법

## 목차
1. [SSO 개요](#1-sso-개요)
2. [label-studio-sso 패키지](#2-label-studio-sso-패키지)
3. [JWT 인증 플로우](#3-jwt-인증-플로우)
4. [백엔드 구현](#4-백엔드-구현)
5. [프론트엔드 구현](#5-프론트엔드-구현)
6. [쿠키 설정](#6-쿠키-설정)
7. [사용자 전환](#7-사용자-전환)
8. [보안 고려사항](#8-보안-고려사항)
9. [트러블슈팅](#9-트러블슈팅)

---

## 1. SSO 개요

### 1.1 SSO(Single Sign-On)란?

SSO는 한 번의 로그인으로 여러 서비스에 접근할 수 있는 인증 방식입니다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SSO 개념도                                          │
└─────────────────────────────────────────────────────────────────────────────┘

  일반 인증 (SSO 없음):
  ┌─────────┐  로그인  ┌─────────┐
  │ 서비스 A │◀────────│         │
  └─────────┘         │         │
                      │  사용자  │
  ┌─────────┐  로그인  │         │
  │ 서비스 B │◀────────│         │
  └─────────┘         │         │
                      │         │
  ┌─────────┐  로그인  │         │
  │ 서비스 C │◀────────│         │
  └─────────┘         └─────────┘

  SSO 인증:
  ┌─────────┐
  │ 서비스 A │◀──────┐
  └─────────┘       │
                    │  토큰
  ┌─────────┐       │
  │ 서비스 B │◀──────┼────┌─────────┐  로그인  ┌─────────┐
  └─────────┘       │    │   SSO   │◀────────│  사용자  │
                    │    │  서버   │         └─────────┘
  ┌─────────┐       │    └─────────┘
  │ 서비스 C │◀──────┘
  └─────────┘
```

### 1.2 Label Studio SSO 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Label Studio SSO 아키텍처                                 │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────┐
  │   외부 앱       │  (console.nubison.io)
  │   (Vue 3)      │
  └────────┬────────┘
           │
           │ 1. SSO 토큰 요청
           ▼
  ┌─────────────────┐
  │   SSO Backend   │  (Express.js)
  │                 │
  └────────┬────────┘
           │
           │ 2. JWT 토큰 요청
           ▼
  ┌─────────────────┐
  │  Label Studio   │  (Django + label-studio-sso)
  │    Custom       │
  │                 │  3. JWT 발급
  └────────┬────────┘
           │
           │ 4. JWT 쿠키 설정
           ▼
  ┌─────────────────┐
  │   외부 앱       │
  │   (iframe)      │
  │                 │  5. iframe으로 Label Studio 로드
  │  ┌───────────┐  │     (JWT 쿠키 포함)
  │  │  Label    │  │
  │  │  Studio   │  │  6. JWT → Session 변환
  │  └───────────┘  │
  └─────────────────┘
```

### 1.3 핵심 개념

| 개념 | 설명 |
|------|------|
| **JWT (JSON Web Token)** | 서명된 인증 토큰, 사용자 정보 포함 |
| **Django Session** | 서버 측 세션, 빠른 인증 처리 |
| **HttpOnly Cookie** | JavaScript로 접근 불가한 안전한 쿠키 |
| **SameSite Cookie** | CSRF 공격 방지를 위한 쿠키 속성 |

---

## 2. label-studio-sso 패키지

### 2.1 패키지 구성

`label-studio-sso`는 Label Studio에 JWT 기반 SSO를 추가하는 Django 패키지입니다.

```
label_studio_sso/
├── __init__.py
├── backends.py          # JWTAuthenticationBackend
├── middleware.py        # JWTAutoLoginMiddleware
├── views.py            # SSO Token API
├── serializers.py      # 토큰 직렬화
└── utils.py            # 유틸리티 함수
```

### 2.2 주요 컴포넌트

#### JWTAuthenticationBackend

```python
# label_studio_sso/backends.py

class JWTAuthenticationBackend:
    """
    JWT 토큰을 검증하고 사용자를 인증하는 백엔드

    인증 순서:
    1. JWT 토큰 추출 (쿠키 또는 URL 파라미터)
    2. 토큰 서명 검증
    3. 만료 시간 확인
    4. user_id 클레임으로 사용자 조회
    5. 사용자 객체 반환
    """

    def authenticate(self, request, token=None):
        if token is None:
            # 쿠키에서 토큰 추출
            token = request.COOKIES.get(settings.JWT_SSO_COOKIE_NAME)

        if token is None:
            # URL 파라미터에서 토큰 추출
            token = request.GET.get(settings.JWT_SSO_TOKEN_PARAM)

        if token is None:
            return None

        try:
            # JWT 검증
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=['HS256']
            )

            # 사용자 조회
            user_id = payload.get(settings.JWT_SSO_NATIVE_USER_ID_CLAIM)
            user = User.objects.get(pk=user_id)

            return user

        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
        except User.DoesNotExist:
            return None
```

#### JWTAutoLoginMiddleware

```python
# label_studio_sso/middleware.py

class JWTAutoLoginMiddleware:
    """
    JWT 토큰을 자동으로 Django 세션으로 변환하는 미들웨어

    처리 흐름:
    1. JWT 쿠키 확인
    2. JWT 유효성 검증
    3. Django 세션 생성
    4. JWT 쿠키 삭제 (보안)
    5. 세션 쿠키 설정
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # JWT 토큰 확인
        token = request.COOKIES.get(settings.JWT_SSO_COOKIE_NAME)

        if token and not request.user.is_authenticated:
            # JWT로 사용자 인증
            backend = JWTAuthenticationBackend()
            user = backend.authenticate(request, token=token)

            if user:
                # Django 로그인 (세션 생성)
                login(request, user, backend='label_studio_sso.backends.JWTAuthenticationBackend')

                # 응답 생성
                response = self.get_response(request)

                # JWT 쿠키 삭제 (세션으로 대체)
                response.delete_cookie(
                    settings.JWT_SSO_COOKIE_NAME,
                    domain=settings.SESSION_COOKIE_DOMAIN
                )

                return response

        return self.get_response(request)
```

#### SSO Token API

```python
# label_studio_sso/views.py

class SSOTokenView(APIView):
    """
    JWT 토큰 발급 API

    POST /api/sso/token
    {
        "email": "user@example.com"
    }

    Response:
    {
        "token": "eyJhbGc...",
        "expires_in": 600
    }
    """
    permission_classes = [IsAuthenticated]  # API 토큰 인증 필요

    def post(self, request):
        email = request.data.get('email')

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'detail': 'USER_NOT_FOUND'},
                status=422
            )

        # JWT 토큰 생성
        expiry = settings.SSO_TOKEN_EXPIRY
        payload = {
            'user_id': user.id,           # 필수: 사용자 ID
            'email': user.email,          # 참조용: 이메일
            'iat': int(time.time()),      # 발급 시간
            'exp': int(time.time()) + expiry,  # 만료 시간
            'iss': 'label-studio',        # 발급자
            'aud': 'label-studio-sso',    # 대상
        }

        token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')

        return Response({
            'token': token,
            'expires_in': expiry
        })
```

### 2.3 설정 옵션

| 설정 | 기본값 | 설명 |
|------|--------|------|
| `JWT_SSO_COOKIE_NAME` | `ls_auth_token` | JWT 쿠키 이름 |
| `JWT_SSO_TOKEN_PARAM` | `token` | URL 파라미터 이름 |
| `JWT_SSO_NATIVE_USER_ID_CLAIM` | `user_id` | JWT 클레임 필드 |
| `SSO_TOKEN_EXPIRY` | `600` | 토큰 만료 시간(초) |
| `SSO_AUTO_CREATE_USERS` | `False` | 자동 사용자 생성 여부 |

---

## 3. JWT 인증 플로우

### 3.1 전체 플로우

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         JWT 인증 플로우                                      │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────┐        ┌─────────┐        ┌─────────────┐        ┌─────────────┐
  │ Browser │        │ Express │        │   Label     │        │ label-studio│
  │         │        │   .js   │        │   Studio    │        │    -sso     │
  └────┬────┘        └────┬────┘        └──────┬──────┘        └──────┬──────┘
       │                  │                    │                      │
       │  1. 로그인 요청   │                    │                      │
       │─────────────────▶│                    │                      │
       │                  │                    │                      │
       │                  │  2. JWT 토큰 요청   │                      │
       │                  │───────────────────▶│                      │
       │                  │   POST /api/sso/token                     │
       │                  │   { email: "..." }  │                      │
       │                  │                    │                      │
       │                  │  3. JWT 토큰 반환   │                      │
       │                  │◀───────────────────│                      │
       │                  │   { token: "...",  │                      │
       │                  │     expires_in: 600}│                      │
       │                  │                    │                      │
       │  4. JWT 쿠키 설정 │                    │                      │
       │◀─────────────────│                    │                      │
       │  Set-Cookie:     │                    │                      │
       │  ls_auth_token=..│                    │                      │
       │                  │                    │                      │
       │  5. iframe 로드  │                    │                      │
       │──────────────────────────────────────▶│                      │
       │  GET /projects/1?hideHeader=true      │                      │
       │  Cookie: ls_auth_token=...            │                      │
       │                  │                    │                      │
       │                  │                    │  6. JWT 검증          │
       │                  │                    │─────────────────────▶│
       │                  │                    │                      │
       │                  │                    │  7. 세션 생성         │
       │                  │                    │◀─────────────────────│
       │                  │                    │                      │
       │  8. 응답 + 세션 쿠키                   │                      │
       │◀──────────────────────────────────────│                      │
       │  Set-Cookie: sessionid=...            │                      │
       │  Delete-Cookie: ls_auth_token         │                      │
       │                  │                    │                      │
```

### 3.2 단계별 설명

#### Step 1-3: JWT 토큰 발급

```javascript
// Express.js Backend

app.get('/api/sso/token', async (req, res) => {
    const email = req.query.email;

    // Label Studio API 호출
    const response = await fetch(`${LABEL_STUDIO_URL}/api/sso/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Token ${LABEL_STUDIO_API_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
    });

    const data = await response.json();
    // { token: "eyJhbGc...", expires_in: 600 }
});
```

#### Step 4: JWT 쿠키 설정

```javascript
// JWT 쿠키 설정

res.cookie('ls_auth_token', data.token, {
    domain: '.hatiolab.com',    // 서브도메인 공유
    path: '/',
    httpOnly: false,            // iframe에서 접근 가능하도록
    sameSite: 'lax',           // CSRF 보호
    maxAge: data.expires_in * 1000,
    secure: process.env.NODE_ENV === 'production'  // HTTPS 전용
});
```

#### Step 5: iframe 로드

```html
<!-- Vue 컴포넌트 -->

<iframe
    :key="userEmail"
    :src="`${labelStudioUrl}/projects/${projectId}?hideHeader=true`"
    @load="onIframeLoad"
></iframe>
```

#### Step 6-8: JWT → Session 변환

```python
# JWTAutoLoginMiddleware 내부 동작

# 1. JWT 쿠키 확인
token = request.COOKIES.get('ls_auth_token')

# 2. JWT 검증 및 사용자 인증
user = backend.authenticate(request, token=token)

# 3. Django 세션 생성
login(request, user)

# 4. 응답 생성
response = get_response(request)

# 5. JWT 쿠키 삭제
response.delete_cookie('ls_auth_token')

# 6. 세션 쿠키는 자동 설정 (sessionid)
return response
```

#### 세션 메타데이터

JWT 인증 성공 시 다음 메타데이터가 세션에 저장됩니다:

```python
# 미들웨어에서 설정되는 세션 메타데이터
request.session["jwt_auto_login"] = True   # SSO 자동 로그인 플래그
request.session["sso_method"] = "jwt"      # 인증 방식 ("jwt")
request.session["last_login"] = time.time()  # 로그인 시간 (Unix timestamp)
```

**메타데이터 활용 예시**:
```python
# 세션이 SSO로 생성되었는지 확인
if request.session.get("jwt_auto_login"):
    print("이 세션은 SSO 자동 로그인으로 생성됨")

# 마지막 로그인 시간 확인
last_login = request.session.get("last_login")
if last_login:
    from datetime import datetime
    login_time = datetime.fromtimestamp(last_login)
    print(f"마지막 로그인: {login_time}")
```

### 3.3 성능 최적화: JWT → Session

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    JWT vs Session 비교                                       │
└─────────────────────────────────────────────────────────────────────────────┘

  JWT만 사용 (비효율적):
  ┌─────────┐     ┌─────────────┐     ┌─────────┐
  │Request 1│────▶│JWT 검증(10ms)│────▶│ 처리    │
  └─────────┘     └─────────────┘     └─────────┘
  ┌─────────┐     ┌─────────────┐     ┌─────────┐
  │Request 2│────▶│JWT 검증(10ms)│────▶│ 처리    │
  └─────────┘     └─────────────┘     └─────────┘
  ┌─────────┐     ┌─────────────┐     ┌─────────┐
  │Request 3│────▶│JWT 검증(10ms)│────▶│ 처리    │
  └─────────┘     └─────────────┘     └─────────┘

  총 인증 시간: 30ms (매 요청마다 JWT 검증)


  JWT → Session 변환 (효율적):
  ┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────┐
  │Request 1│────▶│JWT 검증(10ms)│────▶│세션 생성(5ms)│────▶│ 처리    │
  └─────────┘     └─────────────┘     └─────────────┘     └─────────┘
  ┌─────────┐     ┌─────────────┐     ┌─────────┐
  │Request 2│────▶│세션 조회(1ms)│────▶│ 처리    │
  └─────────┘     └─────────────┘     └─────────┘
  ┌─────────┐     ┌─────────────┐     ┌─────────┐
  │Request 3│────▶│세션 조회(1ms)│────▶│ 처리    │
  └─────────┘     └─────────────┘     └─────────┘

  총 인증 시간: 17ms (첫 요청만 JWT 검증)
  성능 향상: ~43%
```

---

## 4. 백엔드 구현

### 4.1 Express.js SSO 백엔드

```javascript
// backend/server.js

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const app = express();

// 환경 변수
const LABEL_STUDIO_URL = process.env.LABEL_STUDIO_URL || 'http://labelstudio:8080';
const LABEL_STUDIO_API_TOKEN = process.env.LABEL_STUDIO_API_TOKEN;
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || '.hatiolab.localhost';

// 미들웨어
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));
app.use(cookieParser());
app.use(express.json());

/**
 * JWT 토큰 발급
 */
async function issueJWT(email) {
    const response = await fetch(`${LABEL_STUDIO_URL}/api/sso/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Token ${LABEL_STUDIO_API_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to issue JWT');
    }

    return response.json();
}

/**
 * JWT 쿠키 설정
 */
function setJWTCookie(res, token, expiresIn) {
    res.cookie('ls_auth_token', token, {
        domain: COOKIE_DOMAIN,
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        maxAge: expiresIn * 1000,
        secure: process.env.NODE_ENV === 'production'
    });
}

/**
 * 세션 쿠키 삭제 (사용자 전환 시)
 */
function clearSessionCookies(res) {
    const cookieOptions = {
        domain: COOKIE_DOMAIN,
        path: '/'
    };

    res.clearCookie('sessionid', cookieOptions);
    res.clearCookie('csrftoken', cookieOptions);
}

/**
 * SSO 토큰 엔드포인트
 *
 * GET /api/sso/token?email=user@example.com
 */
app.get('/api/sso/token', async (req, res) => {
    try {
        const email = req.query.email;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // 1. 기존 세션 쿠키 삭제 (사용자 전환 대비)
        clearSessionCookies(res);

        // 2. JWT 토큰 발급
        const tokenData = await issueJWT(email);

        // 3. JWT 쿠키 설정
        setJWTCookie(res, tokenData.token, tokenData.expires_in);

        // 4. 응답
        res.json({
            success: true,
            user: email,
            expiresIn: tokenData.expires_in
        });

    } catch (error) {
        console.error('SSO token error:', error);

        if (error.message === 'USER_NOT_FOUND') {
            return res.status(422).json({ error: 'User not found' });
        }

        res.status(500).json({ error: 'Failed to issue SSO token' });
    }
});

/**
 * 헬스 체크
 */
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`SSO Backend listening on port ${PORT}`);
});
```

### 4.2 에러 처리

```javascript
// 에러 코드 및 처리

const SSO_ERRORS = {
    USER_NOT_FOUND: {
        status: 422,
        message: '사용자를 찾을 수 없습니다. 먼저 사용자를 등록해주세요.'
    },
    INVALID_TOKEN: {
        status: 401,
        message: 'API 토큰이 유효하지 않습니다.'
    },
    TOKEN_EXPIRED: {
        status: 401,
        message: 'JWT 토큰이 만료되었습니다.'
    },
    NETWORK_ERROR: {
        status: 503,
        message: 'Label Studio 서버에 연결할 수 없습니다.'
    }
};

app.get('/api/sso/token', async (req, res) => {
    try {
        // ...
    } catch (error) {
        const errorInfo = SSO_ERRORS[error.message] || {
            status: 500,
            message: '알 수 없는 오류가 발생했습니다.'
        };

        res.status(errorInfo.status).json({
            error: error.message,
            message: errorInfo.message
        });
    }
});
```

---

## 5. 프론트엔드 구현

### 5.1 Vue 3 컴포넌트

```vue
<!-- components/LabelStudioWrapper.vue -->

<template>
    <div class="label-studio-wrapper">
        <!-- 로딩 상태 -->
        <div v-if="loading" class="loading">
            <span>Loading Label Studio...</span>
        </div>

        <!-- 에러 상태 -->
        <div v-else-if="error" class="error">
            <p>{{ error }}</p>
            <button @click="retry">Retry</button>
        </div>

        <!-- Label Studio iframe -->
        <iframe
            v-else
            :key="props.email"
            :src="iframeUrl"
            class="label-studio-iframe"
            @load="onIframeLoad"
            @error="onIframeError"
        ></iframe>
    </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';

const props = defineProps({
    email: {
        type: String,
        required: true
    },
    projectId: {
        type: Number,
        required: true
    }
});

const LABEL_STUDIO_URL = import.meta.env.VITE_LABEL_STUDIO_URL;

const loading = ref(true);
const error = ref(null);
const iframeUrl = ref('');

/**
 * SSO 토큰 발급 및 iframe 초기화
 */
async function initialize() {
    loading.value = true;
    error.value = null;

    try {
        // 1. SSO 토큰 요청
        const response = await fetch(
            `/api/sso/token?email=${encodeURIComponent(props.email)}`,
            { credentials: 'include' }
        );

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'SSO token request failed');
        }

        // 2. iframe URL 생성
        const params = new URLSearchParams();
        params.set('hideHeader', 'true');
        params.set('_t', Date.now()); // 캐시 방지

        iframeUrl.value = `${LABEL_STUDIO_URL}/projects/${props.projectId}?${params}`;

    } catch (err) {
        error.value = err.message;
        console.error('SSO initialization error:', err);
    }
}

/**
 * iframe 로드 완료 핸들러
 */
function onIframeLoad() {
    loading.value = false;
}

/**
 * iframe 에러 핸들러
 */
function onIframeError() {
    error.value = 'Failed to load Label Studio';
    loading.value = false;
}

/**
 * 재시도
 */
function retry() {
    initialize();
}

// 컴포넌트 마운트 시 초기화
onMounted(() => {
    initialize();
});

// 이메일 변경 시 재초기화 (사용자 전환)
watch(() => props.email, () => {
    initialize();
});
</script>

<style scoped>
.label-studio-wrapper {
    width: 100%;
    height: 100%;
    position: relative;
}

.label-studio-iframe {
    width: 100%;
    height: 100%;
    border: none;
}

.loading, .error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
}

.error {
    color: #f44336;
}

.error button {
    margin-top: 16px;
    padding: 8px 16px;
    cursor: pointer;
}
</style>
```

### 5.2 사용자 선택 UI

```vue
<!-- components/UserSelector.vue -->

<template>
    <div class="user-selector">
        <h3>Select User</h3>

        <div class="user-list">
            <button
                v-for="user in users"
                :key="user.email"
                :class="{ active: selectedEmail === user.email }"
                @click="selectUser(user.email)"
            >
                <span class="user-name">{{ user.name }}</span>
                <span class="user-email">{{ user.email }}</span>
                <span v-if="user.isAdmin" class="admin-badge">Admin</span>
            </button>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';

const emit = defineEmits(['select']);

// 테스트 사용자 목록
const users = ref([
    { email: 'admin@hatiolab.com', name: 'Admin User', isAdmin: true },
    { email: 'annotator1@hatiolab.com', name: 'Annotator 1', isAdmin: false },
    { email: 'annotator2@hatiolab.com', name: 'Annotator 2', isAdmin: false },
]);

const selectedEmail = ref(null);

function selectUser(email) {
    selectedEmail.value = email;
    emit('select', email);
}
</script>
```

### 5.3 메인 앱 통합

```vue
<!-- App.vue -->

<template>
    <div class="app">
        <header class="app-header">
            <h1>Label Studio SSO Demo</h1>
            <UserSelector @select="onUserSelect" />
        </header>

        <main class="app-main">
            <LabelStudioWrapper
                v-if="currentEmail"
                :email="currentEmail"
                :project-id="1"
            />
            <div v-else class="no-user">
                Please select a user to continue
            </div>
        </main>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import UserSelector from './components/UserSelector.vue';
import LabelStudioWrapper from './components/LabelStudioWrapper.vue';

const currentEmail = ref(null);

function onUserSelect(email) {
    currentEmail.value = email;
}
</script>
```

---

## 6. 쿠키 설정

### 6.1 쿠키 도메인 구조

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         쿠키 도메인 설정                                     │
└─────────────────────────────────────────────────────────────────────────────┘

  로컬 개발 환경:
  ┌─────────────────────────────────────────────────────────────┐
  │  Domain: .hatiolab.localhost                                │
  │                                                             │
  │  ┌─────────────────┐     ┌─────────────────┐               │
  │  │ hatiolab.       │     │ label.hatiolab. │               │
  │  │ localhost:3000  │     │ localhost:8080  │               │
  │  │                 │     │                 │               │
  │  │ (Frontend)      │     │ (Label Studio)  │               │
  │  └────────┬────────┘     └────────┬────────┘               │
  │           │                       │                        │
  │           └───────────┬───────────┘                        │
  │                       │                                    │
  │                ┌──────▼──────┐                            │
  │                │   Cookies   │                            │
  │                │ ls_auth_token│                            │
  │                │ sessionid   │                            │
  │                │ csrftoken   │                            │
  │                └─────────────┘                            │
  └─────────────────────────────────────────────────────────────┘

  프로덕션 환경:
  ┌─────────────────────────────────────────────────────────────┐
  │  Domain: .hatiolab.com                                      │
  │                                                             │
  │  ┌─────────────────┐     ┌─────────────────┐               │
  │  │ app.hatiolab.   │     │ label.hatiolab. │               │
  │  │ com             │     │ com             │               │
  │  │                 │     │                 │               │
  │  │ (Frontend)      │     │ (Label Studio)  │               │
  │  └────────┬────────┘     └────────┬────────┘               │
  │           │                       │                        │
  │           └───────────┬───────────┘                        │
  │                       │                                    │
  │                ┌──────▼──────┐                            │
  │                │   Cookies   │ (Secure, SameSite)         │
  │                └─────────────┘                            │
  └─────────────────────────────────────────────────────────────┘
```

### 6.2 /etc/hosts 설정 (로컬 개발)

```bash
# /etc/hosts

127.0.0.1  hatiolab.localhost
127.0.0.1  label.hatiolab.localhost
```

### 6.3 환경별 쿠키 설정

| 환경 | Domain | Secure | SameSite |
|------|--------|--------|----------|
| **로컬** | `.hatiolab.localhost` | `false` | `lax` |
| **프로덕션** | `.hatiolab.com` | `true` | `lax` |

### 6.4 쿠키 속성 상세

```javascript
// 쿠키 설정 예시

// JWT 토큰 쿠키 (클라이언트에서 접근 가능)
res.cookie('ls_auth_token', token, {
    domain: '.hatiolab.com',     // 서브도메인 공유
    path: '/',                   // 모든 경로
    httpOnly: false,             // JavaScript 접근 허용 (디버깅용)
    sameSite: 'lax',            // 같은 사이트에서만 전송
    secure: true,               // HTTPS에서만 전송
    maxAge: 600000              // 10분 (밀리초)
});

// 세션 쿠키 (Django 자동 설정)
// httpOnly: true (보안)
// sameSite: 'lax'
// secure: SESSION_COOKIE_SECURE 설정에 따름
```

---

## 7. 사용자 전환

### 7.1 사용자 전환 문제

기존 세션이 남아있으면 새 사용자로 전환이 안 되는 문제가 있습니다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         사용자 전환 문제                                     │
└─────────────────────────────────────────────────────────────────────────────┘

  문제 상황:
  1. User A로 로그인 → sessionid 생성
  2. User B로 전환 시도 → 새 JWT 발급
  3. iframe 로드 → 기존 sessionid가 우선 적용!
  4. User A로 계속 인증됨 (실패)
```

### 7.2 해결 방법: JWT 우선순위

`label-studio-sso`의 미들웨어는 JWT가 있으면 세션보다 우선 적용합니다.

```python
# JWTAutoLoginMiddleware

def __call__(self, request):
    token = request.COOKIES.get('ls_auth_token')

    # JWT가 있으면 세션과 관계없이 JWT로 인증
    if token:
        user = backend.authenticate(request, token=token)
        if user:
            # 기존 세션 무효화 후 새 세션 생성
            logout(request)  # 기존 세션 삭제
            login(request, user)  # 새 세션 생성
```

### 7.3 프론트엔드 측 처리

```javascript
// 사용자 전환 시 기존 쿠키 정리

app.get('/api/sso/token', async (req, res) => {
    // 1. 기존 세션 쿠키 삭제
    res.clearCookie('sessionid', { domain: COOKIE_DOMAIN });
    res.clearCookie('csrftoken', { domain: COOKIE_DOMAIN });

    // 2. 새 JWT 발급
    const tokenData = await issueJWT(req.query.email);

    // 3. JWT 쿠키 설정
    setJWTCookie(res, tokenData.token, tokenData.expires_in);

    res.json({ success: true });
});
```

### 7.4 iframe 재생성

Vue의 `:key` 바인딩으로 iframe을 완전히 재생성합니다.

```vue
<!-- key가 변경되면 iframe이 완전히 새로 생성됨 -->
<iframe
    :key="props.email"
    :src="iframeUrl"
></iframe>
```

**왜 key가 필요한가?**
```
key 없이:
- iframe 내부 상태 유지
- JavaScript 메모리 유지
- 이전 사용자 정보 남아있음

key 있음 (이메일 변경 시):
- 기존 iframe 완전 제거
- 새 iframe DOM 요소 생성
- 깨끗한 상태로 시작
```

---

## 8. 보안 고려사항

### 8.1 보안 체크리스트

| 항목 | 설명 | 설정 |
|------|------|------|
| **HTTPS 사용** | 토큰 전송 암호화 | 프로덕션 필수 |
| **Secure 쿠키** | HTTPS에서만 쿠키 전송 | `SESSION_COOKIE_SECURE=true` |
| **SameSite 쿠키** | CSRF 공격 방지 | `SameSite=Lax` |
| **짧은 토큰 만료** | 토큰 노출 위험 최소화 | `SSO_TOKEN_EXPIRY=600` |
| **사전 등록 사용자** | 무단 접근 방지 | `SSO_AUTO_CREATE_USERS=False` |
| **API 토큰 관리** | 토큰 노출 방지 | 환경 변수로 관리 |

### 8.2 JWT 보안

```python
# JWT 토큰 구조 (label-studio-sso 실제 구현)

{
    "header": {
        "alg": "HS256",      # 서명 알고리즘
        "typ": "JWT"
    },
    "payload": {
        "user_id": 123,      # 사용자 ID (필수)
        "email": "user@example.com",  # 이메일 (참조용)
        "iat": 1704063600,   # 발급 시간 (Issued At)
        "exp": 1704067200,   # 만료 시간 (Expiration)
        "iss": "label-studio",        # 발급자 (Issuer)
        "aud": "label-studio-sso"     # 대상 (Audience)
    },
    "signature": "..."       # HMAC-SHA256 서명
}
```

**JWT 클레임 설명**:
| 클레임 | 타입 | 설명 |
|--------|------|------|
| `user_id` | number | Label Studio 사용자 ID (필수) |
| `email` | string | 사용자 이메일 (참조용) |
| `iat` | number | 토큰 발급 시간 (Unix timestamp) |
| `exp` | number | 토큰 만료 시간 (Unix timestamp) |
| `iss` | string | 발급자 ("label-studio") |
| `aud` | string | 대상 ("label-studio-sso") |

**보안 포인트**:
1. **서명 검증**: `SECRET_KEY`로 서명 검증
2. **만료 시간 확인**: `exp` 클레임 확인 (기본 10분)
3. **발급자 확인**: `iss` 클레임 검증
4. **사용자 존재 확인**: DB에서 사용자 조회

### 8.3 CSRF 보호

```python
# Django CSRF 설정

CSRF_COOKIE_DOMAIN = '.hatiolab.com'
CSRF_COOKIE_SECURE = True  # HTTPS 전용
CSRF_COOKIE_SAMESITE = 'Lax'

# iframe에서의 CSRF 처리
# - SameSite=Lax로 기본 보호
# - 필요시 CSRF 토큰 명시적 전달
```

### 8.4 iframe 보안 (CSP)

```python
# Content Security Policy 설정

# 특정 도메인에서만 iframe 허용
CSP_FRAME_ANCESTORS = "'self' https://console.nubison.io"

# 또는 X-Frame-Options (레거시)
X_FRAME_OPTIONS = 'ALLOW-FROM https://console.nubison.io'
```

---

## 9. 트러블슈팅

### 9.1 일반적인 문제와 해결

#### 문제 1: 로그인 실패 (422 에러)

```
증상: USER_NOT_FOUND 에러
원인: 사용자가 Label Studio에 등록되지 않음

해결:
1. 사용자 먼저 등록 (Admin API 또는 UI)
2. SSO_AUTO_CREATE_USERS=True 설정 (권장하지 않음)
```

#### 문제 2: 쿠키가 공유되지 않음

```
증상: iframe에서 세션이 인식되지 않음
원인: 쿠키 도메인 설정 오류

해결:
1. 도메인이 "."으로 시작하는지 확인 (.hatiolab.com)
2. /etc/hosts 설정 확인
3. 브라우저 개발자 도구 → Application → Cookies 확인
```

#### 문제 3: HTTPS에서 쿠키 전송 안됨

```
증상: 프로덕션에서만 로그인 실패
원인: Secure 쿠키 설정 누락

해결:
SESSION_COOKIE_SECURE=true
CSRF_COOKIE_SECURE=true
```

#### 문제 4: 사용자 전환이 안됨

```
증상: 다른 사용자 선택해도 이전 사용자로 로그인
원인: 기존 세션 쿠키가 남아있음

해결:
1. 세션 쿠키 삭제 후 JWT 발급
2. iframe key 바인딩 확인
3. JWT 우선순위 확인
```

### 9.2 디버깅 방법

```javascript
// 쿠키 상태 확인

// 브라우저 콘솔에서
document.cookie

// Express.js에서
app.get('/api/debug/cookies', (req, res) => {
    res.json({
        ls_auth_token: req.cookies.ls_auth_token ? 'present' : 'absent',
        sessionid: req.cookies.sessionid ? 'present' : 'absent',
        csrftoken: req.cookies.csrftoken ? 'present' : 'absent'
    });
});
```

```python
# Django 로그 활성화

# settings.py
LOGGING = {
    'loggers': {
        'label_studio_sso': {
            'level': 'DEBUG',
            'handlers': ['console'],
        }
    }
}
```

### 9.3 로그 메시지 해석

| 로그 메시지 | 의미 | 조치 |
|------------|------|------|
| `JWT token found` | JWT 쿠키 발견 | 정상 |
| `JWT validation failed` | JWT 서명 검증 실패 | SECRET_KEY 확인 |
| `JWT expired` | JWT 만료 | 새 토큰 발급 |
| `User not found` | DB에 사용자 없음 | 사용자 등록 |
| `Session created` | 세션 생성 성공 | 정상 |

---

## 다음 단계

SSO 구현 방법을 이해했다면:

1. [배포 가이드](./04-deployment-guide.md)에서 프로덕션 배포 방법을 확인하세요.
2. [개발 가이드](./05-development-guide.md)에서 로컬 개발 환경을 구성해보세요.
