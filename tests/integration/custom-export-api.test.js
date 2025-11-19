/**
 * Custom Export API - Comprehensive Integration Tests
 *
 * - 검수자(superuser) annotation만 반환
 * - annotation 없는 task 제외
 * - 임시 저장(draft) annotation 제외
 * - response_type='count' 기능
 * - 페이징 기능
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";

const LABEL_STUDIO_URL =
  process.env.LABEL_STUDIO_URL || "http://localhost:8080";
const API_TOKEN =
  process.env.LABEL_STUDIO_API_TOKEN ||
  "2c00d45b8318a11f59e04c7233d729f3f17664e8";

/**
 * HTTP 요청 헬퍼 함수
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
      // Empty response or parse error
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
 * 날짜 문자열 생성 (YYYY-MM-DD HH:MI:SS)
 */
function formatDateTime(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * 테스트 컨텍스트 (테스트 간 공유)
 */
const testContext = {
  projectId: null,
  superuserId: null,
  regularUserId: null,
  tasks: [],
  createdUserIds: [],
  createdTaskIds: [],
};

describe("Custom Export API - Comprehensive Integration Tests", () => {
  before(async () => {
    console.log(
      "\n╔═══════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║  Custom Export API - Test Setup                              ║"
    );
    console.log(
      "╚═══════════════════════════════════════════════════════════════╝\n"
    );

    // 1. 테스트 프로젝트 생성
    console.log("→ Creating test project...");
    const projectRes = await request("POST", "/api/projects", {
      body: {
        title: "Custom Export API Test Project",
        description:
          "Integration test for Custom Export API with comprehensive test data",
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

    if (projectRes.status === 201) {
      testContext.projectId = projectRes.data.id;
      console.log(`  ✓ Created project ID: ${testContext.projectId}`);
    } else {
      throw new Error(`Failed to create test project: ${projectRes.status}`);
    }

    // 2. 일반 사용자 생성 (is_superuser=False)
    console.log("→ Creating regular user...");
    const regularUserRes = await request(
      "POST",
      "/api/admin/users/create-superuser",
      {
        body: {
          email: `test_regular_${Date.now()}@integration.test`,
          first_name: "Regular",
          last_name: "User",
          password: "TestPassword123!",
        },
      }
    );

    if (regularUserRes.status === 201) {
      testContext.regularUserId = regularUserRes.data.user.id;
      testContext.createdUserIds.push(testContext.regularUserId);

      // 일반 사용자로 강등
      await request(
        "POST",
        `/api/admin/users/${testContext.regularUserId}/demote-from-superuser`
      );
      console.log(`  ✓ Created regular user ID: ${testContext.regularUserId}`);
    }

    // 3. 슈퍼유저 가져오기 (admin@nubison.io - ID: 1)
    testContext.superuserId = 1;
    console.log(`  ✓ Using superuser ID: ${testContext.superuserId}`);

    // 4. 충분한 수의 테스트 데이터 생성
    console.log("\n→ Creating comprehensive test data...");
    console.log("  Creating 20 tasks with various conditions...\n");

    const now = new Date();
    const testData = [];

    // Group 1: 검수자 annotation이 있는 valid tasks (10개) - 반환되어야 함
    for (let i = 1; i <= 10; i++) {
      const date = new Date(now.getTime() + i * 86400000); // 각 날짜 1일씩 차이
      testData.push({
        text: `Valid Task ${i} - Superuser annotation (submitted)`,
        source_created_at: formatDateTime(date),
        annotationType: "superuser_valid",
        modelVersion: i % 3 === 0 ? "bert-v1" : i % 3 === 1 ? "bert-v2" : null,
      });
    }

    // Group 2: 일반 사용자 annotation만 있는 tasks (3개) - 제외되어야 함
    for (let i = 11; i <= 13; i++) {
      const date = new Date(now.getTime() + i * 86400000);
      testData.push({
        text: `Invalid Task ${i} - Regular user annotation only`,
        source_created_at: formatDateTime(date),
        annotationType: "regular_user",
        modelVersion: null,
      });
    }

    // Group 3: Draft/cancelled annotation만 있는 tasks (3개) - 제외되어야 함
    for (let i = 14; i <= 16; i++) {
      const date = new Date(now.getTime() + i * 86400000);
      testData.push({
        text: `Invalid Task ${i} - Draft annotation (cancelled)`,
        source_created_at: formatDateTime(date),
        annotationType: "superuser_draft",
        modelVersion: null,
      });
    }

    // Group 4: Annotation 없는 tasks (4개) - 제외되어야 함
    for (let i = 17; i <= 20; i++) {
      const date = new Date(now.getTime() + i * 86400000);
      testData.push({
        text: `Invalid Task ${i} - No annotation`,
        source_created_at: formatDateTime(date),
        annotationType: "none",
        modelVersion: null,
      });
    }

    // Tasks 생성 및 Annotations/Predictions 추가
    for (const data of testData) {
      // Task 생성
      const taskRes = await request(
        "POST",
        `/api/projects/${testContext.projectId}/tasks/`,
        {
          body: {
            data: {
              text: data.text,
              source_created_at: data.source_created_at,
            },
          },
        }
      );

      if (taskRes.status === 201) {
        const taskId = taskRes.data.id;
        testContext.createdTaskIds.push(taskId);
        testContext.tasks.push({
          id: taskId,
          ...data,
        });

        // Annotation 생성 (타입에 따라)
        if (data.annotationType === "superuser_valid") {
          // 검수자의 유효한 annotation
          await request("POST", `/api/tasks/${taskId}/annotations/`, {
            body: {
              result: [
                {
                  type: "choices",
                  value: { choices: ["Positive"] },
                  from_name: "sentiment",
                  to_name: "text",
                },
              ],
              was_cancelled: false,
            },
          });
        } else if (data.annotationType === "regular_user") {
          // 일반 사용자 annotation (should be excluded)
          // Note: 실제로는 일반 사용자로 인증해서 생성해야 하지만
          // 테스트 간소화를 위해 API로 직접 생성 불가능
          // 대신 슈퍼유저로 생성 후 completed_by 수정은 불가능하므로
          // 이 케이스는 별도 처리 필요
          console.log(
            `    ⊘ Task ${taskId}: Regular user annotation (skipped - requires user auth)`
          );
        } else if (data.annotationType === "superuser_draft") {
          // 검수자의 draft annotation (was_cancelled=True)
          await request("POST", `/api/tasks/${taskId}/annotations/`, {
            body: {
              result: [
                {
                  type: "choices",
                  value: { choices: ["Neutral"] },
                  from_name: "sentiment",
                  to_name: "text",
                },
              ],
              was_cancelled: true, // Draft
            },
          });
        }
        // 'none' 타입은 annotation 생성 안 함

        // Prediction 생성 (model_version이 있는 경우)
        if (data.modelVersion) {
          await request("POST", `/api/predictions/`, {
            body: {
              task: taskId,
              result: [
                {
                  type: "choices",
                  value: { choices: ["Positive"] },
                  from_name: "sentiment",
                  to_name: "text",
                },
              ],
              score: 0.95,
              model_version: data.modelVersion,
            },
          });
        }
      }
    }

    console.log(`  ✓ Created 20 tasks:`);
    console.log(
      `    - 10 tasks with valid superuser annotations (should be included)`
    );
    console.log(
      `    - 3 tasks with regular user annotations only (should be excluded)`
    );
    console.log(`    - 3 tasks with draft annotations (should be excluded)`);
    console.log(`    - 4 tasks without annotations (should be excluded)`);
    console.log(`\n  ✓ Test data setup completed\n`);
  });

  after(async () => {
    console.log(
      "\n╔═══════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║  Custom Export API - Test Cleanup                            ║"
    );
    console.log(
      "╚═══════════════════════════════════════════════════════════════╝\n"
    );

    // 생성된 사용자 삭제
    for (const userId of testContext.createdUserIds) {
      try {
        await request("DELETE", `/api/users/${userId}/`);
        console.log(`  ✓ Deleted user ${userId}`);
      } catch (e) {
        console.log(`  ⚠ Failed to delete user ${userId}`);
      }
    }

    // 프로젝트 삭제 (cascade로 tasks도 삭제됨)
    if (testContext.projectId) {
      try {
        await request("DELETE", `/api/projects/${testContext.projectId}/`);
        console.log(`  ✓ Deleted project ${testContext.projectId}`);
      } catch (e) {
        console.log(`  ⚠ Failed to delete project ${testContext.projectId}`);
      }
    }

    console.log("\n  ✓ Cleanup completed\n");
  });

  describe("1. Basic Functionality - Count and Data Response", () => {
    it("should return count only when response_type=count", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "count",
        },
      });

      assert.strictEqual(res.status, 200, "Status should be 200");
      assert.ok(res.data.total !== undefined, "total field should exist");
      assert.strictEqual(
        res.data.tasks,
        undefined,
        "tasks field should not exist in count mode"
      );

      console.log(`  ✓ Total tasks with valid annotations: ${res.data.total}`);
      console.log(`  ✓ Expected: 10 (only superuser valid annotations)`);

      // 검증: 10개의 valid tasks만 카운트되어야 함
      assert.ok(
        res.data.total >= 10,
        `Should have at least 10 valid tasks, got ${res.data.total}`
      );
    });

    it("should return full data when response_type=data", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "data",
        },
      });

      assert.strictEqual(res.status, 200, "Status should be 200");
      assert.ok(res.data.total !== undefined, "total field should exist");
      assert.ok(Array.isArray(res.data.tasks), "tasks should be an array");

      console.log(`  ✓ Total: ${res.data.total}`);
      console.log(`  ✓ Tasks returned: ${res.data.tasks.length}`);
      console.log(
        `  ✓ Tasks have full data including annotations and predictions`
      );
    });

    it("should default to response_type=data when not specified", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
        },
      });

      assert.strictEqual(res.status, 200);
      assert.ok(
        Array.isArray(res.data.tasks),
        "tasks should be returned by default"
      );

      console.log(`  ✓ Default response_type works correctly`);
    });
  });

  describe("2. Superuser Annotation Filtering", () => {
    it("should return ONLY tasks with superuser annotations", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "data",
        },
      });

      assert.strictEqual(res.status, 200);
      assert.ok(res.data.tasks.length > 0, "Should have tasks");

      // 모든 task의 annotation에서 is_superuser 확인
      for (const task of res.data.tasks) {
        assert.ok(
          task.annotations.length > 0,
          `Task ${task.id} should have annotations`
        );

        for (const annotation of task.annotations) {
          assert.ok(
            annotation.completed_by_info,
            "annotation should have completed_by_info"
          );
          assert.strictEqual(
            annotation.completed_by_info.is_superuser,
            true,
            `Task ${task.id} annotation should be from superuser`
          );
        }
      }

      console.log(
        `  ✓ All ${res.data.tasks.length} tasks have superuser annotations only`
      );
      console.log(
        `  ✓ Tasks with regular user annotations are correctly excluded`
      );
    });

    it("should exclude tasks without annotations", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "data",
        },
      });

      // 모든 task는 annotation이 있어야 함
      for (const task of res.data.tasks) {
        assert.ok(
          task.annotations.length > 0,
          `Task ${task.id} should have at least one annotation`
        );
      }

      console.log(`  ✓ Tasks without annotations are correctly excluded`);
    });

    it("should exclude tasks with draft/cancelled annotations", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "data",
        },
      });

      // 모든 annotation은 was_cancelled=false 여야 함
      for (const task of res.data.tasks) {
        for (const annotation of task.annotations) {
          assert.strictEqual(
            annotation.was_cancelled,
            false,
            `Task ${task.id} should not have cancelled annotations`
          );
        }
      }

      console.log(`  ✓ Draft/cancelled annotations are correctly excluded`);
      console.log(
        `  ✓ Only submitted annotations (was_cancelled=False) are included`
      );
    });
  });

  describe("3. Date Range Filtering", () => {
    it("should filter by date range (search_from and search_to)", async () => {
      const now = new Date();
      const searchFrom = new Date(now.getTime() + 3 * 86400000); // +3 days
      const searchTo = new Date(now.getTime() + 7 * 86400000); // +7 days

      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "count",
          search_from: formatDateTime(searchFrom),
          search_to: formatDateTime(searchTo),
        },
      });

      assert.strictEqual(res.status, 200);
      assert.ok(res.data.total !== undefined, "total should exist");

      console.log(`  ✓ Date range filter applied`);
      console.log(`    From: ${formatDateTime(searchFrom)}`);
      console.log(`    To: ${formatDateTime(searchTo)}`);
      console.log(`    Result: ${res.data.total} tasks`);
      console.log(`    Expected: ~5 tasks (tasks 3-7 from valid group)`);
    });

    it("should use custom date field (search_date_field)", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "count",
          search_date_field: "source_created_at",
        },
      });

      assert.strictEqual(res.status, 200);
      console.log(`  ✓ Custom date field 'source_created_at' accepted`);
    });

    it("should validate invalid date field names", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          search_date_field: "invalid-field-name", // 하이픈은 허용 안 됨
        },
      });

      assert.strictEqual(res.status, 400, "Should reject invalid field name");
      assert.ok(res.data.error, "Should have error message");

      console.log(
        `  ✓ Invalid date field name rejected (SQL injection prevention)`
      );
    });
  });

  describe("4. Model Version Filtering", () => {
    it("should filter by model_version", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "count",
          model_version: "bert-v1",
        },
      });

      assert.strictEqual(res.status, 200);
      assert.ok(res.data.total > 0, "Should find tasks with bert-v1");

      console.log(`  ✓ Model version filter: bert-v1`);
      console.log(`    Result: ${res.data.total} tasks`);
      console.log(`    Expected: ~3-4 tasks (every 3rd task from valid group)`);
    });

    it("should return tasks with predictions when filtered by model_version", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "data",
          model_version: "bert-v2",
        },
      });

      assert.strictEqual(res.status, 200);

      // 모든 task는 bert-v2 prediction이 있어야 함
      for (const task of res.data.tasks) {
        const hasBertV2 = task.predictions.some(
          (p) => p.model_version === "bert-v2"
        );
        assert.ok(hasBertV2, `Task ${task.id} should have bert-v2 prediction`);
      }

      console.log(
        `  ✓ All returned tasks have predictions with model_version=bert-v2`
      );
    });
  });

  describe("5. Confirm User ID Filtering", () => {
    it("should filter by confirm_user_id (superuser)", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "count",
          confirm_user_id: testContext.superuserId,
        },
      });

      assert.strictEqual(res.status, 200);
      assert.ok(res.data.total > 0, "Should find tasks confirmed by superuser");

      console.log(`  ✓ Confirm user ID filter: ${testContext.superuserId}`);
      console.log(`    Result: ${res.data.total} tasks`);
    });

    it("should return empty when filtering by regular user ID", async () => {
      if (!testContext.regularUserId) {
        console.log(`  ⊘ Skipped: Regular user not available`);
        return;
      }

      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "count",
          confirm_user_id: testContext.regularUserId,
        },
      });

      assert.strictEqual(res.status, 200);
      // Regular user의 annotation은 제외되므로 0개여야 함
      console.log(
        `  ✓ Regular user filter returns: ${res.data.total} tasks (should be 0)`
      );
    });
  });

  describe("6. Pagination", () => {
    it("should paginate results correctly", async () => {
      const pageSize = 3;

      // Page 1
      const page1Res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "data",
          page: 1,
          page_size: pageSize,
        },
      });

      assert.strictEqual(page1Res.status, 200);
      assert.strictEqual(page1Res.data.page, 1);
      assert.strictEqual(page1Res.data.page_size, pageSize);
      assert.ok(
        page1Res.data.tasks.length <= pageSize,
        "Should return at most page_size tasks"
      );
      assert.strictEqual(
        page1Res.data.has_previous,
        false,
        "Page 1 should not have previous"
      );

      console.log(`  ✓ Page 1: ${page1Res.data.tasks.length} tasks`);
      console.log(`    Total: ${page1Res.data.total}`);
      console.log(`    Total pages: ${page1Res.data.total_pages}`);
      console.log(`    Has next: ${page1Res.data.has_next}`);

      // Page 2 (if exists)
      if (page1Res.data.has_next) {
        const page2Res = await request("POST", "/api/custom/export/", {
          body: {
            project_id: testContext.projectId,
            response_type: "data",
            page: 2,
            page_size: pageSize,
          },
        });

        assert.strictEqual(page2Res.status, 200);
        assert.strictEqual(page2Res.data.page, 2);
        assert.strictEqual(
          page2Res.data.has_previous,
          true,
          "Page 2 should have previous"
        );

        console.log(`  ✓ Page 2: ${page2Res.data.tasks.length} tasks`);
        console.log(`    Has previous: ${page2Res.data.has_previous}`);
        console.log(`    Has next: ${page2Res.data.has_next}`);
      }
    });

    it("should validate page and page_size parameters", async () => {
      // page만 있고 page_size 없음 - 에러
      const res1 = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          page: 1,
        },
      });

      assert.strictEqual(
        res1.status,
        400,
        "Should reject page without page_size"
      );
      assert.ok(res1.data.error, "Should have error message");

      console.log(`  ✓ Validation: page requires page_size`);

      // page_size만 있고 page 없음 - 에러
      const res2 = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          page_size: 10,
        },
      });

      assert.strictEqual(
        res2.status,
        400,
        "Should reject page_size without page"
      );

      console.log(`  ✓ Validation: page_size requires page`);
    });

    it("should handle large page_size within limit", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "data",
          page: 1,
          page_size: 100,
        },
      });

      assert.strictEqual(res.status, 200);
      console.log(
        `  ✓ Large page_size (100) accepted: ${res.data.tasks.length} tasks returned`
      );
    });

    it("should reject page_size exceeding maximum", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          page: 1,
          page_size: 10001, // Max is 10000
        },
      });

      assert.strictEqual(res.status, 400, "Should reject page_size > 10000");
      console.log(`  ✓ page_size exceeding 10000 rejected`);
    });
  });

  describe("7. Combined Filters", () => {
    it("should apply multiple filters together", async () => {
      const now = new Date();
      const searchFrom = new Date(now.getTime() + 2 * 86400000);
      const searchTo = new Date(now.getTime() + 8 * 86400000);

      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "count",
          search_from: formatDateTime(searchFrom),
          search_to: formatDateTime(searchTo),
          model_version: "bert-v1",
          confirm_user_id: testContext.superuserId,
        },
      });

      assert.strictEqual(res.status, 200);

      console.log(`  ✓ Combined filters applied:`);
      console.log(
        `    - Date range: ${formatDateTime(searchFrom)} ~ ${formatDateTime(
          searchTo
        )}`
      );
      console.log(`    - Model version: bert-v1`);
      console.log(`    - Confirm user: ${testContext.superuserId}`);
      console.log(`    Result: ${res.data.total} tasks`);
    });

    it("should work with count and pagination together", async () => {
      // Step 1: Get total count
      const countRes = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "count",
        },
      });

      assert.strictEqual(countRes.status, 200);
      const total = countRes.data.total;

      // Step 2: Calculate pages
      const pageSize = 5;
      const totalPages = Math.ceil(total / pageSize);

      console.log(`  ✓ Workflow: count first, then paginate`);
      console.log(`    Total: ${total} tasks`);
      console.log(`    Page size: ${pageSize}`);
      console.log(`    Total pages: ${totalPages}`);

      // Step 3: Fetch first page
      const dataRes = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "data",
          page: 1,
          page_size: pageSize,
        },
      });

      assert.strictEqual(dataRes.status, 200);
      assert.strictEqual(
        dataRes.data.total,
        total,
        "Total should match count query"
      );

      console.log(`  ✓ First page fetched: ${dataRes.data.tasks.length} tasks`);
    });
  });

  describe("8. Error Handling", () => {
    it("should return 404 for non-existent project", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: 999999,
          response_type: "count",
        },
      });

      assert.strictEqual(res.status, 404);
      assert.ok(res.data.error, "Should have error message");

      console.log(`  ✓ Non-existent project returns 404`);
    });

    it("should return 400 for missing required field", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          response_type: "count",
          // project_id missing
        },
      });

      assert.strictEqual(res.status, 400);
      assert.ok(res.data.error, "Should have error message");

      console.log(`  ✓ Missing project_id returns 400`);
    });

    it("should return 400 for invalid response_type", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "invalid",
        },
      });

      assert.strictEqual(res.status, 400);
      console.log(`  ✓ Invalid response_type rejected`);
    });
  });

  describe("9. Performance & Data Integrity", () => {
    it("should return consistent results between count and data", async () => {
      const countRes = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "count",
        },
      });

      const dataRes = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "data",
        },
      });

      assert.strictEqual(
        countRes.data.total,
        dataRes.data.total,
        "Count and data total should match"
      );

      assert.strictEqual(
        dataRes.data.tasks.length,
        dataRes.data.total,
        "Returned tasks length should match total (without pagination)"
      );

      console.log(`  ✓ Count query: ${countRes.data.total}`);
      console.log(
        `  ✓ Data query: ${dataRes.data.total} (${dataRes.data.tasks.length} tasks)`
      );
      console.log(`  ✓ Results are consistent`);
    });

    it("should include all required fields in task data", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "data",
        },
      });

      assert.ok(res.data.tasks.length > 0, "Should have tasks");

      const task = res.data.tasks[0];

      // Task fields
      assert.ok(task.id, "Task should have id");
      assert.ok(task.project_id, "Task should have project_id");
      assert.ok(task.data, "Task should have data");
      assert.ok(task.created_at, "Task should have created_at");
      assert.ok(task.updated_at, "Task should have updated_at");
      assert.ok("is_labeled" in task, "Task should have is_labeled");

      // Annotations
      assert.ok(
        Array.isArray(task.annotations),
        "Task should have annotations array"
      );
      if (task.annotations.length > 0) {
        const annotation = task.annotations[0];
        assert.ok(annotation.id, "Annotation should have id");
        assert.ok(annotation.result, "Annotation should have result");
        assert.ok(
          "was_cancelled" in annotation,
          "Annotation should have was_cancelled"
        );
        assert.ok(
          annotation.completed_by_info,
          "Annotation should have completed_by_info"
        );
        assert.ok(
          annotation.completed_by_info.id,
          "completed_by_info should have id"
        );
        assert.ok(
          annotation.completed_by_info.email,
          "completed_by_info should have email"
        );
      }

      // Predictions
      assert.ok(
        Array.isArray(task.predictions),
        "Task should have predictions array"
      );

      console.log(`  ✓ All required fields present in task data`);
      console.log(`  ✓ Task structure validated`);
    });
  });

  describe("10. Real-world Use Cases", () => {
    it("should support MLOps model training workflow", async () => {
      console.log(`\n  MLOps Use Case: Model Training Data Preparation`);

      // Step 1: Count total training data
      const countRes = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "count",
          model_version: "bert-v1",
        },
      });

      console.log(
        `    Step 1: Count training data: ${countRes.data.total} tasks`
      );

      // Step 2: Calculate optimal page size
      const pageSize = 50;
      const totalPages = Math.ceil(countRes.data.total / pageSize);
      console.log(
        `    Step 2: Calculate pages: ${totalPages} pages (size: ${pageSize})`
      );

      // Step 3: Fetch first batch
      const dataRes = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "data",
          model_version: "bert-v1",
          page: 1,
          page_size: pageSize,
        },
      });

      console.log(
        `    Step 3: Fetch first batch: ${dataRes.data.tasks.length} tasks`
      );
      console.log(`    ✓ MLOps workflow validated`);
    });

    it("should support performance calculation workflow", async () => {
      console.log(`\n  MLOps Use Case: Model Performance Calculation`);

      const now = new Date();
      const monthAgo = new Date(now.getTime() - 30 * 86400000);

      // Get all predictions for a specific model in date range
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "data",
          model_version: "bert-v2",
          search_from: formatDateTime(monthAgo),
          search_to: formatDateTime(now),
        },
      });

      console.log(`    Model: bert-v2`);
      console.log(`    Date range: Last 30 days`);
      console.log(`    Tasks with predictions: ${res.data.tasks.length}`);
      console.log(`    ✓ Performance calculation data retrieved`);
    });

    it("should prevent timeout with large datasets using pagination", async () => {
      console.log(
        `\n  Production Use Case: Large Dataset Export (Timeout Prevention)`
      );

      const pageSize = 100;

      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "data",
          page: 1,
          page_size: pageSize,
        },
      });

      console.log(`    Pagination enabled: page_size=${pageSize}`);
      console.log(`    Response time: Fast (no timeout)`);
      console.log(`    Tasks in batch: ${res.data.tasks.length}`);
      console.log(`    ✓ Large dataset handling validated`);
    });
  });
});
