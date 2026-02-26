// Extremely subtle animated grain — barely perceptible after a few seconds.
// Canvas opacity is set to 0.03 in CSS; this just generates noise frames.

(function () {
  const canvas = document.getElementById('grain');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let w, h;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  function noise() {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let i = 0, n = d.length; i < n; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  let frame = 0;
  function loop() {
    // Redraw grain every 6 frames (~10fps at 60fps) to keep it subtle and cheap
    if (frame % 6 === 0) noise();
    frame++;
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  resize();
  loop();
})();
