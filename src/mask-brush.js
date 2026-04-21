/**
 * Mask Brush Component
 *
 * Overlay canvas for drawing brush strokes onto a mask.
 * White pixels on the mask represent opaque (keep) areas.
 * Black pixels represent transparent (remove) areas.
 *
 * @extends DataroomElement
 */

import DataroomElement from 'dataroom-js';

/**
 * MaskBrush class
 */
class MaskBrush extends DataroomElement {
  /**
   * Initialize the mask brush overlay.
   *
   * @async
   * @returns {Promise<void>}
   */
  async initialize() {
    this.classList.add('mask-brush');

    // Hidden mask canvas (stores the actual mask)
    this.maskCanvas = document.createElement('canvas');
    this.maskCtx = this.maskCanvas.getContext('2d');

    // Visible overlay canvas (captures pointer events)
    this.overlayCanvas = this.create('canvas', { class: 'brush-overlay' });
    this.overlayCtx = this.overlayCanvas.getContext('2d');

    // Custom cursor element
    this.cursor = this.create('div', { class: 'brush-cursor' });

    this.isDrawing = false;
    this.lastPoint = null;
    this.brushSize = 20;
    this.activeTool = 'pan';
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };

    this.setupEvents();
    this.setTool(this.activeTool);
  }

  /**
   * Set up pointer event listeners.
   */
  setupEvents() {
    this.overlayCanvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
  }

  /**
   * Handle pointer down.
   *
   * @param {PointerEvent} e
   */
  onPointerDown(e) {
    if (!this.isBrushActive()) return;
    if (e.button !== 0) return;

    this.event('MASK-BEGIN');
    this.isDrawing = true;
    this.lastPoint = this.getMaskPoint(e);
    this.drawPoint(this.lastPoint);
    this.overlayCanvas.setPointerCapture(e.pointerId);
  }

  /**
   * Handle pointer move.
   *
   * @param {PointerEvent} e
   */
  onPointerMove(e) {
    const rect = this.overlayCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update cursor position
    this.updateCursor(x, y);

    if (!this.isDrawing || !this.isBrushActive()) return;

    const point = this.getMaskPoint(e);
    this.drawLine(this.lastPoint, point);
    this.lastPoint = point;
    this.event('MASK-UPDATED');
  }

  /**
   * Handle pointer up.
   *
   * @param {PointerEvent} e
   */
  onPointerUp(e) {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.lastPoint = null;
    this.event('MASK-UPDATED');
    this.event('MASK-END');
  }

  /**
   * Check if a brush tool is currently active.
   *
   * @returns {boolean}
   */
  isBrushActive() {
    return this.activeTool === 'brush-add' || this.activeTool === 'brush-remove';
  }

  /**
   * Convert screen pointer event to mask canvas coordinates.
   *
   * @param {PointerEvent} e
   * @returns {{x: number, y: number}}
   */
  getMaskPoint(e) {
    const rect = this.overlayCanvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldX = (screenX - this.pan.x) / this.zoom;
    const worldY = (screenY - this.pan.y) / this.zoom;
    return { x: worldX, y: worldY };
  }

  /**
   * Draw a single brush point on the mask canvas.
   *
   * @param {{x: number, y: number}} point
   */
  drawPoint(point) {
    if (this.activeTool === 'brush-add') {
      this.maskCtx.globalCompositeOperation = 'destination-out';
      this.maskCtx.fillStyle = 'rgba(0, 0, 0, 1)';
    } else {
      this.maskCtx.globalCompositeOperation = 'source-over';
      this.maskCtx.fillStyle = 'rgba(255, 255, 255, 1)';
    }
    this.maskCtx.beginPath();
    this.maskCtx.arc(point.x, point.y, this.brushSize / 2, 0, Math.PI * 2);
    this.maskCtx.fill();
  }

  /**
   * Draw a brush line on the mask canvas.
   *
   * @param {{x: number, y: number}} from
   * @param {{x: number, y: number}} to
   */
  drawLine(from, to) {
    if (this.activeTool === 'brush-add') {
      this.maskCtx.globalCompositeOperation = 'destination-out';
      this.maskCtx.strokeStyle = 'rgba(0, 0, 0, 1)';
    } else {
      this.maskCtx.globalCompositeOperation = 'source-over';
      this.maskCtx.strokeStyle = 'rgba(255, 255, 255, 1)';
    }
    this.maskCtx.lineWidth = this.brushSize;
    this.maskCtx.lineCap = 'round';
    this.maskCtx.lineJoin = 'round';
    this.maskCtx.beginPath();
    this.maskCtx.moveTo(from.x, from.y);
    this.maskCtx.lineTo(to.x, to.y);
    this.maskCtx.stroke();
  }

  /**
   * Update the custom cursor position and size.
   *
   * @param {number} screenX
   * @param {number} screenY
   */
  updateCursor(screenX, screenY) {
    if (!this.isBrushActive()) {
      this.cursor.style.display = 'none';
      this.overlayCanvas.style.cursor = 'default';
      return;
    }

    const diameter = this.brushSize * this.zoom;
    this.cursor.style.display = 'block';
    this.cursor.style.width = `${diameter}px`;
    this.cursor.style.height = `${diameter}px`;
    this.cursor.style.left = `${screenX - diameter / 2}px`;
    this.cursor.style.top = `${screenY - diameter / 2}px`;
    this.overlayCanvas.style.cursor = 'none';
  }

  /**
   * Initialize or resize the mask canvas to match an image.
   *
   * @param {number} width
   * @param {number} height
   */
  setImageSize(width, height) {
    this.maskCanvas.width = width;
    this.maskCanvas.height = height;
    this.maskCtx.globalCompositeOperation = 'source-over';
    this.maskCtx.fillStyle = 'rgba(255, 255, 255, 1)';
    this.maskCtx.fillRect(0, 0, width, height);
  }

  /**
   * Resize the overlay canvas to match the container.
   *
   * @param {number} width
   * @param {number} height
   */
  setOverlaySize(width, height) {
    this.overlayCanvas.width = width;
    this.overlayCanvas.height = height;
  }

  /**
   * Set the current zoom level.
   *
   * @param {number} zoom
   */
  setZoom(zoom) {
    this.zoom = zoom;
  }

  /**
   * Set the current pan offset.
   *
   * @param {{x: number, y: number}} pan
   */
  setPan(pan) {
    this.pan = pan;
  }

  /**
   * Set the active tool.
   *
   * @param {string} tool
   */
  setTool(tool) {
    this.activeTool = tool;
    const isBrush = this.isBrushActive();
    this.overlayCanvas.style.pointerEvents = isBrush ? 'auto' : 'none';
    if (!isBrush) {
      this.cursor.style.display = 'none';
      this.overlayCanvas.style.cursor = 'default';
    }
  }

  /**
   * Set the brush size in image pixels.
   *
   * @param {number} size
   */
  setBrushSize(size) {
    this.brushSize = size;
  }

  /**
   * Replace the mask canvas with a new one.
   *
   * @param {HTMLCanvasElement} canvas
   */
  setMaskCanvas(canvas) {
    this.maskCanvas.width = canvas.width;
    this.maskCanvas.height = canvas.height;
    this.maskCtx.globalCompositeOperation = 'source-over';
    this.maskCtx.drawImage(canvas, 0, 0);
  }

  /**
   * Get the current mask canvas.
   *
   * @returns {HTMLCanvasElement}
   */
  getMaskCanvas() {
    return this.maskCanvas;
  }
}

if (!customElements.get('mask-brush')) {
  customElements.define('mask-brush', MaskBrush);
}
