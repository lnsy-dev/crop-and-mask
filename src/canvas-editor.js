/**
 * Canvas Editor Component
 *
 * Renders the editing viewport with checkerboard background, image,
 * mask preview, and crop rectangle overlay. Handles zoom and pan.
 *
 * @extends DataroomElement
 */

import DataroomElement from 'dataroom-js';

/**
 * CanvasEditor class
 */
class CanvasEditor extends DataroomElement {
  /**
   * Initialize the canvas editor.
   *
   * @async
   * @returns {Promise<void>}
   */
  async initialize() {
    this.classList.add('canvas-area');

    this.canvas = this.create('canvas', { class: 'canvas-editor' });
    this.ctx = this.canvas.getContext('2d');

    this.image = null;
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.cropRect = { x: 0, y: 0, width: 0, height: 0 };
    this.maskCanvas = null;
    this.activeTool = 'pan';
    this.brushSize = 20;

    this.isDragging = false;
    this.isMiddlePanning = false;
    this.dragStart = { x: 0, y: 0 };
    this.dragStartPan = { x: 0, y: 0 };
    this.dragStartCrop = { x: 0, y: 0, width: 0, height: 0 };
    this.activeHandle = null;

    this.checkerPattern = this.createCheckerPattern();

    this.setupEvents();
    this.resize();

    window.addEventListener('resize', () => this.resize());
  }

