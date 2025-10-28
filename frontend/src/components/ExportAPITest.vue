<template>
  <div class="export-api-test">
    <h1>Custom Export API Test</h1>
    <p class="description">
      MLOps 모델 학습 및 성능 계산을 위한 Custom Export API 테스트
    </p>

    <!-- Request Form -->
    <div class="form-section">
      <h2>Request Parameters</h2>

      <div class="form-group">
        <label for="projectId">Project ID <span class="required">*</span></label>
        <input
          id="projectId"
          v-model.number="requestData.project_id"
          type="number"
          placeholder="프로젝트 ID (필수)"
          required
        />
      </div>

      <div class="form-group">
        <label for="searchFrom">Search From (날짜 시작)</label>
        <input
          id="searchFrom"
          v-model="requestData.search_from"
          type="text"
          placeholder="yyyy-mm-dd hh:mi:ss (예: 2025-01-01 00:00:00)"
        />
      </div>

      <div class="form-group">
        <label for="searchTo">Search To (날짜 종료)</label>
        <input
          id="searchTo"
          v-model="requestData.search_to"
          type="text"
          placeholder="yyyy-mm-dd hh:mi:ss (예: 2025-01-31 23:59:59)"
        />
      </div>

      <div class="form-group">
        <label for="modelVersion">Model Version</label>
        <input
          id="modelVersion"
          v-model="requestData.model_version"
          type="text"
          placeholder="모델 버전 (예: bert-v1)"
        />
      </div>

      <div class="form-group">
        <label for="confirmUserId">Confirm User ID (승인자)</label>
        <input
          id="confirmUserId"
          v-model.number="requestData.confirm_user_id"
          type="number"
          placeholder="승인자 User ID"
        />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="page">Page</label>
          <input
            id="page"
            v-model.number="requestData.page"
            type="number"
            placeholder="페이지 번호"
            min="1"
          />
        </div>

        <div class="form-group">
          <label for="pageSize">Page Size</label>
          <input
            id="pageSize"
            v-model.number="requestData.page_size"
            type="number"
            placeholder="페이지 크기"
            min="1"
            max="10000"
          />
        </div>
      </div>

      <div class="button-group">
        <button @click="sendRequest" :disabled="loading" class="btn-primary">
          {{ loading ? 'Loading...' : 'Export Tasks' }}
        </button>
        <button @click="clearForm" class="btn-secondary">Clear</button>
        <button @click="loadExample" class="btn-secondary">Load Example</button>
      </div>
    </div>

    <!-- Request Body Display -->
    <div class="code-section" v-if="requestBody">
      <h3>Request Body (JSON)</h3>
      <pre><code>{{ requestBody }}</code></pre>
    </div>

    <!-- Response Display -->
    <div class="response-section" v-if="response">
      <h2>Response</h2>

      <div class="response-summary">
        <div class="summary-item">
          <span class="label">Status:</span>
          <span :class="['status', response.success ? 'success' : 'error']">
            {{ response.status }}
          </span>
        </div>
        <div class="summary-item" v-if="response.data && response.data.total !== undefined">
          <span class="label">Total Tasks:</span>
          <span class="value">{{ response.data.total }}</span>
        </div>
        <div class="summary-item" v-if="response.data && response.data.tasks">
          <span class="label">Returned:</span>
          <span class="value">{{ response.data.tasks.length }}</span>
        </div>
        <div class="summary-item" v-if="response.data && response.data.page">
          <span class="label">Page:</span>
          <span class="value">{{ response.data.page }} / {{ response.data.total_pages }}</span>
        </div>
      </div>

      <!-- Response JSON -->
      <div class="code-section">
        <h3>Response JSON</h3>
        <button @click="copyResponse" class="btn-copy">Copy</button>
        <pre><code>{{ formatJson(response.data || response.error) }}</code></pre>
      </div>

      <!-- Tasks Table -->
      <div class="tasks-table" v-if="response.success && response.data && response.data.tasks && response.data.tasks.length > 0">
        <h3>Tasks ({{ response.data.tasks.length }})</h3>
        <table>
          <thead>
            <tr>
              <th>Task ID</th>
              <th>Data</th>
              <th>Predictions</th>
              <th>Annotations</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="task in response.data.tasks" :key="task.id">
              <td>{{ task.id }}</td>
              <td>
                <div class="cell-content">
                  <div v-if="task.data.text">{{ truncate(task.data.text, 50) }}</div>
                  <div v-if="task.data.source_created_dt" class="meta">
                    📅 {{ task.data.source_created_dt }}
                  </div>
                </div>
              </td>
              <td>
                <div v-if="task.predictions && task.predictions.length > 0">
                  <div v-for="pred in task.predictions" :key="pred.id" class="item">
                    <span class="badge">v{{ pred.model_version || 'N/A' }}</span>
                    <span class="score">{{ (pred.score * 100).toFixed(0) }}%</span>
                  </div>
                </div>
                <span v-else class="empty">-</span>
              </td>
              <td>
                <div v-if="task.annotations && task.annotations.length > 0">
                  <div v-for="anno in task.annotations" :key="anno.id" class="item">
                    <span v-if="anno.completed_by_info" class="user">
                      {{ anno.completed_by_info.username }}
                      <span v-if="anno.completed_by_info.is_superuser" class="badge-admin">Admin</span>
                    </span>
                  </div>
                </div>
                <span v-else class="empty">-</span>
              </td>
              <td>{{ formatDate(task.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- History -->
    <div class="history-section" v-if="history.length > 0">
      <h2>Request History ({{ history.length }})</h2>
      <div class="history-list">
        <div
          v-for="(item, index) in history"
          :key="index"
          class="history-item"
          @click="loadHistory(item)"
        >
          <div class="history-header">
            <span class="history-time">{{ formatTime(item.timestamp) }}</span>
            <span :class="['history-status', item.success ? 'success' : 'error']">
              {{ item.status }}
            </span>
          </div>
          <div class="history-body">
            Project: {{ item.request.project_id }}
            <span v-if="item.request.model_version"> | Model: {{ item.request.model_version }}</span>
            <span v-if="item.request.confirm_user_id"> | User: {{ item.request.confirm_user_id }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue';

export default {
  name: 'ExportAPITest',
  setup() {
    const loading = ref(false);
    const requestData = ref({
      project_id: null,
      search_from: '',
      search_to: '',
      model_version: '',
      confirm_user_id: null,
      page: null,
      page_size: null,
    });
    const response = ref(null);
    const history = ref([]);

    const requestBody = computed(() => {
      const body = {};
      if (requestData.value.project_id) body.project_id = requestData.value.project_id;
      if (requestData.value.search_from) body.search_from = requestData.value.search_from;
      if (requestData.value.search_to) body.search_to = requestData.value.search_to;
      if (requestData.value.model_version) body.model_version = requestData.value.model_version;
      if (requestData.value.confirm_user_id) body.confirm_user_id = requestData.value.confirm_user_id;
      if (requestData.value.page) body.page = requestData.value.page;
      if (requestData.value.page_size) body.page_size = requestData.value.page_size;

      return Object.keys(body).length > 0 ? JSON.stringify(body, null, 2) : null;
    });

    const sendRequest = async () => {
      if (!requestData.value.project_id) {
        alert('Project ID is required!');
        return;
      }

      loading.value = true;
      response.value = null;

      try {
        const body = JSON.parse(requestBody.value);

        const res = await fetch('/api/labelstudio/custom/export', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        console.log('[Export API] Response status:', res.status);
        console.log('[Export API] Response headers:', {
          'content-type': res.headers.get('content-type'),
          'content-length': res.headers.get('content-length')
        });

        // Check if response has content
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error(`Invalid content-type: ${contentType}`);
        }

        const text = await res.text();
        console.log('[Export API] Response body:', text);

        let data;
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.error('[Export API] JSON parse error:', parseError);
          throw new Error(`Failed to parse JSON: ${text.substring(0, 100)}`);
        }

        response.value = {
          success: res.ok,
          status: res.status,
          data: res.ok ? data : null,
          error: res.ok ? null : data,
        };

        // Add to history
        history.value.unshift({
          timestamp: new Date(),
          request: body,
          ...response.value,
        });

        // Keep only last 10
        if (history.value.length > 10) {
          history.value = history.value.slice(0, 10);
        }
      } catch (error) {
        console.error('[Export API] Error:', error);
        response.value = {
          success: false,
          status: 'Network Error',
          error: error.message,
        };
      } finally {
        loading.value = false;
      }
    };

    const clearForm = () => {
      requestData.value = {
        project_id: null,
        search_from: '',
        search_to: '',
        model_version: '',
        confirm_user_id: null,
        page: null,
        page_size: null,
      };
      response.value = null;
    };

    const loadExample = () => {
      requestData.value = {
        project_id: 1,
        search_from: '2025-01-01 00:00:00',
        search_to: '2025-01-31 23:59:59',
        model_version: 'bert-v1',
        confirm_user_id: 8,
        page: null,
        page_size: null,
      };
    };

    const loadHistory = (item) => {
      requestData.value = { ...item.request };
      response.value = {
        success: item.success,
        status: item.status,
        data: item.data,
        error: item.error,
      };
    };

    const formatJson = (obj) => {
      return JSON.stringify(obj, null, 2);
    };

    const copyResponse = () => {
      const text = formatJson(response.value.data || response.value.error);
      navigator.clipboard.writeText(text);
      alert('Copied to clipboard!');
    };

    const formatDate = (dateStr) => {
      return new Date(dateStr).toLocaleString();
    };

    const formatTime = (date) => {
      return date.toLocaleTimeString();
    };

    const truncate = (str, length) => {
      if (!str) return '';
      return str.length > length ? str.substring(0, length) + '...' : str;
    };

    return {
      loading,
      requestData,
      response,
      history,
      requestBody,
      sendRequest,
      clearForm,
      loadExample,
      loadHistory,
      formatJson,
      copyResponse,
      formatDate,
      formatTime,
      truncate,
    };
  },
};
</script>

<style scoped>
.export-api-test {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  color: #2c3e50;
  margin-bottom: 10px;
}

.description {
  color: #7f8c8d;
  margin-bottom: 30px;
}

.form-section {
  background: white;
  padding: 25px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 30px;
}

.form-section h2 {
  margin-top: 0;
  color: #2c3e50;
}

.form-group {
  margin-bottom: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #34495e;
  font-weight: 500;
}

.required {
  color: #e74c3c;
}

.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.button-group {
  display: flex;
  gap: 10px;
  margin-top: 25px;
}

.btn-primary,
.btn-secondary {
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2980b9;
}

.btn-primary:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #ecf0f1;
  color: #2c3e50;
}

.btn-secondary:hover {
  background: #bdc3c7;
}

.code-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 30px;
  position: relative;
}

.code-section h3 {
  margin-top: 0;
  color: #2c3e50;
}

.btn-copy {
  position: absolute;
  top: 20px;
  right: 20px;
  padding: 6px 12px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-copy:hover {
  background: #2980b9;
}

pre {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 0;
}

code {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #2c3e50;
}

.response-section {
  background: white;
  padding: 25px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 30px;
}

.response-section h2 {
  margin-top: 0;
  color: #2c3e50;
}

.response-summary {
  display: flex;
  gap: 30px;
  margin-bottom: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 4px;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.summary-item .label {
  font-weight: 500;
  color: #7f8c8d;
}

.summary-item .value {
  font-weight: 600;
  color: #2c3e50;
}

.status {
  padding: 4px 12px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 13px;
}

.status.success {
  background: #d4edda;
  color: #155724;
}

.status.error {
  background: #f8d7da;
  color: #721c24;
}

.tasks-table {
  margin-top: 30px;
}

.tasks-table h3 {
  margin-bottom: 15px;
  color: #2c3e50;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

thead {
  background: #f8f9fa;
}

th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: #2c3e50;
  border-bottom: 2px solid #dee2e6;
}

td {
  padding: 12px;
  border-bottom: 1px solid #dee2e6;
}

tr:hover {
  background: #f8f9fa;
}

.cell-content {
  max-width: 300px;
}

.meta {
  font-size: 12px;
  color: #7f8c8d;
  margin-top: 4px;
}

.item {
  margin-bottom: 4px;
}

.badge {
  background: #3498db;
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  margin-right: 6px;
}

.badge-admin {
  background: #e74c3c;
  color: white;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 10px;
  margin-left: 4px;
}

.score {
  color: #27ae60;
  font-weight: 500;
}

.user {
  color: #2c3e50;
}

.empty {
  color: #95a5a6;
}

.history-section {
  background: white;
  padding: 25px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.history-section h2 {
  margin-top: 0;
  color: #2c3e50;
}

.history-list {
  display: grid;
  gap: 10px;
}

.history-item {
  padding: 12px 15px;
  background: #f8f9fa;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.history-item:hover {
  background: #e9ecef;
  transform: translateX(4px);
}

.history-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.history-time {
  font-size: 12px;
  color: #7f8c8d;
}

.history-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 8px;
}

.history-status.success {
  background: #d4edda;
  color: #155724;
}

.history-status.error {
  background: #f8d7da;
  color: #721c24;
}

.history-body {
  font-size: 13px;
  color: #2c3e50;
}
</style>
