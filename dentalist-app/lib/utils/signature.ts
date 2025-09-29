export function parseSignatureDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const matches = /^data:(.+);base64,(.+)$/.exec(dataUrl ?? '');

  if (!matches) {
    throw new Error('Firma inválida');
  }

  const [, mimeType, base64] = matches;

  return {
    buffer: Buffer.from(base64, 'base64'),
    mimeType,
  };
}
