<template>
  <div class="webhook-monitor">
    <div class="monitor-header">
      <h2>🔔 Webhook Event Monitor</h2>
      <div class="connection-status">
        <span :class="['status-dot', connected ? 'connected' : 'disconnected']"></span>
        {{ connected ? 'Connected' : 'Disconnected' }}
      </div>
    </div>

    <!-- Statistics Section -->
    <div class="stats-section">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">Total Events</div>
      </div>
      <div class="stat-card superuser">
        <div class="stat-value">{{ stats.bySuperuser.superuser }}</div>
        <div class="stat-label">Superuser Events</div>
      </div>
      <div class="stat-card regular">
        <div class="stat-value">{{ stats.bySuperuser.regular }}</div>
        <div class="stat-label">Regular User Events</div>
      </div>
    </div>

    <!-- Filter Section -->
    <div class="filter-section">
      <button
        :class="['filter-btn', { active: filter === 'all' }]"
        @click="setFilter('all')"
      >
        All Events
      </button>
      <button
        :class="['filter-btn', { active: filter === 'regular' }]"
        @click="setFilter('regular')"
      >
        Regular Users
      </button>
      <button
        :class="['filter-btn', { active: filter === 'superuser' }]"
        @click="setFilter('superuser')"
      >
        Superuser Only
      </button>
      <button class="clear-btn" @click="clearEvents">
        Clear Events
      </button>
    </div>

    <!-- Events List -->
    <div class="events-section">
      <h3>Recent Events</h3>
      <div v-if="filteredEvents.length === 0" class="no-events">
        <p>No webhook events received yet.</p>
        <p class="hint">
          Create or update annotations in Label Studio to see events here.
        </p>
      </div>
      <div v-else class="events-list">
        <div
          v-for="event in filteredEvents"
          :key="event.id"
          :class="['event-card', getEventClass(event)]"
        >
          <div class="event-header">
            <span :class="['event-badge', getActionClass(event.action)]">
              {{ event.action }}
            </span>
            <span class="event-time">{{ formatTime(event.receivedAt) }}</span>
          </div>

          <div v-if="event.annotation?.completed_by_info" class="event-body">
            <div class="user-info">
              <span class="label">User:</span>
              <span class="value">{{ event.annotation.completed_by_info.email }}</span>
              <span
                v-if="event.annotation.completed_by_info.is_superuser"
                class="badge superuser-badge"
              >
                SUPERUSER
              </span>
              <span v-else class="badge user-badge">USER</span>
            </div>

            <div class="annotation-info">
              <span class="info-item">
                Annotation ID: <strong>{{ event.annotation.id }}</strong>
              </span>
              <span class="info-item">
                Task ID: <strong>{{ event.annotation.task }}</strong>
              </span>
            </div>

            <!-- Superuser 필터링 표시 -->
            <div
              v-if="event.annotation.completed_by_info.is_superuser"
              class="processing-status processed"
            >
              ✅ PROCESSED: Superuser annotation (used for model performance)
            </div>
            <div v-else class="processing-status skipped">
              ⚠️ SKIPPED: Regular user annotation (not used for model performance)
            </div>
          </div>

          <div v-else class="event-body">
            <div class="warning">
              ⚠️ No completed_by_info available
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";

// State
const events = ref([]);
const filter = ref("all");
const connected = ref(false);
const stats = ref({
  total: 0,
  bySuperuser: { superuser: 0, regular: 0 },
  byUser: {},
});

let eventSource = null;

// Computed
const filteredEvents = computed(() => {
  if (filter.value === "all") {
    return events.value;
  } else if (filter.value === "superuser") {
    return events.value.filter(
      (event) => event.annotation?.completed_by_info?.is_superuser === true
    );
  } else if (filter.value === "regular") {
    return events.value.filter(
      (event) => event.annotation?.completed_by_info?.is_superuser === false
    );
  }
  return events.value;
});

// Methods
function setFilter(newFilter) {
  filter.value = newFilter;
}

function clearEvents() {
  events.value = [];
  updateStats();
}

function getEventClass(event) {
  if (event.annotation?.completed_by_info?.is_superuser) {
    return "superuser-event";
  }
  return "regular-event";
}

function getActionClass(action) {
  if (action === "ANNOTATION_CREATED") return "created";
  if (action === "ANNOTATION_UPDATED") return "updated";
  if (action === "ANNOTATIONS_DELETED") return "deleted";
  return "";
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("ko-KR");
}

