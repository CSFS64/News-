/**
 * ═══════════════════════════════════════════════════════════════
 *  战线快报 · FRONTLINE DISPATCH
 *  app.js — Application Controller
 *
 *  All data access goes through API.* (defined in api.js).
 *  This file never touches localStorage or fetch() directly.
 * ═══════════════════════════════════════════════════════════════
 */

/* ══════════════════════════════════════════════════════════
   APP STATE
   ══════════════════════════════════════════════════════════ */
var State = {
  currentTab:  '全部',
  searchQuery: '',
  currentUser: null,
  userLikes:   [],     // article ids liked by current user
  userSaves:   [],     // article ids saved by current user
  loading:     false
};

/* ══════════════════════════════════════════════════════════
   BOOTSTRAP
   ══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {
  Clock.start();
  Ticker.init();
  Dialog.initAll();

  API.getSession().then(function (user) {
    State.currentUser = user;
    if (user) {
      return Promise.all([
        API.getUserLikes(user.id),
        API.getUserSaves(user.id)
      ]).then(function (results) {
        State.userLikes = results[0];
        State.userSaves = results[1];
      });
    }
  }).then(function () {
    Auth.renderHeader();
    return App.refresh();
  }).catch(function (e) {
    console.error('[boot]', e);
    App.refresh();
  });
});

/* ══════════════════════════════════════════════════════════
   CLOCK & TICKER
   ══════════════════════════════════════════════════════════ */
var Clock = {
  start: function () {
    function tick() {
      var el = document.getElementById('utc-clock');
      if (!el) return;
      var now = new Date();
      var pad = function(n){ return n < 10 ? '0'+n : n; };
      el.textContent = 'UTC ' + pad(now.getUTCHours()) + ':' + pad(now.getUTCMinutes()) + ':' + pad(now.getUTCSeconds());
    }
    tick();
    setInterval(tick, 1000);
  }
};

var Ticker = {
  init: function () {
    API.getArticles({ tab: '全部' }).then(function (arts) {
      var texts = arts.slice(0, 8).map(function (a) {
        return (a.alertLevel ? '【' + a.alertLevel + '】' : '★') + ' ' + a.title;
      });
      var el = document.getElementById('ticker-content');
      if (el) el.textContent = texts.join('　　　·　　　');
    }).catch(function(){});
  }
};

/* ══════════════════════════════════════════════════════════
   MAIN APP
   ══════════════════════════════════════════════════════════ */
