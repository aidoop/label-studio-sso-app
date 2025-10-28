import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();
const PORT = 3001;

// Label Studio 설정 (환경변수로 관리 권장)
const LABEL_STUDIO_URL = process.env.LABEL_STUDIO_URL || "http://label.nubison.localhost:8080";
const LABEL_STUDIO_API_TOKEN = process.env.LABEL_STUDIO_API_TOKEN || "YOUR_API_TOKEN_HERE"; // Label Studio의 API Token

app.use(
  cors({
    origin: "http://nubison.localhost:3000",
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// Webhook Event Store
// ============================================================================

// In-memory store for webhook events (최근 100개)
const webhookEvents = [];
const MAX_EVENTS = 100;

// SSE 클라이언트 목록
const sseClients = [];

/**
 * Webhook 이벤트 저장 및 브로드캐스트
 */
function addWebhookEvent(event) {
  // 타임스탬프 추가
  const eventWithTimestamp = {
    ...event,
    receivedAt: new Date().toISOString(),
    id: Date.now(),
  };

  // 이벤트 저장 (최대 100개 유지)
  webhookEvents.unshift(eventWithTimestamp);
  if (webhookEvents.length > MAX_EVENTS) {
    webhookEvents.pop();
  }

  // SSE 클라이언트들에게 브로드캐스트
  broadcastToSSEClients(eventWithTimestamp);

  return eventWithTimestamp;
}

/**
 * SSE 클라이언트들에게 이벤트 브로드캐스트
 */
function broadcastToSSEClients(event) {
  const data = JSON.stringify(event);
  sseClients.forEach((client) => {
    client.write(`data: ${data}\n\n`);
  });
  console.log(`[Webhook] Broadcasted to ${sseClients.length} SSE clients`);
}

/**
 * Webhook 통계 계산
 */
function getWebhookStats() {
  const stats = {
    total: webhookEvents.length,
    byAction: {},
    bySuperuser: { superuser: 0, regular: 0 },
    byUser: {},
  };

  webhookEvents.forEach((event) => {
    // Action별 카운트
    const action = event.action || "UNKNOWN";
    stats.byAction[action] = (stats.byAction[action] || 0) + 1;

    // Superuser 여부
    const userInfo = event.annotation?.completed_by_info;
    if (userInfo) {
      if (userInfo.is_superuser) {
        stats.bySuperuser.superuser++;
      } else {
        stats.bySuperuser.regular++;
      }

      // 사용자별 카운트
      const email = userInfo.email || "unknown";
      stats.byUser[email] = (stats.byUser[email] || 0) + 1;
    }
  });

  return stats;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Label Studio에서 JWT 토큰 발급
 */
async function issueJWT(email) {
  const response = await fetch(`${LABEL_STUDIO_URL}/api/sso/token`, {
    method: "POST",
    headers: {
      Authorization: `Token ${LABEL_STUDIO_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get SSO token: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

/**
 * JWT 쿠키 설정
 */
function setJWTCookie(res, token, expiresIn) {
  res.cookie("ls_auth_token", token, {
    domain: ".nubison.localhost",
    path: "/",
    httpOnly: false, // 디버깅을 위해 false (프로덕션에서는 true 권장)
    sameSite: "lax",
    maxAge: expiresIn * 1000, // seconds to milliseconds
  });
}

/**
 * Django 세션 쿠키 삭제
 */
function clearSessionCookies(res) {
  res.clearCookie("sessionid", {
    domain: ".nubison.localhost",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
  res.clearCookie("csrftoken", {
    domain: ".nubison.localhost",
    path: "/",
    sameSite: "lax",
  });
}

// ============================================================================
// API Endpoints
// ============================================================================

/**
 * SSO 토큰 발급 엔드포인트
 *
 * Label Studio에서 JWT 토큰을 발급받아 쿠키에 설정
 * - Frontend가 사용자 로그인 시 이 엔드포인트 호출
 * - JWT → Django Session 전환: Label Studio 접근 시 자동으로 세션 생성
 */
app.get("/api/sso/token", async (req, res) => {
  try {
    console.log("[SSO Token] Issuing JWT token...");

    // Query parameter로 사용자 선택
    const userEmail = req.query.email || "admin@nubison.io";

    // 허용된 사용자만 처리
    const allowedUsers = [
      "admin@nubison.io",
      "annotator@nubison.io",
      "manager@nubison.io"
    ];
    if (!allowedUsers.includes(userEmail)) {
      return res.status(403).json({
        success: false,
        message: `User ${userEmail} is not authorized`,
      });
    }

    console.log(`[SSO Token] User: ${userEmail}`);

    // Label Studio에서 JWT 토큰 발급
    console.log(`[SSO Token] Requesting token from Label Studio...`);
    const tokenData = await issueJWT(userEmail);
    console.log(`[SSO Token] Token received, expires in ${tokenData.expires_in}s`);

    // 기존 Django 세션 쿠키 삭제
    clearSessionCookies(res);

    // JWT 토큰 쿠키 설정
    setJWTCookie(res, tokenData.token, tokenData.expires_in);

    console.log("[SSO Token] JWT token set successfully");

    res.json({
      success: true,
      message: "SSO token issued",
      user: userEmail,
      expiresIn: tokenData.expires_in,
    });
  } catch (error) {
    console.error("[SSO Token] Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Health check
 */
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    labelStudioUrl: LABEL_STUDIO_URL,
  });
});

/**
 * 쿠키 확인 엔드포인트 (디버깅용)
 */
app.get("/api/cookies", (req, res) => {
  res.json({
    cookies: req.cookies,
  });
});

/**
 * Label Studio 프로젝트 리스트 조회
 *
 * Label Studio API Token을 사용하여 프로젝트 목록을 가져옵니다.
 */
app.get("/api/projects", async (req, res) => {
  try {
    console.log("[Projects] Fetching projects from Label Studio...");

    // Label Studio API 호출 (API Token 사용)
    const response = await fetch(`${LABEL_STUDIO_URL}/api/projects/`, {
      method: "GET",
      headers: {
        Authorization: `Token ${LABEL_STUDIO_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Projects] Label Studio error:", errorText);
      throw new Error(`Failed to fetch projects: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[Projects] Found ${data.results?.length || 0} projects`);

    res.json({
      success: true,
      projects: data.results || [],
    });
  } catch (error) {
    console.error("[Projects] Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ============================================================================
// Label Studio API Proxy (for testing custom features)
// ============================================================================

/**
 * Label Studio Projects API 프록시 (GET)
 * 프론트엔드에서 프로젝트 목록 조회
 */
app.get("/api/labelstudio/projects", async (req, res) => {
  try {
    console.log("[Label Studio Proxy] GET /api/projects/");

    const response = await fetch(`${LABEL_STUDIO_URL}/api/projects/`, {
      method: "GET",
      headers: {
        Authorization: `Token ${LABEL_STUDIO_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Label Studio Proxy] Error:", data);
      return res.status(response.status).json(data);
    }

    console.log(`[Label Studio Proxy] Success: ${data.results?.length || 0} projects`);
    res.json(data);
  } catch (error) {
    console.error("[Label Studio Proxy] Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Label Studio Project 수정 API 프록시 (PATCH)
 * model_version 필드 업데이트 테스트용
 */
app.patch("/api/labelstudio/projects/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    const body = req.body;

    console.log(`[Label Studio Proxy] PATCH /api/projects/${projectId}/`);
    console.log(`[Label Studio Proxy] Body:`, body);

    const response = await fetch(`${LABEL_STUDIO_URL}/api/projects/${projectId}/`, {
      method: "PATCH",
      headers: {
        Authorization: `Token ${LABEL_STUDIO_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[Label Studio Proxy] Error (${response.status}):`, data);
      return res.status(response.status).json(data);
    }

    console.log(`[Label Studio Proxy] Success: Project ${projectId} updated`);
    if (body.model_version) {
      console.log(`[Label Studio Proxy] ✅ model_version updated: ${body.model_version}`);
    }

    res.json(data);
  } catch (error) {
    console.error("[Label Studio Proxy] Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ============================================================================
// Webhook Endpoints
// ============================================================================

/**
 * Webhook 이벤트 수신
 *
 * Label Studio에서 전송하는 annotation 이벤트를 수신합니다.
 * completed_by_info 필드를 파싱하여 사용자 정보를 확인할 수 있습니다.
 */
app.post("/api/webhooks/annotation", (req, res) => {
  try {
    const payload = req.body;
    console.log("\n" + "=".repeat(60));
    console.log("[Webhook] Received annotation event");
    console.log("=".repeat(60));
    console.log(`Action: ${payload.action}`);

    // completed_by_info 파싱
    const userInfo = payload.annotation?.completed_by_info;
    if (userInfo) {
      console.log("User Info:");
      console.log(`  - Email: ${userInfo.email}`);
      console.log(`  - Username: ${userInfo.username}`);
      console.log(`  - Is Superuser: ${userInfo.is_superuser}`);

      // Superuser만 처리 (MLOps 시나리오)
      if (userInfo.is_superuser) {
        console.log("  ✅ PROCESSED: Superuser annotation (used for model performance)");
      } else {
        console.log("  ⚠️  SKIPPED: Regular user annotation (not used for model performance)");
      }
    } else {
      console.log("⚠️  Warning: completed_by_info not found in payload");
      console.log(`   completed_by ID: ${payload.annotation?.completed_by}`);
    }

    // Annotation 정보
    if (payload.annotation) {
      console.log(`Annotation ID: ${payload.annotation.id}`);
      console.log(`Task ID: ${payload.annotation.task}`);
    }

    console.log("=".repeat(60) + "\n");

    // 이벤트 저장 및 브로드캐스트
    const storedEvent = addWebhookEvent(payload);

    // 응답
    res.json({
      success: true,
      message: "Webhook received",
      eventId: storedEvent.id,
    });
  } catch (error) {
    console.error("[Webhook] Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Webhook 이벤트 조회
 *
 * 저장된 webhook 이벤트 목록을 반환합니다.
 */
app.get("/api/webhooks/events", (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const filter = req.query.filter; // 'all', 'superuser', 'regular'

    let filteredEvents = webhookEvents;

    // 필터 적용
    if (filter === "superuser") {
      filteredEvents = webhookEvents.filter(
        (event) => event.annotation?.completed_by_info?.is_superuser === true
      );
    } else if (filter === "regular") {
      filteredEvents = webhookEvents.filter(
        (event) => event.annotation?.completed_by_info?.is_superuser === false
      );
    }

    // 제한 적용
    const limitedEvents = filteredEvents.slice(0, limit);

    res.json({
      success: true,
      events: limitedEvents,
      total: filteredEvents.length,
      stats: getWebhookStats(),
    });
  } catch (error) {
    console.error("[Webhook Events] Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Webhook 이벤트 실시간 스트림 (Server-Sent Events)
 *
 * 실시간으로 webhook 이벤트를 푸시합니다.
 */
app.get("/api/webhooks/stream", (req, res) => {
  // SSE 헤더 설정
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "http://nubison.localhost:3000");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // 클라이언트 등록
  sseClients.push(res);
  console.log(`[SSE] Client connected. Total clients: ${sseClients.length}`);

  // 초기 연결 메시지
  res.write(`data: ${JSON.stringify({ type: "connected", message: "SSE connected" })}\n\n`);

  // 클라이언트 연결 종료 처리
  req.on("close", () => {
    const index = sseClients.indexOf(res);
    if (index !== -1) {
      sseClients.splice(index, 1);
    }
    console.log(`[SSE] Client disconnected. Total clients: ${sseClients.length}`);
  });
});

/**
 * Webhook 이벤트 통계
 */
app.get("/api/webhooks/stats", (req, res) => {
  try {
    const stats = getWebhookStats();
    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("[Webhook Stats] Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  Label Studio SSO Backend                                      ║
╠════════════════════════════════════════════════════════════════╣
║  Server:           http://localhost:${PORT}                    ║
║  Label Studio:     ${LABEL_STUDIO_URL}                         ║
║                                                                ║
║  SSO Endpoints:                                                ║
║    GET  /api/sso/token           - Issue JWT token             ║
║                                                                ║
║  Project Endpoints:                                            ║
║    GET  /api/projects            - Get project list            ║
║                                                                ║
║  Webhook Endpoints:                                            ║
║    POST /api/webhooks/annotation - Receive webhook events      ║
║    GET  /api/webhooks/events     - Get webhook event list      ║
║    GET  /api/webhooks/stream     - Real-time SSE stream        ║
║    GET  /api/webhooks/stats      - Webhook statistics          ║
║                                                                ║
║  Utility Endpoints:                                            ║
║    GET  /api/health              - Health check                ║
║    GET  /api/cookies             - View cookies (debug)        ║
╚════════════════════════════════════════════════════════════════╝
  `);
});

// Error handler
app.use((err, req, res, next) => {
  console.error("[Error]", err);
  res.status(500).json({
    success: false,
    message: err.message,
  });
});
