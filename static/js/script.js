// 全局变量
let currentCards = [];
let todayCards = [];
let currentCardIndex = -1;
let isFlipped = false;
let categories = {};
let selectedCards = new Set();
let isSelectMode = false;
let customReviewCards = [];
let customReviewIndex = -1;
let isCustomReview = false;
let expandedCategories = new Set();
let sidebarCollapsed = false;
let customReviewMode = 'list-infinite';
let isInfiniteMode = true;
let selectedReviewMode = null;

// 配置marked以支持数学公式 - 安全版本
marked.setOptions({
    breaks: true,
    gfm: true,
    sanitize: false,
    highlight: function(code, lang) {
        return code;
    }
});

// 增强的Markdown渲染函数，支持数学公式
function renderMarkdownWithMath(text) {
    if (!text) return '';

    // 定义数学公式的正则表达式
    const inlineMathRegex = /(?<!\\)\$(?!\$)(.*?)(?<!\\)\$(?!\$)/g;
    const blockMathRegex = /(?<!\\)\$\$(.*?)(?<!\\)\$\$/gs;

    // 先处理块级公式
    let processed = text;
    const blockMatches = [];

    // 查找并临时替换块级公式
    processed = processed.replace(blockMathRegex, (match, formula) => {
        const id = `math-block-${Date.now()}-${Math.random().toString(36).substr(2)}`;
        blockMatches.push({ id, formula: formula.trim() });
        return `{{${id}}}`;
    });

    // 查找并临时替换行内公式
    const inlineMatches = [];
    processed = processed.replace(inlineMathRegex, (match, formula) => {
        const id = `math-inline-${Date.now()}-${Math.random().toString(36).substr(2)}`;
        inlineMatches.push({ id, formula: formula.trim() });
        return `{{${id}}}`;
    });

    // 使用marked渲染Markdown
    let html = marked.parse(processed);

    // 替换回数学公式
    blockMatches.forEach(({ id, formula }) => {
        try {
            const rendered = katex.renderToString(formula, {
                throwOnError: false,
                displayMode: true
            });
            html = html.replace(`{{${id}}}`, `<div class="math-container math-block">${rendered}</div>`);
        } catch (err) {
            console.warn('块级数学公式渲染错误:', err);
            html = html.replace(`{{${id}}}`, `<div class="math-error">$$${formula}$$</div>`);
        }
    });

    inlineMatches.forEach(({ id, formula }) => {
        try {
            const rendered = katex.renderToString(formula, {
                throwOnError: false,
                displayMode: false
            });
            html = html.replace(`{{${id}}}`, `<span class="math-inline">${rendered}</span>`);
        } catch (err) {
            console.warn('行内数学公式渲染错误:', err);
            html = html.replace(`{{${id}}}`, `<span class="math-error">$${formula}$</span>`);
        }
    });

    return html;
}

// 安全渲染Markdown
function renderMarkdownSafely(text) {
    if (!text) return '';

    try {
        // 使用自定义的数学公式渲染器
        return renderMarkdownWithMath(text);
    } catch (error) {
        console.error('Markdown渲染错误:', error);
        // 如果渲染失败，返回纯文本
        return `<div class="plain-text-content">${escapeHtml(text)}</div>`;
    }
}

// HTML转义函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 预览区域的数学公式渲染
function renderMathInPreview(element) {
    if (!element) return;

    const blockContainers = element.querySelectorAll('.math-container.math-block');
    blockContainers.forEach(container => {
        const katexEl = container.querySelector('.katex');
        if (!katexEl && container.textContent) {
            const formula = container.textContent.trim();
            if (formula) {
                try {
                    katex.render(formula, container, {
                        throwOnError: false,
                        displayMode: true
                    });
                } catch (err) {
                    console.warn('预览块级公式渲染失败:', err);
                }
            }
        }
    });

    const inlineContainers = element.querySelectorAll('.math-inline');
    inlineContainers.forEach(container => {
        const katexEl = container.querySelector('.katex');
        if (!katexEl && container.textContent) {
            const formula = container.textContent.trim();
            if (formula) {
                try {
                    katex.render(formula, container, {
                        throwOnError: false,
                        displayMode: false
                    });
                } catch (err) {
                    console.warn('预览行内公式渲染失败:', err);
                }
            }
        }
    });
}

// 预览Markdown
function togglePreview(fieldId) {
    const previewId = `${fieldId}-preview`;
    const previewElement = document.getElementById(previewId);
    const textarea = document.getElementById(fieldId);

    if (!previewElement || !textarea) return;

    if (previewElement.classList.contains('hidden')) {
        // 显示预览
        previewElement.innerHTML = renderMarkdownSafely(textarea.value);
        previewElement.classList.remove('hidden');

        // 渲染数学公式
        setTimeout(() => {
            renderMathInPreview(previewElement);
        }, 100);
    } else {
        // 隐藏预览
        previewElement.classList.add('hidden');
    }
}