var App = {

  refresh: function () {
    return Promise.all([
      App.renderTabs(),
      App.renderFeed(),
      App.renderSidebar(),
      App.renderStats()
    ]);
  },

  /* ── TABS ── */
  renderTabs: function () {
    return API.getTabs().then(function (tabs) {
      return API.getArticles({}).then(function (allArts) {
        var nav = document.getElementById('tabs-row');
        nav.innerHTML = '';
        tabs.forEach(function (t) {
          var count = t === '全部' ? allArts.length
            : allArts.filter(function(a){ return a.category === t; }).length;
          var btn = document.createElement('button');
          btn.className = 'tab-btn' + (State.currentTab === t ? ' active' : '');
          btn.innerHTML = t + (count > 0 ? '<span class="tab-pip">' + count + '</span>' : '');
          btn.addEventListener('click', function () { App.switchTab(t); });
          nav.appendChild(btn);
        });
      });
    });
  },

  switchTab: function (tab) {
    State.currentTab  = tab;
    State.searchQuery = '';
    var si = document.getElementById('search-input');
    if (si) si.value = '';
    App.renderTabs();
    App.renderFeed();
  },

  /* ── FEED ── */
  renderFeed: function () {
    var feedEl = document.getElementById('news-feed');
    feedEl.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-text">LOADING…</div></div>';

    return API.getArticles({ tab: State.currentTab, search: State.searchQuery })
      .then(function (arts) {
        // Sort: featured first → alert level → likes
        var alertOrder = { BREAKING:0, URGENT:1, EXCLUSIVE:2, ANALYSIS:3, '':4 };
        arts = arts.slice().sort(function (a, b) {
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          var ao = alertOrder[a.alertLevel||''] !== undefined ? alertOrder[a.alertLevel||''] : 4;
          var bo = alertOrder[b.alertLevel||''] !== undefined ? alertOrder[b.alertLevel||''] : 4;
          if (ao !== bo) return ao - bo;
          return b.likes - a.likes;
        });

        // Update feed header
        document.getElementById('feed-count').textContent =
          arts.length + ' 条战报' + (State.searchQuery ? ' · 搜索："' + State.searchQuery + '"' : '');
        document.getElementById('feed-label').textContent =
          State.currentTab === '全部' ? '// 全部战报' : '// ' + State.currentTab;

        // Recommendation banner
        App._renderRecBanner(arts);

        if (arts.length === 0) {
          feedEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📡</div><div class="empty-text">// NO SIGNAL — 暂无相关战报</div></div>';
          return;
        }

        feedEl.innerHTML = arts.map(function (a, i) { return Render.card(a, i); }).join('');
      })
      .catch(function (e) {
        console.error('[feed]', e);
        feedEl.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠</div><div class="empty-text">// LOAD ERROR — 加载失败</div></div>';
      });
  },

  _renderRecBanner: function (arts) {
    var banner = document.getElementById('rec-banner');
    API.getViewHistory().then(function (views) {
      if (!views || views.length < 3 || State.currentTab !== '全部') {
        banner.hidden = true;
        return;
      }
      var allArts = arts;
      var catCount = {};
      views.forEach(function (id) {
        var a = allArts.find(function(x){ return x.id === id; });
        if (a) catCount[a.category] = (catCount[a.category]||0) + 1;
      });
      var topCat = null, topN = 0;
      Object.keys(catCount).forEach(function(k){ if(catCount[k]>topN){ topN=catCount[k]; topCat=k; } });
      if (topCat) {
        document.getElementById('rec-text').textContent =
          '根据你的浏览记录，为你优先展示「' + topCat + '」相关战报';
        banner.hidden = false;
      } else {
        banner.hidden = true;
      }
    }).catch(function(){ banner.hidden = true; });
  },

  /* ── SIDEBAR ── */
  renderSidebar: function () {
    return API.getArticles({}).then(function (arts) {
      // Hot
      var sorted = arts.slice().sort(function(a,b){ return b.likes - a.likes; }).slice(0, 5);
      var hotEl = document.getElementById('hot-feed');
      hotEl.innerHTML = sorted.map(function (a, i) {
        var cls = i === 0 ? ' r1' : i === 1 ? ' r2' : i === 2 ? ' r3' : '';
        return '<div class="hot-item" data-id="' + a.id + '">' +
          '<div class="hot-rank' + cls + '">' + (i+1) + '</div>' +
          '<div><div class="hot-text">' + esc(a.title) + '</div>' +
          '<div class="hot-meta">♥ ' + a.likes + ' · ' + a.source + '</div></div>' +
          '</div>';
      }).join('');
      // Attach click
      hotEl.querySelectorAll('.hot-item').forEach(function(el){
        el.addEventListener('click', function(){ Article.open(el.dataset.id); });
      });

      // Cats
      return API.getTabs().then(function(tabs){
        var catsEl = document.getElementById('cats-body');
        catsEl.innerHTML = tabs.filter(function(t){ return t !== '全部'; }).map(function(t){
          var count = arts.filter(function(a){ return a.category === t; }).length;
          return '<div class="cat-item" data-tab="' + t + '">' +
            '<span class="cat-name">▸ ' + t + '</span>' +
            '<span class="cat-count">' + count + '</span>' +
            '</div>';
        }).join('');
        catsEl.querySelectorAll('.cat-item').forEach(function(el){
          el.addEventListener('click', function(){ App.switchTab(el.dataset.tab); });
        });
      });
    });
  },

  renderStats: function () {
    return API.getStats().then(function (s) {
      document.getElementById('s-articles').textContent = s.articles;
      document.getElementById('s-today').textContent    = s.today;
      document.getElementById('s-users').textContent    = s.users;
      document.getElementById('s-comments').textContent = s.comments;
    }).catch(function(){});
  },

  renderSaved: function () {
    var widget = document.getElementById('widget-saved');
    var feedEl = document.getElementById('saved-feed');
    if (!State.currentUser) { widget.hidden = true; return; }
    API.getUserSaves(State.currentUser.id).then(function(ids){
      State.userSaves = ids;
      if (!ids || ids.length === 0) { widget.hidden = true; return; }
      return API.getArticles({}).then(function(arts){
        var saved = ids.map(function(id){ return arts.find(function(a){ return a.id===id; }); }).filter(Boolean);
        if (saved.length === 0) { widget.hidden = true; return; }
        widget.hidden = false;
        feedEl.innerHTML = saved.map(function(a){
          return '<div class="saved-item" data-id="' + a.id + '">' +
            '<span class="saved-emoji">' + (a.emoji||'📰') + '</span>' +
            '<div><div class="saved-title">' + esc(a.title) + '</div>' +
            '<div class="saved-src">' + esc(a.source) + '</div></div>' +
            '</div>';
        }).join('');
        feedEl.querySelectorAll('.saved-item').forEach(function(el){
          el.addEventListener('click', function(){ Article.open(el.dataset.id); });
        });
      });
    }).catch(function(){ widget.hidden = true; });
  },

  openSaved: function () {
    Dialog.close('dlg-user');
    App.renderSaved();
    var w = document.getElementById('widget-saved');
    if (w && !w.hidden) w.scrollIntoView({ behavior: 'smooth' });
    Toast.show('已展开存档面板');
  }
};

