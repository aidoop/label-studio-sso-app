<template>
  <div class="test-user-creation">
    <h2>🧪 신규 사용자 생성 테스트</h2>
    <p class="description">
      신규 사용자를 생성하고 active_organization 자동 설정(Signal) 및 SSO 로그인을 테스트합니다.
    </p>

    <!-- 테스트 사용자 생성 폼 -->
    <div class="card">
      <h3>새 테스트 사용자 생성</h3>
      <form @submit.prevent="createTestUser" class="create-form">
        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="newUser.email"
            type="email"
            placeholder="test_user_001@hatiolab.com"
            required
          />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="firstName">First Name</label>
            <input
              id="firstName"
              v-model="newUser.firstName"
              type="text"
              placeholder="Test"
              required
            />
          </div>
          <div class="form-group">
            <label for="lastName">Last Name</label>
            <input
              id="lastName"
              v-model="newUser.lastName"
              type="text"
              placeholder="User"
              required
            />
          </div>
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="newUser.isSuperuser"
              class="checkbox"
            />
            <span>슈퍼유저로 생성 (Admin 권한)</span>
          </label>
        </div>
        <button type="submit" :disabled="loading" class="primary-btn">
          {{ loading ? "생성 중..." : "사용자 생성 + Signal 테스트 + SSO 로그인" }}
        </button>
      </form>
    </div>

    <!-- 테스트 결과 -->
    <div v-if="testResult" class="test-result">
      <h3>테스트 결과</h3>

      <!-- 요약 -->
      <div class="summary">
        <div class="summary-item" :class="{ success: testResult.summary.userCreated }">
          <span class="icon">{{ testResult.summary.userCreated ? '✅' : '❌' }}</span>
          <span>사용자 생성</span>
        </div>
        <div class="summary-item" :class="{ success: testResult.summary.hasActiveOrganization }">
          <span class="icon">{{ testResult.summary.hasActiveOrganization ? '✅' : '❌' }}</span>
          <span>Signal 작동</span>
        </div>
        <div class="summary-item" :class="{ success: testResult.summary.ssoTokenIssued }">
          <span class="icon">{{ testResult.summary.ssoTokenIssued ? '✅' : '❌' }}</span>
          <span>SSO 토큰 발급</span>
        </div>
        <div class="summary-item" :class="{ success: testResult.summary.canLogin }">
          <span class="icon">{{ testResult.summary.canLogin ? '✅' : '❌' }}</span>
          <span>로그인 가능</span>
        </div>
      </div>

      <!-- Step 1: User Creation -->
      <div class="step" v-if="testResult.steps.userCreation">
        <h4>1️⃣ 사용자 생성</h4>
        <div
          class="step-content"
          :class="{
            success: testResult.steps.userCreation.success,
            error: !testResult.steps.userCreation.success
          }"
        >
          <p><strong>Status:</strong> {{ testResult.steps.userCreation.status }}</p>
          <p><strong>Result:</strong> {{ testResult.steps.userCreation.success ? '성공' : '실패' }}</p>
          <details v-if="testResult.steps.userCreation.data">
            <summary>상세 데이터</summary>
            <pre>{{ JSON.stringify(testResult.steps.userCreation.data, null, 2) }}</pre>
          </details>
        </div>
      </div>

      <!-- Step 2: User Verification -->
      <div class="step" v-if="testResult.steps.userVerification">
        <h4>2️⃣ Signal 작동 확인 (active_organization 자동 설정)</h4>
        <div
          class="step-content"
          :class="{
            success: testResult.steps.userVerification.hasActiveOrganization,
            error: !testResult.steps.userVerification.hasActiveOrganization
          }"
        >
          <p>
            <strong>active_organization:</strong>
            {{ testResult.steps.userVerification.user.active_organization || 'null' }}
          </p>
          <p v-if="testResult.steps.userVerification.hasActiveOrganization" class="success-text">
            ✅ Signal이 정상 작동! active_organization이 자동으로 설정되었습니다.
          </p>
          <p v-else class="error-text">
            ❌ Signal이 작동하지 않았습니다. active_organization이 null입니다.
          </p>
          <details>
            <summary>사용자 정보</summary>
            <pre>{{ JSON.stringify(testResult.steps.userVerification.user, null, 2) }}</pre>
          </details>
        </div>
      </div>

      <!-- Step 3: SSO Token Issue -->
      <div class="step" v-if="testResult.steps.ssoTokenIssue">
        <h4>3️⃣ SSO 토큰 발급</h4>
        <div
          class="step-content"
          :class="{
            success: testResult.steps.ssoTokenIssue.success,
            error: !testResult.steps.ssoTokenIssue.success
          }"
        >
          <p><strong>Status:</strong> {{ testResult.steps.ssoTokenIssue.status }}</p>
          <p><strong>Result:</strong> {{ testResult.steps.ssoTokenIssue.success ? '성공' : '실패' }}</p>
          <p v-if="testResult.steps.ssoTokenIssue.success" class="success-text">
            ✅ SSO 토큰이 정상적으로 발급되었습니다!
          </p>
          <details v-if="testResult.steps.ssoTokenIssue.data">
            <summary>토큰 데이터</summary>
            <pre>{{ JSON.stringify(testResult.steps.ssoTokenIssue.data, null, 2) }}</pre>
          </details>
        </div>
      </div>

      <!-- Step 4: SSO Login -->
      <div class="step" v-if="testResult.steps.ssoLogin">
        <h4>4️⃣ SSO 로그인 테스트</h4>
        <div
          class="step-content"
          :class="{
            success: testResult.steps.ssoLogin.success,
            error: !testResult.steps.ssoLogin.success
          }"
        >
          <p><strong>Message:</strong> {{ testResult.steps.ssoLogin.message }}</p>
          <div v-if="testResult.steps.ssoLogin.loginUrl" class="login-test">
            <a
              :href="testResult.steps.ssoLogin.loginUrl"
              class="login-link"
            >
              🔗 프로젝트 리스트로 이동
            </a>
            <p class="hint">링크를 클릭하여 프로젝트 리스트를 확인하세요</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 전체 사용자 목록 -->
    <div class="card">
      <div class="card-header">
        <h3>전체 사용자 목록</h3>
        <button @click="fetchTestUsers" :disabled="loadingUsers" class="refresh-btn">
          {{ loadingUsers ? "로딩 중..." : "🔄 새로고침" }}
        </button>
      </div>

      <div v-if="loadingUsers" class="loading">로딩 중...</div>
      <div v-else-if="testUsers.length === 0" class="no-data">
        사용자가 없습니다
      </div>
      <div v-else class="user-list">
        <div v-for="user in testUsers" :key="user.id" class="user-item">
          <div class="user-info">
            <p class="user-email">{{ user.email }}</p>
            <p class="user-name">{{ user.first_name }} {{ user.last_name }}</p>
          </div>
          <div class="user-status">
            <span
              class="badge"
              :class="{
                success: user.active_organization,
                warning: !user.active_organization
              }"
            >
              {{ user.active_organization || 'No active org' }}
            </span>
            <span v-if="user.is_superuser" class="badge superuser">Superuser</span>
          </div>
          <div class="user-actions">
            <button
              @click="loginAsUser(user.email)"
              :disabled="loggingIn"
              class="login-btn"
            >
              {{ loggingIn ? '로그인 중...' : '🔐 SSO 로그인' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="errorMessage" class="error-banner">
      <p>{{ errorMessage }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const loading = ref(false);
const loadingUsers = ref(false);
const loggingIn = ref(false);
const testResult = ref(null);
const testUsers = ref([]);
const errorMessage = ref('');

const newUser = ref({
  email: '',
  firstName: '',
  lastName: '',
  isSuperuser: false
});

// 테스트 사용자 생성 + SSO 로그인 테스트
async function createTestUser() {
  loading.value = true;
  errorMessage.value = '';
  testResult.value = null;

  try {
    const response = await fetch('/api/test/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: newUser.value.email,
        firstName: newUser.value.firstName,
        lastName: newUser.value.lastName,
        isSuperuser: newUser.value.isSuperuser
      })
    });

    const data = await response.json();

    if (data.success) {
      testResult.value = data;

      // 폼 초기화
      newUser.value = {
        email: '',
        firstName: '',
        lastName: '',
        isSuperuser: false
      };

      // 테스트 사용자 목록 새로고침
      await fetchTestUsers();
    } else {
      errorMessage.value = data.message || '테스트 실패';
    }
  } catch (error) {
    errorMessage.value = `Error: ${error.message}`;
  } finally {
    loading.value = false;
  }
}

