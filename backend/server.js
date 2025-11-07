import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();
const PORT = 3001;

// Label Studio 설정 (환경변수로 관리 권장)
const LABEL_STUDIO_URL = process.env.LABEL_STUDIO_URL || "http://label.nubison.localhost:8080";
const LABEL_STUDIO_API_TOKEN = process.env.LABEL_STUDIO_API_TOKEN || "YOUR_API_TOKEN_HERE"; // Label Studio의 API Token

// 환경변수 로드 확인 (디버깅용)
console.log(`[Config] LABEL_STUDIO_URL: ${LABEL_STUDIO_URL}`);
console.log(`[Config] LABEL_STUDIO_API_TOKEN: ${LABEL_STUDIO_API_TOKEN ? LABEL_STUDIO_API_TOKEN.substring(0, 10) + '...' : 'NOT SET'}`);

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
 *
 * label-studio-sso v6.0.8 Native JWT API 사용:
 * - 사용자 존재 여부를 먼저 검증한 후 JWT 토큰 발급
 * - 422: 사용자가 존재하지 않음 (USER_NOT_FOUND)
 * - 403: 관리자 권한 필요
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
    const errorData = await response.json().catch(() => ({}));
    const errorCode = errorData.error_code || 'UNKNOWN_ERROR';
    const errorMessage = errorData.error || `HTTP ${response.status}`;

    throw new Error(`[${errorCode}] ${errorMessage}`);
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
  res.clearCookie("ls_sessionid", {
    domain: ".nubison.localhost",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
  res.clearCookie("ls_csrftoken", {
    domain: ".nubison.localhost",
    path: "/",
    sameSite: "lax",
  });
}

// ============================================================================
// API Endpoints
// ============================================================================

/**
 * 테스트용: Invalid JWT 토큰 설정
 *
 * 일부러 잘못된 JWT 토큰을 쿠키에 설정하여
 * iframe 환경에서 SSO 전용 로그인 페이지가 제대로 표시되는지 테스트
 */
app.get("/api/sso/invalid-token", async (req, res) => {
  try {
    console.log("[SSO Test] Setting invalid JWT token...");

    // 기존 Django 세션 쿠키 삭제
    clearSessionCookies(res);

    // 일부러 잘못된 JWT 토큰 설정
    const invalidToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid_payload_here.invalid_signature";

    res.cookie("ls_auth_token", invalidToken, {
      domain: ".nubison.localhost",
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 600 * 1000, // 10분
    });

    console.log("[SSO Test] Invalid token set successfully");

    res.json({
      success: true,
      message: "Invalid JWT token set (for testing SSO error page)",
      token: invalidToken.substring(0, 50) + "...",
    });
  } catch (error) {
    console.error("[SSO Test] Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

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

/**
 * Label Studio Custom Export API 프록시 (POST)
 * MLOps 통합을 위한 필터링된 Task Export
 */
app.post("/api/labelstudio/custom/export", async (req, res) => {
  try {
    const body = req.body;

    console.log(`[Label Studio Proxy] POST /api/custom/export/`);
    console.log(`[Label Studio Proxy] Request:`, body);

    const response = await fetch(`${LABEL_STUDIO_URL}/api/custom/export/`, {
      method: "POST",
      headers: {
        Authorization: `Token ${LABEL_STUDIO_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    console.log(`[Label Studio Proxy] Response status: ${response.status}`);
    console.log(`[Label Studio Proxy] Response headers:`, {
      'content-type': response.headers.get('content-type'),
      'content-length': response.headers.get('content-length')
    });

    // Check if response has content
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`Invalid content-type: ${contentType}`);
    }

    const text = await response.text();
    console.log(`[Label Studio Proxy] Response body: ${text}`);

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error(`[Label Studio Proxy] JSON parse error:`, parseError.message);
      throw new Error(`Failed to parse JSON response: ${text.substring(0, 100)}`);
    }

    if (!response.ok) {
      console.error(`[Label Studio Proxy] Error (${response.status}):`, data);
      return res.status(response.status).json(data);
    }

    console.log(`[Label Studio Proxy] Success: Exported ${data.total} tasks`);
    if (data.page) {
      console.log(`[Label Studio Proxy] Page ${data.page}/${data.total_pages}`);
    }

    res.json(data);
  } catch (error) {
    console.error("[Label Studio Proxy] Error:", error.message);
    console.error("[Label Studio Proxy] Error stack:", error.stack);
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

// ============================================================================
// Test Endpoints (사용자 생성 테스트용)
// ============================================================================

/**
 * 신규 사용자 생성 및 SSO 로그인 테스트
 *
 * POST /api/test/create-user
 *
 * 테스트 내용:
 * 1. Label Studio API로 신규 사용자 생성
 * 2. active_organization 자동 설정 확인 (Signal)
 * 3. SSO 토큰 발급 테스트
 * 4. SSO 로그인 테스트
 *
 * Request Body:
 * {
 *   "email": "test@example.com",
 *   "firstName": "Test",
 *   "lastName": "User"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "steps": {
 *     "userCreation": {...},
 *     "userVerification": {...},
 *     "ssoTokenIssue": {...},
 *     "ssoLogin": {...}
 *   },
 *   "summary": {
 *     "userCreated": true,
 *     "hasActiveOrganization": true,  // Signal이 작동하면 true
 *     "ssoTokenIssued": true,
 *     "canLogin": true
 *   }
 * }
 */
app.post("/api/test/create-user", async (req, res) => {
  try {
    const { email, firstName, lastName, isSuperuser } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "email is required",
      });
    }

    console.log(`[Test] Creating new user and testing auto-organization: ${email} (superuser: ${isSuperuser || false})`);

    const result = {
      success: true,
      steps: {},
    };

    // Step 1: Label Studio API로 사용자 생성
    try {
      let createResponse;
      let apiUrl;
      let requestBody;

      if (isSuperuser) {
        // 슈퍼유저 생성 API 사용
        apiUrl = `${LABEL_STUDIO_URL}/api/admin/users/create-superuser`;
        requestBody = {
          email,
          username: email,
          first_name: firstName || "Test",
          last_name: lastName || "User",
          password: `TestPass${Date.now()}!`,
          create_token: true,
          add_to_organization: 1,
        };
      } else {
        // 일반 사용자 생성 API 사용
        apiUrl = `${LABEL_STUDIO_URL}/api/users/`;
        requestBody = {
          email,
          username: email,
          first_name: firstName || "Test",
          last_name: lastName || "User",
          password: `TestPass${Date.now()}!`,
        };
      }

      createResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Token ${LABEL_STUDIO_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const userData = await createResponse.json();

      // 슈퍼유저 API 응답 형식 통일 (success: true, user: {...})
      const normalizedData = isSuperuser ? userData.user : userData;

      result.steps.userCreation = {
        status: createResponse.status,
        success: createResponse.ok,
        data: normalizedData,
        isSuperuser: isSuperuser || false,
      };

      if (!createResponse.ok) {
        result.success = false;
        result.error = "User creation failed";
        return res.json(result);
      }

      console.log(`[Test] User created: ${email} (ID: ${normalizedData.id}, superuser: ${isSuperuser || false})`);
    } catch (error) {
      result.success = false;
      result.steps.userCreation = {
        success: false,
        error: error.message,
      };
      return res.json(result);
    }

    // Step 2: 생성된 사용자 정보 확인 (active_organization 확인)
    try {
      const userResponse = await fetch(`${LABEL_STUDIO_URL}/api/users/?email=${email}`, {
        headers: {
          Authorization: `Token ${LABEL_STUDIO_API_TOKEN}`,
        },
      });

      const users = await userResponse.json();
      const user = users.find((u) => u.email === email);

      result.steps.userVerification = {
        success: true,
        user: {
          id: user?.id,
          email: user?.email,
          active_organization: user?.active_organization,
          active_organization_meta: user?.active_organization_meta,
        },
        hasActiveOrganization: !!user?.active_organization,
        signalWorked: !!user?.active_organization,  // Signal이 작동했는지 확인
      };

      console.log(`[Test] User verification - active_organization: ${user?.active_organization || 'null'}`);
      console.log(`[Test] Signal status: ${user?.active_organization ? 'WORKING ✓' : 'NOT WORKING ✗'}`);
    } catch (error) {
      result.steps.userVerification = {
        success: false,
        error: error.message,
      };
    }

    // Step 3: SSO Token 발급 시도
    try {
      const tokenResponse = await fetch(`${LABEL_STUDIO_URL}/api/sso/token`, {
        method: "POST",
        headers: {
          Authorization: `Token ${LABEL_STUDIO_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const tokenData = await tokenResponse.json();

      result.steps.ssoTokenIssue = {
        status: tokenResponse.status,
        success: tokenResponse.ok,
        data: tokenData,
      };

      console.log(`[Test] SSO token issue - status: ${tokenResponse.status}`);

      // Step 4: 발급된 토큰으로 Label Studio 로그인 시도
      if (tokenResponse.ok && tokenData.token) {
        try {
          // 메인 페이지로 이동 (프로젝트 리스트 표시)
          const loginUrl = `http://nubison.localhost:3000/?user=${encodeURIComponent(email)}`;

          // 실제 로그인은 브라우저에서 수행해야 하므로 URL만 제공
          result.steps.ssoLogin = {
            success: true,
            loginUrl,
            token: tokenData.token,
            message: "Token issued successfully. Click the link to view projects.",
          };

          console.log(`[Test] SSO login URL generated: ${loginUrl}`);
        } catch (error) {
          result.steps.ssoLogin = {
            success: false,
            error: error.message,
          };
        }
      } else {
        result.steps.ssoLogin = {
          success: false,
          message: "Cannot test login - token issue failed",
        };
      }
    } catch (error) {
      result.steps.ssoTokenIssue = {
        success: false,
        error: error.message,
      };
    }

    // 최종 결과 판정
    result.summary = {
      userCreated: result.steps.userCreation?.success || false,
      hasActiveOrganization: result.steps.userVerification?.hasActiveOrganization || false,
      ssoTokenIssued: result.steps.ssoTokenIssue?.success || false,
      canLogin: result.steps.ssoLogin?.success || false,
    };

    res.json(result);
  } catch (error) {
    console.error("[Test] Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * 전체 사용자 목록 조회
 *
 * GET /api/test/users
 */
app.get("/api/test/users", async (req, res) => {
  try {
    // Custom Admin API를 사용하여 is_superuser 정보 포함
    const response = await fetch(`${LABEL_STUDIO_URL}/api/admin/users/list`, {
      headers: {
        Authorization: `Token ${LABEL_STUDIO_API_TOKEN}`,
      },
    });

    const data = await response.json();

    // Custom API 응답 형식 그대로 전달
    res.json({
      success: data.success,
      count: data.count,
      users: data.users.map((u) => ({
        id: u.id,
        email: u.email,
        first_name: u.first_name,
        last_name: u.last_name,
        active_organization: u.active_organization,
        is_superuser: u.is_superuser || false,
      })),
    });
  } catch (error) {
    console.error("[Test] Error fetching users:", error.message);
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
║  Test Endpoints:                                               ║
║    POST /api/test/create-user    - Create user & test Signal  ║
║    GET  /api/test/users          - List test users             ║
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
