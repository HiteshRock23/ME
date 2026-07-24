import requests

url = "http://127.0.0.1:8000/api/auth/google/"

try:
    r = requests.post(url, json={"credential": "invalid_fake_token_123"})
    print("Status Code:", r.status_code)
    with open("scratch/error.html", "w", encoding="utf-8") as f:
        f.write(r.text)
    print("Wrote error HTML to scratch/error.html")
except Exception as e:
    print("Failed:", e)
