// 初始化数据
        let noteData = JSON.parse(localStorage.getItem('miNoteTabFixData')) || (() => {
            const defaultParent = {
                id: generateId(),
                name: '默认小标签',
                children: [
                    {
                        id: generateId(),
                        name: '默认笔记',
                        content: '',
                        createTime: new Date().toLocaleString()
                    }
                ]
            };
            return {
                parentTabs: [defaultParent],
                activeParentId: defaultParent.id,
                activeChildId: defaultParent.children[0].id,
                fontSize: '17px',
                customFontSizes: []
            };
        })();

        // 状态管理
        const state = {
            image: {
                isEdit: false,
                currentImg: null,
                insertRange: null,
                isProcessing: false,
                baseSize: { width: 0, height: 0 }
            },
            deleteTarget: {
                type: null,
                id: null
            },
            fontSelection: {
                isSelecting: false,
                range: null,
                toolbarTimer: null
            },
            // 新增：键盘状态
            keyboardVisible: false
        };

        // DOM 元素
        const elements = {
            fontToolbar: document.getElementById('font-toolbar'),
            customFontSize: document.getElementById('custom-font-size'),
            applyCustomFont: document.getElementById('apply-custom-font'),
            fontOptions: document.querySelectorAll('.font-option[data-size]'),
            appTitle: document.getElementById('app-title'),
            parentTabList: document.getElementById('parent-tab-list'),
            addParentTabBtn: document.getElementById('add-parent-tab-btn'),
            addParentTabModal: document.getElementById('add-parent-tab-modal'),
            newParentTabName: document.getElementById('new-parent-tab-name'),
            childTabList: document.getElementById('child-tab-list'),
            addChildTabBtn: document.getElementById('add-child-tab-btn'),
            addChildTabModal: document.getElementById('add-child-tab-modal'),
            newChildTabName: document.getElementById('new-child-tab-name'),
            currentParentTip: document.getElementById('current-parent-tip'),
            noteContent: document.getElementById('note-content'),
            saveBtn: document.getElementById('save-btn'),
            imageModal: document.getElementById('image-modal'),
            imageModalTitle: document.getElementById('image-modal-title'),
            imageUrl: document.getElementById('image-url'),
            imageType: document.getElementById('image-type'),
            sizeControlGroup: document.getElementById('size-control-group'),
            sizePercent: document.getElementById('size-percent'),
            sizePreview: document.getElementById('size-preview'),
            dataManagementModal: document.getElementById('data-management-modal'),
            exportDataBtn: document.getElementById('export-data'),
            importDataBtn: document.getElementById('import-data'),
            fileInput: document.getElementById('file-input'),
            deleteAllDataBtn: document.getElementById('delete-all-data'),
            deleteConfirmModal: document.getElementById('delete-confirm-modal'),
            deleteConfirmText: document.getElementById('delete-confirm-text'),
            confirmDeleteBtn: document.getElementById('confirm-delete'),
            searchInput: document.getElementById('search-input'),
            searchResult: document.getElementById('search-result'),
            searchBox: document.querySelector('.search-box'),
            modalCloseButtons: document.querySelectorAll('.modal-close'),
            cancelButtons: document.querySelectorAll('.modal-btn.cancel'),
            confirmButtons: document.querySelectorAll('.modal-btn.confirm')
        };

        // -------------------------- 工具函数 --------------------------
        function saveData() {
            localStorage.setItem('miNoteTabFixData', JSON.stringify(noteData));
        }

        function generateId() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2);
        }

        function getActiveParent() {
            const parent = noteData.parentTabs.find(p => p.id === noteData.activeParentId);
            return parent || noteData.parentTabs[0] || { id: '', name: '', children: [] };
        }

        function getActiveChild() {
            const activeParent = getActiveParent();
            const child = activeParent.children.find(c => c.id === noteData.activeChildId);
            return child || activeParent.children[0] || { id: '', name: '', content: '' };
        }

        // -------------------------- 字体工具栏优化 --------------------------
        function initFontToolbar() {
            // 监听文本选择事件
            document.addEventListener('selectionchange', handleTextSelection);
            
            // 点击编辑区域外隐藏工具栏
            document.addEventListener('mousedown', (e) => {
                if (!elements.fontToolbar.contains(e.target) && 
                    !elements.noteContent.contains(e.target)) {
                    hideFontToolbar();
                }
            });
            
            // 预设字体选项点击事件
            elements.fontOptions.forEach(option => {
                option.addEventListener('click', () => {
                    const size = option.getAttribute('data-size');
                    applyFontSizeToSelection(size);
                    hideFontToolbar();
                });
            });
            
            // 应用自定义字体大小
            elements.applyCustomFont.addEventListener('click', () => {
                const size = elements.customFontSize.value;
                if (size && size >= 10 && size <= 50) {
                    applyFontSizeToSelection(`${size}px`);
                    
                    if (!noteData.customFontSizes.includes(`${size}px`)) {
                        noteData.customFontSizes.push(`${size}px`);
                        saveData();
                    }
                    
                    hideFontToolbar();
                    elements.customFontSize.value = '';
                } else {
                    alert('请输入10到50之间的有效字体大小');
                }
            });

            // 监听键盘弹出/收起
            detectKeyboard();
        }

        // 检测键盘状态
        function detectKeyboard() {
            const originalViewportHeight = window.innerHeight;
            
            window.addEventListener('resize', () => {
                const newViewportHeight = window.innerHeight;
                const diff = Math.abs(originalViewportHeight - newViewportHeight);
                
                // 如果视口高度变化较大，认为是键盘弹出/收起
                if (diff > 100) {
                    state.keyboardVisible = newViewportHeight < originalViewportHeight;
                    
                    // 如果工具栏正在显示，重新定位
                    if (elements.fontToolbar.classList.contains('show')) {
                        showFontToolbar();
                    }
                }
            });
        }
        
        function handleTextSelection() {
            const selection = window.getSelection();
            
            if (state.fontSelection.toolbarTimer) {
                clearTimeout(state.fontSelection.toolbarTimer);
            }
            
            if (selection.isCollapsed || !selection.rangeCount || 
                !elements.noteContent.contains(selection.anchorNode)) {
                hideFontToolbar();
                return;
            }
            
            state.fontSelection.range = selection.getRangeAt(0);
            
            state.fontSelection.toolbarTimer = setTimeout(() => {
                showFontToolbar();
            }, 300);
        }
        
        function showFontToolbar() {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
            
            const range = state.fontSelection.range || selection.getRangeAt(0);
            
            // 尝试获取选中文本的边界矩形
            let rect;
            try {
                rect = range.getBoundingClientRect();
                
                // 如果矩形无效（选中内容包含图片或跨越多元素）
                if (rect.width === 0 && rect.height === 0) {
                    // 获取第一个文本节点的位置
                    const firstNode = getFirstTextNode(range);
                    if (firstNode && firstNode.parentElement) {
                        rect = firstNode.parentElement.getBoundingClientRect();
                    }
                }
            } catch (e) {
                console.error('获取选中区域位置失败:', e);
                // 使用默认位置（屏幕中央）
                positionToolbarAtCenter();
                return;
            }
            
            // 获取工具栏尺寸
            const toolbarRect = elements.fontToolbar.getBoundingClientRect();
            const toolbarWidth = toolbarRect.width;
            const toolbarHeight = toolbarRect.height;
            
            // 计算理想位置 - 在选中文本下方居中
            let top = rect.bottom + window.scrollY + 10;
            let left = rect.left + window.scrollX + (rect.width / 2) - (toolbarWidth / 2);
            
            // 确保工具栏不会超出视口边界
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // 水平边界检查
            if (left < 10) {
                left = 10;
            } else if (left + toolbarWidth > viewportWidth - 10) {
                left = viewportWidth - toolbarWidth - 10;
            }
            
            // 垂直边界检查 - 如果下方空间不足，显示在文本上方
            // 如果键盘弹出，强制显示在可视区域上方
            if (state.keyboardVisible || (top + toolbarHeight > viewportHeight + window.scrollY - 10)) {
                top = rect.top + window.scrollY - toolbarHeight - 10;
                
                // 如果上方空间也不足，就固定在视口顶部
                if (top < window.scrollY + 10) {
                    top = window.scrollY + 10;
                }
            }
            
            // 应用位置
            elements.fontToolbar.style.top = `${top}px`;
            elements.fontToolbar.style.left = `${left}px`;
            elements.fontToolbar.classList.add('show');
        }

        // 获取选区中的第一个文本节点
        function getFirstTextNode(range) {
            if (range.startContainer.nodeType === Node.TEXT_NODE) {
                return range.startContainer;
            }
            
            // 遍历选区中的节点，找到第一个文本节点
            for (let i = 0; i < range.commonAncestorContainer.childNodes.length; i++) {
                const node = range.commonAncestorContainer.childNodes[i];
                if (range.intersectsNode(node) && node.nodeType === Node.TEXT_NODE) {
                    return node;
                }
            }
            
            return null;
        }

        // 将工具栏定位在屏幕中央
        function positionToolbarAtCenter() {
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const toolbarRect = elements.fontToolbar.getBoundingClientRect();
            
            const top = (viewportHeight - toolbarRect.height) / 2 + window.scrollY;
            const left = (viewportWidth - toolbarRect.width) / 2 + window.scrollX;
            
            elements.fontToolbar.style.top = `${top}px`;
            elements.fontToolbar.style.left = `${left}px`;
            elements.fontToolbar.classList.add('show');
        }
        
        function hideFontToolbar() {
            elements.fontToolbar.classList.remove('show');
        }
        
        function applyFontSizeToSelection(size) {
            const selection = window.getSelection();
            
            if (!selection.rangeCount) return;
            
            const range = state.fontSelection.range || selection.getRangeAt(0);
            const selectedText = range.toString();
            
            if (!selectedText) return;
            
            // 创建带有字体大小的span元素
            const span = document.createElement('span');
            span.style.fontSize = size;
            span.textContent = selectedText;
            
            // 用span替换选中的文本
            range.deleteContents();
            range.insertNode(span);
            
            // 清除选择
            selection.removeAllRanges();
            
            // 保存内容
            saveNoteContent();
        }

        // -------------------------- 其他功能 --------------------------
        // 这里保留其他功能函数，如数据管理、删除功能等
        // 为了简洁，省略了部分重复代码
        
        function initDataManagement() {
            elements.appTitle.addEventListener('click', () => {
                elements.dataManagementModal.classList.remove('hidden');
            });
            
            elements.exportDataBtn.addEventListener('click', exportData);
            
            elements.importDataBtn.addEventListener('click', () => {
                elements.fileInput.click();
            });
            
            elements.fileInput.addEventListener('change', importData);
            
            elements.deleteAllDataBtn.addEventListener('click', () => {
                showDeleteConfirm('all', null, '您确定要删除所有笔记数据吗？此操作不可撤销。');
            });
        }
        
        function exportData() {
            const dataStr = JSON.stringify(noteData);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            
            const exportFileDefaultName = `小米笔记备份_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
            
            elements.dataManagementModal.classList.add('hidden');
            alert('数据导出成功！');
        }
        
        function importData(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const importedData = JSON.parse(e.target.result);
                    
                    if (importedData && importedData.parentTabs && Array.isArray(importedData.parentTabs)) {
                        if (confirm('导入数据将覆盖当前所有笔记，确定要继续吗？')) {
                            noteData = importedData;
                            saveData();
                            location.reload();
                        }
                    } else {
                        alert('导入的文件格式不正确');
                    }
                } catch (error) {
                    alert('导入失败：文件格式错误');
                    console.error('导入错误:', error);
                }
            };
            reader.readAsText(file);
            event.target.value = '';
        }

        function initDeleteFunctions() {
            elements.modalCloseButtons.forEach(btn => {
                btn.addEventListener('click', function() {
                    this.closest('.modal').classList.add('hidden');
                });
            });
            
            elements.cancelButtons.forEach(btn => {
                btn.addEventListener('click', function() {
                    this.closest('.modal').classList.add('hidden');
                });
            });
            
            elements.confirmDeleteBtn.addEventListener('click', executeDelete);
        }
        
        function showDeleteConfirm(type, id, message) {
            state.deleteTarget.type = type;
            state.deleteTarget.id = id;
            elements.deleteConfirmText.textContent = message;
            elements.deleteConfirmModal.classList.remove('hidden');
        }
        
        function executeDelete() {
            if (state.deleteTarget.type === 'parent') {
                const index = noteData.parentTabs.findIndex(p => p.id === state.deleteTarget.id);
                if (index !== -1) {
                    noteData.parentTabs.splice(index, 1);
                    
                    if (noteData.activeParentId === state.deleteTarget.id) {
                        noteData.activeParentId = noteData.parentTabs[0]?.id || '';
                        noteData.activeChildId = noteData.parentTabs[0]?.children[0]?.id || '';
                    }
                    
                    saveData();
                    renderParentTabs();
                    renderChildTabs();
                    renderActiveChildContent();
                }
            } else if (state.deleteTarget.type === 'child') {
                const activeParent = getActiveParent();
                const index = activeParent.children.findIndex(c => c.id === state.deleteTarget.id);
                if (index !== -1) {
                    activeParent.children.splice(index, 1);
                    
                    if (noteData.activeChildId === state.deleteTarget.id) {
                        noteData.activeChildId = activeParent.children[0]?.id || '';
                    }
                    
                    saveData();
                    renderChildTabs();
                    renderActiveChildContent();
                }
            } else if (state.deleteTarget.type === 'all') {
                if (confirm('确定要删除所有数据吗？此操作无法撤销！')) {
                    localStorage.removeItem('miNoteTabFixData');
                    alert('所有数据已删除，页面将重新加载');
                    location.reload();
                }
            }
            
            elements.deleteConfirmModal.classList.add('hidden');
        }

        function renderParentTabs() {
            const activeParentId = noteData.activeParentId;
            const parentHtml = noteData.parentTabs.map(parent => `
                <div class="parent-tab-item ${parent.id === activeParentId ? 'active' : ''}" data-parent-id="${parent.id}">
                    ${parent.name}
                    <span class="tab-close" data-parent-id="${parent.id}">&times;</span>
                </div>
            `).join('');
            elements.parentTabList.innerHTML = parentHtml;
            
            document.querySelectorAll('.parent-tab-item .tab-close').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const parentId = this.getAttribute('data-parent-id');
                    const parent = noteData.parentTabs.find(p => p.id === parentId);
                    showDeleteConfirm('parent', parentId, `确定要删除"${parent.name}"及其所有笔记吗？`);
                });
            });
        }

        function renderChildTabs() {
            const activeParent = getActiveParent();
            const activeChildId = noteData.activeChildId;
            const childHtml = activeParent.children.map(child => `
                <div class="child-tab-item ${child.id === activeChildId ? 'active' : ''}" data-child-id="${child.id}">
                    ${child.name}
                    <span class="tab-close" data-child-id="${child.id}">&times;</span>
                </div>
            `).join('');
            elements.childTabList.innerHTML = childHtml;
            
            elements.currentParentTip.textContent = `所属小标签页：${activeParent.name || '未命名'}`;
            
            document.querySelectorAll('.child-tab-item .tab-close').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const childId = this.getAttribute('data-child-id');
                    const child = activeParent.children.find(c => c.id === childId);
                    showDeleteConfirm('child', childId, `确定要删除笔记"${child.name}"吗？`);
                });
            });
        }

        function renderActiveChildContent() {
            const activeChild = getActiveChild();
            elements.noteContent.innerHTML = activeChild.content || '';
            
            document.querySelectorAll('.resizable-img').forEach(img => {
                img.addEventListener('click', imgClickHandler);
                img.addEventListener('dblclick', dblClickHandler);
                
                if (img.classList.contains('load-error')) {
                    img.addEventListener('click', retryLoadHandler);
                }
            });
        }

        function bindParentTabClick() {
            elements.parentTabList.addEventListener('click', (e) => {
                const parentTab = e.target.closest('.parent-tab-item');
                if (!parentTab) return;
                
                const parentId = parentTab.dataset.parentId;
                if (!parentId) return;
                
                noteData.activeParentId = parentId;
                const activeParent = getActiveParent();
                noteData.activeChildId = activeParent.children[0]?.id || '';
                
                renderParentTabs();
                renderChildTabs();
                renderActiveChildContent();
                saveData();
            });
        }

        function bindChildTabClick() {
            elements.childTabList.addEventListener('click', (e) => {
                const childTab = e.target.closest('.child-tab-item');
                if (!childTab) return;
                
                const childId = childTab.dataset.childId;
                if (!childId) return;
                
                noteData.activeChildId = childId;
                
                renderChildTabs();
                renderActiveChildContent();
                saveData();
            });
        }

        function imgClickHandler(e) {
            e.stopPropagation();
            document.querySelectorAll('.resizable-img').forEach(otherImg => {
                if (otherImg !== this) otherImg.classList.remove('active');
            });
            this.classList.toggle('active');
        }

        function dblClickHandler(e) {
            e.stopPropagation();
        }

        function retryLoadHandler() {
            const originalUrl = this.dataset.originalUrl;
            this.src = originalUrl + '?t=' + Date.now();
            this.classList.remove('load-error');
        }

        function addParentTab() {
            const name = elements.newParentTabName.value.trim() || '未命名小标签';
            const isDuplicate = noteData.parentTabs.some(p => p.name === name);
            if (isDuplicate) {
                alert('该小标签页名称已存在，请换一个名称');
                return;
            }

            const newParent = {
                id: generateId(),
                name: name,
                children: [
                    {
                        id: generateId(),
                        name: '新建笔记',
                        content: '',
                        createTime: new Date().toLocaleString()
                    }
                ]
            };

            noteData.parentTabs.push(newParent);
            noteData.activeParentId = newParent.id;
            noteData.activeChildId = newParent.children[0].id;

            elements.newParentTabName.value = '';
            elements.addParentTabModal.classList.add('hidden');
            
            renderParentTabs();
            renderChildTabs();
            renderActiveChildContent();
            saveData();
        }

        function addChildTab() {
            const activeParent = getActiveParent();
            if (!activeParent.id) {
                alert('请先创建并选择一个小标签页');
                return;
            }

            const name = elements.newChildTabName.value.trim() || '未命名笔记';
            const isDuplicate = activeParent.children.some(c => c.name === name);
            if (isDuplicate) {
                alert('该笔记文件名已存在，请换一个名称');
                return;
            }

            const newChild = {
                id: generateId(),
                name: name,
                content: '',
                createTime: new Date().toLocaleString()
            };

            activeParent.children.push(newChild);
            noteData.activeChildId = newChild.id;

            elements.newChildTabName.value = '';
            elements.addChildTabModal.classList.add('hidden');
            
            renderChildTabs();
            renderActiveChildContent();
            elements.noteContent.focus();
            saveData();
        }

        function saveNoteContent() {
            const activeChild = getActiveChild();
            if (!activeChild.id) return false;

            activeChild.content = elements.noteContent.innerHTML;
            saveData();
            return true;
        }

        function searchNotes(keyword) {
            if (!keyword.trim()) {
                elements.searchResult.classList.add('hidden');
                return;
            }

            const result = [];
            noteData.parentTabs.forEach(parent => {
                parent.children.forEach(child => {
                    if (child.name.includes(keyword) || (child.content && child.content.includes(keyword))) {
                        result.push({ ...child, parentName: parent.name, parentId: parent.id });
                    }
                });
            });

            if (result.length === 0) {
                elements.searchResult.innerHTML = '<div class="note-item">未找到匹配笔记</div>';
            } else {
                elements.searchResult.innerHTML = result.map(item => `
                    <div class="note-item" data-parent-id="${item.parentId}" data-child-id="${item.id}">
                        <h4>${item.name}</h4>
                        <p>所属小标签：${item.parentName} | 时间：${item.createTime}</p>
                    </div>
                `).join('');

                elements.searchResult.addEventListener('click', (e) => {
                    const noteItem = e.target.closest('.note-item');
                    if (!noteItem) return;

                    const parentId = noteItem.dataset.parentId;
                    const childId = noteItem.dataset.childId;
                    if (!parentId || !childId) return;

                    noteData.activeParentId = parentId;
                    noteData.activeChildId = childId;

                    renderParentTabs();
                    renderChildTabs();
                    renderActiveChildContent();
                    elements.searchResult.classList.add('hidden');
                });
            }

            elements.searchResult.classList.remove('hidden');
        }

        // -------------------------- 事件绑定 --------------------------
        function bindAllEvents() {
            bindParentTabClick();
            bindChildTabClick();

            elements.addParentTabBtn.addEventListener('click', () => {
                elements.addParentTabModal.classList.remove('hidden');
                elements.newParentTabName.focus();
            });
            
            document.querySelector('#add-parent-tab-modal .modal-btn.confirm').addEventListener('click', addParentTab);

            elements.addChildTabBtn.addEventListener('click', () => {
                const activeParent = getActiveParent();
                if (!activeParent.id) {
                    alert('请先创建并选择一个小标签页');
                    return;
                }
                elements.addChildTabModal.classList.remove('hidden');
                elements.newChildTabName.focus();
            });
            
            document.querySelector('#add-child-tab-modal .modal-btn.confirm').addEventListener('click', addChildTab);

            elements.saveBtn.addEventListener('click', () => {
                if (saveNoteContent()) alert('保存成功');
            });

            let autoSaveTimer = null;
            elements.noteContent.addEventListener('input', () => {
                clearTimeout(autoSaveTimer);
                autoSaveTimer = setTimeout(saveNoteContent, 3000);
            });

            elements.searchInput.addEventListener('input', (e) => {
                searchNotes(e.target.value);
            });
            document.addEventListener('click', (e) => {
                if (!elements.searchBox.contains(e.target)) {
                    elements.searchResult.classList.add('hidden');
                }
            });

            document.addEventListener('click', (e) => {
                if (!e.target.closest('.resizable-img') && !e.target.closest('.modal')) {
                    document.querySelectorAll('.resizable-img').forEach(img => {
                        img.classList.remove('active');
                    });
                }
            });

            window.addEventListener('beforeunload', saveNoteContent);
            
            initFontToolbar();
            initDataManagement();
            initDeleteFunctions();
        }

        // -------------------------- 初始化 --------------------------
        function init() {
            renderParentTabs();
            renderChildTabs();
            renderActiveChildContent();
            bindAllEvents();
            saveData();
        }

        // 启动应用
        init();