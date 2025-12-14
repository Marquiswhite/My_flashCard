#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
PyInstaller 打包配置文件
"""

import os
import sys
from pathlib import Path

# 项目根目录
BASE_DIR = Path(__file__).parent

# 收集所有需要打包的文件
datas = []

# 1. 静态文件
static_files = [
    ('static/css/style.css', 'static/css'),
    ('static/js/script.js', 'static/js'),
]

# 2. 模板文件
template_files = [
    ('templates/index.html', 'templates'),
]

# 3. 其他资源文件（如果有）
other_files = []

# 合并所有文件
all_files = static_files + template_files + other_files

for src, dst in all_files:
    src_path = BASE_DIR / src
    if src_path.exists():
        datas.append((str(src_path), dst))

# 隐藏的导入（PyInstaller无法自动检测的模块）
hiddenimports = [
    'flask',
    'flask_sqlalchemy',
    'werkzeug.security',
    'werkzeug.datastructures',
    'werkzeug.wrappers',
    'sqlalchemy.ext.declarative',
    'sqlalchemy.orm',
    'sqlalchemy.sql.default_comparator',
    'jinja2.ext',
    'pandas',
    'openpyxl',
    'openpyxl.worksheet._writer',
    'waitress',
]

# 排除的模块
excludes = [
    'matplotlib',
    'scipy',
    'numpy',
    'pytest',
    'tkinter',
    'PyQt5',
    'PySide2',
    'notebook',
    'jupyter',
]

# 运行时钩子
hooks = []

# 创建 spec 文件配置
spec_config = {
    'name': '记忆闪卡系统',
    'entry_point': 'app.py',
    'datas': datas,
    'hiddenimports': hiddenimports,
    'excludes': excludes,
    'hooks': hooks,
    'onefile': True,  # 打包成单个exe文件
    'console': False,  # 不显示控制台窗口
    'icon': 'flashcard.ico' if os.path.exists('flashcard.ico') else None,
    'version': '1.0.0',
    'company': '记忆闪卡工作室',
    'product': '记忆闪卡系统',
}

if __name__ == '__main__':
    print("PyInstaller 配置信息:")
    print(f"项目目录: {BASE_DIR}")
    print(f"数据文件: {len(datas)} 个")
    print(f"隐藏导入: {len(hiddenimports)} 个")
