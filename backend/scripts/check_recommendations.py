# -*- coding: utf-8 -*-
import urllib.request, json, sys, urllib.parse
sys.stdout.reconfigure(encoding='utf-8')

# Login
data = urllib.parse.urlencode({'username': 'demo_farmer', 'password': 'demo1234'}).encode()
req = urllib.request.Request('http://localhost:8000/api/v1/auth/login', data=data)
req.add_header('Content-Type', 'application/x-www-form-urlencoded')
with urllib.request.urlopen(req) as r:
    token = json.loads(r.read())['access_token']

print(f"Token OK: {token[:20]}...")

# Get recommendations
req2 = urllib.request.Request('http://localhost:8000/api/v1/recommendations/2')
req2.add_header('Authorization', f'Bearer {token}')
with urllib.request.urlopen(req2) as r:
    raw = r.read().decode('utf-8')
    recs = json.loads(raw)

print(f"Total: {len(recs)} recommendations\n")
for rec in recs:
    print(f"id={rec['id']}  [{rec['category']} / {rec['severity']}]")
    print(f"message: {rec['message']}")
    print()