/* ══════════════════════════════════════════════════════════
   CARD RENDERER
   ══════════════════════════════════════════════════════════ */
var Render = {
  card: function (a, i) {
    var liked = State.userLikes.indexOf(a.id) >= 0;
    var saved = State.userSaves.indexOf(a.id) >= 0;
    var isFeat = a.featured && i === 0 && State.currentTab === '全部' && !State.searchQuery;

    var tags = '<span class="tag tag-cat">' + a.category + '</span>';
    if (a.alertLevel) tags += '<span class="tag tag-alert-' + a.alertLevel + '">' + a.alertLevel + '</span>';
    if (isFeat) tags += '<span class="tag tag-featured">★ FEATURED</span>';
    tags += '<span class="tag-source">' + esc(a.source) + '</span>';
    tags += '<span class="tag-date">' + formatDate(a.date) + '</span>';

    return '<div class="news-card' + (isFeat ? ' is-featured' : '') + '" data-id="' + a.id + '">' +
      '<div class="card-inner">' +
      '<div class="card-icon">' + (a.emoji||'📰') + '</div>' +
      '<div class="card-body">' +
      '<div class="card-tags">' + tags + '</div>' +
      '<div class="card-title">' + esc(a.title) + '</div>' +
      (a.desc ? '<div class="card-desc">' + esc(a.desc) + '</div>' : '') +
      '<div class="card-actions">' +
      '<button class="act-btn' + (liked?' is-liked':'') + '" data-action="like" data-id="' + a.id + '">♥ <span>' + a.likes + '</span></button>' +
      '<button class="act-btn' + (saved?' is-saved':'') + '" data-action="save" data-id="' + a.id + '">◈ <span>' + (a.saves||0) + '</span></button>' +
      '<button class="act-btn" data-action="comment" data-id="' + a.id + '">💬 ' + (a.comments||[]).length + '</button>' +
      '<button class="act-btn act-btn-read" data-action="open" data-id="' + a.id + '">阅读 →</button>' +
      '</div>' +
      '</div></div></div>';
  }
};

