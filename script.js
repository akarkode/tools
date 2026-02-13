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

function flashButton(btn) {
  if (!btn) return;
  btn.classList.add('flash');
  setTimeout(() => btn.classList.remove('flash'), 250);
}

Array.from(document.querySelectorAll('.btn')).forEach((btn) => {
  btn.addEventListener('click', () => flashButton(btn));
});

Array.from(document.querySelectorAll('.copy-btn')).forEach((btn) => {
  btn.addEventListener('click', () => flashButton(btn));
});

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
      .replace(/\bTrue\b/g, 'true')   // Convert Python True to JSON true
      .replace(/\bFalse\b/g, 'false') // Convert Python False to JSON false
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
  const pdfTab = $('menu-pdf');
  const jsonSection = $('json-section');
  const base64Section = $('base64-section');
  const pdfSection = $('pdf-section');

  const isJson = activeId === 'menu-json';
  const isPdf = activeId === 'menu-pdf';
  jsonSection.classList.toggle('hidden', !isJson);
  base64Section.classList.toggle('hidden', isJson || isPdf);
  pdfSection.classList.toggle('hidden', !isPdf);

  jsonTab.classList.toggle('active', isJson);
  base64Tab.classList.toggle('active', !isJson && !isPdf);
  pdfTab.classList.toggle('active', isPdf);
  jsonTab.setAttribute('aria-selected', String(isJson));
  base64Tab.setAttribute('aria-selected', String(!isJson && !isPdf));
  pdfTab.setAttribute('aria-selected', String(isPdf));

  if (isPdf && typeof resizeSignatureCanvas === 'function') {
    resizeSignatureCanvas();
    if (pdfDoc) renderPdfPage(currentPage);
  }
}

// Menu toggle
$('menu-json').addEventListener('click', () => setActiveTool('menu-json'));
$('menu-base64').addEventListener('click', () => setActiveTool('menu-base64'));
$('menu-pdf').addEventListener('click', () => setActiveTool('menu-pdf'));

Array.from(document.querySelectorAll('[data-copy-target]')).forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-copy-target');
    if (target) copyText(target, btn);
  });
});

const pdfFileInput = $('pdf-file');
const pdfCanvas = $('pdf-canvas');
const pdfViewer = $('pdf-viewer');
const pdfEmpty = $('pdf-empty');
const signatureLayer = $('signature-layer');
const signatureCanvas = $('signature-canvas');
const clearSignatureBtn = $('clear-signature');
const placeSignatureBtn = $('place-signature');
const downloadPdfBtn = $('download-pdf');
const prevPageBtn = $('prev-page');
const nextPageBtn = $('next-page');
const pageIndicator = $('page-indicator');

let pdfDoc = null;
let pdfBytes = null;
let pdfPageCount = 0;
let currentPage = 1;
let renderScale = 1;
const placedSignatures = [];
let resizeSignatureCanvas = null;

if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
}

function setPdfUiState(isReady) {
  prevPageBtn.disabled = !isReady;
  nextPageBtn.disabled = !isReady;
  placeSignatureBtn.disabled = !isReady;
  downloadPdfBtn.disabled = !isReady;
  if (pdfEmpty) pdfEmpty.hidden = isReady;
}

function updatePdfNavButtons() {
  if (!pdfDoc) return;
  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentPage >= pdfPageCount;
}

async function renderPdfPage(pageNumber) {
  if (!pdfDoc) return;
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const maxWidth = pdfViewer.clientWidth - 20;
  renderScale = maxWidth / viewport.width;
  const scaledViewport = page.getViewport({ scale: renderScale });
  const ctx = pdfCanvas.getContext('2d');
  pdfCanvas.width = scaledViewport.width;
  pdfCanvas.height = scaledViewport.height;

  await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
  signatureLayer.style.width = `${pdfCanvas.width}px`;
  signatureLayer.style.height = `${pdfCanvas.height}px`;
  signatureLayer.style.left = '0';
  signatureLayer.style.top = '0';
  updatePageIndicator();
  redrawStamps();
}

function updatePageIndicator() {
  pageIndicator.textContent = `Page ${pdfPageCount ? currentPage : 0} / ${pdfPageCount}`;
  updatePdfNavButtons();
}

function redrawStamps() {
  signatureLayer.innerHTML = '';
  placedSignatures.filter(item => item.page === currentPage).forEach((item) => {
    const stamp = document.createElement('img');
    stamp.src = item.dataUrl;
    stamp.className = 'signature-stamp';
    stamp.style.left = `${item.x * pdfCanvas.width}px`;
    stamp.style.top = `${item.y * pdfCanvas.height}px`;
    stamp.style.width = `${item.w * pdfCanvas.width}px`;
    stamp.style.height = `${item.h * pdfCanvas.height}px`;
    makeDraggable(stamp, item);
    signatureLayer.appendChild(stamp);
  });
}

