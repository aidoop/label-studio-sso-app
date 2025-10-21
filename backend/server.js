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

/**
 * SSO Setup 엔드포인트
 *
 * Label Studio에서 JWT 토큰을 발급받아 쿠키에 설정
 * Query parameter로 사용자 선택 가능
 */
app.get("/api/sso/setup", async (req, res) => {
  try {
    console.log("[SSO Setup] Starting SSO setup...");

    // Query parameter로 사용자 선택
    const userEmail = req.query.email || "admin@nubison.localhost";

    // 허용된 사용자만 처리 (Label Studio에 생성된 모든 사용자)
    const allowedUsers = [
      "admin@nubison.localhost",
      "user1@nubison.localhost",
      "user2@nubison.localhost",
      "annotator@nubison.localhost"
    ];
    if (!allowedUsers.includes(userEmail)) {
      return res.status(403).json({
        success: false,
        message: `User ${userEmail} is not authorized`,
      });
    }

    console.log(`[SSO Setup] User: ${userEmail}`);

    // Label Studio에서 JWT 토큰 발급
    console.log(`[SSO Setup] Requesting token from Label Studio...`);

    const tokenResponse = await fetch(`${LABEL_STUDIO_URL}/api/sso/token`, {
      method: "POST",
      headers: {
        Authorization: `Token ${LABEL_STUDIO_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: userEmail,
        // username: userEmail.split('@')[0], // optional
        // first_name: 'Admin', // optional
        // last_name: 'User' // optional
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[SSO Setup] Label Studio error:", errorText);
      throw new Error(
        `Failed to get SSO token from Label Studio: ${tokenResponse.status}`
      );
    }

    const tokenData = await tokenResponse.json();
    console.log(
      `[SSO Setup] Token received, expires in ${tokenData.expires_in}s`
    );

    // 쿠키 설정 (모든 *.nubison.localhost 서브도메인 공유)
    res.cookie("ls_auth_token", tokenData.token, {
      domain: ".nubison.localhost", // 핵심: 모든 *.nubison.localhost 서브도메인에서 접근 가능
      path: "/",
      httpOnly: false, // 디버깅을 위해 false로 설정 (프로덕션에서는 true 사용)
      sameSite: "lax",
      maxAge: tokenData.expires_in * 1000, // seconds to milliseconds
    });

    console.log("[SSO Setup] Cookie set successfully");

    res.json({
      success: true,
      message: "SSO token setup complete",
      user: userEmail,
      expiresIn: tokenData.expires_in,
    });
  } catch (error) {
    console.error("[SSO Setup] Error:", error.message);
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
║  Label Studio Test Backend                                 ║
╠════════════════════════════════════════════════════════════╣
║  Server:           http://localhost:${PORT}                ║
║  Label Studio:     ${LABEL_STUDIO_URL}                     ║
║                                                            ║
║  Endpoints:                                                ║
║    GET  /api/sso/setup    - Setup SSO authentication       ║
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
