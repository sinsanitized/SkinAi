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
  const [prefersNativeCamera, setPrefersNativeCamera] = useState(false);

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

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia(
      "(pointer: coarse), (max-width: 820px)"
    );
    const updatePreference = () => {
      setPrefersNativeCamera(mediaQuery.matches);
    };

    updatePreference();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updatePreference);
      return () => mediaQuery.removeEventListener("change", updatePreference);
    }

    mediaQuery.addListener(updatePreference);
    return () => mediaQuery.removeListener(updatePreference);
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
  const openPrimaryCamera = () => {
    if (prefersNativeCamera) {
      openMobileCamera();
      return;
    }

    void startWebcam();
  };

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
    <section
      className="image-upload-container"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      aria-label="Photo upload"
    >
      {/* Mobile camera hint input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-label="Take a photo with your mobile camera"
        onChange={onCameraChange}
      />

      {/* Library input */}
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        hidden
        aria-label="Choose a photo from your library"
        onChange={onLibraryChange}
      />

      {!preview ? (
        <div className="image-upload-input">
          <div
            className="image-upload-dropzone"
            role="button"
            tabIndex={0}
            onClick={openLibrary}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") openLibrary();
            }}
            aria-label="Upload a face photo by choosing a file"
          >
            <strong>Upload a clear face photo</strong>
            <p className="image-upload-copy">
              Drag and drop on desktop or use your camera or photo library.
            </p>
          </div>

          <div className="image-upload-actions">
            <button
              type="button"
              onClick={openPrimaryCamera}
              className="image-upload-primary"
              aria-label="Open camera"
            >
              Open Camera
            </button>

            <div className="image-upload-secondary-actions">
              <button type="button" onClick={openLibrary}>
                Choose From Library
              </button>
            </div>
          </div>

          {webcamError && (
            <div className="image-upload-error" role="alert" aria-live="assertive">
              {webcamError}
            </div>
          )}

          {showWebcam && (
            <div className="image-upload-webcam">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                aria-label="Live webcam preview"
                className="image-upload-video"
              />
              <div className="image-upload-webcam-actions">
                <button
                  type="button"
                  onClick={captureFromWebcam}
                  aria-label="Capture photo from webcam"
                >
                  Capture
                </button>
                <button
                  type="button"
                  onClick={stopWebcam}
                  aria-label="Cancel webcam capture"
                >
                  Cancel
                </button>
              </div>
              <div className="image-upload-copy">
                Webcam requires HTTPS (or localhost) and camera permission.
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="image-upload-preview-wrapper">
          <img
            src={preview}
            className="image-upload-preview"
            alt="Selected photo preview"
          />
          <div className="image-upload-webcam-actions">
            <button type="button" onClick={openLibrary}>
              Replace Photo
            </button>
            <button type="button" onClick={openPrimaryCamera}>
              Open Camera
            </button>
            <button
              type="button"
              onClick={handleRemove}
              aria-label="Remove selected photo"
              className="image-upload-remove"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
