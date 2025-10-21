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

      <!-- 프로젝트 선택되지 않은 경우: 프로젝트 리스트 -->
      <div v-if="!selectedProject" class="projects">
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

      <!-- 프로젝트 선택된 경우: LabelStudioWrapper -->
      <div v-else class="project-view">
        <div class="project-header">
          <button @click="selectedProject = null" class="secondary back-btn">
            ← Back to Projects
          </button>
          <h3>{{ selectedProject.title }}</h3>
        </div>

        <div class="wrapper-container">
          <LabelStudioWrapper :project-id="selectedProject.id" :email="user" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import LabelStudioWrapper from "./components/LabelStudioWrapper.vue";

const ssoReady = ref(false);
const loading = ref(false);
const message = ref("");
const isError = ref(false);
const user = ref("");
const projects = ref([]);
const selectedProject = ref(null);
const loadingProjects = ref(false);

async function setupSSO(email) {
  loading.value = true;
  message.value = `Setting up SSO for ${email}...`;
  isError.value = false;

  try {
    // 1. 먼저 Label Studio에서 기존 세션 로그아웃
    message.value = "Clearing existing session...";
    try {
      await fetch("http://label.nubison.localhost:8080/user/logout/", {
        method: "POST",
        credentials: "include",
      });
    } catch (logoutError) {
      // 로그아웃 실패해도 계속 진행 (세션이 없을 수 있음)
      console.log("Logout attempt:", logoutError.message);
    }

    // 2. Backend를 통해 SSO 토큰 설정
    message.value = `Setting up SSO for ${email}...`;
    const response = await fetch(
      `http://nubison.localhost:3001/api/sso/setup?email=${encodeURIComponent(
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
</style>