/* Delegate card events */
document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-action]');
  if (!btn) return;
  e.stopPropagation();
  var action = btn.dataset.action;
  var id = btn.dataset.id;
  if (action === 'like')    Interactions.like(id, btn);
  if (action === 'save')    Interactions.save(id, btn);
  if (action === 'comment') Article.open(id, true);
  if (action === 'open')    Article.open(id);
});

/* ══════════════════════════════════════════════════════════
   INTERACTIONS
   ══════════════════════════════════════════════════════════ */
var Interactions = {
  like: function (id, btn) {
    if (!State.currentUser) { Toast.show('请先登录后再点赞', true); Dialog.open('dlg-login'); return; }
    API.toggleLike(id, State.currentUser.id).then(function (r) {
      var idx = State.userLikes.indexOf(id);
      if (r.liked) { if (idx < 0) State.userLikes.push(id); }
      else         { if (idx >= 0) State.userLikes.splice(idx, 1); }
      // Update all like buttons for this article
      document.querySelectorAll('[data-action="like"][data-id="' + id + '"]').forEach(function(b){
        b.className = 'act-btn' + (r.liked ? ' is-liked' : '');
        var s = b.querySelector('span');
        if (s) s.textContent = r.count;
      });
      // Update modal button if open
      var mb = document.getElementById('modal-like-' + id);
      if (mb) { mb.className = 'act-btn' + (r.liked ? ' is-liked' : ''); mb.querySelector('span').textContent = r.count; }
      Toast.show(r.liked ? '已点赞 ♥' : '已取消点赞');
    }).catch(function(e){ Toast.show('操作失败：' + (e.message||''), true); });
  },

  save: function (id, btn) {
    if (!State.currentUser) { Toast.show('请先登录后再收藏', true); Dialog.open('dlg-login'); return; }
    API.toggleSave(id, State.currentUser.id).then(function (r) {
      var idx = State.userSaves.indexOf(id);
      if (r.saved) { if (idx < 0) State.userSaves.push(id); }
      else         { if (idx >= 0) State.userSaves.splice(idx, 1); }
      document.querySelectorAll('[data-action="save"][data-id="' + id + '"]').forEach(function(b){
        b.className = 'act-btn' + (r.saved ? ' is-saved' : '');
        var s = b.querySelector('span');
        if (s) s.textContent = r.count;
      });
      var mb = document.getElementById('modal-save-' + id);
      if (mb) { mb.className = 'act-btn' + (r.saved ? ' is-saved' : ''); mb.querySelector('span').textContent = r.count; }
      App.renderSaved();
      Toast.show(r.saved ? '已存档 ◈' : '已取消存档');
    }).catch(function(e){ Toast.show('操作失败：' + (e.message||''), true); });
  }
};

/* ══════════════════════════════════════════════════════════
   ARTICLE DETAIL
   ══════════════════════════════════════════════════════════ */