// 数学公式渲染函数
function renderMathInElement(element) {
    if (!element) return;

    // 渲染块级公式
    const blockContainers = element.querySelectorAll('.math-container.math-block');
    blockContainers.forEach(container => {
        const existingKatex = container.querySelector('.katex');
        if (!existingKatex) {
            const formula = container.textContent.trim();
            if (formula) {
                try {
                    katex.render(formula, container, {
                        throwOnError: false,
                        displayMode: true
                    });
                } catch (err) {
                    console.warn('块级数学公式渲染失败:', err);
                }
            }
        }
    });

    // 渲染行内公式
    const inlineContainers = element.querySelectorAll('.math-inline');
    inlineContainers.forEach(container => {
        const existingKatex = container.querySelector('.katex');
        if (!existingKatex) {
            const formula = container.textContent.trim();
            if (formula) {
                try {
                    katex.render(formula, container, {
                        throwOnError: false,
                        displayMode: false
                    });
                } catch (err) {
                    console.warn('行内数学公式渲染失败:', err);
                }
            }
        }
    });
}

// 更新卡片内容字体大小
function updateCardFontSize(cardElement, content) {
    if (!cardElement) return;

    const contentInner = cardElement.querySelector('.content-inner');
    if (!contentInner) return;

    // 移除已有的字体大小类
    contentInner.parentElement.classList.remove('large-text', 'medium-text', 'small-text');

    // 根据内容长度设置字体大小类
    const length = content.replace(/<[^>]*>/g, '').length;

    if (length < 50) {
        contentInner.parentElement.classList.add('large-text');
    } else if (length < 200) {
        contentInner.parentElement.classList.add('medium-text');
    } else {
        contentInner.parentElement.classList.add('small-text');
    }
}

// 侧边栏切换
function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;

    const leftSidebar = document.getElementById('left-sidebar');
    const mainContent = document.getElementById('main-content');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const floatingBtn = document.getElementById('floating-sidebar-btn');

    if (leftSidebar && mainContent && sidebarToggle) {
        if (sidebarCollapsed) {
            // 添加 collapsed 类
            leftSidebar.classList.add('collapsed');
            mainContent.classList.add('sidebar-collapsed');

            // 更新按钮文本和图标
            sidebarToggle.classList.add('collapsed');
            sidebarToggle.innerHTML = '<i class="fas fa-chevron-right"></i> 展开侧栏';

            // 显示浮动按钮
            if (floatingBtn) floatingBtn.style.display = 'flex';

            // 添加一个小的延迟，确保布局计算正确
            setTimeout(() => {
                // 强制重新计算布局
                if (typeof(Event) === 'function') {
                    window.dispatchEvent(new Event('resize'));
                }
            }, 50);

        } else {
            // 移除 collapsed 类
            leftSidebar.classList.remove('collapsed');
            mainContent.classList.remove('sidebar-collapsed');

            // 更新按钮文本和图标
            sidebarToggle.classList.remove('collapsed');
            sidebarToggle.innerHTML = '<i class="fas fa-bars"></i> 收起侧栏';

            // 隐藏浮动按钮
            if (floatingBtn) floatingBtn.style.display = 'none';

            // 聚焦到第一个输入框
            setTimeout(() => {
                const frontInput = document.getElementById('front');
                if (frontInput) frontInput.focus();
            }, 300);

            // 添加一个小的延迟，确保布局计算正确
            setTimeout(() => {
                // 强制重新计算布局
                if (typeof(Event) === 'function') {
                    window.dispatchEvent(new Event('resize'));
                }
            }, 50);
        }
    }
}

