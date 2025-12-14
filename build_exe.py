#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
简化版打包脚本 - 针对中文环境优化
"""

import os
import sys
import shutil
import subprocess
import tempfile


def print_step(step):
    print(f"\n{'=' * 60}")
    print(f"步骤: {step}")
    print(f"{'=' * 60}")


def check_dependencies():
    """检查依赖"""
    print_step("检查依赖")
    requirements = [
        'flask',
        'flask_sqlalchemy',
        'waitress',
        'pandas',
        'openpyxl',
        'pyinstaller',
    ]

    for package in requirements:
        try:
            __import__(package.replace('-', '_'))
            print(f"✓ {package}")
        except ImportError:
            print(f"✗ {package} 未安装")
            return False
    return True


def install_dependencies():
    """安装依赖"""
    print_step("安装依赖")
    try:
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'])
        return True
    except:
        print("手动安装依赖：pip install flask flask-sqlalchemy waitress pandas openpyxl pyinstaller")
        return False


def create_spec_file():
    """创建spec文件"""
    print_step("创建spec文件")

    spec_content = '''# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('static/css/style.css', 'static/css'),
        ('static/js/script.js', 'static/js'),
        ('templates/index.html', 'templates'),
    ],
    hiddenimports=[
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
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='MemoryFlashcards',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,  # 禁用UPX，避免兼容性问题
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # 不显示控制台窗口
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=[],
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='MemoryFlashcards',
)
'''

    with open('memory_flashcards.spec', 'w', encoding='utf-8') as f:
        f.write(spec_content)
    print("✓ spec文件创建成功")


def run_pyinstaller():
    """运行PyInstaller"""
    print_step("运行PyInstaller")

    # 清理旧的构建文件
    for dir_name in ['build', 'dist']:
        if os.path.exists(dir_name):
            shutil.rmtree(dir_name)

    # 使用简单的命令
    cmd = [
        sys.executable,
        '-m',
        'PyInstaller',
        'memory_flashcards.spec',
        '--clean'  # 清理缓存
    ]

    print(f"执行命令: {' '.join(cmd)}")

    try:
        # 设置环境变量，避免编码问题
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'

        # 运行命令，不捕获输出，直接在控制台显示
        result = subprocess.run(cmd, env=env, check=True)
        print("✓ PyInstaller执行成功")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ PyInstaller执行失败: {e}")
        return False
    except Exception as e:
        print(f"✗ 发生错误: {e}")
        return False


def create_launcher_bat():
    """创建启动批处理文件"""
    print_step("创建启动文件")

    bat_content = '''@echo off
chcp 65001 >nul
title 记忆闪卡系统

echo ========================================
echo       记忆闪卡系统 v1.0
echo ========================================
echo.

echo 正在启动系统，请稍候...
echo.

REM 检查是否已安装Microsoft Visual C++ Redistributable
echo 检查系统依赖...

REM 启动程序
start "" "MemoryFlashcards.exe"

echo.
echo 如果浏览器没有自动打开，请手动访问：
echo http://localhost:5000
echo.
echo 按任意键退出本窗口...
pause >nul
'''

    with open('启动记忆闪卡.bat', 'w', encoding='gbk') as f:
        f.write(bat_content)

    print("✓ 启动文件创建成功")


def create_readme():
    """创建说明文档"""
    print_step("创建说明文档")

    readme_content = '''# 记忆闪卡系统

## 系统要求
- Windows 7/8/10/11 64位
- 需要安装 [Microsoft Visual C++ Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe)

## 使用方法
1. 双击运行 "启动记忆闪卡.bat"
2. 系统会自动打开浏览器并启动服务
3. 访问地址: http://localhost:5000
4. 按 Ctrl+C 或关闭窗口停止服务

## 常见问题
1. 无法启动：请安装 Microsoft Visual C++ Redistributable
2. 端口占用：确保5000端口未被占用
3. 数据备份：定期备份 flashcards.db 文件

## 数据存储
- 数据库文件: flashcards.db
- 配置文件: 无
- 日志文件: 程序目录下的日志文件
'''

    with open('README.txt', 'w', encoding='utf-8') as f:
        f.write(readme_content)

    print("✓ 说明文档创建成功")


def copy_dist_files():
    """复制分发文件"""
    print_step("复制分发文件")

    # 创建分发目录
    dist_dir = '记忆闪卡系统'
    if os.path.exists(dist_dir):
        shutil.rmtree(dist_dir)
    os.makedirs(dist_dir)

    # 复制文件
    files_to_copy = [
        ('dist/MemoryFlashcards.exe', '记忆闪卡系统.exe'),
        ('启动记忆闪卡.bat', '启动记忆闪卡.bat'),
        ('README.txt', '说明.txt'),
    ]

    for src, dst in files_to_copy:
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(dist_dir, dst))
            print(f"✓ 复制: {dst}")
        else:
            print(f"✗ 文件不存在: {src}")

    print(f"\n✓ 分发文件已复制到: {dist_dir}/")


def main():
    """主函数"""
    print("\n" + "=" * 60)
    print("记忆闪卡系统 - 打包工具")
    print("=" * 60)

    try:
        # 1. 检查依赖
        if not check_dependencies():
            if not install_dependencies():
                print("请手动安装依赖后重试")
                return

        # 2. 创建spec文件
        create_spec_file()

        # 3. 运行PyInstaller
        if not run_pyinstaller():
            print("打包失败，请检查错误信息")
            return

        # 4. 创建启动文件
        create_launcher_bat()

        # 5. 创建说明文档
        create_readme()

        # 6. 复制分发文件
        copy_dist_files()

        print("\n" + "=" * 60)
        print("打包完成！")
        print("=" * 60)
        print("\n生成的文件：")
        print("1. 记忆闪卡系统/记忆闪卡系统.exe - 主程序")
        print("2. 记忆闪卡系统/启动记忆闪卡.bat - 启动脚本")
        print("3. 记忆闪卡系统/说明.txt - 说明文档")
        print("\n使用方法：")
        print("1. 将'记忆闪卡系统'文件夹复制到任何位置")
        print("2. 双击'启动记忆闪卡.bat'运行程序")
        print("3. 浏览器会自动打开 http://localhost:5000")
        print("=" * 60)

    except KeyboardInterrupt:
        print("\n用户取消操作")
    except Exception as e:
        print(f"\n发生错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
