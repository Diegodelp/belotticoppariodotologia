type SharpModule = typeof import('sharp');

type SharpFactory = SharpModule extends { default: infer T } ? T : SharpModule;

type SharpModuleWithDefault = SharpModule & { default?: SharpFactory };

let sharpFactoryPromise: Promise<SharpFactory> | null = null;

async function resolveSharpModule(): Promise<SharpFactory> {
  if (!sharpFactoryPromise) {
    sharpFactoryPromise = import('sharp')
      .then((mod) => {
        const moduleWithDefault = mod as SharpModuleWithDefault;
        return moduleWithDefault.default ?? ((moduleWithDefault as unknown) as SharpFactory);
      })
      .catch((error) => {
        console.error('Could not load the sharp module. Ensure the optional dependency is installed.', error);
        throw error;
      });
  }

  return sharpFactoryPromise;
}

export async function getSharp(): Promise<SharpFactory> {
  return resolveSharpModule();
}
