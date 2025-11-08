# ==============================================================================
# Label Studio SSO Sample App - Production Dockerfile
# ==============================================================================
#
# Multi-stage build:
#   Stage 1: Frontend 빌드 (Vue 3 + Vite)
#   Stage 2: Backend + Frontend dist 통합
#
# ==============================================================================

# ==============================================================================
# Stage 1: Frontend Build
# ==============================================================================
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Frontend 의존성 설치
COPY frontend/package*.json ./
RUN npm ci

# Frontend 소스 복사 및 빌드
COPY frontend/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Backend + Frontend Integration
# ==============================================================================
FROM node:18-alpine AS production

WORKDIR /app

# Backend 의존성 설치
COPY backend/package*.json ./
RUN npm ci --only=production

# Backend 소스 복사
COPY backend/ ./

# Frontend 빌드 산출물 복사
COPY --from=frontend-builder /app/frontend/dist ./public

# 환경 변수 설정
ENV NODE_ENV=production
ENV PORT=3000

# 포트 노출
EXPOSE 3000

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 애플리케이션 실행
CMD ["node", "server.js"]
