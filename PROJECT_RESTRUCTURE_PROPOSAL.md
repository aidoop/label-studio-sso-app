# Label Studio SSO 프로젝트 재구성 제안

## 현재 구조의 문제점

### 1. 관심사의 혼재 (Mixed Concerns)

현재 `label-studio-sso-app` 프로젝트는 두 가지 독립적인 관심사를 하나의 저장소에 포함하고 있습니다:

```
label-studio-test-app/
├── [A] Label Studio 커스터마이징 (이미지 빌드)
│   ├── Dockerfile
│   ├── config/
│   ├── custom-permissions/
│   ├── custom-api/
│   ├── custom-templates/
│   └── scripts/
│
└── [B] 샘플 애플리케이션 (이미지 사용)
    ├── backend/
    ├── frontend/
    ├── docker-compose.yml
    └── 문서들
```

### 2. 구체적인 문제점

#### 재사용성 문제
- 커스텀 Label Studio 이미지를 다른 프로젝트에서 사용하려면 전체 저장소를 복제해야 함
- 샘플 앱 코드가 커스텀 이미지와 결합되어 있어 분리 불가

#### 버전 관리 문제
- 커스텀 이미지의 변경과 샘플 앱의 변경이 같은 커밋 히스토리에 섞임
- 이미지 버전과 앱 버전을 독립적으로 관리할 수 없음

#### 배포 및 CI/CD 문제
- 이미지 빌드와 앱 배포가 같은 파이프라인에서 실행되어 비효율적
- 이미지는 변경되지 않았는데 앱 변경 시에도 전체 빌드 필요

#### 문서화 혼란
- README.md가 커스텀 이미지 설명과 샘플 앱 사용법을 모두 포함
- 독립적인 사용자(이미지만 쓰는 사람 vs 전체 시스템 개발자)에게 불필요한 정보 제공

## 제안하는 이상적인 구조

### 두 개의 독립된 저장소로 분리

```
[Repository 1] label-studio-custom
├── 역할: Label Studio 커스텀 이미지 유지보수
└── 산출물: Docker Image (예: your-registry/label-studio-custom:1.20.0-sso)

[Repository 2] label-studio-sso-app
├── 역할: 커스텀 이미지를 활용하는 샘플 애플리케이션
└── 산출물: 배포 가능한 통합 솔루션 (Frontend + Backend + Label Studio)
```

---

## Repository 1: `label-studio-custom`

### 목적
Label Studio의 커스터마이징 버전을 Docker 이미지로 빌드하고 배포하는 프로젝트

### 디렉토리 구조

```
label-studio-custom/
├── README.md                          # 커스텀 이미지 소개 및 사용법
├── CHANGELOG.md                       # 이미지 버전별 변경사항
├── Dockerfile                         # 멀티스테이지 빌드
│
├── config/                            # Django 설정 파일
│   ├── label_studio.py               # SSO 통합 설정
│   └── urls_simple.py                # URL 라우팅
│
├── custom-permissions/                # Annotation 소유권 제어
│   ├── __init__.py
│   ├── apps.py
│   ├── permissions.py
│   ├── mixins.py
│   └── tests.py
│
├── custom-api/                        # API 오버라이드
│   ├── __init__.py
│   ├── annotations.py
│   └── urls.py
│
├── custom-templates/                  # 템플릿 커스터마이징
│   └── base.html                     # hideHeader 기능
│
├── scripts/                           # 초기화 스크립트
│   ├── create_initial_users.py
│   └── init_users.sh
│
├── tests/                             # 통합 테스트
│   ├── test_sso.py
│   ├── test_permissions.py
│   └── test_hideheader.py
│
├── docs/                              # 상세 문서
│   ├── FEATURES.md                   # 기능 목록
│   ├── DEPLOYMENT.md                 # 배포 가이드
│   └── CUSTOMIZATION_GUIDE.md        # 추가 커스터마이징 방법
│
├── .github/
│   └── workflows/
│       ├── build-image.yml           # 이미지 빌드 CI
│       ├── test-image.yml            # 이미지 테스트
│       └── publish-image.yml         # 이미지 배포 (태그 시)
│
└── docker-compose.test.yml            # 로컬 테스트용
```

### README.md 구조

