# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- `sessionid` 및 `csrftoken` 쿠키 삭제
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
