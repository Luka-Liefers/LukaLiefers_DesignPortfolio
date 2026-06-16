import http.server
import socketserver
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

PORT = 8123
Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving portfolio on http://localhost:{PORT}")
    httpd.serve_forever()
