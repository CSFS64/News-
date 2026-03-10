// ═══════════════════════════════════════════════════════════
//  新闻汇 NewsBoard — Application Logic
//  Retro 2008 Style · localStorage-powered
// ═══════════════════════════════════════════════════════════

// ── DATA STORE ──
var store = {
  get: function(k, def) {
    try { var v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : def; }
    catch(e) { return def; }
  },
  set: function(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
};

// ── DEFAULT DATA ──
(function initDefaults() {
  if (!store.get('nb_tabs', null)) {
    store.set('nb_tabs', ['全部', '国际', '科技', '财经', '体育', '文化', '健康', '社会']);
  }
  if (!store.get('nb_articles', null)) {
    store.set('nb_articles', [
      {
        id: 'a1',
        title: '人工智能大模型竞赛加速，全球科技巨头纷纷布局新一代AI基础设施',
        source: 'MIT Tech Review',
        url: 'https://technologyreview.com',
        category: '科技',
        desc: '随着AI技术的快速演进，OpenAI、Google、Anthropic等头部企业竞相扩大算力投入，建设新一代超大规模数据中心，争夺下一个技术制高点。业界普遍认为，本轮AI军备竞赛将深刻重塑全球科技格局。',
        emoji: '🤖',
        heat: '【热门】',
        likes: 48,
        comments: [],
        saves: 0,
        date: new Date().toISOString(),
        featured: true
      },
      {
        id: 'a2',
        title: '全球气候峰会达成新协议：各国承诺2035年碳排放减少45%',
        source: 'Reuters',
        url: 'https://reuters.com',
        category: '国际',
        desc: '来自全球180个国家的代表在本次气候峰会上签署了具有里程碑意义的减排承诺，这是迄今为止最具雄心的气候协议，多国环保人士对此表示欢迎。',
        emoji: '🌍',
        heat: '【突发】',
        likes: 32,
        comments: [],
        saves: 0,
        date: new Date().toISOString(),
        featured: false
      },
      {
        id: 'a3',
        title: '纳斯达克指数创历史新高，科技股全线上涨引发市场关注',
        source: 'Financial Times',
        url: 'https://ft.com',
        category: '财经',
        desc: '受AI浪潮和强劲企业财报驱动，纳斯达克综合指数本周突破历史高位，半导体和云计算板块领涨，分析师对后市走向看法不一。',
        emoji: '📈',
        heat: '',
        likes: 21,
        comments: [],
        saves: 0,
        date: new Date().toISOString(),
        featured: false
      },
      {
        id: 'a4',
        title: '世界杯预选赛精彩战报：多支强队晋级下一阶段比赛',
        source: '体育日报',
        url: '#',
        category: '体育',
        desc: '昨日进行的世界杯预选赛中，多场焦点对决吸引全球数亿观众瞩目，几支传统强队凭借精彩表现顺利晋级，赛后球迷反应热烈。',
        emoji: '⚽',
        heat: '',
        likes: 15,
        comments: [],
        saves: 0,
        date: new Date().toISOString(),
        featured: false
      },
      {
        id: 'a5',
        title: '新研究揭示间歇性禁食对代谢健康的深远影响',
        source: 'Nature Medicine',
        url: 'https://nature.com',
        category: '健康',
        desc: '发表于《自然·医学》的最新研究表明，坚持16:8间歇性禁食模式12周后，受试者的胰岛素敏感性显著提升，炎症标志物明显下降，研究结果令科学界振奋。',
        emoji: '🧬',
        heat: '【精选】',
        likes: 27,
        comments: [],
        saves: 0,
        date: new Date().toISOString(),
        featured: false
      }
    ]);
  }
  if (!store.get('nb_users', null)) store.set('nb_users', []);
})();

// ── STATE ──
var currentTab = '全部';
var currentUser = store.get('nb_currentUser', null);
var searchQuery = '';
var currentArticleId = null;

// ── INIT ──
window.onload = function() {
  setNavDate();
  renderTabs();
  renderNews();
  renderSidebar();
  renderHeaderUser();
  renderStats();
};

function setNavDate() {
  var d = new Date();
  var days = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  var el = document.getElementById('nav-date');
  if (el) {
    el.textContent = d.getFullYear() + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日 ' + days[d.getDay()];
  }
}

// ── TABS ──
function renderTabs() {
  var tabs = store.get('nb_tabs', ['全部']);
  var arts = store.get('nb_articles', []);
  var nav = document.getElementById('main-nav');
  nav.innerHTML = '';
  tabs.forEach(function(t) {
    var count = t === '全部' ? arts.length : arts.filter(function(a){ return a.category === t; }).length;
    var countHtml = count > 0 ? '<span class="nav-count">' + count + '</span>' : '';
    var li = document.createElement('li');
    li.innerHTML = '<a href="#" class="' + (currentTab === t ? 'active' : '') + '" onclick="switchTab(\'' + t + '\');return false;">' + t + countHtml + '</a>';
    nav.appendChild(li);
  });
}

function switchTab(tab) {
  currentTab = tab;
  searchQuery = '';
  var si = document.getElementById('search-input');
  if (si) si.value = '';
  renderTabs();
  renderNews();
}

// ── NEWS RENDER ──
function getFiltered() {
  var arts = store.get('nb_articles', []);
  if (currentTab !== '全部') {
    arts = arts.filter(function(a){ return a.category === currentTab; });
  }
  if (searchQuery) {
    var q = searchQuery.toLowerCase();
    arts = arts.filter(function(a){
      return (a.title||'').toLowerCase().indexOf(q) >= 0 ||
             (a.desc||'').toLowerCase().indexOf(q) >= 0 ||
             (a.source||'').toLowerCase().indexOf(q) >= 0;
    });
  }
  return arts;
}

function renderNews() {
  var arts = getFiltered();
  var views = store.get('nb_viewHistory', []);

  // Sort: featured first, then by likes
  arts = arts.slice().sort(function(a, b){
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return b.likes - a.likes;
  });

  // Recommend banner
  var catCount = {};
  views.forEach(function(id){
    var a = store.get('nb_articles', []).find(function(x){ return x.id === id; });
    if (a) catCount[a.category] = (catCount[a.category]||0)+1;
  });
  var topCat = null, topN = 0;
  Object.keys(catCount).forEach(function(k){
    if (catCount[k] > topN) { topN = catCount[k]; topCat = k; }
  });
  var notice = document.getElementById('recommend-notice');
  if (topCat && views.length >= 2 && currentTab === '全部') {
    document.getElementById('recommend-text').textContent =
      '根据你的浏览习惯，为你推荐更多关于「' + topCat + '」的内容';
    notice.style.display = 'block';
  } else {
    notice.style.display = 'none';
  }

  // Breaking banner (first featured article)
  var featured = arts.find(function(a){ return a.featured; });
  var breakBanner = document.getElementById('breaking-banner');
  if (featured && currentTab === '全部') {
    document.getElementById('breaking-text').textContent = featured.title;
    breakBanner.style.display = 'block';
  } else {
    breakBanner.style.display = 'none';
  }

  var list = document.getElementById('news-list');
  if (arts.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📰</div><div class="empty-state-text">暂无相关新闻，请稍后查看</div></div>';
    return;
  }

  list.innerHTML = arts.map(function(a, i){ return renderNewsItem(a, i); }).join('');
}

function renderNewsItem(a, i) {
  var userLikes = store.get('nb_userLikes', {});
  var userSaves = store.get('nb_userSaves', {});
  var email = currentUser ? currentUser.email : '';
  var liked = email && userLikes[email] && userLikes[email].indexOf(a.id) >= 0;
  var saved = email && userSaves[email] && userSaves[email].indexOf(a.id) >= 0;
  var isFeatured = a.featured && i === 0 && currentTab === '全部';

  var heatHtml = a.heat ? '<span class="news-heat-tag">' + a.heat + '</span>' : '';
  var featBadge = isFeatured ? '<span class="featured-badge">★ 精选</span>' : '';

  return '<div class="news-item' + (isFeatured ? ' featured-item' : '') + '" id="ni-' + a.id + '">' +
    '<div class="news-item-inner">' +
    '<div class="news-emoji-col">' + (a.emoji||'📰') + '</div>' +
    '<div class="news-body">' +
    '<div class="news-meta-top">' +
    featBadge +
    '<span class="news-cat-tag">' + a.category + '</span>' +
    heatHtml +
    '<span class="news-source">' + escHtml(a.source) + '</span>' +
    '<span class="news-date">' + formatDate(a.date) + '</span>' +
    '</div>' +
    '<div class="news-title"><a href="#" onclick="openArticle(\'' + a.id + '\');return false;">' + escHtml(a.title) + '</a></div>' +
    '<div class="news-desc">' + escHtml(a.desc||'') + '</div>' +
    '<div class="news-actions">' +
    '<a href="#" class="action-link' + (liked?' liked':'') + '" onclick="toggleLike(event,\'' + a.id + '\');return false;">♥ 点赞 <span class="count">' + a.likes + '</span></a>' +
    '<a href="#" class="action-link' + (saved?' saved':'') + '" onclick="toggleSave(event,\'' + a.id + '\');return false;">★ 收藏 <span class="count">' + (a.saves||0) + '</span></a>' +
    '<a href="#" class="action-link" onclick="openArticle(\'' + a.id + '\');return false;">💬 评论 ' + ((a.comments||[]).length) + '</a>' +
    '<a href="' + a.url + '" target="_blank" class="action-link" style="margin-left:auto">阅读原文 »</a>' +
    '</div>' +
    '</div></div></div>';
}

// ── ARTICLE OPEN ──
function openArticle(id) {
  var arts = store.get('nb_articles', []);
  var a = null;
  for (var i=0; i<arts.length; i++) { if (arts[i].id === id) { a = arts[i]; break; } }
  if (!a) return;
  currentArticleId = id;

  var views = store.get('nb_viewHistory', []);
  if (views.indexOf(id) < 0) {
    views.unshift(id);
    store.set('nb_viewHistory', views.slice(0, 50));
  }

  document.getElementById('article-modal-title').textContent = a.source + ' · ' + a.category;
  renderArticleBody(a);
  openModal('article-modal');
}

function renderArticleBody(a) {
  var userLikes = store.get('nb_userLikes', {});
  var userSaves = store.get('nb_userSaves', {});
  var email = currentUser ? currentUser.email : '';
  var liked = email && userLikes[email] && userLikes[email].indexOf(a.id) >= 0;
  var saved = email && userSaves[email] && userSaves[email].indexOf(a.id) >= 0;

  var commentsHtml = '';
  var cmts = a.comments || [];
  if (cmts.length === 0) {
    commentsHtml = '<div class="no-comments">暂无评论，登录后发表第一条评论吧！</div>';
  } else {
    commentsHtml = cmts.map(function(c){
      return '<div class="comment-item-row">' +
        '<span class="comment-user">@' + escHtml(c.user) + '</span>' +
        '<span class="comment-time">' + formatDate(c.date) + '</span>' +
        '<div class="comment-text">' + escHtml(c.text) + '</div>' +
        '</div>';
    }).join('');
  }

  var commentInput = currentUser
    ? '<div class="comment-write-box">' +
      '<textarea id="comment-input-field" placeholder="写下你的评论...（按Ctrl+Enter发送）" onkeydown="handleCommentKey(event,\'' + a.id + '\')"></textarea>' +
      '<div style="margin-top:6px"><button class="btn-submit" style="padding:5px 18px;font-size:12px" onclick="submitComment(\'' + a.id + '\')">发表评论</button></div>' +
      '</div>'
    : '<div class="login-prompt">请 <a href="#" onclick="closeAllModals();openModal(\'login-modal\');return false;">登录</a> 后发表评论</div>';

  document.getElementById('article-modal-body').innerHTML =
    '<div class="article-source-strip">' +
    '<span class="article-source-name">' + escHtml(a.source) + '</span>' +
    '<span class="article-cat-pill">' + a.category + '</span>' +
    (a.heat ? '<span style="color:#e05a00;font-size:11px;font-weight:bold">' + a.heat + '</span>' : '') +
    '<span style="color:#999;font-size:11px">' + formatDate(a.date) + '</span>' +
    '</div>' +
    '<div class="article-modal-title-text">' + escHtml(a.title) + '</div>' +
    '<div class="article-modal-desc">' + escHtml(a.desc || '该文章暂无摘要。') + '</div>' +
    '<div class="article-modal-actions">' +
    '<a href="' + a.url + '" target="_blank" class="btn-read-original">➜ 阅读原文</a>' +
    '<a href="#" class="action-link' + (liked?' liked':'') + '" id="modal-like-btn" onclick="toggleLike(event,\'' + a.id + '\',true);return false;">♥ 点赞 ' + a.likes + '</a>' +
    '<a href="#" class="action-link' + (saved?' saved':'') + '" id="modal-save-btn" onclick="toggleSave(event,\'' + a.id + '\',true);return false;">★ 收藏 ' + (a.saves||0) + '</a>' +
    '</div>' +
    '<div class="comments-box">' +
    '<div class="comments-heading">💬 读者评论 (' + cmts.length + ')</div>' +
    commentInput +
    commentsHtml +
    '</div>';
}

// ── COMMENT ──
function handleCommentKey(e, id) {
  if (e.ctrlKey && e.keyCode === 13) submitComment(id);
}

function submitComment(id) {
  if (!currentUser) return;
  var input = document.getElementById('comment-input-field');
  var text = input ? input.value.trim() : '';
  if (!text) { showToast('评论内容不能为空'); return; }

  var arts = store.get('nb_articles', []);
  var a = null;
  for (var i=0; i<arts.length; i++) { if (arts[i].id===id){ a=arts[i]; break; } }
  if (!a) return;
  a.comments = a.comments || [];
  a.comments.unshift({ user: currentUser.username, text: text, date: new Date().toISOString() });
  store.set('nb_articles', arts);
  renderArticleBody(a);
  renderNews();
  showToast('评论发表成功！');
}

// ── LIKES & SAVES ──
function toggleLike(e, id, fromModal) {
  e.preventDefault();
  if (!currentUser) { showToast('请先登录后再点赞'); openModal('login-modal'); return; }
  var arts = store.get('nb_articles', []);
  var a = null;
  for (var i=0; i<arts.length; i++) { if (arts[i].id===id){ a=arts[i]; break; } }
  var userLikes = store.get('nb_userLikes', {});
  var em = currentUser.email;
  userLikes[em] = userLikes[em] || [];
  if (userLikes[em].indexOf(id) >= 0) {
    userLikes[em] = userLikes[em].filter(function(x){ return x !== id; });
    a.likes = Math.max(0, a.likes - 1);
    showToast('已取消点赞');
  } else {
    userLikes[em].push(id);
    a.likes++;
    showToast('点赞成功！♥');
  }
  store.set('nb_userLikes', userLikes);
  store.set('nb_articles', arts);
  renderNews();
  if (fromModal) renderArticleBody(a);
}

function toggleSave(e, id, fromModal) {
  e.preventDefault();
  if (!currentUser) { showToast('请先登录后再收藏'); openModal('login-modal'); return; }
  var arts = store.get('nb_articles', []);
  var a = null;
  for (var i=0; i<arts.length; i++) { if (arts[i].id===id){ a=arts[i]; break; } }
  var userSaves = store.get('nb_userSaves', {});
  var em = currentUser.email;
  userSaves[em] = userSaves[em] || [];
  if (userSaves[em].indexOf(id) >= 0) {
    userSaves[em] = userSaves[em].filter(function(x){ return x !== id; });
    a.saves = Math.max(0, (a.saves||1) - 1);
    showToast('已取消收藏');
  } else {
    userSaves[em].push(id);
    a.saves = (a.saves||0) + 1;
    showToast('收藏成功！★');
  }
  store.set('nb_userSaves', userSaves);
  store.set('nb_articles', arts);
  renderNews();
  renderStats();
  if (fromModal) renderArticleBody(a);
}

// ── AUTH ──
function handleSignup() {
  var username = document.getElementById('signup-username').value.trim();
  var email = document.getElementById('signup-email').value.trim();
  var password = document.getElementById('signup-password').value;
  var errEl = document.getElementById('signup-error');
  errEl.style.display = 'none';

  if (!username || !email || !password) { showToast('请填写所有必填项'); return; }
  if (password.length < 6) { showToast('密码至少需要6位'); return; }

  var users = store.get('nb_users', []);
  var exists = users.some(function(u){ return u.email === email; });
  if (exists) { errEl.style.display = 'block'; return; }

  var isFirstUser = users.length === 0;
  var newUser = { username: username, email: email, password: password, isAdmin: isFirstUser, joinDate: new Date().toISOString() };
  users.push(newUser);
  store.set('nb_users', users);
  store.set('nb_currentUser', newUser);
  currentUser = newUser;

  closeAllModals();
  renderHeaderUser();
  renderStats();
  showToast('注册成功！欢迎加入，' + username + (isFirstUser ? '（已设为管理员）' : '') + '！');
}

function handleLogin() {
  var email = document.getElementById('login-email').value.trim();
  var password = document.getElementById('login-password').value;
  var errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  var users = store.get('nb_users', []);
  var user = null;
  for (var i=0; i<users.length; i++) {
    if (users[i].email === email && users[i].password === password) { user = users[i]; break; }
  }
  if (!user) { errEl.style.display = 'block'; return; }

  store.set('nb_currentUser', user);
  currentUser = user;
  closeAllModals();
  renderHeaderUser();
  renderNews();
  showToast('欢迎回来，' + user.username + '！');
}

function handleLogout() {
  store.set('nb_currentUser', null);
  currentUser = null;
  renderHeaderUser();
  renderNews();
  showToast('已安全退出登录');
}

// ── HEADER USER STATE ──
function renderHeaderUser() {
  var authLinks = document.getElementById('auth-links');
  var userLinks = document.getElementById('user-links');
  var greet = document.getElementById('greeting-text');
  var adminLink = document.getElementById('admin-link');
  var usernameDisplay = document.getElementById('username-display');

  if (!currentUser) {
    authLinks.style.display = '';
    userLinks.style.display = 'none';
    greet.textContent = '您好，游客！';
  } else {
    authLinks.style.display = 'none';
    userLinks.style.display = '';
    greet.textContent = '已登录';
    usernameDisplay.textContent = '【' + currentUser.username + '】';
    if (currentUser.isAdmin) {
      adminLink.style.display = '';
    } else {
      adminLink.style.display = 'none';
    }
  }
}

// ── SIDEBAR ──
function renderSidebar() {
  var arts = store.get('nb_articles', []);

  // Hot list
  var sorted = arts.slice().sort(function(a,b){ return b.likes - a.likes; }).slice(0,5);
  var hotHtml = sorted.map(function(a, i){
    var cls = i===0?'r1':i===1?'r2':i===2?'r3':'';
    return '<div class="hot-item" onclick="openArticle(\'' + a.id + '\')">' +
      '<span class="hot-rank ' + cls + '">' + (i+1) + '</span>' +
      '<div><div class="hot-item-text">' + escHtml(a.title) + '</div>' +
      '<span class="hot-likes">♥ ' + a.likes + '</span></div>' +
      '</div>';
  }).join('');
  document.getElementById('hot-list').innerHTML = hotHtml || '<div style="padding:10px;color:#aaa;font-size:12px">暂无数据</div>';

  // Category list
  var tabs = store.get('nb_tabs', []).filter(function(t){ return t !== '全部'; });
  var catHtml = tabs.map(function(t){
    var count = arts.filter(function(a){ return a.category === t; }).length;
    return '<div class="cat-link-item" onclick="switchTab(\'' + t + '\')">' +
      '<span class="cat-name">▸ ' + t + '</span>' +
      '<span class="cat-count">' + count + '</span>' +
      '</div>';
  }).join('');
  document.getElementById('cat-list').innerHTML = catHtml || '<div style="padding:10px;color:#aaa">暂无分类</div>';
}

function renderStats() {
  var arts = store.get('nb_articles', []);
  var users = store.get('nb_users', []);
  var today = new Date().toDateString();
  var todayCount = arts.filter(function(a){
    return new Date(a.date).toDateString() === today;
  }).length;
  var totalComments = arts.reduce(function(s,a){ return s + (a.comments||[]).length; }, 0);
  var el = function(id, v) { var e=document.getElementById(id); if(e) e.innerHTML='<strong>'+v+'</strong>'; };
  el('stat-today', todayCount);
  el('stat-total', arts.length);
  el('stat-users', users.length);
  el('stat-comments', totalComments);
}

// ── SEARCH ──
function handleSearch() {
  searchQuery = document.getElementById('search-input').value;
  renderNews();
}

// ── SAVED MODAL ──
function openSavedModal() {
  if (!currentUser) { openModal('login-modal'); return; }
  var userSaves = store.get('nb_userSaves', {});
  var savedIds = userSaves[currentUser.email] || [];
  var arts = store.get('nb_articles', []);
  var saved = savedIds.map(function(id){ return arts.find(function(a){ return a.id===id; }); }).filter(Boolean);

  var body = document.getElementById('saved-modal-body');
  if (saved.length === 0) {
    body.innerHTML = '<div class="saved-empty">📂 收藏夹空空如也~<br><span style="font-size:11px">浏览新闻时点击「★ 收藏」即可保存</span></div>';
  } else {
    body.innerHTML = saved.map(function(a){
      return '<div class="saved-item-row" onclick="closeAllModals();openArticle(\'' + a.id + '\')">' +
        '<span class="saved-emoji">' + (a.emoji||'📰') + '</span>' +
        '<div><div class="saved-title">' + escHtml(a.title) + '</div>' +
        '<span class="saved-src">' + escHtml(a.source) + '</span></div>' +
        '</div>';
    }).join('');
  }
  openModal('saved-modal');
}

// override the saved modal link behavior
document.addEventListener('DOMContentLoaded', function() {});

// ── ADMIN ──
function openAdmin() {
  if (!currentUser || !currentUser.isAdmin) { showToast('权限不足'); return; }
  refreshPubCats();
  switchAdminTab('publish');
  openModal('admin-modal');
}

function refreshPubCats() {
  var tabs = store.get('nb_tabs', []).filter(function(t){ return t !== '全部'; });
  var sel = document.getElementById('pub-category');
  sel.innerHTML = tabs.map(function(t){ return '<option value="'+t+'">'+t+'</option>'; }).join('');
}

function switchAdminTab(tab) {
  var tabs = ['publish', 'manage', 'cats'];
  tabs.forEach(function(t){
    var panel = document.getElementById('admin-'+t);
    var link = document.getElementById('atab-'+t);
    if (panel) panel.style.display = t===tab ? 'block' : 'none';
    if (link) link.className = 'admin-tab-link' + (t===tab?' active':'');
  });
  if (tab === 'manage') renderManageList();
  if (tab === 'cats') renderCatsManage();
}

function publishArticle() {
  var title = document.getElementById('pub-title').value.trim();
  var source = document.getElementById('pub-source').value.trim();
  var url = document.getElementById('pub-url').value.trim();
  var category = document.getElementById('pub-category').value;
  var desc = document.getElementById('pub-desc').value.trim();
  var emoji = document.getElementById('pub-emoji').value.trim() || '📰';
  var heat = document.getElementById('pub-heat').value;

  if (!title || !source || !url || !category) { showToast('请填写所有必填项（标题、来源、链接、分类）'); return; }

  var arts = store.get('nb_articles', []);
  arts.unshift({
    id: 'a' + Date.now(),
    title: title, source: source, url: url, category: category,
    desc: desc, emoji: emoji, heat: heat,
    likes: 0, comments: [], saves: 0,
    date: new Date().toISOString(), featured: false
  });
  store.set('nb_articles', arts);

  ['pub-title','pub-source','pub-url','pub-desc','pub-emoji'].forEach(function(id){
    document.getElementById(id).value = '';
  });
  document.getElementById('pub-heat').value = '';

  closeAllModals();
  renderTabs();
  renderNews();
  renderSidebar();
  renderStats();
  showToast('文章发布成功！');
}

function renderManageList() {
  var arts = store.get('nb_articles', []);
  var el = document.getElementById('manage-list');
  if (arts.length === 0) {
    el.innerHTML = '<div style="text-align:center;color:#aaa;padding:20px;font-size:12px">暂无文章</div>';
    return;
  }
  el.innerHTML = arts.map(function(a){
    return '<div class="manage-row">' +
      '<div class="manage-row-title">' +
      '<span class="manage-row-src">' + escHtml(a.source) + '</span>' +
      escHtml(a.title) +
      '</div>' +
      '<button class="btn-del" onclick="deleteArticle(\'' + a.id + '\')">删除</button>' +
      '</div>';
  }).join('');
}

function deleteArticle(id) {
  if (!confirm('确定要删除这篇文章吗？此操作不可撤销。')) return;
  var arts = store.get('nb_articles', []).filter(function(a){ return a.id !== id; });
  store.set('nb_articles', arts);
  renderManageList();
  renderTabs();
  renderNews();
  renderSidebar();
  renderStats();
  showToast('文章已删除');
}

function renderCatsManage() {
  var tabs = store.get('nb_tabs', []).filter(function(t){ return t !== '全部'; });
  var el = document.getElementById('cats-manage-list');
  el.innerHTML = tabs.map(function(t){
    return '<div class="manage-row">' +
      '<div class="manage-row-title">' + t + '</div>' +
      '<button class="btn-del" onclick="deleteCategory(\'' + t + '\')">删除</button>' +
      '</div>';
  }).join('') || '<div style="color:#aaa;padding:10px;font-size:12px">暂无分类</div>';
}

function addCategory() {
  var name = document.getElementById('new-cat-name').value.trim();
  if (!name) return;
  var tabs = store.get('nb_tabs', []);
  if (tabs.indexOf(name) >= 0) { showToast('该分类已存在'); return; }
  tabs.push(name);
  store.set('nb_tabs', tabs);
  document.getElementById('new-cat-name').value = '';
  renderCatsManage();
  renderTabs();
  refreshPubCats();
  showToast('分类「' + name + '」添加成功');
}

function deleteCategory(name) {
  if (!confirm('删除分类「' + name + '」？（该分类下的文章不会被删除）')) return;
  var tabs = store.get('nb_tabs', []).filter(function(t){ return t !== name; });
  store.set('nb_tabs', tabs);
  if (currentTab === name) currentTab = '全部';
  renderCatsManage();
  renderTabs();
  refreshPubCats();
  showToast('分类已删除');
}

// ── MODAL CONTROL ──
function openModal(id) {
  // special handling for saved modal
  if (id === 'saved-modal') { openSavedModal(); return; }
  document.getElementById('modal-overlay').className = 'open';
  var el = document.getElementById(id);
  if (el) el.className = el.className.replace(' open', '') + ' open';
}

function closeAllModals() {
  document.getElementById('modal-overlay').className = '';
  var modals = document.querySelectorAll('.modal-box');
  for (var i=0; i<modals.length; i++) {
    modals[i].className = modals[i].className.replace(' open', '');
  }
}

function switchModal(from, to) {
  closeAllModals();
  openModal(to);
}

// ── TOAST ──
function showToast(msg) {
  var box = document.getElementById('toast-box');
  var item = document.createElement('div');
  item.className = 'toast-item';
  item.textContent = msg;
  box.appendChild(item);
  setTimeout(function(){ item.className += ' show'; }, 10);
  setTimeout(function(){
    item.className = item.className.replace(' show', '');
    setTimeout(function(){ if(item.parentNode) item.parentNode.removeChild(item); }, 300);
  }, 2800);
}

// ── UTILS ──
function escHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function formatDate(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  var now = new Date();
  var diff = Math.floor((now - d) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff/60) + '分钟前';
  if (diff < 86400) return Math.floor(diff/3600) + '小时前';
  if (diff < 86400*3) return Math.floor(diff/86400) + '天前';
  return (d.getMonth()+1) + '月' + d.getDate() + '日';
}
