# Mixed Annotation Test Results

**Date**: 2025-11-19
**Version**: v1.20.0-sso.38
**Status**: ✅ PASSED

---

## 🎯 Test Objective

Verify that the Custom Export API correctly handles tasks with **mixed annotations** (both superuser and regular user annotations on the same task), ensuring that:

1. Tasks with mixed annotations are **included** in the export
2. Only **superuser annotations** are returned in the API response
3. **Regular user annotations** are excluded from the export

---

## 📊 Test Data

### Database Structure (Project ID: 32)

| Category | Count | Description | API Result |
|----------|-------|-------------|------------|
| **Superuser-only tasks** | 35 | Tasks with only superuser annotations | ✅ Included |
| **Mixed annotation tasks** | 25 | Tasks with BOTH superuser AND regular user annotations | ✅ Included (superuser only) |
| **Regular user-only tasks** | 15 | Tasks with only regular user annotations | ❌ Excluded |
| **Draft-only tasks** | 15 | Tasks with was_cancelled=true annotations | ❌ Excluded |
| **No annotation tasks** | 10 | Tasks without any annotations | ❌ Excluded |
| **Total** | 100 | | |

### Total Annotations in Database

- Superuser annotations: 60 (35 superuser-only + 25 from mixed)
- Regular user annotations: 40 (15 regular user-only + 25 from mixed)
- Draft annotations: 15 (draft-only tasks)
- **Total annotations**: 115

---

## 🧪 Test Execution

### Test Script

```bash
./scripts/verify-mixed-annotations.sh
```

### Test Results

```
╔═══════════════════════════════════════════════════════════════╗
║  Mixed Annotation Verification Test                         ║
╚═══════════════════════════════════════════════════════════════╝

📊 Test Setup:
  - Project ID: 32
  - Expected: 60 tasks (35 superuser-only + 25 mixed)
  - Expected: All returned annotations from superuser only

✅ Test 1: Verify total count
   ✅ PASS: 60 tasks returned (includes mixed annotations)

✅ Test 2: Verify only superuser annotations in response
   Total tasks: 60
   Tasks with annotations: 60
   All from superuser: True
   ✅ PASS: All annotations are from superuser only

✅ Test 3: Verify regular user-only annotations excluded
   ✅ PASS: Regular user-only annotations excluded (0 tasks returned)

✅ Test 4: Verify mixed annotations handling
   Checking database for tasks with both superuser and regular user annotations...
   Database has 25 tasks with mixed annotations
   ✅ PASS: Mixed annotations exist in database (25 tasks)
   ✅ PASS: API correctly excludes regular user annotations from response

╔═══════════════════════════════════════════════════════════════╗
║  Verification Complete                                       ║
╚═══════════════════════════════════════════════════════════════╝

🎉 SUCCESS: Mixed annotation handling verified!

📊 Summary:
  - API returns 60 tasks (35 superuser-only + 25 mixed)
  - Database contains 25 tasks with both superuser and regular user annotations
  - Database contains 15 tasks with regular user-only annotations
  - API correctly excludes:
    • Regular user-only annotations (15 tasks)
    • Regular user part of mixed annotations (25 tasks)
    • Draft annotations (15 tasks)
    • Tasks without annotations (10 tasks)
  - Only superuser valid annotations (was_cancelled=False) are exported

✅ The Custom Export API correctly handles mixed annotation scenarios!
```

---

## ✅ Verification Checklist

### Core Requirements

- [x] **Tasks with mixed annotations are included in export**
  - 25 mixed annotation tasks in database
  - All 25 are included in the 60 tasks returned by API

- [x] **Regular user-only tasks are excluded**
  - 15 tasks with only regular user annotations
  - All 15 tasks completely excluded from API response
  - confirm_user_id=62 returns 0 tasks

- [x] **Only superuser annotations are exported**
  - API response contains only annotations from user_id=1 (superuser)
  - All 60 tasks show `is_superuser=true` for all annotations
  - Mixed tasks show only the superuser annotation, not the regular user annotation

- [x] **Regular user annotations are excluded**
  - Database has 40 regular user annotations total
  - API response contains 0 regular user annotations
  - Both regular user-only (15) and mixed regular parts (25) are excluded

### Data Integrity

- [x] **Mixed annotation tasks structure**
  - Each of the 25 mixed tasks has exactly 2 annotations in database
  - One annotation from superuser (user_id=1, is_superuser=true)
  - One annotation from regular user (user_id=62, is_superuser=false)

- [x] **API filtering logic**
  - Filter: `annotations__completed_by__is_superuser=True`
  - Filter: `annotations__was_cancelled=False`
  - Both filters correctly applied

- [x] **Serialization correctness**
  - API response includes only prefetched superuser annotations
  - Regular user annotations filtered out at query level
  - completed_by_info correctly shows is_superuser=true

---

## 🔍 Technical Analysis

### API Implementation

The Custom Export API (`/label-studio/label_studio/custom_api/export.py`) correctly implements mixed annotation handling through:

1. **Query Filtering** (line 249-253):
   ```python
   queryset = queryset.filter(
       annotations__completed_by__is_superuser=True,
       annotations__was_cancelled=False
   ).distinct()
   ```

2. **Prefetch Optimization** (line 256-262):
   ```python
   valid_annotations_queryset = Annotation.objects.filter(
       completed_by__is_superuser=True,
       was_cancelled=False
   ).select_related('completed_by').order_by('-created_at')

   queryset = queryset.prefetch_related(
       Prefetch('annotations', queryset=valid_annotations_queryset)
   )
   ```

3. **Result**:
   - Tasks with at least one superuser valid annotation are included
   - Only superuser annotations are loaded via prefetch
   - Regular user annotations never enter the serialization pipeline

---

## 📝 Conclusion

✅ **The Custom Export API correctly handles all annotation scenarios.**

Key findings:
- **35 superuser-only tasks** + **25 mixed tasks** = 60 tasks exported
- **15 regular user-only tasks** completely excluded
- All returned annotations are from superuser only (100% compliance)
- Mixed tasks correctly show only superuser annotations
- Regular user annotations completely excluded from API response
- Query optimization prevents N+1 issues while maintaining correctness

### Recommended Use Cases

This behavior is ideal for:
- **MLOps workflows** requiring only validated/reviewed data
- **Training data export** where only approved annotations are used
- **Quality control** separating draft work from production data
- **Multi-annotator projects** where only supervisors provide ground truth

---

**Test Status**: ✅ **PASSED**
**Verification Script**: `/tests/scripts/verify-mixed-annotations.sh`
**Test Date**: 2025-11-19
