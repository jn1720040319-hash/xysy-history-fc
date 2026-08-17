/* ============================================================
 * 信阳师范大学历史文化学院足球队 —— 数据与权限模块（v3 静态发布版）
 *
 * 适用于 GitHub Pages 等纯静态托管（免费、无需后端/数据库/支付绑定）。
 *
 * 工作模式：
 *  - static 模式：从 data/data.json 读取数据（随网站一起发布的文件，全站一致）
 *  - local  模式：本地双击 index.html 预览时（fetch 不可用）回退到浏览器 localStorage
 *
 * 发布流程（重要）：
 *  - 管理员在本浏览器修改 = 草稿（保存到 localStorage，仅自己可见）
 *  - 发布 = 「系统设置 → 导出数据文件」得到 data.json → 用它在 GitHub 仓库里
 *    替换 data/data.json → 约 1 分钟后 GitHub Pages 重新构建，所有人刷新可见
 * ============================================================ */

const Utils = (() => {
  const escMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => escMap[c]);
  const uid = () => 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /* 纯 JS 实现的 SHA-256（本地口令校验用，无需安全上下文） */
  function sha256(ascii) {
    function rightRotate(v, a) { return (v >>> a) | (v << (32 - a)); }
    const maxWord = Math.pow(2, 32);
    const words = [];
    const asciiBitLength = ascii.length * 8;
    let hash = sha256.h = sha256.h || [];
    const k = sha256.k = sha256.k || [];
    let primeCounter = k.length;
    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (let i = 0; i < ascii.length; i++) {
      const j = ascii.charCodeAt(i);
      if (j >> 8) return '';
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength;
    for (let j = 0; j < words.length;) {
      const w = words.slice(j, j += 16);
      const oldHash = hash.slice(0, 8);
      hash = hash.slice(0, 8);
      for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2];
        const a = hash[0], e = hash[4];
        const temp1 = hash[7]
          + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
          + ((e & hash[5]) ^ (~e & hash[6]))
          + k[i]
          + (w[i] = i < 16 ? w[i] : (
              w[i - 16]
              + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
              + w[i - 7]
              + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
            ) | 0);
        const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    let result = '';
    for (let i = 0; i < 8; i++) {
      for (let j = 3; j >= 0; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? '0' : '') + b.toString(16);
      }
    }
    return result;
  }

  const hashText = input => sha256(encodeURIComponent(String(input || '')));

  /* 图片压缩：转 dataURL，控制体积以适配存储与仓库文件大小 */
  function compressImage(file, maxW, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxW) {
            height = Math.round(height * maxW / width);
            width = maxW;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('图片读取失败'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  return { esc, uid, hashText, compressImage };
})();

/* ============================================================ */

const Store = (() => {
  const LOCAL_KEY = 'xysyfc_local_v1';       // 草稿数据（本浏览器）
  const LOCAL_AUTH_KEY = 'xysyfc_localauth_v1'; // 管理员口令（盐+哈希，本浏览器）
  const SESSION_KEY = 'xysyfc_session';
  const DEFAULT_PASSWORD = 'admin123';

  let cache = defaults(); // 对象引用全程不变，原地替换内容
  let mode = 'local';     // 'static' | 'local'

  /* 默认示例数据（首次发布 / 本地预览 / 恢复默认时使用） */
  function defaults() {
    return {
      version: 1,
      team: {
        name: '历史文化学院足球队',
        sub: '信阳师范大学 · 历史文化学院',
        slogan: '以史明志 · 绿茵争锋',
        founded: '2005',
        college: '信阳师范大学历史文化学院',
        description: '信阳师范大学历史文化学院足球队成立于 2005 年，是学院历史最悠久的学生体育团队之一。球队秉承"团结、拼搏、传承"的队训，将史学人的严谨与坚韧带上绿茵场。建队以来，球队多次参加校"园丁杯"足球联赛并屡获佳绩，培养了一代又一代热爱足球的学子。无论寒冬酷暑，南湖球场总有他们的身影——这就是历史文化学院足球队。'
      },
      players: [
        { id: 'p1', name: '王泽宇', number: '10', position: '前锋', grade: '2022级', height: '178', weight: '68', specialty: '速度快、射术精湛，擅长边路突破与远射。', bio: '球队进攻核心，曾在校足球联赛单赛季攻入 12 球，荣获"最佳射手"称号。', photo: null },
        { id: 'p2', name: '陈浩然', number: '7', position: '前锋', grade: '2023级', height: '175', weight: '65', specialty: '门前嗅觉敏锐，抢点能力强。', bio: '大二新星，善于无球跑动撕扯防线，是球队未来的希望。', photo: null },
        { id: 'p3', name: '李明轩', number: '8', position: '中场', grade: '2022级', height: '180', weight: '72', specialty: '组织调度出色，定位球主罚手，传球视野开阔。', bio: '球队节拍器，掌控攻防节奏，多次送出致命直塞。', photo: null },
        { id: 'p4', name: '张伟', number: '6', position: '中场', grade: '2021级', height: '176', weight: '70', specialty: '拦截凶悍、覆盖面积大，攻守兼备。', bio: '现任队长，场上的精神领袖，以身作则带领全队。', photo: null },
        { id: 'p5', name: '刘洋', number: '4', position: '后卫', grade: '2022级', height: '183', weight: '75', specialty: '头球争顶能力强，出球稳健。', bio: '后防中坚，场均解围数居全队之首。', photo: null },
        { id: 'p6', name: '赵磊', number: '5', position: '后卫', grade: '2021级', height: '185', weight: '78', specialty: '卡位精准、对抗强硬，指挥后防线。', bio: '经验丰富的老将，负责后场组织与角球防守。', photo: null },
        { id: 'p7', name: '孙浩', number: '2', position: '后卫', grade: '2024级', height: '172', weight: '62', specialty: '边路往返能力强，助攻积极。', bio: '大一新锐，冲击力十足，未来可期。', photo: null },
        { id: 'p8', name: '周凯', number: '1', position: '门将', grade: '2022级', height: '186', weight: '80', specialty: '反应迅速、出击果断，扑点球有心得。', bio: '镇守球门的"最后一道防线"，多次力保球门不失。', photo: null }
      ],
      hall: [
        { id: 'h1', name: '马建国', position: '前锋', years: '2008-2012', honors: '2009、2011 校联赛冠军核心射手\n2010 校联赛最佳射手\n两届院级"最佳球员"', bio: '球队传奇射手，退役后仍以教练身份指导球队训练，桃李满园。', photo: null },
        { id: 'h2', name: '郑国栋', position: '中场', years: '2010-2014', honors: '2012-2014 连续三届校联赛"最佳中场"\n2013 校联赛冠军', bio: '曾担任队长，以其优雅的组织和大师级传球闻名，被队友称为"球场指挥官"。', photo: null },
        { id: 'h3', name: '高原', position: '门将', years: '2013-2017', honors: '2015 校联赛"金手套奖"\n连续 400 分钟不失球纪录保持者', bio: '绰号"铁闸"，巅峰时期几乎一夫当关，是球队最令人安心的存在。', photo: null },
        { id: 'h4', name: '谢文博', position: '后卫', years: '2015-2019', honors: '2018 校联赛冠军（队长）\n2019 毕业季告别赛全场最佳', bio: '铁血队长，把最美好的四年献给绿茵场，退役之战感动全队。', photo: null }
      ],
      background: { type: 'color', color: '#e8f0e9', image: null, veil: 0 }
    };
  }

  /* 原地替换数据内容：保证已持有的引用（如前台 state）始终指向最新数据 */
  function assignData(d) {
    const base = defaults();
    for (const k of Object.keys(base)) if (!(k in d)) d[k] = base[k];
    for (const k of Object.keys(cache)) delete cache[k];
    Object.assign(cache, d);
  }

  /* ---------- 初始化：优先线上数据文件，失败回退本地 ---------- */
  async function init() {
    try {
      const res = await fetch('data/data.json', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        assignData(d);
        mode = 'static';
        return 'static';
      }
    } catch (e) { /* 本地 file:// 或网络异常时走回退 */ }
    mode = 'local';
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) assignData(JSON.parse(raw));
    } catch (e) { /* 忽略损坏数据 */ }
    return 'local';
  }

  function get() { return cache; }

  /* ---------- 保存：写入本浏览器（草稿） ---------- */
  function save() {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(cache));
      return { ok: true };
    } catch (e) {
      return { ok: false, msg: '浏览器本地存储空间不足' };
    }
  }

  /* ---------- 管理员口令（本浏览器，盐 + SHA-256） ---------- */
  function ensureLocalAuth() {
    if (localStorage.getItem(LOCAL_AUTH_KEY)) return;
    const salt = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    const hash = Utils.hashText(salt + DEFAULT_PASSWORD);
    localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify({ salt, hash }));
  }

  function verifyLocal(pw) {
    try {
      const a = JSON.parse(localStorage.getItem(LOCAL_AUTH_KEY));
      return Utils.hashText(a.salt + String(pw || '')) === a.hash;
    } catch (e) { return false; }
  }

  function login(password) {
    ensureLocalAuth();
    if (verifyLocal(password)) {
      sessionStorage.setItem(SESSION_KEY, '1');
      return { ok: true };
    }
    return { ok: false, msg: '密码错误' };
  }

  function isLoggedIn() {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function changePassword(oldPw, newPw) {
    if (!verifyLocal(oldPw)) return { ok: false, msg: '原密码错误' };
    if (String(newPw).length < 6) return { ok: false, msg: '新密码至少 6 位' };
    const salt = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    const hash = Utils.hashText(salt + String(newPw));
    localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify({ salt, hash }));
    return { ok: true };
  }

  /* ---------- 发布与备份 ---------- */
  function exportJSON() {
    return JSON.stringify(get(), null, 2);
  }

  function importJSON(text) {
    try {
      const d = JSON.parse(text);
      if (!d || !d.team || !Array.isArray(d.players) || !Array.isArray(d.hall)) {
        return { ok: false, msg: '数据格式不正确' };
      }
      assignData(d);
      return save();
    } catch (e) {
      return { ok: false, msg: '无法解析该文件' };
    }
  }

  function reset() {
    assignData(defaults());
    return save();
  }

  return {
    DEFAULT_PASSWORD,
    init,
    get,
    save,
    login,
    isLoggedIn,
    logout,
    changePassword,
    exportJSON,
    importJSON,
    reset
  };
})();
