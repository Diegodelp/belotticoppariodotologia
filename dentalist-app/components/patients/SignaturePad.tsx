'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface SignaturePadProps {
  value?: string | null;
  onChange?: (dataUrl: string | null) => void;
  disabled?: boolean;
}

export function SignaturePad({ value, onChange, disabled = false }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const prepareCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.scale(ratio, ratio);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 2;
    context.strokeStyle = '#0f172a';
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, rect.width, rect.height);
    contextRef.current = context;
  }, []);

  const drawValue = useCallback(
    (dataUrl: string | null | undefined) => {
      if (!dataUrl) {
        return;
      }
      const canvas = canvasRef.current;
      const context = contextRef.current;
      if (!canvas || !context) return;
      const rect = canvas.getBoundingClientRect();
      const image = new Image();
      image.onload = () => {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, rect.width, rect.height);
        context.drawImage(image, 0, 0, rect.width, rect.height);
      };
      image.src = dataUrl;
    },
    [],
  );

  useEffect(() => {
    prepareCanvas();
    drawValue(value ?? null);

    const handleResize = () => {
      prepareCanvas();
      drawValue(value ?? null);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [prepareCanvas, drawValue, value]);

  const emitChange = useCallback(() => {
    if (!onChange || !canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onChange(dataUrl);
  }, [onChange]);

  const getCoordinates = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) {
      return;
    }
    const context = contextRef.current;
    if (!context) return;

    const { x, y } = getCoordinates(event);
    context.beginPath();
    context.moveTo(x, y);
    setIsDrawing(true);
    canvasRef.current?.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) {
      return;
    }
    const context = contextRef.current;
    if (!context) return;

    const { x, y } = getCoordinates(event);
    context.lineTo(x, y);
    context.stroke();
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) {
      return;
    }
    const context = contextRef.current;
    if (!context) return;

    context.closePath();
    setIsDrawing(false);
    canvasRef.current?.releasePointerCapture(event.pointerId);
    emitChange();
  };

  const handlePointerLeave = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) {
      return;
    }
    handlePointerUp(event);
  };

  const handleClear = () => {
    const context = contextRef.current;
    const canvas = canvasRef.current;
    if (!context || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, rect.width, rect.height);
    onChange?.(null);
  };

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-dashed border-white/20 bg-white/60">
        <canvas
          ref={canvasRef}
          className={`h-40 w-full ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-crosshair'}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
        />
        {disabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 text-sm font-medium text-white/80">
            Usando firma guardada
          </div>
        )}
      </div>
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className="rounded-full border border-white/10 px-4 py-1 text-xs font-semibold text-slate-200 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Limpiar firma
        </button>
      </div>
    </div>
  );
}
