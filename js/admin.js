/* ============================================================
 * 信阳师范大学历史文化学院足球队 —— 后台管理模块
 * 所有修改操作均需管理员登录（权限校验见 store.js）
 * ============================================================ */

(() => {
  const $ = s => document.querySelector(s);
  const state = () => Store.get();
  const esc = s => Utils.esc(s);
  const photo = p => App.photoOf(p);

  const POSITIONS = ['前锋', '中场', '后卫', '门将'];
  const SWATCHES = ['#eaf1fb', '#ffffff', '#f7f3e8', '#eef4ff', '#f2eaea', '#0b1f4d', '#1e3a8a', '#2563eb', '#1d4ed8', '#7c3a2d'];

  let currentTab = 'team';
  let formState = null;       // 队员/名人堂编辑状态
  let tempBg = null;          // 背景图片临时值（上传或链接）
  let tempBgChanged = false;

  /* ================= 登录 ================= */
  $('#btnAdmin').addEventListener('click', () => {
    Store.isLoggedIn() ? openAdmin() : openLogin();
  });
  $('#footerAdmin').addEventListener('click', e => {
    e.preventDefault();
    Store.isLoggedIn() ? openAdmin() : openLogin();
  });

  function openLogin() {
    $('#loginHint').textContent = `默认密码：${Store.DEFAULT_PASSWORD}（登录后请及时修改）`;
    UI.open('#loginModal');
    setTimeout(() => $('#loginPw').focus(), 60);
  }

  async function doLogin() {
    const pw = $('#loginPw').value;
    const r = await Store.login(pw);
    if (r.ok) {
      $('#loginPw').value = '';
      UI.close('#loginModal');
      UI.toast('登录成功');
      App.render();
      openAdmin();
    } else {
      UI.toast(r.msg || '登录失败，请重试', 'err');
      $('#loginPw').select();
    }
  }

  $('#btnLogin').addEventListener('click', doLogin);
  $('#loginPw').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

  /* ================= 后台主体 ================= */
  function openAdmin() {
    if (!Store.isLoggedIn()) { openLogin(); return; }
    UI.open('#adminModal');
    showTab(currentTab);
  }

  function showTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    const banner = `<div class="publish-tip">📤 当前为<b>草稿模式</b>：保存后仅本浏览器可见。<b>发布给所有人</b> = 「系统设置 → 导出数据文件」→ 替换 GitHub 仓库中的 <code>data/data.json</code> → 约 1 分钟后全站更新。</div>`;
    $('#adminContent').innerHTML = banner + buildTab(tab);
    bindTab(tab);
  }

  document.querySelectorAll('.admin-tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

  /* 数据操作统一入口：保存（草稿）+ 刷新 + 提示 */
  function commit(okMsg) {
    const r = Store.save();
    if (r.ok) {
      App.render();
      UI.toast((okMsg || '已保存') + '（草稿）', 'ok');
      return true;
    }
    UI.toast(r.msg || '保存失败', 'err');
    return false;
  }

  /* ================= Tab 构建 ================= */
  function buildTab(tab) {
    switch (tab) {
      case 'team': return teamTabHTML();
      case 'players': return playersTabHTML();
      case 'hall': return hallTabHTML();
      case 'bg': return bgTabHTML();
      case 'system': return systemTabHTML();
      default: return '';
    }
  }

  function bindTab(tab) {
    if (tab === 'team') {
      $('#btnSaveTeam').addEventListener('click', async () => {
        const t = state().team;
        t.name = $('#f-name').value.trim();
        t.sub = $('#f-sub').value.trim();
        t.slogan = $('#f-slogan').value.trim();
        t.founded = $('#f-founded').value.trim();
        t.college = $('#f-college').value.trim();
        t.description = $('#f-desc').value.trim();
        if (!t.name) { UI.toast('球队名称不能为空', 'err'); return; }
        await commit('球队信息已保存');
      });
    }
    if (tab === 'bg') bindBgTab();
    if (tab === 'system') {
      $('#btnChangePw').addEventListener('click', changePassword);
    }
  }

  /* ---------- 球队信息 ---------- */
  function teamTabHTML() {
    const t = state().team;
    return `
      <div class="form-grid">
        <label>球队名称 *<input class="input" id="f-name" value="${esc(t.name)}"></label>
        <label>副标题<input class="input" id="f-sub" value="${esc(t.sub)}"></label>
        <label>队训口号<input class="input" id="f-slogan" value="${esc(t.slogan)}"></label>
        <label>建队年份<input class="input" id="f-founded" value="${esc(t.founded)}"></label>
        <label class="span-2">所属学院<input class="input" id="f-college" value="${esc(t.college)}"></label>
        <label class="span-2">球队简介<textarea class="input" id="f-desc" rows="6">${esc(t.description)}</textarea></label>
      </div>
      <button class="btn btn-primary" id="btnSaveTeam">保存球队信息</button>`;
  }

  /* ---------- 现役队员 ---------- */
  function playersTabHTML() {
    const list = state().players;
    const rows = list.map(p => `
      <li class="row-item">
        <img class="row-thumb" src="${photo(p)}" alt="${esc(p.name)}">
        <div class="row-main">
          <strong>${esc(p.name)}</strong>
          <span class="row-sub">#${esc(p.number)} · ${esc(p.position)}${p.grade ? ' · ' + esc(p.grade) : ''}</span>
        </div>
        <div class="row-actions">
          <button class="btn btn-mini" data-action="editPlayer" data-id="${p.id}">编辑</button>
          <button class="btn btn-mini btn-danger" data-action="delPlayer" data-id="${p.id}">删除</button>
        </div>
      </li>`).join('');
    return `
      <button class="btn btn-primary" data-action="addPlayer">＋ 添加队员</button>
      ${rows ? `<ul class="row-list">${rows}</ul>` : '<p class="empty-tip">暂无队员</p>'}`;
  }

  function openPlayerForm(id) {
    const p = id ? state().players.find(x => x.id === id) : null;
    formState = { kind: 'player', id: id || null, photo: p ? p.photo : null, originalPhoto: p ? p.photo : null, photoChanged: false };
    $('#formTitle').textContent = p ? '编辑队员：' + p.name : '添加队员';
    $('#formBody').innerHTML = playerFormHTML(p);
    UI.open('#formModal');
    bindPhotoField();
    $('#btnSaveForm').addEventListener('click', savePlayerForm);
  }

  function playerFormHTML(p) {
    p = p || {};
    const posOpts = POSITIONS.map(po => `<option value="${po}" ${p.position === po ? 'selected' : ''}>${po}</option>`).join('');
    return `
      <div class="form-layout">
        <div class="photo-box">
          <img id="pf-photo" src="${esc(p.photo) || App.avatar}" alt="球员照片">
          <input type="file" id="pf-file" accept="image/*" hidden>
          <div class="photo-actions">
            <button class="btn btn-mini" type="button" data-photo="upload">📷 上传照片</button>
            <button class="btn btn-mini btn-danger" type="button" data-photo="remove">移除照片</button>
          </div>
          <input class="input input-sm" id="pf-url" placeholder="或粘贴图片链接，回车生效">
        </div>
        <div class="form-grid">
          <label>姓名 *<input class="input" id="pf-name" value="${esc(p.name)}"></label>
          <label>球衣号码<input class="input" id="pf-number" value="${esc(p.number)}"></label>
          <label>场上位置<select class="input" id="pf-position">${posOpts}</select></label>
          <label>年级/届别<input class="input" id="pf-grade" value="${esc(p.grade)}"></label>
          <label>身高 (cm)<input class="input" id="pf-height" value="${esc(p.height)}"></label>
          <label>体重 (kg)<input class="input" id="pf-weight" value="${esc(p.weight)}"></label>
          <label class="span-2">技术特点<input class="input" id="pf-specialty" value="${esc(p.specialty)}"></label>
          <label class="span-2">个人介绍<textarea class="input" id="pf-bio" rows="4">${esc(p.bio)}</textarea></label>
        </div>
      </div>
      <button class="btn btn-primary btn-block" id="btnSaveForm">保存队员信息</button>`;
  }

  async function savePlayerForm() {
    const name = $('#pf-name').value.trim();
    if (!name) { UI.toast('请填写姓名', 'err'); return; }
    const item = {
      id: formState.id || Utils.uid(),
      name,
      number: $('#pf-number').value.trim(),
      position: $('#pf-position').value,
      grade: $('#pf-grade').value.trim(),
      height: $('#pf-height').value.trim(),
      weight: $('#pf-weight').value.trim(),
      specialty: $('#pf-specialty').value.trim(),
      bio: $('#pf-bio').value.trim(),
      photo: formState.photoChanged ? formState.photo : formState.originalPhoto
    };
    const list = state().players;
    if (formState.id) {
      const i = list.findIndex(x => x.id === formState.id);
      if (i >= 0) list[i] = item;
    } else {
      list.push(item);
    }
    UI.close('#formModal');
    await commit(formState.id ? '队员信息已更新' : '队员已添加');
    showTab('players');
  }

  async function delPlayer(id) {
    const p = state().players.find(x => x.id === id);
    if (!p) return;
    if (!confirm(`确定删除队员「${p.name}」吗？此操作不可恢复。`)) return;
    state().players = state().players.filter(x => x.id !== id);
    await commit('已删除队员');
    showTab('players');
  }

  /* ---------- 名人堂 ---------- */
  function hallTabHTML() {
    const list = state().hall;
    const rows = list.map(h => `
      <li class="row-item">
        <img class="row-thumb" src="${photo(h)}" alt="${esc(h.name)}">
        <div class="row-main">
          <strong>${esc(h.name)}</strong>
          <span class="row-sub">${esc(h.position)} · ${esc(h.years)}</span>
        </div>
        <div class="row-actions">
          <button class="btn btn-mini" data-action="editHall" data-id="${h.id}">编辑</button>
          <button class="btn btn-mini btn-danger" data-action="delHall" data-id="${h.id}">删除</button>
        </div>
      </li>`).join('');
    return `
      <button class="btn btn-primary" data-action="addHall">＋ 添加名人堂成员</button>
      ${rows ? `<ul class="row-list">${rows}</ul>` : '<p class="empty-tip">暂无成员</p>'}`;
  }

  function openHallForm(id) {
    const h = id ? state().hall.find(x => x.id === id) : null;
    formState = { kind: 'hall', id: id || null, photo: h ? h.photo : null, originalPhoto: h ? h.photo : null, photoChanged: false };
    $('#formTitle').textContent = h ? '编辑名人堂：' + h.name : '添加名人堂成员';
    $('#formBody').innerHTML = hallFormHTML(h);
    UI.open('#formModal');
    bindPhotoField();
    $('#btnSaveForm').addEventListener('click', saveHallForm);
  }

  function hallFormHTML(h) {
    h = h || {};
    const posOpts = POSITIONS.map(po => `<option value="${po}" ${h.position === po ? 'selected' : ''}>${po}</option>`).join('');
    return `
      <div class="form-layout">
        <div class="photo-box">
          <img id="pf-photo" src="${esc(h.photo) || App.avatar}" alt="成员照片">
          <input type="file" id="pf-file" accept="image/*" hidden>
          <div class="photo-actions">
            <button class="btn btn-mini" type="button" data-photo="upload">📷 上传照片</button>
            <button class="btn btn-mini btn-danger" type="button" data-photo="remove">移除照片</button>
          </div>
          <input class="input input-sm" id="pf-url" placeholder="或粘贴图片链接，回车生效">
        </div>
        <div class="form-grid">
          <label>姓名 *<input class="input" id="pf-name" value="${esc(h.name)}"></label>
          <label>场上位置<select class="input" id="pf-position">${posOpts}</select></label>
          <label class="span-2">效力年份<input class="input" id="pf-years" placeholder="如：2008-2012" value="${esc(h.years)}"></label>
          <label class="span-2">荣誉与成就<textarea class="input" id="pf-honors" rows="4" placeholder="每行填写一条荣誉">${esc(h.honors)}</textarea></label>
          <label class="span-2">传奇故事<textarea class="input" id="pf-bio" rows="3">${esc(h.bio)}</textarea></label>
        </div>
      </div>
      <button class="btn btn-primary btn-block" id="btnSaveForm">保存成员信息</button>`;
  }

  async function saveHallForm() {
    const name = $('#pf-name').value.trim();
    if (!name) { UI.toast('请填写姓名', 'err'); return; }
    const item = {
      id: formState.id || Utils.uid(),
      name,
      position: $('#pf-position').value,
      years: $('#pf-years').value.trim(),
      honors: $('#pf-honors').value.trim(),
      bio: $('#pf-bio').value.trim(),
      photo: formState.photoChanged ? formState.photo : formState.originalPhoto
    };
    const list = state().hall;
    if (formState.id) {
      const i = list.findIndex(x => x.id === formState.id);
      if (i >= 0) list[i] = item;
    } else {
      list.push(item);
    }
    UI.close('#formModal');
    await commit(formState.id ? '成员信息已更新' : '成员已添加');
    showTab('hall');
  }

  async function delHall(id) {
    const h = state().hall.find(x => x.id === id);
    if (!h) return;
    if (!confirm(`确定从名人堂移除「${h.name}」吗？此操作不可恢复。`)) return;
    state().hall = state().hall.filter(x => x.id !== id);
    await commit('已移除');
    showTab('hall');
  }

  /* ---------- 照片字段（队员/名人堂共用） ---------- */
  function bindPhotoField() {
    $('#pf-file').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = await Utils.compressImage(file, 700, 0.85);
        formState.photo = data;
        formState.photoChanged = true;
        $('#pf-photo').src = data;
        UI.toast('照片已就绪');
      } catch (err) {
        UI.toast('照片处理失败，请换一张试试', 'err');
      }
      e.target.value = '';
    });
    document.querySelector('[data-photo="upload"]').addEventListener('click', () => $('#pf-file').click());
    document.querySelector('[data-photo="remove"]').addEventListener('click', () => {
      formState.photo = null;
      formState.photoChanged = true;
      $('#pf-photo').src = App.avatar;
    });
    $('#pf-url').addEventListener('change', () => {
      const v = $('#pf-url').value.trim();
      if (!v) return;
      formState.photo = v;
      formState.photoChanged = true;
      $('#pf-photo').src = v;
      UI.toast('已使用图片链接');
    });
  }

  /* ---------- 背景设置 ---------- */
  function bgTabHTML() {
    const b = state().background || {};
    const isImg = b.type === 'image';
    const showUrl = b.image && !String(b.image).startsWith('data:');
    const sw = SWATCHES.map(c => `<button class="swatch" data-color="${c}" title="${c}" style="background:${c}"></button>`).join('');
    return `
      <div class="bg-section">
        <h4>背景类型</h4>
        <label class="radio"><input type="radio" name="bgType" value="color" ${!isImg ? 'checked' : ''}> 纯色背景</label>
        <label class="radio"><input type="radio" name="bgType" value="image" ${isImg ? 'checked' : ''}> 图片背景</label>
      </div>
      <div class="bg-section" id="bgColorSec">
        <h4>背景颜色</h4>
        <div class="color-row">
          <input type="color" class="color-input" id="bgColor" value="${esc(b.color || '#e8f0e9')}">
          <div class="swatches">${sw}</div>
        </div>
      </div>
      <div class="bg-section" id="bgImageSec" style="${isImg ? '' : 'display:none'}">
        <h4>背景图片</h4>
        <img class="bg-preview" id="bgPreview" src="${esc(b.image) || ''}" alt="背景预览" style="${b.image ? '' : 'display:none'}">
        <input type="file" id="bgFile" accept="image/*" hidden>
        <div class="photo-actions" style="margin-bottom:10px">
          <button class="btn btn-mini" data-action="uploadBg">📷 上传图片</button>
          <button class="btn btn-mini btn-danger" data-action="removeBg">移除图片</button>
        </div>
        <input class="input" id="bgUrl" placeholder="或粘贴背景图片链接，回车生效" value="${showUrl ? esc(b.image) : ''}">
        <p class="hint-sm">建议使用横向大图；上传的图片会自动压缩。</p>
      </div>
      <div class="bg-section">
        <h4>深色遮罩 <span class="hint-sm">（提升文字可读性）</span></h4>
        <input type="range" min="0" max="0.85" step="0.05" id="bgVeilRange" value="${Number(b.veil) || 0}">
        <span class="veil-val" id="bgVeilVal">${Math.round((Number(b.veil) || 0) * 100)}%</span>
      </div>
      <div class="row-actions">
        <button class="btn btn-primary" id="btnSaveBg">应用背景</button>
        <button class="btn btn-ghost" data-action="resetBg">恢复默认背景</button>
      </div>`;
  }

  function bindBgTab() {
    tempBg = state().background.image || null;
    tempBgChanged = false;

    document.querySelectorAll('input[name="bgType"]').forEach(r => {
      r.addEventListener('change', () => {
        const isImg = document.querySelector('input[name="bgType"]:checked').value === 'image';
        $('#bgImageSec').style.display = isImg ? '' : 'none';
      });
    });
    document.querySelectorAll('.swatch').forEach(s => {
      s.addEventListener('click', () => { $('#bgColor').value = s.dataset.color; });
    });
    document.querySelector('[data-action="uploadBg"]').addEventListener('click', () => $('#bgFile').click());
    $('#bgFile').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = await Utils.compressImage(file, 1600, 0.85);
        tempBg = data;
        tempBgChanged = true;
        $('#bgPreview').src = data;
        $('#bgPreview').style.display = '';
        UI.toast('背景图片已就绪');
      } catch (err) {
        UI.toast('背景图片处理失败', 'err');
      }
      e.target.value = '';
    });
    document.querySelector('[data-action="removeBg"]').addEventListener('click', () => {
      tempBg = null;
      tempBgChanged = true;
      $('#bgPreview').src = '';
      $('#bgPreview').style.display = 'none';
      $('#bgUrl').value = '';
    });
    $('#bgUrl').addEventListener('change', () => {
      const v = $('#bgUrl').value.trim();
      if (!v) return;
      tempBg = v;
      tempBgChanged = true;
      $('#bgPreview').src = v;
      $('#bgPreview').style.display = '';
      UI.toast('已使用图片链接');
    });
    $('#bgVeilRange').addEventListener('input', () => {
      $('#bgVeilVal').textContent = Math.round(Number($('#bgVeilRange').value) * 100) + '%';
    });
    $('#btnSaveBg').addEventListener('click', async () => {
      const b = state().background;
      b.type = document.querySelector('input[name="bgType"]:checked').value;
      b.color = $('#bgColor').value;
      if (tempBgChanged) b.image = tempBg;
      b.veil = Number($('#bgVeilRange').value);
      await commit('背景已更新');
      App.applyBackground();
    });
  }

  /* ---------- 系统设置 ---------- */
  function systemTabHTML() {
    return `
      <div class="bg-section">
        <h4>🔑 修改管理密码</h4>
        <div class="form-grid">
          <label>原密码<input class="input" type="password" id="pw-old" autocomplete="current-password"></label>
          <label>新密码（至少 6 位）<input class="input" type="password" id="pw-new" autocomplete="new-password"></label>
          <label>确认新密码<input class="input" type="password" id="pw-new2" autocomplete="new-password"></label>
        </div>
        <button class="btn btn-primary" id="btnChangePw">修改密码</button>
      </div>
      <div class="bg-section">
        <h4>📤 发布数据给所有人</h4>
        <div class="row-actions">
          <button class="btn btn-primary" data-action="exportData">导出发布数据文件 (data.json)</button>
          <button class="btn btn-mini" data-action="importData">导入数据</button>
          <input type="file" id="importFile" accept=".json,application/json" hidden>
        </div>
        <ol class="publish-steps">
          <li>点「导出发布数据文件」，下载得到 <code>data.json</code>；</li>
          <li>打开 GitHub 仓库 → 进入 <code>data</code> 文件夹 → 点 <code>data.json</code> → 点右上角「编辑」（铅笔图标）→ 用记事本打开下载的 data.json，全选复制粘贴替换内容 → Commit changes；</li>
          <li>等约 1 分钟（GitHub Pages 自动重新部署）→ 所有人刷新网址即可看到新内容。</li>
        </ol>
        <p class="hint-sm">「导入数据」用于从备份文件恢复草稿；导出文件同时就是你的数据备份。</p>
      </div>
      <div class="bg-section">
        <h4>⚠️ 危险操作</h4>
        <div class="row-actions">
          <button class="btn btn-mini btn-danger" data-action="resetData">恢复默认数据</button>
        </div>
        <p class="hint-sm">将清空当前草稿并恢复初始示例数据，不可撤销。</p>
      </div>
      <div class="bg-section">
        <button class="btn btn-ghost" data-action="logout">退出登录</button>
      </div>`;
  }

  function changePassword() {
    const oldPw = $('#pw-old').value;
    const newPw = $('#pw-new').value;
    const newPw2 = $('#pw-new2').value;
    if (newPw !== newPw2) { UI.toast('两次输入的新密码不一致', 'err'); return; }
    const res = Store.changePassword(oldPw, newPw);
    if (!res.ok) { UI.toast(res.msg || '修改失败', 'err'); return; }
    $('#pw-old').value = $('#pw-new').value = $('#pw-new2').value = '';
    UI.toast('密码修改成功（仅本浏览器生效）');
  }

  /* ---------- 通用后台操作（事件委托） ---------- */
  $('#adminContent').addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const act = btn.dataset.action;
    const id = btn.dataset.id;
    if (act === 'addPlayer') openPlayerForm();
    else if (act === 'editPlayer') openPlayerForm(id);
    else if (act === 'delPlayer') delPlayer(id);
    else if (act === 'addHall') openHallForm();
    else if (act === 'editHall') openHallForm(id);
    else if (act === 'delHall') delHall(id);
    else if (act === 'logout') {
      Store.logout();
      UI.close('#adminModal');
      App.render();
      UI.toast('已退出登录');
    }
    else if (act === 'resetBg') {
      const b = state().background;
      b.type = 'color';
      b.color = '#e8f0e9';
      b.image = null;
      b.veil = 0;
      await commit('已恢复默认背景');
      App.applyBackground();
      showTab('bg');
    }
    else if (act === 'exportData') exportData();
    else if (act === 'importData') $('#importFile').click();
    else if (act === 'resetData') resetData();
  });

  $('#adminContent').addEventListener('change', e => {
    if (e.target && e.target.id === 'importFile') {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const res = await Store.importJSON(reader.result);
        if (res.ok) {
          App.render();
          showTab(currentTab);
          UI.toast('数据导入成功');
        } else {
          UI.toast('导入失败：' + res.msg, 'err');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    }
  });

  function exportData() {
    const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'data.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    UI.toast('已导出 data.json：请替换 GitHub 仓库里的 data/data.json 完成发布');
  }

  async function resetData() {
    if (!confirm('确定恢复默认数据吗？当前所有修改将全部丢失！')) return;
    if (!confirm('再次确认：此操作不可撤销，确定继续？')) return;
    const r = await Store.reset();
    if (!r.ok) { UI.toast(r.msg || '恢复失败', 'err'); return; }
    App.render();
    showTab(currentTab);
    UI.toast('已恢复默认数据');
  }
})();