// 页面加载
document.addEventListener('DOMContentLoaded', function() {
    // 检查屏幕宽度，在移动端默认收起侧边栏
    if (window.innerWidth <= 1024) {
        sidebarCollapsed = true;
        toggleSidebar();
    }

    // 监听窗口大小变化
    window.addEventListener('resize', function() {
        if (window.innerWidth <= 1024 && !sidebarCollapsed) {
            sidebarCollapsed = true;
            toggleSidebar();
        }
    });

    loadCards();

    // 添加卡片表单提交
    document.getElementById('add-card-form').addEventListener('submit', async function(e) {
        e.preventDefault();

        const front = document.getElementById('front').value.trim();
        const back = document.getElementById('back').value.trim();
        let category = document.getElementById('category').value.trim();

        if (!category) {
            category = '默认分类';
        }

        if (!front || !back) {
            alert('请填写卡片正面和背面内容');
            return;
        }

        const response = await fetch('/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ front, back, category })
        });

        const result = await response.json();
        if (result.success) {
            // 清空表单
            document.getElementById('add-card-form').reset();
            const frontPreview = document.getElementById('front-preview');
            const backPreview = document.getElementById('back-preview');
            if (frontPreview) frontPreview.classList.add('hidden');
            if (backPreview) backPreview.classList.add('hidden');

            document.getElementById('front').focus();

            // 重新加载卡片
            loadCards();

            // 显示成功提示
            showToast('卡片添加成功！', 'success');
        } else {
            showToast('添加失败，请重试', 'error');
        }
    });

    // 编辑卡片表单提交
    document.getElementById('edit-card-form').addEventListener('submit', async function(e) {
        e.preventDefault();

        const cardId = document.getElementById('edit-card-id').value;
        const front = document.getElementById('edit-front').value.trim();
        const back = document.getElementById('edit-back').value.trim();
        let category = document.getElementById('edit-category').value.trim();

        if (!category) {
            category = '默认分类';
        }

        if (!front || !back) {
            alert('请填写卡片正面和背面内容');
            return;
        }

        try {
            const response = await fetch(`/edit/${cardId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ front, back, category })
            });

            const result = await response.json();
            if (result.success) {
                hideEditCardModal();
                loadCards();
                showToast('卡片编辑成功！', 'success');
            } else {
                throw new Error(result.error || '编辑失败');
            }
        } catch (error) {
            console.error('编辑卡片失败:', error);
            showToast('编辑失败，请重试', 'error');
        }
    });

    // 初始聚焦到第一个输入框
    const frontInput = document.getElementById('front');
    if (frontInput) frontInput.focus();

    // 监听输入框变化，实时更新预览
    const frontTextarea = document.getElementById('front');
    const backTextarea = document.getElementById('back');

    if (frontTextarea) {
        frontTextarea.addEventListener('input', function() {
            const preview = document.getElementById('front-preview');
            if (preview && !preview.classList.contains('hidden')) {
                preview.innerHTML = renderMarkdownSafely(this.value);
                setTimeout(() => {
                    renderMathInPreview(preview);
                }, 100);
            }
        });
    }

    if (backTextarea) {
        backTextarea.addEventListener('input', function() {
            const preview = document.getElementById('back-preview');
            if (preview && !preview.classList.contains('hidden')) {
                preview.innerHTML = renderMarkdownSafely(this.value);
                setTimeout(() => {
                    renderMathInPreview(preview);
                }, 100);
            }
        });
    }

    // 检查屏幕宽度，在移动端默认收起侧边栏
    if (window.innerWidth <= 1024) {
        sidebarCollapsed = true;
        // 直接应用样式而不触发动画
        const leftSidebar = document.getElementById('left-sidebar');
        const mainContent = document.getElementById('main-content');
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const floatingBtn = document.getElementById('floating-sidebar-btn');

        if (leftSidebar) leftSidebar.classList.add('collapsed');
        if (mainContent) mainContent.classList.add('sidebar-collapsed');
        if (sidebarToggle) {
            sidebarToggle.classList.add('collapsed');
            sidebarToggle.innerHTML = '<i class="fas fa-chevron-right"></i> 展开侧栏';
        }
        if (floatingBtn) floatingBtn.style.display = 'flex';
    }

    // 监听窗口大小变化
    window.addEventListener('resize', function() {
        if (window.innerWidth <= 1024 && !sidebarCollapsed) {
            sidebarCollapsed = true;
            toggleSidebar();
        }
    });
});

// 加载卡片
async function loadCards() {
    try {
        const response = await fetch('/cards');
        const data = await response.json();

        todayCards = data.today_cards;
        currentCards = data.all_cards;

        // 按分类组织卡片
        organizeCardsByCategory();

        updateStats();
        updateCategoryList();
        updateCategoryOptions();

        // 显示记忆质量分布
        showMemoryQualityDistribution();

        // 如果有今日卡片，开始复习
        if (todayCards.length > 0 && !isCustomReview) {
            document.getElementById('empty-state').classList.add('hidden');
            document.getElementById('flashcard').classList.remove('hidden');
            document.getElementById('rating-buttons').classList.remove('hidden');
            document.getElementById('progress-container').classList.remove('hidden');
            document.getElementById('custom-review-buttons').classList.add('hidden');
            document.getElementById('review-mode-indicator').classList.add('hidden');

            currentCardIndex = 0;
            showCurrentCard();
        } else if (isCustomReview && customReviewCards.length > 0) {
            // 自定义复习模式
            showCurrentCustomCard();
        } else {
            // 没有需要复习的卡片
            document.getElementById('empty-state').classList.remove('hidden');
            document.getElementById('flashcard').classList.add('hidden');
            document.getElementById('rating-buttons').classList.add('hidden');
            document.getElementById('progress-container').classList.add('hidden');
            document.getElementById('custom-review-buttons').classList.add('hidden');
            document.getElementById('review-mode-indicator').classList.add('hidden');
        }
    } catch (error) {
        console.error('加载卡片失败:', error);
        showToast('加载失败，请检查网络连接', 'error');
    }
}

// 按分类组织卡片
function organizeCardsByCategory() {
    categories = {};

    currentCards.forEach(card => {
        const category = card.category || '默认分类';
        if (!categories[category]) {
            categories[category] = [];
        }
        categories[category].push(card);
    });

    // 确保默认分类存在
    if (!categories['默认分类']) {
        categories['默认分类'] = [];
    }
}

// 显示当前卡片
function showCurrentCard() {
    if (currentCardIndex >= 0 && currentCardIndex < todayCards.length) {
        const card = todayCards[currentCardIndex];

        // 获取DOM元素
        const frontElement = document.getElementById('card-front');
        const backElement = document.getElementById('card-back');
        const frontCategory = document.getElementById('card-category');
        const backCategory = document.getElementById('card-category-back');

        if (!frontElement || !backElement) {
            console.error('卡片元素未找到');
            return;
        }

        // 先清空内容
        const frontInner = frontElement.querySelector('.content-inner');
        const backInner = backElement.querySelector('.content-inner');

        if (frontInner) frontInner.innerHTML = '';
        if (backInner) backInner.innerHTML = '';

        // 渲染正面内容 - 使用安全渲染
        if (frontInner) {
            frontInner.innerHTML = renderMarkdownSafely(card.front);
            updateCardFontSize(frontElement, card.front);
        }

        // 渲染背面内容 - 使用安全渲染
        if (backInner) {
            backInner.innerHTML = renderMarkdownSafely(card.back);
            updateCardFontSize(backElement, card.back);
        }

        // 更新分类
        if (frontCategory) frontCategory.textContent = card.category || '默认分类';
        if (backCategory) backCategory.textContent = card.category || '默认分类';

        // 更新进度
        const progress = ((currentCardIndex) / todayCards.length * 100).toFixed(1);
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');

        if (progressFill) progressFill.style.width = `${progress}%`;
        if (progressText) progressText.textContent = `${currentCardIndex + 1}/${todayCards.length}`;

        // 重置卡片状态
        isFlipped = false;
        const flashcard = document.getElementById('flashcard');
        if (flashcard) {
            flashcard.classList.remove('flipped');
        }

        // 更新下次复习信息
        if (card.next_review) {
            const nextDate = new Date(card.next_review);
            const now = new Date();
            const daysDiff = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));

            const nextReviewInfo = document.getElementById('next-review-info');
            if (nextReviewInfo) {
                if (daysDiff <= 0) {
                    nextReviewInfo.textContent = '今天到期';
                    nextReviewInfo.style.color = 'var(--danger-color)';
                } else if (daysDiff === 1) {
                    nextReviewInfo.textContent = '明天到期';
                    nextReviewInfo.style.color = 'var(--warning-color)';
                } else {
                    nextReviewInfo.textContent = `${daysDiff}天后`;
                    nextReviewInfo.style.color = 'var(--gray-500)';
                }
            }
        }

        // 延迟渲染数学公式，确保DOM已更新
        setTimeout(() => {
            renderMathInElement(frontElement);
            renderMathInElement(backElement);
        }, 50);
    }
}

// 翻转卡片
function toggleCard() {
    if (currentCardIndex < 0 && customReviewIndex < 0) return;

    const flashcard = document.getElementById('flashcard');
    if (flashcard) {
        isFlipped = !isFlipped;
        flashcard.classList.toggle('flipped', isFlipped);
    }
}

// 评分卡片（正常复习模式）
async function rateCard(quality) {
    if (currentCardIndex < 0) return;

    const card = todayCards[currentCardIndex];

    try {
        await fetch(`/review/${card.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quality })
        });

        // 根据评分显示不同提示
        let message = '';
        if (quality === 4) {
            message = '很好！继续加油！';
        } else if (quality === 2) {
            message = '有点模糊，需要加强记忆';
        } else {
            message = '没记住，需要重复学习';
        }

        showToast(message, quality === 4 ? 'success' : quality === 2 ? 'warning' : 'error');

        // 移到下一张卡片
        currentCardIndex++;

        if (currentCardIndex < todayCards.length) {
            showCurrentCard();
        } else {
            showToast('恭喜！今日复习已完成', 'success');
            setTimeout(() => {
                loadCards();
            }, 1000);
        }
    } catch (error) {
        console.error('评分失败:', error);
        showToast('评分失败，请重试', 'error');
    }
}

