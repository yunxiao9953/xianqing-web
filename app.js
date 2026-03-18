const App = {
    currentPage: 'home',
    currentRating: 5,
    workType: 'short',
    chapterCount: 1,
    isRegisterMode: false,
    currentUser: null,
    profileTab: 'all',
    editingWorkId: null,
    isAdmin: false,
    
    init() {
        this.checkSession();
        this.initNavigation();
        this.initForms();
        this.initRating();
        this.initModal();
        this.initScrollAnimations();
        this.initWorkTypeSelector();
        this.initWordCount();
        this.initAuth();
    },

    initAuth() {
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const loginModal = document.getElementById('loginModal');
        const loginModalClose = document.getElementById('loginModalClose');
        const loginForm = document.getElementById('loginForm');
        const authSwitchBtn = document.getElementById('authSwitchBtn');
        
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                loginModal.classList.add('show');
            });
        }
        
        if (loginModalClose) {
            loginModalClose.addEventListener('click', () => {
                loginModal.classList.remove('show');
            });
        }
        
        if (loginModal) {
            loginModal.addEventListener('click', (e) => {
                if (e.target === loginModal) {
                    loginModal.classList.remove('show');
                }
            });
        }
        
        if (authSwitchBtn) {
            authSwitchBtn.addEventListener('click', () => {
                this.toggleAuthMode();
            });
        }
        
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAuth(loginForm);
            });
        }
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }
    },

    checkSession() {
        const savedUser = localStorage.getItem('xianqing_user');
        if (savedUser) {
            try {
                this.currentUser = JSON.parse(savedUser);
                this.checkAdminStatus();
                this.updateAuthUI();
            } catch (e) {
                this.currentUser = null;
                localStorage.removeItem('xianqing_user');
            }
        }
    },

    async checkAdminStatus() {
        if (!this.currentUser) {
            this.isAdmin = false;
            return;
        }
        this.isAdmin = this.currentUser.username === 'admin';
    },

    toggleAuthMode() {
        this.isRegisterMode = !this.isRegisterMode;
        
        const title = document.getElementById('authModalTitle');
        const submitBtn = document.getElementById('authSubmitBtn');
        const switchText = document.getElementById('authSwitchText');
        const switchBtn = document.getElementById('authSwitchBtn');
        const registerFields = document.getElementById('registerFields');
        
        if (this.isRegisterMode) {
            title.textContent = '注册';
            submitBtn.textContent = '注册';
            switchText.textContent = '已有账号？';
            switchBtn.textContent = '立即登录';
            registerFields.style.display = 'block';
        } else {
            title.textContent = '登录';
            submitBtn.textContent = '登录';
            switchText.textContent = '还没有账号？';
            switchBtn.textContent = '立即注册';
            registerFields.style.display = 'none';
        }
    },

    async handleAuth(form) {
        const formData = new FormData(form);
        const username = formData.get('username').trim();
        const password = formData.get('password');
        
        if (!username || !password) {
            this.showToast('请填写用户名和密码', 'error');
            return;
        }
        
        if (username.length < 2) {
            this.showToast('用户名至少需要2个字符', 'error');
            return;
        }
        
        if (password.length < 4) {
            this.showToast('密码至少需要4个字符', 'error');
            return;
        }
        
        if (this.isRegisterMode) {
            const confirmPassword = formData.get('confirmPassword');
            if (password !== confirmPassword) {
                this.showToast('两次输入的密码不一致', 'error');
                return;
            }
            await this.register(username, password);
        } else {
            await this.login(username, password);
        }
    },

    async register(username, password) {
        try {
            const { data: existingUsers, error: checkError } = await dbClient
                .from('users')
                .select('username')
                .eq('username', username);
            
            if (checkError) {
                console.error('Check user error:', checkError);
                this.showToast('注册失败，请重试', 'error');
                return;
            }
            
            if (existingUsers && existingUsers.length > 0) {
                this.showToast('用户名已存在', 'error');
                return;
            }
            
            const hashedPassword = this.simpleHash(password);
            
            const { data, error } = await dbClient
                .from('users')
                .insert([{
                    username: username,
                    password: hashedPassword,
                    display_name: username
                }])
                .select();
            
            if (error) {
                console.error('Register error:', error);
                this.showToast('注册失败：' + error.message, 'error');
                return;
            }
            
            if (data && data[0]) {
                this.currentUser = {
                    id: data[0].id,
                    username: username,
                    displayName: username
                };
                this.isAdmin = username === 'admin';
                
                localStorage.setItem('xianqing_user', JSON.stringify(this.currentUser));
                
                document.getElementById('loginModal').classList.remove('show');
                document.getElementById('loginForm').reset();
                
                this.updateAuthUI();
                this.showToast('注册成功！', 'success');
            }
        } catch (err) {
            console.error('Register failed:', err);
            this.showToast('注册失败，请检查网络连接', 'error');
        }
    },

    async login(username, password) {
        try {
            const hashedPassword = this.simpleHash(password);
            
            const { data: users, error } = await dbClient
                .from('users')
                .select('*')
                .eq('username', username)
                .eq('password', hashedPassword);
            
            if (error) {
                console.error('Login error:', error);
                this.showToast('登录失败，请重试', 'error');
                return;
            }
            
            if (!users || users.length === 0) {
                this.showToast('用户名或密码错误', 'error');
                return;
            }
            
            const user = users[0];
            this.currentUser = {
                id: user.id,
                username: user.username,
                displayName: user.display_name || user.username
            };
            this.isAdmin = user.username === 'admin';
            
            localStorage.setItem('xianqing_user', JSON.stringify(this.currentUser));
            
            document.getElementById('loginModal').classList.remove('show');
            document.getElementById('loginForm').reset();
            
            this.updateAuthUI();
            this.showToast(`欢迎回来，${this.currentUser.username}！`, 'success');
        } catch (err) {
            console.error('Login failed:', err);
            this.showToast('登录失败，请检查网络连接', 'error');
        }
    },

    logout() {
        this.currentUser = null;
        this.isAdmin = false;
        localStorage.removeItem('xianqing_user');
        this.updateAuthUI();
        this.navigateTo('home');
        this.showToast('已退出登录', 'success');
    },

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'xq' + Math.abs(hash).toString(16) + str.length.toString(16);
    },

    isOwner(work) {
        if (!this.currentUser || !work) return false;
        return String(work.author_id) === String(this.currentUser.id);
    },

    updateAuthUI() {
        const loginBtn = document.getElementById('loginBtn');
        const userInfo = document.getElementById('userInfo');
        const userAvatar = document.getElementById('userAvatar');
        const userNameEl = document.getElementById('userName');
        const profileLink = document.getElementById('profileLink');
        const adminLink = document.getElementById('adminLink');
        
        if (this.currentUser) {
            if (loginBtn) loginBtn.style.display = 'none';
            if (userInfo) userInfo.style.display = 'flex';
            if (userAvatar) userAvatar.textContent = this.currentUser.username.charAt(0).toUpperCase();
            if (userNameEl) userNameEl.textContent = this.currentUser.username;
            if (profileLink) profileLink.style.display = 'inline-block';
            if (adminLink) adminLink.style.display = this.isAdmin ? 'inline-block' : 'none';
            
            this.loadProfile();
        } else {
            if (loginBtn) loginBtn.style.display = 'block';
            if (userInfo) userInfo.style.display = 'none';
            if (profileLink) profileLink.style.display = 'none';
            if (adminLink) adminLink.style.display = 'none';
        }
        
        this.loadActivities();
        this.loadWorks();
        this.loadRecommendations();
    },

    async loadProfile() {
        if (!this.currentUser) return;
        
        const profileAvatar = document.getElementById('profileAvatar');
        const profileName = document.getElementById('profileName');
        const profileWorkCount = document.getElementById('profileWorkCount');
        const profileWordCount = document.getElementById('profileWordCount');
        
        if (profileAvatar) {
            profileAvatar.textContent = this.currentUser.username.charAt(0).toUpperCase();
        }
        if (profileName) {
            profileName.textContent = this.currentUser.displayName || this.currentUser.username;
        }
        
        try {
            const { data: works, error } = await dbClient
                .from('works')
                .select('*')
                .eq('author_id', this.currentUser.id)
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('加载作品失败:', error);
                if (profileWorkCount) profileWorkCount.textContent = '0';
                if (profileWordCount) profileWordCount.textContent = '0';
                return;
            }
            
            const worksList = works || [];
            const totalWords = worksList.reduce((sum, w) => sum + (w.word_count || 0), 0);
            
            if (profileWorkCount) profileWorkCount.textContent = worksList.length;
            if (profileWordCount) profileWordCount.textContent = totalWords;
            
            this.loadMyWorks();
        } catch (err) {
            console.error('Load profile failed:', err);
        }
    },

    async loadMyWorks(filter = 'all') {
        const grid = document.getElementById('myWorksGrid');
        if (!grid || !this.currentUser) return;
        
        try {
            let query = dbClient
                .from('works')
                .select('*')
                .eq('author_id', this.currentUser.id)
                .order('created_at', { ascending: false });
            
            if (filter === 'public') {
                query = query.eq('visibility', 'public');
            } else if (filter === 'private') {
                query = query.eq('visibility', 'private');
            }

            const { data: works, error } = await query;
            
            if (error) {
                console.error('加载作品失败:', error);
                grid.innerHTML = `<div class="empty-state"><p class="empty-state-text">加载失败</p></div>`;
                return;
            }

            if (!works || works.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📝</div>
                        <p class="empty-state-text">${filter === 'all' ? '暂无作品，快来投稿吧！' : '暂无' + (filter === 'public' ? '公开' : '私密') + '作品'}</p>
                    </div>
                `;
                return;
            }

            grid.innerHTML = works.map((work, index) => {
                const typeLabel = work.work_type === 'chaptered' ? '连载' : '短篇';
                const typeClass = work.work_type === 'chaptered' ? 'chaptered' : 'short';
                const wordCount = work.word_count || 0;
                const visibilityLabel = work.visibility === 'private' ? '🔒 私密' : '🌐 公开';
                const visibilityClass = work.visibility === 'private' ? 'private' : 'public';
                
                return `
                    <div class="work-card animate-on-scroll stagger-${(index % 6) + 1}" 
                         onclick="App.showWorkDetail(${work.id})">
                        <span class="work-type-badge ${typeClass}">${typeLabel}</span>
                        <span class="work-visibility-badge ${visibilityClass}">${visibilityLabel}</span>
                        <h3 class="work-title">${work.title}</h3>
                        <p class="work-summary">${work.summary || ''}</p>
                        <div class="work-meta">
                            <span class="work-meta-item">📅 ${this.formatDate(work.created_at)}</span>
                            <span class="work-meta-item">📝 ${wordCount} 字</span>
                        </div>
                    </div>
                `;
            }).join('');

            this.initScrollAnimations();
        } catch (err) {
            console.error('Load my works failed:', err);
        }
    },

    initProfileTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.profileTab = btn.dataset.tab;
                this.loadMyWorks(this.profileTab);
            });
        });
    },

    initNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        const navToggle = document.getElementById('navToggle');
        const navLinksContainer = document.querySelector('.nav-links');

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;
                
                if (page === 'submit' && !this.currentUser) {
                    this.showToast('请先登录后再投稿', 'error');
                    document.getElementById('loginModal').classList.add('show');
                    return;
                }
                
                if (page === 'profile' && !this.currentUser) {
                    this.showToast('请先登录', 'error');
                    document.getElementById('loginModal').classList.add('show');
                    return;
                }

                if (page === 'admin' && !this.isAdmin) {
                    this.showToast('只有管理员可以访问', 'error');
                    return;
                }
                
                this.navigateTo(page);
                navLinksContainer.classList.remove('show');
            });
        });

        if (navToggle) {
            navToggle.addEventListener('click', () => {
                navLinksContainer.classList.toggle('show');
            });
        }

        document.querySelectorAll('[data-goto]').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.goto;
                this.navigateTo(page);
            });
        });
    },

    navigateTo(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        
        const targetPage = document.getElementById(page);
        const targetLink = document.querySelector(`.nav-link[data-page="${page}"]`);
        
        if (targetPage) {
            targetPage.classList.add('active');
            this.initScrollAnimations();
        }
        if (targetLink) {
            targetLink.classList.add('active');
        }
        
        if (page === 'profile') {
            this.loadProfile();
            this.initProfileTabs();
        }

        if (page === 'admin') {
            this.loadAdminPanel();
        }
        
        this.currentPage = page;
        window.scrollTo(0, 0);
    },

    async loadAdminPanel() {
        const adminPanel = document.getElementById('adminPanel');
        if (!adminPanel) return;

        const allWorks = await dbClient
            .from('works')
            .select('*')
            .eq('visibility', 'public')
            .order('created_at', { ascending: false });

        const activities = await dbClient
            .from('activities')
            .select('*')
            .order('created_at', { ascending: false });

        const activitiesHtml = (activities.data || []).map(act => `
            <div class="admin-activity-item">
                <img src="${act.image || ''}" alt="${act.title}" style="width:80px;height:60px;object-fit:cover;border-radius:4px;">
                <div style="flex:1;margin-left:10px;">
                    <strong>${act.title}</strong>
                    <p style="margin:5px 0 0;font-size:12px;color:#666;">${this.formatDate(act.date)}</p>
                </div>
                <button class="btn btn-sm btn-danger" onclick="App.deleteActivity(${act.id})">删除</button>
            </div>
        `).join('') || '<p>暂无活动</p>';

        const worksHtml = (allWorks.data || []).map(work => `
            <div class="admin-work-item">
                <div style="flex:1;">
                    <strong>${work.title}</strong>
                    <p style="margin:5px 0 0;font-size:12px;color:#666;">作者：${work.author}</p>
                </div>
                <button class="btn btn-sm" onclick="App.adminToggleVisibility(${work.id})">设为私密</button>
            </div>
        `).join('') || '<p>暂无公开作品</p>';

        adminPanel.innerHTML = `
            <div class="admin-section">
                <h3 class="section-subtitle">管理社团活动</h3>
                <form id="activityForm" class="admin-form" style="margin-bottom:20px;">
                    <div class="form-group">
                        <input type="text" name="activityTitle" class="form-input" placeholder="活动标题" required>
                    </div>
                    <div class="form-group">
                        <input type="text" name="activityDate" class="form-input" placeholder="活动时间，如：2024年1月1日" required>
                    </div>
                    <div class="form-group">
                        <input type="url" name="activityImage" class="form-input" placeholder="图片链接（可选）">
                    </div>
                    <div class="form-group">
                        <textarea name="activityDesc" class="form-textarea" placeholder="活动描述（可选）"></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary btn-sm">添加活动</button>
                </form>
                <div class="admin-list">${activitiesHtml}</div>
            </div>
            <div class="admin-section">
                <h3 class="section-subtitle">管理公开作品（设为私密）</h3>
                <div class="admin-list">${worksHtml}</div>
            </div>
        `;

        document.getElementById('activityForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddActivity(document.getElementById('activityForm'));
        });

        this.initScrollAnimations();
    },

    async handleAddActivity(form) {
        const formData = new FormData(form);
        const activity = {
            title: formData.get('activityTitle'),
            date: formData.get('activityDate'),
            image: formData.get('activityImage'),
            description: formData.get('activityDesc')
        };

        const { error } = await dbClient.from('activities').insert([activity]);
        
        if (error) {
            this.showToast('添加失败：' + error.message, 'error');
            return;
        }

        form.reset();
        this.showToast('活动添加成功！', 'success');
        this.loadAdminPanel();
    },

    async deleteActivity(activityId) {
        if (!confirm('确定要删除这个活动吗？')) return;

        const { error } = await dbClient.from('activities').delete().eq('id', activityId);
        
        if (error) {
            this.showToast('删除失败', 'error');
            return;
        }

        this.showToast('活动已删除', 'success');
        this.loadAdminPanel();
    },

    async adminToggleVisibility(workId) {
        const { error } = await dbClient
            .from('works')
            .update({ visibility: 'private' })
            .eq('id', workId);

        if (error) {
            this.showToast('操作失败', 'error');
            return;
        }

        this.showToast('已将作品设为私密', 'success');
        this.loadAdminPanel();
    },

    initWorkTypeSelector() {
        const options = document.querySelectorAll('.work-type-option');
        const shortStoryGroup = document.getElementById('shortStoryGroup');
        const chaptersContainer = document.getElementById('chaptersContainer');
        const hiddenInput = document.querySelector('input[name="workType"]');
        
        options.forEach(option => {
            option.addEventListener('click', () => {
                options.forEach(o => o.classList.remove('active'));
                option.classList.add('active');
                
                const type = option.dataset.type;
                this.workType = type;
                if (hiddenInput) hiddenInput.value = type;
                
                if (type === 'short') {
                    if (shortStoryGroup) shortStoryGroup.style.display = 'block';
                    if (chaptersContainer) chaptersContainer.classList.remove('show');
                } else {
                    if (shortStoryGroup) shortStoryGroup.style.display = 'none';
                    if (chaptersContainer) chaptersContainer.classList.add('show');
                }
                
                this.updateAllWordCounts();
            });
        });
    },

    initWordCount() {
        const shortContent = document.getElementById('shortContent');
        if (shortContent) {
            shortContent.addEventListener('input', () => this.updateShortWordCount());
        }
        
        this.updateChapterWordCount();
    },

    updateShortWordCount() {
        const shortContent = document.getElementById('shortContent');
        const wordCountEl = document.getElementById('shortWordCount');
        if (shortContent && wordCountEl) {
            const count = this.countWords(shortContent.value);
            wordCountEl.textContent = `字数：${count} 字`;
        }
    },

    updateChapterWordCount() {
        const chaptersList = document.getElementById('chaptersList');
        const wordCountEl = document.getElementById('chapterWordCount');
        if (!chaptersList || !wordCountEl) return;
        
        let totalCount = 0;
        chaptersList.querySelectorAll('.chapter-content-input').forEach(textarea => {
            totalCount += this.countWords(textarea.value);
        });
        wordCountEl.textContent = `总字数：${totalCount} 字`;
    },

    updateAllWordCounts() {
        this.updateShortWordCount();
        this.updateChapterWordCount();
    },

    countWords(text) {
        return text.replace(/\s/g, '').length;
    },

    addChapter() {
        this.chapterCount++;
        const chaptersList = document.getElementById('chaptersList');
        if (!chaptersList) return;
        
        const chapterNum = this.chapterCount;
        
        const chapterItem = document.createElement('div');
        chapterItem.className = 'chapter-item';
        chapterItem.dataset.chapter = chapterNum;
        chapterItem.innerHTML = `
            <div class="chapter-header">
                <input type="text" class="chapter-title-input" name="chapterTitle_${chapterNum}" placeholder="章节标题（如：第${chapterNum}章）">
                <button type="button" class="remove-chapter-btn" onclick="App.removeChapter(${chapterNum})">删除</button>
            </div>
            <textarea name="chapterContent_${chapterNum}" class="form-textarea chapter-content-input" placeholder="请输入章节内容"></textarea>
        `;
        
        chaptersList.appendChild(chapterItem);
        
        const newTextarea = chapterItem.querySelector('.chapter-content-input');
        if (newTextarea) {
            newTextarea.addEventListener('input', () => this.updateChapterWordCount());
        }
    },

    removeChapter(chapterNum) {
        const chaptersList = document.getElementById('chaptersList');
        if (!chaptersList) return;
        
        const chapters = chaptersList.querySelectorAll('.chapter-item');
        
        if (chapters.length <= 1) {
            this.showToast('至少需要保留一个章节', 'error');
            return;
        }
        
        const chapterItem = document.querySelector(`.chapter-item[data-chapter="${chapterNum}"]`);
        if (chapterItem) {
            chapterItem.remove();
            this.updateChapterWordCount();
        }
    },

    initForms() {
        const submitForm = document.getElementById('submitForm');
        const recommendForm = document.getElementById('recommendForm');

        if (submitForm) {
            submitForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (this.editingWorkId) {
                    this.handleUpdate(submitForm);
                } else {
                    this.handleSubmit(submitForm);
                }
            });
        }

        if (recommendForm) {
            recommendForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRecommend(recommendForm);
            });
        }
    },

    async handleSubmit(form) {
        if (!this.currentUser) {
            this.showToast('请先登录后再投稿', 'error');
            document.getElementById('loginModal').classList.add('show');
            return;
        }
        
        const formData = new FormData(form);
        const workType = formData.get('workType');
        const visibility = formData.get('visibility') || 'public';
        
        const work = {
            title: formData.get('title'),
            author: formData.get('author'),
            author_id: this.currentUser.id,
            summary: formData.get('summary'),
            work_type: workType,
            visibility: visibility,
            word_count: 0
        };

        if (workType === 'short') {
            const content = formData.get('content');
            if (!content || content.trim() === '') {
                this.showToast('请输入作品正文', 'error');
                return;
            }
            work.content = content;
            work.word_count = this.countWords(content);
        } else {
            work.chapters = [];
            const chaptersList = document.getElementById('chaptersList');
            if (!chaptersList) return;
            
            const chapterItems = chaptersList.querySelectorAll('.chapter-item');
            
            chapterItems.forEach((item, index) => {
                const chapterNum = item.dataset.chapter;
                const title = formData.get(`chapterTitle_${chapterNum}`);
                const content = formData.get(`chapterContent_${chapterNum}`);
                
                if (title || content) {
                    work.chapters.push({
                        id: index + 1,
                        title: title || `第${index + 1}章`,
                        content: content
                    });
                }
            });
            
            if (work.chapters.length === 0) {
                this.showToast('请至少添加一个章节', 'error');
                return;
            }
            
            work.word_count = work.chapters.reduce((total, ch) => {
                return total + this.countWords(ch.content || '');
            }, 0);
        }

        try {
            const { data, error } = await dbClient
                .from('works')
                .insert([work])
                .select();
            
            if (error) {
                console.error('Submit error:', error);
                this.showToast('投稿失败：' + error.message, 'error');
                return;
            }

            form.reset();
            this.resetSubmitForm();
            this.showToast('投稿成功！作品已添加', 'success');
            this.loadWorks();
            this.loadProfile();
            this.navigateTo('profile');
        } catch (err) {
            console.error('Submit failed:', err);
            this.showToast('投稿失败，请检查网络连接', 'error');
        }
    },

    async handleUpdate(form) {
        if (!this.currentUser || !this.editingWorkId) {
            this.showToast('更新失败', 'error');
            return;
        }
        
        const formData = new FormData(form);
        const workType = formData.get('workType');
        const visibility = formData.get('visibility') || 'public';
        
        const work = {
            title: formData.get('title'),
            author: formData.get('author'),
            summary: formData.get('summary'),
            work_type: workType,
            visibility: visibility,
            word_count: 0
        };

        if (workType === 'short') {
            const content = formData.get('content');
            if (!content || content.trim() === '') {
                this.showToast('请输入作品正文', 'error');
                return;
            }
            work.content = content;
            work.word_count = this.countWords(content);
            work.chapters = null;
        } else {
            work.chapters = [];
            const chaptersList = document.getElementById('chaptersList');
            if (!chaptersList) return;
            
            const chapterItems = chaptersList.querySelectorAll('.chapter-item');
            
            chapterItems.forEach((item, index) => {
                const chapterNum = item.dataset.chapter;
                const title = formData.get(`chapterTitle_${chapterNum}`);
                const content = formData.get(`chapterContent_${chapterNum}`);
                
                if (title || content) {
                    work.chapters.push({
                        id: index + 1,
                        title: title || `第${index + 1}章`,
                        content: content
                    });
                }
            });
            
            if (work.chapters.length === 0) {
                this.showToast('请至少添加一个章节', 'error');
                return;
            }
            
            work.word_count = work.chapters.reduce((total, ch) => {
                return total + this.countWords(ch.content || '');
            }, 0);
            work.content = null;
        }

        try {
            const { error } = await dbClient
                .from('works')
                .update(work)
                .eq('id', this.editingWorkId);
            
            if (error) {
                console.error('Update error:', error);
                this.showToast('更新失败：' + error.message, 'error');
                return;
            }

            form.reset();
            this.resetSubmitForm();
            this.editingWorkId = null;
            
            const submitBtn = document.querySelector('#submitForm button[type="submit"]');
            if (submitBtn) submitBtn.textContent = '提交投稿';
            
            this.showToast('作品已更新！', 'success');
            this.loadWorks();
            this.loadProfile();
            this.navigateTo('profile');
        } catch (err) {
            console.error('Update failed:', err);
            this.showToast('更新失败，请检查网络连接', 'error');
        }
    },

    async editWork(workId) {
        try {
            const { data: work, error } = await dbClient
                .from('works')
                .select('*')
                .eq('id', workId)
                .single();
            
            if (error || !work) {
                this.showToast('作品不存在', 'error');
                return;
            }
            
            if (!this.isOwner(work)) {
                this.showToast('您没有权限编辑此作品', 'error');
                return;
            }
            
            this.editingWorkId = workId;
            
            document.querySelector('input[name="title"]').value = work.title || '';
            document.querySelector('input[name="author"]').value = work.author || '';
            document.querySelector('input[name="summary"]').value = work.summary || '';
            
            const visibilityInputs = document.querySelectorAll('input[name="visibility"]');
            visibilityInputs.forEach(input => {
                input.checked = input.value === work.visibility;
            });
            
            if (work.work_type === 'chaptered') {
                this.workType = 'chaptered';
                const options = document.querySelectorAll('.work-type-option');
                options.forEach(o => o.classList.remove('active'));
                options[1].classList.add('active');
                document.querySelector('input[name="workType"]').value = 'chaptered';
                document.getElementById('shortStoryGroup').style.display = 'none';
                document.getElementById('chaptersContainer').classList.add('show');
                
                const chaptersList = document.getElementById('chaptersList');
                chaptersList.innerHTML = '';
                this.chapterCount = 0;
                
                if (work.chapters && work.chapters.length > 0) {
                    work.chapters.forEach((ch, idx) => {
                        this.chapterCount++;
                        const chapterItem = document.createElement('div');
                        chapterItem.className = 'chapter-item';
                        chapterItem.dataset.chapter = this.chapterCount;
                        chapterItem.innerHTML = `
                            <div class="chapter-header">
                                <input type="text" class="chapter-title-input" name="chapterTitle_${this.chapterCount}" value="${ch.title || ''}" placeholder="章节标题">
                                <button type="button" class="remove-chapter-btn" onclick="App.removeChapter(${this.chapterCount})">删除</button>
                            </div>
                            <textarea name="chapterContent_${this.chapterCount}" class="form-textarea chapter-content-input" placeholder="请输入章节内容">${ch.content || ''}</textarea>
                        `;
                        chaptersList.appendChild(chapterItem);
                        
                        const textarea = chapterItem.querySelector('.chapter-content-input');
                        if (textarea) {
                            textarea.addEventListener('input', () => this.updateChapterWordCount());
                        }
                    });
                }
                this.updateChapterWordCount();
            } else {
                this.workType = 'short';
                const options = document.querySelectorAll('.work-type-option');
                options.forEach(o => o.classList.remove('active'));
                options[0].classList.add('active');
                document.querySelector('input[name="workType"]').value = 'short';
                document.getElementById('shortStoryGroup').style.display = 'block';
                document.getElementById('chaptersContainer').classList.remove('show');
                
                document.getElementById('shortContent').value = work.content || '';
                this.updateShortWordCount();
            }
            
            const submitBtn = document.querySelector('#submitForm button[type="submit"]');
            if (submitBtn) submitBtn.textContent = '保存修改';
            
            this.navigateTo('submit');
        } catch (err) {
            console.error('Edit work failed:', err);
            this.showToast('加载作品失败', 'error');
        }
    },

    cancelEdit() {
        this.editingWorkId = null;
        this.resetSubmitForm();
        
        const submitBtn = document.querySelector('#submitForm button[type="submit"]');
        if (submitBtn) submitBtn.textContent = '提交投稿';
        
        this.navigateTo('profile');
    },

    resetSubmitForm() {
        this.workType = 'short';
        this.chapterCount = 1;
        this.editingWorkId = null;
        
        const options = document.querySelectorAll('.work-type-option');
        options.forEach(o => o.classList.remove('active'));
        if (options[0]) options[0].classList.add('active');
        
        const hiddenInput = document.querySelector('input[name="workType"]');
        if (hiddenInput) hiddenInput.value = 'short';
        
        const shortStoryGroup = document.getElementById('shortStoryGroup');
        const chaptersContainer = document.getElementById('chaptersContainer');
        if (shortStoryGroup) shortStoryGroup.style.display = 'block';
        if (chaptersContainer) chaptersContainer.classList.remove('show');
        
        const chaptersList = document.getElementById('chaptersList');
        if (chaptersList) {
            chaptersList.innerHTML = `
                <div class="chapter-item" data-chapter="1">
                    <div class="chapter-header">
                        <input type="text" class="chapter-title-input" name="chapterTitle_1" placeholder="章节标题（如：第一章 启程）">
                        <button type="button" class="remove-chapter-btn" onclick="App.removeChapter(1)">删除</button>
                    </div>
                    <textarea name="chapterContent_1" class="form-textarea chapter-content-input" placeholder="请输入章节内容"></textarea>
                </div>
            `;
        }
        
        const visibilityOptions = document.querySelectorAll('input[name="visibility"]');
        visibilityOptions.forEach(opt => opt.checked = opt.value === 'public');
        
        this.updateAllWordCounts();
        
        if (chaptersList) {
            const newTextarea = chaptersList.querySelector('.chapter-content-input');
            if (newTextarea) {
                newTextarea.addEventListener('input', () => this.updateChapterWordCount());
            }
        }
        
        const submitBtn = document.querySelector('#submitForm button[type="submit"]');
        if (submitBtn) submitBtn.textContent = '提交投稿';
    },

    async handleRecommend(form) {
        const formData = new FormData(form);
        const recommendation = {
            book_name: formData.get('bookName'),
            book_type: formData.get('bookType'),
            rating: parseInt(formData.get('rating')),
            recommender: formData.get('recommender'),
            reason: formData.get('reason')
        };

        if (!this.currentUser) {
            this.showToast('请先登录', 'error');
            document.getElementById('loginModal').classList.add('show');
            return;
        }

        recommendation.user_id = this.currentUser.id;

        try {
            const { data, error } = await dbClient
                .from('recommendations')
                .insert([recommendation])
                .select();
            
            if (error) {
                console.error('Recommend error:', error);
                this.showToast('推荐失败：' + error.message, 'error');
                return;
            }

            form.reset();
            this.currentRating = 5;
            this.updateRatingDisplay(5);
            this.showToast('推荐发布成功！', 'success');
            this.loadRecommendations();
        } catch (err) {
            console.error('Recommend failed:', err);
            this.showToast('推荐失败，请检查网络连接', 'error');
        }
    },

    initRating() {
        const ratingInput = document.getElementById('ratingInput');
        if (!ratingInput) return;
        
        const stars = ratingInput.querySelectorAll('.star');

        stars.forEach(star => {
            star.addEventListener('click', () => {
                const rating = parseInt(star.dataset.rating);
                this.currentRating = rating;
                const hiddenInput = ratingInput.querySelector('input[name="rating"]');
                if (hiddenInput) hiddenInput.value = rating;
                this.updateRatingDisplay(rating);
            });

            star.addEventListener('mouseenter', () => {
                const rating = parseInt(star.dataset.rating);
                this.updateRatingDisplay(rating);
            });
        });

        ratingInput.addEventListener('mouseleave', () => {
            this.updateRatingDisplay(this.currentRating);
        });
    },

    updateRatingDisplay(rating) {
        const stars = document.querySelectorAll('#ratingInput .star');
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
    },

    initModal() {
        const modal = document.getElementById('imageModal');
        if (!modal) return;
        
        const closeBtn = modal.querySelector('.modal-close');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('show');
            });
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                modal.classList.remove('show');
                const loginModal = document.getElementById('loginModal');
                if (loginModal) loginModal.classList.remove('show');
            }
        });
    },

    showImageModal(src) {
        const modal = document.getElementById('imageModal');
        const modalImg = document.getElementById('modalImage');
        if (modal && modalImg) {
            modalImg.src = src;
            modal.classList.add('show');
        }
    },

    initScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        entry.target.classList.add('animated');
                    }, index * 50);
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        document.querySelectorAll('.animate-on-scroll').forEach(el => {
            el.classList.remove('animated');
            observer.observe(el);
        });

        this.addAnimationClasses();
    },

    addAnimationClasses() {
        const heroTitle = document.querySelector('.hero-title');
        const heroSubtitle = document.querySelector('.hero-subtitle');
        const heroDivider = document.querySelector('.hero-divider');
        const heroDescription = document.querySelector('.hero-description');
        const heroButtons = document.querySelector('.hero-buttons');
        const sectionHeader = document.querySelector('.section-header');
        const featureCards = document.querySelectorAll('.feature-card');

        if (heroTitle && !heroTitle.classList.contains('animate-on-scroll')) {
            heroTitle.classList.add('animate-on-scroll', 'stagger-1');
        }
        if (heroSubtitle && !heroSubtitle.classList.contains('animate-on-scroll')) {
            heroSubtitle.classList.add('animate-on-scroll', 'stagger-2');
        }
        if (heroDivider && !heroDivider.classList.contains('animate-on-scroll')) {
            heroDivider.classList.add('animate-on-scroll', 'stagger-3');
        }
        if (heroDescription && !heroDescription.classList.contains('animate-on-scroll')) {
            heroDescription.classList.add('animate-on-scroll', 'stagger-4');
        }
        if (heroButtons && !heroButtons.classList.contains('animate-on-scroll')) {
            heroButtons.classList.add('animate-on-scroll', 'stagger-5');
        }
        if (sectionHeader && !sectionHeader.classList.contains('animate-on-scroll')) {
            sectionHeader.classList.add('animate-on-scroll');
        }

        featureCards.forEach((card, index) => {
            if (!card.classList.contains('animate-on-scroll')) {
                card.classList.add('animate-on-scroll', `stagger-${index + 1}`);
                card.setAttribute('data-animation', 'fade-scale');
            }
        });

        const pageHeader = document.querySelector('.page.active .page-header');
        if (pageHeader && !pageHeader.classList.contains('animate-on-scroll')) {
            pageHeader.classList.add('animate-on-scroll');
        }
    },

    async loadActivities() {
        const grid = document.getElementById('activitiesGrid');
        if (!grid) return;
        
        try {
            const { data: activities, error } = await dbClient
                .from('activities')
                .select('*')
                .order('created_at', { ascending: false });

            if (error || !activities || activities.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📷</div>
                        <p class="empty-state-text">暂无活动记录</p>
                    </div>
                `;
                return;
            }

            grid.innerHTML = activities.map((activity, index) => `
                <div class="activity-card animate-on-scroll stagger-${(index % 6) + 1}">
                    <img src="${activity.image || ''}" alt="${activity.title}" class="activity-image" 
                         onclick="App.showImageModal('${activity.image || ''}')">
                    <div class="activity-content">
                        <h3 class="activity-title">${activity.title}</h3>
                        <p class="activity-date">${this.formatDate(activity.date)}</p>
                        <p class="activity-desc">${activity.description || ''}</p>
                    </div>
                </div>
            `).join('');

            this.initScrollAnimations();
        } catch (err) {
            console.error('Load activities failed:', err);
            grid.innerHTML = `<div class="empty-state"><p class="empty-state-text">加载失败</p></div>`;
        }
    },

    async loadWorks() {
        const grid = document.getElementById('worksGrid');
        if (!grid) return;
        
        try {
            const { data: works, error } = await dbClient
                .from('works')
                .select('*')
                .eq('visibility', 'public')
                .order('created_at', { ascending: false });

            if (error || !works || works.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📝</div>
                        <p class="empty-state-text">暂无社员作品，快来投稿吧！</p>
                    </div>
                `;
                return;
            }

            grid.innerHTML = works.map((work, index) => {
                const typeLabel = work.work_type === 'chaptered' ? '连载' : '短篇';
                const typeClass = work.work_type === 'chaptered' ? 'chaptered' : 'short';
                const wordCount = work.word_count || 0;
                const metaInfo = work.work_type === 'chaptered' && work.chapters 
                    ? `<span class="work-meta-item">📖 ${work.chapters.length} 章</span>` 
                    : '';
                
                return `
                    <div class="work-card animate-on-scroll stagger-${(index % 6) + 1}" 
                         onclick="App.showWorkDetail(${work.id})">
                        <span class="work-type-badge ${typeClass}">${typeLabel}</span>
                        <h3 class="work-title">${work.title}</h3>
                        <p class="work-author">作者：${work.author}</p>
                        <p class="work-summary">${work.summary || ''}</p>
                        <div class="work-meta">
                            <span class="work-meta-item">📅 ${this.formatDate(work.created_at)}</span>
                            <span class="work-meta-item">📝 ${wordCount} 字</span>
                            ${metaInfo}
                        </div>
                    </div>
                `;
            }).join('');

            this.initScrollAnimations();
        } catch (err) {
            console.error('Load works failed:', err);
            grid.innerHTML = `<div class="empty-state"><p class="empty-state-text">加载失败</p></div>`;
        }
    },

    async showWorkDetail(workId) {
        try {
            const { data: work, error } = await dbClient
                .from('works')
                .select('*')
                .eq('id', workId)
                .single();
            
            if (error || !work) {
                this.showToast('作品不存在', 'error');
                return;
            }
            
            const isOwner = this.isOwner(work);
            
            if (work.visibility === 'private' && !isOwner && !this.isAdmin) {
                this.showToast('该作品为私密作品', 'error');
                return;
            }

            const detail = document.getElementById('workDetail');
            if (!detail) return;
            
            const typeLabel = work.work_type === 'chaptered' ? '连载作品' : '短篇小说';
            const typeClass = work.work_type === 'chaptered' ? 'chaptered' : 'short';
            const wordCount = work.word_count || 0;
            const visibilityLabel = work.visibility === 'private' ? '🔒 私密' : '🌐 公开';
            const visibilityClass = work.visibility === 'private' ? 'private' : 'public';
            
            let contentHtml = '';
            
            if (work.work_type === 'chaptered' && work.chapters && work.chapters.length > 0) {
                const chapterNav = work.chapters.map((ch, idx) => 
                    `<button class="chapter-btn ${idx === 0 ? 'active' : ''}" data-chapter="${idx}">${ch.title}</button>`
                ).join('');
                
                const chapterContents = work.chapters.map((ch, idx) => `
                    <div class="chapter-content" data-chapter="${idx}" style="display: ${idx === 0 ? 'block' : 'none'}">
                        <h3 class="chapter-detail-title">${ch.title}</h3>
                        <div class="work-detail-content">${ch.content || ''}</div>
                        <div class="chapter-nav-buttons">
                            <button class="chapter-nav-btn prev-btn" data-action="prev" ${idx === 0 ? 'disabled' : ''}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                                    <path d="M15 19l-7-7 7-7"/>
                                </svg>
                                上一章
                            </button>
                            <span class="chapter-indicator">第 ${idx + 1} / ${work.chapters.length} 章</span>
                            <button class="chapter-nav-btn next-btn" data-action="next" ${idx === work.chapters.length - 1 ? 'disabled' : ''}>
                                下一章
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                                    <path d="M9 5l7 7-7 7"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                `).join('');
                
                contentHtml = `
                    <div class="chapter-nav" id="chapterNav">
                        ${chapterNav}
                    </div>
                    <div id="chapterContents" data-total="${work.chapters.length}">
                        ${chapterContents}
                    </div>
                `;
            } else {
                contentHtml = `<div class="work-detail-content">${work.content || ''}</div>`;
            }

            const actionsHtml = isOwner ? `
                <div class="work-actions">
                    <button class="work-action-btn edit" onclick="App.editWork(${work.id})">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        编辑作品
                    </button>
                    <button class="work-action-btn toggle-visibility" onclick="App.toggleWorkVisibility(${work.id})">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            ${work.visibility === 'private' 
                                ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/>'
                                : '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 017 12c0 1.07.19 2.1.54 3.05m6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
                            }
                        </svg>
                        ${work.visibility === 'private' ? '设为公开' : '设为私密'}
                    </button>
                    <button class="work-action-btn delete" onclick="App.deleteWork(${work.id})">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"/><path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"/>
                        </svg>
                        删除作品
                    </button>
                </div>
            ` : '';

            detail.innerHTML = `
                <div class="work-detail-header">
                    <span class="work-detail-type ${typeClass}">${typeLabel}</span>
                    <span class="work-visibility-badge ${visibilityClass}">${visibilityLabel}</span>
                    <h1 class="work-detail-title">${work.title}</h1>
                    <div class="work-detail-meta">
                        <span>作者：${work.author}</span>
                        <span>投稿时间：${this.formatDate(work.created_at)}</span>
                        <span>字数：${wordCount} 字</span>
                    </div>
                </div>
                ${contentHtml}
                ${actionsHtml}
            `;

            if (work.work_type === 'chaptered' && work.chapters) {
                this.initChapterNavigation();
            }

            this.navigateTo('work-detail');
        } catch (err) {
            console.error('Show work detail failed:', err);
            this.showToast('加载作品失败', 'error');
        }
    },

    async deleteWork(workId) {
        if (!confirm('确定要删除这篇作品吗？删除后无法恢复。')) {
            return;
        }
        
        try {
            const { error } = await dbClient
                .from('works')
                .delete()
                .eq('id', workId);
            
            if (error) {
                this.showToast('删除失败', 'error');
                return;
            }
            
            this.showToast('作品已删除', 'success');
            this.loadWorks();
            this.loadProfile();
            this.navigateTo('works');
        } catch (err) {
            console.error('Delete work failed:', err);
            this.showToast('删除失败', 'error');
        }
    },

    async toggleWorkVisibility(workId) {
        try {
            const { data: work, error: fetchError } = await dbClient
                .from('works')
                .select('visibility')
                .eq('id', workId)
                .single();
            
            if (fetchError || !work) {
                this.showToast('获取作品失败', 'error');
                return;
            }
            
            const newVisibility = work.visibility === 'private' ? 'public' : 'private';
            
            const { error: updateError } = await dbClient
                .from('works')
                .update({ visibility: newVisibility })
                .eq('id', workId);
            
            if (updateError) {
                this.showToast('更新失败', 'error');
                return;
            }
            
            const actionText = newVisibility === 'private' ? '作品已设为私密' : '作品已设为公开';
            this.showToast(actionText, 'success');
            
            this.showWorkDetail(workId);
            this.loadWorks();
            this.loadProfile();
        } catch (err) {
            console.error('Toggle visibility failed:', err);
            this.showToast('操作失败', 'error');
        }
    },

    initChapterNavigation() {
        const chapterNav = document.getElementById('chapterNav');
        if (!chapterNav) return;
        
        const buttons = chapterNav.querySelectorAll('.chapter-btn');
        const contents = document.querySelectorAll('.chapter-content');
        
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const chapterIdx = btn.dataset.chapter;
                this.switchToChapter(chapterIdx, buttons, contents);
            });
        });
        
        contents.forEach(content => {
            const prevBtn = content.querySelector('.prev-btn');
            const nextBtn = content.querySelector('.next-btn');
            
            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    const currentIdx = parseInt(content.dataset.chapter);
                    if (currentIdx > 0) {
                        this.switchToChapter(currentIdx - 1, buttons, contents);
                    }
                });
            }
            
            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    const currentIdx = parseInt(content.dataset.chapter);
                    const totalEl = document.getElementById('chapterContents');
                    if (totalEl) {
                        const total = parseInt(totalEl.dataset.total);
                        if (currentIdx < total - 1) {
                            this.switchToChapter(currentIdx + 1, buttons, contents);
                        }
                    }
                });
            }
        });
    },

    switchToChapter(chapterIdx, buttons, contents) {
        buttons.forEach(b => b.classList.remove('active'));
        buttons.forEach(b => {
            if (b.dataset.chapter === String(chapterIdx)) {
                b.classList.add('active');
            }
        });
        
        contents.forEach(c => {
            if (c.dataset.chapter === String(chapterIdx)) {
                c.style.display = 'block';
            } else {
                c.style.display = 'none';
            }
        });
        
        const detailContent = document.querySelector('.work-detail');
        if (detailContent) {
            detailContent.scrollTop = 0;
        }
    },

    async loadRecommendations() {
        const grid = document.getElementById('recommendGrid');
        if (!grid) return;
        
        try {
            const { data: recommendations, error } = await dbClient
                .from('recommendations')
                .select('*')
                .order('created_at', { ascending: false });

            if (error || !recommendations || recommendations.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📚</div>
                        <p class="empty-state-text">暂无推荐，快来推荐一本好书吧！</p>
                    </div>
                `;
                return;
            }

            grid.innerHTML = recommendations.map((rec, index) => {
                const canDelete = this.currentUser && (rec.user_id === this.currentUser.id || this.isAdmin);
                return `
                    <div class="recommend-card animate-on-scroll stagger-${(index % 6) + 1}">
                        <div class="recommend-header">
                            <h3 class="recommend-book-name">${rec.book_name}</h3>
                            <div class="recommend-rating">${'★'.repeat(rec.rating)}${'☆'.repeat(5 - rec.rating)}</div>
                        </div>
                        <div class="recommend-meta">
                            <span class="recommend-type">${rec.book_type || ''}</span>
                            <span class="recommend-author">推荐人：${rec.recommender}</span>
                        </div>
                        ${rec.reason ? `<p class="recommend-reason">${rec.reason}</p>` : ''}
                        <p class="recommend-time">${this.formatDate(rec.created_at)}</p>
                        ${canDelete ? `<button class="btn btn-sm btn-danger" style="margin-top:10px;" onclick="App.deleteRecommendation(${rec.id})">删除</button>` : ''}
                    </div>
                `;
            }).join('');

            this.initScrollAnimations();
        } catch (err) {
            console.error('Load recommendations failed:', err);
            grid.innerHTML = `<div class="empty-state"><p class="empty-state-text">加载失败</p></div>`;
        }
    },

    async deleteRecommendation(recId) {
        if (!confirm('确定要删除这条推荐吗？')) return;

        const { error } = await dbClient
            .from('recommendations')
            .delete()
            .eq('id', recId);

        if (error) {
            this.showToast('删除失败', 'error');
            return;
        }

        this.showToast('推荐已删除', 'success');
        this.loadRecommendations();
    },

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}年${month}月${day}日`;
    },

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
