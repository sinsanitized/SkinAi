import React, { useState, useRef } from "react";
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    setPreview(URL.createObjectURL(file));
    onImagesSelected([file]);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    handleFiles(e.dataTransfer.files);
  };

  const handleRemove = () => {
    setPreview(null);
    if (onRemove) onRemove();
  };

  const handleReplace = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className="image-upload-container"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {!preview && (
        <label
          className="image-upload-input"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            accept="image/*"
            hidden
            ref={fileInputRef}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <span>Upload or Drag & Drop a photo</span>
        </label>
      )}

      {preview && (
        <div className="image-upload-preview-wrapper">
          <img src={preview} className="image-upload-preview" />
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button onClick={handleReplace}>Replace</button>
            <button
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
