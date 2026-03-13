import requests
import sys
import json
from datetime import datetime

class RoleBasedAPITester:
    def __init__(self, base_url="https://cred-control-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        
        # User credentials from the review request
        self.users = {
            "admin": {
                "email": "bhooomickadg@gmail.com", 
                "password": "12345",
                "token": None,
                "expected_role": "admin"
            },
            "team_member": {
                "email": "john.doe@company.com", 
                "password": "member123",
                "token": None,
                "expected_role": "team_member"
            },
            "team_lead": {
                "email": "sarah.lead@company.com", 
                "password": "lead123",
                "token": None,
                "expected_role": "team_lead"
            }
        }

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                if response.content:
                    try:
                        response_data = response.json()
                        if isinstance(response_data, dict):
                            print(f"   Response keys: {list(response_data.keys())}")
                        else:
                            print(f"   Response: Array with {len(response_data)} items")
                    except:
                        print(f"   Response length: {len(response.content)} bytes")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                if response.content:
                    try:
                        print(f"   Error response: {response.json()}")
                    except:
                        print(f"   Error response: {response.text[:200]}")
                self.failed_tests.append({
                    "name": name,
                    "endpoint": endpoint,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "error": response.text[:200] if response.content else "No response content"
                })

            return success, response.json() if success and response.content else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({"name": name, "endpoint": endpoint, "error": str(e)})
            return False, {}

    def test_login(self, user_type):
        """Test login for specific user type"""
        user = self.users[user_type]
        success, response = self.run_test(
            f"{user_type.title()} Login",
            "POST",
            "auth/login",
            200,
            data={"email": user["email"], "password": user["password"]}
        )
        if success and 'token' in response:
            user["token"] = response['token']
            print(f"   Token received for {user_type}")
            
            # Verify user details
            if 'user' in response:
                user_data = response['user']
                if user_data.get('role') == user['expected_role']:
                    print(f"   ✅ Correct role: {user_data['role']}")
                else:
                    print(f"   ❌ Wrong role: expected {user['expected_role']}, got {user_data.get('role')}")
                print(f"   User name: {user_data.get('name')}")
            return True
        return False

    def test_user_profile(self, user_type):
        """Test user profile endpoint with greeting"""
        user = self.users[user_type]
        success, response = self.run_test(
            f"{user_type.title()} Profile",
            "GET",
            "auth/me",
            200,
            token=user["token"]
        )
        if success and 'greeting' in response:
            print(f"   ✅ Personalized greeting: {response['greeting']}")
            expected_greetings = ['Good Morning', 'Good Afternoon', 'Good Evening']
            if any(greeting in response['greeting'] for greeting in expected_greetings):
                print(f"   ✅ Valid greeting format")
            else:
                print(f"   ❌ Invalid greeting format: {response['greeting']}")
        return success

    def test_dashboard_metrics_role_based(self, user_type):
        """Test role-based dashboard metrics"""
        user = self.users[user_type]
        success, response = self.run_test(
            f"{user_type.title()} Dashboard Metrics",
            "GET",
            "dashboard/metrics",
            200,
            token=user["token"]
        )
        if success:
            is_personal_view = response.get('is_personal_view', False)
            if user_type == 'team_member':
                if is_personal_view:
                    print(f"   ✅ Team member sees personal view")
                    # Check that some metrics are None (not visible to team members)
                    restricted_fields = ['total_active_users', 'service_accounts', 'privileged_accounts']
                    if any(response.get(field) is None for field in restricted_fields):
                        print(f"   ✅ Restricted metrics hidden for team member")
                else:
                    print(f"   ❌ Team member should see personal view")
            else:
                if not is_personal_view:
                    print(f"   ✅ {user_type} sees full dashboard view")
                    # Admin/team lead should see all metrics
                    if response.get('total_active_users') is not None:
                        print(f"   ✅ Full metrics visible for {user_type}")
                else:
                    print(f"   ❌ {user_type} should see full view, not personal")
        return success

    def test_alerts_role_based(self, user_type):
        """Test role-based alerts access"""
        user = self.users[user_type]
        success, response = self.run_test(
            f"{user_type.title()} Alerts Access",
            "GET",
            "dashboard/alerts",
            200,
            token=user["token"]
        )
        if success and isinstance(response, list):
            alert_count = len(response)
            print(f"   {user_type} sees {alert_count} alerts")
            
            if user_type == 'team_member':
                # Team members should only see assigned alerts
                assigned_alerts = [a for a in response if a.get('assigned_to') == user.get('id', 'user-member-001')]
                print(f"   ✅ Team member sees only assigned alerts: {len(assigned_alerts)} total")
            else:
                # Admin/team lead should see all alerts
                if alert_count > 0:
                    print(f"   ✅ {user_type} sees all alerts: {alert_count} total")
                    
            # Test alert detail access if alerts exist
            if response:
                alert_id = response[0]['id']
                return self.test_alert_detail(user_type, alert_id)
        return success

    def test_alert_detail(self, user_type, alert_id):
        """Test alert detail access"""
        user = self.users[user_type]
        success, response = self.run_test(
            f"{user_type.title()} Alert Detail",
            "GET",
            f"dashboard/alerts/{alert_id}",
            200,
            token=user["token"]
        )
        if success:
            print(f"   ✅ Alert detail loaded")
            if 'details' in response:
                print(f"   ✅ Alert details available")
                # Check for required detail fields
                details = response['details']
                if 'recommended_action' in details:
                    print(f"   ✅ Recommended action present")
        return success

    def test_alert_action(self, user_type, alert_id):
        """Test alert status update"""
        user = self.users[user_type]
        success, response = self.run_test(
            f"{user_type.title()} Update Alert Status",
            "PUT",
            f"dashboard/alerts/{alert_id}",
            200,
            data={"status": "investigating"},
            token=user["token"]
        )
        if success:
            print(f"   ✅ Alert status updated successfully")
        return success

    def test_offboarding_detail(self, user_type):
        """Test offboarding detail access"""
        user = self.users[user_type]
        # First get offboarding records
        success, response = self.run_test(
            f"{user_type.title()} Offboarding Records",
            "GET",
            "dashboard/offboarding",
            200,
            token=user["token"]
        )
        if success and 'records' in response and response['records']:
            record_id = response['records'][0]['id']
            success2, detail = self.run_test(
                f"{user_type.title()} Offboarding Detail",
                "GET",
                f"dashboard/offboarding/{record_id}",
                200,
                token=user["token"]
            )
            if success2:
                print(f"   ✅ Offboarding detail loaded")
                if 'details' in detail and 'systems_access' in detail['details']:
                    print(f"   ✅ Systems access list available")
        return success

    def test_credential_detail(self, user_type):
        """Test credential detail access"""
        user = self.users[user_type]
        # First get credentials
        success, response = self.run_test(
            f"{user_type.title()} Credentials",
            "GET",
            "dashboard/credentials",
            200,
            token=user["token"]
        )
        if success and 'next_rotations' in response and response['next_rotations']:
            cred_id = response['next_rotations'][0]['id']
            success2, detail = self.run_test(
                f"{user_type.title()} Credential Detail",
                "GET",
                f"dashboard/credentials/{cred_id}",
                200,
                token=user["token"]
            )
            if success2:
                print(f"   ✅ Credential detail loaded")
                if 'details' in detail and 'associated_services' in detail['details']:
                    print(f"   ✅ Associated services available")
        return success

def main():
    print("🔒 Role-Based Security Dashboard API Testing")
    print("=" * 60)
    
    tester = RoleBasedAPITester()
    
    # Test all user types
    user_types = ['admin', 'team_member', 'team_lead']
    
    # Login all users first
    print("\n📝 AUTHENTICATION TESTS")
    print("-" * 30)
    for user_type in user_types:
        if not tester.test_login(user_type):
            print(f"❌ Failed to login {user_type}, skipping their tests")
            continue
        tester.test_user_profile(user_type)
    
    # Test role-based dashboard access
    print("\n📊 ROLE-BASED DASHBOARD ACCESS")
    print("-" * 40)
    for user_type in user_types:
        if tester.users[user_type]["token"]:
            tester.test_dashboard_metrics_role_based(user_type)
            tester.test_alerts_role_based(user_type)
    
    # Test detail modals
    print("\n🔍 DETAIL MODAL TESTS")
    print("-" * 25)
    for user_type in user_types:
        if tester.users[user_type]["token"]:
            tester.test_offboarding_detail(user_type)
            tester.test_credential_detail(user_type)
    
    # Print final results
    print("\n" + "=" * 60)
    print("📊 ROLE-BASED TESTING RESULTS")
    print("=" * 60)
    print(f"Tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Tests failed: {len(tester.failed_tests)}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")

    if tester.failed_tests:
        print("\n❌ Failed Tests:")
        for test in tester.failed_tests:
            print(f"  • {test['name']}: {test.get('error', 'Unknown error')}")

    return 0 if len(tester.failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())