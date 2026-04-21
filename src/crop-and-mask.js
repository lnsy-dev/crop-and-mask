/**
 * Crop and Mask App
 *
 * Main orchestrator component for the image editor.
 * Manages state, coordinates child components, and handles file I/O.
 *
 * @extends DataroomElement
 */

import DataroomElement from 'dataroom-js';
import './toolbar.js';
import './canvas-editor.js';
import './mask-brush.js';
import { loadOpenCV, removeBackground, refineMask } from './opencv-loader.js';

/**
 * CropAndMask class
 */
class CropAndMask extends DataroomElement {
  /**
   * Initialize the application.
   *
   * @async
   * @returns {Promise<void>}
   */
  async initialize() {
    this.image = null;
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.cropRect = { x: 0, y: 0, width: 0, height: 0 };
    this.brushSize = 20;
    this.activeTool = 'pan';
    this.colorVariance = 0.15;
    this.isOpencvReady = false;
    this.isOpencvLoading = false;
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 50;
    this.isSavingState = false;

    // Create child components
    this.toolbar = this.create('toolbar-element');
    this.canvasEditor = this.create('canvas-editor');
    this.maskBrush = this.create('mask-brush');

    // Append mask brush into canvas editor's area so it overlays
    this.canvasEditor.appendChild(this.maskBrush);

    this.setupEventListeners();
    this.setupDragAndDrop();
    this.setupKeyboardShortcuts();
  }

  /**
   * Set up event listeners bridging child components.
   */
  setupEventListeners() {
    // Toolbar events
    this.toolbar.on('TOOL-CHANGE', (detail) => {
      this.activeTool = detail.tool;
      this.canvasEditor.setTool(this.activeTool);
      this.maskBrush.setTool(this.activeTool);
    });

    this.toolbar.on('BRUSH-SIZE-CHANGE', (detail) => {
      this.brushSize = detail.size;
      this.canvasEditor.setBrushSize(this.brushSize);
      this.maskBrush.setBrushSize(this.brushSize);
    });

    this.toolbar.on('ZOOM-IN', () => {
      this.zoom *= 1.2;
      this.updateZoomPan();
    });

    this.toolbar.on('ZOOM-OUT', () => {
      this.zoom /= 1.2;
      this.updateZoomPan();
    });

    this.toolbar.on('ZOOM-FIT', () => {
      this.canvasEditor.fit();
    });

    this.toolbar.on('FILE-SELECTED', (detail) => {
      this.loadFile(detail.file);
    });

    this.toolbar.on('REMOVE-BG', () => {
      this.handleRemoveBackground();
    });

    this.toolbar.on('REFINE-MASK', () => {
      this.handleRefineMask();
    });

    this.toolbar.on('DOWNLOAD', () => {
      this.download();
    });

    this.toolbar.on('COLOR-VARIANCE-CHANGE', (detail) => {
      this.colorVariance = detail.variance;
    });

    this.toolbar.on('UNDO', () => this.undo());
    this.toolbar.on('REDO', () => this.redo());

    // Canvas editor events
    this.canvasEditor.on('ZOOM-PAN', (detail) => {
      this.zoom = detail.zoom;
      this.pan = detail.pan;
      this.maskBrush.setZoom(this.zoom);
      this.maskBrush.setPan(this.pan);
    });

    this.canvasEditor.on('CROP-CHANGE', (detail) => {
      this.cropRect = detail.cropRect;
    });

    this.canvasEditor.on('RESIZE', () => {
      this.maskBrush.setOverlaySize(this.canvasEditor.canvas.width, this.canvasEditor.canvas.height);
    });

    this.canvasEditor.on('COLOR-MASK', (detail) => {
      this.maskByColor(detail.x, detail.y);
      this.saveState();
    });

    this.canvasEditor.on('CROP-BEGIN', () => {
      this.saveState();
    });

    // Mask brush events
    this.renderPending = false;
    this.maskBrush.on('MASK-UPDATED', () => {
      if (this.renderPending) return;
      this.renderPending = true;
      requestAnimationFrame(() => {
        this.renderPending = false;
        this.canvasEditor.setMaskCanvas(this.maskBrush.getMaskCanvas());
        this.canvasEditor.render();
      });
    });

    this.maskBrush.on('MASK-BEGIN', () => {
      this.saveState();
    });
  }

  /**
   * Update zoom and pan across all components.
   */
  updateZoomPan() {
    this.canvasEditor.setZoom(this.zoom);
    this.canvasEditor.setPan(this.pan);
    this.canvasEditor.render();
    this.maskBrush.setZoom(this.zoom);
    this.maskBrush.setPan(this.pan);
  }

