"use client";

import { useEffect, useRef, useState } from "react";
import { EyeScreenBars } from "@/components/eye-screen-bars";
import { IMAGE_SIZE } from "@/lib/eye-screen/features";
import { eyeHandoffNote, type EyeScreen } from "@/lib/eye-screen/model";

export type EyeCapture = {
  dataUrl: string;
  note: string;
  screen: EyeScreen | null;
};

export function EyeCamera({
  onCapture,
  onClose,
}: {
  onCapture: (capture: EyeCapture) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [still, setStill] = useState<EyeCapture | null>(null);
  const [screening, setScreening] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);

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
        setError("Camera unavailable. Load a photo instead, or describe the eye in words.");
      }
    }
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function review(source: CanvasImageSource, width: number, height: number) {
    setScreening(true);
    setScreenError(null);
    const dataUrl = stillDataUrl(source, width, height);
    const pixels = samplePixels(source);
    let screen: EyeScreen | null = null;
    try {
      const response = await fetch("/api/eye-screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pixels }),
      });
      if (!response.ok) throw new Error("Screen failed");
      screen = (await response.json()) as EyeScreen;
    } catch {
      setScreenError("Image screen unavailable. The still can still be logged for handoff.");
    }
    const stamp = new Date().toISOString();
    setStill({ dataUrl, note: eyeHandoffNote(stamp, screen), screen });
    setScreening(false);
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    void review(video, video.videoWidth, video.videoHeight);
  }

  function loadFile(file: File | undefined) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      void review(image, image.naturalWidth, image.naturalHeight);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      setScreenError("That file could not be read as an image.");
    };
    image.src = url;
  }

  return (
    <div className="camera-layer" role="dialog" aria-modal="true" aria-labelledby="camera-title">
      <div className="camera-panel">
        <header>
          <div>
            <p className="kicker">EXPERIMENTAL</p>
            <h2 id="camera-title">Eye image screen</h2>
          </div>
          <button type="button" onClick={onClose}>
            CLOSE
          </button>
        </header>
        <p className="camera-note">
          A still is compared with a model trained on five labelled groups: bulging eyes, cataracts,
          crossed eyes, glaucoma, and uveitis. The result is a similarity guess for crew handoff. It
          is not a diagnosis.
        </p>
        {still ? (
          // The still was just captured in this browser.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={still.dataUrl} alt="Captured eye still, not a clinical measurement" />
        ) : error ? (
          <p className="camera-error">{error}</p>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted />
        )}
        {screening ? <p className="pending">SCREENING STILL</p> : null}
        {screenError ? <p className="camera-error">{screenError}</p> : null}
        {still?.screen ? <EyeScreenBars screen={still.screen} /> : null}
        <div className="camera-actions">
          {still ? (
            <>
              <button type="button" onClick={() => onCapture(still)} disabled={screening}>
                LOG TO MEDIC
              </button>
              <button
                type="button"
                onClick={() => {
                  setStill(null);
                  setScreenError(null);
                }}
              >
                RETAKE
              </button>
            </>
          ) : (
            <button type="button" onClick={capture} disabled={Boolean(error) || screening}>
              CAPTURE STILL
            </button>
          )}
          <label className="file-label">
            LOAD PHOTO
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                loadFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          <button type="button" onClick={onClose}>
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

function stillDataUrl(source: CanvasImageSource, width: number, height: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

function samplePixels(source: CanvasImageSource): number[] {
  const canvas = document.createElement("canvas");
  canvas.width = IMAGE_SIZE;
  canvas.height = IMAGE_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [];
  context.drawImage(source, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
  const data = context.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE).data;
  const pixels: number[] = [];
  for (let index = 0; index < data.length; index += 4) {
    pixels.push(data[index] / 255, data[index + 1] / 255, data[index + 2] / 255);
  }
  return pixels;
}
