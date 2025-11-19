#!/bin/bash

# Add Regular User Annotations via Django Shell
# This script creates annotations from regular users using Docker exec

PROJECT_ID=32
REGULAR_USER_ID=62
SUPERUSER_ID=1

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  Adding Regular User & Mixed Annotations                    ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Get container name (prefer label-studio-app)
CONTAINER_NAME=$(docker ps --filter "name=label-studio-app" --format "{{.Names}}" | grep "label-studio-app$" | head -1)

if [ -z "$CONTAINER_NAME" ]; then
    echo "❌ Error: label-studio-app container not found"
    echo "   Please make sure Label Studio is running"
    exit 1
fi

echo "📦 Using container: $CONTAINER_NAME"
echo "🎯 Project ID: $PROJECT_ID"
echo "👤 Regular User ID: $REGULAR_USER_ID"
echo "👑 Superuser ID: $SUPERUSER_ID"
echo ""

# Create Python script for Django shell
cat > /tmp/create_annotations.py << 'PYTHON_SCRIPT'
import random
from tasks.models import Task, Annotation
from users.models import User
from datetime import datetime, timedelta

PROJECT_ID = 32
REGULAR_USER_ID = 62
SUPERUSER_ID = 1

# Get users
try:
    regular_user = User.objects.get(id=REGULAR_USER_ID)
    superuser = User.objects.get(id=SUPERUSER_ID)
    print(f"✓ Found regular user: {regular_user.email}")
    print(f"✓ Found superuser: {superuser.email}")
except User.DoesNotExist as e:
    print(f"❌ User not found: {e}")
    exit(1)

# Get tasks from project
tasks = Task.objects.filter(project_id=PROJECT_ID).order_by('id')
total_tasks = tasks.count()
print(f"✓ Found {total_tasks} tasks in project {PROJECT_ID}")

if total_tasks < 100:
    print(f"❌ Expected 100 tasks, found {total_tasks}")
    exit(1)

tasks_list = list(tasks)

# Group 2: Regular User Only Annotations (15 tasks)
# Tasks 60-74 (indices 60-74)
print("\n→ Creating regular user annotations (tasks 60-74)...")
regular_count = 0
for i in range(60, 75):
    if i >= len(tasks_list):
        break

    task = tasks_list[i]

    # Check if annotation already exists
    if Annotation.objects.filter(task=task, completed_by=regular_user).exists():
        print(f"  ⊘ Task {task.id}: annotation already exists")
        continue

    # Random date in last 90 days
    random_days = random.randint(0, 90)
    created_at = datetime.now() - timedelta(days=random_days)

    # Create annotation
    annotation = Annotation.objects.create(
        task=task,
        completed_by=regular_user,
        result=[{
            'value': {'choices': [random.choice(['Positive', 'Negative', 'Neutral'])]},
            'from_name': 'sentiment',
            'to_name': 'text',
            'type': 'choices'
        }],
        was_cancelled=False,
        lead_time=random.uniform(10, 40),
        created_at=created_at,
        updated_at=created_at
    )
    regular_count += 1

    if (regular_count % 5) == 0:
        print(f"  Progress: {regular_count}/15")

print(f"  ✓ Created {regular_count} regular user annotations")

# Group 3: Mixed Annotations (10 tasks)
# Tasks 90-99 (indices 90-99): Both superuser AND regular user
print("\n→ Creating mixed annotations (tasks 90-99)...")
mixed_count = 0
for i in range(90, 100):
    if i >= len(tasks_list):
        break

    task = tasks_list[i]

    # Random date in last 90 days
    random_days_1 = random.randint(0, 90)
    random_days_2 = random.randint(0, 90)
    created_at_1 = datetime.now() - timedelta(days=random_days_1)
    created_at_2 = datetime.now() - timedelta(days=random_days_2)

    # Create superuser annotation
    if not Annotation.objects.filter(task=task, completed_by=superuser, was_cancelled=False).exists():
        Annotation.objects.create(
            task=task,
            completed_by=superuser,
            result=[{
                'value': {'choices': [random.choice(['Positive', 'Negative', 'Neutral'])]},
                'from_name': 'sentiment',
                'to_name': 'text',
                'type': 'choices'
            }],
            was_cancelled=False,
            lead_time=random.uniform(10, 40),
            created_at=created_at_1,
            updated_at=created_at_1
        )

    # Create regular user annotation
    if not Annotation.objects.filter(task=task, completed_by=regular_user).exists():
        Annotation.objects.create(
            task=task,
            completed_by=regular_user,
            result=[{
                'value': {'choices': [random.choice(['Positive', 'Negative', 'Neutral'])]},
                'from_name': 'sentiment',
                'to_name': 'text',
                'type': 'choices'
            }],
            was_cancelled=False,
            lead_time=random.uniform(10, 40),
            created_at=created_at_2,
            updated_at=created_at_2
        )

    mixed_count += 1
    if (mixed_count % 5) == 0:
        print(f"  Progress: {mixed_count}/10")

