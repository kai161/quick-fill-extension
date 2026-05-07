// content-main.js - 运行在页面主环境（MAIN world），可访问 window.monaco 及 DOM 内部属性
(function () {
  if (window.__qfMainInjected) return;
  window.__qfMainInjected = true;

  function getMonacoValue() {
    // 方法1：window.monaco 全局（标准暴露方式）
    if (window.monaco && window.monaco.editor) {
      try {
        const editors = window.monaco.editor.getEditors();
        for (const ed of editors) {
          if (ed.hasTextFocus && ed.hasTextFocus()) return ed.getValue();
        }
        if (editors.length) return editors[0].getValue();
      } catch {}
    }

    // 方法2：遍历 .monaco-editor 容器元素的内部属性，找挂载的编辑器实例
    // Monaco 会把实例以私有 key 形式挂到容器 DOM 上
    const containers = document.querySelectorAll('.monaco-editor');
    for (const container of containers) {
      // 只找有焦点的编辑器容器
      if (!container.contains(document.activeElement)) continue;
      const keys = Object.keys(container);
      for (const k of keys) {
        try {
          const v = container[k];
          if (v && typeof v.getValue === 'function') {
            const val = v.getValue();
            if (typeof val === 'string') return val;
          }
          // 兼容部分版本：实例挂在 _modelData 上
          if (v && v._modelData && typeof v.getValue === 'function') {
            return v.getValue();
          }
        } catch {}
      }
    }

    // 方法3：不限制焦点，取第一个找到的编辑器
    for (const container of containers) {
      const keys = Object.keys(container);
      for (const k of keys) {
        try {
          const v = container[k];
          if (v && typeof v.getValue === 'function') {
            const val = v.getValue();
            if (typeof val === 'string' && val.length > 0) return val;
          }
        } catch {}
      }
    }

    return '';
  }

  window.addEventListener('message', e => {
    if (!e.data || e.data.__qf_type !== 'GET_MONACO_VALUE') return;
    const value = getMonacoValue();
    window.postMessage({ __qf_type: 'MONACO_VALUE', __qf_id: e.data.__qf_id, value }, '*');
  });
})();
