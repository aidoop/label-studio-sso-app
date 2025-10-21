# 서브도메인 기반 세션 공유 설정 가이드

## 🎯 개요

이 프로젝트는 서브도메인 기반으로 세션을 공유하도록 설정되어 있습니다:

- **메인 앱**: `http://nubison.localhost`
- **Label Studio**: `http://label.nubison.localhost:8080`

이렇게 설정하면 `.nubison.localhost` 도메인으로 쿠키가 공유되어, 한 번 로그인하면 모든 서브도메인에서 세션이 유지됩니다.

---

## 📋 1. /etc/hosts 설정

브라우저가 `*.nubison.localhost` 도메인을 인식하도록 `/etc/hosts` 파일을 수정해야 합니다.

### macOS / Linux

```bash
# /etc/hosts 파일 편집 (관리자 권한 필요)
sudo nano /etc/hosts

# 또는
sudo vi /etc/hosts
```

다음 라인을 **추가**:

```bash
# Nubison 로컬 개발 환경
127.0.0.1       nubison.localhost
127.0.0.1       label.nubison.localhost
```

저장 후 종료 (nano: Ctrl+X, Y, Enter / vi: ESC, :wq, Enter)

### Windows

```cmd
# 관리자 권한으로 메모장 실행
notepad C:\Windows\System32\drivers\etc\hosts
```

다음 라인을 **추가**:

```
# Nubison 로컬 개발 환경
127.0.0.1       nubison.localhost
127.0.0.1       label.nubison.localhost
```

저장 후 종료

### 검증

터미널에서 확인:

```bash
# nubison.localhost 핑 테스트
ping nubison.localhost

# label.nubison.localhost 핑 테스트
ping label.nubison.localhost

# 둘 다 127.0.0.1로 응답하면 성공
```

---

## 🔧 2. Docker Compose 실행

```bash
# 서비스 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f labelstudio
```

정상적으로 시작되면 다음 로그가 보입니다:

```
labelstudio  | => Static URL is set to: /static/
labelstudio  | System check identified no issues (0 silenced).
labelstudio  | Django version 5.1.8, using settings 'core.settings.label_studio'
labelstudio  | Starting development server at http://0.0.0.0:8080/
```

---

## 🌐 3. 브라우저 접속

### Label Studio 접속

브라우저에서 다음 URL로 접속:

```
http://label.nubison.localhost:8080
```

### 관리자 계정 생성

```bash
# Label Studio 컨테이너에 접속
docker-compose exec labelstudio bash

# 관리자 계정 생성
python /label-studio/label_studio/manage.py createsuperuser

# 정보 입력
Email address: admin@nubison.localhost
Password: (비밀번호 입력)
Password (again): (비밀번호 재입력)
```

### 로그인

`http://label.nubison.localhost:8080`에서 생성한 계정으로 로그인

---

## 🍪 4. 세션 쿠키 공유 확인

### 4.1 브라우저 개발자 도구로 확인

1. `http://label.nubison.localhost:8080`에 로그인
2. 브라우저 개발자 도구 열기 (F12)
3. **Application** 탭 → **Cookies** 선택
4. 다음 쿠키들이 **Domain: `.nubison.localhost`**로 설정되어 있는지 확인:

```
sessionid         Domain: .nubison.localhost
csrftoken         Domain: .nubison.localhost
ls_auth_token     Domain: .nubison.localhost (SSO 사용 시)
```

### 4.2 쿠키 공유 테스트

#### 시나리오 1: 메인 앱 → Label Studio

1. `http://nubison.localhost`에서 로그인 (메인 앱)
2. `http://label.nubison.localhost:8080` 접속
3. **자동으로 로그인된 상태**여야 함 ✅

#### 시나리오 2: Label Studio → 메인 앱

1. `http://label.nubison.localhost:8080`에서 로그인
2. `http://nubison.localhost` 접속 (메인 앱)
3. **자동으로 로그인된 상태**여야 함 ✅

---

## 🔍 5. 문제 해결

### 문제 1: 쿠키가 공유되지 않음

**증상**: 한쪽에서 로그인해도 다른 쪽에서 로그인 상태가 유지되지 않음

**원인 확인**:

```bash
# 1. /etc/hosts 설정 확인
cat /etc/hosts | grep nubison

# 2. 쿠키 도메인 확인 (브라우저 개발자 도구)
# Domain이 .nubison.localhost가 아니라 label.nubison.localhost로 되어 있으면 문제

# 3. 환경변수 확인
docker-compose exec labelstudio env | grep COOKIE_DOMAIN
```

**해결책**:

```bash
# .env 파일 확인
cat .env | grep COOKIE_DOMAIN

# 다음과 같이 설정되어 있어야 함:
# SESSION_COOKIE_DOMAIN=.nubison.localhost
# CSRF_COOKIE_DOMAIN=.nubison.localhost

# 서비스 재시작
docker-compose restart labelstudio
```

### 문제 2: DNS 조회 실패

**증상**: `nubison.localhost` 도메인을 찾을 수 없음

**해결책**:

