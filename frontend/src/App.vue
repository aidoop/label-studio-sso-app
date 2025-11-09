<template>
  <div class="app">
    <header>
      <h1>Label Studio Integration Test</h1>
      <p class="subtitle">Testing Label Studio SSO with subdomain approach</p>
    </header>

    <div v-if="!ssoReady" class="setup">
      <div class="card">
        <h2>Setup SSO Authentication</h2>
        <p>Select a user to authenticate with Label Studio</p>

        <!-- 사용자 로딩 중 -->
        <div v-if="loadingUsers" class="loading-users">
          <p>사용자 목록을 불러오는 중...</p>
        </div>

        <!-- 사용자 로딩 실패 -->
        <div v-else-if="usersError" class="users-error">
          <p class="error">{{ usersError }}</p>
          <button @click="fetchUsers" class="retry-btn">재시도</button>
        </div>

        <!-- 사용자 버튼 (동적) -->
        <div v-else class="user-buttons">
          <!-- 실제 사용자 -->
          <button
            v-for="u in users"
            :key="u.id"
            @click="setupSSO(u.email)"
            :disabled="loading"
            class="user-btn"
            :class="{ 'superuser-btn': u.is_superuser }"
          >
            {{ loading ? "Setting up..." : `Login as ${u.first_name || 'User'}` }}
            <small>
              {{ u.email }}
              <span v-if="u.is_superuser" class="badge">Admin</span>
            </small>
          </button>

          <!-- 테스트용 버튼들 -->
          <button
            @click="setupSSO('nonexistent@hatiolab.com')"
            :disabled="loading"
            class="user-btn test-user-btn"
          >
            {{ loading ? "Setting up..." : "Login as Non-existent User" }}
            <small>nonexistent@hatiolab.com (API 에러 테스트)</small>
          </button>
          <button
            @click="setupInvalidToken"
            :disabled="loading"
            class="user-btn test-user-btn invalid-token-btn"
          >
            {{ loading ? "Setting up..." : "Test Invalid Token + iframe" }}
            <small>iframe SSO 오류 페이지 테스트</small>
          </button>
        </div>

        <!-- Custom Email Login -->
        <div class="custom-login">
          <h3>또는 커스텀 이메일로 로그인</h3>
          <form @submit.prevent="setupCustomSSO" class="custom-form">
            <input
              v-model="customEmail"
              type="email"
              placeholder="test_user@hatiolab.com"
              :disabled="loading"
              required
            />
            <button type="submit" :disabled="loading || !customEmail" class="custom-btn">
              {{ loading ? "Setting up..." : "로그인" }}
            </button>
          </form>
          <p class="hint">테스트 유저 또는 다른 사용자의 이메일을 입력하세요</p>
        </div>

        <p v-if="message" :class="{ error: isError }">{{ message }}</p>
      </div>
    </div>

    <div v-else class="content">
      <div class="info">
        <p>✓ SSO Authentication successful</p>
        <p>User: {{ user }}</p>
        <button @click="resetSSO" class="secondary">Logout</button>
      </div>

      <!-- Tab Navigation -->
      <div v-if="!selectedProject" class="tabs">
        <button
          :class="['tab-btn', { active: activeTab === 'projects' }]"
          @click="activeTab = 'projects'"
        >
          📁 Projects
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'webhooks' }]"
          @click="activeTab = 'webhooks'"
        >
          🔔 Webhook Monitor
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'api-test' }]"
          @click="activeTab = 'api-test'"
        >
          🧪 API Test
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'export-api' }]"
          @click="activeTab = 'export-api'"
        >
          📊 Export API
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'test-user' }]"
          @click="activeTab = 'test-user'"
        >
          👤 Test User
        </button>
      </div>

      <!-- Projects Tab -->
      <div v-if="!selectedProject && activeTab === 'projects'" class="projects">
        <h2>Projects</h2>
        <p v-if="loadingProjects" class="loading">Loading projects...</p>
        <p v-else-if="projects.length === 0" class="no-projects">
          No projects found
        </p>

        <div v-else class="project-list">
          <div
            v-for="project in projects"
            :key="project.id"
            class="project-card"
            @click="selectProject(project)"
          >
            <h3>{{ project.title }}</h3>
            <p class="project-desc">
              {{ project.description || "No description" }}
            </p>
            <div class="project-meta">
              <span>ID: {{ project.id }}</span>
              <span>Tasks: {{ project.task_number || 0 }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Webhook Monitor Tab -->
      <div v-if="!selectedProject && activeTab === 'webhooks'" class="webhooks">
        <WebhookMonitor />
      </div>

      <!-- API Test Tab -->
      <div v-if="!selectedProject && activeTab === 'api-test'" class="api-test">
        <ProjectAPITest />
      </div>

      <!-- Export API Test Tab -->
      <div v-if="!selectedProject && activeTab === 'export-api'" class="export-api">
        <ExportAPITest />
      </div>

      <!-- Test User Creation Tab -->
      <div v-if="!selectedProject && activeTab === 'test-user'" class="test-user">
        <TestUserCreation />
      </div>

      <!-- 프로젝트 선택된 경우: LabelStudioWrapper -->
      <div v-if="selectedProject" class="project-view">
        <div class="project-header">
          <button @click="selectedProject = null" class="secondary back-btn">
            ← Back to Projects
          </button>
          <h3>{{ selectedProject.title }}</h3>
        </div>

        <div class="wrapper-container">
          <LabelStudioWrapper
            :key="user + '-' + selectedProject.id"
            :project-id="selectedProject.id"
            :email="user"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import LabelStudioWrapper from "./components/LabelStudioWrapper.vue";
import WebhookMonitor from "./components/WebhookMonitor.vue";
import ProjectAPITest from "./components/ProjectAPITest.vue";
import ExportAPITest from "./components/ExportAPITest.vue";
import TestUserCreation from "./components/TestUserCreation.vue";

const ssoReady = ref(false);
const loading = ref(false);
const message = ref("");
const isError = ref(false);
const user = ref("");
const projects = ref([]);
const selectedProject = ref(null);
const loadingProjects = ref(false);
const activeTab = ref("projects"); // 'projects' or 'webhooks'
const customEmail = ref(""); // Custom email for login

// 사용자 목록
const users = ref([]);
const loadingUsers = ref(false);
const usersError = ref("");

async function setupSSO(email) {
  loading.value = true;
  message.value = `Setting up SSO for ${email}...`;
  isError.value = false;

  try {
    // Backend를 통해 JWT 토큰 발급
    message.value = `Setting up SSO for ${email}...`;
    const response = await fetch(
      `/api/sso/token?email=${encodeURIComponent(
        email
      )}`,
      {
        credentials: "include",
      }
    );

    const data = await response.json();

    if (data.success) {
      user.value = data.user;
      ssoReady.value = true;
      message.value = "Loading projects...";

      // SSO 완료 후 프로젝트 리스트 가져오기
      await fetchProjects();
    } else {
      message.value = `Error: ${data.message}`;
      isError.value = true;
    }
  } catch (error) {
    message.value = `Error: ${error.message}`;
    isError.value = true;
  } finally {
    loading.value = false;
  }
}

async function fetchProjects() {
  loadingProjects.value = true;

  try {
    const response = await fetch("/api/projects", {
      credentials: "include",
    });

    const data = await response.json();

    if (data.success) {
      projects.value = data.projects;
      message.value = `Found ${data.projects.length} projects`;
    } else {
      message.value = `Error: ${data.message}`;
      isError.value = true;
    }
  } catch (error) {
    message.value = `Error: ${error.message}`;
    isError.value = true;
  } finally {
    loadingProjects.value = false;
  }
}

function selectProject(project) {
  selectedProject.value = project;
}

async function fetchUsers() {
  loadingUsers.value = true;
  usersError.value = "";

  try {
    const response = await fetch("/api/test/users", {
      credentials: "include",
    });

    const data = await response.json();

    if (data.success) {
      users.value = data.users;
      console.log(`[Users] Loaded ${data.users.length} users`);
    } else {
      usersError.value = data.message || "사용자 목록을 불러올 수 없습니다";
    }
  } catch (error) {
    console.error("[Users] Error:", error);
    usersError.value = `네트워크 오류: ${error.message}`;
  } finally {
    loadingUsers.value = false;
  }
}

async function setupInvalidToken() {
  loading.value = true;
  message.value = "Step 1: Getting valid token to fetch projects...";
  isError.value = false;

  try {
    // Step 1: 먼저 유효한 토큰으로 로그인하여 프로젝트 리스트 가져오기
    const tokenResponse = await fetch(
      `/api/sso/token?email=admin@hatiolab.com`,
      {
        credentials: "include",
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenData.success) {
      throw new Error("Failed to get valid token");
    }

    message.value = "Step 2: Fetching projects with valid token...";

    // Step 2: 프로젝트 리스트 가져오기
    await fetchProjects();

    if (projects.value.length === 0) {
      throw new Error("No projects found. Please create a project first.");
    }

    message.value = "Step 3: Replacing with invalid token for testing...";

    // Step 3: Invalid JWT 토큰으로 교체
    const invalidResponse = await fetch(
      "/api/sso/invalid-token",
      {
        credentials: "include",
      }
    );

    const invalidData = await invalidResponse.json();

    if (invalidData.success) {
      user.value = "test-invalid-token";
      ssoReady.value = true;
      message.value = "✓ Invalid token set. Now select a project to see SSO error page in iframe.";
    } else {
      message.value = `Error: ${invalidData.message}`;
      isError.value = true;
    }
  } catch (error) {
    message.value = `Error: ${error.message}`;
    isError.value = true;
  } finally {
    loading.value = false;
  }
}

async function setupCustomSSO() {
  if (!customEmail.value) return;
  await setupSSO(customEmail.value);
  customEmail.value = ""; // Clear input after login
}

function resetSSO() {
  ssoReady.value = false;
  message.value = "";
  user.value = "";
  projects.value = [];
  selectedProject.value = null;
  customEmail.value = "";
}

// 쿠키에서 JWT 토큰 확인
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// 페이지 로드 시 자동 로그인 체크
async function checkAutoLogin() {
  const token = getCookie('ls_auth_token');

  if (token) {
    // URL 파라미터에서 사용자 이메일 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const userEmail = urlParams.get('user');

    console.log('[Auto Login] JWT token found, loading projects...');
    ssoReady.value = true;
    user.value = userEmail || 'auto-login';
    message.value = 'Loading projects...';

    try {
      await fetchProjects();
      activeTab.value = 'projects';
    } catch (error) {
      console.error('[Auto Login] Error loading projects:', error);
      // 프로젝트 로드 실패 시 로그인 화면으로
      resetSSO();
    }
  }
}

onMounted(() => {
  checkAutoLogin();
  fetchUsers();  // 사용자 목록 불러오기
});
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.app {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

header {
  text-align: center;
  margin-bottom: 40px;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
}

h1 {
  margin: 0 0 10px 0;
  font-size: 32px;
}

.subtitle {
  margin: 0;
  opacity: 0.9;
  font-size: 16px;
}

.setup {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.card {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  text-align: center;
  max-width: 500px;
}

.card h2 {
  margin-top: 0;
  color: #333;
}

.custom-login {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 2px solid #e0e0e0;
}

.custom-login h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #333;
}

.custom-form {
  display: flex;
  gap: 12px;
}

.custom-form input {
  flex: 1;
  padding: 12px 16px;
  font-size: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  transition: border-color 0.2s;
}

.custom-form input:focus {
  outline: none;
  border-color: #667eea;
}

.custom-btn {
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  background: #28a745;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  margin: 0;
}

.custom-btn:hover:not(:disabled) {
  background: #218838;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(40, 167, 69, 0.4);
}

.custom-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.hint {
  margin: 8px 0 0 0;
  font-size: 13px;
  color: #999;
}

button {
  padding: 12px 32px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  background: #667eea;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  margin: 20px 0;
}

button:hover:not(:disabled) {
  background: #5568d3;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

button.secondary {
  background: #6c757d;
  padding: 8px 16px;
  font-size: 14px;
}

button.secondary:hover {
  background: #5a6268;
}

.user-buttons {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 24px 0;
}

.user-btn {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 24px;
}

.user-btn small {
  font-size: 12px;
  font-weight: 400;
  opacity: 0.9;
}

.test-user-btn {
  background: #dc3545;
  border: 2px dashed #c82333;
}

.test-user-btn:hover:not(:disabled) {
  background: #c82333;
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
}

.invalid-token-btn {
  background: #fd7e14;
  border: 2px dashed #e8590c;
}

.invalid-token-btn:hover:not(:disabled) {
  background: #e8590c;
  box-shadow: 0 4px 12px rgba(253, 126, 20, 0.4);
}

.superuser-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: 2px solid #667eea;
}

.superuser-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #5568d3 0%, #653a8f 100%);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  margin-left: 8px;
  font-size: 10px;
  font-weight: 700;
  color: white;
  background: #28a745;
  border-radius: 12px;
  text-transform: uppercase;
}

.loading-users {
  text-align: center;
  padding: 40px 20px;
  color: #666;
}

.users-error {
  text-align: center;
  padding: 20px;
}

.users-error .error {
  color: #dc3545;
  margin-bottom: 16px;
}

.retry-btn {
  padding: 10px 20px;
  font-size: 14px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
}

.retry-btn:hover {
  background: #5a6268;
  transform: translateY(-2px);
}

.info {
  background: #d4edda;
  border: 1px solid #c3e6cb;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  text-align: center;
}

.info p {
  margin: 8px 0;
  color: #155724;
}

.iframe-container {
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

p.error {
  color: #dc3545;
  font-weight: 600;
}

p:not(.error):not(.subtitle) {
  color: #666;
}

.projects {
  margin-top: 20px;
}

.projects h2 {
  margin: 0 0 20px 0;
  color: #333;
}

.loading,
.no-projects {
  text-align: center;
  padding: 40px;
  color: #666;
  font-size: 16px;
}

.project-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.project-card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.3s;
  border: 2px solid transparent;
}

.project-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
  border-color: #667eea;
}

.project-card h3 {
  margin: 0 0 12px 0;
  color: #333;
  font-size: 18px;
}

.project-desc {
  color: #666;
  font-size: 14px;
  margin: 0 0 16px 0;
  line-height: 1.5;
}

.project-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #999;
  border-top: 1px solid #eee;
  padding-top: 12px;
}

.project-view {
  margin-top: 20px;
}

.project-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.project-header h3 {
  margin: 0;
  color: #333;
  flex: 1;
}

.back-btn {
  margin: 0;
}

.wrapper-container {
  height: 800px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

/* Tab Navigation */
.tabs {
  display: flex;
  gap: 12px;
  margin: 20px 0;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 12px;
}

.tab-btn {
  padding: 12px 24px;
  background: white;
  color: #666;
  border: 2px solid #e0e0e0;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.2s;
  margin: 0;
}

.tab-btn:hover:not(.active) {
  background: #f8f9fa;
  border-color: #667eea;
  transform: none;
  box-shadow: none;
}

.tab-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.webhooks {
  margin-top: 20px;
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>
