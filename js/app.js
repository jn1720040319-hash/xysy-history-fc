/* ============================================================
 * 信阳师范大学历史文化学院足球队 —— 前台渲染模块
 * ============================================================ */

(() => {
  const $ = s => document.querySelector(s);
  const state = Store.get();

  const AVATAR = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240">' +
    '<rect width="200" height="240" fill="#0d5c36"/>' +
    '<text x="100" y="118" font-size="88" text-anchor="middle" fill="#ffffff" font-family="sans-serif">⚽</text>' +
    '<text x="100" y="196" font-size="30" text-anchor="middle" fill="#cfe8d8" font-family="sans-serif">HISTORY FC</text>' +
    '</svg>'
  );

  const photoOf = item => (item && item.photo) ? item.photo : AVATAR;

  /* ---------- 通用 UI ---------- */
  const UI = {
    open(sel) {
      const m = $(sel);
      if (m) { m.classList.add('show'); m.setAttribute('aria-hidden', 'false'); document.body.classList.add('no-scroll'); }
    },
    close(sel) {
      const m = $(sel);
      if (m) { m.classList.remove('show'); m.setAttribute('aria-hidden', 'true'); }
      if (!document.querySelector('.modal.show')) document.body.classList.remove('no-scroll');
    },
    toast(msg, type) {
      const t = $('#toast');
      t.textContent = msg;
      t.className = 'toast show' + (type === 'err' ? ' err' : '');
      clearTimeout(UI.toast._t);
      UI.toast._t = setTimeout(() => { t.className = 'toast'; }, 2600);
    }
  };

  /* ---------- 渲染 ---------- */
  function renderHeader() {
    const t = state.team;
    $('#brandName').textContent = t.name;
    $('#brandSub').textContent = t.sub || '信阳师范大学 · 历史文化学院';
    const btn = $('#btnAdmin');
    btn.textContent = Store.isLoggedIn() ? '⚙ 管理后台' : '⚙ 管理员';
    $('#footerText').textContent = (t.name || '信阳师范大学历史文化学院足球队') + ' · 绿茵传承，史韵流长';
  }

  function renderHero() {
    const t = state.team;
    $('#heroTitle').textContent = t.name;
    $('#heroSlogan').textContent = t.slogan || '';
    $('#statFounded').textContent = t.founded || '—';
    $('#statPlayers').textContent = state.players.length;
    $('#statHall').textContent = state.hall.length;
    document.title = t.name + ' · 信阳师范大学历史文化学院';
  }

  function renderAbout() {
    const t = state.team;
    $('#aboutCollege').textContent = t.college || '';
    $('#aboutFounded').textContent = t.founded || '';
    $('#aboutSlogan').textContent = t.slogan || '';
    $('#aboutDesc').textContent = t.description || '';
  }

  function renderPlayerGrid() {
    const grid = $('#playerGrid');
    if (!state.players.length) {
      grid.innerHTML = '<div class="empty-tip">暂无队员信息，请管理员登录后在后台添加</div>';
      return;
    }
    grid.innerHTML = state.players.map(p => {
      const num = p.number ? `<span class="card-num">${Utils.esc(p.number)}</span>` : '';
      const pos = p.position ? `<span class="tag tag-pos">${Utils.esc(p.position)}</span>` : '';
      const grade = p.grade ? `<span class="tag">${Utils.esc(p.grade)}</span>` : '';
      return `
      <article class="card player-card" data-view="p_${p.id}" role="button" tabindex="0" aria-label="查看 ${Utils.esc(p.name)} 的详情">
        <div class="card-photo"><img src="${photoOf(p)}" alt="${Utils.esc(p.name)}" loading="lazy"><span class="photo-mask"></span>${num}</div>
        <div class="card-body">
          <h3 class="card-name">${Utils.esc(p.name)}</h3>
          <div class="card-tags">${pos}${grade}</div>
          <button class="btn btn-mini" type="button">查看详情</button>
        </div>
      </article>`;
    }).join('');
  }

  function renderHallGrid() {
    const grid = $('#hallGrid');
    if (!state.hall.length) {
      grid.innerHTML = '<div class="empty-tip">名人堂虚位以待，请管理员登录后添加</div>';
      return;
    }
    grid.innerHTML = state.hall.map(h => {
      const honors = (h.honors || '').split('\n').map(s => s.trim()).filter(Boolean);
      const list = honors.slice(0, 2);
      const more = honors.length > 2 ? `<span class="honor-more">等 ${honors.length} 项荣誉…</span>` : '';
      return `
      <article class="card hall-card" data-view="h_${h.id}" role="button" tabindex="0" aria-label="查看 ${Utils.esc(h.name)} 的荣誉">
        <div class="card-photo"><img src="${photoOf(h)}" alt="${Utils.esc(h.name)}" loading="lazy"><span class="photo-mask"></span></div>
        <div class="card-body">
          <h3 class="card-name">${Utils.esc(h.name)}</h3>
          <div class="card-tags"><span class="tag tag-gold">${Utils.esc(h.position)}</span><span class="tag">${Utils.esc(h.years)}</span></div>
          <ul class="honors-list">${list.map(x => `<li>${Utils.esc(x)}</li>`).join('')}</ul>
          ${more}
          <button class="btn btn-mini" type="button">查看荣誉</button>
        </div>
      </article>`;
    }).join('');
  }

  /* ---------- 详情弹窗 ---------- */
  function openDetail(key) {
    const i = key.indexOf('_');
    const kind = key.slice(0, i);
    const id = key.slice(i + 1);
    if (kind === 'p') openPlayerDetail(id);
    else openHallDetail(id);
  }

  function openPlayerDetail(id) {
    const p = state.players.find(x => x.id === id);
    if (!p) return;
    const rows = [
      ['场上位置', p.position],
      ['年级/届别', p.grade],
      ['身高', p.height ? p.height + ' cm' : ''],
      ['体重', p.weight ? p.weight + ' kg' : ''],
      ['技术特点', p.specialty]
    ].filter(r => r[1]);
    $('#detailTitle').textContent = '球员详情';
    $('#detailBody').innerHTML = `
      <div class="detail">
        <div class="detail-photo">
          <img src="${photoOf(p)}" alt="${Utils.esc(p.name)}">
          ${p.number ? `<span class="detail-num">#${Utils.esc(p.number)}</span>` : ''}
        </div>
        <div class="detail-info">
          <h4 class="detail-name">${Utils.esc(p.name)}</h4>
          <table class="detail-table">
            ${rows.map(r => `<tr><th>${Utils.esc(r[0])}</th><td>${Utils.esc(r[1])}</td></tr>`).join('')}
          </table>
          ${p.bio ? `<div class="detail-section"><h5>个人介绍</h5><p>${Utils.esc(p.bio)}</p></div>` : ''}
        </div>
      </div>`;
    UI.open('#detailModal');
  }

  function openHallDetail(id) {
    const h = state.hall.find(x => x.id === id);
    if (!h) return;
    const honors = (h.honors || '').split('\n').map(s => s.trim()).filter(Boolean);
    $('#detailTitle').textContent = '名人堂 · ' + h.name;
    $('#detailBody').innerHTML = `
      <div class="detail">
        <div class="detail-photo">
          <img src="${photoOf(h)}" alt="${Utils.esc(h.name)}">
        </div>
        <div class="detail-info">
          <h4 class="detail-name">${Utils.esc(h.name)}</h4>
          <table class="detail-table">
            <tr><th>场上位置</th><td>${Utils.esc(h.position)}</td></tr>
            <tr><th>效力年份</th><td>${Utils.esc(h.years)}</td></tr>
          </table>
          <div class="detail-section">
            <h5>荣誉与成就</h5>
            <ul class="honor-list">${honors.map(x => `<li>${Utils.esc(x)}</li>`).join('') || '<li>—</li>'}</ul>
          </div>
          ${h.bio ? `<div class="detail-section" style="margin-top:16px"><h5>传奇故事</h5><p>${Utils.esc(h.bio)}</p></div>` : ''}
        </div>
      </div>`;
    UI.open('#detailModal');
  }

  /* ---------- 自定义背景 ---------- */
  function applyBackground() {
    const b = state.background || {};
    const body = document.body;
    body.style.backgroundColor = b.color || '#e8f0e9';
    if (b.type === 'image' && b.image) {
      body.style.backgroundImage = `url("${b.image}")`;
      body.style.backgroundSize = 'cover';
      body.style.backgroundAttachment = 'fixed';
      body.style.backgroundPosition = 'center';
    } else {
      body.style.backgroundImage = 'none';
    }
    const veil = Math.min(0.9, Math.max(0, Number(b.veil) || 0));
    $('#bgVeil').style.opacity = veil;
  }

  function renderAll() {
    renderHeader();
    renderHero();
    renderAbout();
    renderPlayerGrid();
    renderHallGrid();
  }

  /* ---------- 事件绑定 ---------- */
  document.addEventListener('click', e => {
    const card = e.target.closest('[data-view]');
    if (card) { openDetail(card.dataset.view); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.closest && e.target.closest('[data-view]')) {
      openDetail(e.target.closest('[data-view]').dataset.view);
    }
  });
  document.querySelectorAll('.modal').forEach(m => {
    if (m.classList.contains('modal-protect')) return; // 管理/编辑弹窗防止误关
    m.addEventListener('click', e => { if (e.target === m) UI.close('#' + m.id); });
  });
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => UI.close('#' + btn.dataset.close));
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      UI.close('#loginModal');
      UI.close('#detailModal');
    }
  });

  window.App = { render: renderAll, applyBackground, avatar: AVATAR, photoOf, openDetail };
  window.UI = UI;

  document.addEventListener('DOMContentLoaded', async () => {
    // 优先从服务器同步数据（全站同步），本地预览时自动回退
    await Store.init();
    applyBackground();
    renderAll();
  });
})();
