document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  lucide.createIcons();

  // DOM Elements
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const configPanel = document.getElementById('config-panel');
  const processingPanel = document.getElementById('processing-panel');
  const resultPanel = document.getElementById('result-panel');

  const fileName = document.getElementById('file-name');
  const fileOriginalSize = document.getElementById('file-original-size');
  const fileIcon = document.getElementById('file-icon');
  const btnRemoveFile = document.getElementById('btn-remove-file');

  const presetBtns = document.querySelectorAll('.preset-btn');
  const sizeSlider = document.getElementById('size-slider');
  const customSizeInput = document.getElementById('custom-size-input');
  const targetFeedback = document.getElementById('target-feedback');
  const outputFormat = document.getElementById('output-format');
  const imageFormatWrapper = document.getElementById('image-format-wrapper');
  const btnCompress = document.getElementById('btn-compress');

  const processingStatus = document.getElementById('processing-status');
  const progressBar = document.getElementById('progress-bar');

  const resOldSize = document.getElementById('res-old-size');
  const resNewSize = document.getElementById('res-new-size');
  const resReductionBadge = document.getElementById('res-reduction-badge');
  const btnDownload = document.getElementById('btn-download');
  const btnReset = document.getElementById('btn-reset');

  let currentFile = null;
  let currentTargetKB = 100;
  let compressedBlob = null;

  // Drag & Drop
  dropZone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  });

  function handleFile(file) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid JPG, PNG, WEBP, or PDF file.');
      return;
    }

    currentFile = file;
    fileName.textContent = file.name;
    const sizeInKB = (file.size / 1024).toFixed(1);
    fileOriginalSize.textContent = `${sizeInKB} KB`;

    if (file.type === 'application/pdf') {
      fileIcon.innerHTML = `<i data-lucide="file-text" class="w-5 h-5 text-rose-400"></i>`;
      imageFormatWrapper.classList.add('hidden');
    } else {
      fileIcon.innerHTML = `<i data-lucide="image" class="w-5 h-5 text-indigo-400"></i>`;
      imageFormatWrapper.classList.remove('hidden');
    }
    lucide.createIcons();

    currentTargetKB = Math.min(Math.round(sizeInKB * 0.5), 100);
    if (currentTargetKB < 10) currentTargetKB = 10;
    
    updateTargetUI(currentTargetKB);

    dropZone.classList.add('hidden');
    configPanel.classList.remove('hidden');
    resultPanel.classList.add('hidden');
  }

  function updateTargetUI(val) {
    currentTargetKB = parseInt(val, 10) || 50;
    customSizeInput.value = currentTargetKB;
    sizeSlider.value = Math.min(currentTargetKB, 1500);
    targetFeedback.textContent = `${currentTargetKB} KB`;

    presetBtns.forEach(btn => {
      if (parseInt(btn.dataset.size, 10) === currentTargetKB) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      updateTargetUI(btn.dataset.size);
    });
  });

  sizeSlider.addEventListener('input', (e) => updateTargetUI(e.target.value));
  customSizeInput.addEventListener('input', (e) => updateTargetUI(e.target.value));

  btnRemoveFile.addEventListener('click', resetAll);
  btnReset.addEventListener('click', resetAll);

  function resetAll() {
    currentFile = null;
    compressedBlob = null;
    fileInput.value = '';
    dropZone.classList.remove('hidden');
    configPanel.classList.add('hidden');
    processingPanel.classList.add('hidden');
    resultPanel.classList.add('hidden');
    progressBar.style.width = '0%';
  }

  btnCompress.addEventListener('click', async () => {
    if (!currentFile) return;

    if (currentTargetKB <= 0) {
      alert('Please enter a valid target size.');
      return;
    }

    configPanel.classList.add('hidden');
    processingPanel.classList.remove('hidden');

    try {
      if (currentFile.type === 'application/pdf') {
        compressedBlob = await Compressor.compressPDF(
          currentFile,
          currentTargetKB,
          (progress, text) => updateProgress(progress, text)
        );
      } else {
        compressedBlob = await Compressor.compressImage(
          currentFile,
          currentTargetKB,
          outputFormat.value,
          (progress, text) => updateProgress(progress, text)
        );
      }

      showResults();
    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
      configPanel.classList.remove('hidden');
      processingPanel.classList.add('hidden');
    }
  });

  function updateProgress(percent, statusText) {
    progressBar.style.width = `${percent}%`;
    processingStatus.textContent = statusText;
  }

  function showResults() {
    processingPanel.classList.add('hidden');
    resultPanel.classList.remove('hidden');

    const oldKB = (currentFile.size / 1024).toFixed(1);
    const newKB = (compressedBlob.size / 1024).toFixed(1);
    const reduction = Math.round(((currentFile.size - compressedBlob.size) / currentFile.size) * 100);

    resOldSize.textContent = `${oldKB} KB`;
    resNewSize.textContent = `${newKB} KB`;

    if (reduction > 0) {
      resReductionBadge.textContent = `-${reduction}%`;
      resReductionBadge.className = 'ml-2 text-xs text-emerald-400 font-medium bg-emerald-950/60 border border-emerald-900/60 px-2 py-0.5 rounded';
    } else {
      resReductionBadge.textContent = `Optimal`;
      resReductionBadge.className = 'ml-2 text-xs text-amber-400 font-medium bg-amber-950/60 border border-amber-900/60 px-2 py-0.5 rounded';
    }

    const ext = currentFile.type === 'application/pdf' 
      ? 'pdf' 
      : (outputFormat.value === 'image/webp' ? 'webp' : 'jpg');
    
    const baseName = currentFile.name.substring(0, currentFile.name.lastIndexOf('.')) || 'optimized';
    btnDownload.download = `${baseName}_${newKB}KB.${ext}`;
    btnDownload.href = URL.createObjectURL(compressedBlob);
  }
});
