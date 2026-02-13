function $(id) {
  return document.getElementById(id);
}

const toast = $('toast');
let toastTimer;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 1600);
}

function toBase64(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

function fromBase64(text) {
  return decodeURIComponent(escape(atob(text)));
}

function beautifyJSON() {
  try {
    let raw = $('json-input').value
      .replace(/'/g, '"')
      .replace(/\bNone\b/g, 'null')
      .replace(/:([ \t]*)(?=[,}])/g, ': null');

    const obj = JSON.parse(raw);
    $('json-output').value = JSON.stringify(obj, null, 2);
  } catch (err) {
    $('json-output').value = 'Invalid JSON!';
  }
  autoResize($('json-output'));
}

function decodeBase64() {
  try {
    $('base64-output').value = fromBase64($('base64-input').value);
  } catch {
    $('base64-output').value = 'Invalid Base64!';
  }
  autoResize($('base64-output'));
}

function encodeBase64() {
  try {
    $('base64-output').value = toBase64($('base64-input').value);
  } catch {
    $('base64-output').value = 'Invalid Base64!';
  }
  autoResize($('base64-output'));
}

function pasteText(targetId) {
  navigator.clipboard.readText().then(text => {
    $(targetId).value = text;
    autoResize($(targetId));
    showToast('Pasted');
  }).catch(() => {
    showToast('Clipboard access denied');
  });
}

function copyText(targetId, triggerBtn) {
  navigator.clipboard.writeText($(targetId).value).then(() => {
    if (triggerBtn) {
      const label = triggerBtn.querySelector('.btn-label');
      triggerBtn.classList.add('copied');
      if (label) label.textContent = 'Copied';
      setTimeout(() => {
        triggerBtn.classList.remove('copied');
        if (label) label.textContent = 'Copy';
      }, 1200);
    }
    showToast('Copied');
  }).catch(() => {
    showToast('Copy failed');
  });
}

function exportToFile(targetId, fallbackName) {
  const value = $(targetId).value;
  const isJSON = fallbackName.endsWith('.json');

  // Generate random file name with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const randomPart = Math.random().toString(36).substring(2, 8);
  const filename = `${isJSON ? 'beautified' : 'output'}-${timestamp}-${randomPart}.${isJSON ? 'json' : 'txt'}`;

  let blob;
  try {
    blob = new Blob(
      [isJSON ? JSON.stringify(JSON.parse(value), null, 2) : value],
      { type: isJSON ? 'application/json' : 'text/plain' }
    );
  } catch {
    blob = new Blob([value], { type: 'text/plain' });
  }

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

// Attach auto-resize to all textareas
Array.from(document.querySelectorAll('textarea')).forEach((ta) => {
  ta.addEventListener('input', () => autoResize(ta));
  autoResize(ta);
});

function setActiveTool(activeId) {
  const jsonTab = $('menu-json');
  const base64Tab = $('menu-base64');
  const jsonSection = $('json-section');
  const base64Section = $('base64-section');

  const isJson = activeId === 'menu-json';
  jsonSection.classList.toggle('hidden', !isJson);
  base64Section.classList.toggle('hidden', isJson);

  jsonTab.classList.toggle('active', isJson);
  base64Tab.classList.toggle('active', !isJson);
  jsonTab.setAttribute('aria-selected', String(isJson));
  base64Tab.setAttribute('aria-selected', String(!isJson));
}

// Menu toggle
$('menu-json').addEventListener('click', () => setActiveTool('menu-json'));
$('menu-base64').addEventListener('click', () => setActiveTool('menu-base64'));

Array.from(document.querySelectorAll('[data-copy-target]')).forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-copy-target');
    if (target) copyText(target, btn);
  });
});
