# Label Studio + SSO Docker Compose 환경

이 프로젝트는 **Label Studio 1.20.0** + **PostgreSQL 13.18** + **label-studio-sso** 통합 환경을 Docker Compose로 구성한 것입니다.

## 📋 목차

- [구성 요소](#구성-요소)
- [빠른 시작](#빠른-시작)
- [상세 설치 가이드](#상세-설치-가이드)
- [SSO 사용 방법](#sso-사용-방법)
- [관리 명령어](#관리-명령어)
- [문제 해결](#문제-해결)
- [프로덕션 배포](#프로덕션-배포)

---

## 🎯 구성 요소

### 서비스

| 서비스 | 버전 | 설명 |
|--------|------|------|
| **Label Studio** | 1.20.0 | 데이터 라벨링 플랫폼 (SSO 통합) |
| **PostgreSQL** | 13.18 | 데이터베이스 |
| **label-studio-sso** | 6.0.7 | JWT 기반 SSO 인증 |

### 디렉토리 구조

```
label-studio-test-app/
├── docker-compose.yml          # Docker Compose 설정
├── Dockerfile                   # Label Studio 커스텀 이미지
├── .env.example                 # 환경변수 템플릿
├── .env                         # 실제 환경변수 (생성 필요)
├── config/                      # Label Studio 설정 파일
│   ├── label_studio.py         # Django 설정 (SSO 포함)
│   └── urls.py                 # URL 패턴 (SSO API)
├── data/                        # 데이터 볼륨 (자동 생성)
│   ├── postgres/               # PostgreSQL 데이터
│   └── labelstudio/            # Label Studio 데이터
└── logs/                        # 로그 파일 (선택사항)
```

---

## 🚀 빠른 시작

### 1. 환경변수 설정

```bash
# .env.example을 .env로 복사
cp .env.example .env

# .env 파일 편집 (비밀번호 등 변경)
vi .env
```

**최소한 변경해야 할 항목:**
- `POSTGRES_PASSWORD`: PostgreSQL 비밀번호

### 2. Docker 이미지 빌드 및 실행

```bash
# Docker 이미지 빌드 및 서비스 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f
```

### 3. Label Studio 초기 설정

```bash
# Label Studio 컨테이너에 접속
docker-compose exec labelstudio bash

# 관리자 계정 생성
python /label-studio/label_studio/manage.py createsuperuser

# 데이터베이스 마이그레이션 (필요시)
python /label-studio/label_studio/manage.py migrate

# 컨테이너 종료
exit
```

### 4. 접속 확인

브라우저에서 http://localhost:8080 접속

- 생성한 관리자 계정으로 로그인
- 프로젝트 생성 및 데이터 라벨링 시작!

---

## 📖 상세 설치 가이드

### 사전 요구사항

- **Docker**: 20.10 이상
- **Docker Compose**: 1.29 이상
- **디스크 공간**: 최소 5GB 권장

### 설치 단계

#### Step 1: 저장소 클론 (또는 파일 복사)

```bash
cd /path/to/your/project
```

#### Step 2: 환경변수 파일 생성

```bash
cp .env.example .env
```

`.env` 파일 수정:

```bash
# PostgreSQL 설정
POSTGRES_DB=labelstudio
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here  # 변경 필수!

# Label Studio 설정
LABEL_STUDIO_PORT=8080
LABEL_STUDIO_HOST=http://localhost:8080
DEBUG=false
LOG_LEVEL=INFO

# SSO 설정
SSO_TOKEN_EXPIRY=600
SSO_AUTO_CREATE_USERS=true
```

#### Step 3: Docker 이미지 빌드

```bash
# 이미지 빌드 (label-studio-sso 포함)
docker-compose build

# 또는 빌드와 동시에 실행
docker-compose up -d --build
```

#### Step 4: 데이터베이스 초기화

```bash
# 서비스가 실행 중인지 확인
docker-compose ps

# Label Studio 컨테이너에 접속
docker-compose exec labelstudio bash

# 마이그레이션 실행
python /label-studio/label_studio/manage.py migrate

# 관리자 계정 생성
python /label-studio/label_studio/manage.py createsuperuser
# Email: admin@example.com
# Password: (강력한 비밀번호 입력)
```

#### Step 5: SSO API Token 생성

SSO 토큰 발급을 위한 Admin API Token 생성:

```bash
# Label Studio 컨테이너에서 실행
docker-compose exec labelstudio bash

# API Token 생성
python /label-studio/label_studio/manage.py drf_create_token admin@example.com

# 출력된 토큰을 안전하게 보관
# Generated token: abc123def456...
```

#### Step 6: 서비스 확인

```bash
# 헬스체크
curl http://localhost:8080/health

# 버전 확인
curl http://localhost:8080/api/version/

# SSO API 엔드포인트 확인
curl -X POST http://localhost:8080/api/sso/token \
  -H "Authorization: Token <your-admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com"}'

# 응답 예시:
# {"token": "eyJhbGc...", "expires_in": 600}
```

---

## 🔐 SSO 사용 방법

### 1. SSO 토큰 발급 API

외부 애플리케이션에서 Label Studio JWT 토큰을 발급받습니다.

**엔드포인트**: `POST /api/sso/token`

**요청 예시 (Node.js)**:

```javascript
const axios = require('axios');

// Label Studio Admin API Token
const apiToken = 'your-admin-api-token';

// JWT 토큰 발급 요청
const response = await axios.post(
  'http://localhost:8080/api/sso/token',
  { email: 'user@example.com' },
  {
    headers: {
      'Authorization': `Token ${apiToken}`,
      'Content-Type': 'application/json'
    }
  }
);

const { token, expires_in } = response.data;
console.log('JWT Token:', token);
console.log('Expires in:', expires_in, 'seconds');
```

**요청 예시 (Python)**:

```python
import requests

# Label Studio Admin API Token
api_token = 'your-admin-api-token'

# JWT 토큰 발급 요청
response = requests.post(
    'http://localhost:8080/api/sso/token',
    json={'email': 'user@example.com'},
    headers={
        'Authorization': f'Token {api_token}',
        'Content-Type': 'application/json'
    }
)

data = response.json()
print(f"JWT Token: {data['token']}")
print(f"Expires in: {data['expires_in']} seconds")
```

### 2. JWT 토큰으로 인증

발급받은 JWT 토큰을 사용하여 Label Studio에 자동 로그인:

**방법 A: 쿠키 사용 (권장)**

```javascript
// HttpOnly 쿠키로 설정
res.cookie('ls_auth_token', token, {
  httpOnly: true,
  secure: true,      // HTTPS 환경에서만
  sameSite: 'strict',
  maxAge: expires_in * 1000
});

// Label Studio로 리다이렉트
res.redirect('http://localhost:8080/projects/');
```

**방법 B: URL 파라미터 사용 (폴백)**

```html
<!-- iframe 또는 링크로 사용 -->
<iframe src="http://localhost:8080/projects/?token=eyJhbGc..."></iframe>

<!-- 또는 리다이렉트 -->
window.location.href = `http://localhost:8080/projects/?token=${token}`;
```

### 3. 사용자 자동 생성

`.env` 파일에서 `SSO_AUTO_CREATE_USERS=true`로 설정하면, SSO 로그인 시 존재하지 않는 사용자를 자동으로 생성합니다.

```bash
# .env
SSO_AUTO_CREATE_USERS=true
```

---

## 🛠️ 관리 명령어

### 서비스 관리

```bash
# 서비스 시작
docker-compose up -d

# 서비스 중지
docker-compose stop

# 서비스 중지 및 삭제
docker-compose down

# 서비스 중지 및 볼륨까지 삭제 (주의: 데이터 삭제됨!)
docker-compose down -v

# 서비스 재시작
docker-compose restart

# 특정 서비스만 재시작
docker-compose restart labelstudio
```

### 로그 확인

```bash
# 모든 서비스 로그
docker-compose logs -f

# 특정 서비스 로그
docker-compose logs -f labelstudio
docker-compose logs -f postgres

# 최근 100줄만 보기
docker-compose logs --tail=100 -f labelstudio
```

### 컨테이너 접속

```bash
# Label Studio 컨테이너 접속
docker-compose exec labelstudio bash

# PostgreSQL 컨테이너 접속
docker-compose exec postgres bash

# PostgreSQL CLI 접속
docker-compose exec postgres psql -U postgres -d labelstudio
```

### 데이터베이스 관리

```bash
# 마이그레이션 생성
docker-compose exec labelstudio python /label-studio/label_studio/manage.py makemigrations

# 마이그레이션 적용
docker-compose exec labelstudio python /label-studio/label_studio/manage.py migrate

# 사용자 생성
docker-compose exec labelstudio python /label-studio/label_studio/manage.py createsuperuser

# Django shell 실행
docker-compose exec labelstudio python /label-studio/label_studio/manage.py shell
```

### 백업 및 복원

```bash
# PostgreSQL 백업
docker-compose exec postgres pg_dump -U postgres labelstudio > backup.sql

# PostgreSQL 복원
cat backup.sql | docker-compose exec -T postgres psql -U postgres labelstudio

# 볼륨 백업 (데이터 디렉토리)
docker run --rm -v label-studio-test-app_postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres_backup.tar.gz -C /data .

# 볼륨 복원
docker run --rm -v label-studio-test-app_postgres_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/postgres_backup.tar.gz -C /data
```

---

## 🔧 문제 해결

### 일반적인 문제

#### 1. 포트 충돌 (Port already in use)

**증상**: `Bind for 0.0.0.0:8080 failed: port is already allocated`

**해결**:
```bash
# .env 파일에서 다른 포트 사용
LABEL_STUDIO_PORT=8081

# 또는 이미 사용 중인 프로세스 종료
lsof -i :8080
kill -9 <PID>
```

#### 2. PostgreSQL 연결 실패

**증상**: `could not connect to server: Connection refused`

**해결**:
```bash
# PostgreSQL 컨테이너가 실행 중인지 확인
docker-compose ps postgres

# PostgreSQL 헬스체크 확인
docker-compose exec postgres pg_isready -U postgres

# 로그 확인
docker-compose logs postgres
```

#### 3. 마이그레이션 오류

**증상**: `django.db.migrations.exceptions.InconsistentMigrationHistory`

**해결**:
```bash
# 컨테이너 재시작
docker-compose restart labelstudio

# 마이그레이션 재실행
docker-compose exec labelstudio python /label-studio/label_studio/manage.py migrate --fake-initial
```

#### 4. SSO API 404 오류

**증상**: `POST /api/sso/token returns 404`

**해결**:
```bash
# 설정 파일이 올바르게 마운트되었는지 확인
docker-compose exec labelstudio cat /label-studio/label_studio/core/urls.py | grep sso

# 컨테이너 재시작
docker-compose restart labelstudio
```

#### 5. 권한 오류 (Permission denied)

**증상**: `Permission denied: '/label-studio/data'`

**해결**:
```bash
# 호스트 디렉토리 권한 수정
chmod -R 755 ./data

# 또는 Docker 볼륨 사용 (docker-compose.yml 기본 설정)
```

### 디버그 모드 활성화

```bash
# .env 파일 수정
DEBUG=true
LOG_LEVEL=DEBUG

# 서비스 재시작
docker-compose restart labelstudio

# 상세 로그 확인
docker-compose logs -f labelstudio
```

### 완전 초기화

모든 데이터를 삭제하고 처음부터 시작:

```bash
# 서비스 중지 및 볼륨 삭제
docker-compose down -v

# 이미지 삭제 (선택사항)
docker-compose down --rmi all

# 다시 시작
docker-compose up -d --build
```

---

## 🚀 프로덕션 배포

### 보안 체크리스트

- [ ] `.env` 파일의 모든 비밀번호 변경
- [ ] `DEBUG=false` 설정
- [ ] `SESSION_COOKIE_SECURE=true` (HTTPS 환경)
- [ ] PostgreSQL 외부 접근 차단 (포트 5432 비공개)
- [ ] Admin API Token을 환경변수로 관리
- [ ] 정기적인 데이터베이스 백업 설정
- [ ] 로그 모니터링 설정

### HTTPS 설정 (Nginx 예시)

```nginx
server {
    listen 443 ssl http2;
    server_name labelstudio.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 지원
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 환경변수 업데이트

```bash
# .env (프로덕션)
LABEL_STUDIO_HOST=https://labelstudio.example.com
SESSION_COOKIE_SECURE=true
DEBUG=false
LOG_LEVEL=WARNING
```

### 리소스 제한 설정

`docker-compose.yml`에 리소스 제한 추가:

```yaml
services:
  labelstudio:
    # ... 기존 설정 ...
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G

  postgres:
    # ... 기존 설정 ...
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G
```

---

## 📚 추가 리소스

- [Label Studio 공식 문서](https://labelstud.io/guide/)
- [label-studio-sso GitHub](https://github.com/aidoop/label-studio-sso)
- [label-studio-sso PyPI](https://pypi.org/project/label-studio-sso/)
- [Docker Compose 문서](https://docs.docker.com/compose/)

---

## 💬 지원

문제가 발생하거나 질문이 있으시면:

1. 먼저 [문제 해결](#문제-해결) 섹션을 확인하세요
2. GitHub Issues에 문제를 보고하세요
3. 로그 파일을 첨부하면 더 빠르게 해결할 수 있습니다

---

**Happy Labeling! 🏷️**
