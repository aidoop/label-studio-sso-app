#!/usr/bin/env node
/**
 * Custom Export API - Test Data Generator
 *
 * 직접 테스트해볼 수 있도록 충분한 양의 테스트 데이터를 생성합니다.
 *
 * 사용법:
 *   LABEL_STUDIO_API_TOKEN="your_token" node generate-test-data.js
 */

const LABEL_STUDIO_URL = process.env.LABEL_STUDIO_URL || "http://localhost:8080";
const API_TOKEN = process.env.LABEL_STUDIO_API_TOKEN || "2c00d45b8318a11f59e04c7233d729f3f17664e8";

// 설정
const CONFIG = {
  projectTitle: "Manual Test - Custom Export API",
  totalTasks: 100,
  superuserValidTasks: 60,    // 60% valid (superuser, submitted)
  regularUserTasks: 15,        // 15% regular user annotations
  draftTasks: 15,              // 15% draft annotations
  noAnnotationTasks: 10,       // 10% no annotations
};

/**
 * HTTP 요청 헬퍼
 */
async function request(method, path, options = {}) {
  const url = `${LABEL_STUDIO_URL}${path}`;
  const headers = {
    Authorization: `Token ${API_TOKEN}`,
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get("content-type");
  let data = null;

  if (contentType && contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }
  } else {
    data = await response.text();
  }

  return {
    status: response.status,
    data,
    headers: response.headers,
  };
}

/**
 * 날짜 포맷 헬퍼
 */