// 기존 테스트 사용자 목록 조회
async function fetchTestUsers() {
  loadingUsers.value = true;
  errorMessage.value = '';

  try {
    const response = await fetch('/api/test/users');
    const data = await response.json();

    if (data.success) {
      testUsers.value = data.users;
    } else {
      errorMessage.value = data.message || '사용자 목록 조회 실패';
    }
  } catch (error) {
    errorMessage.value = `Error: ${error.message}`;
  } finally {
    loadingUsers.value = false;
  }
}

// SSO 로그인
async function loginAsUser(email) {
  loggingIn.value = true;
  errorMessage.value = '';

  try {
    const response = await fetch(
      `/api/sso/token?email=${encodeURIComponent(email)}`,
      {
        credentials: 'include'
      }
    );

    const data = await response.json();

    if (data.success) {
      // SSO 성공 - 메인 페이지로 이동하여 프로젝트 리스트 표시 (사용자 정보 전달)
      window.location.href = `/?user=${encodeURIComponent(email)}`;
    } else {
      errorMessage.value = `로그인 실패: ${data.message}`;
    }
  } catch (error) {
    errorMessage.value = `Error: ${error.message}`;
  } finally {
    loggingIn.value = false;
  }
}

onMounted(() => {
  fetchTestUsers();
});
</script>

