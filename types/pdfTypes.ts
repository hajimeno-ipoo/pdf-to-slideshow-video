
export interface PDFDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PDFPageProxy>;
  destroy(): void;
}

export interface PDFPageViewport {
  width: number;
  height: number;
  scale: number;
  transform: number[];
  offsetX: number;
  offsetY: number;
  viewBox: number[];
}

export interface PDFPageProxy {
  pageNumber: number;
  getViewport(params: { scale: number; rotation?: number; offsetX?: number; offsetY?: number; dontFlip?: boolean }): PDFPageViewport;
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PDFPageViewport;
    transform?: number[];
    background?: string | null;
  }): PDFRenderTask;
  getTextContent(): Promise<PDFTextContent>;
}

export interface PDFRenderTask {
  promise: Promise<void>;
  cancel(): void;
}

export interface PDFTextContent {
  items: Array<{ str: string; dir: string; width: number; height: number; transform: number[]; fontName: string }>;
  styles: Record<string, any>;
}

// Global PDF.js library definition
export interface PDFJSStatic {
  GlobalWorkerOptions: {
    workerSrc: string;
  };
  getDocument(src: string | ArrayBuffer | { data: Uint8Array }): { promise: Promise<PDFDocumentProxy> };
}
