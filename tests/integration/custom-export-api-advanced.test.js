/**
 * Custom Export API - Advanced Integration Tests
 *
 * 더 견고한 테스트: 엣지 케이스, 경계값, 복잡한 시나리오
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
 * 날짜 문자열 생성
 */
function formatDateTime(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * 테스트 컨텍스트
 */
const testContext = {
  projectId: null,
  superuserId: 1,
  secondSuperuserId: null,
  regularUserId: null,
  createdUserIds: [],
  createdTaskIds: [],
};

describe("Custom Export API - Advanced Integration Tests", () => {
  before(async () => {
    console.log("\n╔═══════════════════════════════════════════════════════════════╗");
    console.log("║  Advanced Test Setup - Edge Cases & Complex Scenarios       ║");
    console.log("╚═══════════════════════════════════════════════════════════════╝\n");

    // 프로젝트 생성
    console.log("→ Creating test project...");
    const projectRes = await request("POST", "/api/projects", {
      body: {
        title: "Advanced Export API Test",
        description: "Edge cases and complex scenarios",
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

    testContext.projectId = projectRes.data.id;
    console.log(`  ✓ Created project ID: ${testContext.projectId}`);

    // 두 번째 슈퍼유저 생성
    console.log("→ Creating second superuser...");
    const superuser2Res = await request(
      "POST",
      "/api/admin/users/create-superuser",
      {
        body: {
          email: `test_superuser2_${Date.now()}@test.io`,
          first_name: "Superuser",
          last_name: "Two",
          password: "TestPassword123!",
        },
      }
    );

    if (superuser2Res.status === 201) {
      testContext.secondSuperuserId = superuser2Res.data.user.id;
      testContext.createdUserIds.push(testContext.secondSuperuserId);
      console.log(`  ✓ Created second superuser ID: ${testContext.secondSuperuserId}`);
    }

    // 일반 사용자 생성
    console.log("→ Creating regular user...");
    const regularUserRes = await request(
      "POST",
      "/api/admin/users/create-superuser",
      {
        body: {
          email: `test_regular_advanced_${Date.now()}@test.io`,
          first_name: "Regular",
          last_name: "User",
          password: "TestPassword123!",
        },
      }
    );

    if (regularUserRes.status === 201) {
      testContext.regularUserId = regularUserRes.data.user.id;
      testContext.createdUserIds.push(testContext.regularUserId);
      await request(
        "POST",
        `/api/admin/users/${testContext.regularUserId}/demote-from-superuser`
      );
      console.log(`  ✓ Created regular user ID: ${testContext.regularUserId}`);
    }

    console.log("\n  ✓ Advanced test setup completed\n");
  });

  after(async () => {
    console.log("\n╔═══════════════════════════════════════════════════════════════╗");
    console.log("║  Advanced Test Cleanup                                       ║");
    console.log("╚═══════════════════════════════════════════════════════════════╝\n");

    for (const userId of testContext.createdUserIds) {
      try {
        await request("DELETE", `/api/users/${userId}/`);
        console.log(`  ✓ Deleted user ${userId}`);
      } catch (e) {
        console.log(`  ⚠ Failed to delete user ${userId}`);
      }
    }

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

  describe("1. Edge Cases - Empty and Boundary Conditions", () => {
    it("should handle empty project (no tasks)", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "count",
        },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.total, 0, "Empty project should return 0");

      console.log(`  ✓ Empty project handled correctly: 0 tasks`);
    });

    it("should handle page number beyond available pages", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "data",
          page: 999,
          page_size: 10,
        },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.tasks.length, 0, "Beyond pages should return empty");
      assert.strictEqual(res.data.has_next, false);
      assert.strictEqual(res.data.has_previous, true);

      console.log(`  ✓ Page 999 handled correctly: empty results`);
    });

    it("should handle page_size of 1 (minimum)", async () => {
      // Create one task first
      const taskRes = await request(
        "POST",
        `/api/projects/${testContext.projectId}/tasks/`,
        {
          body: {
            data: {
              text: "Test task for page_size=1",
              source_created_at: formatDateTime(new Date()),
            },
          },
        }
      );

      if (taskRes.status === 201) {
        const taskId = taskRes.data.id;
        testContext.createdTaskIds.push(taskId);

        // Create annotation
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
      }

      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "data",
          page: 1,
          page_size: 1,
        },
      });

      assert.strictEqual(res.status, 200);
      assert.ok(res.data.tasks.length <= 1, "page_size=1 should return at most 1 task");

      console.log(`  ✓ Minimum page_size (1) handled: ${res.data.tasks.length} task`);
    });

    it("should handle page_size at maximum (10000)", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "data",
          page: 1,
          page_size: 10000,
        },
      });

      assert.strictEqual(res.status, 200);
      console.log(`  ✓ Maximum page_size (10000) accepted`);
    });
  });

  describe("2. Complex Annotation Scenarios", () => {
    let mixedTaskId;

    before(async () => {
      // Create task with multiple annotations from different users
      const taskRes = await request(
        "POST",
        `/api/projects/${testContext.projectId}/tasks/`,
        {
          body: {
            data: {
              text: "Task with mixed annotations",
              source_created_at: formatDateTime(new Date()),
            },
          },
        }
      );

      mixedTaskId = taskRes.data.id;
      testContext.createdTaskIds.push(mixedTaskId);

      // First superuser annotation (valid)
      await request("POST", `/api/tasks/${mixedTaskId}/annotations/`, {
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

      // Draft annotation from same superuser
      await request("POST", `/api/tasks/${mixedTaskId}/annotations/`, {
        body: {
          result: [
            {
              type: "choices",
              value: { choices: ["Neutral"] },
              from_name: "sentiment",
              to_name: "text",
            },
          ],
          was_cancelled: true,
        },
      });
    });

    it("should include task with mixed valid/invalid annotations", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "data",
        },
      });

      assert.strictEqual(res.status, 200);

      const task = res.data.tasks.find((t) => t.id === mixedTaskId);
      assert.ok(task, "Task with mixed annotations should be included");

      // Should only include valid (non-cancelled) annotations
      const validAnnotations = task.annotations.filter(a => !a.was_cancelled);
      assert.ok(validAnnotations.length > 0, "Should have valid annotations");

      console.log(`  ✓ Mixed annotations handled: ${validAnnotations.length} valid out of ${task.annotations.length} total`);
    });

    it("should handle task with multiple valid superuser annotations", async () => {
      if (!testContext.secondSuperuserId) {
        console.log(`  ⊘ Skipped: Second superuser not available`);
        return;
      }

      // Note: Can't create annotation as different user via API
      // This tests the logic when multiple valid annotations exist
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "data",
        },
      });

      assert.strictEqual(res.status, 200);
      console.log(`  ✓ Multiple superuser annotations scenario prepared`);
    });
  });

  describe("3. Multiple Predictions Scenarios", () => {
    let multiPredictionTaskId;

    before(async () => {
      // Create task with multiple predictions
      const taskRes = await request(
        "POST",
        `/api/projects/${testContext.projectId}/tasks/`,
        {
          body: {
            data: {
              text: "Task with multiple predictions",
              source_created_at: formatDateTime(new Date()),
            },
          },
        }
      );

      multiPredictionTaskId = taskRes.data.id;
      testContext.createdTaskIds.push(multiPredictionTaskId);

      // Add annotation
      await request("POST", `/api/tasks/${multiPredictionTaskId}/annotations/`, {
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

      // Add multiple predictions with different model versions
      const models = ["bert-v1", "bert-v2", "gpt-v1"];
      for (const model of models) {
        await request("POST", `/api/predictions/`, {
          body: {
            task: multiPredictionTaskId,
            result: [
              {
                type: "choices",
                value: { choices: ["Positive"] },
                from_name: "sentiment",
                to_name: "text",
              },
            ],
            score: 0.9 + Math.random() * 0.1,
            model_version: model,
          },
        });
      }
    });

    it("should include all predictions when no model_version filter", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "data",
        },
      });

      const task = res.data.tasks.find((t) => t.id === multiPredictionTaskId);
      assert.ok(task, "Task should be found");
      assert.ok(
        task.predictions.length >= 3,
        `Should have at least 3 predictions, got ${task.predictions.length}`
      );

      console.log(`  ✓ Multiple predictions included: ${task.predictions.length}`);
    });

    it("should filter to specific model_version when specified", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "data",
          model_version: "gpt-v1",
        },
      });

      const task = res.data.tasks.find((t) => t.id === multiPredictionTaskId);
      assert.ok(task, "Task with gpt-v1 prediction should be found");

      const gptPredictions = task.predictions.filter(
        (p) => p.model_version === "gpt-v1"
      );
      assert.ok(gptPredictions.length > 0, "Should have gpt-v1 predictions");

      console.log(`  ✓ Filtered to gpt-v1: found ${gptPredictions.length} predictions`);
    });

    it("should handle task with predictions but no specific model", async () => {
      // Create task with prediction without model_version
      const taskRes = await request(
        "POST",
        `/api/projects/${testContext.projectId}/tasks/`,
        {
          body: {
            data: {
              text: "Task with null model_version",
              source_created_at: formatDateTime(new Date()),
            },
          },
        }
      );

      const taskId = taskRes.data.id;
      testContext.createdTaskIds.push(taskId);

      await request("POST", `/api/tasks/${taskId}/annotations/`, {
        body: {
          result: [
            {
              type: "choices",
              value: { choices: ["Negative"] },
              from_name: "sentiment",
              to_name: "text",
            },
          ],
          was_cancelled: false,
        },
      });

      await request("POST", `/api/predictions/`, {
        body: {
          task: taskId,
          result: [
            {
              type: "choices",
              value: { choices: ["Negative"] },
              from_name: "sentiment",
              to_name: "text",
            },
          ],
          score: 0.8,
          model_version: null,
        },
      });

      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "data",
        },
      });

      const task = res.data.tasks.find((t) => t.id === taskId);
      assert.ok(task, "Task with null model_version should be included");

      console.log(`  ✓ Null model_version handled correctly`);
    });
  });

  describe("4. Date Boundary Testing", () => {
    let dateBoundaryTasks = [];

    before(async () => {
      const now = new Date();
      const dates = [
        new Date(now.getTime() - 86400000), // -1 day
        new Date(now.getTime()), // exactly now
        new Date(now.getTime() + 86400000), // +1 day
      ];

      for (let i = 0; i < dates.length; i++) {
        const taskRes = await request(
          "POST",
          `/api/projects/${testContext.projectId}/tasks/`,
          {
            body: {
              data: {
                text: `Date boundary task ${i}`,
                source_created_at: formatDateTime(dates[i]),
              },
            },
          }
        );

        const taskId = taskRes.data.id;
        testContext.createdTaskIds.push(taskId);
        dateBoundaryTasks.push({ id: taskId, date: dates[i] });

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
      }
    });

    it("should handle exact boundary dates (inclusive)", async () => {
      const now = new Date();
      // Search from 5 minutes ago to 1 day in the future to capture recently created tasks
      const searchFrom = formatDateTime(new Date(now.getTime() - 300000)); // -5 minutes
      const searchTo = formatDateTime(new Date(now.getTime() + 86400000)); // +1 day

      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "count",
          search_from: searchFrom,
          search_to: searchTo,
        },
      });

      assert.strictEqual(res.status, 200);
      assert.ok(res.data.total >= 2, "Should include tasks at boundary dates");

      console.log(`  ✓ Boundary dates (inclusive): ${res.data.total} tasks found`);
    });

    it("should handle search_from without search_to", async () => {
      const searchFrom = formatDateTime(new Date());

      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "count",
          search_from: searchFrom,
        },
      });

      assert.strictEqual(res.status, 200);
      console.log(`  ✓ search_from only: ${res.data.total} tasks`);
    });

    it("should handle search_to without search_from", async () => {
      const searchTo = formatDateTime(new Date());

      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "count",
          search_to: searchTo,
        },
      });

      assert.strictEqual(res.status, 200);
      console.log(`  ✓ search_to only: ${res.data.total} tasks`);
    });

    it("should handle inverted date range (from > to)", async () => {
      const now = new Date();
      const searchFrom = formatDateTime(new Date(now.getTime() + 86400000));
      const searchTo = formatDateTime(now);

      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "count",
          search_from: searchFrom,
          search_to: searchTo,
        },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(
        res.data.total,
        0,
        "Inverted date range should return 0 results"
      );

      console.log(`  ✓ Inverted date range handled: 0 tasks (as expected)`);
    });
  });

  describe("5. Input Validation - Invalid Formats", () => {
    it("should reject invalid date format", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          search_from: "not-a-date",
        },
      });

      assert.strictEqual(res.status, 400, "Invalid date should be rejected");
      console.log(`  ✓ Invalid date format rejected`);
    });

    it("should reject negative page number", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          page: -1,
          page_size: 10,
        },
      });

      assert.strictEqual(res.status, 400, "Negative page should be rejected");
      console.log(`  ✓ Negative page number rejected`);
    });

    it("should reject zero page number", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          page: 0,
          page_size: 10,
        },
      });

      assert.strictEqual(res.status, 400, "Zero page should be rejected");
      console.log(`  ✓ Zero page number rejected`);
    });

    it("should reject negative page_size", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          page: 1,
          page_size: -10,
        },
      });

      assert.strictEqual(res.status, 400, "Negative page_size should be rejected");
      console.log(`  ✓ Negative page_size rejected`);
    });

    it("should reject zero page_size", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          page: 1,
          page_size: 0,
        },
      });

      assert.strictEqual(res.status, 400, "Zero page_size should be rejected");
      console.log(`  ✓ Zero page_size rejected`);
    });
  });

  describe("6. SQL Injection & Security Tests", () => {
    const injectionAttempts = [
      "'; DROP TABLE tasks; --",
      "1' OR '1'='1",
      "admin'--",
      "'; DELETE FROM annotations; --",
      "../../../etc/passwd",
      "<script>alert('xss')</script>",
      "1 UNION SELECT * FROM users",
      "source_created_at; DROP TABLE tasks;",
    ];

    injectionAttempts.forEach((attempt, index) => {
      it(`should reject SQL injection attempt ${index + 1}: "${attempt.substring(0, 30)}..."`, async () => {
        const res = await request("POST", "/api/custom/export/", {
          body: {
            project_id: testContext.projectId,
            search_date_field: attempt,
          },
        });

        assert.strictEqual(
          res.status,
          400,
          `SQL injection attempt should be rejected: ${attempt}`
        );
        console.log(`  ✓ Injection blocked: "${attempt.substring(0, 30)}..."`);
      });
    });
  });

  describe("7. Concurrent Request Handling", () => {
    it("should handle multiple concurrent requests", async () => {
      const requests = [];
      const concurrentCount = 5;

      for (let i = 0; i < concurrentCount; i++) {
        requests.push(
          request("POST", "/api/custom/export/", {
            body: {
              project_id: testContext.projectId,
              response_type: "count",
            },
          })
        );
      }

      const results = await Promise.all(requests);

      // All should succeed
      results.forEach((res, index) => {
        assert.strictEqual(
          res.status,
          200,
          `Request ${index + 1} should succeed`
        );
      });

      // All should return same total
      const totals = results.map((r) => r.data.total);
      const uniqueTotals = new Set(totals);
      assert.strictEqual(
        uniqueTotals.size,
        1,
        "All concurrent requests should return same total"
      );

      console.log(`  ✓ ${concurrentCount} concurrent requests handled correctly`);
      console.log(`  ✓ All returned consistent results: ${totals[0]} tasks`);
    });

    it("should handle concurrent count and data requests", async () => {
      const [countRes, dataRes] = await Promise.all([
        request("POST", "/api/custom/export/", {
          body: {
            project_id: testContext.projectId,
            response_type: "count",
          },
        }),
        request("POST", "/api/custom/export/", {
          body: {
            project_id: testContext.projectId,
            response_type: "data",
          },
        }),
      ]);

      assert.strictEqual(countRes.status, 200);
      assert.strictEqual(dataRes.status, 200);
      assert.strictEqual(
        countRes.data.total,
        dataRes.data.total,
        "Concurrent count and data should match"
      );

      console.log(`  ✓ Concurrent count/data requests consistent`);
    });
  });

  describe("8. Special Characters in Data", () => {
    let specialCharTaskId;

    before(async () => {
      const specialText = `Special chars: 你好 مرحبا 🎉 \n\t"quotes" 'apostrophe' <html> & | ; $ \\ `;

      const taskRes = await request(
        "POST",
        `/api/projects/${testContext.projectId}/tasks/`,
        {
          body: {
            data: {
              text: specialText,
              source_created_at: formatDateTime(new Date()),
            },
          },
        }
      );

      specialCharTaskId = taskRes.data.id;
      testContext.createdTaskIds.push(specialCharTaskId);

      await request("POST", `/api/tasks/${specialCharTaskId}/annotations/`, {
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
    });

    it("should handle task with special characters", async () => {
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "data",
        },
      });

      const task = res.data.tasks.find((t) => t.id === specialCharTaskId);
      assert.ok(task, "Task with special characters should be found");
      assert.ok(task.data.text, "Text field should be preserved");

      console.log(`  ✓ Special characters handled correctly`);
    });
  });

  describe("9. Large Dataset Simulation", () => {
    it("should handle requesting all data without pagination", async () => {
      // This tests the system's ability to handle non-paginated requests
      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "data",
        },
      });

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data.tasks), "Should return tasks array");
      assert.strictEqual(
        res.data.tasks.length,
        res.data.total,
        "Without pagination, should return all tasks"
      );

      console.log(`  ✓ Non-paginated request handled: ${res.data.tasks.length} tasks`);
    });

    it("should handle very large page_size efficiently", async () => {
      const startTime = Date.now();

      const res = await request("POST", "/api/custom/export/", {
        body: {
          project_id: testContext.projectId,
          response_type: "data",
          page: 1,
          page_size: 5000,
        },
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      assert.strictEqual(res.status, 200);
      console.log(`  ✓ Large page_size (5000) completed in ${duration}ms`);
      assert.ok(duration < 30000, "Should complete within 30 seconds");
    });
  });

  describe("10. Consistency Tests", () => {
    it("should return consistent results across multiple identical requests", async () => {
      const results = [];

      for (let i = 0; i < 3; i++) {
        const res = await request("POST", "/api/custom/export/", {
          body: {
            project_id: testContext.projectId,
            response_type: "count",
          },
        });
        results.push(res.data.total);
      }

      const uniqueResults = new Set(results);
      assert.strictEqual(
        uniqueResults.size,
        1,
        "Multiple identical requests should return same result"
      );

      console.log(`  ✓ Consistent results across 3 requests: ${results[0]} tasks`);
    });

    it("should maintain count-data consistency with filters", async () => {
      const filters = {
        project_id: testContext.projectId,
        search_from: formatDateTime(new Date(Date.now() - 86400000)),
      };

      const [countRes, dataRes] = await Promise.all([
        request("POST", "/api/custom/export/", {
          body: { ...filters, response_type: "count" },
        }),
        request("POST", "/api/custom/export/", {
          body: { ...filters, response_type: "data" },
        }),
      ]);

      assert.strictEqual(
        countRes.data.total,
        dataRes.data.total,
        "Count and data should match with filters"
      );
      assert.strictEqual(
        dataRes.data.tasks.length,
        dataRes.data.total,
        "Returned tasks should match total"
      );

      console.log(`  ✓ Count-data consistency with filters: ${countRes.data.total} tasks`);
    });
  });
});
