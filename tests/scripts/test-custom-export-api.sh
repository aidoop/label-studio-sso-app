#!/bin/bash

# Custom Export API - Quick Test Script
# 생성된 테스트 데이터를 사용하여 API를 빠르게 테스트합니다.

PROJECT_ID=31
API_TOKEN="${LABEL_STUDIO_API_TOKEN:-2c00d45b8318a11f59e04c7233d729f3f17664e8}"
API_URL="${LABEL_STUDIO_URL:-http://localhost:8080}"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  Custom Export API - Quick Test                             ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Configuration:"
echo "  - API URL: $API_URL"
echo "  - Project ID: $PROJECT_ID"
echo "  - API Token: ${API_TOKEN:0:20}..."
echo ""

# Test 1: Count query
echo "✅ Test 1: Count valid tasks"
RESULT=$(curl -s -X POST $API_URL/api/custom/export/ \
  -H "Authorization: Token $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"project_id\": $PROJECT_ID, \"response_type\": \"count\"}")
echo "   Response: $RESULT"
TOTAL=$(echo $RESULT | python3 -c "import json, sys; print(json.load(sys.stdin).get('total', 'ERROR'))" 2>/dev/null || echo "ERROR")
if [ "$TOTAL" = "60" ]; then
    echo "   ✅ PASS: 60 valid tasks returned (expected 60)"
else
    echo "   ❌ FAIL: Expected 60, got $TOTAL"
fi
echo ""

# Test 2: Pagination
echo "✅ Test 2: Paginated data query (page 1, page_size 5)"
RESULT=$(curl -s -X POST $API_URL/api/custom/export/ \
  -H "Authorization: Token $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"project_id\": $PROJECT_ID, \"response_type\": \"data\", \"page\": 1, \"page_size\": 5}")
TASKS_COUNT=$(echo $RESULT | python3 -c "import json, sys; data=json.load(sys.stdin); print(len(data.get('tasks', [])))" 2>/dev/null || echo "ERROR")
TOTAL=$(echo $RESULT | python3 -c "import json, sys; print(json.load(sys.stdin).get('total', 'ERROR'))" 2>/dev/null || echo "ERROR")
echo "   Response: total=$TOTAL, tasks_returned=$TASKS_COUNT"
if [ "$TASKS_COUNT" = "5" ] && [ "$TOTAL" = "60" ]; then
    echo "   ✅ PASS: 5 tasks returned from total 60"
else
    echo "   ❌ FAIL: Expected 5 tasks from total 60, got $TASKS_COUNT from $TOTAL"
fi
echo ""

# Test 3: Model version filter
echo "✅ Test 3: Model version filtering (bert-v1)"
RESULT=$(curl -s -X POST $API_URL/api/custom/export/ \
  -H "Authorization: Token $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"project_id\": $PROJECT_ID, \"response_type\": \"count\", \"model_version\": \"bert-v1\"}")
echo "   Response: $RESULT"
TOTAL=$(echo $RESULT | python3 -c "import json, sys; print(json.load(sys.stdin).get('total', 'ERROR'))" 2>/dev/null || echo "ERROR")
if [ "$TOTAL" != "ERROR" ] && [ "$TOTAL" -gt 0 ]; then
    echo "   ✅ PASS: bert-v1 filter returned $TOTAL tasks"
else
    echo "   ❌ FAIL: Model filter failed or returned 0"
fi
echo ""

# Test 4: Date range filter
echo "✅ Test 4: Date range filtering (last 30 days)"
DATE_30_DAYS_AGO=$(date -u -v-30d '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -u -d '30 days ago' '+%Y-%m-%d %H:%M:%S')
RESULT=$(curl -s -X POST $API_URL/api/custom/export/ \
  -H "Authorization: Token $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"project_id\": $PROJECT_ID, \"response_type\": \"count\", \"search_from\": \"$DATE_30_DAYS_AGO\"}")
echo "   Response: $RESULT"
TOTAL=$(echo $RESULT | python3 -c "import json, sys; print(json.load(sys.stdin).get('total', 'ERROR'))" 2>/dev/null || echo "ERROR")
if [ "$TOTAL" != "ERROR" ]; then
    echo "   ✅ PASS: Date filter returned $TOTAL tasks (from last 30 days)"
else
    echo "   ❌ FAIL: Date filter failed"
fi
echo ""

# Test 5: Confirm user ID filter (superuser)
echo "✅ Test 5: Confirm user ID filtering (superuser ID=1)"
RESULT=$(curl -s -X POST $API_URL/api/custom/export/ \
  -H "Authorization: Token $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"project_id\": $PROJECT_ID, \"response_type\": \"count\", \"confirm_user_id\": 1}")
echo "   Response: $RESULT"
TOTAL=$(echo $RESULT | python3 -c "import json, sys; print(json.load(sys.stdin).get('total', 'ERROR'))" 2>/dev/null || echo "ERROR")
if [ "$TOTAL" = "60" ]; then
    echo "   ✅ PASS: All 60 annotations confirmed by superuser ID 1"
else
    echo "   ❌ FAIL: Expected 60, got $TOTAL"
fi
echo ""

# Test 6: Confirm user ID filter (regular user - should return 0)
echo "✅ Test 6: Confirm user ID filtering (regular user ID=61)"
RESULT=$(curl -s -X POST $API_URL/api/custom/export/ \
  -H "Authorization: Token $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"project_id\": $PROJECT_ID, \"response_type\": \"count\", \"confirm_user_id\": 61}")
echo "   Response: $RESULT"
TOTAL=$(echo $RESULT | python3 -c "import json, sys; print(json.load(sys.stdin).get('total', 'ERROR'))" 2>/dev/null || echo "ERROR")
if [ "$TOTAL" = "0" ]; then
    echo "   ✅ PASS: Regular user annotations correctly excluded (0 returned)"
else
    echo "   ❌ FAIL: Expected 0, got $TOTAL"
fi
echo ""

# Test 7: Combined filters
echo "✅ Test 7: Combined filters (model_version + pagination)"
RESULT=$(curl -s -X POST $API_URL/api/custom/export/ \
  -H "Authorization: Token $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"project_id\": $PROJECT_ID, \"model_version\": \"bert-v2\", \"page\": 1, \"page_size\": 10}")
TASKS_COUNT=$(echo $RESULT | python3 -c "import json, sys; data=json.load(sys.stdin); print(len(data.get('tasks', [])))" 2>/dev/null || echo "ERROR")
TOTAL=$(echo $RESULT | python3 -c "import json, sys; print(json.load(sys.stdin).get('total', 'ERROR'))" 2>/dev/null || echo "ERROR")
echo "   Response: total=$TOTAL, tasks_returned=$TASKS_COUNT"
if [ "$TASKS_COUNT" != "ERROR" ] && [ "$TOTAL" != "ERROR" ]; then
    echo "   ✅ PASS: Combined filters working (returned $TASKS_COUNT tasks from $TOTAL total)"
else
    echo "   ❌ FAIL: Combined filters failed"
fi
echo ""

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  Test Summary                                                ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "All 7 core API tests completed!"
echo ""
echo "📝 For more detailed tests, see:"
echo "   - /tests/scripts/README.md"
echo "   - /tests/CUSTOM_EXPORT_API_FINAL_TEST_REPORT.md"
echo ""
