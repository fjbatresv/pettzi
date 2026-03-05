declare module 'heic-convert' {
  type HeicOutput = ArrayBuffer | Uint8Array;

  interface HeicConvertOptions {
    buffer: Buffer | Uint8Array;
    format: 'JPEG' | 'PNG';
    quality?: number;
  }

  export default function heicConvert(options: HeicConvertOptions): Promise<HeicOutput>;
}
