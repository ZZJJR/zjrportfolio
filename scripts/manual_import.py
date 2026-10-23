#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""手动完成资料库 HTML/ZIP 导入（绕过 import_html.py 的 cosKey/confirmKey 字段错位）：
1. get-upload-credential → uploadUrl + confirmKey + headers
2. PUT 文件到 COS（带凭证 headers）
3. import-local-file（cosKey 字段传 confirmKey 值）
"""
import json
import os
import sys
import urllib.request

# 资料库脚本所在目录随客户端版本变化，优先读环境变量，避免写死后升级即失效
LIB_DIR = os.environ.get(
    'WB_LIBRARY_PATH',
    'D:/WorkBuddy/resources/app.asar.unpacked/resources/plugins/workbuddy-builtin/skills/library',
)
sys.path.insert(0, LIB_DIR)
try:
    import _common  # noqa: E402
except ImportError:
    print('无法导入 _common，请检查 WB_LIBRARY_PATH 是否指向资料库 skill 目录：', LIB_DIR)
    sys.exit(1)

TOKEN = os.environ.get('WB_TOKEN', '')
if len(sys.argv) > 1:
    TOKEN = sys.argv[1]          # 兼容旧用法
    print('提示：token 走命令行参数会留在 shell 历史里，建议改用环境变量 WB_TOKEN')
ZIP_PATH = sys.argv[2] if len(sys.argv) > 2 else 'portfolio-static.zip'
FILE_NAME = os.path.basename(ZIP_PATH)
TITLE = os.path.splitext(FILE_NAME)[0]

if not TOKEN:
    print('missing token：请设置环境变量 WB_TOKEN')
    sys.exit(1)

with open(ZIP_PATH, 'rb') as f:
    content = f.read()
size = len(content)
print('file:', FILE_NAME, size, 'bytes')

# ---- Step 1: 凭证 ----
cred = _common.unwrap_data(_common.http_request(
    'POST',
    _common.build_url('/space/api/agent/v1/get-upload-credential'),
    TOKEN,
    body={'fileName': FILE_NAME, 'fileSize': size},
    timeout=30.0,
))
upload_url = (cred.get('uploadUrl') or '').strip()
confirm_key = (cred.get('confirmKey') or cred.get('cosKey') or '').strip()
headers = cred.get('headers') or {}
# cosKey 取上传 URL 的完整对象路径（后端按整键拉取对象）
from urllib.parse import urlparse  # noqa: E402
cos_key = urlparse(upload_url).path.lstrip('/') or confirm_key
print('credential ok:', bool(upload_url), '| cosKey:', cos_key[:40] + '...')
if not upload_url or not confirm_key:
    print('FAILED: credential incomplete')
    sys.exit(1)

# ---- Step 2: PUT 上传（带凭证返回的 headers）----
req = urllib.request.Request(url=upload_url, data=content, method='PUT')
for k, v in headers.items():
    req.add_header(k, v)
try:
    with urllib.request.urlopen(req, timeout=120) as resp:
        print('PUT status:', resp.status)
        if not (200 <= resp.status < 300):
            print('FAILED: PUT non-2xx')
            sys.exit(1)
except Exception as e:  # noqa: BLE001
    print('FAILED: PUT error:', e)
    sys.exit(1)

# ---- Step 3: 触发导入（drive 式：confirmKey + taskId）----
import_body = {
    'confirmKey': confirm_key,
    'fileName': FILE_NAME,
    'fileSize': size,
    'title': TITLE,
}
task_id = (cred.get('taskId') or '').strip()
if task_id:
    import_body['taskId'] = task_id
# 重导入：覆盖已有节点
node_block_id = os.environ.get('WB_NODE_ID', '').strip()
if node_block_id:
    import_body['nodeBlockId'] = node_block_id
try:
    data = _common.unwrap_data(_common.http_request(
        'POST',
        _common.build_url('/space/api/agent/v1/import-local-file'),
        TOKEN,
        body=import_body,
        timeout=60.0,
    ))
except Exception as e:  # noqa: BLE001
    print('FAILED: import error:', e)
    sys.exit(1)

node_block_id = (data.get('nodeBlockId') or '').strip()
node_kind = (data.get('nodeKind') or '').strip()
url = (data.get('url') or '').strip()
publish_url = (data.get('publishUrl') or '').strip()
print('IMPORT_OK ' + json.dumps({
    'node_block_id': node_block_id,
    'node_kind': node_kind,
    'file_name': FILE_NAME,
    'url': url,
    'publish_url': publish_url,
}, ensure_ascii=False))
