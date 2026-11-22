"""Serve the GameDojo site on http://localhost and open it in the browser.

Double-click start.bat (Windows) or run ./start.sh (macOS / Linux). Needs only Python 3 (standard library).
The site is plain static files; a local server is used instead of opening index.html straight from disk because
browsers restrict some features on file:// pages (video seeking, mouse lock in the 3D games).
"""
import http.server
import mimetypes
import os
import socket
import socketserver
import sys
import threading
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
mimetypes.add_type("video/mp4", ".mp4")
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("image/svg+xml", ".svg")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, fmt, *args):   # keep the console quiet
        pass

    def handle(self):                    # a browser cancelling a video range request is not an error
        try:
            super().handle()
        except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError):
            pass

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    # Byte ranges: browsers request videos in pieces ("Range: bytes=a-b"). The standard library server always
    # answers 200 with the whole file, which breaks seeking and makes Safari refuse to play the clips at all.
    def send_head(self):
        rng = self.headers.get("Range")
        path = self.translate_path(self.path)
        if not rng or not rng.startswith("bytes=") or os.path.isdir(path) or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        try:
            first, _, last = rng[6:].split(",")[0].strip().partition("-")
            if first == "":                      # "bytes=-N": the last N bytes
                start, end = max(0, size - int(last)), size - 1
            else:
                start, end = int(first), (int(last) if last else size - 1)
            end = min(end, size - 1)
            if start > end or start >= size:
                raise ValueError
        except ValueError:
            self.send_response(416)
            self.send_header("Content-Range", "bytes */%d" % size)
            self.end_headers()
            return None
        f = open(path, "rb")
        f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        self._remaining = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        left = getattr(self, "_remaining", None)
        if left is None:
            return super().copyfile(source, outputfile)
        self._remaining = None
        while left > 0:
            chunk = source.read(min(65536, left))
            if not chunk:
                break
            outputfile.write(chunk)
            left -= len(chunk)


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    request_queue_size = 128             # the page loads many clips at once


def free_port(start=8800):
    for port in range(start, start + 50):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise SystemExit("No free port between %d and %d." % (start, start + 49))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else free_port()
    httpd = Server(("127.0.0.1", port), Handler)
    url = "http://localhost:%d/" % port
    print("GameDojo site running at %s" % url)
    print("Close this window (or press Ctrl+C) to stop.")
    threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