var Article = {
  open: function (id, focusComment) {
    API.getArticle(id).then(function (a) {
      API.recordView(id);
      Article._render(a);
      Dialog.open('dlg-article');
      if (focusComment) {
        setTimeout(function(){
          var ta = document.getElementById('comment-ta');
          if (ta) ta.focus();
        }, 200);
      }
      // Refresh recommendation banner after viewing
      setTimeout(function(){ App.renderFeed(); }, 400);
    }).catch(function(){ Toast.show('加载失败', true); });
  },

  _render: function (a) {
    var liked = State.userLikes.indexOf(a.id) >= 0;
    var saved = State.userSaves.indexOf(a.id) >= 0;

    document.getElementById('art-dlg-label').textContent = '// ' + a.source + ' · ' + a.category;

    var tags = '';
    if (a.alertLevel) tags += '<span class="tag tag-alert-' + a.alertLevel + '">' + a.alertLevel + '</span>';
    if (a.featured)   tags += '<span class="tag tag-featured">★ FEATURED</span>';

    var commentsHtml;
    var cmts = a.comments || [];
    if (cmts.length === 0) {
      commentsHtml = '<div class="no-comments">// NO TRANSMISSIONS — 暂无评论</div>';
    } else {
      commentsHtml = cmts.map(function(c){
        return '<div class="comment-item">' +
          '<div class="comment-meta"><span class="comment-user">@' + esc(c.user) + '</span><span class="comment-time">' + formatDate(c.date) + '</span></div>' +
          '<div class="comment-body">' + esc(c.text) + '</div>' +
          '</div>';
      }).join('');
    }

    var commentArea = State.currentUser
      ? '<div class="comment-input-wrap">' +
        '<textarea id="comment-ta" placeholder="发表你的战场分析…（Ctrl+Enter发送）" onkeydown="Article.commentKey(event,\'' + a.id + '\')"></textarea>' +
        '<button class="btn-comment" onclick="Article.postComment(\'' + a.id + '\')">发送 ▶</button>' +
        '</div>'
      : '<div class="login-prompt"><a href="#" onclick="Dialog.close(\'dlg-article\');Dialog.open(\'dlg-login\')">登录</a> 后参与讨论</div>';

    document.getElementById('art-dlg-body').innerHTML =
      '<div class="art-source-row">' +
      '<span class="art-source-name">' + esc(a.source) + '</span>' + tags +
      '<span class="tag-date">' + formatDate(a.date) + '</span>' +
      '</div>' +
      '<div class="art-title">' + esc(a.title) + '</div>' +
      (a.desc ? '<div class="art-desc">' + esc(a.desc) + '</div>' : '') +
      '<div class="art-actions">' +
      '<a href="' + a.url + '" target="_blank" rel="noopener" class="btn-read">阅读原文 ↗</a>' +
      '<button class="act-btn' + (liked?' is-liked':'') + '" id="modal-like-' + a.id + '" onclick="Interactions.like(\'' + a.id + '\',this)">♥ <span>' + a.likes + '</span> 点赞</button>' +
      '<button class="act-btn' + (saved?' is-saved':'') + '" id="modal-save-' + a.id + '" onclick="Interactions.save(\'' + a.id + '\',this)">◈ <span>' + (a.saves||0) + '</span> 存档</button>' +
      '</div>' +
      '<div class="comments-section">' +
      '<div class="comments-head">// TRANSMISSIONS · 评论 (' + cmts.length + ')</div>' +
      commentArea +
      commentsHtml +
      '</div>';
  },

  commentKey: function (e, id) {
    if (e.ctrlKey && e.keyCode === 13) Article.postComment(id);
  },

  postComment: function (id) {
    if (!State.currentUser) return;
    var ta = document.getElementById('comment-ta');
    var text = ta ? ta.value.trim() : '';
    if (!text) { Toast.show('评论不能为空', true); return; }
    API.postComment(id, State.currentUser.id, State.currentUser.username, text)
      .then(function () {
        return API.getArticle(id).then(function(a){ Article._render(a); });
      })
      .then(function () {
        App.renderFeed();
        App.renderStats();
        Toast.show('评论已发布 ▶');
      })
      .catch(function(e){ Toast.show('发布失败：' + (e.message||''), true); });
  }
};

/* ══════════════════════════════════════════════════════════
   AUTH
   ══════════════════════════════════════════════════════════ */
