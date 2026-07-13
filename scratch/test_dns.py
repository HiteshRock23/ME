import urllib.request
import json

print("Testing general internet connectivity (httpbin)...")
try:
    response = urllib.request.urlopen("https://httpbin.org/ip", timeout=10)
    print("General internet: OK")
    print(response.read().decode())
except Exception as e:
    print(f"General internet FAILED: {e}")

print("\nTesting NVIDIA endpoint DNS/TCP connect...")
try:
    import socket
    socket.setdefaulttimeout(10)
    addr = socket.gethostbyname("integrate.api.nvidia.com")
    print(f"NVIDIA API DNS resolve: {addr}")
    
    # Try connecting to port 443
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect(("integrate.api.nvidia.com", 443))
    print("NVIDIA TCP Port 443 connect: OK")
    s.close()
except Exception as e:
    print(f"NVIDIA TCP connect FAILED: {e}")
