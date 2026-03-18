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

            await this.loadTodayWordStats();
            
            this.loadMyWorks();
        } catch (err) {
            console.error('Load profile failed:', err);
        }
    },

    async loadTodayWordStats() {
        const today = new Date().toISOString().split('T')[0];

        try {
            const { data: allRecords } = await dbClient
                .from('word_records')
                .select('added_words, is_activity')
                .eq('user_id', this.currentUser.id)
                .eq('date', today);

            const records = allRecords || [];
            const totalToday = records.reduce((sum, r) => sum + (r.added_words || 0), 0);
            const activityToday = records.filter(r => r.is_activity).reduce((sum, r) => sum + (r.added_words || 0), 0);

            let statsHtml = `
                <div class="today-stats">
                    <div class="today-stat-item">
                        <span class="today-stat-label">今日总字数</span>
                        <span class="today-stat-value">${totalToday}</span>
                    </div>
                    <div class="today-stat-item">
                        <span class="today-stat-label">打卡字数</span>
                        <span class="today-stat-value activity">${activityToday}</span>
                    </div>
                </div>
            `;

            let statsContainer = document.getElementById('todayWordStats');
            if (!statsContainer) {
                const profileCard = document.querySelector('.profile-card');
                if (profileCard) {
                    const statsDiv = document.createElement('div');
                    statsDiv.id = 'todayWordStats';
                    statsDiv.innerHTML = statsHtml;
                    profileCard.appendChild(statsDiv);
                }
            } else {
                statsContainer.innerHTML = statsHtml;
            }
        } catch (err) {
            console.error('Load today stats failed:', err);
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
                const activityLabel = work.is_activity ? (work.activity_track === 'ai' ? '🤖 AI' : '✍️ 打卡') : '';
                
                return `
                    <div class="work-card animate-on-scroll stagger-${(index % 6) + 1}" 
                         onclick="App.showWorkDetail(${work.id})">
                        <span class="work-type-badge ${typeClass}">${typeLabel}</span>
                        <span class="work-visibility-badge ${visibilityClass}">${visibilityLabel}</span>
                        ${activityLabel ? `<span class="work-activity-badge">${activityLabel}</span>` : ''}
                        <h3 class="work-title">${work.title}</h3>
                        <p class="work-summary">${work.summary || ''}</p>
                        <div class="work-meta">
                            <span class="work-meta-item">📅 ${this.formatDate(work.created_at)}</span>
                            <span class="work-meta-item">📝 ${wordCount} 字</span>
                        </div>
                        <div class="work-actions" onclick="event.stopPropagation();">
                            <button class="btn btn-sm" onclick="App.showWorkActivitySettings(${work.id})">参赛设置</button>
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
            this.loadCheckinCalendar();
            this.initCalendarNavigation();
        }

        if (page === 'admin') {
            this.loadAdminPanel();
        }

        if (page === 'writing-activity') {
            this.loadActivityPage();
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
                ${act.image ? `<img src="${act.image}" alt="${act.title}" style="width:80px;height:60px;object-fit:cover;border-radius:4px;">` : ''}
                <div style="flex:1;margin-left:10px;">
                    <strong>${act.title}</strong>
                    <p style="margin:5px 0 0;font-size:12px;color:#666;">${act.date_text || act.date || ''}</p>
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
                        <label class="form-label"><span class="label-text">活动图片</span></label>
                        <div class="image-upload-area" id="imageUploadArea">
                            <div class="image-upload-placeholder" id="imagePlaceholder">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32">
                                    <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                </svg>
                                <p>点击上传或拖放图片到此处</p>
                                <span>支持 JPG、PNG、GIF 格式</span>
                            </div>
                            <img id="imagePreview" style="display:none;max-width:100%;max-height:200px;border-radius:8px;">
                        </div>
                        <input type="file" id="imageInput" accept="image/*" style="display:none;">
                        <input type="hidden" name="activityImage" id="activityImageInput">
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

        this.initImageUpload();

        document.getElementById('activityForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddActivity(document.getElementById('activityForm'));
        });

        this.initScrollAnimations();
    },

    initImageUpload() {
        const uploadArea = document.getElementById('imageUploadArea');
        const imageInput = document.getElementById('imageInput');
        const imagePreview = document.getElementById('imagePreview');
        const imagePlaceholder = document.getElementById('imagePlaceholder');
        const activityImageInput = document.getElementById('activityImageInput');

        if (!uploadArea || !imageInput) return;

        uploadArea.addEventListener('click', () => {
            imageInput.click();
        });

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleImageFile(files[0]);
            }
        });

        imageInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleImageFile(e.target.files[0]);
            }
        });
    },

    handleImageFile(file) {
        const imagePreview = document.getElementById('imagePreview');
        const imagePlaceholder = document.getElementById('imagePlaceholder');
        const activityImageInput = document.getElementById('activityImageInput');

        if (!file.type.startsWith('image/')) {
            this.showToast('请选择图片文件', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            this.showToast('图片大小不能超过5MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            if (imagePreview) {
                imagePreview.src = base64;
                imagePreview.style.display = 'block';
            }
            if (imagePlaceholder) {
                imagePlaceholder.style.display = 'none';
            }
            if (activityImageInput) {
                activityImageInput.value = base64;
            }
        };
        reader.readAsDataURL(file);
    },

    async handleAddActivity(form) {
        const formData = new FormData(form);
        const activity = {
            title: formData.get('activityTitle'),
            date_text: formData.get('activityDate'),
            image: formData.get('activityImage') || null,
            description: formData.get('activityDesc')
        };

        const { error } = await dbClient.from('activities').insert([activity]);
        
        if (error) {
            this.showToast('添加失败：' + error.message, 'error');
            return;
        }

        form.reset();
        const imagePreview = document.getElementById('imagePreview');
        const imagePlaceholder = document.getElementById('imagePlaceholder');
        if (imagePreview) {
            imagePreview.style.display = 'none';
            imagePreview.src = '';
        }
        if (imagePlaceholder) {
            imagePlaceholder.style.display = 'flex';
        }
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
        const activityParticipation = formData.get('activityParticipation') || 'no';
        
        const work = {
            title: formData.get('title'),
            author: formData.get('author'),
            author_id: this.currentUser.id,
            summary: formData.get('summary'),
            work_type: workType,
            visibility: visibility,
            word_count: 0,
            is_activity: activityParticipation !== 'no',
            activity_track: activityParticipation !== 'no' ? activityParticipation : null
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

            const savedWork = data[0];
            savedWork.is_activity = work.is_activity;
            savedWork.activity_track = work.activity_track;

            form.reset();
            this.resetSubmitForm();
            this.showToast('投稿成功！作品已添加', 'success');
            this.loadWorks();
            this.loadProfile();
            this.navigateTo('profile');
            this.recordWordCount(savedWork, false, 0);
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
            const { data: oldWork } = await dbClient
                .from('works')
                .select('word_count, is_activity, activity_track')
                .eq('id', this.editingWorkId)
                .single();

            work.is_activity = oldWork?.is_activity || false;
            work.activity_track = oldWork?.activity_track || null;

            const { error } = await dbClient
                .from('works')
                .update(work)
                .eq('id', this.editingWorkId);
            
            if (error) {
                console.error('Update error:', error);
                this.showToast('更新失败：' + error.message, 'error');
                return;
            }

            if (work.word_count > (oldWork?.word_count || 0)) {
                work.id = this.editingWorkId;
                await this.recordWordCount(work, true, oldWork?.word_count || 0);
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

            const activityGroup = document.getElementById('activityParticipationGroup');
            if (activityGroup) {
                activityGroup.style.display = 'none';
            }

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
        
        const activityGroup = document.getElementById('activityParticipationGroup');
        if (activityGroup) {
            activityGroup.style.display = 'block';
        }

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
                    ${activity.image ? `<img src="${activity.image}" alt="${activity.title}" class="activity-image" 
                         onclick="App.showImageModal('${activity.image}')">` : ''}
                    <div class="activity-content">
                        <h3 class="activity-title">${activity.title}</h3>
                        <p class="activity-date">${activity.date_text || activity.date || ''}</p>
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
    },

    calendarMonth: new Date().getMonth(),
    calendarYear: new Date().getFullYear(),
    activitySettings: null,

    async loadActivityPage() {
        if (!this.currentUser) {
            document.getElementById('activitySettingsContent').innerHTML = `
                <p style="color: var(--text-muted); text-align: center; padding: 20px;">
                    请先<a href="#" onclick="document.getElementById('loginModal').classList.add('show'); return false;">登录</a>参与打卡活动
                </p>
            `;
        } else {
            await this.loadActivitySettings();
        }
        await this.loadActivityWorks();
        await this.loadLeaderboard('traditional');
        this.initActivityPageEvents();
    },

    initActivityPageEvents() {
        const leaderboardTabs = document.querySelectorAll('.leaderboard-tab');
        leaderboardTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                leaderboardTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.loadLeaderboard(tab.dataset.track);
            });
        });

        const trackFilter = document.getElementById('activityTrackFilter');
        if (trackFilter) {
            trackFilter.addEventListener('change', () => {
                this.loadActivityWorks(trackFilter.value);
            });
        }
    },

    async loadActivitySettings() {
        const container = document.getElementById('activitySettingsContent');
        if (!container) return;

        try {
            const { data: settings, error } = await dbClient
                .from('user_activity_settings')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .single();

            if (settings) {
                this.activitySettings = settings;
                await this.showActivityStatus(settings);
            } else {
                this.showActivitySettingsForm(null);
            }
        } catch (err) {
            console.error('Load activity settings failed:', err);
            this.showActivitySettingsForm(null);
        }
    },

    async showActivityStatus(settings) {
        const container = document.getElementById('activitySettingsContent');
        if (!container) return;

        const today = new Date().toISOString().split('T')[0];
        let todayWords = 0;
        let isChecked = false;

        try {
            const { data: todayWorks } = await dbClient
                .from('works')
                .select('word_count')
                .eq('author_id', this.currentUser.id)
                .eq('is_activity', true)
                .gte('created_at', today + 'T00:00:00')
                .lte('created_at', today + 'T23:59:59');

            todayWords = (todayWorks || []).reduce((sum, w) => sum + (w.word_count || 0), 0);

            const { data: checkin } = await dbClient
                .from('activity_checkins')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .eq('date', today)
                .single();

            isChecked = !!checkin;
        } catch (err) {
            console.error('Load today words failed:', err);
        }

        const dailyGoal = settings?.daily_goal || 50;
        const track = settings?.track || 'traditional';
        const trackLabel = track === 'ai' ? 'AI辅助赛道' : '传统赛道';
        const progress = Math.min(100, Math.round((todayWords / dailyGoal) * 100));

        const changesThisMonth = settings?.changes_this_month || 0;
        const canEdit = changesThisMonth < 3;

        container.innerHTML = `
            <div class="activity-status">
                <div class="activity-track-badge ${track}">
                    ${trackLabel}
                </div>
                <div class="daily-progress">
                    <div class="progress-header">
                        <span class="progress-label">今日进度</span>
                        <span class="progress-value">${todayWords} / ${dailyGoal} 字</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${isChecked ? 'checked' : ''}" style="width: ${progress}%"></div>
                    </div>
                    <div class="progress-status">
                        ${isChecked ? '✅ 今日已打卡' : todayWords > 0 ? `还需 ${Math.max(0, dailyGoal - todayWords)} 字` : '开始写作吧！'}
                    </div>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="App.showEditSettingsForm()" ${!canEdit ? 'disabled title="本月修改次数已用完"' : ''}>
                    ${canEdit ? '修改设置' : '本月已修改3次'}
                </button>
                <div class="current-streak ${isChecked ? 'checked' : ''}" id="currentStreak">
                    <div class="current-streak-value" id="streakDays">0</div>
                    <div class="current-streak-label">连续打卡天数</div>
                </div>
            </div>
        `;

        this.loadStreakInfo();
    },

    showActivitySettingsForm(settings) {
        const container = document.getElementById('activitySettingsContent');
        if (!container) return;

        const dailyGoal = settings?.daily_goal || 50;
        const track = settings?.track || 'traditional';
        const changesThisMonth = settings?.changes_this_month || 0;
        const isEditing = !!settings;

        container.innerHTML = `
            <div class="activity-settings-form">
                ${isEditing ? '<p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">本月已修改 ' + changesThisMonth + ' 次（限3次）</p>' : ''}
                <div class="form-group">
                    <label style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px; display: block;">选择赛道</label>
                    <div class="track-selector">
                        <div class="track-option ${track === 'traditional' ? 'active' : ''}" data-track="traditional" onclick="App.selectTrack('traditional')">
                            <div class="track-option-title">传统赛道</div>
                            <div class="track-option-desc">每日≥50字</div>
                        </div>
                        <div class="track-option ${track === 'ai' ? 'active' : ''}" data-track="ai" onclick="App.selectTrack('ai')">
                            <div class="track-option-title">AI辅助赛道</div>
                            <div class="track-option-desc">每日≥500字</div>
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px; display: block;">每日目标字数</label>
                    <div class="daily-goal-options">
                        <span class="daily-goal-option ${dailyGoal === 50 ? 'active' : ''}" onclick="App.selectDailyGoal(50)">50</span>
                        <span class="daily-goal-option ${dailyGoal === 200 ? 'active' : ''}" onclick="App.selectDailyGoal(200)">200</span>
                        <span class="daily-goal-option ${dailyGoal === 500 ? 'active' : ''}" onclick="App.selectDailyGoal(500)">500</span>
                        <span class="daily-goal-option ${dailyGoal === 1000 ? 'active' : ''}" onclick="App.selectDailyGoal(1000)">1000</span>
                        <span class="daily-goal-option ${dailyGoal === 2000 ? 'active' : ''}" onclick="App.selectDailyGoal(2000)">2000</span>
                        <span class="daily-goal-option ${dailyGoal === 4000 ? 'active' : ''}" onclick="App.selectDailyGoal(4000)">4000</span>
                    </div>
                    <div class="daily-goal-custom" style="margin-top: 8px;">
                        <span style="font-size: 13px;">自定义：</span>
                        <input type="number" id="customGoalInput" min="50" placeholder="≥50" value="${![50, 200, 500, 1000, 2000, 4000].includes(dailyGoal) ? dailyGoal : ''}">
                        <button class="btn btn-sm" onclick="App.setCustomGoal()">设置</button>
                    </div>
                </div>
                <div style="display:flex;gap:8px;">
                    <button class="btn btn-primary btn-sm" onclick="App.saveActivitySettings()">保存设置</button>
                    ${isEditing ? '<button class="btn btn-secondary btn-sm" onclick="App.cancelEditSettings()">取消</button>' : ''}
                </div>
            </div>
        `;
    },

    showEditSettingsForm() {
        this.showActivitySettingsForm(this.activitySettings);
    },

    cancelEditSettings() {
        if (this.activitySettings) {
            this.showActivityStatus(this.activitySettings);
        }
    },

    selectTrack(track) {
        document.querySelectorAll('.track-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.track === track);
        });
    },

    selectDailyGoal(goal) {
        document.querySelectorAll('.daily-goal-option').forEach(opt => {
            opt.classList.toggle('active', parseInt(opt.textContent) === goal);
        });
        const customInput = document.getElementById('customGoalInput');
        if (customInput) customInput.value = '';
    },

    setCustomGoal() {
        const input = document.getElementById('customGoalInput');
        const goal = parseInt(input.value);
        if (goal < 50) {
            this.showToast('每日目标不能低于50字', 'error');
            return;
        }
        document.querySelectorAll('.daily-goal-option').forEach(opt => {
            opt.classList.remove('active');
        });
        this.showToast(`已设置每日目标：${goal}字`, 'success');
    },

    async saveActivitySettings() {
        const track = document.querySelector('.track-option.active')?.dataset.track || 'traditional';
        let goal = parseInt(document.querySelector('.daily-goal-option.active')?.textContent);
        
        if (!goal) {
            const customInput = document.getElementById('customGoalInput');
            goal = parseInt(customInput?.value) || 50;
        }

        if (goal < 50) {
            this.showToast('每日目标不能低于50字', 'error');
            return;
        }

        const currentSettings = this.activitySettings || {};
        const changesThisMonth = (currentSettings.changes_this_month || 0) + 1;

        try {
            const { error } = await dbClient
                .from('user_activity_settings')
                .upsert([{
                    user_id: this.currentUser.id,
                    daily_goal: goal,
                    track: track,
                    changes_this_month: changesThisMonth,
                    updated_at: new Date().toISOString()
                }]);

            if (error) {
                this.showToast('保存失败：' + error.message, 'error');
                return;
            }

            this.activitySettings = { daily_goal: goal, track, changes_this_month: changesThisMonth };
            this.showToast('设置已保存！', 'success');
            this.showActivityStatus(this.activitySettings);
        } catch (err) {
            console.error('Save settings failed:', err);
            this.showToast('保存失败', 'error');
        }
    },

    async loadStreakInfo() {
        if (!this.currentUser) return;

        try {
            const { data: settings } = await dbClient
                .from('user_activity_settings')
                .select('daily_goal')
                .eq('user_id', this.currentUser.id)
                .single();

            const dailyGoal = settings?.daily_goal || 50;

            const today = new Date();
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(today.getDate() - 30);

            const { data: checkins, error } = await dbClient
                .from('activity_checkins')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
                .order('date', { ascending: false });

            if (error) {
                console.error('Load checkins failed:', error);
                return;
            }

            let streak = 0;
            const validCheckins = (checkins || []).filter(c => (c.word_count || 0) >= dailyGoal);
            const checkinDates = validCheckins.map(c => c.date);
            const todayStr = today.toISOString().split('T')[0];
            
            let checkDate = new Date(today);
            while (true) {
                const dateStr = checkDate.toISOString().split('T')[0];
                if (checkinDates.includes(dateStr)) {
                    streak++;
                    checkDate.setDate(checkDate.getDate() - 1);
                } else if (dateStr === todayStr) {
                    checkDate.setDate(checkDate.getDate() - 1);
                } else {
                    break;
                }
            }

            const streakEl = document.getElementById('streakDays');
            if (streakEl) streakEl.textContent = streak;
        } catch (err) {
            console.error('Load streak failed:', err);
        }
    },

    async loadActivityWorks(filter = 'all') {
        const grid = document.getElementById('activityWorksGrid');
        if (!grid) return;

        try {
            let query = dbClient
                .from('works')
                .select('*')
                .eq('is_activity', true)
                .order('created_at', { ascending: false });

            if (filter !== 'all') {
                query = query.eq('activity_track', filter);
            }

            const { data: works, error } = await query;

            if (error || !works || works.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">✍️</div>
                        <p class="empty-state-text">暂无活动作品，快来投稿参与打卡吧！</p>
                    </div>
                `;
                return;
            }

            grid.innerHTML = works.map((work, index) => {
                const isPrivate = work.visibility === 'private';
                const isOwner = this.currentUser && work.author_id === this.currentUser.id;
                const canView = !isPrivate || isOwner || this.isAdmin;
                const trackLabel = work.activity_track === 'ai' ? 'AI辅助' : '传统';
                const trackClass = work.activity_track === 'ai' ? 'ai' : 'traditional';

                if (isPrivate && !canView) {
                    return `
                        <div class="activity-work-card private animate-on-scroll stagger-${(index % 6) + 1}">
                            <span class="activity-work-track ${trackClass}">${trackLabel}</span>
                            <div class="activity-work-title">🔒 私密作品</div>
                            <div class="activity-work-author">作者：${work.author}</div>
                            <div class="activity-work-meta">
                                <span>📝 ${work.word_count || 0} 字</span>
                                ${work.work_type === 'chaptered' && work.chapters ? `<span>📖 ${work.chapters.length} 章</span>` : ''}
                            </div>
                        </div>
                    `;
                }

                return `
                    <div class="activity-work-card animate-on-scroll stagger-${(index % 6) + 1}" 
                         onclick="App.showWorkDetail(${work.id})">
                        <span class="activity-work-track ${trackClass}">${trackLabel}</span>
                        <div class="activity-work-title">${work.title}</div>
                        <div class="activity-work-author">作者：${work.author}</div>
                        <div class="activity-work-meta">
                            <span>📝 ${work.word_count || 0} 字</span>
                            ${work.work_type === 'chaptered' && work.chapters ? `<span>📖 ${work.chapters.length} 章</span>` : ''}
                        </div>
                    </div>
                `;
            }).join('');

            this.initScrollAnimations();
        } catch (err) {
            console.error('Load activity works failed:', err);
            grid.innerHTML = `<div class="empty-state"><p class="empty-state-text">加载失败</p></div>`;
        }
    },

    async loadLeaderboard(track = 'traditional') {
        try {
            const { data: settings, error } = await dbClient
                .from('user_activity_settings')
                .select('user_id, track')
                .eq('track', track);

            if (!settings || settings.length === 0) {
                document.getElementById('wordCountRank').innerHTML = '<p style="color: var(--text-muted); font-size: 12px;">暂无数据</p>';
                document.getElementById('checkinDaysRank').innerHTML = '<p style="color: var(--text-muted); font-size: 12px;">暂无数据</p>';
                return;
            }

            const userIds = settings.map(s => s.user_id);

            const { data: users } = await dbClient
                .from('users')
                .select('id, username, display_name')
                .in('id', userIds);

            const userMap = {};
            (users || []).forEach(u => userMap[u.id] = u.display_name || u.username);

            const { data: works } = await dbClient
                .from('works')
                .select('author_id, word_count, activity_track')
                .eq('activity_track', track)
                .in('author_id', userIds);

            const wordCountMap = {};
            (works || []).forEach(w => {
                wordCountMap[w.author_id] = (wordCountMap[w.author_id] || 0) + (w.word_count || 0);
            });

            const wordCountRank = Object.entries(wordCountMap)
                .map(([id, count]) => ({ id, name: userMap[id] || '未知', count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            const { data: checkins } = await dbClient
                .from('activity_checkins')
                .select('user_id, date')
                .eq('is_ai', track === 'ai')
                .in('user_id', userIds);

            const checkinDaysMap = {};
            (checkins || []).forEach(c => {
                checkinDaysMap[c.user_id] = (checkinDaysMap[c.user_id] || 0) + 1;
            });

            const checkinDaysRank = Object.entries(checkinDaysMap)
                .map(([id, days]) => ({ id, name: userMap[id] || '未知', days }))
                .sort((a, b) => b.days - a.days)
                .slice(0, 5);

            document.getElementById('wordCountRank').innerHTML = wordCountRank.length > 0
                ? wordCountRank.map((item, i) => `
                    <div class="leaderboard-item">
                        <span class="leaderboard-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span>
                        <span class="leaderboard-name">${item.name}</span>
                        <span class="leaderboard-value">${item.count} 字</span>
                    </div>
                `).join('')
                : '<p style="color: var(--text-muted); font-size: 12px;">暂无数据</p>';

            document.getElementById('checkinDaysRank').innerHTML = checkinDaysRank.length > 0
                ? checkinDaysRank.map((item, i) => `
                    <div class="leaderboard-item">
                        <span class="leaderboard-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span>
                        <span class="leaderboard-name">${item.name}</span>
                        <span class="leaderboard-value">${item.days} 天</span>
                    </div>
                `).join('')
                : '<p style="color: var(--text-muted); font-size: 12px;">暂无数据</p>';
        } catch (err) {
            console.error('Load leaderboard failed:', err);
        }
    },

    async loadCheckinCalendar() {
        const calendarSection = document.getElementById('checkinCalendarSection');
        if (!calendarSection || !this.currentUser) return;

        calendarSection.style.display = 'block';

        const monthYearEl = document.getElementById('calendarMonthYear');
        const daysEl = document.getElementById('calendarDays');

        const year = this.calendarYear;
        const month = this.calendarMonth;

        monthYearEl.textContent = `${year}年${month + 1}月`;

        try {
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const firstDayStr = firstDay.toISOString().split('T')[0];
            const lastDayStr = lastDay.toISOString().split('T')[0];

            const { data: checkins, error } = await dbClient
                .from('activity_checkins')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .gte('date', firstDayStr)
                .lte('date', lastDayStr);

            const checkinMap = {};
            (checkins || []).forEach(c => {
                checkinMap[c.date] = c.word_count;
            });

            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];

            let html = '';
            const startDay = firstDay.getDay();
            const totalDays = lastDay.getDate();

            const prevMonthLastDay = new Date(year, month, 0).getDate();
            for (let i = startDay - 1; i >= 0; i--) {
                html += `<div class="calendar-day other-month">${prevMonthLastDay - i}</div>`;
            }

            for (let day = 1; day <= totalDays; day++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isChecked = checkinMap[dateStr] !== undefined;
                const isToday = dateStr === todayStr;
                const wordCount = checkinMap[dateStr] || 0;

                html += `
                    <div class="calendar-day ${isChecked ? 'checked' : ''} ${isToday ? 'today' : ''}">
                        ${day}
                        ${isChecked ? `<span class="word-count">${wordCount}字</span>` : ''}
                    </div>
                `;
            }

            const endDay = lastDay.getDay();
            for (let i = 1; i < 7 - endDay; i++) {
                html += `<div class="calendar-day other-month">${i}</div>`;
            }

            daysEl.innerHTML = html;

            this.loadCheckinStats();
        } catch (err) {
            console.error('Load calendar failed:', err);
        }
    },

    async loadCheckinStats() {
        const statsEl = document.getElementById('checkinStats');
        if (!statsEl || !this.currentUser) return;

        try {
            const today = new Date();
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

            const { data: monthCheckins } = await dbClient
                .from('activity_checkins')
                .select('word_count')
                .eq('user_id', this.currentUser.id)
                .gte('date', monthStart.toISOString().split('T')[0]);

            const totalDays = (monthCheckins || []).length;
            const totalWords = (monthCheckins || []).reduce((sum, c) => sum + (c.word_count || 0), 0);

            statsEl.innerHTML = `
                <div class="checkin-stat">
                    <div class="checkin-stat-value">${totalDays}</div>
                    <div class="checkin-stat-label">本月打卡</div>
                </div>
                <div class="checkin-stat">
                    <div class="checkin-stat-value">${totalWords}</div>
                    <div class="checkin-stat-label">本月字数</div>
                </div>
            `;
        } catch (err) {
            console.error('Load stats failed:', err);
        }
    },

    initCalendarNavigation() {
        const prevBtn = document.getElementById('calendarPrevMonth');
        const nextBtn = document.getElementById('calendarNextMonth');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.calendarMonth--;
                if (this.calendarMonth < 0) {
                    this.calendarMonth = 11;
                    this.calendarYear--;
                }
                this.loadCheckinCalendar();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.calendarMonth++;
                if (this.calendarMonth > 11) {
                    this.calendarMonth = 0;
                    this.calendarYear++;
                }
                this.loadCheckinCalendar();
            });
        }
    },

    async checkDailyGoal(work) {
        if (!this.currentUser) return;

        try {
            const { data: settings } = await dbClient
                .from('user_activity_settings')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .single();

            if (!settings) return;

            await this.updateTodayCheckin(settings, work.is_activity);
        } catch (err) {
            console.error('Check daily goal failed:', err);
        }
    },

    async updateTodayCheckin(settings, isActivity = false) {
        if (!this.currentUser || !settings) return;

        const dailyGoal = settings.daily_goal || 50;
        const today = new Date().toISOString().split('T')[0];

        const { data: activityRecords } = await dbClient
            .from('word_records')
            .select('added_words')
            .eq('user_id', this.currentUser.id)
            .eq('is_activity', true)
            .eq('date', today);

        const activityWords = (activityRecords || []).reduce((sum, r) => sum + (r.added_words || 0), 0);

        const { data: existingCheckin } = await dbClient
            .from('activity_checkins')
            .select('*')
            .eq('user_id', this.currentUser.id)
            .eq('date', today)
            .single();

        const alreadyCheckedIn = existingCheckin && existingCheckin.word_count >= dailyGoal;

        const { error } = await dbClient
            .from('activity_checkins')
            .upsert([{
                user_id: this.currentUser.id,
                date: today,
                word_count: activityWords,
                is_ai: settings.track === 'ai'
            }]);

        if (!error) {
            console.log('打卡检查:', { activityWords, dailyGoal, alreadyCheckedIn });
            if (activityWords >= dailyGoal && !alreadyCheckedIn) {
                this.showToast(`🎉 打卡成功！今日已写 ${activityWords} 字`, 'success');
            } else if (activityWords >= dailyGoal) {
                this.showToast(`今日已写 ${activityWords} 字，已达标`, 'success');
            } else {
                this.showToast(`今日已写 ${activityWords} 字，还需 ${dailyGoal - activityWords} 字`, 'success');
            }
        }
    },

    async recordWordCount(work, isUpdate = false, oldWordCount = 0) {
        if (!this.currentUser) return;

        const today = new Date().toISOString().split('T')[0];
        const addedWords = isUpdate ? Math.max(0, (work.word_count || 0) - oldWordCount) : (work.word_count || 0);

        console.log('recordWordCount:', { 
            workId: work.id, 
            wordCount: work.word_count, 
            isActivity: work.is_activity, 
            addedWords 
        });

        if (addedWords <= 0) return;

        try {
            await dbClient
                .from('word_records')
                .insert([{
                    user_id: this.currentUser.id,
                    date: today,
                    work_id: work.id || null,
                    added_words: addedWords,
                    is_activity: work.is_activity || false
                }]);

            const { data: settings } = await dbClient
                .from('user_activity_settings')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .single();

            console.log('用户设置:', settings);

            if (settings && work.is_activity) {
                await this.updateTodayCheckin(settings, true);
            }
        } catch (err) {
            console.error('Record word count failed:', err);
        }
    },

    async updateCheckinWithAddedWords(addedWords) {
        if (!this.currentUser || addedWords <= 0) return;

        try {
            const { data: settings } = await dbClient
                .from('user_activity_settings')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .single();

            if (settings) {
                await this.updateTodayCheckin(settings, true);
            }
        } catch (err) {
            console.error('Update checkin failed:', err);
        }
    },

    async showWorkActivitySettings(workId) {
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

            const currentTrack = work.activity_track || 'traditional';
            const isActivity = work.is_activity || false;

            const modalHtml = `
                <div class="modal-content activity-settings-modal">
                    <span class="modal-close" onclick="App.closeActivitySettingsModal()">&times;</span>
                    <h3 style="margin-bottom:16px;">参赛设置 - ${work.title}</h3>
                    <div class="form-group">
                        <label style="font-size:13px;color:var(--text-muted);margin-bottom:8px;display:block;">是否参与打卡活动</label>
                        <div class="activity-toggle">
                            <label class="toggle-option">
                                <input type="radio" name="activityToggle" value="no" ${!isActivity ? 'checked' : ''}>
                                <span class="toggle-content">不参与</span>
                            </label>
                            <label class="toggle-option">
                                <input type="radio" name="activityToggle" value="yes" ${isActivity ? 'checked' : ''}>
                                <span class="toggle-content">参与</span>
                            </label>
                        </div>
                    </div>
                    <div class="form-group track-select-group" style="${isActivity ? '' : 'display:none;'}">
                        <label style="font-size:13px;color:var(--text-muted);margin-bottom:8px;display:block;">选择赛道</label>
                        <div class="track-selector">
                            <div class="track-option ${currentTrack === 'traditional' ? 'active' : ''}" data-track="traditional" onclick="App.selectWorkTrack('traditional')">
                                <div class="track-option-title">传统赛道</div>
                                <div class="track-option-desc">每日≥50字</div>
                            </div>
                            <div class="track-option ${currentTrack === 'ai' ? 'active' : ''}" data-track="ai" onclick="App.selectWorkTrack('ai')">
                                <div class="track-option-title">AI辅助赛道</div>
                                <div class="track-option-desc">每日≥500字</div>
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="App.saveWorkActivitySettings(${workId})" style="margin-top:16px;">保存设置</button>
                </div>
            `;

            const modal = document.getElementById('activitySettingsModal');
            if (!modal) {
                const newModal = document.createElement('div');
                newModal.id = 'activitySettingsModal';
                newModal.className = 'modal show';
                newModal.innerHTML = modalHtml;
                document.body.appendChild(newModal);
            } else {
                modal.innerHTML = modalHtml;
                modal.classList.add('show');
            }

            document.querySelectorAll('input[name="activityToggle"]').forEach(input => {
                input.addEventListener('change', (e) => {
                    const trackGroup = document.querySelector('.track-select-group');
                    if (e.target.value === 'yes') {
                        trackGroup.style.display = 'block';
                    } else {
                        trackGroup.style.display = 'none';
                    }
                });
            });
        } catch (err) {
            console.error('Show work activity settings failed:', err);
        }
    },

    selectWorkTrack(track) {
        document.querySelectorAll('#activitySettingsModal .track-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.track === track);
        });
    },

    closeActivitySettingsModal() {
        const modal = document.getElementById('activitySettingsModal');
        if (modal) {
            modal.classList.remove('show');
        }
    },

    async saveWorkActivitySettings(workId) {
        const isActivity = document.querySelector('input[name="activityToggle"]:checked')?.value === 'yes';
        const track = document.querySelector('#activitySettingsModal .track-option.active')?.dataset.track || 'traditional';

        try {
            const { error } = await dbClient
                .from('works')
                .update({
                    is_activity: isActivity,
                    activity_track: isActivity ? track : null
                })
                .eq('id', workId);

            if (error) {
                this.showToast('保存失败：' + error.message, 'error');
                return;
            }

            this.showToast('设置已保存！从下次更新开始计算打卡字数', 'success');
            this.closeActivitySettingsModal();
            this.loadMyWorks();
        } catch (err) {
            console.error('Save work activity settings failed:', err);
            this.showToast('保存失败', 'error');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