var Auth = {
  renderHeader: function () {
    var area = document.getElementById('auth-area');
    if (!State.currentUser) {
      area.innerHTML =
        '<button class="btn-sm btn-sm-ghost" id="btn-login">登录</button>' +
        '<button class="btn-sm btn-sm-red" id="btn-signup">注册</button>';
      document.getElementById('btn-login').addEventListener('click', function(){ Dialog.open('dlg-login'); });
      document.getElementById('btn-signup').addEventListener('click', function(){ Dialog.open('dlg-signup'); });
    } else {
      var u = State.currentUser;
      var adminBtn = u.isAdmin
        ? '<button class="btn-sm btn-sm-admin" id="btn-admin">管理后台</button>'
        : '';
      area.innerHTML =
        adminBtn +
        '<button class="btn-sm btn-sm-ghost" id="btn-user-panel">' + u.username[0].toUpperCase() + '</button>';
      if (u.isAdmin) {
        document.getElementById('btn-admin').addEventListener('click', Admin.open);
      }
      document.getElementById('btn-user-panel').addEventListener('click', function(){
        document.getElementById('user-panel-info').innerHTML =
          '<strong>操作员：</strong>' + esc(u.username) + '<br>' +
          '<strong>邮&emsp;箱：</strong>' + esc(u.email) + '<br>' +
          '<strong>权&emsp;限：</strong>' + (u.isAdmin ? '管理员' : '普通用户') + '<br>' +
          '<strong>注册于：</strong>' + formatDate(u.joinDate);
        Dialog.open('dlg-user');
      });
    }
  },

  doLogin: function () {
    var email = document.getElementById('login-email').value.trim();
    var pw    = document.getElementById('login-password').value;
    var err   = document.getElementById('login-err');
    err.hidden = true;
    API.login(email, pw).then(function (r) {
      State.currentUser = r.user;
      return Promise.all([
        API.getUserLikes(r.user.id),
        API.getUserSaves(r.user.id)
      ]);
    }).then(function(results){
      State.userLikes = results[0];
      State.userSaves = results[1];
      Dialog.close('dlg-login');
      Auth.renderHeader();
      App.refresh();
      Toast.show('欢迎回来，' + State.currentUser.username);
    }).catch(function (e) {
      if (e.code === 'BAD_CREDENTIALS' || e.message) err.hidden = false;
    });
  },

  doSignup: function () {
    var uname = document.getElementById('signup-username').value.trim();
    var email = document.getElementById('signup-email').value.trim();
    var pw    = document.getElementById('signup-password').value;
    var err   = document.getElementById('signup-err');
    err.hidden = true;
    if (!uname || !email || !pw) { Toast.show('请填写所有字段', true); return; }
    if (pw.length < 6) { Toast.show('密码至少6位', true); return; }
    API.signup(uname, email, pw).then(function (r) {
      State.currentUser = r.user;
      State.userLikes = [];
      State.userSaves = [];
      Dialog.close('dlg-signup');
      Auth.renderHeader();
      App.refresh();
      Toast.show('欢迎加入，' + r.user.username + (r.user.isAdmin ? '（已设为管理员）' : '') + ' ✓');
    }).catch(function (e) {
      if (e.code === 'EMAIL_EXISTS') err.hidden = false;
      else Toast.show('注册失败', true);
    });
  },

  doLogout: function () {
    API.logout().then(function () {
      State.currentUser = null;
      State.userLikes = [];
      State.userSaves = [];
      Dialog.close('dlg-user');
      Auth.renderHeader();
      App.refresh();
      Toast.show('已安全退出');
    });
  }
};

/* ══════════════════════════════════════════════════════════
   ADMIN
   ══════════════════════════════════════════════════════════ */
