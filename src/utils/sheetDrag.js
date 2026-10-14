// iOS-style drag-to-dismiss for bottom sheets.
// The sheet follows the finger 1:1 from the grabber/header, the backdrop dims with the drag,
// and on release it either slides out (past 25% of its height or a fast downward flick)
// or springs back. Content scrolling is untouched: only the handle zones start a drag.

const DISMISS_RATIO = 0.25; // fraction of the sheet height
const FLICK_VELOCITY = 0.5; // px per ms, downward
const SPRING = 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)';

export function attachSheetDrag({ sheet, handles, backdrop, onDismiss }) {
  let pointerId = null;
  let startY = 0;
  let dy = 0;
  let lastY = 0;
  let lastT = 0;
  let vel = 0;
  let moved = false;

  const setStyle = (el, prop, value) => el && el.style.setProperty(prop, value, 'important');
  // The backdrop's dim layer reads --sheet-dim (0..1) as its opacity.
  const setBackdrop = (p) => backdrop && backdrop.style.setProperty('--sheet-dim', p.toFixed(3));

  // Pointer events can fire faster than the screen refreshes; apply at most one position per frame.
  let frame = 0;
  let pendingY = 0;
  const paint = () => {
    frame = 0;
    setStyle(sheet, 'transform', `translateY(${pendingY}px)`);
    setBackdrop(1 - Math.max(0, pendingY) / (sheet.offsetHeight || 1));
  };

  const onDown = (e) => {
    if (pointerId !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.target.closest('button, a, input, select, textarea, [role="button"]')) return;
    pointerId = e.pointerId;
    startY = lastY = e.clientY;
    lastT = performance.now();
    dy = vel = 0;
    moved = false;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic or already released */ }
    // The CSS slide-in animation holds the transform; drop it so inline transforms apply.
    setStyle(sheet, 'animation', 'none');
    setStyle(sheet, 'transition', 'none');
    setStyle(sheet, 'will-change', 'transform');
    if (backdrop) backdrop.classList.add('sheet-dragging'); // dim follows the finger with no easing
  };

  const onMove = (e) => {
    if (e.pointerId !== pointerId) return;
    dy = e.clientY - startY;
    const now = performance.now();
    vel = (e.clientY - lastY) / Math.max(1, now - lastT);
    lastY = e.clientY;
    lastT = now;
    if (Math.abs(dy) > 4) moved = true;
    pendingY = dy >= 0 ? dy : -Math.sqrt(-dy) * 3; // rubber-band when pulled upward
    if (!frame) frame = requestAnimationFrame(paint);
  };

  const onUp = (e) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    if (backdrop) backdrop.classList.remove('sheet-dragging');
    if (performance.now() - lastT > 80) vel = 0; // the finger paused before lifting: not a flick
    const height = sheet.offsetHeight || 1;
    setStyle(sheet, 'transition', SPRING);
    sheet.addEventListener('transitionend', () => sheet.style.removeProperty('will-change'), { once: true });
    if (moved && (dy > height * DISMISS_RATIO || vel > FLICK_VELOCITY)) {
      setStyle(sheet, 'transform', 'translateY(100%)');
      setBackdrop(0);
      setTimeout(() => onDismiss && onDismiss(), 300);
    } else {
      setStyle(sheet, 'transform', 'translateY(0)');
      setBackdrop(1);
    }
  };

  // A drag must not also count as a tap on the handle.
  const onClick = (e) => {
    if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
  };

  const cleanups = handles.filter(Boolean).map((h) => {
    h.style.touchAction = 'none';
    h.addEventListener('pointerdown', onDown);
    h.addEventListener('pointermove', onMove);
    h.addEventListener('pointerup', onUp);
    h.addEventListener('pointercancel', onUp);
    h.addEventListener('click', onClick, true);
    return () => {
      h.removeEventListener('pointerdown', onDown);
      h.removeEventListener('pointermove', onMove);
      h.removeEventListener('pointerup', onUp);
      h.removeEventListener('pointercancel', onUp);
      h.removeEventListener('click', onClick, true);
    };
  });
  return () => cleanups.forEach((fn) => fn());
}
