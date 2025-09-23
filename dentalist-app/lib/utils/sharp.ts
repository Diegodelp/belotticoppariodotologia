type SharpModule = typeof import('sharp');

type SharpFactory = SharpModule extends { default: infer T } ? T : SharpModule;

type WasmSharpModule = typeof import('@img/sharp-wasm32');

type SharpModuleWithDefault =
  | (SharpModule & { default?: SharpFactory })
  | (WasmSharpModule & { default?: SharpFactory });

let sharpFactoryPromise: Promise<SharpFactory> | null = null;

async function resolveSharpModule(): Promise<SharpFactory> {
  if (!sharpFactoryPromise) {
    sharpFactoryPromise = import('sharp')
      .catch(async (error) => {
        console.warn('Falling back to @img/sharp-wasm32 due to native sharp load failure', error);
        return import('@img/sharp-wasm32');
      })
      .then((mod) => {
        const moduleWithDefault = mod as SharpModuleWithDefault;
        return (
          moduleWithDefault.default ?? ((moduleWithDefault as unknown) as SharpFactory)
        );
      })
      .catch((error) => {
        console.error('Could not load any sharp implementation', error);
        throw error;
      });

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

  return resolveSharpModule();

  return loadSharp();

}
