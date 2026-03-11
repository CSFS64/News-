/**
 * FRONTLINE · mobile.js
 * Standalone mobile controller — only runs on ≤700px screens.
 * Reads from the same State / API / Dialog objects as app.js,
 * but handles its own pages, navigation, and article detail.
 */

/* ════════════════════════════════════════════════════════
   MOBILE CONTROLLER
════════════════════════════════════════════════════════ */
var Mobile = {

  /* ── internal state ── */
  _active: null,          // 'home' | 'following' | 'notif' | 'me'
  _articleId: null,       // currently open article
  _replyParentId: null,
  _replyParentUser: null,

  /* ── is this a mobile viewport? ── */
  isMobile: function () { return window.innerWidth <= 700; },

  /* ── bootstrap ── */
  init: function () {
    if (!Mobile.isMobile()) return;

    Mobile._buildTopBar();
    Mobile._buildNav();
    Mobile._buildArticlePage();
    Mobile._bindSearch();
    Mobile._syncTabs();
    Mobile._setActive('home');

    // Keep tabs in sync when desktop tabs re-render
    var desktopTabs = document.getElementById('tabs-row');
    if (desktopTabs) {
      new MutationObserver(Mobile._syncTabs).observe(desktopTabs, { childList: true });
    }

    // Hook into auth changes to update nav avatar
    var _orig = Auth.renderHeader.bind(Auth);
    Auth.renderHeader = function () {
      _orig();
      setTimeout(function () {
        Mobile._updateMeIcon();
        Mobile._syncBadge();
      }, 60);
    };
  },

  /* ── Build top bar HTML (replaces masthead on mobile) ── */
  _buildTopBar: function () {
    var hdr = document.getElementById('mobile-header');
    if (!hdr) return;
    hdr.innerHTML =
      '<div id="m-search-row">' +
        '<div id="m-search-box">' +
          '<span id="m-search-icon">⌕</span>' +
          '<input id="m-search-input" type="search" placeholder="搜索战报…" autocomplete="off" />' +
        '</div>' +
        '<button id="m-search-cancel">取消</button>' +
      '</div>' +
      '<div id="m-tabs-row"></div>';
  },

  /* ── Build bottom nav ── */
  _buildNav: function () {
    var nav = document.getElementById('mobile-nav');
    if (!nav) return;
    nav.innerHTML =
      '<button class="mnav-btn m-active" id="mnav-home" onclick="Mobile.go(\'home\')">' +
        '<span class="mnav-icon">⌂</span>' +
        '<span class="mnav-label">首页</span>' +
      '</button>' +
      '<button class="mnav-btn" id="mnav-following" onclick="Mobile.go(\'following\')">' +
        '<span class="mnav-icon">◉</span>' +
        '<span class="mnav-label">关注</span>' +
      '</button>' +
      '<button class="mnav-btn mnav-pub" onclick="Mobile.publish()">' +
        '<div class="mnav-pub-pill">＋</div>' +
      '</button>' +
      '<button class="mnav-btn" id="mnav-notif" onclick="Mobile.go(\'notif\')">' +
        '<span class="mnav-icon">◎</span>' +
        '<span class="mnav-label">通知</span>' +
        '<span class="mnav-badge" id="mnav-badge" hidden></span>' +
      '</button>' +
      '<button class="mnav-btn" id="mnav-me" onclick="Mobile.go(\'me\')">' +
        '<span class="mnav-icon" id="mnav-me-icon">◈</span>' +
        '<span class="mnav-label">我的</span>' +
      '</button>';
  },

  /* ── Build full-screen article page DOM (if not already in HTML) ── */
  _buildArticlePage: function () {
    if (document.getElementById('m-article-page')) return;
    var el = document.createElement('div');
    el.id = 'm-article-page';
    el.innerHTML =
      '<div id="m-article-topbar">' +
        '<button id="m-article-back" onclick="Mobile.closeArticle()">←</button>' +
        '<span id="m-article-label"></span>' +
      '</div>' +
      '<div id="m-article-body"></div>';
    document.body.appendChild(el);

    var bar = document.createElement('div');
    bar.id = 'm-comment-bar';
    bar.innerHTML =
      '<div id="m-reply-banner">' +
        '<span id="m-reply-label"></span>' +
        '<button id="m-reply-cancel" onclick="Mobile._cancelReply()">✕ 取消</button>' +
      '</div>' +
      '<div id="m-comment-row">' +
        '<textarea id="m-comment-ta" placeholder="发表评论…" rows="1"></textarea>' +
        '<button id="m-comment-send" onclick="Mobile.sendComment()">发送</button>' +
      '</div>';
    document.body.appendChild(bar);

    // Auto-show/hide comment bar with article page
    var ta = bar.querySelector('#m-comment-ta');
    if (ta) {
      ta.addEventListener('input', function () {
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 100) + 'px';
      });
    }
  },

  /* ── Sync tabs from desktop tabs-row into mobile #m-tabs-row ── */
  _syncTabs: function () {
    var mRow = document.getElementById('m-tabs-row');
    var dRow = document.getElementById('tabs-row');
    if (!mRow || !dRow) return;
    mRow.innerHTML = '';
    dRow.querySelectorAll('.tab-btn').forEach(function (btn) {
      var tab = btn.dataset.tab || btn.textContent.replace(/\d+/g, '').trim();
      var isFeed = btn.dataset.feed === 'following';
      var clone = document.createElement('button');
      clone.className = 'tab-btn m-tab' + (btn.classList.contains('active') ? ' active' : '');
      clone.textContent = btn.textContent;
      clone.addEventListener('click', function () {
        // Close any open page, go back to feed
        Mobile._showPage(null);
        Mobile._setActive('home');
        if (isFeed) {
          App.switchFeed('following');
        } else {
          App.switchTab(tab);
        }
        // Sync active on mobile tabs
        mRow.querySelectorAll('.m-tab').forEach(function (b) { b.classList.remove('active'); });
        clone.classList.add('active');
        // Clear search
        var inp = document.getElementById('m-search-input');
        if (inp) inp.value = '';
        var hdr = document.getElementById('mobile-header');
        if (hdr) hdr.classList.remove('m-searching');
      });
      mRow.appendChild(clone);
    });
  },

  /* ── Search bindings ── */
  _bindSearch: function () {
    var inp = document.getElementById('m-search-input');
    var cancel = document.getElementById('m-search-cancel');
    var hdr = document.getElementById('mobile-header');
    if (!inp) return;
    var timer = null;
    inp.addEventListener('focus', function () { hdr && hdr.classList.add('m-searching'); });
    inp.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        State.searchQuery = inp.value.trim();
        Mobile._showPage(null);
        Mobile._setActive('home');
        App.loadFeed ? App.loadFeed() : App.renderFeed();
      }, 350);
    });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        clearTimeout(timer);
        State.searchQuery = inp.value.trim();
        Mobile._showPage(null);
        Mobile._setActive('home');
        App.loadFeed ? App.loadFeed() : App.renderFeed();
        inp.blur();
      }
    });
    if (cancel) {
      cancel.addEventListener('click', function () {
        inp.value = '';
        State.searchQuery = '';
        hdr && hdr.classList.remove('m-searching');
        inp.blur();
        App.loadFeed ? App.loadFeed() : App.renderFeed();
      });
    }
  },

  /* ── Show/hide full-screen pages (关注/通知/我的) ── */
  _showPage: function (pageId) {
    ['m-page-following', 'm-page-notif', 'm-page-me'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.toggle('m-page-open', id === pageId);
    });
    // Show/hide feed + topbar
    var feed = document.getElementById('layout');
    var hdr  = document.getElementById('mobile-header');
    var show = !pageId;
    if (feed) feed.style.display = show ? '' : 'none';
    if (hdr)  hdr.style.display  = show ? '' : 'none';
  },

  /* ── Set active nav button ── */
  _setActive: function (tab) {
    ['home', 'following', 'notif', 'me'].forEach(function (t) {
      var el = document.getElementById('mnav-' + t);
      if (el) el.classList.toggle('m-active', t === tab);
    });
    Mobile._active = tab;
  },

  /* ── Update me icon ── */
  _updateMeIcon: function () {
    var icon = document.getElementById('mnav-me-icon');
    if (!icon) return;
    if (State.currentUser) {
      icon.textContent = State.currentUser.username[0].toUpperCase();
      icon.className = 'mnav-icon has-user';
    } else {
      icon.textContent = '◈';
      icon.className = 'mnav-icon';
    }
    // Refresh me page if open
    if (Mobile._active === 'me') Mobile._loadMePage();
  },

  /* ── Sync notification badge ── */
  _syncBadge: function () {
    var hBadge = document.getElementById('notif-badge');
    var mBadge = document.getElementById('mnav-badge');
    if (!mBadge) return;
    if (hBadge && !hBadge.hidden && hBadge.textContent) {
      mBadge.textContent = hBadge.textContent;
      mBadge.removeAttribute('hidden');
    } else {
      mBadge.setAttribute('hidden', '');
    }
  },

  /* ═══════════════════════════════════════════════════════
     NAVIGATION
  ═══════════════════════════════════════════════════════ */
  go: function (tab) {
    if (!Mobile.isMobile()) return;

    // Close article if open
    if (document.getElementById('m-article-page') &&
        document.getElementById('m-article-page').classList.contains('m-page-open')) {
      Mobile.closeArticle();
    }

    Mobile._setActive(tab);

    if (tab === 'home') {
      Mobile._showPage(null);

    } else if (tab === 'following') {
      Mobile._showPage('m-page-following');
      Mobile._loadFollowingPage();

    } else if (tab === 'notif') {
      Mobile._showPage('m-page-notif');
      Mobile._loadNotifPage();
      var mBadge = document.getElementById('mnav-badge');
      if (mBadge) mBadge.setAttribute('hidden', '');

    } else if (tab === 'me') {
      if (!State.currentUser) {
        Dialog.open('dlg-login');
        Mobile._setActive('home');
        return;
      }
      Mobile._showPage('m-page-me');
      Mobile._loadMePage();
    }
  },

  publish: function () {
    if (!State.currentUser) { Toast.show('请先登录', true); Dialog.open('dlg-login'); return; }
    if (State.currentUser.isAdmin) { Dialog.open('dlg-admin'); Admin.switchTab('publish'); }
    else { Dialog.open('dlg-publish'); }
  },

  /* ═══════════════════════════════════════════════════════
     PAGE LOADERS — ensure the page divs exist before loading
  ═══════════════════════════════════════════════════════ */
  _ensurePage: function (id, title, actionHtml, bodyId) {
    var existing = document.getElementById(id);
    if (existing) return existing.querySelector('#' + bodyId);
    var page = document.createElement('div');
    page.id = id; page.className = 'm-page';
    page.innerHTML =
      '<div class="m-page-hd">' +
        '<span class="m-page-title">' + title + '</span>' +
        (actionHtml || '') +
      '</div>' +
      '<div class="m-page-body" id="' + bodyId + '"></div>';
    document.body.appendChild(page);
    return page.querySelector('#' + bodyId);
  },

  /* ── 关注 page ── */
  _loadFollowingPage: function () {
    var body = Mobile._ensurePage('m-page-following', '// 关注动态', '', 'm-following-body');
    if (!body) return;
    if (!State.currentUser) {
      body.innerHTML = '<div class="m-login-prompt"><p>登录后查看关注动态</p><button class="btn-primary" onclick="Dialog.open(\'dlg-login\')">立即登录</button></div>';
      return;
    }
    body.innerHTML = '<div class="m-empty">加载中…</div>';
    API.getArticles({ feed: 'following', userId: State.currentUser.id }).then(function (arts) {
      if (!arts || !arts.length) {
        body.innerHTML = '<div class="m-empty">还没有关注任何人，去发现有趣的用户吧</div>';
        return;
      }
      body.innerHTML = arts.map(function (a) { return Mobile._cardHTML(a); }).join('');
      // Bind card clicks
      body.querySelectorAll('.m-card').forEach(function (el) {
        el.addEventListener('click', function () { Mobile.openArticle(el.dataset.id); });
      });
    }).catch(function () {
      body.innerHTML = '<div class="m-empty">加载失败，请稍后重试</div>';
    });
  },

  /* ── 通知 page ── */
  _loadNotifPage: function () {
    var readAllBtn = '<button class="m-page-action" id="m-notif-readall">全部已读</button>';
    var body = Mobile._ensurePage('m-page-notif', '// 通知中心', readAllBtn, 'm-notif-body');
    if (!body) return;

    var readAll = document.getElementById('m-notif-readall');
    if (readAll && !readAll._bound) {
      readAll._bound = true;
      readAll.addEventListener('click', function () {
        if (!State.currentUser) return;
        API.markAllNotificationsRead && API.markAllNotificationsRead(State.currentUser.id)
          .then(function () { Mobile._loadNotifPage(); });
      });
    }

    if (!State.currentUser) {
      body.innerHTML = '<div class="m-login-prompt"><p>登录后查看通知</p><button class="btn-primary" onclick="Dialog.open(\'dlg-login\')">立即登录</button></div>';
      return;
    }
    body.innerHTML = '<div class="m-empty">加载中…</div>';
    API.getNotifications(State.currentUser.id).then(function (notifs) {
      API.markNotificationsRead && API.markNotificationsRead(State.currentUser.id);
      var mBadge = document.getElementById('mnav-badge');
      if (mBadge) mBadge.setAttribute('hidden', '');
      if (!notifs || !notifs.length) {
        body.innerHTML = '<div class="m-empty">// 暂无通知</div>';
        return;
      }
      var typeLabel = {
        follow: '关注了你', comment: '评论了你的文章',
        reply: '回复了你的评论', like: '点赞了你的文章',
        like_article: '点赞了你的文章', like_comment: '点赞了你的评论',
        save: '收藏了你的文章', comment_like: '点赞了你的评论'
      };
      body.innerHTML = notifs.map(function (n) {
        var label = typeLabel[n.type] || n.type;
        var link = n.articleId
          ? '<button class="m-notif-link" data-aid="' + n.articleId + '" data-cmt="' + (n.commentId || '') + '">查看 →</button>'
          : '';
        return '<div class="m-notif-item' + (n.isRead ? '' : ' m-unread') + '">' +
          '<div class="m-notif-meta">' +
          '<span class="m-notif-actor" data-uid="' + n.actorId + '">' + esc(n.actorName) + '</span>' +
          '<span class="m-notif-action">' + label + '</span>' +
          '<span class="m-notif-time">' + formatDate(n.createdAt || n.date) + '</span>' +
          '</div>' +
          (n.preview ? '<div class="m-notif-preview">' + esc(n.preview) + '</div>' : '') +
          (link ? '<div style="margin-top:4px">' + link + '</div>' : '') +
          '</div>';
      }).join('');
      // Bind clicks
      body.querySelectorAll('.m-notif-actor').forEach(function (el) {
        el.addEventListener('click', function () { Profile.open(el.dataset.uid); });
      });
      body.querySelectorAll('.m-notif-link').forEach(function (el) {
        el.addEventListener('click', function () {
          Mobile.openArticle(el.dataset.aid, !!el.dataset.cmt);
        });
      });
    }).catch(function () {
      body.innerHTML = '<div class="m-empty">加载失败</div>';
    });
  },

  /* ── 我的 page ── */
  _loadMePage: function () {
    Mobile._ensurePage('m-page-me', '// 我的', '', 'm-me-body-wrap');
    var page = document.getElementById('m-page-me');
    if (!page) return;

    // Rebuild page interior
    if (!page._built) {
      page._built = true;
      var hd = page.querySelector('.m-page-hd');
      var logoutBtn = document.createElement('button');
      logoutBtn.className = 'm-page-action'; logoutBtn.id = 'm-logout-btn';
      logoutBtn.textContent = '退出';
      logoutBtn.addEventListener('click', function () { Auth.logout(); Mobile.go('home'); });
      if (hd) hd.appendChild(logoutBtn);

      var body = page.querySelector('.m-page-body');
      body.innerHTML =
        '<div id="m-me-header"></div>' +
        '<div id="m-me-tabs">' +
          '<button class="m-me-tab active" data-tab="articles">文章</button>' +
          '<button class="m-me-tab" data-tab="comments">评论</button>' +
          '<button class="m-me-tab" data-tab="saved">收藏</button>' +
        '</div>' +
        '<div id="m-me-body"></div>';

      page.querySelectorAll('.m-me-tab').forEach(function (btn) {
        btn.addEventListener('click', function () {
          page.querySelectorAll('.m-me-tab').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          Mobile._loadMeTab(btn.dataset.tab);
        });
      });
    }

    if (!State.currentUser) {
      var header = document.getElementById('m-me-header');
      if (header) header.innerHTML = '<div class="m-login-prompt"><p>登录后查看个人主页</p><button class="btn-primary" onclick="Dialog.open(\'dlg-login\')">立即登录</button></div>';
      var logoutBtn = document.getElementById('m-logout-btn');
      if (logoutBtn) logoutBtn.style.display = 'none';
      return;
    }

    var u = State.currentUser;
    var logoutBtn = document.getElementById('m-logout-btn');
    if (logoutBtn) logoutBtn.style.display = '';

    API.getFollowStats(u.id).then(function (stats) {
      var header = document.getElementById('m-me-header');
      if (!header) return;
      header.innerHTML =
        '<div class="m-me-avatar">' + u.username[0].toUpperCase() + '</div>' +
        '<div>' +
          '<div class="m-me-name">' + esc(u.username) + '</div>' +
          '<div class="m-me-sub">' + esc(u.email) + (u.isAdmin ? ' · 管理员' : '') + '</div>' +
          '<div class="m-me-stats">' +
            '<span class="m-me-stat"><strong>' + (stats.followers || 0) + '</strong> 粉丝</span>' +
            '<span class="m-me-stat"><strong>' + (stats.following || 0) + '</strong> 关注</span>' +
          '</div>' +
        '</div>';
    }).catch(function () {
      var header = document.getElementById('m-me-header');
      if (header) header.innerHTML =
        '<div class="m-me-avatar">' + u.username[0].toUpperCase() + '</div>' +
        '<div><div class="m-me-name">' + esc(u.username) + '</div></div>';
    });

    Mobile._loadMeTab('articles');
    // Reset tab active state
    var page2 = document.getElementById('m-page-me');
    if (page2) {
      page2.querySelectorAll('.m-me-tab').forEach(function (b) {
        b.classList.toggle('active', b.dataset.tab === 'articles');
      });
    }
  },

  _loadMeTab: function (tab) {
    var body = document.getElementById('m-me-body');
    if (!body || !State.currentUser) return;
    body.innerHTML = '<div class="m-empty">加载中…</div>';

    if (tab === 'articles') {
      API.getProfileArticles(State.currentUser.id).then(function (arts) {
        if (!arts || !arts.length) { body.innerHTML = '<div class="m-empty">暂无发布内容</div>'; return; }
        body.innerHTML = arts.map(function (a) {
          return '<div class="m-profile-card" data-id="' + a.id + '">' +
            '<span class="m-profile-card-emoji">' + (a.emoji || '📰') + '</span>' +
            '<div class="m-profile-card-body">' +
              '<div class="m-profile-card-title">' + esc(a.title) + '</div>' +
              '<div class="m-profile-card-sub">' + esc(a.source) + ' · ' + formatDate(a.date) + ' · ♥ ' + a.likes + '</div>' +
              (a.desc ? '<div class="m-profile-card-preview">' + esc(a.desc) + '</div>' : '') +
            '</div>' +
            '<button class="m-profile-del" data-id="' + a.id + '">删除</button>' +
          '</div>';
        }).join('');
        body.querySelectorAll('.m-profile-card').forEach(function (el) {
          el.addEventListener('click', function (e) {
            if (e.target.classList.contains('m-profile-del')) return;
            Mobile.openArticle(el.dataset.id);
          });
        });
        body.querySelectorAll('.m-profile-del').forEach(function (btn) {
          btn.addEventListener('click', function () {
            if (!confirm('确认删除这篇文章？')) return;
            API.deleteArticle(btn.dataset.id).then(function () {
              btn.closest('.m-profile-card').remove();
              App.renderFeed(); Toast.show('文章已删除');
            }).catch(function () { Toast.show('删除失败', true); });
          });
        });
      }).catch(function () { body.innerHTML = '<div class="m-empty">加载失败</div>'; });

    } else if (tab === 'comments') {
      API.getProfileComments(State.currentUser.id).then(function (cmts) {
        if (!cmts || !cmts.length) { body.innerHTML = '<div class="m-empty">暂无评论记录</div>'; return; }
        body.innerHTML = cmts.map(function (c) {
          return '<div class="m-profile-card" data-aid="' + c.articleId + '" data-id="' + c.id + '">' +
            '<span class="m-profile-card-emoji">💬</span>' +
            '<div class="m-profile-card-body">' +
              '<div class="m-profile-card-sub">' + (c.parentId ? '回复 @' + esc(c.parentUsername || '') : '评论了《' + esc(c.articleTitle) + '》') + '</div>' +
              '<div class="m-profile-card-preview">' + esc(c.text) + '</div>' +
              '<div class="m-profile-card-sub" style="margin-top:4px">' + formatDate(c.date) + '</div>' +
            '</div>' +
            '<button class="m-profile-del" data-id="' + c.id + '" data-aid="' + c.articleId + '">删除</button>' +
          '</div>';
        }).join('');
        body.querySelectorAll('.m-profile-card').forEach(function (el) {
          el.addEventListener('click', function (e) {
            if (e.target.classList.contains('m-profile-del')) return;
            Mobile.openArticle(el.dataset.aid);
          });
        });
        body.querySelectorAll('.m-profile-del').forEach(function (btn) {
          btn.addEventListener('click', function () {
            if (!confirm('确认删除这条评论？')) return;
            var aid = btn.dataset.aid, cid = btn.dataset.id;
            fetch((typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://frontline-backend.20060303jjc.workers.dev') +
              '/articles/' + aid + '/comments/' + cid, {
              method: 'DELETE',
              headers: { Authorization: 'Bearer ' + (window._fl_token || '') }
            }).then(function (r) {
              if (!r.ok) throw new Error();
              btn.closest('.m-profile-card').remove();
              Toast.show('评论已删除');
            }).catch(function () { Toast.show('删除失败', true); });
          });
        });
      }).catch(function () { body.innerHTML = '<div class="m-empty">加载失败</div>'; });

    } else if (tab === 'saved') {
      API.getUserSaves(State.currentUser.id).then(function (ids) {
        if (!ids || !ids.length) { body.innerHTML = '<div class="m-empty">暂无收藏</div>'; return; }
        return API.getArticles({}).then(function (arts) {
          var saved = ids.map(function (id) {
            return (arts || []).find(function (a) { return a.id === id; });
          }).filter(Boolean);
          if (!saved.length) { body.innerHTML = '<div class="m-empty">暂无收藏</div>'; return; }
          body.innerHTML = saved.map(function (a) {
            return '<div class="m-profile-card" data-id="' + a.id + '">' +
              '<span class="m-profile-card-emoji">' + (a.emoji || '📰') + '</span>' +
              '<div class="m-profile-card-body">' +
                '<div class="m-profile-card-title">' + esc(a.title) + '</div>' +
                '<div class="m-profile-card-sub">' + esc(a.source) + '</div>' +
                (a.desc ? '<div class="m-profile-card-preview">' + esc(a.desc) + '</div>' : '') +
              '</div>' +
              '<button class="m-profile-del" data-id="' + a.id + '">取消</button>' +
            '</div>';
          }).join('');
          body.querySelectorAll('.m-profile-card').forEach(function (el) {
            el.addEventListener('click', function (e) {
              if (e.target.classList.contains('m-profile-del')) return;
              Mobile.openArticle(el.dataset.id);
            });
          });
          body.querySelectorAll('.m-profile-del').forEach(function (btn) {
            btn.addEventListener('click', function () {
              API.toggleSave(btn.dataset.id).then(function () {
                btn.closest('.m-profile-card').remove();
                App.renderFeed(); Toast.show('已取消收藏');
              }).catch(function () { Toast.show('操作失败', true); });
            });
          });
        });
      }).catch(function () { body.innerHTML = '<div class="m-empty">加载失败</div>'; });
    }
  },

  /* ── Mini card HTML for following feed ── */
  _cardHTML: function (a) {
    var liked = State.userLikes.indexOf(a.id) >= 0;
    var saved = State.userSaves.indexOf(a.id) >= 0;
    var tags = '';
    if (a.alertLevel) tags += '<span class="tag tag-alert-' + a.alertLevel + '">' + a.alertLevel + '</span>';
    if (a.featured)   tags += '<span class="tag tag-featured">★ FEATURED</span>';
    return '<div class="news-card m-card" data-id="' + a.id + '">' +
      '<div class="card-body">' +
        (tags ? '<div class="card-tags">' + tags + '</div>' : '') +
        '<div class="card-title">' + esc(a.title) + '</div>' +
        (a.desc ? '<div class="card-desc">' + esc(a.desc) + '</div>' : '') +
        '<div class="card-meta"><span class="card-src">' + esc(a.source) + '</span><span class="card-time">' + formatDate(a.date) + '</span></div>' +
      '</div>' +
      '<div class="card-actions">' +
        '<button class="act-btn' + (liked ? ' is-liked' : '') + '">♥ ' + a.likes + '</button>' +
        '<button class="act-btn' + (saved ? ' is-saved' : '') + '">◈ ' + (a.saves || 0) + '</button>' +
        '<span class="act-btn">💬 ' + (a.commentsCount || 0) + '</span>' +
        '<button class="act-btn-read">阅读 →</button>' +
      '</div>' +
    '</div>';
  },

  /* ═══════════════════════════════════════════════════════
     ARTICLE DETAIL PAGE
  ═══════════════════════════════════════════════════════ */
  openArticle: function (id, focusComment) {
    Mobile._articleId = id;
    Mobile._replyParentId = null;
    Mobile._replyParentUser = null;

    var page = document.getElementById('m-article-page');
    var body = document.getElementById('m-article-body');
    var bar  = document.getElementById('m-comment-bar');
    if (!page || !body) return;

    body.innerHTML = '<div class="m-empty">加载中…</div>';
    page.classList.add('m-page-open');
    if (bar) bar.style.display = State.currentUser ? 'block' : 'none';

    API.getArticle(id).then(function (a) {
      API.recordView && API.recordView(id);
      Mobile._renderArticle(a);
      if (focusComment) {
        setTimeout(function () {
          var ta = document.getElementById('m-comment-ta');
          if (ta) ta.focus();
        }, 200);
      }
    }).catch(function () {
      body.innerHTML = '<div class="m-empty">加载失败</div>';
    });
  },

  _renderArticle: function (a) {
    var liked = State.userLikes.indexOf(a.id) >= 0;
    var saved = State.userSaves.indexOf(a.id) >= 0;
    var label = document.getElementById('m-article-label');
    if (label) label.textContent = '// ' + a.source + ' · ' + (a.category || '');

    var tags = '';
    if (a.alertLevel) tags += '<span class="tag tag-alert-' + a.alertLevel + '">' + a.alertLevel + '</span>';
    if (a.featured)   tags += '<span class="tag tag-featured">★ FEATURED</span>';

    var body = document.getElementById('m-article-body');
    body.innerHTML =
      (tags ? '<div class="m-art-tags">' + tags + '</div>' : '') +
      '<div class="m-art-title">' + esc(a.title) + '</div>' +
      (a.desc ? '<div class="m-art-desc">' + esc(a.desc) + '</div>' : '') +
      '<div class="m-art-meta">' +
        '<span>' + esc(a.source) + '</span>' +
        '<span>' + formatDate(a.date) + '</span>' +
        (a.authorId ? '<span class="m-art-meta-author" data-uid="' + a.authorId + '">@' + esc(a.authorName || '匿名') + '</span>' : '') +
      '</div>' +
      '<div class="m-art-actions">' +
        '<a class="m-art-read-btn" href="' + (a.url || '#') + '" target="_blank" rel="noopener">阅读原文 ↗</a>' +
        '<button class="m-art-act-btn' + (liked ? ' is-liked' : '') + '" id="m-like-btn" data-id="' + a.id + '">♥ <span>' + a.likes + '</span></button>' +
        '<button class="m-art-act-btn' + (saved ? ' is-saved' : '') + '" id="m-save-btn" data-id="' + a.id + '">◈ <span>' + (a.saves || 0) + '</span></button>' +
      '</div>' +
      '<div class="m-comments-head">// 评论 · ' + ((a.comments || []).length) + ' 条</div>' +
      '<div id="m-comment-list">' + Mobile._renderComments(a.comments || [], a.id) + '</div>';

    // Bind like/save
    var likeBtn = document.getElementById('m-like-btn');
    var saveBtn = document.getElementById('m-save-btn');
    if (likeBtn) likeBtn.addEventListener('click', function () { Mobile._toggleLike(a.id, likeBtn); });
    if (saveBtn) saveBtn.addEventListener('click', function () { Mobile._toggleSave(a.id, saveBtn); });

    // Bind author
    body.querySelectorAll('.m-art-meta-author').forEach(function (el) {
      el.addEventListener('click', function () { Profile.open(el.dataset.uid); });
    });

    // Bind comment likes & reply buttons
    Mobile._bindCommentActions(body, a.id);

    // Reset comment bar
    var ta = document.getElementById('m-comment-ta');
    if (ta) { ta.value = ''; ta.style.height = 'auto'; }
    Mobile._cancelReply();
  },

  _renderComments: function (comments, articleId) {
    if (!comments || !comments.length) return '<div class="m-empty">暂无评论</div>';
    return comments.map(function (c) {
      var indent = c.parentId ? 'margin-left:20px;' : '';
      var replyPrefix = c.parentId && c.parentUsername
        ? '<div class="m-reply-prefix">回复 @' + esc(c.parentUsername) + '</div>' : '';
      var replyBtn = State.currentUser
        ? '<button class="m-comment-reply-btn" data-uid="' + c.userId + '" data-id="' + c.id + '" data-user="' + esc(c.user) + '">回复</button>' : '';
      var likedCmt = c.liked ? ' is-liked' : '';
      return '<div class="m-comment-item" id="m-cmt-' + c.id + '" style="' + indent + '">' +
        '<div class="m-comment-meta">' +
          '<span class="m-comment-user" data-uid="' + c.userId + '">@' + esc(c.user) + '</span>' +
          '<span class="m-comment-time">' + formatDate(c.date) + '</span>' +
          replyBtn +
          '<button class="m-comment-like' + likedCmt + '" data-id="' + c.id + '">♥ ' + (c.likes || 0) + '</button>' +
        '</div>' +
        replyPrefix +
        '<div class="m-comment-body">' + esc(c.text) + '</div>' +
        (c.replies && c.replies.length ? Mobile._renderComments(c.replies, articleId) : '') +
      '</div>';
    }).join('');
  },

  _bindCommentActions: function (root, articleId) {
    root.querySelectorAll('.m-comment-user').forEach(function (el) {
      el.addEventListener('click', function () { Profile.open(el.dataset.uid); });
    });
    root.querySelectorAll('.m-comment-reply-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Mobile._replyParentId = btn.dataset.id;
        Mobile._replyParentUser = btn.dataset.user;
        var banner = document.getElementById('m-reply-banner');
        var label  = document.getElementById('m-reply-label');
        if (banner) banner.classList.add('active');
        if (label)  label.textContent = '回复 @' + btn.dataset.user;
        var ta = document.getElementById('m-comment-ta');
        if (ta) { ta.focus(); ta.placeholder = '回复 @' + btn.dataset.user + '…'; }
      });
    });
    root.querySelectorAll('.m-comment-like').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!State.currentUser) { Toast.show('请先登录', true); return; }
        Interactions.likeComment(articleId, btn.dataset.id, btn);
      });
    });
  },

  _cancelReply: function () {
    Mobile._replyParentId = null;
    Mobile._replyParentUser = null;
    var banner = document.getElementById('m-reply-banner');
    var ta = document.getElementById('m-comment-ta');
    if (banner) banner.classList.remove('active');
    if (ta) ta.placeholder = '发表评论…';
  },

  sendComment: function () {
    if (!State.currentUser) { Toast.show('请先登录', true); return; }
    var ta = document.getElementById('m-comment-ta');
    var text = ta ? ta.value.trim() : '';
    if (!text) { Toast.show('评论不能为空', true); return; }
    var id = Mobile._articleId;
    var parentId = Mobile._replyParentId;
    API.postComment(id, State.currentUser.id, State.currentUser.username, text, parentId)
      .then(function () {
        if (ta) { ta.value = ''; ta.style.height = 'auto'; }
        Mobile._cancelReply();
        return API.getArticle(id);
      })
      .then(function (a) {
        Mobile._renderArticle(a);
        App.renderFeed && App.renderFeed();
        Toast.show('评论已发布 ▶');
        Notifications.pollUnread && Notifications.pollUnread();
      })
      .catch(function (e) { Toast.show('发布失败：' + (e.message || ''), true); });
  },

  closeArticle: function () {
    var page = document.getElementById('m-article-page');
    var bar  = document.getElementById('m-comment-bar');
    if (page) page.classList.remove('m-page-open');
    if (bar)  bar.style.display = 'none';
    Mobile._articleId = null;
    Mobile._cancelReply();
  },

  /* ── Like / Save helpers ── */
  _toggleLike: function (id, btn) {
    if (!State.currentUser) { Toast.show('请先登录', true); return; }
    API.toggleLike(id).then(function (r) {
      var liked = r.liked;
      var count = r.likes;
      btn.classList.toggle('is-liked', liked);
      var span = btn.querySelector('span');
      if (span) span.textContent = count;
      if (liked) State.userLikes.push(id);
      else State.userLikes = State.userLikes.filter(function (x) { return x !== id; });
    }).catch(function () { Toast.show('操作失败', true); });
  },

  _toggleSave: function (id, btn) {
    if (!State.currentUser) { Toast.show('请先登录', true); return; }
    API.toggleSave(id).then(function (r) {
      var saved = r.saved;
      var count = r.saves;
      btn.classList.toggle('is-saved', saved);
      var span = btn.querySelector('span');
      if (span) span.textContent = count;
      if (saved) State.userSaves.push(id);
      else State.userSaves = State.userSaves.filter(function (x) { return x !== id; });
    }).catch(function () { Toast.show('操作失败', true); });
  },

};

