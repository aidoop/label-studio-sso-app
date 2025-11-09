# ==============================================================================
# Label Studio + SSO Docker Compose Makefile
# ==============================================================================
#
# 자주 사용하는 Docker Compose 명령어를 간단하게 실행할 수 있는 Makefile입니다.
#
# 사용 방법:
#   make help     # 사용 가능한 명령어 목록
#   make start    # 서비스 시작
#   make stop     # 서비스 중지
#   make logs     # 로그 확인
#
# ==============================================================================

.PHONY: help start stop restart build logs clean shell db-shell migrate create-user backup restore test

# 기본 타겟
.DEFAULT_GOAL := help

# 색상 정의 (터미널 출력용)
GREEN  := $(shell tput -Txterm setaf 2)
YELLOW := $(shell tput -Txterm setaf 3)
RESET  := $(shell tput -Txterm sgr0)

# ==============================================================================
# 도움말
# ==============================================================================

help: ## 사용 가능한 명령어 목록 표시
	@echo "$(GREEN)Label Studio + SSO Docker Compose 명령어$(RESET)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(RESET) %s\n", $$1, $$2}'

# ==============================================================================
# 서비스 관리
# ==============================================================================

start: ## 서비스 시작 (백그라운드)
	@echo "$(GREEN)서비스 시작 중...$(RESET)"
	docker-compose up -d
	@echo "$(GREEN)완료! http://localhost:8080 에서 접속하세요$(RESET)"

stop: ## 서비스 중지
	@echo "$(YELLOW)서비스 중지 중...$(RESET)"
	docker-compose stop

down: ## 서비스 중지 및 삭제 (볼륨은 유지)
	@echo "$(YELLOW)서비스 중지 및 삭제 중...$(RESET)"
	docker-compose down

clean: ## 서비스 중지 및 모든 데이터 삭제 (주의: 복구 불가!)
	@echo "$(YELLOW)경고: 모든 데이터가 삭제됩니다!$(RESET)"
	@read -p "계속하시겠습니까? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose down -v; \
		echo "$(GREEN)완료!$(RESET)"; \
	else \
		echo "$(YELLOW)취소됨$(RESET)"; \
	fi

restart: ## 서비스 재시작
	@echo "$(YELLOW)서비스 재시작 중...$(RESET)"
	docker-compose restart

build: ## Docker 이미지 빌드
	@echo "$(GREEN)Docker 이미지 빌드 중...$(RESET)"
	docker-compose build

rebuild: ## 강제로 이미지 재빌드 및 시작
	@echo "$(GREEN)이미지 재빌드 및 시작 중...$(RESET)"
	docker-compose up -d --build

# ==============================================================================
# 로그 및 모니터링
# ==============================================================================

logs: ## 모든 서비스 로그 확인 (실시간)
	docker-compose logs -f

logs-app: ## Label Studio 로그만 확인
	docker-compose logs -f labelstudio

logs-db: ## PostgreSQL 로그만 확인
	docker-compose logs -f postgres

ps: ## 실행 중인 컨테이너 목록
	docker-compose ps

# ==============================================================================
# 컨테이너 접속
# ==============================================================================

shell: ## Label Studio 컨테이너에 Bash로 접속
	docker-compose exec labelstudio bash

db-shell: ## PostgreSQL CLI 접속
	docker-compose exec postgres psql -U postgres -d labelstudio

# ==============================================================================
# 데이터베이스 관리
# ==============================================================================

migrate: ## 데이터베이스 마이그레이션 실행
	@echo "$(GREEN)마이그레이션 실행 중...$(RESET)"
	docker-compose exec labelstudio python /label-studio/label_studio/manage.py migrate

create-user: ## Django 관리자 계정 생성 (대화형)
	@echo "$(GREEN)관리자 계정 생성$(RESET)"
	docker-compose exec labelstudio python /label-studio/label_studio/manage.py createsuperuser

setup: ## 초기 사용자 자동 생성 (관리자 + 일반 사용자)
	@echo "$(GREEN)초기 사용자 생성 중...$(RESET)"
	docker-compose exec labelstudio bash /scripts/init_users.sh

