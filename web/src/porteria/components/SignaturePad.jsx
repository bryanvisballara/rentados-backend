import { useEffect, useRef } from 'react';

export default function SignaturePad({ onChange, disabled = false }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }, []);

  function getPoint(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const source = event.touches ? event.touches[0] : event;
    return {
      x: source.clientX - rect.left,
      y: source.clientY - rect.top,
    };
  }

  function startDraw(event) {
    if (disabled) return;
    event.preventDefault();
    drawingRef.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const point = getPoint(event);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }

  function draw(event) {
    if (!drawingRef.current || disabled) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const point = getPoint(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  function endDraw() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    onChange?.(canvas.toDataURL('image/png'));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange?.('');
  }

  return (
    <div className="signature-pad">
      <canvas
        ref={canvasRef}
        width={480}
        height={160}
        className="signature-pad__canvas"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <button type="button" className="admin-btn admin-btn--ghost" onClick={clear} disabled={disabled}>
        Limpiar firma
      </button>
    </div>
  );
}
