from flask import Flask, render_template, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import csv
import io
import json
import pandas as pd
from werkzeug.utils import secure_filename
import os
import sys


# 获取程序的实际路径（支持打包后运行）
def get_base_dir():
    """获取程序基础目录，支持开发环境和打包环境"""
    if hasattr(sys, '_MEIPASS'):  # PyInstaller打包后的临时目录
        base_dir = sys._MEIPASS
    else:  # 开发环境
        base_dir = os.path.dirname(os.path.abspath(__file__))
    return base_dir

# 初始化Flask应用
app = Flask(__name__,
            static_folder=os.path.join(get_base_dir(), 'static'),
            template_folder=os.path.join(get_base_dir(), 'templates'))

# 数据库配置 - 使用绝对路径
db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'flashcards.db')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///flashcards.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['SECRET_KEY'] = 'flashcard-secret-key-2024'  # 添加密钥

db = SQLAlchemy(app)



# 数据库模型 - 重构为满足三大范式
class Category(db.Model):
    """分类表 - 满足第一范式（原子性）"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False, default='默认分类')
    created_date = db.Column(db.DateTime, default=datetime.utcnow)
    description = db.Column(db.Text, nullable=True)

    # 关系
    cards = db.relationship('Flashcard', backref='card_category', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Category {self.id}: {self.name}>'


class Flashcard(db.Model):
    """闪卡表 - 满足第二范式（消除部分依赖）"""
    id = db.Column(db.Integer, primary_key=True)
    front = db.Column(db.Text, nullable=False)
    back = db.Column(db.Text, nullable=False)
    created_date = db.Column(db.DateTime, default=datetime.utcnow)

    # 外键关联分类 - 满足第三范式（消除传递依赖）
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=False, default=1)

    # 间隔重复算法相关字段
    repetition = db.Column(db.Integer, default=0)  # 重复次数
    interval = db.Column(db.Float, default=0)  # 下次复习间隔(天)
    ease_factor = db.Column(db.Float, default=2.5)  # 易度因子
    next_review = db.Column(db.DateTime, default=datetime.utcnow)  # 下次复习时间

    def __repr__(self):
        return f'<Flashcard {self.id}: {self.front[:50]}...>'

    @property
    def category_name(self):
        """获取分类名称的便捷属性"""
        return self.card_category.name if self.card_category else '默认分类'

    def update_after_review(self, quality):
        """
        根据SM-2算法更新卡片参数
        现在quality只有三个值：0(没记住), 2(模糊), 4(记住了)
        """
        if quality < 2:  # 0: 没记住
            # 回答错误，重置间隔
            self.repetition = 0
            self.interval = 0
        elif quality == 2:  # 模糊
            # 中等记忆，按较低质量处理
            if self.repetition == 0:
                self.interval = 1
            else:
                self.interval = max(1, self.interval * 0.5)  # 减少间隔
            self.repetition = max(0, self.repetition - 1)
        else:  # 4: 记住了
            # 回答正确，正常更新
            if self.repetition == 0:
                self.interval = 1
            elif self.repetition == 1:
                self.interval = 6
            else:
                self.interval = self.interval * self.ease_factor
            self.repetition += 1

        # 更新易度因子（调整公式以适配三个等级）
        if quality == 0:
            self.ease_factor = max(1.3, self.ease_factor - 0.2)
        elif quality == 2:
            self.ease_factor = max(1.3, self.ease_factor - 0.1)
        else:  # quality == 4
            self.ease_factor = max(1.3, self.ease_factor + 0.1)

        # 计算下次复习时间
        self.next_review = datetime.utcnow() + timedelta(days=self.interval)

        # 记录复习历史
        history = ReviewHistory(
            card_id=self.id,
            quality=quality,
            next_interval=self.interval
        )
        db.session.add(history)

        db.session.commit()


class ReviewHistory(db.Model):
    """复习历史表 - 用于统计和分析"""
    id = db.Column(db.Integer, primary_key=True)
    card_id = db.Column(db.Integer, db.ForeignKey('flashcard.id'), nullable=False)
    review_date = db.Column(db.DateTime, default=datetime.utcnow)
    quality = db.Column(db.Integer, nullable=False)  # 0-5
    next_interval = db.Column(db.Float, nullable=False)  # 下次间隔

    # 关系
    card = db.relationship('Flashcard', backref='review_history')

    def __repr__(self):
        return f'<ReviewHistory {self.id}: Card {self.card_id} - Quality {self.quality}>'


# 创建数据库表和默认分类
def init_database():
    """初始化数据库，创建默认分类"""
    with app.app_context():
        db.create_all()

        # 检查是否已存在默认分类
        default_category = Category.query.filter_by(name='默认分类').first()
        if not default_category:
            default_category = Category(name='默认分类', description='系统默认分类')
            db.session.add(default_category)

            # 添加更多示例分类
            sample_categories = [
                Category(name='英语学习', description='英语单词和短语'),
                Category(name='数学公式', description='数学公式和定理'),
                Category(name='编程知识', description='编程语言和算法'),
                Category(name='历史事件', description='历史日期和事件'),
                Category(name='科学知识', description='科学原理和概念'),
            ]
            db.session.add_all(sample_categories)
            db.session.commit()

            print("数据库初始化完成，创建了默认分类和示例分类")


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/cards')
def get_cards():
    # 获取今天需要复习的卡片
    today_cards = Flashcard.query.filter(
        Flashcard.next_review <= datetime.utcnow()
    ).all()

    # 获取所有卡片
    all_cards = Flashcard.query.all()

    # 获取所有分类
    categories = Category.query.all()

    return jsonify({
        'today_cards': [{
            'id': card.id,
            'front': card.front,
            'back': card.back,
            'category': card.category_name,
            'category_id': card.category_id,
            'repetition': card.repetition,
            'interval': card.interval,
            'ease_factor': card.ease_factor,
            'next_review': card.next_review.isoformat() if card.next_review else None
        } for card in today_cards],
        'all_cards': [{
            'id': card.id,
            'front': card.front,
            'back': card.back,
            'category': card.category_name,
            'category_id': card.category_id,
            'repetition': card.repetition,
            'interval': card.interval,
            'ease_factor': card.ease_factor,
            'next_review': card.next_review.isoformat() if card.next_review else None
        } for card in all_cards],
        'categories': [{
            'id': cat.id,
            'name': cat.name,
            'description': cat.description,
            'card_count': len(cat.cards)
        } for cat in categories]
    })


@app.route('/add', methods=['POST'])
def add_card():
    data = request.json
    front = data.get('front', '').strip()
    back = data.get('back', '').strip()
    category_name = data.get('category', '默认分类').strip()

    if not front or not back:
        return jsonify({'success': False, 'error': '卡片正面和背面内容不能为空'})

    # 查找或创建分类
    category = Category.query.filter_by(name=category_name).first()
    if not category:
        category = Category(name=category_name)
        db.session.add(category)
        db.session.flush()  # 获取ID但不提交

    # 创建卡片
    card = Flashcard(
        front=front,
        back=back,
        category_id=category.id
    )
    db.session.add(card)
    db.session.commit()

    return jsonify({'success': True, 'id': card.id})


@app.route('/edit/<int:card_id>', methods=['PUT'])
def edit_card(card_id):
    """编辑卡片"""
    data = request.json
    front = data.get('front', '').strip()
    back = data.get('back', '').strip()
    category_name = data.get('category', '默认分类').strip()

    if not front or not back:
        return jsonify({'success': False, 'error': '卡片正面和背面内容不能为空'})

    card = Flashcard.query.get(card_id)
    if not card:
        return jsonify({'success': False, 'error': '卡片不存在'})

    # 查找或创建分类
    category = Category.query.filter_by(name=category_name).first()
    if not category:
        category = Category(name=category_name)
        db.session.add(category)
        db.session.flush()

    # 更新卡片
    card.front = front
    card.back = back
    card.category_id = category.id

    db.session.commit()
    return jsonify({'success': True})


@app.route('/review/<int:card_id>', methods=['POST'])
def review_card(card_id):
    data = request.json
    quality = int(data.get('quality', 3))

    card = Flashcard.query.get(card_id)
    if card:
        # 记录复习历史
        history = ReviewHistory(
            card_id=card.id,
            quality=quality,
            next_interval=card.interval
        )
        db.session.add(history)

        # 更新卡片参数
        card.update_after_review(quality)
        return jsonify({'success': True})

    return jsonify({'success': False, 'error': 'Card not found'})


@app.route('/delete/<int:card_id>', methods=['DELETE'])
def delete_card(card_id):
    card = Flashcard.query.get(card_id)
    if card:
        db.session.delete(card)
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': 'Card not found'})


@app.route('/categories', methods=['GET'])
def get_categories():
    """获取所有分类"""
    categories = Category.query.all()
    return jsonify([{
        'id': cat.id,
        'name': cat.name,
        'description': cat.description,
        'card_count': len(cat.cards)
    } for cat in categories])


@app.route('/category/<int:category_id>', methods=['GET'])
def get_category(category_id):
    """获取特定分类及其卡片"""
    category = Category.query.get(category_id)
    if not category:
        return jsonify({'success': False, 'error': '分类不存在'})

    cards = Flashcard.query.filter_by(category_id=category_id).all()

    return jsonify({
        'success': True,
        'category': {
            'id': category.id,
            'name': category.name,
            'description': category.description
        },
        'cards': [{
            'id': card.id,
            'front': card.front,
            'back': card.back,
            'repetition': card.repetition,
            'interval': card.interval,
            'next_review': card.next_review.isoformat() if card.next_review else None
        } for card in cards]
    })


@app.route('/category', methods=['POST'])
def create_category():
    """创建新分类"""
    data = request.json
    name = data.get('name', '').strip()
    description = data.get('description', '').strip()

    if not name:
        return jsonify({'success': False, 'error': '分类名称不能为空'})

    # 检查分类是否已存在
    existing = Category.query.filter_by(name=name).first()
    if existing:
        return jsonify({'success': False, 'error': '分类已存在'})

    category = Category(name=name, description=description)
    db.session.add(category)
    db.session.commit()

    return jsonify({'success': True, 'id': category.id})


@app.route('/category/<int:category_id>', methods=['PUT'])
def update_category(category_id):
    """更新分类"""
    data = request.json
    name = data.get('name', '').strip()
    description = data.get('description', '').strip()

    category = Category.query.get(category_id)
    if not category:
        return jsonify({'success': False, 'error': '分类不存在'})

    # 检查新名称是否与其他分类冲突
    if name != category.name:
        existing = Category.query.filter_by(name=name).first()
        if existing:
            return jsonify({'success': False, 'error': '分类名称已存在'})

    category.name = name
    category.description = description
    db.session.commit()

    return jsonify({'success': True})


@app.route('/category/<int:category_id>', methods=['DELETE'])
def delete_category(category_id):
    """删除分类（将关联卡片移到默认分类）"""
    category = Category.query.get(category_id)
    if not category:
        return jsonify({'success': False, 'error': '分类不存在'})

    # 获取默认分类
    default_category = Category.query.filter_by(name='默认分类').first()
    if not default_category:
        default_category = Category(name='默认分类')
        db.session.add(default_category)
        db.session.flush()

    # 将该分类下的所有卡片移到默认分类
    for card in category.cards:
        card.category_id = default_category.id

    # 删除分类
    db.session.delete(category)
    db.session.commit()

    return jsonify({'success': True})


@app.route('/export/csv')
def export_csv():
    cards = Flashcard.query.all()

    # 创建CSV数据
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        ['id', 'front', 'back', 'category', 'category_id', 'repetition', 'interval', 'ease_factor', 'next_review'])

    for card in cards:
        writer.writerow([
            card.id,
            card.front,
            card.back,
            card.category_name,
            card.category_id,
            card.repetition,
            card.interval,
            card.ease_factor,
            card.next_review.isoformat() if card.next_review else ''
        ])

    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        mimetype='text/csv',
        as_attachment=True,
        download_name='flashcards.csv'
    )


@app.route('/export/txt')
def export_txt():
    cards = Flashcard.query.all()

    txt_content = []
    for card in cards:
        txt_content.append(f"问题: {card.front}")
        txt_content.append(f"答案: {card.back}")
        txt_content.append(f"分类: {card.category_name}")
        txt_content.append(f"重复次数: {card.repetition}")
        txt_content.append(f"间隔天数: {card.interval}")
        if card.next_review:
            txt_content.append(f"下次复习: {card.next_review.strftime('%Y-%m-%d %H:%M:%S')}")
        txt_content.append("-" * 60)

    output = io.BytesIO("\n".join(txt_content).encode('utf-8'))
    return send_file(
        output,
        mimetype='text/plain',
        as_attachment=True,
        download_name='flashcards.txt'
    )


@app.route('/import', methods=['POST'])
def import_cards():
    file = request.files.get('file')
    if not file:
        return jsonify({'success': False, 'error': 'No file provided'})

    filename = secure_filename(file.filename)
    file_ext = os.path.splitext(filename)[1].lower()

    try:
        count = 0

        if file_ext == '.csv':
            # 导入CSV
            content = file.read().decode('utf-8').splitlines()
            reader = csv.reader(content)

            headers = next(reader, None)

            # 确定列索引
            if headers:
                try:
                    front_idx = headers.index('front') if 'front' in headers else 0
                    back_idx = headers.index('back') if 'back' in headers else 1
                    category_idx = headers.index('category') if 'category' in headers else 2
                except ValueError:
                    front_idx, back_idx, category_idx = 0, 1, 2
            else:
                front_idx, back_idx, category_idx = 0, 1, 2

            for row in reader:
                if len(row) > max(front_idx, back_idx):
                    front = row[front_idx].strip()
                    back = row[back_idx].strip()
                    category_name = row[category_idx].strip() if len(row) > category_idx else 'imported'

                    if front and back:
                        # 查找或创建分类
                        category = Category.query.filter_by(name=category_name).first()
                        if not category:
                            category = Category(name=category_name)
                            db.session.add(category)
                            db.session.flush()

                        card = Flashcard(
                            front=front,
                            back=back,
                            category_id=category.id
                        )
                        db.session.add(card)
                        count += 1

        elif file_ext == '.txt':
            # 简单的TXT导入
            content = file.read().decode('utf-8')
            lines = content.split('\n')

            current_front = None
            current_back = None
            current_category = 'imported'

            for line in lines:
                line = line.strip()
                if line.startswith('Q:') or line.startswith('问题:'):
                    current_front = line[2:].strip()
                elif line.startswith('A:') or line.startswith('答案:'):
                    current_back = line[2:].strip()
                elif line.startswith('C:') or line.startswith('分类:'):
                    current_category = line[2:].strip()
                elif not line and current_front and current_back:
                    # 查找或创建分类
                    category = Category.query.filter_by(name=current_category).first()
                    if not category:
                        category = Category(name=current_category)
                        db.session.add(category)
                        db.session.flush()

                    card = Flashcard(
                        front=current_front,
                        back=current_back,
                        category_id=category.id
                    )
                    db.session.add(card)
                    count += 1
                    current_front = None
                    current_back = None
                    current_category = 'imported'

            # 添加最后一张卡片
            if current_front and current_back:
                category = Category.query.filter_by(name=current_category).first()
                if not category:
                    category = Category(name=current_category)
                    db.session.add(category)
                    db.session.flush()

                card = Flashcard(
                    front=current_front,
                    back=current_back,
                    category_id=category.id
                )
                db.session.add(card)
                count += 1

        elif file_ext in ['.xlsx', '.xls']:
            # Excel文件导入
            import pandas as pd
            df = pd.read_excel(file)

            # 查找合适的列
            front_col = None
            back_col = None
            category_col = None

            for col in df.columns:
                col_lower = str(col).lower()
                if 'front' in col_lower or '正面' in col_lower or '问题' in col_lower:
                    front_col = col
                elif 'back' in col_lower or '背面' in col_lower or '答案' in col_lower:
                    back_col = col
                elif 'category' in col_lower or '分类' in col_lower:
                    category_col = col

            # 如果没有找到特定列，使用前几列
            if front_col is None and len(df.columns) > 0:
                front_col = df.columns[0]
            if back_col is None and len(df.columns) > 1:
                back_col = df.columns[1]
            if category_col is None and len(df.columns) > 2:
                category_col = df.columns[2]

            for _, row in df.iterrows():
                front = str(row[front_col]).strip() if front_col and pd.notna(row[front_col]) else ''
                back = str(row[back_col]).strip() if back_col and pd.notna(row[back_col]) else ''
                category_name = str(row[category_col]).strip() if category_col and pd.notna(
                    row[category_col]) else 'imported'

                if front and back:
                    # 查找或创建分类
                    category = Category.query.filter_by(name=category_name).first()
                    if not category:
                        category = Category(name=category_name)
                        db.session.add(category)
                        db.session.flush()

                    card = Flashcard(
                        front=front,
                        back=back,
                        category_id=category.id
                    )
                    db.session.add(card)
                    count += 1
        else:
            return jsonify({'success': False, 'error': '不支持的文件格式'})

        db.session.commit()
        return jsonify({'success': True, 'message': f'成功导入 {count} 张卡片'})

    except Exception as e:
        db.session.rollback()
        app.logger.error(f'导入失败: {str(e)}')
        return jsonify({'success': False, 'error': f'导入失败: {str(e)}'})


@app.route('/import/batch', methods=['POST'])
def import_batch():
    """批量导入卡片"""
    try:
        data = request.json
        cards = data.get('cards', [])
        count = 0

        for card_data in cards:
            front = card_data.get('front', '').strip()
            back = card_data.get('back', '').strip()
            category_name = card_data.get('category', 'imported').strip()

            if front and back:
                # 查找或创建分类
                category = Category.query.filter_by(name=category_name).first()
                if not category:
                    category = Category(name=category_name)
                    db.session.add(category)
                    db.session.flush()

                card = Flashcard(
                    front=front,
                    back=back,
                    category_id=category.id
                )
                db.session.add(card)
                count += 1

        db.session.commit()
        return jsonify({'success': True, 'count': count})

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)})


# 添加静态文件路由
@app.route('/static/<path:path>')
def serve_static(path):
    return app.send_static_file(path)


# 启动函数
def run_server():
    """运行服务器"""
    from waitress import serve
    import webbrowser

    # 初始化数据库
    init_database()

    # 确保静态文件夹存在
    static_css = os.path.join(get_base_dir(), 'static', 'css')
    static_js = os.path.join(get_base_dir(), 'static', 'js')
    templates_dir = os.path.join(get_base_dir(), 'templates')

    os.makedirs(static_css, exist_ok=True)
    os.makedirs(static_js, exist_ok=True)
    os.makedirs(templates_dir, exist_ok=True)

    # 启动服务器
    print("记忆闪卡系统正在启动...")
    print("访问地址: http://localhost:5000")
    print("按 Ctrl+C 停止服务器")

    # 自动打开浏览器
    webbrowser.open('http://localhost:5000')

    # 使用 waitress 作为生产服务器
    serve(app, host='0.0.0.0', port=5000)

if __name__ == '__main__':
    run_server()
