/**
 * TargetFit - Core Compression Engine
 * 100% Client-Side Binary Search Compressor for Images and PDFs
 */

// Initialize PDF.js Worker
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const Compressor = {

  /**
   * Compress Image to Target KB using Multi-Pass Binary Search
   */
  async compressImage(file, targetSizeKB, outputFormat = 'image/jpeg', onProgress) {
    const targetBytes = targetSizeKB * 1024;
    
    // Load image into memory
    const img = await this.loadImage(file);
    let originalWidth = img.naturalWidth;
    let originalHeight = img.naturalHeight;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false });

    let minQuality = 0.05;
    let maxQuality = 0.98;
    let bestBlob = null;
    let currentScale = 1.0;

    if (onProgress) onProgress(20, "Analyzing image structure...");

    // 3 passes: scale down if quality tuning alone cannot fit target KB
    for (let pass = 0; pass < 3; pass++) {
      canvas.width = Math.round(originalWidth * currentScale);
      canvas.height = Math.round(originalHeight * currentScale);

      // White background fallback for transparent PNGs
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      minQuality = 0.05;
      maxQuality = 0.98;

      // Binary search for optimal encoding quality
      for (let i = 0; i < 7; i++) {
        const midQuality = (minQuality + maxQuality) / 2;
        const blob = await this.canvasToBlob(canvas, outputFormat, midQuality);

        if (blob.size <= targetBytes) {
          bestBlob = blob;
          minQuality = midQuality; // Try higher quality
        } else {
          maxQuality = midQuality; // Reduce quality
        }

        if (onProgress) {
          const p = 30 + (pass * 20) + (i * 3);
          onProgress(Math.min(p, 90), `Optimizing target size (${(blob.size / 1024).toFixed(1)} KB)...`);
        }
      }

      // If we met the criteria under target bytes, break
      if (bestBlob && bestBlob.size <= targetBytes) {
        break;
      }

      // If still too big, scale dimensions down
      currentScale *= 0.75;
    }

    if (!bestBlob) {
      bestBlob = await this.canvasToBlob(canvas, outputFormat, 0.05);
    }

    if (onProgress) onProgress(100, "Compression complete!");
    return bestBlob;
  },

  /**
   * Compress PDF to Target KB
   */
  async compressPDF(file, targetSizeKB, onProgress) {
    const targetBytes = targetSizeKB * 1024;
    const arrayBuffer = await file.arrayBuffer();

    if (onProgress) onProgress(15, "Loading PDF document...");
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    // Budget bytes per page (15% reserve for PDF document header/structures)
    const availableBytesForPages = targetBytes * 0.85;
    const targetBytesPerPage = Math.max(10 * 1024, Math.floor(availableBytesForPages / numPages));

    const newPdfDoc = await PDFLib.PDFDocument.create();

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      if (onProgress) {
        const progress = 20 + Math.round((pageNum / numPages) * 70);
        onProgress(progress, `Processing page ${pageNum} of ${numPages}...`);
      }

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 }); // Clear readable DPI

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      // Binary search for this page's JPEG representation
      let minQ = 0.05;
      let maxQ = 0.90;
      let pageBlob = null;

      for (let i = 0; i < 5; i++) {
        const midQ = (minQ + maxQ) / 2;
        const b = await this.canvasToBlob(canvas, 'image/jpeg', midQ);
        if (b.size <= targetBytesPerPage) {
          pageBlob = b;
          minQ = midQ;
        } else {
          maxQ = midQ;
        }
      }

      if (!pageBlob) {
        pageBlob = await this.canvasToBlob(canvas, 'image/jpeg', 0.1);
      }

      // Re-embed into new PDF
      const imgBytes = await pageBlob.arrayBuffer();
      const embeddedImage = await newPdfDoc.embedJpg(imgBytes);
      const newPage = newPdfDoc.addPage([viewport.width, viewport.height]);
      newPage.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
      });
    }

    if (onProgress) onProgress(95, "Finalizing compressed PDF...");
    const finalPdfBytes = await newPdfDoc.save();
    return new Blob([finalPdfBytes], { type: 'application/pdf' });
  },

  // Helper: Load File into Image element
  loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  },

  // Helper: Convert canvas to Blob
  canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), mimeType, quality);
    });
  }
};