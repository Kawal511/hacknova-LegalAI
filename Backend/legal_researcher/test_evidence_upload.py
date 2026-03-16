import requests
import sys

base_url = "http://localhost:8000/legal"
user_id = 1

# 1. Create Case
print("Creating case...")
case_data = {
    "client_name": "Test Evidence User",
    "case_type": "Civil",
    "legal_issue_summary": "Testing evidence upload functionality"
}
try:
    res = requests.post(f"{base_url}/cases/manual?user_id={user_id}", json=case_data)
    if not res.ok:
        print(f"Failed to create case: {res.text}")
        sys.exit(1)
    case_json = res.json()
    case_id = case_json.get('case_id')
    print(f"Created Case ID: {case_id}")
except Exception as e:
    print(f"Error creating case: {e}")
    sys.exit(1)

# 2. Upload Evidence
url = f"{base_url}/evidence/analyze-image"

try:
    f = open('test_evidence.jpeg', 'rb')
except Exception as e:
    print(f"File not found: {e}")
    sys.exit(1)

files = {'file': f}
data = {
    'case_id': case_id,
    'user_id': user_id,
    'description': 'Test evidence from user'
}

print(f"Uploading evidence to {url}...")
try:
    response = requests.post(url, files=files, data=data)
    print(f"Status: {response.status_code}")
    print("Response JSON:")
    try:
        j = response.json()
        print(j)
        if j.get('success'):
            print("\nAnalysis Result:")
            print(j.get('analysis'))
    except:
        print(response.text)
except Exception as e:
    print(f"Request failed: {e}")
