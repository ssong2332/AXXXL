# 집 보기 시연판 로컬 서버(Node가 없을 때 쓰는 대체용). Python 3.8 이상, 추가 설치 없음.
# 사용: python server.py [--port 5180] [--open]
import argparse
import http.server
import os
import socketserver
import sys
import webbrowser

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")
CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; "
       "media-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'")


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".mjs": "text/javascript", ".woff2": "font/woff2", ".json": "application/json"}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def list_directory(self, path):
        self.send_error(404)  # 상태 줄에는 Latin-1만 들어가므로 한글 메시지를 넣지 않는다
        return None


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--port", type=int, default=5180)
    p.add_argument("--open", action="store_true")
    a = p.parse_args()
    socketserver.TCPServer.allow_reuse_address = True
    try:
        httpd = socketserver.ThreadingTCPServer(("127.0.0.1", a.port), Handler)
    except OSError:
        print(f"포트 {a.port}를 이미 쓰고 있어요. --port 5181 처럼 다른 번호로 실행해 주세요.")
        sys.exit(1)
    url = f"http://127.0.0.1:{a.port}/"
    print(f"집 보기 시연판: {url}  (이 컴퓨터에서만 열려요. 끄려면 Ctrl+C)")
    if a.open:
        webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("서버를 껐어요.")


if __name__ == "__main__":
    main()
