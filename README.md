# 记忆闪卡系统

基于间隔重复算法(SM-2)的智能学习系统，支持Markdown和LaTeX数学公式。

## 📁 项目结构

```
├── app.py                    # Flask主程序
├── requirements.txt          # Python依赖
├── build_exe.py             # 打包脚本
├── pyinstaller_config.py    # PyInstaller配置
├── static/                  # 静态资源
│   ├── css/
│   │   └── style.css       # 样式文件
│   └── js/
│       └── script.js       # JavaScript逻辑
└── templates/
    └── index.html          # 主界面
```

## ✨ 核心功能

### 智能记忆算法
- 间隔重复算法(SM-2)，根据记忆曲线优化复习时间
- 三种评分：没记住(0) / 模糊(2) / 记住了(4)

### 复习模式
1. 列表无限循环
2. 随机无限循环
3. 列表单次
4. 随机单次
5. 薄弱项专项练习

### 内容管理
- 支持Markdown格式和LaTeX数学公式
- 卡片分类管理
- 导入/导出(CSV/TXT/Excel格式)
- 可折叠侧边栏，支持专注模式

## 🚀 快速使用

### 安装运行

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/memory-flashcards.git
cd memory-flashcards

# 2. 安装依赖
pip install -r requirements.txt

# 3. 启动服务
python app.py

# 4. 访问 http://localhost:5000
```

### 基本操作
1. **添加卡片**：左侧面板输入问题和答案（支持Markdown/LaTeX）
2. **复习卡片**：点击卡片翻转，根据记忆程度评分
3. **管理卡片**：按分类查看，支持批量选择和导入导出
4. **切换模式**：五种复习模式满足不同学习需求

### 打包为EXE

```bash
# 使用打包脚本
python build_exe.py
```

## 🛠 技术栈

### 后端
- **Flask** - Web框架
- **SQLite** - 数据库
- **Flask-SQLAlchemy** - ORM
- **SM-2算法** - 间隔重复算法

### 前端
- **HTML5/CSS3** - 响应式界面
- **JavaScript** - 交互逻辑
- **Marked.js** - Markdown渲染
- **KaTeX** - 数学公式渲染
- **SheetJS** - Excel处理

### 开发工具
- **PyInstaller** - 打包工具
- **Waitress** - WSGI服务器

## 📋 系统要求

- **开发环境**：Python 3.10+
- **运行环境**：Windows/Linux/macOS
- **浏览器**：Chrome/Firefox/Edge等现代浏览器
- **打包环境**：Windows系统可打包为exe文件
