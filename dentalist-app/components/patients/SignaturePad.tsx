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
  const ratioRef = useRef(1);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
  }, []);

  const prepareCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const ratio = window.devicePixelRatio || 1;
    ratioRef.current = ratio;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.scale(ratio, ratio);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 2;
    context.strokeStyle = '#0f172a';
    contextRef.current = context;
    clearCanvas();
  }, [clearCanvas]);

  const drawValue = useCallback(
    (dataUrl: string | null | undefined) => {
      const canvas = canvasRef.current;
      const context = contextRef.current;
      if (!canvas || !context) return;
      const rect = canvas.getBoundingClientRect();

      clearCanvas();

      if (!dataUrl) {
        return;
      }

      const image = new Image();
      image.onload = () => {
        const scale = Math.min(rect.width / image.width, rect.height / image.height, 1);
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;
        const offsetX = (rect.width - drawWidth) / 2;
        const offsetY = (rect.height - drawHeight) / 2;
        context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
      };
      image.src = dataUrl;
    },
    [clearCanvas],
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
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!context) return;

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    const fullImage = context.getImageData(0, 0, canvas.width, canvas.height);
    context.restore();

    const { data, width, height } = fullImage;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 0) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX === -1 || maxY === -1) {
      onChange(null);
      return;
    }

    const padding = Math.round(12 * ratioRef.current);
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(width - 1, maxX + padding);
    maxY = Math.min(height - 1, maxY + padding);

    const cropWidth = Math.max(1, maxX - minX + 1);
    const cropHeight = Math.max(1, maxY - minY + 1);

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    const cropped = context.getImageData(minX, minY, cropWidth, cropHeight);
    context.restore();

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = cropWidth;
    outputCanvas.height = cropHeight;
    const outputContext = outputCanvas.getContext('2d');
    if (!outputContext) {
      onChange(null);
      return;
    }

    outputContext.putImageData(cropped, 0, 0);
    const dataUrl = outputCanvas.toDataURL('image/png');
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
    clearCanvas();
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
