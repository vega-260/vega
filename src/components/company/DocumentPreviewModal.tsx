import React, { useState, useEffect, useRef } from "react";
import { 
  FileCheck, FileText, ExternalLink, Download, X, 
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, 
  Loader2, AlertCircle, Copy, Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as pdfjsLib from "pdfjs-dist";

// Configure PDF.js worker
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

export interface PreviewDocState {
  title: string;
  blobUrl: string;
  rawUrl?: string;
  fileUrl?: string;
  isPdf: boolean;
  isImage: boolean;
  isText: boolean;
  textContent?: string;
  mimeType?: string;
}

interface DocumentPreviewModalProps {
  doc: PreviewDocState | null;
  onClose: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({ doc, onClose }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  // Reset state when doc changes
  useEffect(() => {
    if (!doc) {
      setNumPages(0);
      setCurrentPage(1);
      setScale(1.0);
      setError(null);
      pdfDocRef.current = null;
      return;
    }

    setCurrentPage(1);
    setScale(1.0);
    setError(null);
    setLoading(true);

    if (doc.isImage || doc.isText) {
      setLoading(false);
      return;
    }

    // Load PDF document using pdfjs-dist
    let isCancelled = false;

    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);

        let pdfSource: any = null;

        // Check if blobUrl or rawUrl is data URL
        const candidateUrl = doc.blobUrl || doc.fileUrl || doc.rawUrl || "";
        
        if (candidateUrl.startsWith("data:")) {
          try {
            const commaIdx = candidateUrl.indexOf(",");
            const base64 = commaIdx !== -1 ? candidateUrl.slice(commaIdx + 1) : candidateUrl;
            const binaryStr = atob(base64.replace(/\s/g, ""));
            const len = binaryStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            pdfSource = { data: bytes };
          } catch {
            pdfSource = { url: candidateUrl };
          }
        } else if (candidateUrl.startsWith("blob:")) {
          try {
            const res = await fetch(candidateUrl);
            const arrayBuf = await res.arrayBuffer();
            pdfSource = { data: new Uint8Array(arrayBuf) };
          } catch {
            pdfSource = { url: candidateUrl };
          }
        } else if (candidateUrl) {
          try {
            const res = await fetch(candidateUrl);
            if (res.ok) {
              const arrayBuf = await res.arrayBuffer();
              pdfSource = { data: new Uint8Array(arrayBuf) };
            } else {
              pdfSource = { url: candidateUrl };
            }
          } catch {
            pdfSource = { url: candidateUrl };
          }
        }

        if (!pdfSource) {
          throw new Error("No valid PDF data source available.");
        }

        const loadingTask = pdfjsLib.getDocument(pdfSource);
        const loadedPdf = await loadingTask.promise;

        if (isCancelled) return;

        pdfDocRef.current = loadedPdf;
        setNumPages(loadedPdf.numPages);
        setCurrentPage(1);
        setLoading(false);
      } catch (err: any) {
        if (isCancelled) return;
        console.warn("PDF.js loading issue:", err);
        setError(err.message || "Failed to parse PDF document.");
        setLoading(false);
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }
    };
  }, [doc]);

  // Render current page to canvas
  useEffect(() => {
    if (!doc || doc.isImage || doc.isText || !pdfDocRef.current || !canvasRef.current) {
      return;
    }

    let isCancelled = false;

    const renderPage = async () => {
      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {}
        }

        const page = await pdfDocRef.current.getPage(currentPage);
        if (isCancelled || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        // Standard base viewport at 1.25 scale for crisp reading
        const baseScale = 1.25 * scale;
        const viewport = page.getViewport({ scale: baseScale * dpr });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.warn("Canvas page render error:", err);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
    };
  }, [doc, currentPage, scale]);

  if (!doc) return null;

  const handleDownload = () => {
    const downloadUrl = doc.blobUrl.startsWith("blob:") 
      ? doc.blobUrl 
      : (doc.fileUrl || doc.blobUrl);

    const link = document.createElement("a");
    link.href = downloadUrl;
    const ext = doc.isImage ? "png" : doc.isText ? "txt" : "pdf";
    link.download = `${doc.title.replace(/[^a-zA-Z0-9_-]/g, "_")}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenTab = () => {
    if (doc.isText && doc.textContent) {
      const newWindow = window.open("", "_blank");
      if (newWindow) {
        newWindow.document.write(`<!DOCTYPE html><html><head><title>${doc.title.replace(/</g, "&lt;")}</title><meta charset="utf-8" /><style>body { margin: 0; padding: 24px; background: #0f172a; color: #e2e8f0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }</style></head><body>${doc.textContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</body></html>`);
        newWindow.document.close();
        return;
      }
      const textBlob = new Blob([doc.textContent], { type: "text/plain;charset=utf-8" });
      const textUrl = URL.createObjectURL(textBlob);
      window.open(textUrl, "_blank");
    } else if (doc.blobUrl && doc.blobUrl.startsWith("blob:")) {
      window.open(doc.blobUrl, "_blank");
    } else if (doc.fileUrl) {
      window.open(doc.fileUrl, "_blank");
    } else {
      window.open(doc.blobUrl, "_blank");
    }
  };

  const handleCopyText = () => {
    if (doc.textContent) {
      navigator.clipboard.writeText(doc.textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        >
          {/* Modal Header */}
          <div className="px-4 sm:px-6 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/95">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <FileCheck size={18} className="shrink-0" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider truncate">
                  {doc.title}
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  {doc.isImage ? "Image Document" : doc.isText ? "Text File" : "Official Verification PDF"}
                </span>
              </div>
            </div>

            {/* Middle Controls: Page navigation & Zoom for PDF */}
            {!doc.isImage && !doc.isText && numPages > 0 && !error && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-xl shadow-xs">
                {numPages > 1 && (
                  <div className="flex items-center gap-1 mr-2 pr-2 border-r border-slate-200">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className="p-1 text-slate-500 hover:text-blue-600 disabled:opacity-30 transition-colors cursor-pointer"
                      title="Previous page"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-mono font-bold text-slate-700 min-w-[50px] text-center">
                      {currentPage} / {numPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= numPages}
                      onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                      className="p-1 text-slate-500 hover:text-blue-600 disabled:opacity-30 transition-colors cursor-pointer"
                      title="Next page"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setScale(s => Math.max(0.6, Number((s - 0.2).toFixed(1))))}
                    className="p-1 text-slate-500 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                    title="Zoom out"
                  >
                    <ZoomOut size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setScale(1.0)}
                    className="px-1.5 py-0.5 text-[11px] font-mono font-bold text-slate-600 hover:text-blue-600 rounded cursor-pointer"
                    title="Reset zoom"
                  >
                    {Math.round(scale * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={() => setScale(s => Math.min(2.5, Number((s + 0.2).toFixed(1))))}
                    className="p-1 text-slate-500 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                    title="Zoom in"
                  >
                    <ZoomIn size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {doc.isText && doc.textContent && (
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  title="Copy text content"
                >
                  {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleOpenTab}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="Open in new browser tab"
              >
                <ExternalLink size={13} />
                <span className="hidden sm:inline">Open in Tab</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="Download document"
              >
                <Download size={13} />
                <span className="hidden sm:inline">Download</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer ml-1"
                title="Close preview"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Modal Document Display Body */}
          <div className="p-3 sm:p-6 flex-1 overflow-auto bg-slate-100 flex items-center justify-center min-h-[60vh] max-h-[82vh]">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 text-slate-500 py-16">
                <Loader2 size={32} className="animate-spin text-blue-600" />
                <p className="text-xs font-bold tracking-wider uppercase">Loading Document Preview...</p>
              </div>
            ) : doc.isImage ? (
              /* Image View */
              <div className="max-w-full max-h-[75vh] flex items-center justify-center p-3 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-auto">
                <img
                  src={doc.blobUrl}
                  alt={doc.title}
                  className="max-w-full max-h-[70vh] object-contain rounded-xl"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.src = "https://placehold.co/600x400?text=Image+Load+Failed";
                  }}
                />
              </div>
            ) : doc.isText && doc.textContent ? (
              /* Text File View */
              <div className="w-full h-[75vh] bg-slate-900 rounded-2xl shadow-sm border border-slate-800 p-5 overflow-auto flex flex-col">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-slate-400 text-xs font-mono">
                  <span className="font-semibold text-slate-300 flex items-center gap-2">
                    <FileText size={14} className="text-blue-400" />
                    Document Content Preview
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest">{doc.title}</span>
                </div>
                <pre className="font-mono text-xs text-slate-200 whitespace-pre-wrap break-words leading-relaxed flex-1">
                  {doc.textContent}
                </pre>
              </div>
            ) : error ? (
              /* Fallback if PDF parsing has issues */
              <div className="w-full max-w-lg bg-white rounded-3xl p-8 border border-slate-200 shadow-lg text-center flex flex-col items-center">
                <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mb-4">
                  <AlertCircle size={28} />
                </div>
                <h4 className="text-base font-black text-slate-800 uppercase tracking-wide mb-1">
                  {doc.title}
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
                  The document has been securely stored. You can view it directly in a dedicated browser tab or download it to your device.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 w-full">
                  <button
                    type="button"
                    onClick={handleOpenTab}
                    className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <ExternalLink size={14} />
                    Open in Tab
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <Download size={14} />
                    Download File
                  </button>
                </div>

                {/* Embedded Object fallback */}
                <div className="w-full mt-6 pt-6 border-t border-slate-100">
                  <object
                    data={doc.blobUrl || doc.fileUrl}
                    type="application/pdf"
                    className="w-full h-48 rounded-xl border border-slate-100 hidden"
                  >
                    <p className="text-xs text-slate-400">PDF embed preview unavailable</p>
                  </object>
                </div>
              </div>
            ) : (
              /* Native Canvas Rendered PDF */
              <div className="w-full h-full flex flex-col items-center justify-start overflow-auto p-2">
                <div className="bg-white rounded-xl shadow-md border border-slate-200/80 p-1 flex items-center justify-center transition-transform">
                  <canvas ref={canvasRef} className="rounded-lg max-w-full h-auto block" />
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
