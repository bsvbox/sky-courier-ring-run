// Keyboard + mouse input for Sky Courier. No dependencies.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // keys hit since the last consumePressed()
    this.mouseX = 0.5; // normalised 0..1 across the canvas
    this.mouseY = 0.5;
    this.mouseActive = false;
    this.clicked = false;
    this.clickX = 0;
    this.clickY = 0;
    this.anyKey = false;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!e.repeat) this.pressed.add(k);
      this.keys.add(k);
      this.anyKey = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - r.left) / r.width;
      this.mouseY = (e.clientY - r.top) / r.height;
      this.mouseActive = true;
    });
    canvas.addEventListener('mousedown', (e) => {
      const r = canvas.getBoundingClientRect();
      this.clickX = (e.clientX - r.left) / r.width;
      this.clickY = (e.clientY - r.top) / r.height;
      this.clicked = true;
      this.anyKey = true;
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  down(...names) {
    return names.some((n) => this.keys.has(n));
  }

  // Steering: -1 (left) .. 1 (right). Keyboard wins; mouse steers when moved.
  steer() {
    let s = 0;
    if (this.down('ArrowLeft', 'a')) s -= 1;
    if (this.down('ArrowRight', 'd')) s += 1;
    if (s === 0 && this.mouseActive) {
      const m = (this.mouseX - 0.5) * 2;
      if (Math.abs(m) > 0.08) s = Math.max(-1, Math.min(1, m * 1.4));
    }
    return s;
  }

  // Pitch: -1 (descend) .. 1 (climb).
  pitch() {
    let p = 0;
    if (this.down('ArrowUp', 'w')) p += 1;
    if (this.down('ArrowDown', 's')) p -= 1;
    if (p === 0 && this.mouseActive) {
      const m = (this.mouseY - 0.5) * 2;
      if (Math.abs(m) > 0.12) p = Math.max(-1, Math.min(1, -m * 1.2));
    }
    return p;
  }

  throttleUp() {
    return this.down('Shift');
  }

  throttleDown() {
    return this.down('Control');
  }

  // Keys pressed since the last call; a quick tap can fall between frames,
  // so discrete actions (start, buy, pause, restart) read this, not down().
  consumePressed() {
    const p = this.pressed;
    this.pressed = new Set();
    return p;
  }

  consumeClick() {
    const c = this.clicked;
    this.clicked = false;
    return c ? { x: this.clickX, y: this.clickY } : null;
  }

  consumeAnyKey() {
    const k = this.anyKey;
    this.anyKey = false;
    return k;
  }
}
