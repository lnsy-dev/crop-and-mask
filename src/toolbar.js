/**
 * Toolbar Component
 *
 * Provides controls for file upload, tool selection, brush size,
 * zoom, OpenCV operations, and download.
 *
 * @extends DataroomElement
 */

import DataroomElement from 'dataroom-js';

/**
 * Toolbar class
 */
class Toolbar extends DataroomElement {
  /**
   * Initialize the toolbar UI.
   *
   * @async
   * @returns {Promise<void>}
   */
  async initialize() {
    this.classList.add('toolbar');

    // File upload (hidden input)
    this.fileInput = this.create('input', {
      type: 'file',
      accept: 'image/png,image/jpeg,image/webp,image/bmp,image/tiff',
      class: 'file-input-hidden',
    });
    this.fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.event('FILE-SELECTED', { file });
      }
      this.fileInput.value = '';
    });

    // Upload button
    const uploadBtn = this.create('button', {
      content: 'Upload',
      class: 'toolbar-button',
    });
    uploadBtn.addEventListener('click', () => this.fileInput.click());

    // Tool buttons
    const toolGroup = this.create('div', { class: 'toolbar-group' });
    this.toolButtons = {};

    const tools = [
      { name: 'pan', label: 'Pan' },
      { name: 'crop', label: 'Crop' },
      { name: 'brush-add', label: 'Mask' },
      { name: 'brush-remove', label: 'Unmask' },
      { name: 'color-mask', label: 'Color' },
    ];

    tools.forEach((tool) => {
      const btn = this.create('button', {
        content: tool.label,
        class: 'toolbar-button tool-button',
        'data-tool': tool.name,
      }, toolGroup);
      btn.addEventListener('click', () => this.selectTool(tool.name));
      this.toolButtons[tool.name] = btn;
    });

    // Brush size slider (hidden by default)
    this.brushSizeContainer = this.create('div', {
      class: 'toolbar-group brush-size-group hidden',
    });
    this.create('label', {
      content: 'Size:',
      class: 'toolbar-label',
    }, this.brushSizeContainer);
    this.brushSizeInput = this.create('input', {
      type: 'range',
      min: '1',
      max: '200',
      value: '20',
      class: 'brush-size-slider',
    }, this.brushSizeContainer);
    this.brushSizeInput.addEventListener('input', (e) => {
      this.event('BRUSH-SIZE-CHANGE', { size: parseInt(e.target.value, 10) });
    });

    // Color variance input (hidden by default)
    this.varianceContainer = this.create('div', {
      class: 'toolbar-group variance-group hidden',
    });
    this.create('label', {
      content: 'Var:',
      class: 'toolbar-label',
    }, this.varianceContainer);
    this.varianceInput = this.create('input', {
      type: 'number',
      min: '0',
      max: '1',
      step: '0.01',
      value: '0.15',
      class: 'variance-input',
    }, this.varianceContainer);
    this.varianceInput.addEventListener('input', (e) => {
      this.event('COLOR-VARIANCE-CHANGE', { variance: parseFloat(e.target.value) });
    });

    // Zoom controls
    const zoomGroup = this.create('div', { class: 'toolbar-group' });
    const zoomOutBtn = this.create('button', {
      content: '−',
      class: 'toolbar-button',
    }, zoomGroup);
    zoomOutBtn.addEventListener('click', () => this.event('ZOOM-OUT'));

    const zoomFitBtn = this.create('button', {
      content: 'Fit',
      class: 'toolbar-button',
    }, zoomGroup);
    zoomFitBtn.addEventListener('click', () => this.event('ZOOM-FIT'));

    const zoomInBtn = this.create('button', {
      content: '+',
      class: 'toolbar-button',
    }, zoomGroup);
    zoomInBtn.addEventListener('click', () => this.event('ZOOM-IN'));

    // OpenCV controls
    const cvGroup = this.create('div', { class: 'toolbar-group' });
    this.removeBgButton = this.create('button', {
      content: 'Remove BG',
      class: 'toolbar-button opencv-button',
      disabled: true,
    }, cvGroup);
    this.removeBgButton.addEventListener('click', () => this.event('REMOVE-BG'));

    this.refineButton = this.create('button', {
      content: 'Refine',
      class: 'toolbar-button opencv-button',
      disabled: true,
    }, cvGroup);
    this.refineButton.addEventListener('click', () => this.event('REFINE-MASK'));

    // Undo / Redo buttons
    const undoRedoGroup = this.create('div', { class: 'toolbar-group' });
    this.undoButton = this.create('button', {
      content: 'Undo',
      class: 'toolbar-button',
      disabled: true,
    }, undoRedoGroup);
    this.undoButton.addEventListener('click', () => this.event('UNDO'));

    this.redoButton = this.create('button', {
      content: 'Redo',
      class: 'toolbar-button',
      disabled: true,
    }, undoRedoGroup);
    this.redoButton.addEventListener('click', () => this.event('REDO'));

    // Download button
    const downloadBtn = this.create('button', {
      content: 'Download',
      class: 'toolbar-button download-button',
    });
    downloadBtn.addEventListener('click', () => this.event('DOWNLOAD'));

    this.activeTool = 'pan';
    this.updateToolButtons();
  }

  /**
   * Select a tool and emit the change.
   *
   * @param {string} toolName
   */
  selectTool(toolName) {
    this.activeTool = toolName;
    this.updateToolButtons();
    this.event('TOOL-CHANGE', { tool: toolName });

    const isBrush = toolName === 'brush-add' || toolName === 'brush-remove';
    const isColor = toolName === 'color-mask';
    this.brushSizeContainer.classList.toggle('hidden', !isBrush);
    this.varianceContainer.classList.toggle('hidden', !isColor);
  }

  /**
   * Update tool button active states.
   */
  updateToolButtons() {
    Object.entries(this.toolButtons).forEach(([name, btn]) => {
      btn.classList.toggle('active', name === this.activeTool);
    });
  }

  /**
   * Enable or disable OpenCV buttons.
   *
   * @param {boolean} enabled
   * @param {boolean} [loading=false]
   */
  setOpenCVEnabled(enabled, loading = false) {
    this.removeBgButton.disabled = !enabled || loading;
    this.refineButton.disabled = !enabled || loading;
    this.removeBgButton.textContent = loading ? 'Loading…' : 'Remove BG';
  }

  /**
   * Enable or disable undo/redo buttons.
   *
   * @param {{undo: boolean, redo: boolean}} state
   */
  setUndoRedoState(state) {
    this.undoButton.disabled = !state.undo;
    this.redoButton.disabled = !state.redo;
  }
}

if (!customElements.get('toolbar-element')) {
  customElements.define('toolbar-element', Toolbar);
}
