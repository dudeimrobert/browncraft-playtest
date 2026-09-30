"""Serve this build, never the terminal's working directory or cached scripts."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser

ROOT = Path(__file__).resolve().parent
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

if __name__ == '__main__':
    server = ThreadingHTTPServer(('localhost', 0), Handler)
    url = f'http://localhost:{server.server_port}/?build=2.4.8'
    print(f'Browncraft 2.4.8 — TRADER BILLBOARD\nServing: {ROOT}\nOpen: {url}', flush=True)
    webbrowser.open(url)
    server.serve_forever()
