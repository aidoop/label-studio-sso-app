# 개발 가이드

## 목차
1. [개발 환경 설정](#1-개발-환경-설정)
2. [로컬 개발 시작](#2-로컬-개발-시작)
3. [프로젝트별 개발](#3-프로젝트별-개발)
4. [테스트](#4-테스트)
5. [디버깅](#5-디버깅)
6. [코드 스타일](#6-코드-스타일)
7. [Git 워크플로우](#7-git-워크플로우)
8. [FAQ](#8-faq)

---

## 1. 개발 환경 설정

### 1.1 필수 도구

| 도구 | 버전 | 용도 |
|------|------|------|
| **Docker** | 20.10+ | 컨테이너 런타임 |
| **Docker Compose** | v2+ | 멀티 컨테이너 관리 |
| **Node.js** | 18+ | SSO App 개발 |
| **Python** | 3.8+ | Label Studio Custom 개발 |
| **Git** | 2.30+ | 버전 관리 |

### 1.2 도구 설치

```bash
# macOS (Homebrew)
brew install --cask docker
brew install node@18 python@3.11 git

# Ubuntu
curl -fsSL https://get.docker.com | sh
apt-get install nodejs npm python3 python3-pip git
```

### 1.3 저장소 클론

```bash
# 모든 프로젝트 클론
mkdir -p ~/projects/label-studio
cd ~/projects/label-studio

git clone https://github.com/aidoop/label-studio-sso-app.git
git clone https://github.com/aidoop/label-studio-custom.git
git clone https://github.com/aidoop/label-studio-sso.git

# 디렉토리 구조
# ~/projects/label-studio/
# ├── label-studio-sso-app/     # 샘플 앱
# ├── label-studio-custom/      # 커스텀 이미지
# └── label-studio-sso/         # SSO 미들웨어
```

### 1.4 호스트 파일 설정

로컬에서 쿠키 공유가 동작하려면 서브도메인 설정이 필요합니다.

```bash
# /etc/hosts 수정 (관리자 권한 필요)
sudo vi /etc/hosts

# 다음 줄 추가
127.0.0.1  hatiolab.localhost
127.0.0.1  label.hatiolab.localhost
```

**확인**:
```bash
ping hatiolab.localhost
# PING hatiolab.localhost (127.0.0.1): 56 data bytes
```

---

## 2. 로컬 개발 시작

### 2.1 label-studio-sso-app 빠른 시작

```bash
cd ~/projects/label-studio/label-studio-sso-app

# 1. 환경 변수 설정
cp .env.example .env

# 2. 서비스 시작 (Docker Compose)
docker compose up -d

# 3. 로그 확인
docker compose logs -f

# 4. 테스트 사용자 생성
make setup

# 5. API 토큰 생성
make create-token
# 출력된 토큰을 .env 파일의 LABEL_STUDIO_API_TOKEN에 설정

# 6. 서비스 재시작
docker compose restart

# 7. 접속
# Frontend: http://hatiolab.localhost:3000
# Label Studio: http://label.hatiolab.localhost:8080
```

### 2.2 개발 모드 실행

핫 리로드가 필요한 경우 개발용 compose 파일을 사용합니다:

```bash
# 개발 모드 (소스 코드 변경 시 자동 반영)
docker compose -f docker-compose.dev.yml up -d

# 프론트엔드만 개발 모드
cd frontend
npm install
npm run dev

# 백엔드만 개발 모드
cd backend
npm install
npm run dev
```

### 2.3 Makefile 명령어

```bash
# 주요 명령어
make start          # 서비스 시작
make stop           # 서비스 중지
make restart        # 서비스 재시작
make logs           # 로그 보기
make setup          # 테스트 사용자 생성
make create-token   # API 토큰 생성
make reset-db       # 데이터베이스 초기화
make shell          # 컨테이너 셸 접속
make db-shell       # PostgreSQL 셸 접속
make test           # 헬스체크 및 API 테스트
make clean          # 모든 데이터 삭제
make info           # 서비스 정보 출력
```

---

## 3. 프로젝트별 개발

### 3.1 label-studio-sso-app 개발

#### 프론트엔드 (Vue 3)

```bash
cd label-studio-sso-app/frontend

# 의존성 설치
npm install

# 개발 서버 시작
npm run dev

# 빌드
npm run build

# 참고: 현재 lint 스크립트가 설정되어 있지 않습니다.
# 필요 시 ESLint/Prettier를 설치하고 package.json에 추가하세요.
```

**디렉토리 구조**:
```
frontend/
├── src/
│   ├── App.vue                 # 메인 컴포넌트
│   ├── main.js                 # 엔트리 포인트
│   └── components/
│       ├── LabelStudioWrapper.vue   # iframe 래퍼
│       ├── WebhookMonitor.vue       # 웹훅 모니터
│       ├── ProjectAPITest.vue       # 프로젝트 API 테스트
│       ├── ExportAPITest.vue        # Export API 테스트
│       └── TestUserCreation.vue     # 유저 생성 테스트
├── vite.config.js              # Vite 설정
└── package.json
```

**새 컴포넌트 추가**:
```vue
<!-- src/components/MyComponent.vue -->
<template>
    <div class="my-component">
        <h2>My Component</h2>
        <!-- 내용 -->
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const data = ref(null);

onMounted(async () => {
    // 초기화 로직
});
</script>

<style scoped>
.my-component {
    padding: 16px;
}
</style>
```

**App.vue에 탭 추가**:
```vue
<!-- App.vue -->
<script setup>
// 컴포넌트 임포트
import MyComponent from './components/MyComponent.vue';

// 탭 목록에 추가
const tabs = [
    // ... 기존 탭
    { id: 'my-component', label: 'My Component', component: MyComponent }
];
</script>
```

#### 백엔드 (Express.js)

```bash
cd label-studio-sso-app/backend

# 의존성 설치
npm install

# 개발 서버 시작 (nodemon으로 자동 재시작)
npm run dev

# 프로덕션 시작
npm start
```

**새 API 엔드포인트 추가**:
```javascript
// backend/server.js

/**
 * 새 엔드포인트 추가 예시
 * GET /api/my-endpoint
 */
app.get('/api/my-endpoint', async (req, res) => {
    try {
        // Label Studio API 호출
        const response = await fetch(`${LABEL_STUDIO_URL}/api/something`, {
            headers: {
                'Authorization': `Token ${LABEL_STUDIO_API_TOKEN}`
            }
        });

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});
```

### 3.2 label-studio-custom 개발

```bash
cd ~/projects/label-studio/label-studio-custom

# 1. Docker 이미지 빌드
docker build -t label-studio-custom:local .

# 2. 테스트 환경 시작
docker compose -f docker-compose.test.yml up -d

# 3. 테스트 실행
make test-quick

# 4. 로그 확인
docker compose -f docker-compose.test.yml logs -f labelstudio
```

#### 새 API 추가

```python
# custom-api/my_api.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

class MyAPIView(APIView):
    """
    새 API 엔드포인트

    GET /api/my-endpoint/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            'message': 'Hello from custom API',
            'user': request.user.email
        })

    def post(self, request):
        # POST 처리
        data = request.data
        return Response({'received': data})
```

```python
# custom-api/urls.py

from django.urls import path
from . import my_api

urlpatterns = [
    # ... 기존 URL
    path('my-endpoint/', my_api.MyAPIView.as_view()),
]
```

#### 새 Permission 추가

```python
# custom-permissions/permissions.py

from rest_framework.permissions import BasePermission

class IsProjectOwner(BasePermission):
    """프로젝트 소유자만 허용"""

    def has_object_permission(self, request, view, obj):
        return obj.created_by == request.user
```

#### 템플릿 수정

```html
<!-- custom-templates/base.html -->

{% block extra_head %}
{{ block.super }}

<script>
// 새 기능 추가
document.addEventListener('DOMContentLoaded', function() {
    // 커스텀 로직
    console.log('Custom template loaded');
});
</script>

<style>
/* 커스텀 스타일 */
.my-custom-class {
    /* ... */
}
</style>
{% endblock %}
```

### 3.3 label-studio-sso 개발

SSO 미들웨어 패키지 개발 (고급):

```bash
cd ~/projects/label-studio/label-studio-sso

# 가상환경 생성
python -m venv venv
source venv/bin/activate

# 의존성 설치
pip install -e .
pip install -r requirements-dev.txt

# 테스트 실행
pytest

# 패키지 빌드
python -m build
# dist/label_studio_sso-x.x.x-py3-none-any.whl 생성
```

---

## 4. 테스트

### 4.1 label-studio-sso-app 테스트

```bash
cd label-studio-sso-app

# 통합 테스트 실행
./tests/run-tests.sh

# 특정 테스트만 실행
./tests/run-tests.sh custom-export-api
```

**테스트 파일 구조**:
```
tests/
├── integration/
│   ├── custom-export-api.test.js        # Export API 테스트
│   ├── custom-export-api-advanced.test.js
│   └── label-studio-custom.test.js      # 커스텀 기능 테스트
├── docker-compose.test.yml              # 테스트 환경
└── run-tests.sh                         # 테스트 러너
```

### 4.2 label-studio-custom 테스트

```bash
cd label-studio-custom

# 전체 테스트 (새 환경에서)
make test

# 빠른 테스트 (기존 환경 사용)
make test-quick

# 전체 통합 테스트
make test-all

# 개별 테스트 파일 실행 예시
# (label-studio-custom 프로젝트의 Makefile 참조)
```

**테스트 작성**:
```python
# custom-api/tests.py

from django.test import TestCase
from rest_framework.test import APIClient
from users.models import User

class MyAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass'
        )
        self.client.force_authenticate(user=self.user)

    def test_my_endpoint(self):
        response = self.client.get('/api/my-endpoint/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('message', response.data)

    def test_my_endpoint_unauthorized(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/my-endpoint/')
        self.assertEqual(response.status_code, 401)
```

### 4.3 수동 테스트

**SSO 테스트**:
1. http://hatiolab.localhost:3000 접속
2. 사용자 선택
3. Label Studio iframe 로드 확인
4. 다른 사용자로 전환
5. 권한 확인 (본인 어노테이션만 수정 가능)

**API 테스트 (curl)**:
```bash
# 토큰 가져오기
TOKEN="your-api-token"

# 프로젝트 목록
curl -H "Authorization: Token $TOKEN" \
     http://label.hatiolab.localhost:8080/api/projects/

# 커스텀 Export
curl -X POST \
     -H "Authorization: Token $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"project_id": 1, "response_type": "count"}' \
     http://label.hatiolab.localhost:8080/api/custom/export/
```

---

## 5. 디버깅

### 5.1 로그 확인

```bash
# 모든 서비스 로그
docker compose logs -f

# 특정 서비스 로그
docker compose logs -f labelstudio
docker compose logs -f backend
docker compose logs -f postgres

# 최근 100줄만
docker compose logs --tail=100 labelstudio
```

### 5.2 Django 디버깅

```bash
# Django 셸 접속
docker compose exec labelstudio python manage.py shell

# Python 셸에서
>>> from users.models import User
>>> User.objects.all()
>>> user = User.objects.get(email='admin@hatiolab.com')
>>> user.is_superuser
True
```

### 5.3 데이터베이스 디버깅

```bash
# PostgreSQL 셸 접속
docker compose exec postgres psql -U postgres -d labelstudio

# SQL 쿼리
labelstudio=# SELECT * FROM auth_user;
labelstudio=# SELECT * FROM project;
labelstudio=# SELECT * FROM task WHERE project_id = 1;
labelstudio=# SELECT * FROM annotation WHERE task_id = 1;
```

### 5.4 네트워크 디버깅

```bash
# 컨테이너 네트워크 확인
docker network inspect labelstudio

# 컨테이너 간 통신 테스트
docker compose exec backend ping labelstudio
docker compose exec backend curl http://labelstudio:8080/health
```

### 5.5 브라우저 디버깅

**쿠키 확인**:
1. 개발자 도구 열기 (F12)
2. Application → Cookies
3. `ls_auth_token`, `sessionid`, `csrftoken` 확인

**네트워크 요청 확인**:
1. Network 탭
2. XHR/Fetch 필터
3. 요청/응답 헤더 및 본문 확인

**콘솔 로그**:
```javascript
// 현재 쿠키 확인
console.log(document.cookie);

// iframe 상태 확인
console.log(document.querySelector('iframe').contentWindow);
```

### 5.6 VS Code 디버깅

**launch.json 설정**:
```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "node",
            "request": "attach",
            "name": "Attach to Backend",
            "port": 9229,
            "restart": true
        },
        {
            "type": "chrome",
            "request": "launch",
            "name": "Launch Chrome",
            "url": "http://hatiolab.localhost:3000",
            "webRoot": "${workspaceFolder}/frontend/src"
        }
    ]
}
```

---

## 6. 코드 스타일

### 6.1 JavaScript/Vue (Prettier + ESLint)

```json
// .prettierrc
{
    "semi": true,
    "singleQuote": true,
    "tabWidth": 4,
    "trailingComma": "es5"
}
```

```json
// .eslintrc.json
{
    "extends": [
        "eslint:recommended",
        "plugin:vue/vue3-recommended"
    ],
    "rules": {
        "vue/multi-word-component-names": "off"
    }
}
```

### 6.2 Python (Black + isort)

```toml
# pyproject.toml
[tool.black]
line-length = 100
target-version = ['py38']

[tool.isort]
profile = "black"
line_length = 100
```

```bash
# 포맷팅
black custom-api/
isort custom-api/

# 린트
flake8 custom-api/
```

### 6.3 커밋 메시지 규칙

```
<type>: <subject>

<body>

<footer>
```

**타입**:
- `feat`: 새 기능
- `fix`: 버그 수정
- `docs`: 문서 변경
- `style`: 코드 포맷팅
- `refactor`: 리팩토링
- `test`: 테스트 추가
- `chore`: 빌드/설정 변경

**예시**:
```
feat: Add custom export API date range filter

- Support ISO 8601 timezone format
- Add search_date_field parameter for dynamic field selection
- Optimize N+1 queries with prefetch_related

Closes #123
```

---

## 7. Git 워크플로우

### 7.1 브랜치 전략

```
main (프로덕션)
  │
  ├── develop (개발)
  │     │
  │     ├── feature/add-export-api
  │     ├── feature/user-management
  │     └── fix/sso-cookie-issue
  │
  └── release/v1.0.11
```

### 7.2 작업 플로우

```bash
# 1. 최신 코드 가져오기
git checkout develop
git pull origin develop

# 2. 기능 브랜치 생성
git checkout -b feature/my-feature

# 3. 작업 및 커밋
git add .
git commit -m "feat: Add my feature"

# 4. 원격에 푸시
git push origin feature/my-feature

# 5. Pull Request 생성 (GitHub)

# 6. 리뷰 후 머지
# (GitHub에서 "Squash and merge" 권장)
```

### 7.3 릴리스 프로세스

```bash
# 1. develop에서 릴리스 브랜치 생성
git checkout develop
git checkout -b release/v1.0.11

# 2. 버전 업데이트
# - package.json
# - CHANGELOG.md

# 3. 테스트

# 4. main에 머지
git checkout main
git merge release/v1.0.11

# 5. 태그 생성
git tag v1.0.11
git push origin main --tags

# 6. develop에 백머지
git checkout develop
git merge main
```

---

## 8. FAQ

### Q1: 로컬에서 쿠키가 공유되지 않아요

**원인**: 호스트 파일 설정 누락

**해결**:
```bash
# /etc/hosts 확인
cat /etc/hosts | grep hatiolab

# 없으면 추가
sudo echo "127.0.0.1 hatiolab.localhost" >> /etc/hosts
sudo echo "127.0.0.1 label.hatiolab.localhost" >> /etc/hosts
```

### Q2: Label Studio가 시작되지 않아요

**원인**: PostgreSQL 연결 실패

**해결**:
```bash
# PostgreSQL 상태 확인
docker compose ps postgres

# 로그 확인
docker compose logs postgres

# 재시작
docker compose restart postgres
docker compose restart labelstudio
```

### Q3: API 토큰이 작동하지 않아요

**원인**: 토큰이 만료되었거나 잘못된 사용자

**해결**:
```bash
# 새 토큰 생성
docker compose exec labelstudio \
    python manage.py drf_create_token admin@hatiolab.com

# .env 파일 업데이트
# LABEL_STUDIO_API_TOKEN=새로운_토큰

# 서비스 재시작
docker compose restart backend
```

### Q4: 사용자 전환이 안 돼요

**원인**: 기존 세션 쿠키가 남아있음

**해결**:
1. 브라우저 개발자 도구 → Application → Cookies
2. 모든 쿠키 삭제
3. 페이지 새로고침

### Q5: Docker 빌드가 느려요

**해결**: BuildKit 캐시 활용
```bash
# BuildKit 활성화
export DOCKER_BUILDKIT=1

# 캐시 활용 빌드
docker build --cache-from ghcr.io/aidoop/label-studio-custom:latest \
    -t label-studio-custom:local .
```

### Q6: 프론트엔드 변경이 반영되지 않아요

**해결**: 캐시 무효화
```bash
# Vite 캐시 삭제
rm -rf frontend/node_modules/.vite

# npm 캐시 삭제
npm cache clean --force

# 재시작
npm run dev
```

### Q7: Python 의존성 충돌이 발생해요

**해결**: 가상환경 재생성
```bash
# 기존 가상환경 삭제
rm -rf venv

# 새로 생성
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Q8: Git 충돌이 발생했어요

**해결**:
```bash
# 충돌 파일 확인
git status

# 수동으로 충돌 해결 후
git add <resolved-files>
git commit -m "Resolve merge conflicts"

# 또는 특정 버전 선택
git checkout --ours <file>    # 내 변경 사용
git checkout --theirs <file>  # 상대방 변경 사용
```

---

## 추가 리소스

### 공식 문서

- [Label Studio Documentation](https://labelstud.io/guide/)
- [Django Documentation](https://docs.djangoproject.com/)
- [Vue 3 Documentation](https://vuejs.org/guide/)
- [Express.js Documentation](https://expressjs.com/)

### 프로젝트 저장소

- [label-studio-sso-app](https://github.com/aidoop/label-studio-sso-app)
- [label-studio-custom](https://github.com/aidoop/label-studio-custom)
- [label-studio-sso](https://github.com/aidoop/label-studio-sso)

### 문의

문제가 발생하면 GitHub Issues를 통해 문의해주세요.
