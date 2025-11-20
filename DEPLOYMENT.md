# Label Studio SSO Sample App - 배포 가이드

## 목차

- [Docker 이미지 빌드](#docker-이미지-빌드)
- [GitHub Container Registry 배포](#github-container-registry-배포)
- [Kubernetes (AWS EKS) 배포](#kubernetes-aws-eks-배포)
- [환경 변수 설정](#환경-변수-설정)

---

## Docker 이미지 빌드

### 로컬 빌드

```bash
cd /path/to/label-studio-sso-app

# 테스트용 이미지 빌드
docker build -t label-studio-sso-app:test .

# 특정 버전으로 빌드
docker build -t label-studio-sso-app:1.0.0 .

# 빌드 확인
docker images | grep label-studio-sso-app
```

### 멀티스테이지 빌드 구조

```
Stage 1: Frontend Build (Vue 3 + Vite)
  ├─ npm ci
  ├─ npm run build
  └─ dist/ 생성

Stage 2: Production (Backend + Frontend)
  ├─ Backend 의존성 설치 (npm ci --only=production)
  ├─ Backend 소스 복사
  └─ Frontend dist → public/ 복사
```

**최종 이미지 크기**: ~129MB (alpine 기반)

---

## Docker Compose로 실행

배포된 이미지를 사용하여 전체 스택을 실행할 수 있습니다.

### 프로덕션 환경 (기본)

```bash
# 배포된 이미지로 전체 스택 실행
docker compose up -d

# 로그 확인
docker compose logs -f

# 특정 서비스만 로그 확인
docker compose logs -f sso-app

# 중지 및 제거
docker compose down

# 볼륨까지 제거 (주의: 데이터 삭제됨)
docker compose down -v
```

### 개발 환경

로컬 코드를 수정하면서 개발:

```bash
# 개발 모드 실행 (코드 변경 시 자동 반영)
docker compose -f docker-compose.dev.yml up -d

# 로그 확인
docker compose -f docker-compose.dev.yml logs -f

# 중지
docker compose -f docker-compose.dev.yml down
```

### 포함된 서비스

| 서비스       | 이미지                                             | 포트 |
| ------------ | -------------------------------------------------- | ---- |
| PostgreSQL   | `postgres:13.18`                                   | 5432 |
| Label Studio | `ghcr.io/aidoop/label-studio-custom:1.20.0-sso.38` | 8080 |
| SSO App      | `ghcr.io/aidoop/label-studio-sso-app:1.0.0`        | 3000 |

### 환경변수 설정

`.env` 파일에 다음 환경변수를 설정하세요:

**로컬 개발 환경** (hatiolab.localhost):

```bash
# PostgreSQL
POSTGRES_DB=labelstudio
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-password

# Label Studio
LABEL_STUDIO_HOST=http://label.hatiolab.localhost:8080
DEBUG=false
LOG_LEVEL=INFO

# Label Studio 쿠키 설정 (서브도메인 간 공유)
SESSION_COOKIE_DOMAIN=.hatiolab.localhost
CSRF_COOKIE_DOMAIN=.hatiolab.localhost
SESSION_COOKIE_SECURE=0
CSRF_COOKIE_SECURE=0

# SSO App - 도메인 설정
FRONTEND_URL=http://hatiolab.localhost:3000
COOKIE_DOMAIN=.hatiolab.localhost
CORS_ORIGIN=http://hatiolab.localhost:3000

# SSO App - API
LABEL_STUDIO_API_TOKEN=your-api-token-here

# Frontend
VITE_LABEL_STUDIO_URL=http://label.hatiolab.localhost:8080
```

**프로덕션 환경** (예: hatiolab.com):

```bash
# PostgreSQL
POSTGRES_DB=labelstudio_prod
POSTGRES_USER=labelstudio
POSTGRES_PASSWORD=<strong-password>

# Label Studio
LABEL_STUDIO_HOST=https://label.hatiolab.com
DEBUG=false
LOG_LEVEL=WARNING

# Label Studio 쿠키 설정 (HTTPS 필수)
SESSION_COOKIE_DOMAIN=.hatiolab.com
CSRF_COOKIE_DOMAIN=.hatiolab.com
SESSION_COOKIE_SECURE=1
CSRF_COOKIE_SECURE=1

# SSO App - 도메인 설정
FRONTEND_URL=https://app.hatiolab.com
COOKIE_DOMAIN=.hatiolab.com
CORS_ORIGIN=https://app.hatiolab.com

# SSO App - API
LABEL_STUDIO_API_TOKEN=<production-api-token>

# Frontend
VITE_LABEL_STUDIO_URL=https://label.hatiolab.com
```

> **중요**: v1.0.3+ 부터 모든 도메인 관련 하드코딩이 제거되었습니다. 환경변수를 통해 유연하게 도메인을 설정할 수 있습니다.

---

## GitHub Container Registry 배포

### 1. GitHub Token 생성

```bash
# Personal Access Token 생성 (권한: write:packages)
# https://github.com/settings/tokens
```

### 2. 레지스트리 로그인

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

### 3. 이미지 태그 및 Push

```bash
# 이미지 태그
docker tag label-studio-sso-app:test ghcr.io/aidoop/label-studio-sso-app:1.0.0
docker tag label-studio-sso-app:test ghcr.io/aidoop/label-studio-sso-app:latest

# Push
docker push ghcr.io/aidoop/label-studio-sso-app:1.0.0
docker push ghcr.io/aidoop/label-studio-sso-app:latest
```

### 4. 자동 배포 (GitHub Actions)

```bash
# Git 태그 푸시로 자동 빌드 및 배포
git tag v1.0.0
git push origin v1.0.0

# GitHub Actions이 자동으로:
# 1. Docker 이미지 빌드 (multi-platform)
# 2. GHCR에 푸시
# 3. GitHub Release 생성
```

---

## Kubernetes (AWS EKS) 배포

### 사전 요구사항

- AWS EKS 클러스터 (1.28+)
- kubectl 설치 및 구성
- AWS Load Balancer Controller 설치
- ACM 인증서 발급 (HTTPS용)
- Route53 호스팅 영역

### 1. Namespace 생성

```bash
kubectl apply -f k8s/00-namespace.yaml
```

### 2. Secret 설정

```bash
# Label Studio API Token 생성 (Label Studio에서 발급)
# Settings → Account → Access Token

# Base64 인코딩
echo -n "your-api-token-here" | base64

# Secret 파일 편집
vi k8s/01-secret.yaml

# Secret 적용
kubectl apply -f k8s/01-secret.yaml
```

### 3. ConfigMap 설정

```bash
# ConfigMap 편집 (Label Studio URL 등)
vi k8s/02-configmap.yaml

# 주요 설정:
# - LABEL_STUDIO_URL: Label Studio 서비스 URL
# - CORS_ORIGIN: CORS 허용 도메인

# ConfigMap 적용
kubectl apply -f k8s/02-configmap.yaml
```

### 4. Deployment 배포

```bash
# Deployment 파일 편집 (이미지 태그 확인)
vi k8s/03-deployment.yaml

# image: ghcr.io/aidoop/label-studio-sso-app:1.0.0 로 변경

# 배포
kubectl apply -f k8s/03-deployment.yaml

# 배포 확인
kubectl get pods -n label-studio-sso-app
kubectl logs -f deployment/label-studio-sso-app -n label-studio-sso-app
```

### 5. Service 생성

```bash
kubectl apply -f k8s/04-service.yaml

# Service 확인
kubectl get svc -n label-studio-sso-app
```

### 6. Ingress 설정 (ALB)

```bash
# Ingress 파일 편집
vi k8s/05-ingress-alb.yaml

# 필수 수정사항:
# 1. ACM Certificate ARN 입력
# 2. host: label-app.hatiolab.com (이미 설정됨)

# Ingress 적용
kubectl apply -f k8s/05-ingress-alb.yaml

# ALB 생성 확인 (몇 분 소요)
kubectl get ingress -n label-studio-sso-app
kubectl describe ingress label-studio-sso-app -n label-studio-sso-app
```

### 7. DNS 설정

```bash
# ALB 주소 확인
ALB_ADDRESS=$(kubectl get ingress label-studio-sso-app -n label-studio-sso-app -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo $ALB_ADDRESS

# Route53에 CNAME 레코드 추가:
# Name: label-app.hatiolab.com
# Type: CNAME
# Value: $ALB_ADDRESS
```

### 8. 배포 확인

```bash
# Health check
curl https://label-app.hatiolab.com/api/health

# 응답 예시:
# {
#   "status": "ok",
#   "timestamp": "2025-11-09T00:00:00.000Z",
#   "labelStudioUrl": "http://labelstudio-service.label-studio.svc.cluster.local:8080"
# }

# Frontend 접속
open https://label-app.hatiolab.com
```

---

## 환경 변수 설정

### 필수 환경 변수

| 변수                     | 설명             | 예시                      | 기본값                      |
| ------------------------ | ---------------- | ------------------------- | --------------------------- |
| `NODE_ENV`               | 실행 환경        | `production`              | `development`               |
| `PORT`                   | 서버 포트        | `3000`                    | `3000` (prod), `3001` (dev) |
| `LABEL_STUDIO_URL`       | Label Studio URL | `http://labelstudio:8080` | -                           |
| `LABEL_STUDIO_API_TOKEN` | API Token        | `abcd1234...`             | -                           |

### 선택적 환경 변수

| 변수          | 설명             | 예시                       | 기본값                           |
| ------------- | ---------------- | -------------------------- | -------------------------------- |
| `CORS_ORIGIN` | CORS 허용 도메인 | `https://app.hatiolab.com` | `http://hatiolab.localhost:3000` |

### Kubernetes 환경 변수 설정

```yaml
# ConfigMap (공개 가능한 설정)
apiVersion: v1
kind: ConfigMap
metadata:
  name: label-studio-sso-app-config
data:
  NODE_ENV: "production"
  PORT: "3000"
  CORS_ORIGIN: "*"
  LABEL_STUDIO_URL: "http://labelstudio-service.label-studio.svc.cluster.local:8080"

---
# Secret (민감한 정보)
apiVersion: v1
kind: Secret
metadata:
  name: label-studio-sso-app-secret
type: Opaque
data:
  label-studio-api-token: <base64-encoded-token>
```

---

## 업데이트 및 롤백

### 이미지 업데이트

```bash
# 새 버전 배포
kubectl set image deployment/label-studio-sso-app \
  app=ghcr.io/aidoop/label-studio-sso-app:1.1.0 \
  -n label-studio-sso-app

# 롤아웃 상태 확인
kubectl rollout status deployment/label-studio-sso-app -n label-studio-sso-app
```

### 롤백

```bash
# 이전 버전으로 롤백
kubectl rollout undo deployment/label-studio-sso-app -n label-studio-sso-app

# 특정 리비전으로 롤백
kubectl rollout history deployment/label-studio-sso-app -n label-studio-sso-app
kubectl rollout undo deployment/label-studio-sso-app --to-revision=2 -n label-studio-sso-app
```

---

## 트러블슈팅

### Pod가 시작되지 않음

```bash
# Pod 상태 확인
kubectl get pods -n label-studio-sso-app
kubectl describe pod <pod-name> -n label-studio-sso-app

# 로그 확인
kubectl logs <pod-name> -n label-studio-sso-app
```

### Health check 실패

```bash
# Pod 내부에서 health check 테스트
kubectl exec -it <pod-name> -n label-studio-sso-app -- sh
wget -qO- http://localhost:3000/api/health
```

### Label Studio 연결 실패

```bash
# ConfigMap 확인
kubectl get configmap label-studio-sso-app-config -n label-studio-sso-app -o yaml

# LABEL_STUDIO_URL이 올바른지 확인
# Kubernetes 내부: http://labelstudio-service.label-studio.svc.cluster.local:8080
# 외부: https://label.yourdomain.com
```

---

## 모니터링

### 로그 확인

```bash
# 실시간 로그
kubectl logs -f deployment/label-studio-sso-app -n label-studio-sso-app

# 최근 100줄
kubectl logs --tail=100 deployment/label-studio-sso-app -n label-studio-sso-app

# 특정 Pod의 로그
kubectl logs <pod-name> -n label-studio-sso-app
```

### 리소스 사용량

```bash
# Pod 리소스 사용량
kubectl top pods -n label-studio-sso-app

# Node 리소스 사용량
kubectl top nodes
```

---

## 보안 고려사항

### 1. Secret 관리

- ⚠️ Secret 파일을 Git에 커밋하지 마세요
- AWS Secrets Manager 또는 External Secrets Operator 사용 권장

### 2. Network Policy

```yaml
# 예시: Label Studio Service만 접근 허용
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: label-studio-sso-app-netpol
  namespace: label-studio-sso-app
spec:
  podSelector:
    matchLabels:
      app: label-studio-sso-app
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: label-studio
      ports:
        - protocol: TCP
          port: 3000
```

### 3. HTTPS Only

- ALB에서 HTTP → HTTPS 리다이렉트 강제
- `alb.ingress.kubernetes.io/ssl-redirect: '443'`

---

## 참고 자료

- [Label Studio Custom Docs](https://github.com/aidoop/label-studio-custom)
- [AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