// 更新统计信息
function updateStats() {
    const todayCount = document.getElementById('today-count');
    const totalCount = document.getElementById('total-count');
    const avgRepetition = document.getElementById('avg-repetition');
    const masteredCount = document.getElementById('mastered-count');

    if (todayCount) todayCount.textContent = todayCards.length;
    if (totalCount) totalCount.textContent = currentCards.length;

    if (currentCards.length > 0) {
        const avgRep = currentCards.reduce((sum, card) => sum + card.repetition, 0) / currentCards.length;
        if (avgRepetition) avgRepetition.textContent = avgRep.toFixed(1);

        // 计算掌握比例（重复次数>=3）
        const mastered = currentCards.filter(card => card.repetition >= 3).length;
        if (masteredCount) masteredCount.textContent = mastered + ' (' + Math.round(mastered / currentCards.length * 100) + '%)';
    } else {
        if (avgRepetition) avgRepetition.textContent = '0';
        if (masteredCount) masteredCount.textContent = '0';
    }
}

// 显示记忆质量分布
function showMemoryQualityDistribution() {
    if (currentCards.length === 0) return;

    const cardStats = {
        new: currentCards.filter(card => card.repetition === 0).length,
        learning: currentCards.filter(card => card.repetition > 0 && card.repetition < 3).length,
        mastered: currentCards.filter(card => card.repetition >= 3).length,
        due: todayCards.length
    };

    // 可以在界面上显示这些统计数据
    console.log('卡片统计:', cardStats);
}

