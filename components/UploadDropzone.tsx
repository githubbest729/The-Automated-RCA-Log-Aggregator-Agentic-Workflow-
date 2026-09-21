"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileArchive, X, AlertTriangle } from "lucide-react";
import clsx from "clsx";

const MAX_CLIENT_SIDE_BYTES = 50 * 1024 * 1024; // must mirror server MAX_UPLOAD_BYTES

interface UploadDropzoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export default function UploadDropzone({ onFileSelected, disabled }: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSet = useCallback(
    (file: File) => {
      setValidationError(null);

      if (!file.name.toLowerCase().endsWith(".zip")) {
        setValidationError(`"${file.name}" isn't a .zip file. Please bundle your logs into a single .zip archive.`);
        return;
      }
      if (file.size === 0) {
        setValidationError(`"${file.name}" is empty.`);
        return;
      }
      if (file.size > MAX_CLIENT_SIDE_BYTES) {
        setValidationError(
          `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)}MB, which exceeds the ${(
            MAX_CLIENT_SIDE_BYTES /
            1024 /
            1024
          ).toFixed(0)}MB limit. Try splitting the log bundle.`
        );
        return;
      }

      setSelectedFile(file);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;

      const file = e.dataTransfer.files?.[0];
      if (file) validateAndSet(file);
    },
    [disabled, validateAndSet]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSet(file);
    },
    [validateAndSet]
  );

  const clearSelection = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    setValidationError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={clsx(
          "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer",
          disabled && "opacity-50 cursor-not-allowed",
          isDragging ? "border-signal-500 bg-base-800" : "border-base-700 bg-base-900 hover:border-base-500"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={handleInputChange}
          disabled={disabled}
        />

        {selectedFile ? (
          <div className="flex items-center gap-3 rounded-lg bg-base-800 px-4 py-3">
            <FileArchive className="h-6 w-6 text-signal-500 shrink-0" />
            <div className="text-left">
              <p className="text-sm font-medium text-slate-100">{selectedFile.name}</p>
              <p className="text-xs text-slate-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={clearSelection}
                aria-label="Remove selected file"
                className="ml-2 rounded-full p-1 text-slate-400 hover:bg-base-700 hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <>
            <UploadCloud className={clsx("h-10 w-10", isDragging ? "text-signal-500" : "text-slate-500")} />
            <div>
              <p className="text-sm font-medium text-slate-200">
                Drag and drop your log bundle here, or <span className="text-signal-500">browse</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                A single .zip containing Windows Event, SQL Server, and SCADA diagnostic logs (max{" "}
                {(MAX_CLIENT_SIDE_BYTES / 1024 / 1024).toFixed(0)}MB)
              </p>
            </div>
          </>
        )}
      </div>

      {validationError && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-alert-600/40 bg-alert-600/10 px-3 py-2 text-sm text-alert-500">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}
    </div>
  );
}
