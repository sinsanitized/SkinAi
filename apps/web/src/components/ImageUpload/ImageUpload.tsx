import React, { useEffect, useRef, useState } from "react";
import "./ImageUpload.css";

interface Props {
  onImagesSelected: (files: File[]) => void;
  onRemove?: () => void;
}

export const ImageUpload: React.FC<Props> = ({
  onImagesSelected,
  onRemove,
}) => {
  const [preview, setPreview] = useState<string | null>(null);

  // webcam UI state
  const [showWebcam, setShowWebcam] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Two inputs = safest Safari + Chrome behavior for file picking
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);

  // Clean up object URLs + webcam stream
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
      stopWebcam();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPreviewFromFile = (file: File) => {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const handleFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;

    setPreviewFromFile(file);
    onImagesSelected([file]);
  };

  const onCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0] ?? null);
    e.target.value = "";
  };

  const onLibraryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0] ?? null);
    e.target.value = "";
  };

  const openMobileCamera = () => cameraInputRef.current?.click();
  const openLibrary = () => libraryInputRef.current?.click();

  // Drag & drop
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    handleFile(file);
  };

  const handleRemove = () => {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    onRemove?.();
  };

  // ---- Webcam (desktop) ----
  const startWebcam = async () => {
    setWebcamError(null);

    // must be HTTPS or localhost
    if (!navigator.mediaDevices?.getUserMedia) {
      setWebcamError("Webcam is not supported in this browser.");
      return;
    }

    try {
      // If a stream is already running, stop it first
      if (streamRef.current) stopWebcam();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;
      // IMPORTANT: show the webcam UI first so the <video> mounts
      setShowWebcam(true);
    } catch (err: any) {
      setWebcamError(
        err?.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access."
          : err?.name === "NotFoundError"
          ? "No camera device found."
          : "Could not access the camera."
      );
      setShowWebcam(false);
    }
  };

  const stopWebcam = () => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;

    // Detach from video element (prevents stale black frame)
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setShowWebcam(false);
  };

  /**
   * Attach stream to <video> AFTER the webcam UI is rendered.
   * This fixes the "double click" issue.
   */
  useEffect(() => {
    const attachAndPlay = async () => {
      if (!showWebcam) return;

      const video = videoRef.current;
      const stream = streamRef.current;
      if (!video || !stream) return;

      try {
        video.muted = true;
        video.playsInline = true;

        // Attach stream
        if (video.srcObject !== stream) {
          video.srcObject = stream;
        }

        // Wait for metadata so videoWidth/videoHeight are ready
        await new Promise<void>((resolve) => {
          if (video.readyState >= 1) return resolve(); // HAVE_METADATA
          video.onloadedmetadata = () => resolve();
        });

        // Some browsers need a microtask tick before play
        await Promise.resolve();

        await video.play();
      } catch (err: any) {
        console.warn("Video play failed:", err);
        setWebcamError(
          "Webcam started, but playback was blocked. Try allowing autoplay or click Capture after it appears."
        );
      }
    };

    attachAndPlay();
  }, [showWebcam]);

  const captureFromWebcam = async () => {
    const video = videoRef.current;
    if (!video) return;

    // If metadata hasn't loaded yet, don't capture a 0x0 frame
    if (!video.videoWidth || !video.videoHeight) {
      setWebcamError("Camera is still loading—try again in a moment.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );
    if (!blob) return;

    const file = new File([blob], `webcam-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });

    stopWebcam();
    handleFile(file);
  };

  return (
    <div
      className="image-upload-container"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Mobile camera hint input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onCameraChange}
      />

      {/* Library input */}
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={onLibraryChange}
      />

      {!preview ? (
        <div className="image-upload-input" style={{ width: "100%" }}>
          {/* Drag & drop box */}
          <div
            role="button"
            tabIndex={0}
            onClick={openLibrary}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") openLibrary();
            }}
            style={{
              width: "100%",
              maxWidth: 520,
              cursor: "pointer",
              padding: "1.25rem",
              border: "2px dashed #d1d5db",
              borderRadius: "10px",
              textAlign: "center",
            }}
          >
            <strong>Upload a photo</strong>
            <div style={{ marginTop: "0.25rem", opacity: 0.75 }}>
              Drag & drop on desktop or tap to choose
            </div>
          </div>

          {/* Buttons UNDER the box */}
          <div
            style={{
              marginTop: "1rem",
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button type="button" onClick={openMobileCamera}>
              Take Photo (Mobile)
            </button>
            <button type="button" onClick={openLibrary}>
              Choose Photo
            </button>
            <button type="button" onClick={startWebcam}>
              Use Webcam (Desktop)
            </button>
          </div>

          {webcamError && (
            <div style={{ marginTop: "0.75rem", color: "#b91c1c" }}>
              {webcamError}
            </div>
          )}

          {showWebcam && (
            <div
              style={{
                marginTop: "1rem",
                width: "100%",
                maxWidth: 520,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  borderRadius: "10px",
                  border: "1px solid #d1d5db",
                }}
              />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" onClick={captureFromWebcam}>
                  Capture
                </button>
                <button type="button" onClick={stopWebcam}>
                  Cancel
                </button>
              </div>
              <div style={{ fontSize: 12, opacity: 0.7, textAlign: "center" }}>
                Webcam requires HTTPS (or localhost) and camera permission.
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="image-upload-preview-wrapper">
          <img src={preview} className="image-upload-preview" alt="preview" />
          <div
            style={{
              marginTop: "0.75rem",
              display: "flex",
              gap: "0.5rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button type="button" onClick={openLibrary}>
              Replace (Choose)
            </button>
            <button type="button" onClick={openMobileCamera}>
              Replace (Mobile Camera)
            </button>
            <button type="button" onClick={startWebcam}>
              Replace (Webcam)
            </button>
            <button
              type="button"
              onClick={handleRemove}
              style={{ backgroundColor: "#e02424", color: "white" }}
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