  /**
   * Load an image file.
   *
   * @param {File} file
   */
  loadFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        this.image = img;
        this.cropRect = { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
        this.zoom = 1;

        // Center the image in the viewport
        const canvasW = this.canvasEditor.canvas.width;
        const canvasH = this.canvasEditor.canvas.height;
        this.pan = {
          x: (canvasW - img.naturalWidth) / 2,
          y: (canvasH - img.naturalHeight) / 2,
        };

        this.maskBrush.setImageSize(img.naturalWidth, img.naturalHeight);
        this.maskBrush.setOverlaySize(canvasW, canvasH);
        this.maskBrush.setZoom(this.zoom);
        this.maskBrush.setPan(this.pan);

        this.canvasEditor.setImage(img);
        this.canvasEditor.setCropRect(this.cropRect);
        this.canvasEditor.setZoom(this.zoom);
        this.canvasEditor.setPan(this.pan);
        this.canvasEditor.setMaskCanvas(this.maskBrush.getMaskCanvas());
        this.canvasEditor.render();

        // Fit after a brief delay to ensure canvas has sized
        requestAnimationFrame(() => {
          this.canvasEditor.fit();
        });

        // Clear history when a new image is loaded
        this.undoStack = [];
        this.redoStack = [];
        this.updateUndoRedoButtons();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  /**
   * Ensure OpenCV is loaded.
   *
   * @returns {Promise<boolean>}
   */
  async ensureOpenCV() {
    if (this.isOpencvReady) return true;
    if (this.isOpencvLoading) return false;

    this.isOpencvLoading = true;
    this.toolbar.setOpenCVEnabled(false, true);

    try {
      await loadOpenCV();
      this.isOpencvReady = true;
      this.isOpencvLoading = false;
      this.toolbar.setOpenCVEnabled(true, false);
      return true;
    } catch (err) {
      console.error('OpenCV load failed:', err);
      this.isOpencvLoading = false;
      this.toolbar.setOpenCVEnabled(false, false);
      return false;
    }
  }

  /**
   * Mask pixels similar to the color at the given world coordinates.
   *
   * @param {number} worldX
   * @param {number} worldY
   */
  maskByColor(worldX, worldY) {
    if (!this.image) return;

    const imgW = this.image.naturalWidth;
    const imgH = this.image.naturalHeight;
    const pixelX = Math.max(0, Math.min(imgW - 1, Math.floor(worldX)));
    const pixelY = Math.max(0, Math.min(imgH - 1, Math.floor(worldY)));

    // Get image pixel data
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imgW;
    tempCanvas.height = imgH;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(this.image, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, imgW, imgH);

    // Sample the clicked color
    const idx = (pixelY * imgW + pixelX) * 4;
    const sampleR = imageData.data[idx];
    const sampleG = imageData.data[idx + 1];
    const sampleB = imageData.data[idx + 2];

    // Update existing mask
    const mask = this.maskBrush.getMaskCanvas();
    const maskCtx = mask.getContext('2d');
    const maskData = maskCtx.getImageData(0, 0, mask.width, mask.height);

    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];

      const dr = Math.abs(r - sampleR) / 255;
      const dg = Math.abs(g - sampleG) / 255;
      const db = Math.abs(b - sampleB) / 255;

      if (dr <= this.colorVariance && dg <= this.colorVariance && db <= this.colorVariance) {
        maskData.data[i] = 0;
        maskData.data[i + 1] = 0;
        maskData.data[i + 2] = 0;
        maskData.data[i + 3] = 0;
      }
    }

    this.saveState();