```markdown
# Label Studio Custom - SSO Edition

> Label Studio 1.20.0 기반 커스텀 이미지
> - SSO 인증 (Native JWT)
> - hideHeader 기능
> - Annotation 소유권 제어

## Quick Start

### Docker Hub에서 사용
\`\`\`yaml
services:
  labelstudio:
    image: your-registry/label-studio-custom:1.20.0-sso
    environment:
      - JWT_SSO_NATIVE_USER_ID_CLAIM=user_id
      - JWT_SSO_COOKIE_NAME=ls_auth_token
\`\`\`

### 직접 빌드
\`\`\`bash
docker build -t label-studio-custom:local .
\`\`\`

## Features
- ✅ SSO 인증 (label-studio-sso v6.0.7)
- ✅ hideHeader 기능
- ✅ Annotation 소유권 제어

## Environment Variables
...

## Documentation
- [Features](docs/FEATURES.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Customization Guide](docs/CUSTOMIZATION_GUIDE.md)
```

### 버전 관리 전략

#### 태그 예시
- `1.20.0-sso.1` - Label Studio 1.20.0 기반, SSO 커스터마이징 버전 1
- `1.20.0-sso.2` - Label Studio 1.20.0 기반, SSO 커스터마이징 버전 2 (bugfix)
- `1.21.0-sso.1` - Label Studio 1.21.0 업그레이드

#### Git 브랜치 전략
- `main` - 안정 버전
- `develop` - 개발 버전
- `feature/new-permission` - 기능 개발
- `upgrade/ls-1.21.0` - Label Studio 업그레이드

### CI/CD 파이프라인

#### `.github/workflows/build-image.yml`
```yaml
name: Build and Test Image

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker image
        run: docker build -t label-studio-custom:test .

      - name: Run integration tests
        run: |
          docker-compose -f docker-compose.test.yml up -d
          docker-compose -f docker-compose.test.yml exec -T labelstudio pytest tests/
```

#### `.github/workflows/publish-image.yml`
```yaml
name: Publish Image

on:
  push:
    tags:
      - 'v*.*.*-sso.*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Extract version
        id: version
        run: echo "VERSION=${GITHUB_REF#refs/tags/v}" >> $GITHUB_OUTPUT

      - name: Build and push
        run: |
          docker build -t your-registry/label-studio-custom:${{ steps.version.outputs.VERSION }} .
          docker push your-registry/label-studio-custom:${{ steps.version.outputs.VERSION }}
```

---

## Repository 2: `label-studio-sso-app`

### 목적
커스텀 Label Studio 이미지를 활용하는 샘플 애플리케이션 및 통합 솔루션

### 디렉토리 구조

```
label-studio-sso-app/
├── README.md                          # 샘플 앱 소개 및 시작 가이드
├── QUICKSTART.md                      # 5분 빠른 시작
├── docker-compose.yml                 # 전체 스택 (PostgreSQL + Label Studio + Backend + Frontend)
├── .env.example                       # 환경 변수 템플릿
├── Makefile                           # 편의 명령어
│
├── backend/                           # Express.js SSO 백엔드
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   └── tests/
│
├── frontend/                          # Vue 3 프론트엔드
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   ├── src/
│   │   ├── components/
│   │   ├── views/
│   │   └── utils/
│   └── tests/
│
├── docs/                              # 통합 가이드
│   ├── ARCHITECTURE.md               # 아키텍처 설명
│   ├── DEPLOYMENT.md                 # 배포 가이드
│   └── TROUBLESHOOTING.md            # 문제 해결
│
└── .github/
    └── workflows/
        ├── test-integration.yml      # 통합 테스트
        └── deploy.yml                # 배포 자동화
```

### docker-compose.yml 변경

**현재 (커스텀 이미지 빌드)**:
```yaml
labelstudio:
  build:
    context: .
    dockerfile: Dockerfile
```

**변경 후 (퍼블리시된 이미지 사용)**:
```yaml
labelstudio:
  image: your-registry/label-studio-custom:1.20.0-sso.1

  environment:
    - JWT_SSO_NATIVE_USER_ID_CLAIM=user_id
    - JWT_SSO_COOKIE_NAME=ls_auth_token
    - SESSION_COOKIE_DOMAIN=${SESSION_COOKIE_DOMAIN}
```

### README.md 구조

```markdown
# Label Studio SSO Sample App

> Label Studio 커스텀 이미지를 활용한 SSO 통합 샘플 애플리케이션

## 이 프로젝트는 무엇인가?

이 프로젝트는 다음을 포함합니다:
- **Label Studio Custom Image** ([label-studio-custom](https://github.com/your-org/label-studio-custom))를 사용
- **Express.js Backend** - SSO 토큰 관리
- **Vue 3 Frontend** - 사용자 인터페이스
- **PostgreSQL** - 데이터베이스

## Quick Start

### 1. 환경 설정
\`\`\`bash
cp .env.example .env
make setup-hosts
\`\`\`

### 2. 실행
\`\`\`bash
docker compose up -d
make setup
\`\`\`

### 3. 접속
- Frontend: http://nubison.localhost:3000
- Label Studio: http://label.nubison.localhost:8080

## Architecture

이 프로젝트는 [label-studio-custom](https://github.com/your-org/label-studio-custom) 이미지를 사용합니다.

## Documentation
- [Architecture](docs/ARCHITECTURE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
```

