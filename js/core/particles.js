// ============================================================
// particles.js — Spore bokeh in background.
//
// Crea 22 cerchi sfumati su canvas che fluttuano lentamente.
// Ogni particella è un radial-gradient (centro luminoso → trasparente)
// che simula spore o bokeh organici.
// ============================================================

function initSporeCanvas() {
  const canvas = document.getElementById("spore-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let W = 0, H = 0;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  resize();
  window.addEventListener("resize", resize);

  // Palette spore: verde necrotico, bone, bordeaux
  const COLORS = [
    [26,  46,  10],   // verde necrotico
    [61,  12,  17],   // bordeaux
    [212, 197, 169],  // bone
    [40,  20,  12],   // terra scura
  ];

  function makeParticle() {
    const c = COLORS[Math.floor(Math.random() * COLORS.length)];
    return {
      x:   Math.random() * W,
      y:   Math.random() * H,
      r:   Math.random() * 55 + 12,
      vx:  (Math.random() - 0.5) * 0.22,
      vy:  (Math.random() - 0.5) * 0.22,
      // bone è più brillante ma più raro
      op:  c[0] > 150 ? Math.random() * 0.045 + 0.008
                      : Math.random() * 0.10  + 0.02,
      r0:  c[0], g0: c[1], b0: c[2]
    };
  }

  const particles = Array.from({ length: 22 }, makeParticle);

  let rafId;

  function draw() {
    ctx.clearRect(0, 0, W, H);

    for (const p of particles) {
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      grad.addColorStop(0, `rgba(${p.r0},${p.g0},${p.b0},${p.op})`);
      grad.addColorStop(1, `rgba(${p.r0},${p.g0},${p.b0},0)`);

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      p.x += p.vx;
      p.y += p.vy;

      // Rimbalzo morbido ai bordi
      if (p.x < -p.r)    { p.x = -p.r;    p.vx = Math.abs(p.vx); }
      if (p.x > W + p.r) { p.x = W + p.r; p.vx = -Math.abs(p.vx); }
      if (p.y < -p.r)    { p.y = -p.r;    p.vy = Math.abs(p.vy); }
      if (p.y > H + p.r) { p.y = H + p.r; p.vy = -Math.abs(p.vy); }
    }

    rafId = requestAnimationFrame(draw);
  }

  draw();
}
