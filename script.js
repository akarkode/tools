function $(id) {
  return document.getElementById(id);
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
    $('base64-output').value = atob($('base64-input').value);
  } catch {
    $('base64-output').value = 'Invalid Base64!';
  }
  autoResize($('base64-output'));
}

function encodeBase64() {
  $('base64-output').value = btoa($('base64-input').value);
  autoResize($('base64-output'));
}


function pasteText(targetId) {
  navigator.clipboard.readText().then(text => {
    $(targetId).value = text;
    autoResize($(targetId));
  });
}

function copyText(targetId) {
  navigator.clipboard.writeText($(targetId).value);
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
  textarea.style.height = (textarea.scrollHeight) + 'px';
}

// Attach auto-resize to all textareas
document.querySelectorAll('textarea').forEach((ta) => {
  ta.addEventListener('input', () => autoResize(ta));
  autoResize(ta);
});

// Menu toggle
$('menu-json').addEventListener('click', () => {
  $('json-section').classList.remove('hidden');
  $('base64-section').classList.add('hidden');
  $('menu-json').classList.add('active');
  $('menu-base64').classList.remove('active');
});

$('menu-base64').addEventListener('click', () => {
  $('base64-section').classList.remove('hidden');
  $('json-section').classList.add('hidden');
  $('menu-base64').classList.add('active');
  $('menu-json').classList.remove('active');
});

// === Obfuscation-like wrapper for encodeBase64 ===
(function () {
  const b64 = 'ZnVuY3Rpb24gZW5jb2RlQmFzZTY0KCkgeyBjb25zdCB0ZXh0ID0gJChcImJhc2U2NC1pbnB1dFwiKS52YWx1ZTsgJChcImJhc2U2NC1vdXRwdXRcIikudmFsdWUgPSBidG9hKHRleHQpOyB9';
  window.encodeBase64 = new Function('return ' + atob(b64))();
})();
