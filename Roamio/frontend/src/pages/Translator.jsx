import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronDown,
  Copy,
  Globe2,
  History,
  ImagePlus,
  Loader2,
  MapPin,
  Mic,
  Plane,
  RefreshCw,
  Sparkles,
  Star,
  Type,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import Hint from "../components/onboarding/Hint.jsx";
import ThemeToggle from "../components/recommendations/ThemeToggle.jsx";
import useTheme from "../components/recommendations/useTheme.js";
import {
  LANGUAGES,
  SOURCE_LANGUAGES,
  baseCode,
  compressImage,
  speechLang,
  targetForBase,
} from "../utils/translatorHelpers";
import "../styles/Translator.css";

const MAX_TEXT_CHARS = 2000;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const SpeechRecognition =
  typeof window !== "undefined" &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);
const canSpeak =
  typeof window !== "undefined" && "speechSynthesis" in window;

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_API_URL || "http://127.0.0.1:3000";

// One translated line, drawn over the photo where the original text was. The OCR box
// gives the line's height, which sets its starting font size. If the translation is too
// long for the box, the font is shrunk step by step, down to 45% of that size. Past that
// it wraps instead. Sizes use container query units (cqw) so the overlay scales with the photo.
function OverlayLine({ line, size }) {
  const ref = useRef(null);
  const base = (line.height / size.width) * 58;
  const maxWidth = ((size.width - line.left) / size.width) * 100;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let scale = 1;
    el.style.whiteSpace = "nowrap";
    el.style.fontSize = `${base}cqw`;
    while (el.scrollWidth > el.clientWidth + 1 && scale > 0.45) {
      scale *= 0.92;
      el.style.fontSize = `${base * scale}cqw`;
    }
    if (el.scrollWidth > el.clientWidth + 1) el.style.whiteSpace = "normal";
  }, [line.translation, base, maxWidth]);

  return (
    <span
      ref={ref}
      className="overlay-line"
      style={{
        left: `${(line.left / size.width) * 100}%`,
        top: `${(line.top / size.height) * 100}%`,
        minWidth: `${Math.min((line.width / size.width) * 100, maxWidth)}%`,
        maxWidth: `${maxWidth}%`,
        minHeight: `${(line.height / size.height) * 100}%`,
      }}
    >
      {line.translation}
    </span>
  );
}