  /**
   * Create a checkerboard pattern for transparency indication.
   *
   * @returns {CanvasPattern}
   */
  createCheckerPattern() {
    const size = 16;
    const c = document.createElement('canvas');
    c.width = size * 2;
    c.height = size * 2;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, size * 2, size * 2);
    ctx.fillStyle = '#222222';
    ctx.fillRect(0, 0, size, size);
    ctx.fillRect(size, size, size, size);
    return ctx.createPattern(c, 'repeat');
  }

  /**
   * Set up canvas event listeners.
   */
  setupEvents() {
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
  }

  /**
   * Resize the canvas to match the container.
   */
  resize() {
    const rect = this.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.render();
    this.event('RESIZE');
  }

  /**
   * Handle mouse wheel for zooming.
   *
   * @param {WheelEvent} e
   */
  onWheel(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX - this.pan.x) / this.zoom;
    const worldY = (mouseY - this.pan.y) / this.zoom;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.01, Math.min(50, this.zoom * zoomFactor));

    this.pan.x = mouseX - worldX * newZoom;
    this.pan.y = mouseY - worldY * newZoom;
    this.zoom = newZoom;

    this.event('ZOOM-PAN', { zoom: this.zoom, pan: { ...this.pan } });
    this.render();
  }

  /**
   * Handle pointer down.
   *
   * @param {PointerEvent} e
   */
  onPointerDown(e) {
    if (e.button !== 0 && e.button !== 1) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Color mask tool: sample on click, no drag
    if (this.activeTool === 'color-mask' && e.button === 0) {
      const worldX = (x - this.pan.x) / this.zoom;
      const worldY = (y - this.pan.y) / this.zoom;
      this.event('COLOR-MASK', { x: worldX, y: worldY });
      return;
    }

    this.isDragging = true;
    this.dragStart = { x, y };
    this.dragStartPan = { ...this.pan };
    this.dragStartCrop = { ...this.cropRect };

    // Always check for handle hit (handles are always visible)
    this.activeHandle = this.getHandleAt(x, y);

    const hadCropInteraction = this.activeHandle || this.activeTool === 'crop';
    if (hadCropInteraction) {
      this.event('CROP-BEGIN');
    }

    const isPanning = this.activeTool === 'pan' || e.button === 1;

    if (isPanning || this.activeHandle) {
      this.isMiddlePanning = e.button === 1;
      this.canvas.style.cursor = 'grabbing';
    }

    this.canvas.setPointerCapture(e.pointerId);
  }

  /**
   * Handle pointer move.
   *
   * @param {PointerEvent} e
   */
  onPointerMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update cursor for handle hover
    if (!this.isDragging) {
      const handle = this.getHandleAt(x, y);
      if (handle) {
        this.canvas.style.cursor = this.getHandleCursor(handle);
      } else if (this.activeTool === 'crop') {
        this.canvas.style.cursor = 'move';
      } else if (this.activeTool === 'color-mask') {
        this.canvas.style.cursor = 'crosshair';
      } else {
        this.canvas.style.cursor = this.activeTool === 'pan' ? 'grab' : 'default';
      }
      return;
    }

    if (!this.isDragging) return;

    const dx = x - this.dragStart.x;
    const dy = y - this.dragStart.y;

    if (this.activeHandle) {
      this.updateCropRect(dx, dy);
      this.event('CROP-CHANGE', { cropRect: { ...this.cropRect } });
      this.render();
    } else if (this.activeTool === 'crop') {
      this.cropRect.x = this.dragStartCrop.x + dx / this.zoom;
      this.cropRect.y = this.dragStartCrop.y + dy / this.zoom;
      this.event('CROP-CHANGE', { cropRect: { ...this.cropRect } });
      this.render();
    } else if (this.activeTool === 'pan' || this.isMiddlePanning) {
      this.pan.x = this.dragStartPan.x + dx;
      this.pan.y = this.dragStartPan.y + dy;
      this.event('ZOOM-PAN', { zoom: this.zoom, pan: { ...this.pan } });
      this.render();
    }
  }

  /**
   * Handle pointer up.
   *
   * @param {PointerEvent} e
   */
  onPointerUp(e) {
    if (!this.isDragging) return;

    const hadCropInteraction = this.activeHandle || this.activeTool === 'crop';

    this.isDragging = false;
    this.activeHandle = null;
    this.isMiddlePanning = false;
    this.canvas.style.cursor = this.activeTool === 'pan' ? 'grab' : 'default';

    if (hadCropInteraction) {
      this.event('CROP-END');
    }
  }

  /**
   * Get the handle under a screen point.
   *
   * @param {number} screenX
   * @param {number} screenY
   * @returns {string|null} Handle name or null.
   */
  getHandleAt(screenX, screenY) {
    const handleRadius = 6;
    const handles = this.getHandlePositions();
    for (const [name, pos] of Object.entries(handles)) {
      const hx = pos.x * this.zoom + this.pan.x;
      const hy = pos.y * this.zoom + this.pan.y;
      const dist = Math.hypot(screenX - hx, screenY - hy);
      if (dist <= handleRadius) return name;
    }
    return null;
  }

  /**
   * Get cursor style for a handle.
   *
   * @param {string} handle
   * @returns {string}
   */
  getHandleCursor(handle) {
    const cursors = {
      nw: 'nwse-resize',
      n: 'ns-resize',
      ne: 'nesw-resize',
      e: 'ew-resize',
      se: 'nwse-resize',
      s: 'ns-resize',
      sw: 'nesw-resize',
      w: 'ew-resize',
    };
    return cursors[handle] || 'move';
  }

  /**
   * Get world coordinates for all crop handles.
   *
   * @returns {Object}
   */
  getHandlePositions() {
    const { x, y, width, height } = this.dragStartCrop;
    return {
      nw: { x, y },
      n: { x: x + width / 2, y },
      ne: { x: x + width, y },
      e: { x: x + width, y: y + height / 2 },
      se: { x: x + width, y: y + height },
      s: { x: x + width / 2, y: y + height },
      sw: { x, y: y + height },
      w: { x, y: y + height / 2 },
    };
  }

  /**
   * Update crop rect based on drag delta and active handle.
   *
   * @param {number} dx - Screen delta X.
   * @param {number} dy - Screen delta Y.
   */
  updateCropRect(dx, dy) {
    const dwx = dx / this.zoom;
    const dwy = dy / this.zoom;
    const minSize = 10;
    const s = this.dragStartCrop;

    if (!this.activeHandle) {
      // Dragging the body: move the crop rect
      this.cropRect.x = s.x + dwx;
      this.cropRect.y = s.y + dwy;
      return;
    }

    switch (this.activeHandle) {
      case 'nw':
        this.cropRect.x = Math.min(s.x + dwx, s.x + s.width - minSize);
        this.cropRect.y = Math.min(s.y + dwy, s.y + s.height - minSize);
        this.cropRect.width = s.x + s.width - this.cropRect.x;
        this.cropRect.height = s.y + s.height - this.cropRect.y;
        break;
      case 'n':
        this.cropRect.y = Math.min(s.y + dwy, s.y + s.height - minSize);
        this.cropRect.height = s.y + s.height - this.cropRect.y;
        break;
      case 'ne':
        this.cropRect.y = Math.min(s.y + dwy, s.y + s.height - minSize);
        this.cropRect.width = Math.max(s.x + dwx - s.x, minSize);
        this.cropRect.height = s.y + s.height - this.cropRect.y;
        break;
      case 'e':
        this.cropRect.width = Math.max(s.x + dwx - s.x, minSize);
        break;
      case 'se':
        this.cropRect.width = Math.max(s.x + dwx - s.x, minSize);
        this.cropRect.height = Math.max(s.y + dwy - s.y, minSize);
        break;
      case 's':
        this.cropRect.height = Math.max(s.y + dwy - s.y, minSize);
        break;
      case 'sw':
        this.cropRect.x = Math.min(s.x + dwx, s.x + s.width - minSize);
        this.cropRect.width = s.x + s.width - this.cropRect.x;
        this.cropRect.height = Math.max(s.y + dwy - s.y, minSize);
        break;
      case 'w':
        this.cropRect.x = Math.min(s.x + dwx, s.x + s.width - minSize);
        this.cropRect.width = s.x + s.width - this.cropRect.x;
        break;
    }
  }

  /**
   * Calculate zoom and pan to fit the crop rect in the viewport.
   */
  fit() {
    if (this.cropRect.width <= 0 || this.cropRect.height <= 0) return;
    const padding = 40;
    const availW = this.canvas.width - padding * 2;
    const availH = this.canvas.height - padding * 2;
    const scaleX = availW / this.cropRect.width;
    const scaleY = availH / this.cropRect.height;
    this.zoom = Math.min(scaleX, scaleY, 10);
    this.pan.x = (this.canvas.width - this.cropRect.width * this.zoom) / 2 - this.cropRect.x * this.zoom;
    this.pan.y = (this.canvas.height - this.cropRect.height * this.zoom) / 2 - this.cropRect.y * this.zoom;
    this.event('ZOOM-PAN', { zoom: this.zoom, pan: { ...this.pan } });
    this.render();
  }

  /**
   * Main render loop.
   */
  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Checkerboard background
    ctx.fillStyle = this.checkerPattern;
    ctx.fillRect(0, 0, w, h);

    if (!this.image) return;

    // Draw image
    const imgX = this.pan.x;
    const imgY = this.pan.y;
    const imgW = this.image.naturalWidth * this.zoom;
    const imgH = this.image.naturalHeight * this.zoom;
    ctx.drawImage(this.image, imgX, imgY, imgW, imgH);

    // Apply mask alpha (make masked areas transparent)
    if (this.maskCanvas) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(this.maskCanvas, imgX, imgY, imgW, imgH);
      ctx.restore();
    }

    // Darken outside crop rect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    const cropScreenX = this.cropRect.x * this.zoom + this.pan.x;
    const cropScreenY = this.cropRect.y * this.zoom + this.pan.y;
    const cropScreenW = this.cropRect.width * this.zoom;
    const cropScreenH = this.cropRect.height * this.zoom;

    // Top
    ctx.fillRect(0, 0, w, cropScreenY);
    // Bottom
    ctx.fillRect(0, cropScreenY + cropScreenH, w, h - cropScreenY - cropScreenH);
    // Left
    ctx.fillRect(0, cropScreenY, cropScreenX, cropScreenH);
    // Right
    ctx.fillRect(cropScreenX + cropScreenW, cropScreenY, w - cropScreenX - cropScreenW, cropScreenH);

    // Crop rect outline
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(cropScreenX, cropScreenY, cropScreenW, cropScreenH);
    ctx.setLineDash([]);

    // Draw handles (always visible)
    const handleSize = 8;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;

    const handles = [
      { x: cropScreenX, y: cropScreenY },
      { x: cropScreenX + cropScreenW / 2, y: cropScreenY },
      { x: cropScreenX + cropScreenW, y: cropScreenY },
      { x: cropScreenX + cropScreenW, y: cropScreenY + cropScreenH / 2 },
      { x: cropScreenX + cropScreenW, y: cropScreenY + cropScreenH },
      { x: cropScreenX + cropScreenW / 2, y: cropScreenY + cropScreenH },
      { x: cropScreenX, y: cropScreenY + cropScreenH },
      { x: cropScreenX, y: cropScreenY + cropScreenH / 2 },
    ];

    handles.forEach((pos) => {
      const hx = pos.x - handleSize / 2;
      const hy = pos.y - handleSize / 2;
      ctx.fillRect(hx, hy, handleSize, handleSize);
      ctx.strokeRect(hx, hy, handleSize, handleSize);
    });
  }

  /**
   * Set the current image.
   *
   * @param {HTMLImageElement} image
   */
  setImage(image) {
    this.image = image;
  }

  /**
   * Set the zoom level.
   *
   * @param {number} zoom
   */
  setZoom(zoom) {
    this.zoom = zoom;
  }

  /**
   * Set the pan offset.
   *
   * @param {{x: number, y: number}} pan
   */
  setPan(pan) {
    this.pan = pan;
  }

  /**
   * Set the crop rectangle.
   *
   * @param {{x: number, y: number, width: number, height: number}} rect
   */
  setCropRect(rect) {
    this.cropRect = rect;
  }

  /**
   * Set the mask canvas for preview.
   *
   * @param {HTMLCanvasElement} canvas
   */
  setMaskCanvas(canvas) {
    this.maskCanvas = canvas;
  }

  /**
   * Set the active tool.
   *
   * @param {string} tool
   */
  setTool(tool) {
    this.activeTool = tool;
    this.canvas.style.cursor = tool === 'pan' ? 'grab' : 'default';
  }

  /**
   * Set the brush size.
   *
   * @param {number} size
   */
  setBrushSize(size) {
    this.brushSize = size;
  }
}

if (!customElements.get('canvas-editor')) {
  customElements.define('canvas-editor', CanvasEditor);
}
