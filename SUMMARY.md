# Label Studio SSO Sample App - 프로덕션 배포 준비 완료

## 🎉 완료된 작업

### 1. Docker 이미지 프로덕션 준비
- ✅ 멀티스테이지 Dockerfile 작성
  - Stage 1: Frontend 빌드 (Vue 3 + Vite)
  - Stage 2: Backend + Frontend 통합 (Express 정적 파일 서빙)
- ✅ 이미지 크기 최적화: **129MB** (alpine 기반)
- ✅ .dockerignore 작성

### 2. Backend 프로덕션 지원
- ✅ 환경 변수 기반 설정 (NODE_ENV, PORT, CORS_ORIGIN)
- ✅ 정적 파일 서빙 (express.static)
- ✅ SPA fallback (모든 라우트 → index.html)
- ✅ Health check endpoint (/api/health)

### 3. Kubernetes 매니페스트
- ✅ Namespace (label-studio-sso-app)
- ✅ Secret (API Token)
- ✅ ConfigMap (환경 변수)
- ✅ Deployment (replicas: 2, health checks)
- ✅ Service (ClusterIP)
- ✅ Ingress (AWS ALB)

### 4. CI/CD 파이프라인
- ✅ GitHub Actions workflow
  - 버전 태그 푸시 시 자동 빌드
  - Multi-platform (amd64, arm64)
  - GHCR 자동 푸시
  - GitHub Release 생성

### 5. 문서화
- ✅ DEPLOYMENT.md (상세 배포 가이드)
- ✅ README.md 업데이트
- ✅ Kubernetes 배포 가이드

## 📦 배포 가능한 아티팩트

### Docker 이미지
\`\`\`bash
# 로컬 테스트
docker run -p 3000:3000 \\
  -e NODE_ENV=production \\
  -e LABEL_STUDIO_URL=http://labelstudio:8080 \\
  -e LABEL_STUDIO_API_TOKEN=your-token \\
  label-studio-sso-app:test
\`\`\`

### GitHub Container Registry
\`\`\`bash
# Git 태그로 자동 배포
git tag v1.0.0
git push origin v1.0.0

# 이미지 Pull
docker pull ghcr.io/aidoop/label-studio-sso-app:1.0.0
\`\`\`

### Kubernetes 배포
\`\`\`bash
# 전체 배포
kubectl apply -f k8s/

# 또는 순서대로
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-secret.yaml
kubectl apply -f k8s/02-configmap.yaml
kubectl apply -f k8s/03-deployment.yaml
kubectl apply -f k8s/04-service.yaml
kubectl apply -f k8s/05-ingress-alb.yaml
\`\`\`

## 🔧 설정 변경 필요

### 1. Kubernetes Secret (k8s/01-secret.yaml)
\`\`\`bash
# Label Studio API Token을 base64로 인코딩
echo -n "your-api-token" | base64

# Secret 파일 편집
label-studio-api-token: <base64-encoded-value>
\`\`\`

### 2. ConfigMap (k8s/02-configmap.yaml)
\`\`\`yaml
# Label Studio URL 설정
LABEL_STUDIO_URL: "http://labelstudio-service.label-studio.svc.cluster.local:8080"

# 또는 외부 URL
# LABEL_STUDIO_URL: "https://label.yourdomain.com"
\`\`\`

### 3. Deployment (k8s/03-deployment.yaml)
\`\`\`yaml
# 이미지 경로 변경
image: ghcr.io/aidoop/label-studio-sso-app:1.0.0
\`\`\`

### 4. Ingress (k8s/05-ingress-alb.yaml)
\`\`\`yaml
# ACM Certificate ARN
alb.ingress.kubernetes.io/certificate-arn: "arn:aws:acm:..."

# 도메인 이름
host: label-app.hatiolab.com
\`\`\`

## 📊 시스템 아키텍처

\`\`\`
┌─────────────────┐
│  Internet       │
└────────┬────────┘
         │
    ┌────▼────────────────────┐
    │  AWS ALB (HTTPS)        │
    │  label-app.hatiolab.com │
    └────┬────────────────────┘
         │
┌────────▼────────────────────────┐
│  Kubernetes Service (ClusterIP) │
└────────┬────────────────────────┘
         │
    ┌────▼────────────────┐
    │  Pod (replicas: 2)  │
    │  ┌────────────────┐ │
    │  │ Frontend (Vue) │ │  Port 3000
    │  │ Backend (Express)│ │
    │  └────────────────┘ │
    └────────┬────────────┘
             │
             │ Internal Service Call
             │
    ┌────────▼────────────────────────┐
    │  Label Studio Service           │
    │  labelstudio-service.label-     │
    │  studio.svc.cluster.local:8080  │
    └─────────────────────────────────┘
\`\`\`

## 🚀 다음 단계

1. **GitHub Repository 설정**
   \`\`\`bash
   # 변경사항 커밋
   git add .
   git commit -m "Add production deployment support"
   git push origin main
   \`\`\`

2. **첫 번째 릴리스**
   \`\`\`bash
   git tag v1.0.0
   git push origin v1.0.0
   # → GitHub Actions 자동 실행
   \`\`\`

3. **Kubernetes 배포**
   \`\`\`bash
   # Secret 설정
   kubectl apply -f k8s/01-secret-actual.yaml

   # 전체 배포
   kubectl apply -f k8s/
   \`\`\`

4. **DNS 설정**
   - ALB 주소 확인
   - Route53에 CNAME 레코드 추가

5. **배포 확인**
   \`\`\`bash
   curl https://label-app.hatiolab.com/api/health
   \`\`\`

## 📝 변경된 파일

### 신규 파일
- \`Dockerfile\` - 멀티스테이지 프로덕션 빌드
- \`.dockerignore\` - Docker 빌드 최적화
- \`.github/workflows/build-and-publish.yml\` - CI/CD
- \`DEPLOYMENT.md\` - 배포 가이드
- \`k8s/00-namespace.yaml\`
- \`k8s/01-secret.yaml\`
- \`k8s/02-configmap.yaml\`
- \`k8s/03-deployment.yaml\`
- \`k8s/04-service.yaml\`
- \`k8s/05-ingress-alb.yaml\`

### 수정된 파일
- \`backend/server.js\` - 프로덕션 지원 (환경변수, 정적 파일 서빙, SPA fallback)
- \`docker-compose.yml\` - 최신 이미지 레지스트리 (ghcr.io)
- \`.env.example\` - 보안 헤더 설정 추가
- \`README.md\` - 최신 기능 및 버전 정보
- \`.gitignore\` - Kubernetes secret 파일 제외

## 🎯 프로덕션 체크리스트

- [ ] Docker 이미지 빌드 테스트
- [ ] GitHub Container Registry에 푸시
- [ ] Kubernetes Secret 설정
- [ ] ConfigMap 환경변수 확인
- [ ] Ingress ACM Certificate 설정
- [ ] Deployment 이미지 경로 변경
- [ ] DNS 레코드 추가
- [ ] Health check 확인
- [ ] 실제 SSO 토큰 발급 테스트
- [ ] Label Studio 연동 테스트