function Translator() {
  const { theme, toggle: toggleTheme } = useTheme();
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [params] = useSearchParams();
  const linkedText = (params.get("text") || "").slice(0, MAX_TEXT_CHARS);
  const linkedLanguage = LANGUAGES.find((l) => l.code === (params.get("to") || "").toUpperCase())?.code;
  const [targetLanguage, setTargetLanguage] = useState(linkedLanguage || "EN-US");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [translationResult, setTranslationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState(linkedText ? "text" : "photo");
  const [inputText, setInputText] = useState(linkedText);
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [listening, setListening] = useState(false);
  const [photoSize, setPhotoSize] = useState(null);
  const [showOverlay, setShowOverlay] = useState(true);
  // Session-only: this list is lost on reload. The server keeps its own history
  // (/api/translate/history), but this page never reads it and its requests send no
  // credentials, so these translations are not saved to a signed-in user's history.
  const [history, setHistory] = useState([]);

  const recognitionRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Releases the camera and the photo's object URL when the page unmounts or the
  // preview changes, so the camera light turns off and memory is freed.
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (canSpeak) window.speechSynthesis.cancel();
    };
  }, []);

  const getLanguageName = (code) => {
    if (!code) return "Unknown";
    const found = [...SOURCE_LANGUAGES, ...LANGUAGES].find(
      (lang) => lang.code.toLowerCase() === code.toLowerCase()
    );
    return found ? found.name : code.toUpperCase();
  };

  // The 10 MB limit here is the size we accept from the device. The photo is shrunk to
  // the OCR provider's 1 MB limit (compressImage) before it is sent, so this check
  // is not what keeps the upload small.
  const handleFile = (file) => {
    if (!file) return;
    setError("");
    setTranslationResult(null);
    setCopied(false);

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("That file type isn't supported. Choose a JPG, PNG or WEBP photo.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError(`That photo is ${(file.size / 1048576).toFixed(1)} MB. Choose one under 10 MB.`);
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
    event.target.value = "";
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const startCamera = async () => {
    setError("");
    setTranslationResult(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Your browser does not support camera access.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      streamRef.current = stream;
      setCameraOpen(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (cameraError) {
      console.error("Camera error:", cameraError);
      setError("Unable to access your camera. Please allow camera permission and try again.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
  };

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video) {
      setError("Camera is not ready.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");

    if (!context) {
      setError("Could not capture the photo.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Could not create the photo.");
          return;
        }
        const file = new File([blob], `travel-photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        handleFile(file);
        stopCamera();
      },
      "image/jpeg",
      0.9
    );
  };

  const clearImage = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl("");
    setTranslationResult(null);
    setError("");
    setCopied(false);
    stopCamera();
  };

  const handleTranslate = async () => {
    const isPhoto = mode === "photo";
    if (isPhoto && !selectedFile) {
      setError("Please upload an image or take a photo first.");
      return;
    }
    if (!isPhoto && !inputText.trim()) {
      setError("Type or speak something to translate first.");
      return;
    }

    setLoading(true);
    setError("");
    setTranslationResult(null);
    setCopied(false);

    try {
      const base = API_BASE_URL.replace(/\/$/, "") + "/api/translate";
      const from = sourceLanguage === "auto" ? "" : sourceLanguage;
      let request;

      if (isPhoto) {
        const { blob, width, height } = await compressImage(selectedFile);
        setPhotoSize(width && height ? { width, height } : null);

        const formData = new FormData();
        formData.append("image", blob, "photo.jpg");
        formData.append("target_lang", targetLanguage);
        if (from) formData.append("source_lang", from);
        request = fetch(`${base}/ocr`, { method: "POST", body: formData });
      } else {
        request = fetch(`${base}/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: inputText,
            target_lang: targetLanguage,
            source_lang: from || undefined,
          }),
        });
      }

      const response = await request;
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.detail?.[0]?.msg ||
            data?.detail ||
            data?.message ||
            `Translation request failed with status ${response.status}.`
        );
      }
      if (!data) {
        throw new Error("The translation server returned an empty response.");
      }

      setTranslationResult(data);

      if (data.translation) {
        const newEntry = {
          id: Date.now(),
          original: isPhoto ? data.text || "Photo translation" : inputText,
          translation: data.translation,
          from: getLanguageName(data.detected_lang || sourceLanguage),
          to: getLanguageName(targetLanguage),
          isFavorite: false,
        };
        setHistory((prev) => [newEntry, ...prev.slice(0, 19)]);
      }
    } catch (requestError) {
      console.error("Translation error:", requestError);
      setError(
        requestError instanceof TypeError
          ? "Could not reach the translation server. Check your connection and try again."
          : requestError.message || "Unable to connect to the translation service."
      );
    } finally {
      setLoading(false);
    }
  };

  const copyTranslation = async () => {
    const text = translationResult?.translation;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (copyError) {
      console.error("Copy failed:", copyError);
      setError("Unable to copy the translation.");
    }
  };

  const speakText = (textToSpeak, langCode) => {
    if (!textToSpeak || !canSpeak) return;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = speechLang(langCode);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  // Speech input uses the browser's own recognition engine, so its availability and
  // accuracy depend on the browser. Each result is appended to the text, not
  // replacing it, so the traveller can speak in parts.
  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang =
      sourceLanguage === "auto" ? navigator.language : speechLang(sourceLanguage);
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const heard = event.results[0]?.[0]?.transcript || "";
      setInputText((current) => `${current} ${heard}`.trim().slice(0, MAX_TEXT_CHARS));
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone access was blocked. Allow the microphone and try again.");
      } else if (event.error === "no-speech") {
        setError("No speech was heard. Try again and speak closer to the microphone.");
      }
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setError("");
    setListening(true);
    recognition.start();
  };

  const swapFrom =
    sourceLanguage !== "auto"
      ? sourceLanguage
      : baseCode(translationResult?.detected_lang);
  const canSwap = Boolean(
    swapFrom && SOURCE_LANGUAGES.some((l) => l.code === swapFrom) && targetForBase(swapFrom)
  );

  // Swaps From and To. For a typed phrase, the translation becomes the new input, so
  // the reverse translation is one click away.
  const swapLanguages = () => {
    if (!canSwap) return;
    const newTarget = targetForBase(swapFrom);
    setSourceLanguage(baseCode(targetLanguage));
    setTargetLanguage(newTarget);

    if (mode === "text" && translationResult?.translation) {
      setInputText(translationResult.translation);
    }
    setTranslationResult(null);
  };

  const toggleFavorite = (id) => {
    setHistory((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
      )
    );
  };

  return (
    <div className="translator-page" data-theme={theme}>
      {/* HEADER MATCHING WEATHER PAGE LAYOUT */}
      <header className="translator-header">
        <Link to="/dashboard" className="back-dashboard">
          <ArrowLeft size={17} />
          Back to Dashboard
        </Link>

        <div className="translator-header-right">
          <div className="translator-brand">
            <div className="translator-logo">
              <Plane size={19} />
            </div>
            <span>
              Roam<span>io</span>
            </span>
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </header>

      <main className="translator-content">
        <section className="translator-intro">
          <div className="translator-badge">
            <Sparkles size={14} />
            SMART TRAVEL TOOL
          </div>
          <h1>
            Travel without
            <span>language barriers.</span>
          </h1>
          <p>
            Take a photo of a sign, menu or document, or type and speak phrases to translate instantly.
          </p>
        </section>

        <Hint id="translator">
          Photo mode reads the text in a picture of a sign or menu. Type or speak mode translates phrases. Choose the language you are travelling to first.
        </Hint>

        {/* UNIFIED SINGLE WORKSPACE CARD */}
        <section className="translator-card-unified">
          {/* TOP INTEGRATED TOOLBAR */}
          <div className="translator-top-bar">
            <div className="mode-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "photo"}
                className={mode === "photo" ? "active" : ""}
                onClick={() => setMode("photo")}
              >
                <Camera size={16} />
                Photo
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "text"}
                className={mode === "text" ? "active" : ""}
                onClick={() => setMode("text")}
              >
                <Type size={16} />
                Type or speak
              </button>
            </div>

            <div className="language-row-compact">
              <div className="language-select-compact">
                <label htmlFor="source-language">From:</label>
                <select
                  id="source-language"
                  value={sourceLanguage}
                  onChange={(e) => setSourceLanguage(e.target.value)}
                >
                  <option value="auto">
                    {translationResult?.detected_lang && sourceLanguage === "auto"
                      ? `Auto-detect (${getLanguageName(translationResult.detected_lang)})`
                      : "Auto-detect"}
                  </option>
                  {SOURCE_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="swap-button"
                onClick={swapLanguages}
                disabled={!canSwap}
                aria-label="Swap languages"
                title={
                  canSwap
                    ? "Swap languages"
                    : "Pick a source language (or translate once) to swap"
                }
              >
                <ArrowLeftRight size={15} />
              </button>

              <div className="language-select-compact">
                <label htmlFor="target-language">To:</label>
                <select
                  id="target-language"
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* TWO-COLUMN WORKSPACE SPLIT */}
          <div className="translator-workspace">
            {/* LEFT INPUT PANE */}
            <div className="workspace-input-pane">
              {mode === "text" ? (
                <div className="text-input-box">
                  <textarea
                    value={inputText}
                    maxLength={MAX_TEXT_CHARS}
                    placeholder="Type a phrase, or press the microphone and say it..."
                    aria-label="Text to translate"
                    data-gramm="false"
                    data-enable-grammarly="false"
                    onChange={(event) => {
                      setInputText(event.target.value);
                      setTranslationResult(null);
                    }}
                  />
                  <div className="text-input-footer">
                    <span>
                      {inputText.length}/{MAX_TEXT_CHARS}
                    </span>
                    {SpeechRecognition ? (
                      <button
                        type="button"
                        className={listening ? "mic-button listening" : "mic-button"}
                        onClick={toggleListening}
                        aria-pressed={listening}
                      >
                        <Mic size={16} />
                        {listening ? "Listening..." : "Speak"}
                      </button>
                    ) : (
                      <span title="Speech input needs Chrome, Edge or Safari">
                        Speech unsupported
                      </span>
                    )}
                  </div>
                </div>
              ) : cameraOpen ? (
                <div className="camera-container">
                  <video
                    ref={videoRef}
                    className="camera-video"
                    autoPlay
                    muted
                    playsInline
                  />
                  <div className="camera-overlay">
                    <div className="camera-frame" />
                    <p>Position the text inside the frame</p>
                  </div>
                  <div className="camera-controls">
                    <button
                      type="button"
                      className="camera-cancel"
                      onClick={stopCamera}
                    >
                      <X size={18} />
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="capture-button"
                      onClick={takePhoto}
                      aria-label="Take photo"
                    >
                      <Camera size={23} />
                    </button>
                    <div className="camera-placeholder" />
                  </div>
                </div>
              ) : selectedFile ? (
                <div className="image-preview-wrapper">
                  <div className="image-preview-container">
                    <img
                      src={previewUrl}
                      alt="Selected travel document"
                      className="image-preview"
                    />
                    <div className="preview-overlay">
                      <div className="preview-file-name">
                        <CheckCircle2 size={16} />
                        <span>Photo ready</span>
                      </div>
                      <button
                        type="button"
                        className="remove-image"
                        onClick={clearImage}
                        aria-label="Remove image"
                      >
                        <X size={17} />
                      </button>
                    </div>
                  </div>

                  <div className="change-photo-row">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <RefreshCw size={15} />
                      Change photo
                    </button>
                    <button type="button" onClick={startCamera}>
                      <Camera size={15} />
                      Take another
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="upload-area"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                >
                  <div className="upload-icon">
                    <ImagePlus size={27} />
                  </div>
                  <h3>Upload a travel photo</h3>
                  <p>Drag and drop an image here, or choose an option below.</p>
                  <div className="upload-buttons">
                    <button
                      type="button"
                      className="upload-button primary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload size={17} />
                      Upload photo
                    </button>
                    <button
                      type="button"
                      className="upload-button secondary"
                      onClick={startCamera}
                    >
                      <Camera size={17} />
                      Take photo
                    </button>
                  </div>
                  <span className="upload-hint">JPG, PNG or WEBP</span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden-file-input"
                onChange={handleFileChange}
              />

              <button
                type="button"
                className="translate-button"
                disabled={
                  (mode === "photo" ? !selectedFile : !inputText.trim()) || loading
                }
                onClick={handleTranslate}
              >
                {loading ? (
                  <>
                    <Loader2 size={19} className="spin" />
                    Translating...
                  </>
                ) : (
                  <>
                    <Sparkles size={19} />
                    {mode === "photo" ? "Translate photo" : "Translate text"}
                    <ArrowRight size={17} />
                  </>
                )}
              </button>

              {error && (
                <div className="translator-error">
                  <div className="error-icon">!</div>
                  <div>
                    <strong>Translation failed</strong>
                    <p>{error}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setError("")}
                    aria-label="Dismiss error"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT OUTPUT PANE */}
            <div className="workspace-output-pane">
              {loading && (
                <div className="translation-loading">
                  <div className="loading-animation">
                    <span />
                    <span />
                    <span />
                  </div>
                  <p>
                    {mode === "photo"
                      ? "Reading text and translating..."
                      : "Translating..."}
                  </p>
                </div>
              )}

              {!translationResult && !loading && (
                <div className="output-placeholder">
                  <Globe2 size={36} />
                  <h4>Ready for Translation</h4>
                  <p>
                    {mode === "photo"
                      ? "Upload or take a photo to view translation results here."
                      : "Type or speak your text to see translation results here."}
                  </p>
                </div>
              )}

              {translationResult && (
                <div className="translation-result">
                  {mode === "photo" &&
                    photoSize &&
                    previewUrl &&
                    translationResult.lines?.length > 0 && (
                      <div className="result-box overlay-box">
                        <div className="result-header">
                          <span>Translation on photo</span>
                          <button
                            type="button"
                            onClick={() => setShowOverlay((on) => !on)}
                          >
                            {showOverlay ? "Hide overlay" : "Show overlay"}
                          </button>
                        </div>
                        <div className="overlay-photo">
                          <img
                            src={previewUrl}
                            alt="Your photo with translated text"
                          />
                          {showOverlay &&
                            translationResult.lines.map((line, index) => (
                              <OverlayLine
                                key={index}
                                line={line}
                                size={photoSize}
                              />
                            ))}
                        </div>
                      </div>
                    )}

                  {/* ORIGINAL TEXT BOX WITH TTS LISTEN */}
                  <div className="result-box">
                    <div className="result-header">
                      <span>Original text</span>
                      {canSpeak && translationResult.text && (
                        <button
                          type="button"
                          onClick={() =>
                            speakText(
                              translationResult.text,
                              translationResult.detected_lang || sourceLanguage
                            )
                          }
                        >
                          <Volume2 size={15} />
                          Listen
                        </button>
                      )}
                    </div>
                    <p>
                      {translationResult.text || "No readable text found."}
                    </p>
                  </div>

                  {/* TRANSLATED RESULT BOX */}
                  <div className="result-box translated">
                    <div className="result-header">
                      <span>Translation</span>
                      {canSpeak && (
                        <button
                          type="button"
                          onClick={() =>
                            speakText(
                              translationResult.translation,
                              targetLanguage
                            )
                          }
                          disabled={!translationResult.translation}
                        >
                          <Volume2 size={15} />
                          Listen
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={copyTranslation}
                        disabled={!translationResult.translation}
                      >
                        {copied ? (
                          <CheckCircle2 size={15} />
                        ) : (
                          <Copy size={15} />
                        )}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p>
                      {translationResult.translation ||
                        translationResult.message ||
                        "No translation available."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* INLINE COLLAPSIBLE HISTORY DRAWER */}
          {history.length > 0 && (
            <details className="history-accordion">
              <summary>
                <div className="history-summary-title">
                  <History size={16} />
                  <span>Recent Translations & Favorites ({history.length})</span>
                </div>
                <ChevronDown size={16} className="accordion-chevron" />
              </summary>
              <div className="history-list">
                {history.map((item) => (
                  <div key={item.id} className="history-card">
                    <div className="history-details">
                      <span className="history-meta">
                        {item.from} → {item.to}
                      </span>
                      <span className="history-text">{item.translation}</span>
                      <span className="history-subtext">{item.original}</span>
                    </div>
                    <button
                      type="button"
                      className={`favorite-star-btn ${item.isFavorite ? "active" : ""}`}
                      onClick={() => toggleFavorite(item.id)}
                      aria-label="Toggle favorite"
                    >
                      <Star size={16} fill={item.isFavorite ? "currentColor" : "none"} />
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>

        {/* ONBOARDING STEPS */}
        <section className="translator-info">
          <div className="info-item">
            <div className="info-number">01</div>
            <div>
              <strong>
                {mode === "photo" ? "Take a photo" : "Type or speak"}
              </strong>
              <p>
                {mode === "photo"
                  ? "Photograph signs, menus or documents while travelling."
                  : "Type a phrase or tap the microphone to dictate hands-free."}
              </p>
            </div>
          </div>

          <div className="info-line" />

          <div className="info-item">
            <div className="info-number">02</div>
            <div>
              <strong>Choose a language</strong>
              <p>Select the language you want the text translated into.</p>
            </div>
          </div>

          <div className="info-line" />

          <div className="info-item">
            <div className="info-number">03</div>
            <div>
              <strong>Get your translation</strong>
              <p>
                {mode === "photo"
                  ? "Our OCR service reads and translates text from your photo."
                  : "Instant translation rendered side-by-side with text-to-speech."}
              </p>
            </div>
          </div>
        </section>

        <div className="translator-footer-message">
          <MapPin size={17} />
          <span>Wherever your family travels, understand the world around you.</span>
          <Plane size={18} />
        </div>
      </main>
    </div>
  );
}

export default Translator;