---

## 마이그레이션 계획

### Phase 1: Repository 생성 (1일)

#### 1-1. `label-studio-custom` 저장소 생성
```bash
# 1. 새 저장소 생성
git init label-studio-custom
cd label-studio-custom

# 2. 필요한 파일만 복사 (label-studio-test-app에서)
cp ../label-studio-test-app/Dockerfile .
cp -r ../label-studio-test-app/config .
cp -r ../label-studio-test-app/custom-permissions .
cp -r ../label-studio-test-app/custom-api .
cp -r ../label-studio-test-app/custom-templates .
cp -r ../label-studio-test-app/scripts .

# 3. 새 README 작성
cat > README.md << 'EOF'
# Label Studio Custom - SSO Edition
...
EOF

# 4. docker-compose.test.yml 생성 (이미지 테스트용)
cat > docker-compose.test.yml << 'EOF'
version: '3.8'
services:
  postgres:
    image: postgres:13.18
    environment:
      POSTGRES_DB: labelstudio
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres

  labelstudio:
    build: .
    depends_on:
      - postgres
    environment:
      POSTGRES_HOST: postgres
      JWT_SSO_COOKIE_NAME: ls_auth_token
EOF

# 5. GitHub Actions 설정
mkdir -p .github/workflows
# ... CI/CD 파일 생성

# 6. 첫 커밋
git add .
git commit -m "feat: Initial commit - Label Studio custom image"
git remote add origin https://github.com/your-org/label-studio-custom.git
git push -u origin main
```

#### 1-2. `label-studio-sso-app` 저장소 재구성
```bash
cd label-studio-test-app

# 1. 이미지 관련 파일 삭제
rm Dockerfile
rm -rf config/
rm -rf custom-permissions/
rm -rf custom-api/
rm -rf custom-templates/
rm -rf scripts/

# 2. docker-compose.yml 수정
# build: . → image: your-registry/label-studio-custom:1.20.0-sso.1

# 3. README 재작성
# "커스텀 이미지를 사용하는 샘플 앱" 중심으로

# 4. 커밋
git add .
git commit -m "refactor: Separate custom image from sample app"
git push
```

### Phase 2: 이미지 빌드 및 배포 (1일)

#### 2-1. Docker Hub 또는 GitHub Container Registry 설정
```bash
# GitHub Container Registry 사용 예시
cd label-studio-custom

# 1. 이미지 빌드
docker build -t ghcr.io/your-org/label-studio-custom:1.20.0-sso.1 .

# 2. 이미지 푸시
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
docker push ghcr.io/your-org/label-studio-custom:1.20.0-sso.1

# 3. latest 태그도 푸시
docker tag ghcr.io/your-org/label-studio-custom:1.20.0-sso.1 \
           ghcr.io/your-org/label-studio-custom:latest
docker push ghcr.io/your-org/label-studio-custom:latest
```

#### 2-2. 샘플 앱에서 퍼블리시된 이미지 사용
```bash
cd label-studio-sso-app

# 1. docker-compose.yml 업데이트
# image: ghcr.io/your-org/label-studio-custom:1.20.0-sso.1

# 2. 테스트
docker compose pull
docker compose up -d

# 3. 동작 확인
make setup
curl http://label.nubison.localhost:8080/health
```

### Phase 3: CI/CD 설정 (1일)

#### 3-1. `label-studio-custom` CI/CD
- PR 시 자동 빌드 및 테스트
- 태그 푸시 시 이미지 배포
- CHANGELOG 자동 생성

#### 3-2. `label-studio-sso-app` CI/CD
- PR 시 통합 테스트
- main 푸시 시 스테이징 배포
- 태그 푸시 시 프로덕션 배포

### Phase 4: 문서 정리 (1일)

#### 4-1. `label-studio-custom` 문서
- README.md: 이미지 소개, 사용법
- CHANGELOG.md: 버전별 변경사항
- docs/FEATURES.md: 기능 상세 설명
- docs/DEPLOYMENT.md: 배포 가이드
- docs/CUSTOMIZATION_GUIDE.md: 추가 커스터마이징 방법

#### 4-2. `label-studio-sso-app` 문서
- README.md: 샘플 앱 소개, 빠른 시작
- QUICKSTART.md: 5분 가이드
- docs/ARCHITECTURE.md: 아키텍처 설명
- docs/TROUBLESHOOTING.md: 문제 해결

---

## 마이그레이션 체크리스트

### `label-studio-custom` Repository