<style scoped>
.test-user-creation {
  max-width: 1000px;
  margin: 0 auto;
}

h2 {
  color: #333;
  margin-bottom: 8px;
}

.description {
  color: #666;
  margin-bottom: 32px;
}

.card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;
}

.card h3 {
  margin: 0 0 20px 0;
  color: #333;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.card-header h3 {
  margin: 0;
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-weight: 600;
  color: #333;
  font-size: 14px;
}

.form-group input {
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.primary-btn {
  padding: 14px 24px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.primary-btn:hover:not(:disabled) {
  background: #5568d3;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-btn {
  padding: 8px 16px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: #5a6268;
}

.test-result {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;
}

.test-result h3 {
  margin: 0 0 20px 0;
  color: #333;
}

.summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border-radius: 8px;
  background: #f8f9fa;
  border: 2px solid #e0e0e0;
}

.summary-item.success {
  background: #d4edda;
  border-color: #c3e6cb;
}

.summary-item.warning {
  background: #fff3cd;
  border-color: #ffc107;
}

.summary-item .icon {
  font-size: 24px;
}

.summary-item span:last-child {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.step {
  margin-bottom: 24px;
}

.step h4 {
  margin: 0 0 12px 0;
  color: #333;
}

.step-content {
  padding: 16px;
  border-radius: 8px;
  border: 2px solid #e0e0e0;
  background: #f8f9fa;
}

.step-content.success {
  background: #d4edda;
  border-color: #c3e6cb;
}

.step-content.error {
  background: #f8d7da;
  border-color: #f5c6cb;
}

.step-content.warning {
  background: #fff3cd;
  border-color: #ffc107;
}

.step-content p {
  margin: 8px 0;
}

.warning-text {
  color: #856404;
  font-weight: 600;
}

.success-text {
  color: #155724;
  font-weight: 600;
}

details {
  margin-top: 12px;
}

summary {
  cursor: pointer;
  font-weight: 600;
  color: #667eea;
  padding: 8px;
  background: white;
  border-radius: 4px;
}

pre {
  background: #2d2d2d;
  color: #f8f8f2;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
  margin-top: 8px;
}

.login-test {
  margin-top: 16px;
  padding: 16px;
  background: white;
  border-radius: 8px;
}

.login-link {
  display: inline-block;
  padding: 12px 24px;
  background: #667eea;
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.3s;
}

.login-link:hover {
  background: #5568d3;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.hint {
  margin-top: 8px;
  font-size: 14px;
  color: #666;
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-item {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 16px;
  align-items: center;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.user-info {
  flex: 1;
}

.user-email {
  margin: 0 0 4px 0;
  font-weight: 600;
  color: #333;
}

.user-name {
  margin: 0;
  font-size: 14px;
  color: #666;
}

.user-status {
  display: flex;
  gap: 8px;
}

.badge {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.badge.success {
  background: #d4edda;
  color: #155724;
}

.badge.warning {
  background: #fff3cd;
  color: #856404;
}

.badge.superuser {
  background: #667eea;
  color: white;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.login-btn {
  padding: 8px 16px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  white-space: nowrap;
}

.login-btn:hover:not(:disabled) {
  background: #5568d3;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading,
.no-data {
  text-align: center;
  padding: 32px;
  color: #666;
}

.error-banner {
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;
}

.error-banner p {
  margin: 0;
  color: #721c24;
  font-weight: 600;
}
</style>
