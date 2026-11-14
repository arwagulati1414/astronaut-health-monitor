"use client";

import { useEffect, useRef, useState } from "react";

export function EyeCamera({
  onCapture,
  onClose,
}: {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        setError(
          "Camera unavailable. Describe the eye in words. This tool does not measure the pupil.",
        );
      }
    }
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0);
    onCapture(canvas.toDataURL("image/jpeg", 0.72));
  }

  return (
    <div className="camera-layer" role="dialog" aria-modal="true" aria-labelledby="camera-title">
      <div className="camera-panel">
        <header>
          <div>
            <p className="kicker">EXPERIMENTAL</p>
            <h2 id="camera-title">Eye handoff camera</h2>
          </div>
          <button type="button" onClick={onClose}>
            CLOSE
          </button>
        </header>
        <p className="camera-note">
          A still frame is stored in this chat for crew handoff. It is not a pupil measurement,
          a vision test, or a diagnosis.
        </p>
        {error ? (
          <p className="camera-error">{error}</p>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted />
        )}
        <div className="camera-actions">
          <button type="button" onClick={capture} disabled={Boolean(error)}>
            CAPTURE STILL
          </button>
          <button type="button" onClick={onClose}>
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}