- [ ] 저장소 생성
- [ ] Dockerfile 복사 및 검증
- [ ] config/, custom-permissions/, custom-api/, custom-templates/ 복사
- [ ] scripts/ 복사
- [ ] README.md 작성 (이미지 중심)
- [ ] CHANGELOG.md 작성
- [ ] docker-compose.test.yml 생성
- [ ] tests/ 디렉토리 생성 및 테스트 작성
- [ ] docs/ 디렉토리 생성 및 문서 작성
- [ ] .github/workflows/ CI/CD 설정
- [ ] 이미지 빌드 테스트
- [ ] 이미지 배포 (GitHub Container Registry 또는 Docker Hub)
- [ ] 첫 버전 태그 (v1.20.0-sso.1)

### `label-studio-sso-app` Repository

- [ ] 이미지 관련 파일 제거 (Dockerfile, config/, custom-*, scripts/)
- [ ] docker-compose.yml 수정 (build → image)
- [ ] README.md 재작성 (샘플 앱 중심)
- [ ] QUICKSTART.md 업데이트
- [ ] docs/ 재구성
- [ ] backend/, frontend/ 유지
- [ ] .env.example 업데이트
- [ ] Makefile 업데이트
- [ ] 통합 테스트
- [ ] 배포 가이드 업데이트

### 테스트 확인

- [ ] 로컬에서 이미지 빌드 및 실행
- [ ] 샘플 앱에서 퍼블리시된 이미지 사용
- [ ] SSO 인증 동작 확인
- [ ] hideHeader 기능 확인
- [ ] Annotation 소유권 제어 확인
- [ ] 사용자 전환 확인
- [ ] PostgreSQL 연결 확인
- [ ] 전체 스택 통합 테스트

---

## 예상 효과

### 1. 재사용성 향상
```yaml
# 다른 프로젝트에서도 쉽게 사용 가능
services:
  labelstudio:
    image: ghcr.io/your-org/label-studio-custom:1.20.0-sso.1
    environment:
      - JWT_SSO_COOKIE_NAME=ls_auth_token
```

### 2. 버전 관리 명확화
- 이미지 버전: `v1.20.0-sso.1`, `v1.20.0-sso.2`
- 샘플 앱 버전: `v1.0.0`, `v1.1.0`

### 3. CI/CD 효율화
- 이미지 변경 시: `label-studio-custom`만 빌드
- 앱 변경 시: `label-studio-sso-app`만 배포
- 독립적인 배포 파이프라인

### 4. 문서화 개선
- 이미지 사용자: `label-studio-custom` README만 확인
- 샘플 앱 개발자: `label-studio-sso-app` README만 확인
- 역할별로 필요한 정보만 제공

### 5. 유지보수성 향상
- 관심사 분리로 코드 이해 용이
- 각 저장소의 목적이 명확
- 기여자들이 어디에 PR을 보낼지 명확

---

## 대안 고려사항

### 대안 1: Monorepo 유지 + 명확한 디렉토리 분리

장점:
- 단일 저장소로 관리 용이
- 한 번의 clone으로 모든 코드 확보

단점:
- 여전히 이미지 재사용성 문제 존재
- CI/CD 복잡도 증가

### 대안 2: Monorepo with NX/Turborepo

장점:
- 모노레포의 이점 유지
- 빌드 캐싱 및 최적화

단점:
- 도구 도입 복잡도
- 작은 프로젝트에는 과도함

### 권장: 두 개의 독립 저장소

**이유**:
1. 프로젝트 크기가 작아 monorepo 도구가 불필요
2. 이미지와 앱의 라이프사이클이 독립적
3. 각 저장소의 목적이 명확하고 단순
4. GitHub Container Registry를 통한 이미지 배포가 간단

---

## 결론

현재 구조는 "커스텀 이미지 유지보수"와 "샘플 앱 개발"이라는 두 가지 독립적인 관심사가 혼재되어 있어, 재사용성, 버전 관리, CI/CD, 문서화 측면에서 비효율적입니다.

**제안하는 구조**:
1. **`label-studio-custom`**: 커스텀 이미지 빌드 및 배포 전용
2. **`label-studio-sso-app`**: 샘플 애플리케이션 전용 (이미지 사용)

이 구조는:
- ✅ 관심사의 명확한 분리
- ✅ 이미지 재사용성 극대화
- ✅ 독립적인 버전 관리
- ✅ 효율적인 CI/CD
- ✅ 역할별 명확한 문서화

**추정 마이그레이션 기간**: 4일
**난이도**: 중간 (기존 코드 재구성, CI/CD 설정 필요)
**권장도**: ⭐⭐⭐⭐⭐ (강력 권장)
