#!/usr/bin/env python3
"""本地预览服务器（多线程）。

`python3 -m http.server` 是单线程的，页面并发拉 11 段视频时会排队，
偶发 ERR_CONNECTION_RESET。这里用 ThreadingHTTPServer 避免。

用法：python3 tools/serve.py [port]
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8899
ROOT = sys.argv[2] if len(sys.argv) > 2 else "site"


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):  # 静音访问日志
        pass


if __name__ == "__main__":
    handler = partial(Handler, directory=ROOT)
    with ThreadingHTTPServer(("127.0.0.1", PORT), handler) as httpd:
        print(f"serving {ROOT} at http://127.0.0.1:{PORT}/")
        httpd.serve_forever()
