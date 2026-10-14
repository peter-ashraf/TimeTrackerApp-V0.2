// iOS-style drag-to-dismiss for bottom sheets.
// The sheet follows the finger 1:1 from the grabber/header, the backdrop dims with the drag,
// and on release it either slides out (past 25% of its height or a fast downward flick)
// or springs back. Content scrolling is untouched: only the handle zones start a drag.

const DISMISS_RATIO = 0.25; // fraction of the sheet height
const FLICK_VELOCITY = 0.5; // px per ms, downward
const SPRING = 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)';

export function attachSheetDrag({ sheet, handles, backdrop, backdropColor = 'rgba(0, 0, 0, 0.6)', onDismiss }) {
  let pointerId = null;
  let startY = 0;
  let dy = 0;
  let lastY = 0;
  let lastT = 0;
  let vel = 0;
  let moved = false;

  const setStyle = (el, prop, value) => el && el.style.setProperty(prop, value, 'important');
  const setBackdrop = (p) => {
    if (!backdrop) return;
    const alpha = Number((backdropColor.match(/[\d.]+\)$/) || ['0.6'])[0].replace(')', ''));
    setStyle(backdrop, 'background-color', backdropColor.replace(/[\d.]+\)$/, `${(alpha * p).toFixed(3)})`));
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
    if (backdrop) setStyle(backdrop, 'transition', 'none');
  };

  const onMove = (e) => {
    if (e.pointerId !== pointerId) return;
    dy = e.clientY - startY;
    const now = performance.now();
    vel = (e.clientY - lastY) / Math.max(1, now - lastT);
    lastY = e.clientY;
    lastT = now;
    if (Math.abs(dy) > 4) moved = true;
    const ty = dy >= 0 ? dy : -Math.sqrt(-dy) * 3; // rubber-band when pulled upward
    setStyle(sheet, 'transform', `translateY(${ty}px)`);
    setBackdrop(1 - Math.max(0, dy) / (sheet.offsetHeight || 1));
  };

  const onUp = (e) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    const height = sheet.offsetHeight || 1;
    setStyle(sheet, 'transition', SPRING);
    if (backdrop) setStyle(backdrop, 'transition', 'background-color 0.35s linear');
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
