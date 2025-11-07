# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.2] - 2025-11-07

### Changed

#### Label Studio Custom Image 버전 업데이트
- **Label Studio Custom Image**: v1.20.0-sso.24 → **v1.20.0-sso.25**
- **주요 변경 사항**:
  - Custom SSO Token API의 JSON 응답 오류 수정
  - `DEBUG=False` 환경에서 사용자 미존재 시 HTML 404 대신 JSON 422 반환
  - HTTP 상태 코드: 404 NOT_FOUND → 422 UNPROCESSABLE_ENTITY
- **참조**: [label-studio-custom v1.20.0-sso.25 CHANGELOG](https://github.com/aidoop/label-studio-custom/blob/main/CHANGELOG.md#1200-sso25---2025-11-07)

## [1.2.1] - 2025-11-07

### Changed

#### Label Studio Custom Image 버전 업데이트
- **Label Studio Custom Image**: v1.20.0-sso.23 → **v1.20.0-sso.24**
- **주요 변경 사항**:
  - `SSO_AUTO_CREATE_USERS` 환경변수 제거 (False로 고정)
  - Custom SSO Token Validation API 사용으로 자동 생성 불필요
  - 사전 등록된 사용자만 접근 가능 (폐쇄형 시스템)
- **docker-compose.yml**: `SSO_AUTO_CREATE_USERS` 환경변수 제거
- **참조**: [label-studio-custom v1.20.0-sso.24 CHANGELOG](https://github.com/aidoop/label-studio-custom/blob/main/CHANGELOG.md#1200-sso24---2025-11-07)

## [1.2.0] - 2025-11-07

### Changed

#### Label Studio Custom Image 버전 업데이트
- **Label Studio Custom Image**: v1.20.0-sso.22 → **v1.20.0-sso.23**
- **주요 변경 사항**:
  - Custom SSO Token Validation API 추가 (사전 사용자 검증)
  - SSO 전용 로그인 페이지 구현 (iframe 통합 지원)
  - `custom-api/sso.py`: JWT 발급 전 사용자 존재 여부 검증
  - `custom-templates/sso_login.html`: iframe에서 invalid token 시 표시되는 페이지
- **참조**: [label-studio-custom v1.20.0-sso.23 CHANGELOG](https://github.com/aidoop/label-studio-custom/blob/main/CHANGELOG.md#1200-sso23---2025-11-07)

#### Backend API 개선
- **Custom SSO Token Validation API 사용**:
  - 기존 `/api/sso/token` → `/api/custom/sso/token`으로 변경
  - 사용자 존재 여부를 먼저 검증한 후 JWT 토큰 발급
  - 명확한 에러 코드 반환: `USER_NOT_FOUND`, `USER_INACTIVE`, `INVALID_REQUEST`
- **테스트 엔드포인트 추가**:
  - `GET /api/sso/invalid-token`: 일부러 잘못된 JWT 토큰 설정
  - iframe 환경에서 SSO 오류 페이지 테스트 용도

#### Frontend 테스트 기능 추가
- **새로운 테스트 버튼**:
  - 🔴 "Login as Non-existent User": Custom SSO Token API 에러 테스트
    - Label Studio에 존재하지 않는 사용자로 토큰 발급 시도
    - `USER_NOT_FOUND` 에러 응답 확인
  - 🟠 "Test Invalid Token + iframe": iframe SSO 오류 페이지 테스트
    - 유효한 토큰으로 프로젝트 리스트 가져오기
    - Invalid JWT 토큰으로 교체
    - iframe에서 SSO 전용 로그인 페이지 표시 확인

#### Docker Compose 설정 개선
- **환경변수 주석 정리**:
  - `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` 관련 주석 명확화
  - 허용 값: `1/true/yes/on` (True), `0/false/no/off` (False)
  - 커스텀 설정 파일에서 `get_bool_env`로 처리되므로 docker-compose.yml에서 제거

### Added

#### 테스트 사용자 지원
- `nonexistent@nubison.io`: Label Studio에 존재하지 않는 테스트 사용자
- Backend 허용 사용자 목록에 추가

### Technical Details

#### Backend Changes (`server.js`)
```javascript
// Before
const response = await fetch(`${LABEL_STUDIO_URL}/api/sso/token`, {...});

// After
const response = await fetch(`${LABEL_STUDIO_URL}/api/custom/sso/token`, {...});
```

#### Frontend Changes (`App.vue`)
- 3단계 테스트 플로우 구현:
  1. Valid token 발급 (admin@nubison.io)
  2. 프로젝트 리스트 가져오기
  3. Invalid token으로 교체 → iframe 테스트

## [1.1.1] - 2025-10-30

### Changed

#### Label Studio Custom Image 버전 업데이트
- **Label Studio Custom Image**: v1.20.0-sso.17 → v1.20.0-sso.18
- **변경 내용**: PostgreSQL 환경변수명 유연화
  - `POSTGRE_*` 환경변수를 우선적으로 사용
  - 기존 `POSTGRES_*` 환경변수도 폴백으로 지원 (하위 호환성 유지)
- **영향**: docker-compose.yml의 이미지 태그 업데이트
- **참조**: [label-studio-custom v1.20.0-sso.18 CHANGELOG](https://github.com/your-org/label-studio-custom/blob/main/CHANGELOG.md#1200-sso18---2025-10-30)

## [1.1.0] - 2025-10-22

### Changed

#### 프로젝트 구조 재구성
- Label Studio 커스텀 이미지 관련 파일을 별도 저장소([label-studio-custom](https://github.com/your-org/label-studio-custom))로 분리
- 이 프로젝트는 이제 샘플 애플리케이션에만 집중
- docker-compose.yml에서 커스텀 이미지를 외부 이미지로 사용 (`label-studio-custom:local` 또는 `ghcr.io/your-org/label-studio-custom:1.20.0-sso.1`)

#### 제거된 파일 (→ label-studio-custom으로 이동)
- `Dockerfile`
- `config/`
- `custom-permissions/`
- `custom-api/`
- `custom-templates/`
- `scripts/`

#### 문서 업데이트
- README.md: 샘플 애플리케이션 중심으로 재작성
- 커스텀 이미지 빌드 가이드 추가 (로컬 / Registry)

### Added

#### 새 문서
- PROJECT_RESTRUCTURE_PROPOSAL.md: 프로젝트 재구성 제안서

### Migration Guide

#### From v1.0.0 to v1.1.0

**1. label-studio-custom 이미지 빌드**

```bash
# label-studio-custom 저장소 클론
cd /Users/super/Documents/GitHub
git clone https://github.com/your-org/label-studio-custom.git
cd label-studio-custom

# 이미지 빌드
docker build -t label-studio-custom:local .
```

**2. 샘플 앱 재시작**

```bash
cd /Users/super/Documents/GitHub/label-studio-test-app

# 기존 컨테이너 중지 및 제거
docker compose down -v

# 새 구조로 재시작
docker compose up -d
```

## [1.0.0] - 2025-10-22

### Added

#### hideHeader 기능
- iframe 임베딩 시 Label Studio 헤더를 완전히 숨기는 기능 구현
- URL 파라미터 `?hideHeader=true` 지원
- JavaScript로 `--header-height` CSS 변수 강제 0px 설정
- 100ms 간격으로 5초간 CSS 변수 강제 적용 (React SPA 대응)
- 파일: `custom-templates/base.html`

#### Annotation Ownership 제어
- 사용자가 자신의 annotation만 수정/삭제할 수 있도록 제한
- `IsAnnotationOwnerOrReadOnly` permission 클래스 구현
- `AnnotationOwnershipMixin` 구현으로 기존 View 확장
- API 레벨 보안 강화 (Postman, curl 등 직접 API 호출도 차단)
- 파일:
  - `custom-permissions/__init__.py`
  - `custom-permissions/apps.py`
  - `custom-permissions/permissions.py`
  - `custom-permissions/mixins.py`
  - `custom-api/__init__.py`
  - `custom-api/urls.py`
  - `custom-api/annotations.py`

#### SSO 사용자 전환 개선
- Django 세션 쿠키 자동 클리어 기능 추가
- `ls_sessionid` 및 `ls_csrftoken` 쿠키 삭제
- iframe URL에 타임스탬프 추가하여 강제 reload
- 파일:
  - `backend/server.js` (lines 86-107)
  - `frontend/src/components/LabelStudioWrapper.vue` (lines 122-139)

#### Docker Compose 환경
- PostgreSQL 13.18 데이터베이스 통합
- Label Studio 1.20.0 + label-studio-sso v6.0.7
- Express.js 백엔드 (SSO 토큰 관리)
- Vue 3 프론트엔드
- 파일: `docker-compose.yml`

#### 설정 파일
- `config/label_studio.py`: Django settings with SSO integration
- `config/urls_simple.py`: URL routing with custom API override
- `.env.example`: Environment variables template

#### 초기화 스크립트
- `scripts/setup.sh`: 자동 사용자 생성 스크립트
- Makefile 명령어 추가 (setup-hosts, setup, create-token, logs, reset-db)

### Changed

#### 아키텍처
- 서브도메인 변경: `*.localhost` → `*.nubison.localhost`
- Label Studio URL 변경: `labelstudio.localhost:8080` → `label.nubison.localhost:8080`
- 쿠키 도메인 변경: `.localhost` → `.nubison.localhost`

#### Documentation
- README.md 완전 재작성 (Docker Compose 기반)
- 주요 기능 섹션 추가
- 문제 해결 가이드 추가
- 커스터마이징 가이드 추가

### Fixed

#### SSO 인증
- 사용자 전환 시 이전 세션 유지 문제 해결
- JWT 토큰 갱신 로직 개선

#### UI/UX
- hideHeader 기능 안정성 개선
- CSS 변수 강제 적용 메커니즘 추가

### Security

#### API 보안
- Annotation API에 소유권 기반 접근 제어 추가
- 403 Forbidden 응답으로 권한 없는 수정/삭제 차단
- Admin 계정은 모든 annotation 접근 가능

#### 세션 관리
- 사용자 전환 시 이전 세션 쿠키 자동 삭제
- Cross-user session 공유 방지

## Version History

### v1.0.0 (2025-10-22)
- Initial release with Docker Compose
- SSO authentication (Native JWT)
- hideHeader functionality
- Annotation ownership control
- User switching support

### v0.1.0 (Initial Development)
- Basic SSO integration test
- Subdomain approach with `.localhost`
- Direct Label Studio access (no proxy)

## Migration Guide

### From v0.1.0 to v1.0.0

#### Environment Changes
```bash
# Old (.localhost)
nubison.localhost:3000
labelstudio.localhost:8080

# New (*.nubison.localhost)
nubison.localhost:3000
label.nubison.localhost:8080
```

#### Cookie Domain Changes
```javascript
// Old
domain: '.localhost'

// New
domain: '.nubison.localhost'
```

#### Deployment Method
```bash
# Old (3 separate terminals)
terminal 1: label-studio start
terminal 2: cd backend && npm run dev
terminal 3: cd frontend && npm run dev

# New (Docker Compose)
docker compose up -d
```

## Known Issues

### v1.0.0

#### Frontend Read-Only UI
- 프론트엔드에서 다른 사용자의 annotation 수정 버튼이 자동으로 비활성화되지 않음
- 현재는 수정 시도 시 403 에러로 차단됨
- 향후 버전에서 프론트엔드 UI 레벨 비활성화 추가 예정

#### Browser Cache
- hideHeader 기능 변경 시 브라우저 캐시로 인해 즉시 반영되지 않을 수 있음
- 해결: Hard Refresh (Cmd/Ctrl + Shift + R)

## Roadmap

### v1.1.0 (Planned)
- [ ] Frontend read-only UI for non-owner annotations
- [ ] Annotation history and versioning
- [ ] Advanced permission management

### v1.2.0 (Planned)
- [ ] Multi-project support
- [ ] Custom annotation templates
- [ ] Export/Import functionality

### v2.0.0 (Future)
- [ ] Label Studio 1.21+ support
- [ ] Advanced SSO features (SAML, OAuth2)
- [ ] Real-time collaboration

## Support

For questions or issues:
- GitHub Issues: [Report a bug or request a feature]
- Documentation: See README.md and guides

## Contributors

- Claude (AI Assistant) - Implementation and documentation
- heartyoh@hatiolab.com - Project owner and requirements

---

**Note**: This project is based on Label Studio open source project.
- Label Studio: https://github.com/HumanSignal/label-studio
- label-studio-sso: https://pypi.org/project/label-studio-sso/
