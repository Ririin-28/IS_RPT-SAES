"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BaseModal from "./BaseModal";
import PrimaryButton from "../Buttons/PrimaryButton";
import SecondaryButton from "../Buttons/SecondaryButton";

const CROP_SIZE = 280;
const PREVIEW_SIZE = 112;
const OUTPUT_SIZE = 512;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

type CropOffsets = {
  x: number;
  y: number;
};

type CropSize = {
  width: number;
  height: number;
};

type CropResult = {
  file: File;
  previewUrl: string;
};

type ProfileImageCropModalProps = {
  isOpen: boolean;
  file: File | null;
  onClose: () => void;
  onConfirm: (result: CropResult) => void;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

function clampOffsets(offsets: CropOffsets, imageSize: CropSize, scale: number): CropOffsets {
  const scaledWidth = imageSize.width * scale;
  const scaledHeight = imageSize.height * scale;
  const maxOffsetX = Math.max(0, (scaledWidth - CROP_SIZE) / 2);
  const maxOffsetY = Math.max(0, (scaledHeight - CROP_SIZE) / 2);

  return {
    x: Math.min(maxOffsetX, Math.max(-maxOffsetX, offsets.x)),
    y: Math.min(maxOffsetY, Math.max(-maxOffsetY, offsets.y)),
  };
}

function createCroppedFileName(originalName: string): string {
  const baseName = originalName.replace(/\.[^.]+$/, "").trim() || "profile-image";
  return `${baseName}-cropped.jpg`;
}

export default function ProfileImageCropModal({
  isOpen,
  file,
  onClose,
  onConfirm,
}: ProfileImageCropModalProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<CropSize | null>(null);
  const [offsets, setOffsets] = useState<CropOffsets>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(MIN_ZOOM);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !file) {
      setSourceUrl(null);
      setImageSize(null);
      setOffsets({ x: 0, y: 0 });
      setZoom(MIN_ZOOM);
      setIsProcessing(false);
      setErrorMessage(null);
      dragStateRef.current = null;
      return;
    }

    const nextSourceUrl = URL.createObjectURL(file);
    setSourceUrl(nextSourceUrl);
    setImageSize(null);
    setOffsets({ x: 0, y: 0 });
    setZoom(MIN_ZOOM);
    setIsProcessing(false);
    setErrorMessage(null);
    dragStateRef.current = null;

    return () => {
      URL.revokeObjectURL(nextSourceUrl);
    };
  }, [file, isOpen]);

  const metrics = useMemo(() => {
    if (!imageSize) {
      return null;
    }

    const baseScale = Math.max(CROP_SIZE / imageSize.width, CROP_SIZE / imageSize.height);
    const scale = baseScale * zoom;
    const clampedOffsets = clampOffsets(offsets, imageSize, scale);

    return {
      scale,
      width: imageSize.width * scale,
      height: imageSize.height * scale,
      offsets: clampedOffsets,
    };
  }, [imageSize, offsets, zoom]);

  useEffect(() => {
    if (!metrics) {
      return;
    }

    if (metrics.offsets.x !== offsets.x || metrics.offsets.y !== offsets.y) {
      setOffsets(metrics.offsets);
    }
  }, [metrics, offsets]);

  const previewScale = metrics ? metrics.scale * (PREVIEW_SIZE / CROP_SIZE) : 1;

  const handleImageLoad = () => {
    const image = imageRef.current;
    if (!image) {
      return;
    }

    setImageSize({
      width: image.naturalWidth,
      height: image.naturalHeight,
    });
    setOffsets({ x: 0, y: 0 });
    setZoom(MIN_ZOOM);
    setErrorMessage(null);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!metrics || isProcessing) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: metrics.offsets.x,
      originY: metrics.offsets.y,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!imageSize || !metrics) {
      return;
    }

    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const nextOffsets = clampOffsets(
      {
        x: dragState.originX + (event.clientX - dragState.startX),
        y: dragState.originY + (event.clientY - dragState.startY),
      },
      imageSize,
      metrics.scale,
    );

    setOffsets(nextOffsets);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragStateRef.current = null;
  };

  const handleZoomChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!imageSize) {
      return;
    }

    const nextZoom = Number(event.target.value);
    const baseScale = Math.max(CROP_SIZE / imageSize.width, CROP_SIZE / imageSize.height);
    const nextScale = baseScale * nextZoom;
    setZoom(nextZoom);
    setOffsets((previous) => clampOffsets(previous, imageSize, nextScale));
  };

  const handleReset = () => {
    setOffsets({ x: 0, y: 0 });
    setZoom(MIN_ZOOM);
    setErrorMessage(null);
  };

  const handleConfirm = async () => {
    if (!file || !imageSize || !metrics || !imageRef.current) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Unable to prepare the cropped image.");
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      const sourceSize = CROP_SIZE / metrics.scale;
      const sourceX = imageSize.width / 2 - sourceSize / 2 - metrics.offsets.x / metrics.scale;
      const sourceY = imageSize.height / 2 - sourceSize / 2 - metrics.offsets.y / metrics.scale;

      context.drawImage(
        imageRef.current,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE,
      );

      const previewUrl = canvas.toDataURL("image/jpeg", 0.92);
      const croppedBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
            return;
          }
          reject(new Error("Unable to export the cropped image."));
        }, "image/jpeg", 0.92);
      });

      const croppedFile = new File([croppedBlob], createCroppedFileName(file.name), {
        type: "image/jpeg",
      });

      onConfirm({
        file: croppedFile,
        previewUrl,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to crop the selected image.");
    } finally {
      setIsProcessing(false);
    }
  };

  const footer = (
    <>
      <SecondaryButton onClick={onClose} disabled={isProcessing}>
        Cancel
      </SecondaryButton>
      <SecondaryButton onClick={handleReset} disabled={!imageSize || isProcessing}>
        Reset
      </SecondaryButton>
      <PrimaryButton onClick={handleConfirm} disabled={!imageSize || isProcessing}>
        {isProcessing ? "Preparing..." : "Use Photo"}
      </PrimaryButton>
    </>
  );

  return (
    <BaseModal
      show={isOpen}
      onClose={onClose}
      title="Adjust Profile Photo"
      maxWidth="3xl"
      footer={footer}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="flex flex-col items-center gap-5">
          <div
            className="relative h-[280px] w-[280px] max-w-full touch-none select-none overflow-hidden rounded-[28px] border border-gray-200 bg-[#eef5f0] shadow-inner cursor-grab active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            style={{ touchAction: "none" }}
          >
            {sourceUrl ? (
              <img
                ref={imageRef}
                src={sourceUrl}
                alt="Profile crop preview"
                draggable={false}
                onLoad={handleImageLoad}
                onError={() => setErrorMessage("Unable to load the selected image.")}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                style={{
                  width: metrics ? `${metrics.width}px` : undefined,
                  height: metrics ? `${metrics.height}px` : undefined,
                  transform: `translate(calc(-50% + ${metrics?.offsets.x ?? 0}px), calc(-50% + ${metrics?.offsets.y ?? 0}px))`,
                }}
              />
            ) : null}

            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-0 rounded-[28px] ring-1 ring-inset ring-black/10" />
              <div className="absolute inset-5 rounded-full border-2 border-white/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.14)]" />
              <div className="absolute inset-5 rounded-full ring-1 ring-black/10" />
            </div>
          </div>

          <div className="w-full max-w-sm">
            <label htmlFor="profile-image-zoom" className="mb-2 block text-sm font-medium text-gray-700">
              Zoom
            </label>
            <input
              id="profile-image-zoom"
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={handleZoomChange}
              disabled={!imageSize || isProcessing}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-[#013300]"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
              <span>Fit</span>
              <span>{Math.round(zoom * 100)}%</span>
              <span>Close-up</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50/90 p-4">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-700">Preview</h3>
            <div className="mt-4 flex justify-center">
              <div className="relative h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-[#eef5f0] shadow-lg">
                {sourceUrl ? (
                  <img
                    src={sourceUrl}
                    alt="Cropped profile preview"
                    draggable={false}
                    className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                    style={{
                      width: metrics && imageSize ? `${imageSize.width * previewScale}px` : undefined,
                      height: metrics && imageSize ? `${imageSize.height * previewScale}px` : undefined,
                      transform: `translate(calc(-50% + ${(metrics?.offsets.x ?? 0) * (PREVIEW_SIZE / CROP_SIZE)}px), calc(-50% + ${(metrics?.offsets.y ?? 0) * (PREVIEW_SIZE / CROP_SIZE)}px))`,
                    }}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-600">The circular preview shows how the avatar will appear after saving.</p>

          {errorMessage ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}
        </div>
      </div>
    </BaseModal>
  );
}
