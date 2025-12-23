# Label Studio 커스터마이징 방법론

## 목차
1. [커스터마이징 개요](#1-커스터마이징-개요)
2. [레이어별 커스터마이징](#2-레이어별-커스터마이징)
3. [label-studio-custom 구조](#3-label-studio-custom-구조)
4. [Django 설정 커스터마이징](#4-django-설정-커스터마이징)
5. [URL 라우팅 커스터마이징](#5-url-라우팅-커스터마이징)
6. [API 확장](#6-api-확장)
7. [권한 시스템 확장](#7-권한-시스템-확장)
8. [프론트엔드 커스터마이징](#8-프론트엔드-커스터마이징)
9. [Webhook 확장](#9-webhook-확장)
10. [Docker 이미지 빌드](#10-docker-이미지-빌드)

---

## 1. 커스터마이징 개요

### 1.1 커스터마이징 원칙

**핵심 원칙**: Label Studio 원본 코드를 최소한으로 수정하고, 확장 레이어를 통해 기능 추가

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        커스터마이징 원칙                                      │
└─────────────────────────────────────────────────────────────────────────────┘

  ✅ 권장하는 방식:
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  1. Django Settings 오버라이드 (label_studio.py)                        │
  │  2. URL 우선 등록 (urls_simple.py)                                      │
  │  3. ViewSet 상속 및 확장                                                 │
  │  4. Permission 클래스 추가                                               │
  │  5. Template 오버라이드                                                  │
  │  6. Middleware 추가                                                     │
  └─────────────────────────────────────────────────────────────────────────┘

  ❌ 피해야 할 방식:
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  1. Label Studio 원본 코드 직접 수정                                     │
  │  2. 데이터베이스 스키마 직접 변경                                         │
  │  3. React 프론트엔드 코드 직접 수정                                       │
  └─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 커스터마이징 레이어 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                    커스터마이징 레이어 구조                        │
├─────────────────────────────────────────────────────────────────┤
│  Layer 6: Source Patching (patch_webhooks.py)                   │
│           → Webhook 페이로드에 사용자 정보 추가 (최후 수단)         │
├─────────────────────────────────────────────────────────────────┤
│  Layer 5: Custom Templates (base.html)                          │
│           → hideHeader, Date Filter UI, Import 버튼 숨김         │
├─────────────────────────────────────────────────────────────────┤
│  Layer 4: Custom Permissions                                    │
│           → IsAnnotationOwnerOrReadOnly (본인 어노테이션만 편집)   │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: Custom REST APIs (custom-api/)                        │
│           → Export API, Admin User API, Version API             │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: URL Routing (urls_simple.py)                          │
│           → 커스텀 API 우선 등록                                  │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: Django Settings (label_studio.py)                     │
│           → SSO 백엔드, 미들웨어, 쿠키 설정                        │
├─────────────────────────────────────────────────────────────────┤
│  Base: Label Studio 1.20.0 (변경 없음)                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 레이어별 커스터마이징

### 2.1 레이어 비교표

| 레이어 | 용도 | 난이도 | 영향 범위 |
|--------|------|--------|----------|
| **L1: Settings** | 전역 설정 변경 | 쉬움 | 전체 |
| **L2: URL** | 엔드포인트 추가/오버라이드 | 쉬움 | API |
| **L3: API** | 새 API 엔드포인트 추가 | 중간 | API |
| **L4: Permission** | 접근 제어 로직 | 중간 | 특정 API |
| **L5: Template** | UI 변경 | 중간 | 프론트엔드 |
| **L6: Patching** | 원본 코드 수정 | 어려움 | 특정 기능 |

### 2.2 커스터마이징 결정 플로우차트

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    커스터마이징 결정 플로우차트                                │
└─────────────────────────────────────────────────────────────────────────────┘

  요구사항 확인
        │
        ▼
  ┌───────────────┐
  │ 설정만 변경?   │──Yes──▶ Layer 1: Django Settings
  └───────┬───────┘
          │No
          ▼
  ┌───────────────┐
  │ 새 API 필요?  │──Yes──▶ Layer 2-3: URL + Custom API
  └───────┬───────┘
          │No
          ▼
  ┌───────────────┐
  │ 권한 변경?    │──Yes──▶ Layer 4: Custom Permission
  └───────┬───────┘
          │No
          ▼
  ┌───────────────┐
  │ UI 변경?      │──Yes──▶ Layer 5: Custom Template
  └───────┬───────┘
          │No
          ▼
  ┌───────────────┐
  │ 원본 수정 필수?│──Yes──▶ Layer 6: Source Patching
  └───────────────┘              (최후의 수단)
```

---

## 3. label-studio-custom 구조

### 3.1 디렉토리 구조

```
label-studio-custom/
├── Dockerfile                      # 멀티스테이지 Docker 빌드
│
├── config/                         # Django 설정 오버라이드
│   ├── label_studio.py            # 메인 설정 파일 (264줄)
│   ├── urls_simple.py             # URL 라우팅 (138줄)
│   └── security_middleware.py      # 보안 미들웨어 (96줄)
│
├── custom-api/                     # 커스텀 REST API
│   ├── __init__.py
│   ├── apps.py                    # Django App 설정
│   ├── urls.py                    # API URL 패턴
│   ├── export.py                  # Custom Export API (306줄)
│   ├── export_serializers.py       # Export 직렬화 (196줄)
│   ├── admin_users.py             # 관리자 API (349줄)
│   ├── annotations.py             # Annotation 오버라이드 (24줄)
│   ├── projects.py                # Project 오버라이드 (86줄)
│   ├── version.py                 # 버전 API (141줄)
│   ├── users.py                   # 사용자 API (146줄)
│   ├── signals.py                 # Django Signal (47줄)
│   ├── sso_views.py               # SSO 뷰 (30줄)
│   └── tests.py                   # 테스트 (998줄)
│
├── custom-permissions/             # 권한 시스템
│   ├── __init__.py
│   ├── apps.py                    # Django App 설정
│   ├── permissions.py             # 권한 클래스 (145줄)
│   ├── mixins.py                  # 뷰 믹스인 (35줄)
│   └── tests.py                   # 테스트 (147줄)
│
├── custom-templates/               # 템플릿 오버라이드
│   └── base.html                  # 메인 템플릿 (600+ 줄)
│
├── scripts/                        # 빌드/런타임 스크립트
│   ├── patch_webhooks.py          # Webhook 패치 (88줄)
│   ├── create_initial_users.py    # 초기 사용자 생성
│   └── init_users.sh              # 사용자 초기화 셸
│
├── label_studio_sso-6.0.8-py3-none-any.whl  # SSO 패키지
│
├── k8s/                           # Kubernetes 매니페스트
├── docs/                          # 문서
└── .github/workflows/             # CI/CD
```

### 3.2 각 디렉토리 역할

| 디렉토리 | 역할 | 주요 파일 |
|---------|------|----------|
| `config/` | Django 설정 오버라이드 | label_studio.py, urls_simple.py |
| `custom-api/` | REST API 확장 | export.py, admin_users.py |
| `custom-permissions/` | 권한 시스템 확장 | permissions.py, mixins.py |
| `custom-templates/` | UI 커스터마이징 | base.html |
| `scripts/` | 빌드/런타임 스크립트 | patch_webhooks.py |

---

## 4. Django 설정 커스터마이징

### 4.1 label_studio.py 구조

```python
# config/label_studio.py

# 1. 기본 임포트
from label_studio.core.settings.base import *

# 2. 환경 변수 헬퍼 함수
def get_env(key, default=None):
    return os.environ.get(key, default)

def get_bool_env(key, default=False):
    return get_env(key, str(default)).lower() in ('true', '1', 'yes')

# 3. 데이터베이스 설정
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': get_env('POSTGRES_DB', 'labelstudio'),
        'USER': get_env('POSTGRES_USER', 'postgres'),
        'PASSWORD': get_env('POSTGRES_PASSWORD', ''),
        'HOST': get_env('POSTGRES_HOST', 'postgres'),
        'PORT': get_env('POSTGRES_PORT', '5432'),
    }
}

# 4. 앱 등록 (INSTALLED_APPS 확장)
INSTALLED_APPS += [
    'label_studio_sso',              # SSO 패키지
    'label_studio.custom_permissions', # 커스텀 권한
    'label_studio.custom_api',        # 커스텀 API
]

# 5. 미들웨어 설정
MIDDLEWARE.append('label_studio_sso.middleware.JWTAutoLoginMiddleware')

# 6. 인증 백엔드 설정
AUTHENTICATION_BACKENDS = [
    'label_studio_sso.backends.JWTAuthenticationBackend',
    'rules.permissions.ObjectPermissionBackend',
    'django.contrib.auth.backends.ModelBackend',
]

# 7. 세션/쿠키 설정
SESSION_COOKIE_DOMAIN = get_env('SESSION_COOKIE_DOMAIN', None)
SESSION_COOKIE_SECURE = get_bool_env('SESSION_COOKIE_SECURE', False)
CSRF_COOKIE_DOMAIN = get_env('CSRF_COOKIE_DOMAIN', None)
CSRF_COOKIE_SECURE = get_bool_env('CSRF_COOKIE_SECURE', False)

# 8. SSO 설정
JWT_SSO_NATIVE_USER_ID_CLAIM = get_env('JWT_SSO_NATIVE_USER_ID_CLAIM', 'user_id')
JWT_SSO_COOKIE_NAME = get_env('JWT_SSO_COOKIE_NAME', 'ls_auth_token')
SSO_TOKEN_EXPIRY = int(get_env('SSO_TOKEN_EXPIRY', '600'))
SSO_AUTO_CREATE_USERS = False  # 사전 등록된 사용자만 허용
```

### 4.2 주요 설정 항목

| 설정 | 용도 | 예시 값 |
|------|------|--------|
| `INSTALLED_APPS` | Django 앱 등록 | `['label_studio_sso', ...]` |
| `MIDDLEWARE` | 미들웨어 체인 | `[..., 'JWTAutoLoginMiddleware']` |
| `AUTHENTICATION_BACKENDS` | 인증 백엔드 | `['JWTAuthenticationBackend', ...]` |
| `SESSION_COOKIE_DOMAIN` | 세션 쿠키 도메인 | `.hatiolab.com` |
| `JWT_SSO_COOKIE_NAME` | JWT 쿠키 이름 | `ls_auth_token` |

### 4.3 보안 미들웨어

```python
# config/security_middleware.py

class ContentSecurityPolicyMiddleware:
    """CSP 헤더 추가 미들웨어"""

    def __init__(self, get_response):
        self.get_response = get_response
        # 환경 변수에서 설정 로드
        self.csp = getattr(settings, 'CONTENT_SECURITY_POLICY', None)
        self.frame_ancestors = getattr(settings, 'CSP_FRAME_ANCESTORS', None)

    def __call__(self, request):
        response = self.get_response(request)

        # CSP 헤더가 없을 때만 추가
        if 'Content-Security-Policy' not in response:
            if self.csp:
                response['Content-Security-Policy'] = self.csp
            elif self.frame_ancestors:
                response['Content-Security-Policy'] = f"frame-ancestors {self.frame_ancestors}"

        return response


class XFrameOptionsMiddleware:
    """X-Frame-Options 헤더 추가 미들웨어 (레거시 브라우저용)"""

    def __init__(self, get_response):
        self.get_response = get_response
        self.x_frame_options = getattr(settings, 'X_FRAME_OPTIONS_HEADER', None)

    def __call__(self, request):
        response = self.get_response(request)

        if self.x_frame_options and 'X-Frame-Options' not in response:
            response['X-Frame-Options'] = self.x_frame_options

        return response
```

---

## 5. URL 라우팅 커스터마이징

### 5.1 URL 오버라이드 원리

Django는 URL 패턴을 **순서대로** 매칭합니다. 따라서 커스텀 URL을 먼저 등록하면 기본 URL을 오버라이드할 수 있습니다.

```python
# config/urls_simple.py

from django.urls import path, include, re_path

urlpatterns = [
    # 1. 커스텀 API (우선 등록)
    path('api/annotations/', include('custom_api.urls')),      # Annotation 오버라이드
    path('api/', include('custom_api.urls')),                  # Admin API 등
    path('api/projects/', include('custom_api.projects_urls')), # Project 오버라이드

    # 2. 커스텀 로그인 뷰
    path('user/login/', sso_login_required, name='user-login'),

    # 3. 기본 Label Studio URL (후순위)
    re_path(r'^', include('organizations.urls')),
    re_path(r'^', include('projects.urls')),
    re_path(r'^', include('tasks.urls')),
    re_path(r'^', include('annotations.urls')),
    # ... 나머지 기본 앱
]
```

### 5.2 URL 매칭 순서

```
요청: GET /api/annotations/123/

매칭 순서:
1. path('api/annotations/', include('custom_api.urls'))  ✓ 매칭!
   → custom_api의 AnnotationAPI 사용

2. re_path(r'^', include('annotations.urls'))  (도달하지 않음)
   → 기본 AnnotationAPI 스킵됨
```

### 5.3 커스텀 URL 패턴

```python
# custom-api/urls.py

from django.urls import path
from . import export, admin_users, version, annotations

urlpatterns = [
    # Custom Export API
    path('custom/export/', export.CustomExportView.as_view()),

    # Admin User APIs
    path('admin/users/create-superuser', admin_users.CreateSuperuserView.as_view()),
    path('admin/users/<int:pk>/promote-to-superuser', admin_users.PromoteToSuperuserView.as_view()),
    path('admin/users/<int:pk>/demote-from-superuser', admin_users.DemoteFromSuperuserView.as_view()),

    # Version API
    path('version', version.CustomVersionView.as_view()),
]

# custom-api/projects_urls.py

urlpatterns = [
    # Project API 오버라이드 (model_version 검증 우회)
    path('<int:pk>/', CustomProjectAPI.as_view()),
]
```

---

## 6. API 확장

### 6.1 Custom Export API

**목적**: MLOps 파이프라인을 위한 필터링된 데이터 내보내기

```python
# custom-api/export.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from tasks.models import Task
from .export_serializers import TaskExportSerializer

class CustomExportView(APIView):
    """
    커스텀 Export API

    POST /api/custom/export/
    {
        "project_id": 1,
        "search_from": "2025-01-01 00:00:00",
        "search_to": "2025-01-31 23:59:59",
        "search_date_field": "source_created_at",
        "model_version": "bert-v1",
        "confirm_user_id": 8,
        "response_type": "data"
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # 1. 파라미터 추출
        project_id = request.data.get('project_id')
        search_from = request.data.get('search_from')
        search_to = request.data.get('search_to')
        search_date_field = request.data.get('search_date_field', 'source_created_at')
        model_version = request.data.get('model_version')
        confirm_user_id = request.data.get('confirm_user_id')
        response_type = request.data.get('response_type', 'data')

        # 2. 기본 쿼리셋
        queryset = Task.objects.filter(project_id=project_id)

        # 3. 날짜 필터링 (동적 필드)
        if search_from and search_to:
            # SQL Injection 방지: 필드명 검증
            if not self._is_valid_field_name(search_date_field):
                return Response({'error': 'Invalid field name'}, status=400)

            # JSONField 내부 필터링
            queryset = queryset.filter(
                **{f'data__{search_date_field}__gte': search_from},
                **{f'data__{search_date_field}__lte': search_to}
            )

        # 4. 모델 버전 필터링
        if model_version:
            queryset = queryset.filter(
                predictions__model_version=model_version
            ).distinct()

        # 5. 승인자 필터링
        if confirm_user_id:
            queryset = queryset.filter(
                annotations__completed_by_id=confirm_user_id
            ).distinct()

        # 6. 응답
        if response_type == 'count':
            return Response({'count': queryset.count()})

        # N+1 쿼리 최적화
        queryset = queryset.prefetch_related('annotations', 'predictions')

        serializer = TaskExportSerializer(queryset, many=True)
        return Response({'tasks': serializer.data})

    def _is_valid_field_name(self, field_name):
        """SQL Injection 방지를 위한 필드명 검증"""
        import re
        return bool(re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', field_name))
```

### 6.2 Admin User API

```python
# custom-api/admin_users.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from organizations.models import Organization, OrganizationMember

User = get_user_model()

class CreateSuperuserView(APIView):
    """
    슈퍼유저 생성 API

    POST /api/admin/users/create-superuser
    {
        "email": "admin@example.com",
        "password": "secure_password",
        "first_name": "Admin"
    }
    """
    permission_classes = [IsAdminUser]

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        first_name = request.data.get('first_name', '')

        # 중복 확인
        if User.objects.filter(email=email).exists():
            return Response({'error': 'User already exists'}, status=400)

        # 사용자 생성
        user = User.objects.create_superuser(
            email=email,
            username=email,
            password=password,
            first_name=first_name
        )

        # API 토큰 생성
        token, _ = Token.objects.get_or_create(user=user)

        # 조직에 자동 추가
        default_org = Organization.objects.first()
        if default_org:
            OrganizationMember.objects.get_or_create(
                user=user,
                organization=default_org
            )

        return Response({
            'id': user.id,
            'email': user.email,
            'token': token.key
        }, status=201)


class PromoteToSuperuserView(APIView):
    """사용자를 슈퍼유저로 승격"""
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)

        # 자기 자신 확인
        if user == request.user:
            return Response({'error': 'Cannot modify your own status'}, status=400)

        user.is_superuser = True
        user.save()

        return Response({'message': f'{user.email} promoted to superuser'})
```

### 6.3 Project API 오버라이드

```python
# custom-api/projects.py

from projects.api import ProjectAPI as BaseProjectAPI
from projects.serializers import ProjectSerializer as BaseProjectSerializer

class ProjectSerializer(BaseProjectSerializer):
    """model_version 검증 우회"""

    def validate_model_version(self, value):
        # 기본 검증을 우회하고 모든 값 허용
        return value


class CustomProjectAPI(BaseProjectAPI):
    """커스텀 Project API"""
    serializer_class = ProjectSerializer
```

---

## 7. 권한 시스템 확장

### 7.1 커스텀 Permission 클래스

```python
# custom-permissions/permissions.py

from rest_framework.permissions import BasePermission, SAFE_METHODS

class IsAnnotationOwnerOrReadOnly(BasePermission):
    """
    어노테이션 소유자 또는 관리자만 수정/삭제 가능

    - GET, HEAD, OPTIONS: 모든 인증된 사용자
    - POST: 모든 인증된 사용자 (새 어노테이션 생성)
    - PUT, PATCH, DELETE: 소유자 또는 슈퍼유저만
    """

    def has_permission(self, request, view):
        # 인증된 사용자만 허용
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        # 읽기 요청은 허용
        if request.method in SAFE_METHODS:
            return True

        # 슈퍼유저는 모든 권한
        if request.user.is_superuser:
            return True

        # 소유자 확인
        return obj.completed_by == request.user
```

### 7.2 Permission Mixin

```python
# custom-permissions/mixins.py

from .permissions import IsAnnotationOwnerOrReadOnly

class AnnotationOwnershipMixin:
    """
    View에 어노테이션 소유권 검사를 추가하는 Mixin

    사용법:
        class AnnotationAPI(AnnotationOwnershipMixin, BaseAnnotationAPI):
            pass
    """

    def get_permissions(self):
        # 기존 권한에 소유권 검사 추가
        permissions = super().get_permissions()
        permissions.append(IsAnnotationOwnerOrReadOnly())
        return permissions
```

### 7.3 적용 예시

```python
# custom-api/annotations.py

from annotations.api import AnnotationAPI as BaseAnnotationAPI
from custom_permissions.mixins import AnnotationOwnershipMixin

class AnnotationAPI(AnnotationOwnershipMixin, BaseAnnotationAPI):
    """
    소유권 검사가 적용된 Annotation API

    - 본인이 작성한 어노테이션만 수정/삭제 가능
    - 관리자는 모든 어노테이션 수정/삭제 가능
    """
    pass
```

---

## 8. 프론트엔드 커스터마이징

### 8.1 React SPA 커스터마이징의 핵심 과제

Label Studio의 프론트엔드는 **React SPA (Single Page Application)**입니다. 이로 인해 다음과 같은 과제가 있습니다:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    React SPA 커스터마이징 과제                               │
└─────────────────────────────────────────────────────────────────────────────┘

  문제점:
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  1. DOM 변경이 React에 의해 덮어씌워짐                                    │
  │     - CSS 클래스 추가 → React 재렌더링 → 클래스 사라짐                     │
  │                                                                         │
  │  2. SPA 네비게이션 시 페이지 리로드 없음                                   │
  │     - 페이지 이동해도 DOMContentLoaded 이벤트 발생 안 함                   │
  │                                                                         │
  │  3. 비동기 컴포넌트 로딩                                                  │
  │     - DOM 요소가 나중에 렌더링됨                                          │
  │     - 타이밍 문제 발생                                                    │
  │                                                                         │
  │  4. MobX 상태 관리                                                       │
  │     - DOM 직접 조작만으로는 상태 변경 불가                                 │
  │     - 내부 스토어와 동기화 필요                                           │
  └─────────────────────────────────────────────────────────────────────────┘

  해결 전략:
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  1. MutationObserver: DOM 변경 감지 및 재적용                             │
  │  2. history API 후킹: SPA 네비게이션 감지                                 │
  │  3. 주기적 체크: 타이밍 문제 해결을 위한 폴백                              │
  │  4. CSS 변수 강제 적용: React 재렌더링에도 유지                            │
  │  5. View API 호출: MobX 상태와 서버 동기화                                │
  └─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Template 구조 이해

Label Studio의 `base.html`은 완전히 새로 작성해야 합니다 (상속이 아님):

```
custom-templates/base.html 구조:
┌─────────────────────────────────────────────────────────────────────────────┐
│  {% load static %}                                                         │
│  {% load i18n %}                                                           │
│  <!doctype html>                                                           │
│  <html>                                                                    │
│  <head>                                                                    │
│    ├─ CSS 로드 (react-app/main.css)                                        │
│    ├─ 테마 스크립트                                                         │
│    └─ 커스텀 스크립트 삽입 포인트 ← 여기에 커스터마이징 코드                   │
│  </head>                                                                   │
│  <body>                                                                    │
│    ├─ <div class="app-wrapper"></div>  ← React 앱 마운트 포인트              │
│    ├─ <script id="app-settings">       ← APP_SETTINGS 전역 객체             │
│    └─ React 앱 JS 로드 (main.js)                                           │
│  </body>                                                                   │
│  </html>                                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 hideHeader 구현 (실제 코드)

**목적**: iframe 임베딩 시 헤더 숨기기

**핵심 기법**: CSS 변수 강제 오버라이드 + 주기적 재적용

```javascript
// custom-templates/base.html 내 <script> 태그

(function() {
  'use strict';

  // URL 파라미터 확인
  function shouldHideHeader() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('hideHeader') === 'true';
  }

  // CSS 스타일 주입
  function applyHideHeader() {
    if (!shouldHideHeader()) return;

    if (!document.getElementById('hide-header-style')) {
      const style = document.createElement('style');
      style.id = 'hide-header-style';
      style.textContent = `
        /* CSS 변수 강제 오버라이드 - 모든 레벨에서 */
        :root { --header-height: 0px !important; }
        html { --header-height: 0px !important; }
        body { --header-height: 0px !important; }
        * { --header-height: 0px !important; }

        /* Label Studio 헤더 숨기기 */
        .lsf-menu-header {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  // CSS 변수 강제 적용 함수
  function forceHeaderHeightToZero() {
    if (!shouldHideHeader()) return;
    document.documentElement.style.setProperty('--header-height', '0px', 'important');
    if (document.body) {
      document.body.style.setProperty('--header-height', '0px', 'important');
    }
  }

  // 즉시 적용
  applyHideHeader();
  forceHeaderHeightToZero();

  // DOM 로드 시 적용
  document.addEventListener('DOMContentLoaded', () => {
    applyHideHeader();
    forceHeaderHeightToZero();
  });

  // window load 시 적용 (React 앱 로드 후)
  window.addEventListener('load', () => {
    applyHideHeader();
    forceHeaderHeightToZero();
  });

  // ⭐ 핵심: 100ms마다 5초간 강제 적용
  // React가 CSS 변수를 덮어써도 다시 적용됨
  if (shouldHideHeader()) {
    let count = 0;
    const intervalId = setInterval(() => {
      forceHeaderHeightToZero();
      count++;
      if (count >= 50) { // 50 * 100ms = 5초
        clearInterval(intervalId);
      }
    }, 100);
  }

  // MutationObserver로 DOM 변경 감지
  const observer = new MutationObserver(() => {
    if (shouldHideHeader()) {
      applyHideHeader();
      forceHeaderHeightToZero();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
```

### 8.4 Date Filter UI 구현 (실제 코드)

**목적**: Data Manager에 날짜 범위 필터 UI 추가

**핵심 기법**: View API + MobX 상태 동기화 + SPA 네비게이션 핸들링

#### 8.4.1 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Date Filter 동작 흐름                                    │
└─────────────────────────────────────────────────────────────────────────────┘

  사용자가 날짜 선택 후 검색 클릭
         │
         ▼
  ┌──────────────────┐
  │ 필터 아이템 생성  │
  │ (filter object)  │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  1. DataManager 스토어 확인                                               │
  │     window.dataManager.store.currentView                                 │
  └────────┬─────────────────────────────────────────────────────────────────┘
           │
           ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  2. 현재 View 데이터 조회 (기존 컬럼 설정 보존)                             │
  │     GET /api/dm/views/{viewId}/                                          │
  └────────┬─────────────────────────────────────────────────────────────────┘
           │
           ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  3. View 데이터 업데이트 (필터만 변경)                                     │
  │     PATCH /api/dm/views/{viewId}/                                        │
  │     { data: { ...existing, filters: newFilters } }                       │
  └────────┬─────────────────────────────────────────────────────────────────┘
           │
           ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  4. MobX 로컬 상태 동기화                                                 │
  │     currentView.data.filters = updatedFilters                            │
  └────────┬─────────────────────────────────────────────────────────────────┘
           │
           ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  5. 태스크 목록 리로드                                                    │
  │     currentView.reload()                                                 │
  └──────────────────────────────────────────────────────────────────────────┘
```

#### 8.4.2 필터 UI 생성

```javascript
function createDateFilterUI() {
  const container = document.createElement('div');
  container.id = 'custom-date-filter-container';
  container.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-left: 16px;
    padding: 4px 8px;
    background: #f5f5f5;
    border-radius: 4px;
    font-size: 13px;
  `;

  container.innerHTML = `
    <span style="color: #666; font-weight: 500;">source_created_at</span>
    <input type="date" id="date-filter-from" style="padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px;">
    <span style="color: #666;">~</span>
    <input type="date" id="date-filter-to" style="padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px;">
    <button id="date-filter-search" title="검색" style="padding: 6px 10px; background: #4299e1; color: white; border: none; border-radius: 4px; cursor: pointer;">🔍</button>
    <button id="date-filter-clear" title="초기화" style="padding: 6px 10px; background: #e2e8f0; color: #4a5568; border: none; border-radius: 4px; cursor: pointer;">✕</button>
  `;

  return container;
}
```

#### 8.4.3 필터 적용 (View API + MobX 동기화)

```javascript
async function applyDateFilter() {
  const fromValue = document.getElementById('date-filter-from').value;
  const toValue = document.getElementById('date-filter-to').value;

  if (!fromValue && !toValue) {
    alert('검색 기간을 입력해주세요.');
    return;
  }

  // 1. 필터 아이템 생성
  const filterItems = [];
  if (fromValue) {
    filterItems.push({
      filter: 'filter:tasks:data.source_created_at',
      operator: 'greater_or_equal',
      type: 'String',
      value: fromValue + ' 00:00:00'
    });
  }
  if (toValue) {
    filterItems.push({
      filter: 'filter:tasks:data.source_created_at',
      operator: 'less_or_equal',
      type: 'String',
      value: toValue + ' 23:59:59'
    });
  }

  // 2. DataManager 스토어 접근
  if (!window.dataManager?.store?.currentView) {
    console.log('[DateFilter] DataManager not ready, falling back to page reload');
    // 폴백: 페이지 리로드
    const url = new URL(window.location.href);
    url.searchParams.set('query', JSON.stringify({ filters: { conjunction: 'and', items: filterItems } }));
    window.location.href = url.toString();
    return;
  }

  const store = window.dataManager.store;
  const currentView = store.currentView;
  const viewId = currentView.id;

  try {
    // 3. 현재 View 데이터 조회 (기존 설정 보존)
    const getResponse = await fetch(`/api/dm/views/${viewId}/`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!getResponse.ok) throw new Error('Failed to get view');

    const viewData = await getResponse.json();
    const existingData = viewData.data || {};

    // 기존 source_created_at 필터 제거 후 새 필터 추가
    const existingFilters = existingData.filters?.items || [];
    const otherFilters = existingFilters.filter(f =>
      !f.filter?.includes('source_created_at')
    );
    const newFiltersData = [...otherFilters, ...filterItems];

    // 4. View 업데이트 (필터만 변경, 나머지 보존)
    const updatedData = {
      ...existingData,
      filters: {
        conjunction: 'and',
        items: newFiltersData
      }
    };

    const patchResponse = await fetch(`/api/dm/views/${viewId}/`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': document.cookie.match(/csrftoken=([^;]+)/)?.[1] || ''
      },
      body: JSON.stringify({ data: updatedData })
    });

    if (!patchResponse.ok) throw new Error('Failed to update view');

    // 5. MobX 로컬 상태 동기화
    if (currentView.data) {
      currentView.data.filters = updatedData.filters;
    }

    // 6. 태스크 리로드
    if (typeof currentView.reload === 'function') {
      await currentView.reload();
    }

    console.log('[DateFilter] Filters applied successfully');

  } catch (error) {
    console.error('[DateFilter] Error:', error);
    // 폴백: 페이지 리로드
    window.location.reload();
  }
}
```

#### 8.4.4 SPA 네비게이션 핸들링 (핵심!)

React SPA에서는 페이지 이동 시 전통적인 페이지 로드가 발생하지 않습니다. 따라서 다중 전략이 필요합니다:

```javascript
function setupSPANavigationHandler() {
  // 페이지 확인 함수
  function isDataManagerPage() {
    return location.pathname.match(/\/projects\/\d+\/data/);
  }

  // 필터 삽입 필요 여부 확인
  function shouldInsertDateFilter() {
    const containerExists = document.getElementById('custom-date-filter-container');
    const toolbarExists = document.querySelector('.lsf-space-dm');
    return !containerExists && toolbarExists;
  }

  // ========================================
  // 전략 1: history API 후킹
  // ========================================
  // SPA는 history.pushState/replaceState로 URL 변경
  const originalPushState = history.pushState;
  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    setTimeout(() => {
      if (isDataManagerPage() && shouldInsertDateFilter()) {
        console.log('[DateFilter] pushState detected, reinitializing...');
        initDateRangeFilter();
      }
    }, 500); // React 렌더링 대기
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    setTimeout(() => {
      if (isDataManagerPage() && shouldInsertDateFilter()) {
        console.log('[DateFilter] replaceState detected, reinitializing...');
        initDateRangeFilter();
      }
    }, 500);
  };

  // 브라우저 뒤로가기/앞으로가기
  window.addEventListener('popstate', () => {
    setTimeout(() => {
      if (isDataManagerPage() && shouldInsertDateFilter()) {
        initDateRangeFilter();
      }
    }, 500);
  });

  // ========================================
  // 전략 2: MutationObserver
  // ========================================
  // DOM 변경 감지 (React가 툴바를 렌더링할 때)
  let mutationTimeout = null;
  const observer = new MutationObserver((mutations) => {
    if (!isDataManagerPage()) return;

    // Debounce: DOM이 안정화될 때까지 대기
    if (mutationTimeout) clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(() => {
      if (shouldInsertDateFilter()) {
        console.log('[DateFilter] MutationObserver: toolbar found');
        initDateRangeFilter();
      }
    }, 300);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // ========================================
  // 전략 3: 주기적 체크 (폴백)
  // ========================================
  // 위 전략들이 실패할 경우를 대비
  let periodicCheckCount = 0;
  const maxChecks = 15; // 15 * 2초 = 30초

  const checkInterval = setInterval(() => {
    periodicCheckCount++;

    if (isDataManagerPage() && shouldInsertDateFilter()) {
      console.log('[DateFilter] Periodic check: inserting filter');
      initDateRangeFilter();
    }

    if (periodicCheckCount >= maxChecks) {
      clearInterval(checkInterval);
    }
  }, 2000);

  // ========================================
  // 전략 4: visibility change
  // ========================================
  // 탭 전환 시 재확인
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isDataManagerPage()) {
      setTimeout(() => {
        if (shouldInsertDateFilter()) {
          initDateRangeFilter();
        }
      }, 500);
    }
  });
}
```

### 8.5 Import 버튼 숨기기 (실제 코드)

**목적**: 데이터 무결성을 위해 직접 Import 방지

**핵심 기법**: CSS + JavaScript + MutationObserver

```javascript
function hideImportButton() {
  // 1. CSS로 숨기기
  if (!document.getElementById('hide-import-button-style')) {
    const style = document.createElement('style');
    style.id = 'hide-import-button-style';
    style.textContent = `
      /* Import 버튼 숨기기 - 다양한 셀렉터 */
      button[data-testid="import-button"],
      a[href*="/import"],
      button[data-cy="import-button"] {
        display: none !important;
        visibility: hidden !important;
        width: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
      }
    `;
    document.head.appendChild(style);
  }

  // 2. JavaScript로 숨기기 (텍스트 기반)
  function hideImportElements() {
    // 셀렉터 기반
    const selectors = [
      'a[href*="/import"]',
      'button[data-testid="import-button"]'
    ];
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        el.style.display = 'none';
      });
    });

    // 텍스트 기반
    document.querySelectorAll('button, a').forEach(el => {
      if (el.textContent?.trim() === 'Import') {
        el.style.display = 'none';
      }
    });
  }

  // 즉시 적용
  hideImportElements();

  // 3. MutationObserver로 React 렌더링 대응
  const observer = new MutationObserver(() => {
    hideImportElements();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // 4. 주기적 체크 (10초간)
  let count = 0;
  const interval = setInterval(() => {
    hideImportElements();
    count++;
    if (count >= 50) clearInterval(interval); // 50 * 200ms = 10초
  }, 200);
}

// 초기화
document.addEventListener('DOMContentLoaded', hideImportButton);
window.addEventListener('load', hideImportButton);
```

### 8.6 커스터마이징 패턴 요약

| 패턴 | 용도 | 코드 예시 |
|------|------|----------|
| **CSS 변수 강제** | React 재렌더링 대응 | `style.setProperty('--var', 'value', 'important')` |
| **주기적 적용** | 타이밍 문제 해결 | `setInterval(() => apply(), 100)` |
| **MutationObserver** | DOM 변경 감지 | `new MutationObserver(callback)` |
| **history API 후킹** | SPA 네비게이션 감지 | `history.pushState = function() {...}` |
| **View API 호출** | MobX 상태 동기화 | `fetch('/api/dm/views/{id}/', { method: 'PATCH' })` |
| **Debounce** | 과도한 호출 방지 | `setTimeout(() => fn(), 300)` |

### 8.7 디버깅 팁

```javascript
// 콘솔에서 DataManager 상태 확인
console.log(window.dataManager);
console.log(window.dataManager?.store?.currentView);

// 현재 View의 필터 확인
console.log(window.dataManager?.store?.currentView?.data?.filters);

// APP_SETTINGS 확인
console.log(window.APP_SETTINGS);

// View API 직접 호출 테스트
fetch('/api/dm/views/').then(r => r.json()).then(console.log);
```

---

## 9. Webhook 확장

### 9.1 Webhook 페이로드 패치

Label Studio의 기본 Webhook 페이로드에는 사용자 정보가 제한적입니다. `patch_webhooks.py`를 통해 확장합니다.

```python
# scripts/patch_webhooks.py

"""
Webhook 페이로드에 사용자 정보 추가

이 스크립트는 Docker 빌드 시 실행되어
label_studio/webhooks/utils.py를 패치합니다.
"""

import re

TARGET_FILE = '/label-studio/label_studio/webhooks/utils.py'

# 추가할 코드
PATCH_CODE = '''
def get_completed_by_info(annotation):
    """어노테이션 작성자 정보 반환"""
    user = annotation.completed_by
    if user:
        return {
            'id': user.id,
            'email': user.email,
            'username': user.username,
            'is_superuser': user.is_superuser
        }
    return None
'''

# 패치 적용 위치
ANNOTATION_SERIALIZER_PATCH = '''
    # completed_by_info 추가
    if 'completed_by' in result:
        result['completed_by_info'] = get_completed_by_info(annotation)
'''

def apply_patch():
    with open(TARGET_FILE, 'r') as f:
        content = f.read()

    # 헬퍼 함수 추가
    if 'get_completed_by_info' not in content:
        # import 다음에 추가
        import_pos = content.rfind('import')
        import_end = content.find('\n', import_pos) + 1
        content = content[:import_end] + PATCH_CODE + content[import_end:]

    # serialize_annotation 함수 수정
    if 'completed_by_info' not in content:
        # return result 이전에 추가
        return_pos = content.find('return result', content.find('def serialize_annotation'))
        content = content[:return_pos] + ANNOTATION_SERIALIZER_PATCH + '\n    ' + content[return_pos:]

    with open(TARGET_FILE, 'w') as f:
        f.write(content)

    print(f'Patched {TARGET_FILE}')

if __name__ == '__main__':
    apply_patch()
```

### 9.2 패치 결과

**패치 전** (기본 Label Studio):
```json
{
    "action": "ANNOTATION_CREATED",
    "annotation": {
        "id": 123,
        "result": [...],
        "completed_by": 1
    }
}
```

**패치 후** (커스텀):
```json
{
    "action": "ANNOTATION_CREATED",
    "annotation": {
        "id": 123,
        "result": [...],
        "completed_by": 1,
        "completed_by_info": {
            "id": 1,
            "email": "user@example.com",
            "username": "user1",
            "is_superuser": false
        }
    }
}
```

---

## 10. Docker 이미지 빌드

### 10.1 Dockerfile 구조

```dockerfile
# Dockerfile

# 베이스 이미지
FROM heartexlabs/label-studio:1.20.0

# 작업 디렉토리
WORKDIR /label-studio

# 1. SSO 패키지 설치
COPY label_studio_sso-6.0.8-py3-none-any.whl /tmp/
RUN pip install --no-cache-dir /tmp/label_studio_sso-6.0.8-py3-none-any.whl

# 2. Django 설정 복사
COPY config/label_studio.py /label-studio/label_studio/core/settings/
COPY config/urls_simple.py /label-studio/label_studio/core/

# 3. 보안 미들웨어 복사
COPY config/security_middleware.py /label-studio/label_studio/core/

# 4. 커스텀 앱 복사
COPY custom-permissions /label-studio/label_studio/custom_permissions
COPY custom-api /label-studio/label_studio/custom_api

# 5. 템플릿 복사
COPY custom-templates/base.html /label-studio/label_studio/core/templates/base.html

# 6. Webhook 패치 실행
COPY scripts/patch_webhooks.py /tmp/
RUN python3 /tmp/patch_webhooks.py

# 7. Static 파일 수집 (sw.js 등)
RUN cd /label-studio/label_studio && python3 manage.py collectstatic --noinput

# 8. 권한 설정
RUN chown -R 1001:0 /label-studio

# 9. 포트 노출
EXPOSE 8080

# 10. 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# 11. 시작 명령
CMD ["label-studio"]
```

### 10.2 빌드 및 테스트

```bash
# 로컬 빌드
docker build -t label-studio-custom:local .

# 테스트 환경 실행
docker compose -f docker-compose.test.yml up -d

# 테스트 실행
make test-quick

# 이미지 푸시 (CI/CD에서 자동 실행)
docker tag label-studio-custom:local ghcr.io/aidoop/label-studio-custom:1.20.0-sso.44
docker push ghcr.io/aidoop/label-studio-custom:1.20.0-sso.44
```

### 10.3 빌드 순서 요약

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Docker 빌드 순서                                     │
└─────────────────────────────────────────────────────────────────────────────┘

  1. 베이스 이미지 로드 (heartexlabs/label-studio:1.20.0)
        │
        ▼
  2. SSO 패키지 설치 (pip install)
        │
        ▼
  3. Django 설정 복사 (config/)
        │
        ▼
  4. 커스텀 앱 복사 (custom-api/, custom-permissions/)
        │
        ▼
  5. 템플릿 복사 (custom-templates/)
        │
        ▼
  6. Webhook 패치 실행 (scripts/patch_webhooks.py)
        │
        ▼
  7. Static 파일 수집 (collectstatic)
        │
        ▼
  8. 이미지 완성 (label-studio-custom:x.x.x-sso.xx)
```

---

## 다음 단계

커스터마이징 방법론을 이해했다면:

1. [SSO 구현 방법](./03-sso-implementation.md)에서 인증 통합 방법을 확인하세요.
2. [개발 가이드](./05-development-guide.md)에서 실제 개발 환경을 구성해보세요.
