<!--
  Label Studio Wrapper 컴포넌트

  iframe을 통해 Label Studio를 임베드하고 JWT 쿠키 기반 SSO 인증을 처리합니다.
-->

<template>
  <div class="label-studio-wrapper">
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <span>Loading Label Studio...</span>
    </div>

    <div v-else-if="error" class="error">
      <span class="error-icon">⚠️</span>
      <div>{{ error }}</div>
      <button class="retry-button" @click="initialize">
        <span class="icon">🔄</span>
        Retry
      </button>
    </div>

    <div v-else class="container">
      <div class="iframe-container">
        <iframe
          :key="props.email"
          :src="iframeUrl"
          @load="handleIframeLoad"
          @error="handleIframeError"
          frameborder="0"
          allowfullscreen
        ></iframe>
      </div>

      <div class="fab-container">
        <button class="fab-button" @click="handleReload" title="Reload">
          <span class="icon">🔄</span>
        </button>
        <button class="fab-button" @click="handleFullscreen" title="Fullscreen">
          <span class="icon">⛶</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

interface Props {
  projectId: number;
  email: string;
}

const props = defineProps<Props>();

const loading = ref(true);
const error = ref<string | null>(null);
const iframeUrl = ref("");
const iframeLoaded = ref(false);

const BACKEND_URL = "http://nubison.localhost:3001";
const LABEL_STUDIO_URL = "http://label.nubison.localhost:8080";

async function initialize() {
  try {
    loading.value = true;
    error.value = null;

    console.log("[Label Studio Wrapper] Setting up SSO token...");

    const ssoResponse = await fetch(
      `${BACKEND_URL}/api/sso/token?email=${encodeURIComponent(props.email)}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    if (!ssoResponse.ok) {
      const errorData = await ssoResponse.json().catch(() => ({}));
      throw new Error(
        errorData.message || `SSO setup failed: ${ssoResponse.status}`
      );
    }

    const ssoData = await ssoResponse.json();
    console.log("[Label Studio Wrapper] SSO setup complete:", ssoData.message);

    const params = new URLSearchParams();
    params.set("hideHeader", "true");
    params.set("_t", Date.now().toString());

    iframeUrl.value = `${LABEL_STUDIO_URL}/projects/${
      props.projectId
    }?${params.toString()}`;

    console.log("[Label Studio Wrapper] iframe URL:", iframeUrl.value);

    setTimeout(() => {
      if (!iframeLoaded.value && !error.value && !loading.value) {
        error.value =
          "Failed to load Label Studio. The server may be unavailable.";
      }
    }, 15000);
  } catch (err: any) {
    console.error("[Label Studio Wrapper] Initialization failed:", err);
    error.value = `Failed to initialize: ${err.message}`;
    loading.value = false;
  } finally {
    loading.value = false;
  }
}

function handleIframeLoad() {
  console.log("[Label Studio Wrapper] iframe loaded successfully");
  iframeLoaded.value = true;
  loading.value = false;
}

function handleIframeError() {
  console.error("[Label Studio Wrapper] iframe failed to load");
  error.value =
    "Failed to load Label Studio iframe. Please check the server connection.";
  loading.value = false;
}

function handleReload() {
  const iframe = document.querySelector("iframe");
  if (iframe && iframeUrl.value) {
    iframe.src = iframeUrl.value;
  }
}

function handleFullscreen() {
  const iframe = document.querySelector("iframe");
  if (iframe && iframe.requestFullscreen) {
    iframe.requestFullscreen();
  }
}

onMounted(() => {
  initialize();
});
</script>

<style scoped>
.label-studio-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

/* Loading State */
.loading {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  gap: 16px;
  font-size: 18px;
  color: #666;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* Error State */
.error {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #e74c3c;
  gap: 16px;
}

.error-icon {
  font-size: 48px;
}

.retry-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.2s;
}

.retry-button:hover {
  background-color: #2980b9;
}

/* Main Container */
.container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.iframe-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

iframe {
  width: 100%;
  height: 100%;
  border: none;
}

/* Floating Action Buttons */
.fab-container {
  position: absolute;
  bottom: 24px;
  left: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 1000;
}

.fab-button {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background-color: #3498db;
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;
}

.fab-button:hover {
  background-color: #2980b9;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  transform: translateY(-2px);
}

.icon {
  font-size: 24px;
  line-height: 1;
}
</style>