var Admin = {
  open: function () {
    if (!State.currentUser || !State.currentUser.isAdmin) {
      Toast.show('权限不足', true); return;
    }
    Admin._refreshCatSelect();
    Admin.switchTab('publish');
    Dialog.open('dlg-admin');
  },

  switchTab: function (tab) {
    document.querySelectorAll('.admin-tab').forEach(function(btn){
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.atab-panel').forEach(function(panel){
      panel.hidden = panel.id !== 'atab-' + tab;
    });
    if (tab === 'manage') Admin._renderManage();
    if (tab === 'cats')   Admin._renderCats();
  },

  _refreshCatSelect: function () {
    API.getTabs().then(function(tabs){
      var sel = document.getElementById('pub-category');
      sel.innerHTML = tabs.filter(function(t){ return t !== '全部'; })
        .map(function(t){ return '<option value="' + t + '">' + t + '</option>'; }).join('');
    });
  },

  publish: function () {
    var title    = document.getElementById('pub-title').value.trim();
    var source   = document.getElementById('pub-source').value.trim();
    var url      = document.getElementById('pub-url').value.trim();
    var category = document.getElementById('pub-category').value;
    var desc     = document.getElementById('pub-desc').value.trim();
    var emoji    = document.getElementById('pub-emoji').value.trim() || '📡';
    var alert    = document.getElementById('pub-alert').value;
    var featured = document.getElementById('pub-featured').checked;

    if (!title || !source || !url || !category) {
      Toast.show('请填写所有必填项', true); return;
    }

    API.publishArticle({ title, source, url, category, desc, emoji,
                         alertLevel: alert, featured })
      .then(function () {
        ['pub-title','pub-source','pub-url','pub-desc','pub-emoji'].forEach(function(id){
          document.getElementById(id).value = '';
        });
        document.getElementById('pub-alert').value = '';
        document.getElementById('pub-featured').checked = false;
        Dialog.close('dlg-admin');
        App.refresh();
        Ticker.init();
        Toast.show('战报已发布 ✓');
      }).catch(function(e){ Toast.show('发布失败：' + (e.message||''), true); });
  },

  _renderManage: function () {
    API.getArticles({}).then(function(arts){
      var el = document.getElementById('manage-list');
      if (!arts.length) {
        el.innerHTML = '<div style="padding:20px;text-align:center;font-family:var(--mono);font-size:11px;color:var(--text-dim)">// EMPTY</div>';
        return;
      }
      el.innerHTML = arts.map(function(a){
        return '<div class="manage-row">' +
          '<div class="manage-title"><span class="manage-src">' + esc(a.source) + '</span>' + esc(a.title) + '</div>' +
          '<button class="btn-del" data-del-id="' + a.id + '">DELETE</button>' +
          '</div>';
      }).join('');
      el.querySelectorAll('[data-del-id]').forEach(function(btn){
        btn.addEventListener('click', function(){
          if (!confirm('确认删除这篇战报？')) return;
          API.deleteArticle(btn.dataset.delId).then(function(){
            App.refresh();
            Ticker.init();
            Admin._renderManage();
            Toast.show('已删除');
          });
        });
      });
    });
  },

  _renderCats: function () {
    API.getTabs().then(function(tabs){
      var el = document.getElementById('cats-manage-list');
      el.innerHTML = tabs.filter(function(t){ return t !== '全部'; }).map(function(t){
        return '<div class="manage-row">' +
          '<div class="manage-title">' + t + '</div>' +
          '<button class="btn-del" data-del-tab="' + t + '">DELETE</button>' +
          '</div>';
      }).join('');
      el.querySelectorAll('[data-del-tab]').forEach(function(btn){
        btn.addEventListener('click', function(){
          if (!confirm('删除分类「' + btn.dataset.delTab + '」？')) return;
          API.deleteTab(btn.dataset.delTab).then(function(){
            if (State.currentTab === btn.dataset.delTab) State.currentTab = '全部';
            App.refresh();
            Admin._renderCats();
            Admin._refreshCatSelect();
            Toast.show('分类已删除');
          });
        });
      });
    });
  }
};

/* ══════════════════════════════════════════════════════════
   DIALOG CONTROLLER
   ══════════════════════════════════════════════════════════ */
