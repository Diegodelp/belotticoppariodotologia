type SharpModule = typeof import('sharp');

type SharpFactory = SharpModule extends { default: infer T } ? T : SharpModule;

let sharpFactoryPromise: Promise<SharpFactory> | null = null;

async function loadSharp(): Promise<SharpFactory> {
  if (!sharpFactoryPromise) {
    sharpFactoryPromise = import('sharp').then((mod) => {
      const moduleWithDefault = mod as SharpModule & { default?: SharpFactory };
      return moduleWithDefault.default ?? ((moduleWithDefault as unknown) as SharpFactory);
    });
  }

  return sharpFactoryPromise;
}

export async function getSharp(): Promise<SharpFactory> {
  return loadSharp();
}