print(f"  ✓ Created {mixed_count} mixed annotation tasks")

# Summary
print("\n╔═══════════════════════════════════════════════════════════════╗")
print("║  Annotation Creation Summary                                 ║")
print("╚═══════════════════════════════════════════════════════════════╝")

total_annotations = Annotation.objects.filter(task__project_id=PROJECT_ID).count()
superuser_annotations = Annotation.objects.filter(task__project_id=PROJECT_ID, completed_by=superuser).count()
regular_annotations = Annotation.objects.filter(task__project_id=PROJECT_ID, completed_by=regular_user).count()
tasks_with_superuser_only = Annotation.objects.filter(
    task__project_id=PROJECT_ID,
    completed_by=superuser,
    was_cancelled=False
).values('task').distinct().count()

print(f"\nTotal annotations: {total_annotations}")
print(f"  - Superuser annotations: {superuser_annotations}")
print(f"  - Regular user annotations: {regular_annotations}")
print(f"  - Tasks with superuser valid annotations: {tasks_with_superuser_only}")
print("")
print("Expected API result: ~70 tasks")
print("  (60 superuser-only + 10 mixed)")
print("")
PYTHON_SCRIPT

echo "→ Executing Django shell script..."
docker exec -i $CONTAINER_NAME bash -c "cd /label-studio/label_studio && python3 manage.py shell" < /tmp/create_annotations.py

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully added regular user and mixed annotations!"
    echo ""
    echo "📊 Updated Data Structure:"
    echo "  - Tasks 0-59:   Superuser only (60 tasks) ✅"
    echo "  - Tasks 60-74:  Regular user only (15 tasks) ❌"
    echo "  - Tasks 75-89:  Draft (15 tasks) ❌"
    echo "  - Tasks 90-99:  Mixed (superuser + regular) (10 tasks) ✅ (superuser part only)"
    echo ""
    echo "Expected API Result: 70 tasks (60 + 10 mixed)"
    echo ""
    echo "🧪 Test Commands:"
    echo ""
    echo "1. Count all valid tasks (should be 70):"
    echo "   curl -X POST http://localhost:8080/api/custom/export/ \\"
    echo "     -H \"Authorization: Token 2c00d45b8318a11f59e04c7233d729f3f17664e8\" \\"
    echo "     -H \"Content-Type: application/json\" \\"
    echo "     -d '{\"project_id\": 32, \"response_type\": \"count\"}'"
    echo ""
    echo "2. Check mixed annotations task (should return with superuser annotation only):"
    echo "   curl -X POST http://localhost:8080/api/custom/export/ \\"
    echo "     -H \"Authorization: Token 2c00d45b8318a11f59e04c7233d729f3f17664e8\" \\"
    echo "     -H \"Content-Type: application/json\" \\"
    echo "     -d '{\"project_id\": 32, \"response_type\": \"data\", \"page\": 1, \"page_size\": 100}' \\"
    echo "     | python3 -c \"import json,sys; data=json.load(sys.stdin); \\"
    echo "       mixed=[t for t in data['tasks'] if len(t.get('annotations',[])) > 0]; \\"
    echo "       print(f'Tasks with annotations: {len(mixed)}'); \\"
    echo "       print(f'All annotations are from superuser: {all(a.get(\\\"completed_by_info\\\",{}).get(\\\"is_superuser\\\") for t in mixed for a in t.get(\\\"annotations\\\", []))}')\""
    echo ""
else
    echo ""
    echo "❌ Failed to create annotations"
    echo "   Check Docker logs: docker logs $CONTAINER_NAME"
fi

# Cleanup
rm -f /tmp/create_annotations.py