create-token: ## API 토큰 생성 (이메일 입력 필요)
	@read -p "사용자 이메일: " email; \
	docker-compose exec labelstudio python /label-studio/label_studio/manage.py drf_create_token $$email

# ==============================================================================
# 백업 및 복원
# ==============================================================================

backup: ## PostgreSQL 데이터베이스 백업
	@echo "$(GREEN)데이터베이스 백업 중...$(RESET)"
	@mkdir -p ./backups
	docker-compose exec postgres pg_dump -U postgres labelstudio > ./backups/backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)백업 완료: ./backups/backup_$$(date +%Y%m%d_%H%M%S).sql$(RESET)"

restore: ## 데이터베이스 복원 (최신 백업 파일 사용)
	@echo "$(YELLOW)데이터베이스 복원 중...$(RESET)"
	@LATEST=$$(ls -t ./backups/*.sql | head -1); \
	echo "복원 파일: $$LATEST"; \
	cat $$LATEST | docker-compose exec -T postgres psql -U postgres labelstudio
	@echo "$(GREEN)복원 완료!$(RESET)"

# ==============================================================================
# 테스트 및 검증
# ==============================================================================

test: ## 서비스 헬스체크 및 SSO API 테스트
	@echo "$(GREEN)서비스 헬스체크...$(RESET)"
	@curl -f http://localhost:8080/health && echo "$(GREEN)✓ Label Studio 정상$(RESET)" || echo "$(YELLOW)✗ Label Studio 응답 없음$(RESET)"
	@echo ""
	@echo "$(GREEN)버전 확인...$(RESET)"
	@curl -s http://localhost:8080/api/version/ | python -m json.tool
	@echo ""
	@echo "$(YELLOW)SSO API 테스트는 API Token이 필요합니다$(RESET)"
	@echo "$(YELLOW)토큰 생성: make create-token$(RESET)"

health: ## 헬스체크만 실행
	@curl -f http://localhost:8080/health

# ==============================================================================
# 개발 환경
# ==============================================================================

setup-hosts: ## /etc/hosts 파일에 도메인 추가
	@echo "$(GREEN)/etc/hosts 파일 설정 중...$(RESET)"
	@echo ""
	@echo "$(YELLOW)다음 라인을 /etc/hosts 파일에 추가합니다:$(RESET)"
	@echo "127.0.0.1 hatiolab.localhost"
	@echo "127.0.0.1 label.hatiolab.localhost"
	@echo ""
	@read -p "계속하시겠습니까? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		echo "127.0.0.1 hatiolab.localhost" | sudo tee -a /etc/hosts > /dev/null; \
		echo "127.0.0.1 label.hatiolab.localhost" | sudo tee -a /etc/hosts > /dev/null; \
		echo "$(GREEN)완료!$(RESET)"; \
	else \
		echo "$(YELLOW)취소됨$(RESET)"; \
	fi

reset-db: ## 데이터베이스 초기화 (주의: 모든 데이터 삭제!)
	@echo "$(YELLOW)경고: 모든 데이터베이스 데이터가 삭제됩니다!$(RESET)"
	@read -p "계속하시겠습니까? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose down -v; \
		docker-compose up -d; \
		echo "$(GREEN)데이터베이스 초기화 완료!$(RESET)"; \
	else \
		echo "$(YELLOW)취소됨$(RESET)"; \
	fi

env: ## .env 파일 생성 (템플릿에서 복사)
	@if [ -f .env ]; then \
		echo "$(YELLOW).env 파일이 이미 존재합니다$(RESET)"; \
	else \
		cp .env.example .env; \
		echo "$(GREEN).env 파일이 생성되었습니다. 설정을 확인하세요!$(RESET)"; \
	fi

# ==============================================================================
# 정보 확인
# ==============================================================================

info: ## 서비스 정보 출력
	@echo "$(GREEN)Label Studio + SSO 환경 정보$(RESET)"
	@echo ""
	@echo "서비스 상태:"
	@docker-compose ps
	@echo ""
	@echo "볼륨 정보:"
	@docker volume ls | grep label-studio-test-app
	@echo ""
	@echo "네트워크 정보:"
	@docker network ls | grep label-studio-test-app
