"""Local dev server for PopPOS: serves this folder with caching disabled.
Usage: python devserver.py [port]   ->  http://localhost:5173 (default port)"""
import functools, http.server, os, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.webmanifest': 'application/manifest+json'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get('PORT', 5173))
root = os.path.dirname(os.path.abspath(__file__))
print(f'PopPOS dev server: http://localhost:{port}  (tests: http://localhost:{port}/tests/)')
http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(NoCache, directory=root)).serve_forever()
