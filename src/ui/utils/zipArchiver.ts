import JSZip from 'jszip';

export class ZipArchiver {
  private zip: JSZip;
  private filename: string;
  private usedPaths: Set<string>;

  constructor(filename = 'figma-extracted-assets.zip') {
    this.zip = new JSZip();
    this.filename = filename;
    this.usedPaths = new Set<string>();
  }

  public addAsset(relativePath: string, bytes: number[] | Uint8Array, extension: string) {
    const ext = extension.toLowerCase().replace(/^\./, '');
    let basePath = relativePath;
    if (basePath.toLowerCase().endsWith(`.${ext}`)) {
      basePath = basePath.slice(0, -(ext.length + 1));
    }

    // Collision resolution: if multiple assets have the exact same relativePath,
    // append a suffix (e.g., "icon-1.svg", "icon-2.svg") so nothing gets overwritten!
    let finalPath = `${basePath}.${ext}`;
    let counter = 1;
    while (this.usedPaths.has(finalPath.toLowerCase())) {
      finalPath = `${basePath}-${counter}.${ext}`;
      counter++;
    }

    this.usedPaths.add(finalPath.toLowerCase());
    const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    this.zip.file(finalPath, uint8);
  }

  public async downloadZip(onStatusUpdate?: (status: string) => void): Promise<void> {
    if (onStatusUpdate) onStatusUpdate(`Compressing ${this.usedPaths.size} files into ZIP...`);
    const blob = await this.zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