    maskCtx.putImageData(maskData, 0, 0);
    this.canvasEditor.setMaskCanvas(this.maskBrush.getMaskCanvas());
    this.canvasEditor.render();
  }

  /**
   * Handle background removal request.
   */
  async handleRemoveBackground() {
    if (!this.image) return;
    const ready = await this.ensureOpenCV();
    if (!ready) return;

    this.saveState();

    try {
      const maskCanvas = this.maskBrush.getMaskCanvas();
      const resultMask = await removeBackground(this.image, maskCanvas);
      this.maskBrush.setMaskCanvas(resultMask);
      this.canvasEditor.setMaskCanvas(this.maskBrush.getMaskCanvas());
      this.canvasEditor.render();
    } catch (err) {
      console.error('Background removal failed:', err);
    }
  }

  /**
   * Handle mask refinement request.
   */
  async handleRefineMask() {
    if (!this.image) return;
    const ready = await this.ensureOpenCV();
    if (!ready) return;

    this.saveState();

    try {
      const maskCanvas = this.maskBrush.getMaskCanvas();
      const refined = await refineMask(maskCanvas);
      this.maskBrush.setMaskCanvas(refined);
      this.canvasEditor.setMaskCanvas(this.maskBrush.getMaskCanvas());
      this.canvasEditor.render();
    } catch (err) {
      console.error('Mask refinement failed:', err);
    }
  }

  /**
   * Save the current document state to the undo stack.
   */
  saveState() {
    if (this.isSavingState || !this.image) return;
    this.isSavingState = true;

    const mask = this.maskBrush.getMaskCanvas();
    const maskClone = document.createElement('canvas');
    maskClone.width = mask.width;
    maskClone.height = mask.height;
    maskClone.getContext('2d').drawImage(mask, 0, 0);

    this.undoStack.push({
      maskCanvas: maskClone,
      cropRect: { ...this.cropRect },
    });

    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }

    this.redoStack = [];
    this.updateUndoRedoButtons();
    this.isSavingState = false;
  }

  /**
   * Undo the last operation.
   */
  undo() {
    if (this.undoStack.length === 0 || !this.image) return;

    // Save current state to redo stack
    const mask = this.maskBrush.getMaskCanvas();
    const currentMaskClone = document.createElement('canvas');
    currentMaskClone.width = mask.width;
    currentMaskClone.height = mask.height;
    currentMaskClone.getContext('2d').drawImage(mask, 0, 0);

    this.redoStack.push({
      maskCanvas: currentMaskClone,
      cropRect: { ...this.cropRect },
    });

    // Restore previous state
    const state = this.undoStack.pop();
    this.cropRect = { ...state.cropRect };
    this.maskBrush.setMaskCanvas(state.maskCanvas);
    this.canvasEditor.setCropRect(this.cropRect);
    this.canvasEditor.setMaskCanvas(this.maskBrush.getMaskCanvas());
    this.canvasEditor.render();
    this.updateUndoRedoButtons();
  }

  /**
   * Redo the last undone operation.
   */
  redo() {
    if (this.redoStack.length === 0 || !this.image) return;

    // Save current state to undo stack
    const mask = this.maskBrush.getMaskCanvas();
    const currentMaskClone = document.createElement('canvas');
    currentMaskClone.width = mask.width;
    currentMaskClone.height = mask.height;
    currentMaskClone.getContext('2d').drawImage(mask, 0, 0);

    this.undoStack.push({
      maskCanvas: currentMaskClone,
      cropRect: { ...this.cropRect },
    });

    // Restore next state
    const state = this.redoStack.pop();
    this.cropRect = { ...state.cropRect };
    this.maskBrush.setMaskCanvas(state.maskCanvas);
    this.canvasEditor.setCropRect(this.cropRect);
    this.canvasEditor.setMaskCanvas(this.maskBrush.getMaskCanvas());
    this.canvasEditor.render();
    this.updateUndoRedoButtons();
  }

  /**
   * Update the enabled state of undo/redo buttons.
   */
  updateUndoRedoButtons() {
    this.toolbar.setUndoRedoState({
      undo: this.undoStack.length > 0,
      redo: this.redoStack.length > 0,
    });
  }

  /**
   * Set up keyboard shortcuts for undo/redo.
   * Supports Cmd+Z / Ctrl+Z (undo) and Cmd+Y / Ctrl+Y / Cmd+Shift+Z / Ctrl+Shift+Z (redo).
   */
  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.undo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        this.redo();
      }
    });
  }

  /**
   * Set up drag-and-drop file handling.
   */
  setupDragAndDrop() {
    const dropTarget = this.canvasEditor;

    dropTarget.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      dropTarget.classList.add('drag-over');
    });

    dropTarget.addEventListener('dragleave', (e) => {
      dropTarget.classList.remove('drag-over');
    });

    dropTarget.addEventListener('drop', (e) => {
      e.preventDefault();
      dropTarget.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          this.loadFile(file);
        }
      }
    });
  }

  /**
   * Download the cropped and masked image as PNG.
   */
  download() {
    if (!this.image) return;

    const { x, y, width, height } = this.cropRect;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Draw the image portion that falls within the crop
    ctx.drawImage(this.image, -x, -y);

    // Convert grayscale mask to alpha mask for compositing
    const mask = this.maskBrush.getMaskCanvas();
    const maskCtx = mask.getContext('2d');
    const maskData = maskCtx.getImageData(0, 0, mask.width, mask.height);
    const alphaCanvas = document.createElement('canvas');
    alphaCanvas.width = mask.width;
    alphaCanvas.height = mask.height;
    const alphaCtx = alphaCanvas.getContext('2d');
    const alphaData = alphaCtx.createImageData(mask.width, mask.height);

    for (let i = 0; i < maskData.data.length; i += 4) {
      const gray = maskData.data[i];
      alphaData.data[i] = 255;
      alphaData.data[i + 1] = 255;
      alphaData.data[i + 2] = 255;
      alphaData.data[i + 3] = gray;
    }
    alphaCtx.putImageData(alphaData, 0, 0);

    // Apply mask using destination-in composite
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(alphaCanvas, -x, -y);

    // Export PNG
    const link = document.createElement('a');
    link.download = 'cropped-masked.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }
}

if (!customElements.get('crop-and-mask')) {
  customElements.define('crop-and-mask', CropAndMask);
}
