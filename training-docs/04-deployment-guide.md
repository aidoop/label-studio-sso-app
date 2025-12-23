# 배포 가이드

## 목차
1. [배포 개요](#1-배포-개요)
2. [Docker Compose 배포](#2-docker-compose-배포)
3. [Kubernetes 배포](#3-kubernetes-배포)
4. [환경 변수 설정](#4-환경-변수-설정)
5. [HTTPS 설정](#5-https-설정)
6. [데이터베이스 관리](#6-데이터베이스-관리)
7. [모니터링 및 로깅](#7-모니터링-및-로깅)
8. [백업 및 복구](#8-백업-및-복구)
9. [CI/CD 파이프라인](#9-cicd-파이프라인)

---

## 1. 배포 개요

### 1.1 배포 옵션

| 옵션 | 용도 | 복잡도 |
|------|------|--------|
| **Docker Compose** | 개발, 소규모 운영 | 낮음 |
| **Kubernetes** | 대규모 프로덕션 | 높음 |

### 1.2 시스템 요구사항

**최소 요구사항**:
- CPU: 2 코어
- RAM: 4GB
- 디스크: 20GB SSD
- Docker 20.10+
- Docker Compose v2+

**권장 요구사항** (프로덕션):
- CPU: 4 코어
- RAM: 8GB
- 디스크: 100GB SSD
- Kubernetes 1.24+

### 1.3 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         프로덕션 아키텍처                                     │
└─────────────────────────────────────────────────────────────────────────────┘

                          ┌─────────────────────────┐
                          │   Load Balancer         │
                          │   (ALB / Nginx)         │
                          │   HTTPS Termination     │
                          └───────────┬─────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
              ▼                       ▼                       ▼
   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
   │   SSO App        │  │   Label Studio   │  │   PostgreSQL     │
   │   (Vue+Express)  │  │   Custom         │  │                  │
   │   Port: 3000     │  │   Port: 8080     │  │   Port: 5432     │
   └──────────────────┘  └──────────────────┘  └──────────────────┘
              │                       │                       │
              └───────────────────────┴───────────────────────┘
                                      │
                          ┌───────────▼───────────┐
                          │   Persistent Storage  │
                          │   (EBS / PVC)         │
                          └───────────────────────┘
```

---

## 2. Docker Compose 배포

### 2.1 프로덕션 docker-compose.yml

```yaml
# docker-compose.yml

version: '3.8'

services:
  # PostgreSQL 데이터베이스
  postgres:
    image: postgres:13.18
    container_name: label-studio-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-labelstudio}
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - labelstudio

  # Label Studio Custom
  labelstudio:
    image: ghcr.io/aidoop/label-studio-custom:${LS_VERSION:-1.20.0-sso.44}
    container_name: label-studio-app
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      # 데이터베이스
      DJANGO_DB: default
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_DB: ${POSTGRES_DB:-labelstudio}
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}

      # Label Studio
      LABEL_STUDIO_HOST: ${LABEL_STUDIO_HOST:-http://localhost:8080}

      # 세션/쿠키
      SESSION_COOKIE_DOMAIN: ${SESSION_COOKIE_DOMAIN}
      CSRF_COOKIE_DOMAIN: ${CSRF_COOKIE_DOMAIN}
      SESSION_COOKIE_SECURE: ${SESSION_COOKIE_SECURE:-1}
      CSRF_COOKIE_SECURE: ${CSRF_COOKIE_SECURE:-1}

      # SSO
      JWT_SSO_COOKIE_NAME: ${JWT_SSO_COOKIE_NAME:-ls_auth_token}
      JWT_SSO_NATIVE_USER_ID_CLAIM: ${JWT_SSO_NATIVE_USER_ID_CLAIM:-user_id}
      SSO_TOKEN_EXPIRY: ${SSO_TOKEN_EXPIRY:-600}

      # 보안
      CSP_FRAME_ANCESTORS: ${CSP_FRAME_ANCESTORS}
      X_FRAME_OPTIONS: ${X_FRAME_OPTIONS}

      # 기타
      DEBUG: ${DEBUG:-false}
      LOG_LEVEL: ${LOG_LEVEL:-WARNING}
    volumes:
      - labelstudio_data:/label-studio/data
    ports:
      - "${LS_PORT:-8080}:8080"
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]
      interval: 30s
      timeout: 10s
      start_period: 40s
      retries: 3
    networks:
      - labelstudio

  # SSO App (Frontend + Backend)
  sso-app:
    image: ghcr.io/aidoop/label-studio-sso-app:${APP_VERSION:-1.0.9}
    container_name: label-studio-sso-app
    restart: unless-stopped
    depends_on:
      labelstudio:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 3000

      # Label Studio 연결
      LABEL_STUDIO_URL: http://labelstudio:8080
      LABEL_STUDIO_API_TOKEN: ${LABEL_STUDIO_API_TOKEN}

      # 쿠키
      COOKIE_DOMAIN: ${COOKIE_DOMAIN}

      # CORS
      CORS_ORIGIN: ${CORS_ORIGIN}

      # Frontend
      VITE_LABEL_STUDIO_URL: ${VITE_LABEL_STUDIO_URL}
    ports:
      - "${APP_PORT:-3000}:3000"
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:3000/api/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - labelstudio

volumes:
  postgres_data:
    driver: local
  labelstudio_data:
    driver: local

networks:
  labelstudio:
    driver: bridge
```

### 2.2 배포 단계

```bash
# 1. 환경 변수 설정
cp .env.example .env
vi .env  # 값 수정

# 2. 서비스 시작
docker compose up -d

# 3. 로그 확인
docker compose logs -f

# 4. 헬스 체크
docker compose ps

# 5. 초기 설정 (사용자 생성)
docker compose exec labelstudio \
    python manage.py createsuperuser

# 6. API 토큰 생성
docker compose exec labelstudio \
    python manage.py drf_create_token admin@example.com
```

### 2.3 서비스 관리

```bash
# 서비스 시작
docker compose up -d

# 서비스 중지
docker compose down

# 서비스 재시작
docker compose restart

# 특정 서비스 재시작
docker compose restart labelstudio

# 로그 확인
docker compose logs -f labelstudio

# 셸 접속
docker compose exec labelstudio bash

# DB 셸 접속
docker compose exec postgres psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-labelstudio}
```

---

## 3. Kubernetes 배포

### 3.1 디렉토리 구조

```
k8s/
├── 00-namespace.yaml      # 네임스페이스
├── 01-secret.yaml         # 시크릿
├── 02-configmap.yaml      # 설정
├── 03-deployment.yaml     # 디플로이먼트
├── 04-service.yaml        # 서비스
└── 05-ingress-alb.yaml    # 인그레스 (AWS ALB)
```

### 3.2 매니페스트 파일

#### Namespace

```yaml
# 00-namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: label-studio-sso-app
  labels:
    app: label-studio-sso-app
    environment: production
```

#### Secret

```yaml
# 01-secret.yaml
#
# ⚠️ IMPORTANT: This is a template file. Do not commit actual secrets!
#
# Usage:
#   1. Copy this file: cp 01-secret.yaml 01-secret-actual.yaml
#   2. Edit 01-secret-actual.yaml with actual base64-encoded values
#   3. Add 01-secret-actual.yaml to .gitignore
#
# Base64 encoding:
#   echo -n "your-secret-value" | base64
#
apiVersion: v1
kind: Secret
metadata:
  name: label-studio-sso-app-secret
  namespace: label-studio-sso-app
type: Opaque
data:
  # Label Studio API Token (base64 encoded)
  # Example: echo -n "abcd1234efgh5678..." | base64
  label-studio-api-token: WU9VUl9BUElfVE9LRU5fSEVSRQ==
```

#### ConfigMap

```yaml
# 02-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: label-studio-sso-app-config
  namespace: label-studio-sso-app
data:
  # Application Settings
  NODE_ENV: "production"
  PORT: "3000"

  # CORS Settings
  CORS_ORIGIN: "*"

  # Label Studio Connection
  # Internal Kubernetes service name (if Label Studio is in the same cluster)
  LABEL_STUDIO_URL: "http://labelstudio-service.label-studio.svc.cluster.local:8080"

  # Or external URL (if Label Studio is external)
  # LABEL_STUDIO_URL: "https://label.yourdomain.com"
```

#### Deployment

```yaml
# 03-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: label-studio-sso-app
  namespace: label-studio-sso-app
  labels:
    app: label-studio-sso-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: label-studio-sso-app
  template:
    metadata:
      labels:
        app: label-studio-sso-app
    spec:
      containers:
      - name: app
        image: ghcr.io/aidoop/label-studio-sso-app:latest
        imagePullPolicy: Always

        ports:
        - name: http
          containerPort: 3000
          protocol: TCP

        env:
        # From ConfigMap
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: label-studio-sso-app-config
              key: NODE_ENV
        - name: PORT
          valueFrom:
            configMapKeyRef:
              name: label-studio-sso-app-config
              key: PORT
        - name: CORS_ORIGIN
          valueFrom:
            configMapKeyRef:
              name: label-studio-sso-app-config
              key: CORS_ORIGIN
        - name: LABEL_STUDIO_URL
          valueFrom:
            configMapKeyRef:
              name: label-studio-sso-app-config
              key: LABEL_STUDIO_URL

        # From Secret
        - name: LABEL_STUDIO_API_TOKEN
          valueFrom:
            secretKeyRef:
              name: label-studio-sso-app-secret
              key: label-studio-api-token

        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"

        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 30
          timeoutSeconds: 5
          successThreshold: 1
          failureThreshold: 3

        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
          timeoutSeconds: 3
          successThreshold: 1
          failureThreshold: 3
```

#### Service

```yaml
# 04-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: label-studio-sso-app
  namespace: label-studio-sso-app
  labels:
    app: label-studio-sso-app
spec:
  type: ClusterIP
  ports:
  - name: http
    port: 80
    targetPort: 3000
    protocol: TCP
  selector:
    app: label-studio-sso-app
```

#### Ingress (AWS ALB)

```yaml
# 05-ingress-alb.yaml
#
# Prerequisites:
#   1. AWS Load Balancer Controller installed in cluster
#   2. ACM certificate created for your domain
#   3. Route53 hosted zone for DNS
#
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: label-studio-sso-app
  namespace: label-studio-sso-app
  annotations:
    # AWS Load Balancer Controller
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip

    # SSL/TLS
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    alb.ingress.kubernetes.io/ssl-redirect: '443'

    # Certificate ARN (replace with your ACM certificate)
    alb.ingress.kubernetes.io/certificate-arn: "YOUR_ACM_CERTIFICATE_ARN"

    # Health check
    alb.ingress.kubernetes.io/healthcheck-path: /api/health
    alb.ingress.kubernetes.io/healthcheck-interval-seconds: '30'
    alb.ingress.kubernetes.io/healthcheck-timeout-seconds: '10'
    alb.ingress.kubernetes.io/healthy-threshold-count: '2'
    alb.ingress.kubernetes.io/unhealthy-threshold-count: '3'

spec:
  rules:
  - host: label-app.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: label-studio-sso-app
            port:
              number: 80
  tls:
  - hosts:
    - label-app.yourdomain.com
```

### 3.3 배포 명령어

```bash
# 1. 네임스페이스 생성
kubectl apply -f k8s/00-namespace.yaml

# 2. 시크릿 생성 (먼저 값 수정)
# ⚠️ 실제 시크릿 파일을 복사하여 수정 후 적용:
# cp k8s/01-secret.yaml k8s/01-secret-actual.yaml
# (base64 인코딩된 실제 값으로 수정)
kubectl apply -f k8s/01-secret-actual.yaml

# 3. ConfigMap 생성
kubectl apply -f k8s/02-configmap.yaml

# 4. 디플로이먼트 생성
kubectl apply -f k8s/03-deployment.yaml

# 5. 서비스 생성
kubectl apply -f k8s/04-service.yaml

# 6. 인그레스 생성 (ACM ARN 수정 필요)
kubectl apply -f k8s/05-ingress-alb.yaml

# 또는 전체 적용
kubectl apply -f k8s/
```

### 3.4 Kubernetes 운영

```bash
# 상태 확인
kubectl get pods -n label-studio-sso-app
kubectl get svc -n label-studio-sso-app
kubectl get ingress -n label-studio-sso-app

# 로그 확인
kubectl logs -f deployment/label-studio-sso-app -n label-studio-sso-app

# 셸 접속
kubectl exec -it deployment/label-studio-sso-app -n label-studio-sso-app -- sh

# 스케일링
kubectl scale deployment/label-studio-sso-app --replicas=3 -n label-studio-sso-app

# 롤아웃 상태
kubectl rollout status deployment/label-studio-sso-app -n label-studio-sso-app

# 롤백
kubectl rollout undo deployment/label-studio-sso-app -n label-studio-sso-app
```

---

## 4. 환경 변수 설정

### 4.1 필수 환경 변수

```bash
# .env 또는 ConfigMap

# ===== 데이터베이스 =====
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=labelstudio
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-password  # 변경 필수!

# ===== Label Studio =====
LABEL_STUDIO_HOST=https://label.example.com

# ===== 세션/쿠키 (중요!) =====
SESSION_COOKIE_DOMAIN=.example.com      # 도메인 앞에 "." 필수
CSRF_COOKIE_DOMAIN=.example.com
SESSION_COOKIE_SECURE=true              # HTTPS 환경 필수
CSRF_COOKIE_SECURE=true

# ===== SSO =====
JWT_SSO_COOKIE_NAME=ls_auth_token
JWT_SSO_NATIVE_USER_ID_CLAIM=user_id
SSO_TOKEN_EXPIRY=600

# ===== API 토큰 =====
LABEL_STUDIO_API_TOKEN=your-api-token   # 배포 후 생성

# ===== CORS =====
CORS_ORIGIN=https://app.example.com

# ===== 보안 헤더 =====
CSP_FRAME_ANCESTORS='self' https://app.example.com
```

### 4.2 환경별 설정 차이

| 설정 | 개발 | 프로덕션 |
|------|------|----------|
| `DEBUG` | `true` | `false` |
| `SESSION_COOKIE_SECURE` | `false` | `true` |
| `CSRF_COOKIE_SECURE` | `false` | `true` |
| `LOG_LEVEL` | `DEBUG` | `WARNING` |
| `SESSION_COOKIE_DOMAIN` | `.hatiolab.localhost` | `.example.com` |

---

## 5. HTTPS 설정

### 5.1 Let's Encrypt + Nginx

```nginx
# /etc/nginx/sites-available/label-studio

# HTTP → HTTPS 리다이렉트
server {
    listen 80;
    server_name label.example.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS 서버
server {
    listen 443 ssl http2;
    server_name label.example.com;

    # SSL 인증서
    ssl_certificate /etc/letsencrypt/live/label.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/label.example.com/privkey.pem;

    # SSL 설정
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers on;

    # 보안 헤더
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options "ALLOW-FROM https://app.example.com";

    # 프록시 설정
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

### 5.2 Let's Encrypt 인증서 발급

```bash
# Certbot 설치
apt-get install certbot python3-certbot-nginx

# 인증서 발급
certbot --nginx -d label.example.com

# 자동 갱신 테스트
certbot renew --dry-run

# Cron 자동 갱신 (이미 설정됨)
# 0 0,12 * * * certbot renew --quiet
```

### 5.3 AWS ACM + ALB

Kubernetes에서 AWS ALB Ingress를 사용하는 경우:

```yaml
# Ingress 어노테이션
annotations:
  alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:ap-northeast-2:123456789:certificate/xxx
  alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
  alb.ingress.kubernetes.io/ssl-redirect: '443'
```

---

## 6. 데이터베이스 관리

### 6.1 마이그레이션

```bash
# Django 마이그레이션 실행
docker compose exec labelstudio python manage.py migrate

# 마이그레이션 상태 확인
docker compose exec labelstudio python manage.py showmigrations
```

### 6.2 백업

```bash
# PostgreSQL 백업 스크립트
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backups/postgres
CONTAINER=label-studio-postgres

# 백업 실행
docker exec $CONTAINER pg_dump -U postgres labelstudio | gzip > $BACKUP_DIR/labelstudio_$DATE.sql.gz

# 7일 이상 된 백업 삭제
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: labelstudio_$DATE.sql.gz"
```

### 6.3 복구

```bash
# PostgreSQL 복구
gunzip -c /backups/postgres/labelstudio_20250101_120000.sql.gz | \
    docker exec -i label-studio-postgres psql -U postgres -d labelstudio
```

### 6.4 성능 튜닝

```sql
-- PostgreSQL 설정 (postgresql.conf)

# 메모리
shared_buffers = 256MB
effective_cache_size = 768MB
work_mem = 16MB

# 연결
max_connections = 100

# WAL
wal_level = replica
max_wal_senders = 3

# 로깅
log_min_duration_statement = 1000  # 1초 이상 쿼리 로깅
```

---

## 7. 모니터링 및 로깅

### 7.1 헬스 체크 엔드포인트

| 엔드포인트 | 용도 | 응답 |
|-----------|------|------|
| `/health` | 기본 헬스 체크 | `{"status": "ok"}` |
| `/api/version` | 버전 정보 | `{"version": "1.20.0-sso.44"}` |

### 7.2 로그 설정

```yaml
# docker-compose.yml 로깅 설정
services:
  labelstudio:
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "5"
```

### 7.3 Prometheus 메트릭

```yaml
# Label Studio 메트릭 엔드포인트
# /metrics (Prometheus 형식)

# Grafana 대시보드 예시 쿼리
- 요청 수: rate(http_requests_total[5m])
- 응답 시간: histogram_quantile(0.95, http_request_duration_seconds_bucket)
- 에러율: rate(http_requests_total{status=~"5.."}[5m])
```

### 7.4 알림 설정

```yaml
# AlertManager 규칙 예시
groups:
  - name: label-studio
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"

      - alert: PodNotReady
        expr: kube_pod_status_ready{namespace="label-studio-sso-app"} == 0
        for: 5m
        labels:
          severity: warning
```

---

## 8. 백업 및 복구

### 8.1 백업 전략

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         백업 전략                                           │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                         백업 대상                                        │
  │                                                                         │
  │  1. PostgreSQL 데이터베이스                                              │
  │     - 사용자, 프로젝트, 태스크, 어노테이션                                 │
  │     - 백업 주기: 매일 (일일 백업)                                         │
  │     - 보관 기간: 30일                                                    │
  │                                                                         │
  │  2. 업로드 파일 (/label-studio/data)                                     │
  │     - 이미지, 오디오, 비디오 파일                                         │
  │     - 백업 주기: 매주 (주간 백업)                                         │
  │     - 보관 기간: 90일                                                    │
  │                                                                         │
  │  3. 설정 파일                                                            │
  │     - .env, docker-compose.yml, k8s/                                   │
  │     - Git 저장소로 관리                                                  │
  └─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 자동 백업 스크립트

```bash
#!/bin/bash
# /opt/scripts/backup-all.sh

set -e

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_BASE=/backups
S3_BUCKET=s3://your-backup-bucket

# 색상 출력
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}Starting backup: $DATE${NC}"

# 1. PostgreSQL 백업
echo "Backing up PostgreSQL..."
docker exec label-studio-postgres pg_dump -U postgres labelstudio | \
    gzip > $BACKUP_BASE/postgres/labelstudio_$DATE.sql.gz

# 2. 파일 백업
echo "Backing up data files..."
tar -czf $BACKUP_BASE/data/labelstudio_data_$DATE.tar.gz \
    -C /var/lib/docker/volumes/labelstudio_data/_data .

# 3. S3 업로드 (선택)
echo "Uploading to S3..."
aws s3 cp $BACKUP_BASE/postgres/labelstudio_$DATE.sql.gz \
    $S3_BUCKET/postgres/
aws s3 cp $BACKUP_BASE/data/labelstudio_data_$DATE.tar.gz \
    $S3_BUCKET/data/

# 4. 오래된 백업 삭제 (로컬)
find $BACKUP_BASE/postgres -name "*.sql.gz" -mtime +30 -delete
find $BACKUP_BASE/data -name "*.tar.gz" -mtime +90 -delete

echo -e "${GREEN}Backup completed successfully${NC}"
```

### 8.3 복구 절차

```bash
#!/bin/bash
# /opt/scripts/restore.sh

# 사용법: ./restore.sh 20250101_120000

BACKUP_DATE=$1
BACKUP_BASE=/backups

if [ -z "$BACKUP_DATE" ]; then
    echo "Usage: ./restore.sh <backup_date>"
    echo "Example: ./restore.sh 20250101_120000"
    exit 1
fi

echo "WARNING: This will overwrite existing data!"
read -p "Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

# 1. 서비스 중지
docker compose down

# 2. PostgreSQL 복구
echo "Restoring PostgreSQL..."
docker compose up -d postgres
sleep 10  # DB 시작 대기

gunzip -c $BACKUP_BASE/postgres/labelstudio_$BACKUP_DATE.sql.gz | \
    docker exec -i label-studio-postgres psql -U postgres -d labelstudio

# 3. 파일 복구
echo "Restoring data files..."
rm -rf /var/lib/docker/volumes/labelstudio_data/_data/*
tar -xzf $BACKUP_BASE/data/labelstudio_data_$BACKUP_DATE.tar.gz \
    -C /var/lib/docker/volumes/labelstudio_data/_data

# 4. 서비스 시작
docker compose up -d

echo "Restore completed. Please verify the data."
```

---

## 9. CI/CD 파이프라인

### 9.1 GitHub Actions 워크플로우

```yaml
# .github/workflows/build-and-publish.yml

name: Build and Publish

on:
  push:
    tags:
      - 'v*.*.*'

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Extract version from tag
        id: version
        run: echo "VERSION=${GITHUB_REF#refs/tags/v}" >> $GITHUB_OUTPUT

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ steps.version.outputs.VERSION }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          name: Release ${{ steps.version.outputs.VERSION }}
          body: |
            ## Docker Image
            ```
            docker pull ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ steps.version.outputs.VERSION }}
            ```
          draft: false
          prerelease: false
```

### 9.2 배포 자동화

```yaml
# .github/workflows/deploy.yml

name: Deploy to Production

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to deploy'
        required: true
        default: 'latest'

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production

    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /opt/label-studio
            export VERSION=${{ github.event.inputs.version }}

            # 이미지 풀
            docker compose pull

            # 서비스 업데이트
            docker compose up -d --no-deps labelstudio sso-app

            # 헬스 체크
            sleep 30
            curl -f http://localhost:8080/health || exit 1

            echo "Deployment completed: $VERSION"
```

### 9.3 릴리스 프로세스

```bash
# 1. 버전 태그 생성
git tag v1.0.11

# 2. 태그 푸시 (CI/CD 트리거)
git push origin v1.0.11

# 3. GitHub Actions가 자동으로:
#    - Docker 이미지 빌드
#    - GHCR에 푸시
#    - GitHub Release 생성

# 4. 프로덕션 배포 (수동 또는 자동)
#    - GitHub Actions Deploy 워크플로우 실행
#    - 또는 서버에서 직접 docker compose pull && docker compose up -d
```

---

## 다음 단계

배포가 완료되었다면:

1. [개발 가이드](./05-development-guide.md)에서 로컬 개발 환경 설정 방법을 확인하세요.
2. 문제가 발생하면 [SSO 구현 방법](./03-sso-implementation.md)의 트러블슈팅 섹션을 참고하세요.
