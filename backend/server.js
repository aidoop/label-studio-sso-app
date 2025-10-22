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

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Label Studio SSO Backend                                  ║
╠════════════════════════════════════════════════════════════╣
║  Server:           http://localhost:${PORT}                ║
║  Label Studio:     ${LABEL_STUDIO_URL}                     ║
║                                                            ║
║  Endpoints:                                                ║
║    GET  /api/sso/token    - Issue JWT token (SSO setup)    ║
║    GET  /api/projects     - Get project list               ║
║    GET  /api/health       - Health check                   ║
║    GET  /api/cookies      - View cookies (debug)           ║
╚════════════════════════════════════════════════════════════╝
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
