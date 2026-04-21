/**
 * OpenCV Loader
 *
 * Lazy-loads the OpenCV.js library and exposes image processing helpers.
 * The 8.6 MB library is only loaded when an OpenCV feature is first requested.
 *
 * @module opencv-loader
 */

let loadPromise = null;

/**
 * Load OpenCV.js and wait for runtime initialization.
 *
 * @returns {Promise<Object>} The global cv object.
 */
export async function loadOpenCV() {
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    if (typeof window.cv !== 'undefined' && window.cv.getBuildInformation) {
      resolve(window.cv);
      return;
    }

    const checkInterval = setInterval(() => {
      if (typeof window.cv !== 'undefined') {
        clearInterval(checkInterval);
        if (window.cv.getBuildInformation) {
          resolve(window.cv);
        } else if (typeof window.cv.onRuntimeInitialized === 'function') {
          // Already has the callback set by something else; wait for ready property
          const readyInterval = setInterval(() => {
            if (window.cv.getBuildInformation) {
              clearInterval(readyInterval);
              resolve(window.cv);
            }
          }, 50);
        } else {
          window.cv.onRuntimeInitialized = () => {
            resolve(window.cv);
          };
        }
      }
    }, 50);

    import(/* webpackChunkName: "opencv" */ './opencv.js')
      .then((mod) => {
        // If the module exports cv directly, assign it to window
        if (mod && mod.default && typeof mod.default === 'object' && !window.cv) {
          window.cv = mod.default;
        }
      })
      .catch((err) => {
        clearInterval(checkInterval);
        reject(err);
      });

    // Safety timeout
    setTimeout(() => {
      clearInterval(checkInterval);
      if (typeof window.cv === 'undefined') {
        reject(new Error('OpenCV failed to load within timeout'));
      }
    }, 60000);
  });

  return loadPromise;
}

/**
 * Convert an HTMLImageElement or ImageData to an OpenCV Mat.
 *
 * @param {HTMLImageElement|ImageData} source
 * @returns {Object} cv.Mat
 */
export function imageToMat(source) {
  const cv = window.cv;
  if (source instanceof ImageData) {
    return cv.matFromImageData(source);
  }
  const canvas = document.createElement('canvas');
  canvas.width = source.naturalWidth || source.width;
  canvas.height = source.naturalHeight || source.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return cv.matFromImageData(imageData);
}

/**
 * Convert a single-channel OpenCV Mat to an ImageData.
 *
 * @param {Object} mat - cv.Mat (CV_8UC1)
 * @returns {ImageData}
 */
export function matToImageData(mat) {
  const cv = window.cv;
  const temp = new cv.Mat();
  cv.cvtColor(mat, temp, cv.COLOR_GRAY2RGBA);
  const clamped = new Uint8ClampedArray(temp.data);
  const imageData = new ImageData(clamped, mat.cols, mat.rows);
  temp.delete();
  return imageData;
}

/**
 * Convert a single-channel OpenCV Mat to a grayscale mask canvas.
 *
 * @param {Object} mat - cv.Mat (CV_8UC1)
 * @param {number} width
 * @param {number} height
 * @returns {HTMLCanvasElement}
 */