function formatDateTime(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * 랜덤 날짜 생성 (지난 90일 중 랜덤)
 */
function getRandomDate() {
  const now = Date.now();
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
  const randomTime = ninetyDaysAgo + Math.random() * (now - ninetyDaysAgo);
  return new Date(randomTime);
}

/**
 * 랜덤 감정 선택
 */
function getRandomSentiment() {
  const sentiments = ["Positive", "Negative", "Neutral"];
  return sentiments[Math.floor(Math.random() * sentiments.length)];
}

/**
 * 샘플 텍스트 생성
 */
const sampleTexts = [
  "This product is absolutely amazing! Highly recommended.",
  "Not satisfied with the quality. Very disappointed.",
  "It's okay, nothing special but does the job.",
  "Exceeded my expectations! Will buy again.",
  "Terrible experience. Would not recommend to anyone.",
  "Average product for the price. Could be better.",
  "Outstanding service and great quality!",
  "Complete waste of money. Very poor quality.",
  "Decent product, meets basic expectations.",
  "Incredible value! Best purchase this year.",
  "이 제품은 정말 훌륭합니다! 강력 추천합니다.",
  "품질에 만족하지 못했습니다. 매우 실망스럽습니다.",
  "괜찮습니다. 특별한 것은 없지만 제 역할은 합니다.",
  "기대 이상입니다! 다시 구매할 것입니다.",
  "끔찍한 경험이었습니다. 누구에게도 추천하지 않습니다.",
  "这个产品非常好！强烈推荐。",
  "対品質に満足していません。非常に失望しました。",
  "Great product with emoji support! 😀🎉💯",
  "Special characters test: <script>alert('test')</script>",
  "Unicode test: ñ, é, ü, ö, ø, å",
];

function getRandomText() {
  return sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
}

/**
 * 모델 버전 목록
 */
const modelVersions = [
  "bert-v1",
  "bert-v2",
  "gpt-v1",
  "gpt-v2",
  "xlnet-v1",
  "roberta-v1",
  null, // no model version
];

function getRandomModelVersion() {
  return modelVersions[Math.floor(Math.random() * modelVersions.length)];
}

/**
 * Main 실행
 */
async function main() {
  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║  Custom Export API - Test Data Generator                    ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  console.log(`📊 Configuration:`);
  console.log(`  - Total Tasks: ${CONFIG.totalTasks}`);
  console.log(`  - Valid Tasks (Superuser): ${CONFIG.superuserValidTasks}`);
  console.log(`  - Regular User Tasks: ${CONFIG.regularUserTasks}`);
  console.log(`  - Draft Tasks: ${CONFIG.draftTasks}`);
  console.log(`  - No Annotation Tasks: ${CONFIG.noAnnotationTasks}\n`);

  // 1. 프로젝트 생성
  console.log("→ Creating test project...");
  const projectRes = await request("POST", "/api/projects", {
    body: {
      title: CONFIG.projectTitle,
      description: "Manual testing for Custom Export API with 100 tasks",
      label_config: `<View>
  <Text name="text" value="$text"/>
  <Choices name="sentiment" toName="text" choice="single">
    <Choice value="Positive"/>
    <Choice value="Negative"/>
    <Choice value="Neutral"/>
  </Choices>
</View>`,
    },
  });

  if (projectRes.status !== 201) {
    console.error("❌ Failed to create project:", projectRes.data);
    process.exit(1);
  }

  const projectId = projectRes.data.id;
  console.log(`  ✓ Created project ID: ${projectId}`);

  // 2. 사용자 생성
  console.log("\n→ Setting up users...");

  const superuserId = 1; // 기본 superuser
  console.log(`  ✓ Using existing superuser ID: ${superuserId}`);

  // 일반 사용자 생성
  const regularUserRes = await request("POST", "/api/admin/users/create-superuser", {
    body: {
      email: `test_regular_manual_${Date.now()}@test.io`,
      first_name: "Regular",
      last_name: "User",
      password: "TestPassword123!",
    },
  });

  let regularUserId = null;
  if (regularUserRes.status === 201) {
    regularUserId = regularUserRes.data.user.id;
    // Demote to regular user
    await request("POST", `/api/admin/users/${regularUserId}/demote-from-superuser`);
    console.log(`  ✓ Created regular user ID: ${regularUserId}`);
  }

  // 3. Tasks 생성
  console.log(`\n→ Creating ${CONFIG.totalTasks} tasks...`);
  const taskIds = [];

  // 모든 task를 한 번에 import
  const tasksToImport = [];
  for (let i = 0; i < CONFIG.totalTasks; i++) {
    tasksToImport.push({
      data: {
        text: getRandomText(),
      },
    });
  }

  const importRes = await request("POST", `/api/projects/${projectId}/import`, {
    body: tasksToImport,
  });

  if (importRes.status === 201) {
    console.log(`  ✓ Imported ${importRes.data.task_count} tasks`);

    // 모든 task ID 가져오기
    const tasksRes = await request("GET", `/api/projects/${projectId}/tasks?page=1&page_size=${CONFIG.totalTasks}`);
    if (tasksRes.data && Array.isArray(tasksRes.data)) {
      tasksRes.data.forEach(task => taskIds.push(task.id));
    }
  }

  console.log(`  ✓ Retrieved ${taskIds.length} task IDs                    `);

  // 4. Annotations 생성
  console.log("\n→ Creating annotations...");

  let annotationCount = 0;
  const now = Date.now();

  // 4.1 Superuser Valid Annotations (60개)
  console.log("  → Creating valid superuser annotations...");
  for (let i = 0; i < CONFIG.superuserValidTasks && i < taskIds.length; i++) {
    const taskId = taskIds[i];
    const randomDate = getRandomDate();

    // Create annotation
    const annotationRes = await request("POST", `/api/tasks/${taskId}/annotations/`, {
      body: {
        task: taskId,
        result: [
          {
            value: {
              choices: [getRandomSentiment()],
            },
            from_name: "sentiment",
            to_name: "text",
            type: "choices",
          },
        ],
        was_cancelled: false,
        lead_time: Math.random() * 30 + 10,
        completed_by: superuserId,
      },
    });

    if (annotationRes.status === 201) {
      annotationCount++;

      // 일부 task에 prediction 추가 (70%)
      if (Math.random() < 0.7) {
        const modelVersion = getRandomModelVersion();
        if (modelVersion) {
          await request("POST", `/api/tasks/${taskId}/predictions/`, {
            body: {
              task: taskId,
              result: [
                {
                  value: {
                    choices: [getRandomSentiment()],
                  },
                  from_name: "sentiment",
                  to_name: "text",
                  type: "choices",
                },
              ],
              score: Math.random(),
              model_version: modelVersion,
            },
          });
        }
      }

      // 일부 task에 여러 predictions 추가 (20%)
      if (Math.random() < 0.2) {
        const additionalModel = getRandomModelVersion();
        if (additionalModel) {
          await request("POST", `/api/tasks/${taskId}/predictions/`, {
            body: {
              task: taskId,
              result: [
                {
                  value: {
                    choices: [getRandomSentiment()],
                  },
                  from_name: "sentiment",
                  to_name: "text",
                  type: "choices",
                },
              ],
              score: Math.random(),
              model_version: additionalModel,
            },
          });
        }
      }
    }

    if ((i + 1) % 10 === 0) {
      process.stdout.write(`    Progress: ${i + 1}/${CONFIG.superuserValidTasks}\r`);
    }
  }
  console.log(`    ✓ Created ${CONFIG.superuserValidTasks} valid annotations           `);

  // 4.2 Regular User Annotations (15개)
  if (regularUserId) {
    console.log("  → Creating regular user annotations (will be excluded)...");
    for (let i = CONFIG.superuserValidTasks; i < CONFIG.superuserValidTasks + CONFIG.regularUserTasks && i < taskIds.length; i++) {
      const taskId = taskIds[i];

      // Note: Cannot create as regular user via API, so we'll just skip
      // In real scenario, these would be created by regular users
      // For testing, we can verify via confirm_user_id filter
    }
    console.log(`    ⊘ Skipped ${CONFIG.regularUserTasks} (API limitation - test via confirm_user_id filter)`);
  }

  // 4.3 Draft Annotations (15개)
  console.log("  → Creating draft annotations (will be excluded)...");
  const draftStart = CONFIG.superuserValidTasks + CONFIG.regularUserTasks;
  for (let i = draftStart; i < draftStart + CONFIG.draftTasks && i < taskIds.length; i++) {
    const taskId = taskIds[i];

    const draftRes = await request("POST", `/api/tasks/${taskId}/annotations/`, {
      body: {
        task: taskId,
        result: [
          {
            value: {
              choices: [getRandomSentiment()],
            },
            from_name: "sentiment",
            to_name: "text",
            type: "choices",
          },
        ],
        was_cancelled: true, // Draft!
        lead_time: Math.random() * 30 + 10,
        completed_by: superuserId,
      },
    });

    if (draftRes.status === 201) {
      annotationCount++;
    }

    if ((i - draftStart + 1) % 5 === 0) {
      process.stdout.write(`    Progress: ${i - draftStart + 1}/${CONFIG.draftTasks}\r`);
    }
  }
  console.log(`    ✓ Created ${CONFIG.draftTasks} draft annotations                 `);

  // 4.4 No Annotation Tasks (10개)
  console.log("  → Leaving tasks without annotations (will be excluded)...");
  console.log(`    ✓ ${CONFIG.noAnnotationTasks} tasks left without annotations`);

  console.log(`\n  ✓ Total annotations created: ${annotationCount}`);

  // 5. 결과 요약
  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║  Test Data Generation Complete                               ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  console.log("📊 Summary:");
  console.log(`  - Project ID: ${projectId}`);
  console.log(`  - Project Title: ${CONFIG.projectTitle}`);
  console.log(`  - Total Tasks: ${taskIds.length}`);
  console.log(`  - Total Annotations: ${annotationCount}`);
  console.log(`  - Expected API Result: ${CONFIG.superuserValidTasks} tasks (valid only)\n`);

  console.log("🧪 Test API Commands:\n");

  console.log("1. Count valid tasks:");
  console.log(`   curl -X POST ${LABEL_STUDIO_URL}/api/custom/export/ \\`);
  console.log(`     -H "Authorization: Token ${API_TOKEN}" \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"project_id": ${projectId}, "response_type": "count"}'\n`);

  console.log("2. Get first 10 valid tasks:");
  console.log(`   curl -X POST ${LABEL_STUDIO_URL}/api/custom/export/ \\`);
  console.log(`     -H "Authorization: Token ${API_TOKEN}" \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"project_id": ${projectId}, "response_type": "data", "page": 1, "page_size": 10}'\n`);

  console.log("3. Filter by model version:");
  console.log(`   curl -X POST ${LABEL_STUDIO_URL}/api/custom/export/ \\`);
  console.log(`     -H "Authorization: Token ${API_TOKEN}" \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"project_id": ${projectId}, "response_type": "count", "model_version": "bert-v1"}'\n`);

  console.log("4. Filter by date range (last 30 days):");
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  console.log(`   curl -X POST ${LABEL_STUDIO_URL}/api/custom/export/ \\`);
  console.log(`     -H "Authorization: Token ${API_TOKEN}" \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"project_id": ${projectId}, "response_type": "count", "search_from": "${formatDateTime(thirtyDaysAgo)}"}'\n`);

  console.log("5. Combined filters:");
  console.log(`   curl -X POST ${LABEL_STUDIO_URL}/api/custom/export/ \\`);
  console.log(`     -H "Authorization: Token ${API_TOKEN}" \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"project_id": ${projectId}, "model_version": "bert-v2", "page": 1, "page_size": 20}'\n`);

  console.log("📝 Notes:");
  console.log(`  - Regular user annotations cannot be created via API (authentication limitation)`);
  console.log(`  - Test regular user exclusion using: {"confirm_user_id": ${regularUserId || 'N/A'}}`);
  console.log(`  - Draft annotations are marked with was_cancelled=true`);
  console.log(`  - Approximately 70% of valid tasks have predictions`);
  console.log(`  - Some tasks have multiple predictions from different models\n`);

  console.log(`✅ Data generation completed successfully!`);
  console.log(`   You can now manually test the Custom Export API.\n`);
}

// 실행
main().catch((error) => {
  console.error("\n❌ Error:", error);
  process.exit(1);
});
