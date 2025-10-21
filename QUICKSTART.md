# Label Studio + SSO 빠른 시작 가이드

## 🚀 3단계로 시작하기

### 1단계: /etc/hosts 설정

```bash
# macOS/Linux
sudo nano /etc/hosts

# 다음 2줄 추가:
127.0.0.1       nubison.localhost
127.0.0.1       label.nubison.localhost
```

**Windows:** 관리자 권한 메모장으로 `C:\Windows\System32\drivers\etc\hosts` 편집

---

### 2단계: Docker Compose 실행

```bash
cd /Users/super/Documents/GitHub/label-studio-test-app

# 서비스 시작
docker-compose up -d

# 로그 확인 (선택사항)
docker-compose logs -f
```

---

### 3단계: 초기 사용자 생성

**방법 A: 자동 생성 (권장 - 관리자 + 일반 사용자 4명)**

```bash
# Makefile 사용
make init-users

# 또는 직접 실행
docker-compose exec labelstudio bash /scripts/init_users.sh
```

**생성되는 계정:**
- `admin@nubison.localhost` / `admin123` (관리자)
- `user1@nubison.localhost` / `user123` (일반 사용자)
- `user2@nubison.localhost` / `user123` (일반 사용자)
- `annotator@nubison.localhost` / `annotator123` (일반 사용자)

**방법 B: 수동 생성 (관리자만)**

```bash
# Makefile 사용
make create-user

# 또는 직접 실행
docker-compose exec labelstudio bash
python /label-studio/label_studio/manage.py createsuperuser
# Email: admin@nubison.localhost
# Password: (원하는 비밀번호)
exit
```

**접속:** http://label.nubison.localhost:8080

---

## 📋 필수 환경변수 (.env)

```bash
# PostgreSQL
POSTGRES_PASSWORD=dev_postgres_2024

# Label Studio URL
LABEL_STUDIO_HOST=http://label.nubison.localhost:8080

# 서브도메인 쿠키 공유 (세션 공유)
SESSION_COOKIE_DOMAIN=.nubison.localhost
CSRF_COOKIE_DOMAIN=.nubison.localhost
```

---

## 🍪 세션 공유 확인

브라우저 개발자 도구 (F12) → Application → Cookies

다음 쿠키의 **Domain**이 `.nubison.localhost`인지 확인:
- `sessionid`
- `csrftoken`

✅ 이제 `http://nubison.localhost`와 `http://label.nubison.localhost:8080`에서 세션이 공유됩니다!

---

## 🔧 자주 사용하는 명령어

```bash
# 시작
docker-compose up -d

# 중지
docker-compose stop

# 재시작
docker-compose restart

# 로그
docker-compose logs -f labelstudio

# 컨테이너 접속
docker-compose exec labelstudio bash

# 완전 삭제 (데이터 포함)
docker-compose down -v
```

---

## 🆘 문제 해결

### 도메인 접속 안 됨
```bash
# /etc/hosts 확인
cat /etc/hosts | grep nubison

# DNS 캐시 초기화 (macOS)
sudo dscacheutil -flushcache
```

### 쿠키 공유 안 됨
```bash
# 환경변수 확인
cat .env | grep COOKIE_DOMAIN

# 서비스 재시작
docker-compose restart labelstudio
```

---

**상세 문서:** `README-DOCKER.md`, `HOSTS-SETUP.md`
