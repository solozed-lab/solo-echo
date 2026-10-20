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
    # HTTP/1.1 + keep-alive：浏览器会复用连接，少一次握手一次重置，
    # 行为也更接近真实服务器（默认 HTTP/1.0 是"一个请求一条连接"）
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):  # 静音访问日志
        pass

    def handle_one_request(self):
        try:
            super().handle_one_request()
        except (ConnectionResetError, BrokenPipeError):
            # 客户端在下载中途断开（刷新/切页），不是服务器错误
            self.close_connection = True


if __name__ == "__main__":
    handler = partial(Handler, directory=ROOT)
    with ThreadingHTTPServer(("127.0.0.1", PORT), handler) as httpd:
        print(f"serving {ROOT} at http://127.0.0.1:{PORT}/")
        httpd.serve_forever()