/* ════════════════════════════════════════════════════════
   HIJACK desktop article opens on mobile
   — intercept Dialog.open('dlg-article') on mobile
════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {
  setTimeout(function () {
    if (!Mobile.isMobile()) return;

    // Disable old MobileNav if it exists
    if (typeof MobileNav !== 'undefined') {
      MobileNav.init = function () {};
      MobileNav.go   = function () {};
    }

    Mobile.init();

    // Intercept card "阅读" button clicks — they call Article.open(id)
    // We override Article.open on mobile
    var _origArticleOpen = Article.open.bind(Article);
    Article.open = function (id, focusComment) {
      if (Mobile.isMobile()) {
        Mobile.openArticle(id, focusComment);
      } else {
        _origArticleOpen(id, focusComment);
      }
    };

    // Feed card clicks — bind after each render
    var _origRenderFeed = App.renderFeed.bind(App);
    App.renderFeed = function () {
      _origRenderFeed();
      setTimeout(Mobile._bindFeedCards, 50);
    };
    // Also do initial bind
    setTimeout(Mobile._bindFeedCards, 500);

  }, 150);
});

Mobile._bindFeedCards = function () {
  if (!Mobile.isMobile()) return;
  document.querySelectorAll('.news-card[data-id]').forEach(function (card) {
    if (card._mobileBound) return;
    card._mobileBound = true;
    var id = card.dataset.id;
    // Tap on read button or the card body opens article
    card.addEventListener('click', function (e) {
      // Let like/save action buttons do their own thing (delegated in app.js)
      var btn = e.target.closest('[data-action]');
      if (btn && (btn.dataset.action === 'like' || btn.dataset.action === 'save')) return;
      Mobile.openArticle(id);
    });
  });
};
