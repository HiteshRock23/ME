import urllib.request

url = "http://127.0.0.1:8000/auth"
try:
    req = urllib.request.Request(url, method='HEAD')
    with urllib.request.urlopen(req) as response:
        print("STATUS:", response.status)
        print("HEADERS:")
        for key, val in response.headers.items():
            print(f"  {key}: {val}")
except Exception as e:
    print("Error:", e)