// 更新分类列表
function updateCategoryList() {
    const container = document.getElementById('categories-container');
    if (!container) return;

    container.innerHTML = '';

    if (currentCards.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-inbox"></i>
                </div>
                <h3>暂无卡片</h3>
                <p class="mt-1">点击上方按钮添加第一张卡片</p>
            </div>
        `;
        return;
    }

    Object.keys(categories).sort().forEach(category => {
        const cards = categories[category];
        const categoryId = category.replace(/\s+/g, '-').toLowerCase();
        const isExpanded = expandedCategories.has(category);

        const categoryElement = document.createElement('div');
        categoryElement.className = 'category-item fade-in';
        categoryElement.id = `category-${categoryId}`;

        categoryElement.innerHTML = `
            <div class="category-header ${isExpanded ? 'active' : ''}" onclick="toggleCategory('${category}')">
                <div class="category-title">
                    <i class="fas fa-folder category-icon"></i>
                    <span>${category}</span>
                    <span class="category-count">${cards.length} 张</span>
                </div>
                <div class="category-actions">
                    <button class="btn-icon btn-secondary btn-sm" onclick="event.stopPropagation(); selectAllInCategory('${category}')" title="选择本分类所有卡片">
                        <i class="fas fa-check-double"></i>
                    </button>
                    <button class="btn-icon btn-secondary btn-sm" onclick="event.stopPropagation(); startCategoryReview('${category}')" title="复习本分类">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
            </div>
            <div class="category-cards ${isExpanded ? 'expanded' : ''}" id="cards-${categoryId}">
            </div>
        `;

        container.appendChild(categoryElement);

        if (isExpanded) {
            updateCategoryCards(category, categoryId);
        }
    });

    updateSelectionUI();
}

// 更新分类中的卡片列表
function updateCategoryCards(category, categoryId) {
    const cardsContainer = document.getElementById(`cards-${categoryId}`);
    if (!cardsContainer) return;

    cardsContainer.innerHTML = '';
    const cards = categories[category];

    cards.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.className = `card-list-item ${selectedCards.has(card.id) ? 'selected' : ''}`;
        cardElement.id = `card-${card.id}`;

        const isToday = card.next_review ? new Date(card.next_review) <= new Date() : false;

        cardElement.innerHTML = `
            ${isSelectMode ? `
            <div class="card-list-checkbox">
                <input type="checkbox" id="checkbox-${card.id}" ${selectedCards.has(card.id) ? 'checked' : ''} 
                       onchange="toggleCardSelection(${card.id}, this.checked)">
            </div>
            ` : ''}
            <div class="card-list-content">
                <div class="card-list-front">${escapeHtml(card.front.length > 100 ? card.front.substring(0, 100) + '...' : card.front)}</div>
                <div class="card-list-back">${escapeHtml(card.back.length > 100 ? card.back.substring(0, 100) + '...' : card.back)}</div>
                <div class="card-list-footer">
                    <span>复习次数: ${card.repetition}</span>
                    <span style="color: ${isToday ? 'var(--danger-color)' : 'var(--gray-500)'}">
                        ${card.next_review ? new Date(card.next_review).toLocaleDateString('zh-CN') : '今天'}
                    </span>
                </div>
            </div>
            <div class="card-list-actions">
                <button class="btn-icon btn-secondary" onclick="editCard(${card.id})" title="编辑">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-danger" onclick="deleteCard(${card.id})" title="删除">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        cardsContainer.appendChild(cardElement);
    });
}

// 切换分类展开/折叠
function toggleCategory(category) {
    const categoryId = category.replace(/\s+/g, '-').toLowerCase();
    const categoryElement = document.getElementById(`category-${categoryId}`);
    const cardsContainer = document.getElementById(`cards-${categoryId}`);

    if (!categoryElement || !cardsContainer) return;

    const header = categoryElement.querySelector('.category-header');

    if (expandedCategories.has(category)) {
        expandedCategories.delete(category);
        header.classList.remove('active');
        cardsContainer.classList.remove('expanded');
        cardsContainer.style.maxHeight = '0';
    } else {
        expandedCategories.add(category);
        header.classList.add('active');
        cardsContainer.classList.add('expanded');

        if (cardsContainer.children.length === 0) {
            updateCategoryCards(category, categoryId);
        }

        cardsContainer.style.maxHeight = '1000px';
    }
}

// 更新分类选项
function updateCategoryOptions() {
    const datalist = document.getElementById('category-list');
    if (!datalist) return;

    datalist.innerHTML = '';

    Object.keys(categories).forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        datalist.appendChild(option);
    });
}

// 编辑卡片
function editCard(cardId) {
    const card = currentCards.find(c => c.id === cardId);
    if (!card) return;

    document.getElementById('edit-card-id').value = card.id;
    document.getElementById('edit-front').value = card.front;
    document.getElementById('edit-back').value = card.back;
    document.getElementById('edit-category').value = card.category || '默认分类';

    const frontPreview = document.getElementById('edit-front-preview');
    const backPreview = document.getElementById('edit-back-preview');
    if (frontPreview) frontPreview.classList.add('hidden');
    if (backPreview) backPreview.classList.add('hidden');

    document.getElementById('edit-card-modal').classList.remove('hidden');
}

// 隐藏编辑卡片模态框
function hideEditCardModal() {
    document.getElementById('edit-card-modal').classList.add('hidden');
}