function makeDraggable(element, model) {
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;

  const onPointerMove = (event) => {
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const nextX = originX + dx;
    const nextY = originY + dy;
    const maxX = pdfCanvas.width - element.offsetWidth;
    const maxY = pdfCanvas.height - element.offsetHeight;

    const clampedX = Math.max(0, Math.min(nextX, maxX));
    const clampedY = Math.max(0, Math.min(nextY, maxY));

    element.style.left = `${clampedX}px`;
    element.style.top = `${clampedY}px`;
    model.x = clampedX / pdfCanvas.width;
    model.y = clampedY / pdfCanvas.height;
  };

  const onPointerUp = () => {
    element.classList.remove('dragging');
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };

  element.addEventListener('pointerdown', (event) => {
    element.classList.add('dragging');
    startX = event.clientX;
    startY = event.clientY;
    originX = parseFloat(element.style.left) || 0;
    originY = parseFloat(element.style.top) || 0;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  });
}

function initSignaturePad() {
  const ctx = signatureCanvas.getContext('2d');
  let drawing = false;

  resizeSignatureCanvas = function () {
    const existing = signatureCanvas.width ? signatureCanvas.toDataURL('image/png') : null;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = signatureCanvas.getBoundingClientRect();
    signatureCanvas.width = width * ratio;
    signatureCanvas.height = height * ratio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineWidth = 3.5; // Slightly increased for better visibility/forgiveness
    ctx.strokeStyle = '#111827';
    if (existing) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, width, height);
      img.src = existing;
    }
  }

  resizeSignatureCanvas();
  window.addEventListener('resize', resizeSignatureCanvas);

  const getPoint = (event) => {
    const rect = signatureCanvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  };

  const startDraw = (event) => {
    drawing = true;
    const { x, y } = getPoint(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (event) => {
    if (!drawing) return;
    const { x, y } = getPoint(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => {
    drawing = false;
  };

  signatureCanvas.addEventListener('pointerdown', startDraw);
  signatureCanvas.addEventListener('pointermove', draw);
  signatureCanvas.addEventListener('pointerup', endDraw);
  signatureCanvas.addEventListener('pointerleave', endDraw);

  clearSignatureBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    showToast('Signature cleared');
  });
}

function signatureToDataUrl() {
  const tempCanvas = document.createElement('canvas');
  const ctx = tempCanvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  const width = signatureCanvas.offsetWidth;
  const height = signatureCanvas.offsetHeight;
  tempCanvas.width = width * ratio;
  tempCanvas.height = height * ratio;
  ctx.drawImage(signatureCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
  return tempCanvas.toDataURL('image/png');
}

function addSignatureStamp() {
  if (!pdfDoc) {
    showToast('Load a PDF first');
    return;
  }
  const dataUrl = signatureToDataUrl();
  const stampWidth = 0.28;
  const stampHeight = 0.12;
  const model = {
    page: currentPage,
    dataUrl,
    x: 0.1,
    y: 0.1,
    w: stampWidth,
    h: stampHeight
  };
  placedSignatures.push(model);
  redrawStamps();
  showToast('Signature placed');
}

async function loadPdf(file) {
  if (!window.pdfjsLib) {
    showToast('PDF engine failed to load');
    return;
  }
  placedSignatures.length = 0;
  pdfBytes = await file.arrayBuffer();
  const loadingTask = window.pdfjsLib.getDocument({ data: pdfBytes });
  pdfDoc = await loadingTask.promise;
  pdfPageCount = pdfDoc.numPages;
  currentPage = 1;
  setPdfUiState(true);
  await renderPdfPage(currentPage);
}

pdfFileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file || file.type !== 'application/pdf') {
    showToast('Please select a PDF file');
    return;
  }
  await loadPdf(file);
  showToast('PDF loaded');
});

prevPageBtn.addEventListener('click', async () => {
  if (!pdfDoc || currentPage <= 1) return;
  currentPage -= 1;
  await renderPdfPage(currentPage);
});

nextPageBtn.addEventListener('click', async () => {
  if (!pdfDoc || currentPage >= pdfPageCount) return;
  currentPage += 1;
  await renderPdfPage(currentPage);
});

placeSignatureBtn.addEventListener('click', addSignatureStamp);

downloadPdfBtn.addEventListener('click', async () => {
  if (!pdfBytes || !placedSignatures.length) {
    showToast('Add a signature first');
    return;
  }
  const pdfDocLib = await PDFLib.PDFDocument.load(pdfBytes);
  for (const stamp of placedSignatures) {
    const page = pdfDocLib.getPage(stamp.page - 1);
    const pngBytes = await fetch(stamp.dataUrl).then(res => res.arrayBuffer());
    const pngImage = await pdfDocLib.embedPng(pngBytes);
    const { width, height } = page.getSize();
    const drawWidth = width * stamp.w;
    const drawHeight = height * stamp.h;
    const drawX = width * stamp.x;
    const drawY = height - (height * stamp.y) - drawHeight;
    page.drawImage(pngImage, { x: drawX, y: drawY, width: drawWidth, height: drawHeight });
  }
  const signedBytes = await pdfDocLib.save();
  const blob = new Blob([signedBytes], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'signed.pdf';
  link.click();
  showToast('Signed PDF downloaded');
});

function enterToolSection(toolId) {
  $('welcome-screen').classList.add('hidden');
  $('app-container').classList.remove('hidden');
  setActiveTool(toolId);
}

// Attach event listeners to new welcome screen buttons
$('btn-enter-json').addEventListener('click', () => enterToolSection('menu-json'));
$('btn-enter-base64').addEventListener('click', () => enterToolSection('menu-base64'));
$('btn-enter-pdf').addEventListener('click', () => enterToolSection('menu-pdf'));

initSignaturePad();
setPdfUiState(false);

