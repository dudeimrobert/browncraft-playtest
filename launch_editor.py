"""Open the Browncraft Realm Workshop on a stable local browser origin."""
from http.server import ThreadingHTTPServer
from launch import Handler
import argparse
import webbrowser

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Open the Browncraft level editor')
    parser.add_argument('--port', type=int, default=8080)
    args = parser.parse_args()
    try:
        server = ThreadingHTTPServer(('localhost', args.port), Handler)
    except OSError:
        parser.exit(1, f'Port {args.port} is busy. Close the existing editor server, or run with --port 8081.\n')
    url = f'http://localhost:{args.port}/level-editor.html'
    print(f'Browncraft Realm Workshop — Alpha 2.5.8\n{url}\nKeep this Terminal open. Press Control+C to stop.', flush=True)
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
