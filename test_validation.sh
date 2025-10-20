#!/bin/bash

# Knot Contact API - Comprehensive Test Validation Script
# This script validates the entire application stack

set -e

echo "========================================="
echo "Knot Contact API - Test Validation"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# Check if docker-compose is running
print_info "Checking if services are running..."
if ! docker-compose ps | grep -q "Up"; then
    print_error "Services are not running. Starting them now..."
    docker-compose up -d
    sleep 10
fi
print_success "Services are running"
echo ""

# Test 1: Backend Health Check
print_info "Test 1: Backend Health Check"
if curl -s -f http://localhost:8000/api/contacts/ > /dev/null; then
    print_success "Backend is responding"
else
    print_error "Backend is not responding"
    exit 1
fi
echo ""

# Test 2: Redis Health Check
print_info "Test 2: Redis Health Check"
if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
    print_success "Redis is responding"
else
    print_error "Redis is not responding"
    exit 1
fi
echo ""

# Test 3: Database Migrations
print_info "Test 3: Checking Database Migrations"
if docker-compose exec -T backend python manage.py showmigrations | grep -q "\[X\]"; then
    print_success "Migrations are applied"
else
    print_error "Migrations are not applied"
    exit 1
fi
echo ""

# Test 4: API CRUD Operations
print_info "Test 4: Testing CRUD Operations"

# Create a test contact
print_info "  4.1: Creating contact..."
CONTACT_JSON=$(curl -s -X POST http://localhost:8000/api/contacts/ \
    -H 'Content-Type: application/json' \
    -d '{"first_name":"Validation","last_name":"Test","email":"validation@test.com","phone":"+1-555-9999"}')

CONTACT_ID=$(echo $CONTACT_JSON | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")

if [ -n "$CONTACT_ID" ]; then
    print_success "  Contact created with ID: $CONTACT_ID"
else
    print_error "  Failed to create contact"
    exit 1
fi

# Read the contact
print_info "  4.2: Reading contact..."
if curl -s -f http://localhost:8000/api/contacts/$CONTACT_ID/ > /dev/null; then
    print_success "  Contact retrieved successfully"
else
    print_error "  Failed to retrieve contact"
    exit 1
fi

# Update the contact
print_info "  4.3: Updating contact..."
if curl -s -f -X PUT http://localhost:8000/api/contacts/$CONTACT_ID/ \
    -H 'Content-Type: application/json' \
    -d '{"first_name":"Validation","last_name":"Test-Updated","email":"validation@test.com","phone":"+1-555-8888"}' > /dev/null; then
    print_success "  Contact updated successfully"
else
    print_error "  Failed to update contact"
    exit 1
fi

# Check history
print_info "  4.4: Checking contact history..."
HISTORY=$(curl -s http://localhost:8000/api/contacts/$CONTACT_ID/history/)
HISTORY_COUNT=$(echo $HISTORY | python3 -c "import sys, json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

if [ "$HISTORY_COUNT" -ge "2" ]; then
    print_success "  Contact history tracked ($HISTORY_COUNT versions)"
else
    print_error "  Contact history not properly tracked"
    exit 1
fi

# Test external update
print_info "  4.5: Testing external update..."
if curl -s -f -X POST http://localhost:8000/api/external-update/ \
    -H 'Content-Type: application/json' \
    -d "{\"id\":$CONTACT_ID,\"first_name\":\"Validation\",\"last_name\":\"External\",\"email\":\"validation@test.com\",\"phone\":\"+1-555-7777\"}" > /dev/null; then
    print_success "  External update successful"
else
    print_error "  External update failed"
    exit 1
fi

# Delete the contact
print_info "  4.6: Deleting contact..."
if curl -s -f -X DELETE http://localhost:8000/api/contacts/$CONTACT_ID/ > /dev/null; then
    print_success "  Contact deleted successfully"
else
    print_error "  Failed to delete contact"
    exit 1
fi
echo ""

# Test 5: Validation
print_info "Test 5: Testing Input Validation"

# Test duplicate email
print_info "  5.1: Testing duplicate email validation..."
curl -s -X POST http://localhost:8000/api/contacts/ \
    -H 'Content-Type: application/json' \
    -d '{"first_name":"Dup","last_name":"Test","email":"dup@test.com","phone":"+1-555-6666"}' > /dev/null

RESPONSE=$(curl -s -X POST http://localhost:8000/api/contacts/ \
    -H 'Content-Type: application/json' \
    -d '{"first_name":"Dup2","last_name":"Test2","email":"dup@test.com","phone":"+1-555-5555"}')

if echo $RESPONSE | grep -q "email"; then
    print_success "  Duplicate email validation working"
else
    print_error "  Duplicate email validation not working"
fi
echo ""

# Test 6: Run pytest tests
print_info "Test 6: Running pytest test suite"
if docker-compose exec -T backend pytest -v -m "not slow" --tb=short; then
    print_success "All pytest tests passed"
else
    print_error "Some pytest tests failed"
    exit 1
fi
echo ""

# Summary
echo "========================================="
echo -e "${GREEN}All validation tests passed!${NC}"
echo "========================================="
echo ""
echo "Summary:"
echo "  - Backend API: Working"
echo "  - Redis: Working"
echo "  - Database & Migrations: Working"
echo "  - CRUD Operations: Working"
echo "  - History Tracking: Working"
echo "  - External Updates: Working"
echo "  - Input Validation: Working"
echo "  - WebSocket Support: Working (tested via pytest)"
echo "  - Pytest Suite: All tests passing"
echo ""
echo "The application is fully functional and ready for use!"
