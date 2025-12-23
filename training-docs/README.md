# Label Studio SSO 교육 자료

이 폴더에는 Label Studio SSO 프로젝트에 대한 종합 교육 자료가 포함되어 있습니다.

## 문서 목록

| 문서                                                                 | 내용                    | 대상          |
| -------------------------------------------------------------------- | ----------------------- | ------------- |
| [00-overview.md](./00-overview.md)                                   | 프로젝트 개요 및 관계도 | 전체          |
| [01-label-studio-architecture.md](./01-label-studio-architecture.md) | Label Studio 구조       | 백엔드 개발자 |
| [02-customization-methodology.md](./02-customization-methodology.md) | 커스터마이징 방법론     | 백엔드 개발자 |
| [03-sso-implementation.md](./03-sso-implementation.md)               | SSO 구현 방법           | 전체          |
| [04-deployment-guide.md](./04-deployment-guide.md)                   | 배포 가이드             | DevOps        |
| [05-development-guide.md](./05-development-guide.md)                 | 개발 가이드             | 개발자        |

## 학습 경로

### 초급 (1-2일)

1. [00-overview.md](./00-overview.md) - 전체 구조 파악
2. [05-development-guide.md](./05-development-guide.md) - 로컬 환경 설정
3. 샘플 앱 실행 및 테스트

### 중급 (3-5일)

1. [01-label-studio-architecture.md](./01-label-studio-architecture.md) - 아키텍처 이해
2. [02-customization-methodology.md](./02-customization-methodology.md) - 커스터마이징 학습
3. [03-sso-implementation.md](./03-sso-implementation.md) - SSO 구현 이해

### 고급 (1주+)

1. 커스텀 API 개발 실습
2. 새로운 기능 추가
3. [04-deployment-guide.md](./04-deployment-guide.md) - 프로덕션 배포

## 프로젝트 개요

```
┌──────────────────────┐
│  label-studio-sso    │  ← Python 패키지 (SSO 미들웨어)
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  label-studio-custom │  ← Docker 이미지 (커스텀 Label Studio)
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  label-studio-sso-app│  ← 샘플 애플리케이션 (Vue 3 + Express.js)
└──────────────────────┘
```

## 빠른 시작

```bash
# 1. 호스트 파일 설정
sudo vi /etc/hosts
# 127.0.0.1 hatiolab.localhost
# 127.0.0.1 label.hatiolab.localhost

# 2. 환경 설정
cp .env.example .env

# 3. 서비스 시작
docker compose up -d

# 4. 초기 설정
make setup
make create-token

# 5. 접속
# http://hatiolab.localhost:3000
```

## 버전 정보

| 컴포넌트             | 버전          |
| -------------------- | ------------- |
| Label Studio (Base)  | 1.20.0        |
| label-studio-sso     | 6.0.8         |
| label-studio-custom  | 1.20.0-sso.44 |
| label-studio-sso-app | 1.0.10        |

---

문서 최종 업데이트: 2025년 12월
