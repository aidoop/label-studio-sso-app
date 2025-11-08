<template>
  <div class="api-test-container">
    <div class="test-header">
      <h2>🧪 Project API - model_version Test</h2>
      <p class="subtitle">
        커스텀 기능 테스트: Project 수정 시 model_version 유효성 검증 우회
      </p>
    </div>

    <!-- Project 목록 -->
    <div class="section">
      <h3>📋 1. Project 목록</h3>
      <button @click="fetchProjects" class="btn btn-primary" :disabled="loading">
        {{ loading ? '로딩 중...' : 'Project 목록 새로고침' }}
      </button>

      <div v-if="projects.length > 0" class="project-list">
        <div
          v-for="project in projects"
          :key="project.id"
          class="project-item"
          :class="{ selected: selectedProjectId === project.id }"
          @click="selectProject(project)"
        >
          <div class="project-info">
            <strong>{{ project.title }}</strong>
            <span class="project-id">ID: {{ project.id }}</span>
          </div>
          <div class="project-version">
            <span class="label">model_version:</span>
            <code>{{ project.model_version || '(없음)' }}</code>
          </div>
        </div>
      </div>

      <div v-else-if="!loading" class="empty-state">
        프로젝트가 없습니다. Label Studio에서 프로젝트를 생성해주세요.
      </div>
    </div>

    <!-- model_version 수정 테스트 -->
    <div v-if="selectedProject" class="section">
      <h3>✏️ 2. model_version 수정 테스트</h3>

      <div class="test-info">
        <div class="info-row">
          <span class="label">선택된 Project:</span>
          <strong>{{ selectedProject.title }}</strong>
        </div>
        <div class="info-row">
          <span class="label">현재 model_version:</span>
          <code>{{ selectedProject.model_version || '(없음)' }}</code>
        </div>
      </div>

      <div class="input-group">
        <label for="new-version">새로운 model_version:</label>
        <input
          id="new-version"
          v-model="newModelVersion"
          type="text"
          placeholder="예: aiver03, model_v2, etc."
          @keyup.enter="updateModelVersion"
        />
        <button
          @click="updateModelVersion"
          class="btn btn-success"
          :disabled="!newModelVersion || updating"
        >
          {{ updating ? '업데이트 중...' : '✅ model_version 업데이트' }}
        </button>
      </div>

      <div class="test-description">
        <strong>💡 테스트 포인트:</strong>
        <ul>
          <li>Label Studio 1.20.0 기본: ❌ "Model version doesn't exist..." 오류</li>
          <li>커스텀 이미지: ✅ 어떤 값이든 저장 가능</li>
          <li>ML Backend에 없는 임의의 값도 저장 가능해야 함</li>
        </ul>
      </div>
    </div>

    <!-- 응답 결과 -->
    <div v-if="lastResponse" class="section">
      <h3>📡 3. API 응답</h3>

      <div class="response-box" :class="lastResponse.success ? 'success' : 'error'">
        <div class="response-header">
          <span class="status-badge" :class="lastResponse.success ? 'success' : 'error'">
            {{ lastResponse.success ? '✅ 성공' : '❌ 실패' }}
          </span>
          <span class="status-code">HTTP {{ lastResponse.status }}</span>
        </div>

        <div class="response-body">
          <div class="response-label">Request:</div>
          <pre>{{ lastResponse.request }}</pre>

          <div class="response-label">Response:</div>
          <pre>{{ JSON.stringify(lastResponse.data, null, 2) }}</pre>
        </div>
      </div>

      <div v-if="lastResponse.success" class="success-message">
        <strong>🎉 커스터마이징 성공!</strong>
        <p>model_version이 유효성 검증 없이 저장되었습니다.</p>
      </div>

      <div v-else class="error-message">
        <strong>⚠️ 오류 발생</strong>
        <p>{{ lastResponse.error }}</p>
      </div>
    </div>

    <!-- 테스트 히스토리 -->
    <div v-if="testHistory.length > 0" class="section">
      <h3>📊 테스트 히스토리</h3>
      <div class="history-list">
        <div
          v-for="(item, index) in testHistory"
          :key="index"
          class="history-item"
          :class="item.success ? 'success' : 'error'"
        >
          <span class="timestamp">{{ item.timestamp }}</span>
          <span class="project-name">{{ item.projectTitle }}</span>
          <span class="version-change">
            <code>{{ item.oldVersion || '(없음)' }}</code>
            →
            <code>{{ item.newVersion }}</code>
          </span>
          <span class="status-icon">{{ item.success ? '✅' : '❌' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const BACKEND_URL = '';
const LABELSTUDIO_URL = 'http://label.nubison.localhost:8080';

const projects = ref([]);
const selectedProject = ref(null);
const selectedProjectId = ref(null);
const newModelVersion = ref('');
const loading = ref(false);
const updating = ref(false);
const lastResponse = ref(null);
const testHistory = ref([]);

// Project 목록 가져오기
const fetchProjects = async () => {
  loading.value = true;
  lastResponse.value = null;

  try {
    const response = await fetch(`${BACKEND_URL}/api/labelstudio/projects`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    projects.value = data.results || [];

  } catch (error) {
    console.error('Failed to fetch projects:', error);
    alert('프로젝트 목록을 가져오는데 실패했습니다: ' + error.message);
  } finally {
    loading.value = false;
  }
};

// Project 선택
const selectProject = (project) => {
  selectedProject.value = project;
  selectedProjectId.value = project.id;
  newModelVersion.value = project.model_version || '';
  lastResponse.value = null;
};

// model_version 업데이트
const updateModelVersion = async () => {
  if (!selectedProject.value || !newModelVersion.value) return;

  updating.value = true;
  const oldVersion = selectedProject.value.model_version;

  try {
    const requestBody = {
      model_version: newModelVersion.value
    };

    const response = await fetch(
      `${BACKEND_URL}/api/labelstudio/projects/${selectedProject.value.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();

    lastResponse.value = {
      success: response.ok,
      status: response.status,
      request: `PATCH /api/projects/${selectedProject.value.id}/\n${JSON.stringify(requestBody, null, 2)}`,
      data: data,
      error: response.ok ? null : (data.detail || data.validation_errors || '알 수 없는 오류'),
    };

    // 히스토리 추가
    testHistory.value.unshift({
      timestamp: new Date().toLocaleTimeString('ko-KR'),
      projectTitle: selectedProject.value.title,
      oldVersion: oldVersion,
      newVersion: newModelVersion.value,
      success: response.ok,
    });

    // 성공 시 프로젝트 목록 새로고침
    if (response.ok) {
      await fetchProjects();
      // 같은 프로젝트 다시 선택
      const updatedProject = projects.value.find(p => p.id === selectedProject.value.id);
      if (updatedProject) {
        selectProject(updatedProject);
      }
    }

  } catch (error) {
    console.error('Failed to update model_version:', error);
    lastResponse.value = {
      success: false,
      status: 0,
      request: `PATCH /api/projects/${selectedProject.value.id}/`,
      data: null,
      error: error.message,
    };
  } finally {
    updating.value = false;
  }
};

// 초기 로드
fetchProjects();
</script>

<style scoped>
.api-test-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.test-header {
  text-align: center;
  margin-bottom: 40px;
}

.test-header h2 {
  margin: 0 0 10px 0;
  color: #333;
  font-size: 28px;
}

.subtitle {
  color: #666;
  font-size: 14px;
  margin: 0;
}

.section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.section h3 {
  margin: 0 0 20px 0;
  color: #333;
  font-size: 20px;
  border-bottom: 2px solid #f0f0f0;
  padding-bottom: 10px;
}

/* 버튼 */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-success {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  color: white;
}

.btn-success:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(56, 239, 125, 0.4);
}

/* Project 목록 */
.project-list {
  margin-top: 16px;
  display: grid;
  gap: 12px;
}

.project-item {
  padding: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.project-item:hover {
  border-color: #667eea;
  background: #f8f9ff;
}

.project-item.selected {
  border-color: #667eea;
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
}

.project-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.project-id {
  font-size: 12px;
  color: #999;
}

.project-version {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label {
  font-size: 12px;
  color: #666;
  font-weight: 600;
}

code {
  background: #f5f5f5;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  color: #c7254e;
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: #999;
  font-size: 14px;
}

/* 테스트 섹션 */
.test-info {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.info-row {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.input-group {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 20px;
}

.input-group label {
  font-weight: 600;
  color: #333;
  min-width: 180px;
}

.input-group input {
  flex: 1;
  padding: 10px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.input-group input:focus {
  outline: none;
  border-color: #667eea;
}

.test-description {
  background: #fff9e6;
  border-left: 4px solid #ffc107;
  padding: 16px;
  border-radius: 4px;
}

.test-description strong {
  color: #f57c00;
  display: block;
  margin-bottom: 8px;
}

.test-description ul {
  margin: 0;
  padding-left: 20px;
}

.test-description li {
  margin-bottom: 4px;
  font-size: 14px;
  color: #666;
}

/* 응답 결과 */
.response-box {
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #e0e0e0;
}

.response-box.success {
  border-color: #38ef7d;
}

.response-box.error {
  border-color: #f44336;
}

.response-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge.success {
  background: #38ef7d;
  color: white;
}

.status-badge.error {
  background: #f44336;
  color: white;
}

.status-code {
  font-size: 12px;
  color: #666;
  font-weight: 600;
}

.response-body {
  padding: 16px;
  background: #fafafa;
}

.response-label {
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
  font-size: 13px;
}

.response-body pre {
  background: #2d2d2d;
  color: #f8f8f2;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 13px;
  margin: 0 0 16px 0;
  font-family: 'Monaco', 'Courier New', monospace;
}

.response-body pre:last-child {
  margin-bottom: 0;
}

.success-message,
.error-message {
  margin-top: 16px;
  padding: 16px;
  border-radius: 8px;
}

.success-message {
  background: #e8f5e9;
  border-left: 4px solid #4caf50;
}

.error-message {
  background: #ffebee;
  border-left: 4px solid #f44336;
}

.success-message strong,
.error-message strong {
  display: block;
  margin-bottom: 8px;
}

.success-message p,
.error-message p {
  margin: 0;
  font-size: 14px;
  color: #666;
}

/* 히스토리 */
.history-list {
  display: grid;
  gap: 8px;
}

.history-item {
  display: grid;
  grid-template-columns: 100px 1fr auto 40px;
  gap: 16px;
  align-items: center;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 14px;
}

.history-item.success {
  background: #e8f5e9;
}

.history-item.error {
  background: #ffebee;
}

.timestamp {
  color: #666;
  font-size: 12px;
}

.project-name {
  font-weight: 600;
  color: #333;
}

.version-change {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
}

.status-icon {
  font-size: 18px;
  text-align: center;
}
</style>