// 删除卡片
async function deleteCard(cardId) {
    if (!confirm('确定要删除这张卡片吗？此操作不可撤销。')) {
        return;
    }

    try {
        const response = await fetch(`/delete/${cardId}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        if (result.success) {
            showToast('卡片已删除', 'success');
            loadCards();
        } else {
            showToast('删除失败', 'error');
        }
    } catch (error) {
        console.error('删除失败:', error);
        showToast('删除失败，请重试', 'error');
    }
}

// 切换选择模式
function toggleSelectMode() {
    isSelectMode = !isSelectMode;
    const selectBtn = document.getElementById('select-mode-btn');
    const reviewSelectedBtn = document.getElementById('review-selected-btn');
    const reviewSelectedContainer = document.getElementById('review-selected-container');

    if (!selectBtn || !reviewSelectedBtn || !reviewSelectedContainer) return;

    if (isSelectMode) {
        selectBtn.classList.add('btn-primary');
        selectBtn.classList.remove('btn-secondary');
        selectBtn.title = '退出选择模式';
        reviewSelectedBtn.style.display = 'inline-flex';
        reviewSelectedContainer.classList.remove('hidden');

        updateCategoryList();
    } else {
        selectBtn.classList.remove('btn-primary');
        selectBtn.classList.add('btn-secondary');
        selectBtn.title = '选择卡片';
        reviewSelectedBtn.style.display = 'none';
        reviewSelectedContainer.classList.add('hidden');
        clearSelection();
    }
}

// 切换卡片选择状态
function toggleCardSelection(cardId, isSelected) {
    if (isSelected) {
        selectedCards.add(cardId);
    } else {
        selectedCards.delete(cardId);
    }

    const cardElement = document.getElementById(`card-${cardId}`);
    if (cardElement) {
        cardElement.classList.toggle('selected', isSelected);
    }

    updateSelectionUI();
}

// 选择分类中的所有卡片
function selectAllInCategory(category) {
    const cards = categories[category] || [];
    cards.forEach(card => {
        selectedCards.add(card.id);
    });

    const categoryId = category.replace(/\s+/g, '-').toLowerCase();
    updateCategoryCards(category, categoryId);

    updateSelectionUI();
}

// 更新选择UI
function updateSelectionUI() {
    const selectedCount = selectedCards.size;
    const selectedCountElement = document.getElementById('selected-count');
    const selectedCountDisplay = document.getElementById('selected-count-display');
    const reviewSelectedBtn = document.getElementById('review-selected-btn');

    if (selectedCountElement) selectedCountElement.textContent = selectedCount;
    if (selectedCountDisplay) selectedCountDisplay.textContent = selectedCount;

    if (reviewSelectedBtn) {
        reviewSelectedBtn.disabled = selectedCount === 0;
    }
}

// 清除选择
function clearSelection() {
    selectedCards.clear();

    Object.keys(categories).forEach(category => {
        const categoryId = category.replace(/\s+/g, '-').toLowerCase();
        if (expandedCategories.has(category)) {
            updateCategoryCards(category, categoryId);
        }
    });

    updateSelectionUI();
}

// 显示复习模式选择模态框
function showReviewModeModal() {
    // 检查是否有选中的卡片
    if (selectedCards.size === 0 && !isCustomReview) {
        // 如果没有选中卡片，使用今日所有卡片
        customReviewCards = [...todayCards];
    } else if (selectedCards.size > 0) {
        // 如果有选中的卡片，使用选中的卡片
        customReviewCards = currentCards.filter(card => selectedCards.has(card.id));
    } else {
        // 如果已经在复习中，直接继续
        startCustomReviewWithMode();
        return;
    }

    if (customReviewCards.length === 0) {
        showToast('请先选择要复习的卡片', 'warning');
        return;
    }

    // 重置选择
    document.querySelectorAll('.review-mode-option').forEach(option => {
        option.classList.remove('selected');
    });

    // 选择默认模式
    const defaultOption = document.querySelector('.review-mode-option[onclick*="' + customReviewMode + '"]');
    if (defaultOption) {
        defaultOption.classList.add('selected');
    }

    selectedReviewMode = customReviewMode;
    document.getElementById('review-mode-modal').classList.remove('hidden');
}

// 隐藏复习模式选择模态框
function hideReviewModeModal() {
    document.getElementById('review-mode-modal').classList.add('hidden');
}

// 选择复习模式
function selectReviewMode(mode) {
    selectedReviewMode = mode;

    // 更新UI选择状态
    document.querySelectorAll('.review-mode-option').forEach(option => {
        option.classList.remove('selected');
    });

    const selectedOption = document.querySelector('.review-mode-option[onclick*="' + mode + '"]');
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }
}

// 数组洗牌函数
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// 根据模式准备卡片
function prepareCardsForMode() {
    let cards = [];

    if (selectedCards.size > 0) {
        cards = currentCards.filter(card => selectedCards.has(card.id));
    } else {
        cards = [...todayCards];
    }

    switch (customReviewMode) {
        case 'list-infinite':
            // 列表无限循环 - 保持原顺序
            customReviewCards = [...cards];
            isInfiniteMode = true;
            break;

        case 'random-infinite':
            // 随机无限循环 - 打乱顺序
            customReviewCards = shuffleArray([...cards]);
            isInfiniteMode = true;
            break;

        case 'list-once':
            // 列表单次 - 保持原顺序
            customReviewCards = [...cards];
            isInfiniteMode = false;
            break;

        case 'random-once':
            // 随机单次 - 打乱顺序
            customReviewCards = shuffleArray([...cards]);
            isInfiniteMode = false;
            break;

        case 'weak-only':
            // 薄弱项练习 - 只选择重复次数少的卡片
            customReviewCards = cards.filter(card => card.repetition < 2);
            if (customReviewCards.length === 0) {
                customReviewCards = cards.filter(card => card.repetition < 3);
            }
            customReviewCards = shuffleArray(customReviewCards);
            isInfiniteMode = true;
            break;

        default:
            customReviewCards = [...cards];
            isInfiniteMode = true;
    }
}

// 根据选择的模式开始复习
function startCustomReviewWithMode() {
    if (!selectedReviewMode) {
        showToast('请选择复习模式', 'warning');
        return;
    }

    customReviewMode = selectedReviewMode;

    // 根据模式准备卡片
    prepareCardsForMode();

    if (customReviewCards.length === 0) {
        showToast('没有可复习的卡片', 'warning');
        hideReviewModeModal();
        return;
    }

    isCustomReview = true;
    customReviewIndex = 0;

    // 更新UI
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('flashcard').classList.remove('hidden');
    document.getElementById('rating-buttons').classList.add('hidden');
    document.getElementById('custom-review-buttons').classList.remove('hidden');
    document.getElementById('review-mode-indicator').classList.remove('hidden');
    document.getElementById('progress-container').classList.add('hidden');

    // 显示复习模式信息
    updateReviewModeIndicator();

    // 显示第一张卡片
    showCurrentCustomCard();

    hideReviewModeModal();
}

// 更新复习模式指示器
function updateReviewModeIndicator() {
    const indicator = document.getElementById('review-mode-indicator');
    if (!indicator) return;

    const modeNames = {
        'list-infinite': '列表无限循环',
        'random-infinite': '随机无限循环',
        'list-once': '列表单次',
        'random-once': '随机单次',
        'weak-only': '薄弱项练习'
    };

    const modeIcons = {
        'list-infinite': 'fa-infinity',
        'random-infinite': 'fa-random fa-infinity',
        'list-once': 'fa-list-ol',
        'random-once': 'fa-random',
        'weak-only': 'fa-bullseye'
    };

    indicator.innerHTML = `
        <i class="fas ${modeIcons[customReviewMode] || 'fa-user-clock'}"></i>
        ${modeNames[customReviewMode] || '主动复习模式'}
        <span class="card-count">(${customReviewCards.length}张)</span>
    `;
}

// 显示当前自定义复习卡片
function showCurrentCustomCard() {
    if (customReviewIndex >= 0 && customReviewIndex < customReviewCards.length) {
        const card = customReviewCards[customReviewIndex];

        const frontElement = document.getElementById('card-front');
        const backElement = document.getElementById('card-back');
        const frontCategory = document.getElementById('card-category');
        const backCategory = document.getElementById('card-category-back');

        if (!frontElement || !backElement) return;

        const frontInner = frontElement.querySelector('.content-inner');
        const backInner = backElement.querySelector('.content-inner');

        if (frontInner) {
            frontInner.innerHTML = renderMarkdownSafely(card.front);
            updateCardFontSize(frontElement, card.front);
        }

        if (backInner) {
            backInner.innerHTML = renderMarkdownSafely(card.back);
            updateCardFontSize(backElement, card.back);
        }

        if (frontCategory) frontCategory.textContent = card.category || '默认分类';
        if (backCategory) backCategory.textContent = card.category || '默认分类';

        const progress = ((customReviewIndex) / customReviewCards.length * 100).toFixed(1);
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');

        if (progressFill) progressFill.style.width = `${progress}%`;
        if (progressText) progressText.textContent = `${customReviewIndex + 1}/${customReviewCards.length}`;

        isFlipped = false;
        const flashcard = document.getElementById('flashcard');
        if (flashcard) {
            flashcard.classList.remove('flipped');
        }

        setTimeout(() => {
            renderMathInElement(frontElement);
            renderMathInElement(backElement);
        }, 50);
    }
}

// 上一张自定义复习卡片
function prevCustomCard() {
    if (customReviewCards.length === 0) return;

    customReviewIndex = (customReviewIndex - 1 + customReviewCards.length) % customReviewCards.length;
    showCurrentCustomCard();
}

// 下一张自定义复习卡片
function nextCustomCard() {
    if (customReviewCards.length === 0) return;

    if (isInfiniteMode) {
        // 无限模式 - 循环播放
        customReviewIndex = (customReviewIndex + 1) % customReviewCards.length;
    } else {
        // 单次模式 - 播完结束
        if (customReviewIndex < customReviewCards.length - 1) {
            customReviewIndex++;
        } else {
            // 最后一张卡片，结束复习
            showToast('复习完成！', 'success');
            endCustomReview();
            return;
        }
    }

    showCurrentCustomCard();
}

// 修改开始主动复习函数以使用模式选择
function startCustomReview() {
    showReviewModeModal();
}

// 结束自定义复习
function endCustomReview() {
    isCustomReview = false;
    customReviewCards = [];
    customReviewIndex = -1;
    clearSelection();

    // 隐藏复习相关UI
    document.getElementById('empty-state').classList.remove('hidden');
    document.getElementById('flashcard').classList.add('hidden');
    document.getElementById('rating-buttons').classList.add('hidden');
    document.getElementById('custom-review-buttons').classList.add('hidden');
    document.getElementById('review-mode-indicator').classList.add('hidden');
    document.getElementById('progress-container').classList.add('hidden');

    showToast('复习已结束', 'info');
}

// 复习分类中的所有卡片
function startCategoryReview(category) {
    const cards = categories[category] || [];
    if (cards.length === 0) {
        showToast('该分类中没有卡片', 'warning');
        return;
    }

    selectedCards.clear();
    cards.forEach(card => {
        selectedCards.add(card.id);
    });

    showReviewModeModal();
}

// 显示导出模态框
function showExportModal() {
    document.getElementById('export-modal').classList.remove('hidden');
}

// 隐藏导出模态框
function hideExportModal() {
    document.getElementById('export-modal').classList.add('hidden');
}

// 导出功能
function exportCSV() {
    window.location.href = '/export/csv';
    hideExportModal();
}

function exportTXT() {
    window.location.href = '/export/txt';
    hideExportModal();
}

async function exportXLSX() {
    try {
        const response = await fetch('/cards');
        const data = await response.json();
        const cards = data.all_cards;

        const worksheetData = [
            ['ID', '正面', '背面', '分类', '重复次数', '间隔天数', '易度因子', '下次复习时间'],
            ...cards.map(card => [
                card.id,
                card.front,
                card.back,
                card.category || '默认分类',
                card.repetition,
                card.interval,
                card.ease_factor || 2.5,
                card.next_review ? new Date(card.next_review).toLocaleDateString('zh-CN') : ''
            ])
        ];

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

        const colWidths = [
            { wch: 5 },
            { wch: 30 },
            { wch: 30 },
            { wch: 15 },
            { wch: 10 },
            { wch: 10 },
            { wch: 10 },
            { wch: 15 }
        ];
        worksheet['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(workbook, worksheet, '闪卡数据');

        XLSX.writeFile(workbook, 'flashcards.xlsx');
        hideExportModal();
        showToast('Excel文件导出成功！', 'success');
    } catch (error) {
        console.error('导出Excel失败:', error);
        showToast('导出失败，请重试', 'error');
    }
}

// 导入功能
function showImportModal() {
    document.getElementById('import-modal').classList.remove('hidden');
}

function hideImportModal() {
    document.getElementById('import-modal').classList.add('hidden');
}

async function importFile(type) {
    const fileInput = document.getElementById(`${type}-file`);
    if (!fileInput.files.length) return;

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
        let response;
        if (type === 'xlsx') {
            const file = fileInput.files[0];
            const reader = new FileReader();

            reader.onload = async function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                    const cards = [];
                    for (let i = 1; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        if (row && row.length >= 2) {
                            cards.push({
                                front: row[0]?.toString() || '',
                                back: row[1]?.toString() || '',
                                category: row[2]?.toString() || 'imported'
                            });
                        }
                    }

                    const importResponse = await fetch('/import/batch', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cards })
                    });

                    const result = await importResponse.json();
                    if (result.success) {
                        showToast(`成功导入 ${result.count} 张卡片！`, 'success');
                        fileInput.value = '';
                        hideImportModal();
                        loadCards();
                    } else {
                        showToast('导入失败：' + result.error, 'error');
                    }
                } catch (error) {
                    console.error('解析Excel失败:', error);
                    showToast('文件解析失败，请检查格式', 'error');
                }
            };

            reader.readAsArrayBuffer(file);
            return;
        } else {
            response = await fetch('/import', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                showToast('导入成功！', 'success');
                fileInput.value = '';
                hideImportModal();
                loadCards();
            } else {
                showToast('导入失败：' + result.error, 'error');
            }
        }
    } catch (error) {
        console.error('导入失败:', error);
        showToast('导入失败，请重试', 'error');
    }
}

// 显示提示信息
function showToast(message, type = 'info') {
    const oldToast = document.querySelector('.toast');
    if (oldToast) oldToast.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;

    toast.style.cssText = `
        position: fixed;
        top: 1rem;
        right: 1rem;
        background: ${type === 'success' ? 'var(--success-color)' : type === 'error' ? 'var(--danger-color)' : type === 'warning' ? 'var(--warning-color)' : 'var(--primary-color)'};
        color: white;
        padding: 0.75rem 1rem;
        border-radius: var(--radius);
        box-shadow: var(--shadow-lg);
        z-index: 1000;
        animation: fadeIn 0.3s ease;
        max-width: 300px;
    `;

    const toastContent = toast.querySelector('.toast-content');
    toastContent.style.cssText = `
        display: flex;
        align-items: center;
        gap: 0.5rem;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// 调试函数：检查卡片显示问题
function debugCardDisplay() {
    const frontElement = document.getElementById('card-front');
    const backElement = document.getElementById('card-back');

    if (frontElement) {
        console.log('正面元素:', frontElement);
        console.log('正面HTML:', frontElement.innerHTML);
        console.log('正面计算样式:', window.getComputedStyle(frontElement));
    }

    if (backElement) {
        console.log('背面元素:', backElement);
        console.log('背面HTML:', backElement.innerHTML);
        console.log('背面计算样式:', window.getComputedStyle(backElement));
    }
}
