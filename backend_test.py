import requests
import sys
import json
from datetime import datetime

class SentinelDashboardAPITester:
    def __init__(self, base_url="https://cred-control-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

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
                        print(f"   Response keys: {list(response_data.keys()) if isinstance(response_data, dict) else 'Array with ' + str(len(response_data)) + ' items'}")
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

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout")
            self.failed_tests.append({"name": name, "endpoint": endpoint, "error": "Request timeout"})
            return False, {}
        except requests.exceptions.ConnectionError:
            print(f"❌ Failed - Connection error")
            self.failed_tests.append({"name": name, "endpoint": endpoint, "error": "Connection error"})
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({"name": name, "endpoint": endpoint, "error": str(e)})
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API",
            "GET",
            "",
            200
        )
        return success

    def test_login(self, email, password):
        """Test login and get token"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'token' in response:
            self.token = response['token']
            print(f"   Token received: {self.token[:20]}...")
            return True
        return False

    def test_auth_me(self):
        """Test user profile endpoint"""
        success, response = self.run_test(
            "Get User Profile",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_dashboard_metrics(self):
        """Test dashboard metrics endpoint"""
        success, response = self.run_test(
            "Dashboard Metrics",
            "GET",
            "dashboard/metrics",
            200
        )
        if success:
            expected_keys = ['total_active_users', 'service_accounts', 'privileged_accounts', 'flagged_accounts', 'credentials_due_rotation']
            missing_keys = [key for key in expected_keys if key not in response]
            if missing_keys:
                print(f"   ⚠️  Missing keys: {missing_keys}")
        return success

    def test_dashboard_alerts(self):
        """Test dashboard alerts endpoint"""
        success, response = self.run_test(
            "Dashboard Alerts",
            "GET",
            "dashboard/alerts",
            200
        )
        if success and isinstance(response, list):
            print(f"   Alerts count: {len(response)}")
            if response:
                alert_keys = list(response[0].keys())
                print(f"   Alert structure: {alert_keys}")
        return success

    def test_alerts_chart(self):
        """Test alerts chart data endpoint"""
        success, response = self.run_test(
            "Alerts Chart Data",
            "GET",
            "dashboard/alerts-chart",
            200
        )
        if success and isinstance(response, list):
            print(f"   Chart data points: {len(response)}")
        return success

    def test_access_hygiene(self):
        """Test access hygiene endpoint"""
        success, response = self.run_test(
            "Access Hygiene",
            "GET",
            "dashboard/access-hygiene",
            200
        )
        if success:
            expected_keys = ['overprivileged_accounts', 'stale_accounts', 'policy_violations']
            missing_keys = [key for key in expected_keys if key not in response]
            if missing_keys:
                print(f"   ⚠️  Missing keys: {missing_keys}")
        return success

    def test_offboarding(self):
        """Test offboarding tracker endpoint"""
        success, response = self.run_test(
            "Offboarding Tracker",
            "GET",
            "dashboard/offboarding",
            200
        )
        if success:
            expected_keys = ['records', 'average_revoke_time']
            missing_keys = [key for key in expected_keys if key not in response]
            if missing_keys:
                print(f"   ⚠️  Missing keys: {missing_keys}")
            elif 'records' in response:
                print(f"   Offboarding records: {len(response['records'])}")
        return success

    def test_credentials(self):
        """Test credential rotation endpoint"""
        success, response = self.run_test(
            "Credential Rotation",
            "GET",
            "dashboard/credentials",
            200
        )
        if success:
            expected_keys = ['on_schedule_percent', 'overdue_percent', 'next_rotations']
            missing_keys = [key for key in expected_keys if key not in response]
            if missing_keys:
                print(f"   ⚠️  Missing keys: {missing_keys}")
        return success

    def test_compliance(self):
        """Test compliance status endpoint"""
        success, response = self.run_test(
            "Compliance Status",
            "GET",
            "dashboard/compliance",
            200
        )
        if success:
            expected_keys = ['cis_benchmarks', 'audit_readiness_score']
            missing_keys = [key for key in expected_keys if key not in response]
            if missing_keys:
                print(f"   ⚠️  Missing keys: {missing_keys}")
            elif 'cis_benchmarks' in response:
                print(f"   CIS benchmarks: {len(response['cis_benchmarks'])}")
        return success

    def test_notifications(self):
        """Test notifications endpoint"""
        success, response = self.run_test(
            "Notifications",
            "GET",
            "dashboard/notifications",
            200
        )
        if success and isinstance(response, list):
            print(f"   Notifications count: {len(response)}")
            unread_count = sum(1 for n in response if not n.get('read', True))
            print(f"   Unread notifications: {unread_count}")
        return success

    def test_mark_notification_read(self):
        """Test mark notification as read"""
        success, response = self.run_test(
            "Mark Notification Read",
            "POST",
            "dashboard/notifications/1/read",
            200
        )
        return success

    def test_invalid_login(self):
        """Test login with invalid credentials"""
        success, response = self.run_test(
            "Invalid Login Test",
            "POST",
            "auth/login",
            401,
            data={"email": "invalid@test.com", "password": "wrongpass"}
        )
        return success

    def test_unauthorized_access(self):
        """Test accessing protected endpoint without token"""
        # Temporarily remove token
        temp_token = self.token
        self.token = None
        
        success, response = self.run_test(
            "Unauthorized Access Test",
            "GET",
            "dashboard/metrics",
            401
        )
        
        # Restore token
        self.token = temp_token
        return success

def main():
    print("🔒 Sentinel Dashboard API Testing Suite")
    print("=" * 50)
    
    # Setup
    tester = SentinelDashboardAPITester()
    test_email = "bhooomickadg@gmail.com"
    test_password = "12345"

    # Test sequence
    tests = [
        ("Root API", lambda: tester.test_root_endpoint()),
        ("Login", lambda: tester.test_login(test_email, test_password)),
        ("User Profile", lambda: tester.test_auth_me()),
        ("Dashboard Metrics", lambda: tester.test_dashboard_metrics()),
        ("Dashboard Alerts", lambda: tester.test_dashboard_alerts()),
        ("Alerts Chart", lambda: tester.test_alerts_chart()),
        ("Access Hygiene", lambda: tester.test_access_hygiene()),
        ("Offboarding Tracker", lambda: tester.test_offboarding()),
        ("Credential Rotation", lambda: tester.test_credentials()),
        ("Compliance Status", lambda: tester.test_compliance()),
        ("Notifications", lambda: tester.test_notifications()),
        ("Mark Notification Read", lambda: tester.test_mark_notification_read()),
        ("Invalid Login", lambda: tester.test_invalid_login()),
        ("Unauthorized Access", lambda: tester.test_unauthorized_access())
    ]

    # Run all tests
    for test_name, test_func in tests:
        if not test_func():
            print(f"\n⚠️  Critical failure in {test_name}, continuing with remaining tests...")

    # Print final results
    print("\n" + "=" * 50)
    print("📊 FINAL TEST RESULTS")
    print("=" * 50)
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