var Dialog = {
  initAll: function () {
    // Close buttons
    document.querySelectorAll('[data-close]').forEach(function(btn){
      btn.addEventListener('click', function(){ Dialog.close(btn.dataset.close); });
    });
    // Switch links
    document.querySelectorAll('[data-open]').forEach(function(a){
      a.addEventListener('click', function(e){
        e.preventDefault();
        if (a.dataset.closeFrom) Dialog.close(a.dataset.closeFrom);
        Dialog.open(a.dataset.open);
      });
    });
    // Backdrop
    var bd = document.getElementById('backdrop');
    bd.addEventListener('click', Dialog.closeAll);
    // Admin tab buttons
    document.querySelectorAll('.admin-tab').forEach(function(btn){
      btn.addEventListener('click', function(){ Admin.switchTab(btn.dataset.tab); });
    });
    // Auth buttons
    document.getElementById('btn-do-login').addEventListener('click', Auth.doLogin);
    document.getElementById('btn-do-signup').addEventListener('click', Auth.doSignup);
    document.getElementById('btn-logout').addEventListener('click', Auth.doLogout);
    document.getElementById('btn-publish').addEventListener('click', Admin.publish);
    // Add cat
    document.getElementById('btn-add-cat').addEventListener('click', function(){
      var inp = document.getElementById('new-cat');
      var name = inp.value.trim();
      if (!name) return;
      API.addTab(name).then(function(){
        inp.value = '';
        App.refresh();
        Admin._renderCats();
        Admin._refreshCatSelect();
        Toast.show('分类「' + name + '」已添加');
      }).catch(function(e){
        Toast.show(e.code === 'TAB_EXISTS' ? '该分类已存在' : '操作失败', true);
      });
    });
    // Search
    document.getElementById('search-input').addEventListener('input', function(){
      State.searchQuery = this.value.trim();
      App.renderFeed();
    });
    document.getElementById('search-btn').addEventListener('click', function(){
      State.searchQuery = document.getElementById('search-input').value.trim();
      App.renderFeed();
    });
    // Keyboard
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') Dialog.closeAll();
    });
  },

  open: function (id) {
    var dlg = document.getElementById(id);
    if (!dlg) return;
    // Close any other open dialogs first
    document.querySelectorAll('.dialog.is-open').forEach(function(d){
      if (d.id !== id) d.classList.remove('is-open');
    });
    document.getElementById('backdrop').hidden = false;
    dlg.classList.add('is-open');
  },

  close: function (id) {
    var dlg = document.getElementById(id);
    if (dlg) dlg.classList.remove('is-open');
    if (!document.querySelector('.dialog.is-open')) {
      document.getElementById('backdrop').hidden = true;
    }
  },

  closeAll: function () {
    document.querySelectorAll('.dialog.is-open').forEach(function(d){ d.classList.remove('is-open'); });
    document.getElementById('backdrop').hidden = true;
  }
};

/* ══════════════════════════════════════════════════════════
   TOAST
   ══════════════════════════════════════════════════════════ */
var Toast = {
  show: function (msg, isErr) {
    var box = document.getElementById('toast-container');
    var el = document.createElement('div');
    el.className = 'toast' + (isErr ? ' err' : '');
    el.textContent = msg;
    box.appendChild(el);
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ el.classList.add('show'); }); });
    setTimeout(function(){
      el.classList.remove('show');
      setTimeout(function(){ if (el.parentNode) el.parentNode.removeChild(el); }, 250);
    }, 2800);
  }
};

/* ══════════════════════════════════════════════════════════
   UTILITIES
   ══════════════════════════════════════════════════════════ */
function esc(s) {
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
  if (diff < 60)    return '刚刚';
  if (diff < 3600)  return Math.floor(diff / 60)   + '分钟前';
  if (diff < 86400) return Math.floor(diff / 3600)  + '小时前';
  if (diff < 604800)return Math.floor(diff / 86400) + '天前';
  var pad = function(n){ return n<10?'0'+n:n; };
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth()+1) + '-' + pad(d.getUTCDate());
}
