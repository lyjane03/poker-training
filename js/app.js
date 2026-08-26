/* =========================================================
 * app.js — 应用入口：标签切换与初始化
 * ========================================================= */
(function () {
  'use strict';

  function switchView(name) {
    // 题库跳转到知识库的返回入口只在本次知识库浏览期间有效。
    if (name !== 'library' && window.Library) window.Library.clearQuizReturn();
    document.querySelectorAll('.tab').forEach(t =>
      t.classList.toggle('active', t.dataset.view === name));
    document.querySelectorAll('.view').forEach(v =>
      v.classList.toggle('active', v.id === 'view-' + name));
    if (name === 'quiz') window.Quiz.renderHome();
    if (name === 'draws') window.Draws.renderHome();
    if (name === 'drill') window.Drill.renderHome();
    if (name === 'game') window.Game.renderHome();
    if (name === 'equity') window.Equity.render();
    if (name === 'range') window.RangeTrainer.render();
    if (name === 'library') window.Library.render();
    if (name === 'history') window.History.render();
  }

  document.querySelectorAll('.tab').forEach(t =>
    t.addEventListener('click', () => switchView(t.dataset.view)));

  window.App = { switchView };

  // 初始化
  window.Quiz.renderHome();
})();
