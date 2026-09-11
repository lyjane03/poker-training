/* =========================================================
 * library.js — 知识库模块
 * 手册式阅读：左侧章节目录 + 右侧正文，支持锚点定位小节
 * 支持全文搜索：跨章节检索正文/术语，结果点击跳转并高亮
 * ========================================================= */
(function () {
  'use strict';

  const { CHAPTERS } = window.LibraryData;
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let currentChapter = CHAPTERS[0].id;
  let searchQuery = '';
  /** 打开章节后需要高亮并滚动的关键词 */
  let pendingHighlight = '';
  /** 由其他模块跳转时保留，用于回到原来的页面与未结束会话 */
  let returnContext = null;

  /* ---------------- 搜索索引 ---------------- */

  /** 把每个 block 拍平为可检索的纯文本片段 */
  function blockTexts(b) {
    if (b.h) return [b.h];
    if (b.p) return [b.p];
    if (b.ul) return b.ul;
    if (b.tip) return [b.tip];
    if (b.warn) return [b.warn];
    if (b.table) return b.table.head.concat(...b.table.rows);
    if (b.kv) return Object.entries(b.kv).map(([k, v]) => k + ' ' + v);
    return [];
  }

  /** 全文检索，返回 [{ ch, block, snippet, anchor }] */
  function search(q) {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    const results = [];
    for (const ch of CHAPTERS) {
      let secTitle = '';
      for (const b of ch.blocks) {
        if (b.h) secTitle = b.h;
        for (const text of blockTexts(b)) {
          const lower = text.toLowerCase();
          const idx = lower.indexOf(query);
          if (idx < 0) continue;
          const start = Math.max(0, idx - 24);
          const snippet = (start > 0 ? '…' : '') + text.slice(start, idx + query.length + 40);
          results.push({ ch, block: b, text, snippet, section: secTitle });
        }
      }
    }
    return results.slice(0, 40);
  }

  /* ---------------- 渲染 ---------------- */

  function render() {
    $('#library-panel').innerHTML = `
      <div class="panel">
        <h2>策略知识库</h2>
        <p class="sub">德扑策略理论手册 · 与题库训练、自由练习的知识点一一对应。建议按章顺序通读，遇到不熟的术语先查附录。</p>
        ${returnContext ? `
          <div class="lib-return-context">
            <span>已从「${esc(returnContext.label)}」跳转至此</span>
            <button class="btn primary" id="lib-return-source">← 返回${esc(returnContext.label)}继续训练</button>
          </div>` : ''}
        <div class="lib-search">
          <input type="search" id="lib-search-input" class="lib-search-input"
                 placeholder="搜索章节、术语、概念…（如：补牌、按钮位、同花）"
                 value="${esc(searchQuery)}">
          ${searchQuery ? '<button class="btn lib-search-clear" id="lib-search-clear">✕ 清除</button>' : ''}
        </div>
        <div class="library-layout">
          <aside class="lib-toc" id="lib-toc">
            ${CHAPTERS.map(c => `
              <button class="toc-item ${c.id === currentChapter ? 'active' : ''}" data-ch="${c.id}">
                <span class="toc-icon">${c.icon}</span>
                <span>${esc(c.title)}</span>
              </button>`).join('')}
          </aside>
          <article class="lib-body" id="lib-body"></article>
        </div>
      </div>`;

    const input = $('#lib-search-input');
    input.addEventListener('input', () => {
      searchQuery = input.value;
      renderSearchState();
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') openFirstResult();
    });
    const clearBtn = $('#lib-search-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchQuery = '';
        render();
      });
    }

    const returnSourceBtn = $('#lib-return-source');
    if (returnSourceBtn) {
      returnSourceBtn.addEventListener('click', () => {
        const sourceView = returnContext.view;
        returnContext = null;
        window.App.switchView(sourceView);
      });
    }

    document.querySelectorAll('.toc-item').forEach(btn => {
      btn.addEventListener('click', () => {
        currentChapter = btn.dataset.ch;
        document.querySelectorAll('.toc-item').forEach(b =>
          b.classList.toggle('active', b.dataset.ch === currentChapter));
        renderChapter();
      });
    });

    renderSearchState();
  }

  /** 根据 searchQuery 决定展示搜索结果还是章节正文（不重建面板，避免输入框失焦） */
  function renderSearchState() {
    if (searchQuery.trim()) {
      renderResults();
    } else {
      renderChapter();
    }
  }

  function renderResults() {
    const q = searchQuery.trim();
    const results = search(q);
    const hl = t => esc(t).replace(
      new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'),
      '<mark>$1</mark>'
    );

    $('#lib-body').innerHTML = `
      <header class="lib-chapter-head">
        <div class="lib-chapter-icon">🔎</div>
        <div>
          <h2>搜索「${esc(q)}」</h2>
          <p>共 ${results.length} 条结果${results.length >= 40 ? '（仅显示前 40 条，请换更精确的关键词）' : ''}，点击结果跳转对应章节。</p>
        </div>
      </header>
      ${results.length === 0
        ? '<div class="empty">没有找到相关内容，换个关键词试试，例如「补牌」「位置」「诈唬」。</div>'
        : results.map((r, i) => `
          <button class="lib-result" data-ri="${i}">
            <span class="lib-result-head">
              <span class="lib-result-ch">${r.ch.icon} ${esc(r.ch.title)}</span>
              ${r.section ? `<span class="lib-result-sec">${esc(r.section)}</span>` : ''}
            </span>
            <span class="lib-result-snippet">${hl(r.snippet)}</span>
          </button>`).join('')}`;

    document.querySelectorAll('.lib-result').forEach(btn => {
      btn.addEventListener('click', () => {
        const r = results[+btn.dataset.ri];
        openChapter(r.ch.id, r.text);
      });
    });
  }

  /** 打开指定章节并定位、高亮包含 text 的块 */
  function openChapter(chapterId, matchText) {
    currentChapter = chapterId;
    pendingHighlight = matchText || searchQuery.trim();
    document.querySelectorAll('.toc-item').forEach(b =>
      b.classList.toggle('active', b.dataset.ch === currentChapter));
    renderChapter();
  }

  function openFirstResult() {
    const results = search(searchQuery);
    if (results.length) openChapter(results[0].ch.id, results[0].text);
  }

  function renderChapter() {
    const ch = CHAPTERS.find(c => c.id === currentChapter);
    if (!ch) return;

    $('#lib-body').innerHTML = `
      <header class="lib-chapter-head">
        <div class="lib-chapter-icon">${ch.icon}</div>
        <div>
          <h2>${esc(ch.title)}</h2>
          <p>${esc(ch.subtitle)}</p>
        </div>
      </header>
      ${ch.blocks.map(renderBlock).join('')}
      <footer class="lib-chapter-foot">${chapterNav(ch)}</footer>`;

    document.querySelectorAll('[data-goto]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentChapter = btn.dataset.goto;
        document.querySelectorAll('.toc-item').forEach(b =>
          b.classList.toggle('active', b.dataset.ch === currentChapter));
        renderChapter();
        document.getElementById('library-panel').scrollIntoView({ behavior: 'smooth' });
      });
    });

    applyPendingHighlight();
  }

  /** 渲染后处理：高亮关键词并滚动到第一个命中块 */
  function applyPendingHighlight() {
    const q = pendingHighlight.trim();
    if (!q) return;
    pendingHighlight = '';

    const body = $('#lib-body');
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let firstMark = null;

    const walk = node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const idx = node.textContent.toLowerCase().indexOf(q.toLowerCase());
        if (idx < 0) return;
        const span = document.createElement('span');
        const after = node.textContent.slice(idx);
        node.textContent = node.textContent.slice(0, idx);
        span.innerHTML = esc(after).replace(re, '<mark>$&</mark>');
        node.parentNode.insertBefore(span, node.nextSibling);
        if (!firstMark) firstMark = span;
      } else if (node.nodeType === Node.ELEMENT_NODE && !['SCRIPT', 'STYLE', 'MARK'].includes(node.tagName)) {
        Array.from(node.childNodes).forEach(walk);
      }
    };
    walk(body);

    if (firstMark) {
      const target = firstMark.closest('.lib-h, .lib-p, .lib-ul, .lib-tip, .lib-warn, .lib-table-wrap, .kv-row') || firstMark;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function chapterNav(ch) {
    const i = CHAPTERS.indexOf(ch);
    const prev = CHAPTERS[i - 1], next = CHAPTERS[i + 1];
    return `
      ${prev ? `<button class="btn" data-goto="${prev.id}">← ${esc(prev.title)}</button>` : '<span></span>'}
      ${next ? `<button class="btn" data-goto="${next.id}">${esc(next.title)} →</button>` : '<span></span>'}`;
  }

  function renderBlock(b) {
    if (b.h) return `<h3 class="lib-h">${esc(b.h)}</h3>`;
    if (b.p) return `<p class="lib-p">${esc(b.p)}</p>`;
    if (b.ul) return `<ul class="lib-ul">${b.ul.map(li => `<li>${esc(li)}</li>`).join('')}</ul>`;
    if (b.tip) return `<div class="lib-tip"><b>💡 要点</b><p>${esc(b.tip)}</p></div>`;
    if (b.warn) return `<div class="lib-warn"><b>⚠️ 常见错误</b><p>${esc(b.warn)}</p></div>`;
    if (b.table) {
      return `<div class="lib-table-wrap"><table class="lib-table">
        <thead><tr>${b.table.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${b.table.rows.map(r =>
          `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
    }
    if (b.kv) {
      return `<dl class="lib-kv">${Object.entries(b.kv).map(([k, v]) =>
        `<div class="kv-row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
    }
    return '';
  }

  window.Library = {
    render,
    /** 外部跳转：切到知识库视图并打开指定章节 */
    open(chapterId, options) {
      if (CHAPTERS.some(c => c.id === chapterId)) currentChapter = chapterId;
      returnContext = options && options.returnView && options.returnLabel
        ? { view: options.returnView, label: options.returnLabel }
        : null;
      window.App.switchView('library');
    },
    /** 离开知识库后清除一次性的来源返回入口 */
    clearReturnContext() {
      returnContext = null;
    }
  };
})();