```bash
# /etc/hosts 파일이 올바르게 설정되었는지 확인
sudo cat /etc/hosts | grep nubison

# DNS 캐시 초기화 (macOS)
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# DNS 캐시 초기화 (Windows)
ipconfig /flushdns

# DNS 캐시 초기화 (Linux)
sudo systemd-resolve --flush-caches
```

### 문제 3: 쿠키가 `.localhost`로 설정됨

**증상**: 쿠키 도메인이 `.nubison.localhost`가 아니라 `.localhost`로 설정됨

**원인**: 일부 브라우저는 `.localhost`를 특수하게 취급함

**해결책**:

다른 로컬 도메인 사용:

```bash
# .env 파일 수정
SESSION_COOKIE_DOMAIN=.nubison.local  # .localhost 대신 .local 사용
CSRF_COOKIE_DOMAIN=.nubison.local

# /etc/hosts 수정
127.0.0.1       nubison.local
127.0.0.1       label.nubison.local

# Label Studio URL 수정
LABEL_STUDIO_HOST=http://label.nubison.local:8080
```

### 문제 4: CSRF 검증 실패

**증상**: POST 요청 시 403 Forbidden (CSRF verification failed)

**원인**: CSRF 쿠키 도메인 설정 문제

**해결책**:

```bash
# .env 파일 확인
CSRF_COOKIE_DOMAIN=.nubison.localhost
CSRF_COOKIE_SAMESITE=Lax

# 브라우저 캐시 및 쿠키 삭제 후 재시도
```

---

## 📚 6. 환경변수 상세 설명

### `.env` 파일 핵심 설정

```bash
# Label Studio 호스트 URL
LABEL_STUDIO_HOST=http://label.nubison.localhost:8080

# 쿠키 도메인 (앞에 점(.) 필수!)
SESSION_COOKIE_DOMAIN=.nubison.localhost
CSRF_COOKIE_DOMAIN=.nubison.localhost

# 쿠키 SameSite 설정
# - Lax: 서브도메인 간 공유 가능 (권장)
# - Strict: 완전히 같은 도메인만
SESSION_COOKIE_SAMESITE=Lax
CSRF_COOKIE_SAMESITE=Lax
```

### 쿠키 도메인 설정 규칙

| 설정값 | 영향 범위 | 예시 |
|--------|-----------|------|
| `nubison.localhost` | 정확히 `nubison.localhost`만 | ❌ 서브도메인 접근 불가 |
| `.nubison.localhost` | 모든 `*.nubison.localhost` | ✅ 서브도메인 공유 가능 |
| `localhost` | 정확히 `localhost`만 | ❌ 서브도메인 접근 불가 |
| `.localhost` | 모든 `*.localhost` | ⚠️ 브라우저에 따라 작동 안 할 수 있음 |

**중요**: 쿠키 도메인은 반드시 **앞에 점(.)을 붙여야** 서브도메인 간 공유가 가능합니다!

---

## 🔒 7. 보안 고려사항

### 개발 환경 (현재)

```bash
SESSION_COOKIE_SECURE=false    # HTTP 허용
SESSION_COOKIE_SAMESITE=Lax    # 서브도메인 간 공유
```

### 프로덕션 환경 (권장)

```bash
SESSION_COOKIE_SECURE=true     # HTTPS만 허용
SESSION_COOKIE_SAMESITE=Lax    # 서브도메인 간 공유
LABEL_STUDIO_HOST=https://label.nubison.com
```

---

## 🧪 8. 테스트 스크립트

세션 공유를 자동으로 테스트하는 스크립트:

```bash
#!/bin/bash

echo "=== 세션 쿠키 공유 테스트 ==="
echo ""

# 1. Label Studio 로그인
echo "1. Label Studio 로그인 중..."
COOKIE_FILE=$(mktemp)

curl -c $COOKIE_FILE \
  -X POST http://label.nubison.localhost:8080/api/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@nubison.localhost", "password": "your-password"}'

# 2. 쿠키 확인
echo ""
echo "2. 저장된 쿠키:"
cat $COOKIE_FILE | grep -E 'sessionid|csrftoken'

# 3. 메인 도메인에서 세션 확인
echo ""
echo "3. 메인 도메인에서 세션 확인 중..."
curl -b $COOKIE_FILE http://nubison.localhost/api/user/

# 정리
rm $COOKIE_FILE
```

---

## 📖 참고 자료

- [Django Cookie 설정 문서](https://docs.djangoproject.com/en/5.1/ref/settings/#session-cookie-domain)
- [MDN: Using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
- [SameSite 쿠키 설명](https://web.dev/samesite-cookies-explained/)

---

**설정 완료 후 다음 단계:**

1. `/etc/hosts` 파일 수정
2. `docker-compose restart labelstudio`
3. `http://label.nubison.localhost:8080` 접속
4. 브라우저 개발자 도구로 쿠키 도메인 확인
5. 세션 공유 테스트

모든 것이 정상 작동하면 메인 앱과 Label Studio 간 seamless한 세션 공유가 가능합니다! 🎉