export function matToMaskCanvas(mat, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = matToImageData(mat);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Convert a canvas (grayscale mask) to an OpenCV Mat.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {Object} cv.Mat (CV_8UC1)
 */
export function maskCanvasToMat(canvas) {
  const cv = window.cv;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const rgba = cv.matFromImageData(imageData);
  const gray = new cv.Mat();
  cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
  rgba.delete();
  return gray;
}

/**
 * Remove background using grabCut.
 * If a user mask is provided, it is used as initialization hints.
 * Otherwise a center rectangle is used as probable foreground.
 *
 * @param {HTMLImageElement} image - Source image.
 * @param {HTMLCanvasElement|null} maskCanvas - User-drawn mask (white=keep, black=remove).
 * @returns {HTMLCanvasElement} Result mask canvas (white=keep, black=remove).
 */
export async function removeBackground(image, maskCanvas) {
  const cv = await loadOpenCV();

  const src = imageToMat(image);
  const resultMask = new cv.Mat(src.rows, src.cols, cv.CV_8UC1);
  const bgdModel = new cv.Mat();
  const fgdModel = new cv.Mat();

  let userMask = null;
  if (maskCanvas) {
    userMask = maskCanvasToMat(maskCanvas);
  }

  if (userMask) {
    // Convert user mask to grabCut mask format:
    // GC_BGD = 0, GC_FGD = 1, GC_PR_BGD = 2, GC_PR_FGD = 3
    // Black (0) in user mask -> definite background (0)
    // White (255) in user mask -> probable foreground (3)
    const gcMask = new cv.Mat();
    cv.threshold(userMask, gcMask, 128, cv.GC_PR_FGD, cv.THRESH_BINARY);

    // gcMask after threshold: 0 or 3. We want black pixels to be 0 (BGD).
    // White pixels are already 3 (PR_FGD). Black pixels are already 0 (BGD).
    // Perfect!

    cv.grabCut(src, gcMask, new cv.Rect(0, 0, 0, 0), bgdModel, fgdModel, 5, cv.GC_INIT_WITH_MASK);

    // Extract foreground: GC_FGD (1) and GC_PR_FGD (3) -> keep (255)
    const fgdMask = new cv.Mat();
    const prFgdMask = new cv.Mat();
    cv.inRange(gcMask, new cv.Scalar(cv.GC_FGD), new cv.Scalar(cv.GC_FGD), fgdMask);
    cv.inRange(gcMask, new cv.Scalar(cv.GC_PR_FGD), new cv.Scalar(cv.GC_PR_FGD), prFgdMask);
    cv.bitwise_or(fgdMask, prFgdMask, resultMask);

    fgdMask.delete();
    prFgdMask.delete();
    gcMask.delete();
    userMask.delete();
  } else {
    // No user mask: use a center rectangle as probable foreground
    const rect = new cv.Rect(
      Math.floor(src.cols * 0.1),
      Math.floor(src.rows * 0.1),
      Math.floor(src.cols * 0.8),
      Math.floor(src.rows * 0.8)
    );
    const gcMask = new cv.Mat(src.rows, src.cols, cv.CV_8UC1);
    cv.grabCut(src, gcMask, rect, bgdModel, fgdModel, 5, cv.GC_INIT_WITH_RECT);

    const fgdMask = new cv.Mat();
    const prFgdMask = new cv.Mat();
    cv.inRange(gcMask, new cv.Scalar(cv.GC_FGD), new cv.Scalar(cv.GC_FGD), fgdMask);
    cv.inRange(gcMask, new cv.Scalar(cv.GC_PR_FGD), new cv.Scalar(cv.GC_PR_FGD), prFgdMask);
    cv.bitwise_or(fgdMask, prFgdMask, resultMask);

    fgdMask.delete();
    prFgdMask.delete();
    gcMask.delete();
  }

  src.delete();
  bgdModel.delete();
  fgdModel.delete();

  const outCanvas = matToMaskCanvas(resultMask, image.naturalWidth, image.naturalHeight);
  resultMask.delete();
  return outCanvas;
}

/**
 * Refine a mask using morphological operations.
 * Closes small holes and removes small specks.
 *
 * @param {HTMLCanvasElement} maskCanvas
 * @returns {HTMLCanvasElement}
 */
export async function refineMask(maskCanvas) {
  const cv = await loadOpenCV();

  const mask = maskCanvasToMat(maskCanvas);
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  const refined = new cv.Mat();

  cv.morphologyEx(mask, refined, cv.MORPH_CLOSE, kernel);
  cv.morphologyEx(refined, refined, cv.MORPH_OPEN, kernel);

  const outCanvas = matToMaskCanvas(refined, maskCanvas.width, maskCanvas.height);

  mask.delete();
  kernel.delete();
  refined.delete();

  return outCanvas;
}
