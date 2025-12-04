import { invoke } from "@tauri-apps/api/core";
import clsx from "clsx";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Square,
  Sun,
  Moon,
  Grid3X3,
} from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";

interface ImageData {
  path: string;
  data: string;  // base64 encoded
  mime_type: string;
  size_bytes: number;
}

interface ImagePreviewProps {
  filePath: string;
  fileSize?: number;
  className?: string;
}

type BackgroundMode = "dark" | "light" | "checker";

export function ImagePreview({ filePath, fileSize, className }: ImagePreviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [naturalWidth, setNaturalWidth] = useState(0);
  const [naturalHeight, setNaturalHeight] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isFitMode, setIsFitMode] = useState(true);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [bgMode, setBgMode] = useState<BackgroundMode>("dark");
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Load image file as base64 data URL
  useEffect(() => {
    async function loadImage() {
      try {
        setLoading(true);
        setError(null);

        const result = await invoke<ImageData>("get_image_base64", { filePath });
        const dataUrl = `data:${result.mime_type};base64,${result.data}`;
        setImageUrl(dataUrl);
      } catch (err) {
        console.error("Failed to load image:", err);
        setError("Failed to load image");
        setLoading(false);
      }
    }

    loadImage();
  }, [filePath]);

  // Get file extension for display
  const extension = filePath.split(".").pop()?.toUpperCase() || "IMG";

  // Calculate fit zoom when container or image size changes
  const calculateFitZoom = useCallback(() => {
    if (!containerRef.current || naturalWidth === 0 || naturalHeight === 0) return 1;
    const container = containerRef.current;
    const containerWidth = container.clientWidth - 32; // padding
    const containerHeight = container.clientHeight - 32;
    return Math.min(
      containerWidth / naturalWidth,
      containerHeight / naturalHeight,
      1 // Never zoom beyond 100% for fit
    );
  }, [naturalWidth, naturalHeight]);

  // Handle image load
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalWidth(img.naturalWidth);
    setNaturalHeight(img.naturalHeight);
    setLoading(false);
    setError(null);
  };

  // Handle image error
  const handleImageError = () => {
    setLoading(false);
    setError("Failed to load image");
  };

  // Zoom controls
  const zoomIn = useCallback(() => {
    setIsFitMode(false);
    setZoom((prev) => Math.min(prev * 1.25, 5));
  }, []);

  const zoomOut = useCallback(() => {
    setIsFitMode(false);
    setZoom((prev) => Math.max(prev / 1.25, 0.1));
  }, []);

  const zoomFit = useCallback(() => {
    setIsFitMode(true);
    setPanX(0);
    setPanY(0);
  }, []);

  const zoomActual = useCallback(() => {
    setIsFitMode(false);
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }, []);

  // Get effective zoom (fit or manual)
  const effectiveZoom = isFitMode ? calculateFitZoom() : zoom;

  // Pan/drag handling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (effectiveZoom <= calculateFitZoom()) return; // No pan when fit
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  }, [effectiveZoom, calculateFitZoom, panX, panY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const newPanX = e.clientX - dragStart.x;
    const newPanY = e.clientY - dragStart.y;

    // Constrain pan to image bounds
    const container = containerRef.current;
    if (container) {
      const scaledWidth = naturalWidth * effectiveZoom;
      const scaledHeight = naturalHeight * effectiveZoom;
      const maxPanX = Math.max(0, (scaledWidth - container.clientWidth) / 2);
      const maxPanY = Math.max(0, (scaledHeight - container.clientHeight) / 2);
      setPanX(Math.max(-maxPanX, Math.min(maxPanX, newPanX)));
      setPanY(Math.max(-maxPanY, Math.min(maxPanY, newPanY)));
    }
  }, [isDragging, dragStart, naturalWidth, naturalHeight, effectiveZoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        zoomIn();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "-") {
        e.preventDefault();
        zoomOut();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        zoomFit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zoomIn, zoomOut, zoomFit]);

  // Background style based on mode
  const getBgStyle = () => {
    switch (bgMode) {
      case "light":
        return "bg-white";
      case "checker":
        return "bg-checker";
      default:
        return "bg-[var(--surface-0)]";
    }
  };

  // Format file size
  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={clsx("h-full flex flex-col overflow-hidden", className)}>
      {/* Header */}
      <div className="flex-shrink-0 bg-[var(--surface-1)] border-b border-[var(--border-muted)] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--text-secondary)]">{filePath.split("/").pop()}</span>
          <span className="text-xs text-[var(--text-muted)] px-1.5 py-0.5 bg-[var(--surface-2)] rounded">{extension}</span>
          {naturalWidth > 0 && (
            <span className="text-xs text-[var(--text-muted)]">{naturalWidth} × {naturalHeight}</span>
          )}
          {fileSize && (
            <span className="text-xs text-[var(--text-muted)]">{formatSize(fileSize)}</span>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1">
          {/* Zoom controls */}
          <button
            onClick={zoomFit}
            className={clsx(
              "p-1.5 rounded transition-colors",
              isFitMode ? "bg-[var(--surface-3)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
            )}
            title="Fit to view (⌘0)"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={zoomActual}
            className={clsx(
              "p-1.5 rounded transition-colors",
              !isFitMode && zoom === 1 ? "bg-[var(--surface-3)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
            )}
            title="Actual size (100%)"
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            onClick={zoomOut}
            className="p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] rounded transition-colors"
            title="Zoom out (⌘-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-[var(--text-muted)] w-12 text-center">
            {Math.round(effectiveZoom * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className="p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] rounded transition-colors"
            title="Zoom in (⌘+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* Separator */}
          <div className="w-px h-4 bg-[var(--surface-2)] mx-2" />

          {/* Background toggle */}
          <button
            onClick={() => setBgMode("dark")}
            className={clsx(
              "p-1.5 rounded transition-colors",
              bgMode === "dark" ? "bg-[var(--surface-3)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
            )}
            title="Dark background"
          >
            <Moon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setBgMode("light")}
            className={clsx(
              "p-1.5 rounded transition-colors",
              bgMode === "light" ? "bg-[var(--surface-3)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
            )}
            title="Light background"
          >
            <Sun className="w-4 h-4" />
          </button>
          <button
            onClick={() => setBgMode("checker")}
            className={clsx(
              "p-1.5 rounded transition-colors",
              bgMode === "checker" ? "bg-[var(--surface-3)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
            )}
            title="Checkerboard (transparency)"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image container */}
      <div
        ref={containerRef}
        className={clsx(
          "flex-1 overflow-hidden flex items-center justify-center",
          getBgStyle(),
          isDragging ? "cursor-grabbing" : effectiveZoom > calculateFitZoom() ? "cursor-grab" : "cursor-default"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {loading && (
          <div className="flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-zinc-600 border-t-[var(--text-secondary)] rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-[var(--text-secondary)] text-sm">{error}</div>
        )}

        {imageUrl && (
          <img
            ref={imageRef}
            src={imageUrl}
            alt={filePath.split("/").pop() || "Image"}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className={clsx(
              "max-w-none transition-transform duration-150",
              loading && "opacity-0"
            )}
            style={{
              transform: `scale(${effectiveZoom}) translate(${panX / effectiveZoom}px, ${panY / effectiveZoom}px)`,
            }}
            draggable={false}
          />
        )}
      </div>

      {/* Checkerboard CSS */}
      <style>{`
        .bg-checker {
          background-image:
            linear-gradient(45deg, #333 25%, transparent 25%),
            linear-gradient(-45deg, #333 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #333 75%),
            linear-gradient(-45deg, transparent 75%, #333 75%);
          background-size: 16px 16px;
          background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
          background-color: #444;
        }
      `}</style>
    </div>
  );
}

export default ImagePreview;
