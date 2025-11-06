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

        <div class="user-buttons">
          <button
            @click="setupSSO('admin@nubison.io')"
            :disabled="loading"
            class="user-btn"
          >
            {{ loading ? "Setting up..." : "Login as Admin" }}
            <small>admin@nubison.io</small>
          </button>
          <button
            @click="setupSSO('annotator@nubison.io')"
            :disabled="loading"
            class="user-btn"
          >
            {{ loading ? "Setting up..." : "Login as Annotator" }}
            <small>annotator@nubison.io</small>
          </button>
          <button
            @click="setupSSO('manager@nubison.io')"
            :disabled="loading"
            class="user-btn"
          >
            {{ loading ? "Setting up..." : "Login as Manager" }}
            <small>manager@nubison.io</small>
          </button>
          <button
            @click="setupSSO('nonexistent@nubison.io')"
            :disabled="loading"
            class="user-btn test-user-btn"
          >
            {{ loading ? "Setting up..." : "Login as Non-existent User" }}
            <small>nonexistent@nubison.io (API 에러 테스트)</small>
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
import { ref } from "vue";
import LabelStudioWrapper from "./components/LabelStudioWrapper.vue";
import WebhookMonitor from "./components/WebhookMonitor.vue";
import ProjectAPITest from "./components/ProjectAPITest.vue";
import ExportAPITest from "./components/ExportAPITest.vue";

const ssoReady = ref(false);
const loading = ref(false);
const message = ref("");
const isError = ref(false);
const user = ref("");
const projects = ref([]);
const selectedProject = ref(null);
const loadingProjects = ref(false);
const activeTab = ref("projects"); // 'projects' or 'webhooks'

async function setupSSO(email) {
  loading.value = true;
  message.value = `Setting up SSO for ${email}...`;
  isError.value = false;

  try {
    // Backend를 통해 JWT 토큰 발급
    message.value = `Setting up SSO for ${email}...`;
    const response = await fetch(
      `http://nubison.localhost:3001/api/sso/token?email=${encodeURIComponent(
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
    const response = await fetch("http://nubison.localhost:3001/api/projects", {
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

async function setupInvalidToken() {
  loading.value = true;
  message.value = "Step 1: Getting valid token to fetch projects...";
  isError.value = false;

  try {
    // Step 1: 먼저 유효한 토큰으로 로그인하여 프로젝트 리스트 가져오기
    const tokenResponse = await fetch(
      `http://nubison.localhost:3001/api/sso/token?email=admin@nubison.io`,
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
      "http://nubison.localhost:3001/api/sso/invalid-token",
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

function resetSSO() {

  ssoReady.value = false;
  message.value = "";
  user.value = "";
  projects.value = [];
  selectedProject.value = null;
}
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