function updateStats() {
  const newStats = {
    total: events.value.length,
    bySuperuser: { superuser: 0, regular: 0 },
    byUser: {},
  };

  events.value.forEach((event) => {
    const userInfo = event.annotation?.completed_by_info;
    if (userInfo) {
      if (userInfo.is_superuser) {
        newStats.bySuperuser.superuser++;
      } else {
        newStats.bySuperuser.regular++;
      }

      const email = userInfo.email || "unknown";
      newStats.byUser[email] = (newStats.byUser[email] || 0) + 1;
    }
  });

  stats.value = newStats;
}

function connectSSE() {
  console.log("[SSE] Connecting to webhook stream...");

  eventSource = new EventSource("http://nubison.localhost:3001/api/webhooks/stream");

  eventSource.onopen = () => {
    console.log("[SSE] Connected");
    connected.value = true;
  };

  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);

      // 연결 메시지는 무시
      if (data.type === "connected") {
        console.log("[SSE]", data.message);
        return;
      }

      // 이벤트 추가 (최신순)
      console.log("[SSE] Received event:", data);
      events.value.unshift(data);

      // 최대 100개까지만 유지
      if (events.value.length > 100) {
        events.value.pop();
      }

      updateStats();
    } catch (error) {
      console.error("[SSE] Error parsing event:", error);
    }
  };

  eventSource.onerror = (error) => {
    console.error("[SSE] Error:", error);
    connected.value = false;

    // 재연결 시도
    setTimeout(() => {
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log("[SSE] Reconnecting...");
        connectSSE();
      }
    }, 3000);
  };
}

async function loadInitialEvents() {
  try {
    const response = await fetch("http://nubison.localhost:3001/api/webhooks/events");
    const data = await response.json();

    if (data.success) {
      events.value = data.events;
      stats.value = data.stats;
    }
  } catch (error) {
    console.error("[Webhook] Error loading initial events:", error);
  }
}

// Lifecycle
onMounted(() => {
  loadInitialEvents();
  connectSSE();
});

onUnmounted(() => {
  if (eventSource) {
    eventSource.close();
  }
});
</script>

<style scoped>
.webhook-monitor {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.monitor-header h2 {
  margin: 0;
  color: #2c3e50;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #f8f9fa;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-dot.connected {
  background-color: #28a745;
}

.status-dot.disconnected {
  background-color: #dc3545;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Statistics Section */
.stats-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 24px;
  border-radius: 12px;
  color: white;
  text-align: center;
}

.stat-card.superuser {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-card.regular {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-value {
  font-size: 36px;
  font-weight: bold;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
}

/* Filter Section */
.filter-section {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.filter-btn, .clear-btn {
  padding: 10px 20px;
  border: 2px solid #dee2e6;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.filter-btn:hover {
  background: #f8f9fa;
}

.filter-btn.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.clear-btn {
  margin-left: auto;
  background: #f8f9fa;
  color: #495057;
}

.clear-btn:hover {
  background: #e9ecef;
}

/* Events Section */
.events-section h3 {
  margin-bottom: 16px;
  color: #2c3e50;
}

.no-events {
  text-align: center;
  padding: 60px 20px;
  background: #f8f9fa;
  border-radius: 12px;
  color: #6c757d;
}

.no-events .hint {
  font-size: 14px;
  margin-top: 8px;
}

.events-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.event-card {
  background: white;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s;
}

.event-card:hover {
  border-color: #007bff;
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.1);
}

.event-card.superuser-event {
  border-left: 4px solid #f5576c;
}

.event-card.regular-event {
  border-left: 4px solid #00f2fe;
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.event-badge {
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.event-badge.created {
  background: #d4edda;
  color: #155724;
}

.event-badge.updated {
  background: #fff3cd;
  color: #856404;
}

.event-badge.deleted {
  background: #f8d7da;
  color: #721c24;
}

.event-time {
  font-size: 13px;
  color: #6c757d;
}

.event-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.user-info .label {
  color: #6c757d;
}

.user-info .value {
  font-weight: 600;
  color: #2c3e50;
}

.badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.superuser-badge {
  background: #fff0f0;
  color: #dc3545;
}

.user-badge {
  background: #e7f5ff;
  color: #0056b3;
}

.annotation-info {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #495057;
}

.processing-status {
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
}

.processing-status.processed {
  background: #d4edda;
  color: #155724;
}

.processing-status.skipped {
  background: #fff3cd;
  color: #856404;
}

.warning {
  padding: 8px;
  background: #fff3cd;
  color: #856404;
  border-radius: 6px;
  font-size: 13px;
}
</style>
