import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Camera,
  CheckCircle2,
  Copy,
  Globe2,
  ImagePlus,
  Loader2,
  MapPin,
  Mic,
  Plane,
  RefreshCw,
  Sparkles,
  Type,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
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
const SpeechRecognition =
  typeof window !== "undefined" &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);
const canSpeak =
  typeof window !== "undefined" && "speechSynthesis" in window;

// OCR goes through the Node backend's proxy (routes/translation.js), which adds
// the node-secretkey server side - nothing secret in the browser bundle.
const API_BASE_URL =
  import.meta.env.VITE_BACKEND_API_URL || "http://127.0.0.1:3000";

function Translator() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("EN-US");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [translationResult, setTranslationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState("photo");
  const [inputText, setInputText] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [listening, setListening] = useState(false);
  const [photoSize, setPhotoSize] = useState(null);
  const [showOverlay, setShowOverlay] = useState(true);

  const recognitionRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      }

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFile = (file) => {
    if (!file) return;

    setError("");
    setTranslationResult(null);
    setCopied(false);

    if (!file.type || !file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
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

    if (file) {
      handleFile(file);
    }

    event.target.value = "";
  };

  const handleDrop = (event) => {
    event.preventDefault();

    const file = event.dataTransfer.files?.[0];

    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const startCamera = async () => {
    setError("");
    setTranslationResult(null);

    try {
      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setError("Your browser does not support camera access.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: "environment",
          },
        },
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

      setError(
        "Unable to access your camera. Please allow camera permission and try again."
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

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

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Could not create the photo.");
          return;
        }

        const file = new File(
          [blob],
          `travel-photo-${Date.now()}.jpg`,
          {
            type: "image/jpeg",
          }
        );

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

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (canSpeak) window.speechSynthesis.cancel();
    };
  }, []);

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

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (copyError) {
      console.error("Copy failed:", copyError);

      setError("Unable to copy the translation.");
    }
  };

  // reads the translation aloud in the target language (browser speech synthesis)
  const speakTranslation = () => {
    const text = translationResult?.translation;
    if (!text || !canSpeak) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLang(targetLanguage);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  // dictate into the text box; language = chosen source, else the browser's own
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

  // detected language stands in for "auto" so a translation can be flipped back
  const swapFrom =
    sourceLanguage !== "auto"
      ? sourceLanguage
      : baseCode(translationResult?.detected_lang);
  const canSwap = Boolean(
    swapFrom && SOURCE_LANGUAGES.some((l) => l.code === swapFrom) && targetForBase(swapFrom)
  );

  const swapLanguages = () => {
    if (!canSwap) return;

    const newTarget = targetForBase(swapFrom);
    setSourceLanguage(baseCode(targetLanguage));
    setTargetLanguage(newTarget);

    // typed text: the translation becomes the new input
    if (mode === "text" && translationResult?.translation) {
      setInputText(translationResult.translation);
    }
    setTranslationResult(null);
  };

  return (
    <div className="translator-page">

      <header className="translator-header">

        <div className="translator-brand">

          <div className="translator-logo">
            <Plane size={19} />
          </div>

          <span>
            Roam<span>io</span>
          </span>

        </div>

        <Link
          to="/dashboard"
          className="back-dashboard"
        >
          <ArrowLeft size={17} />
          Back to Dashboard
        </Link>

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
            Take a photo of a sign, menu or document
            and translate it instantly into your chosen
            language.
          </p>

        </section>

        <section className="translator-card">

          <div className="translator-left">

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

            {mode === "text" ? (
              <>
                <div className="translator-card-header">
                  <div>
                    <span className="translator-eyebrow">STEP 1</span>
                    <h2>Type or speak</h2>
                  </div>
                  <div className="translator-step-icon">
                    <Type size={20} />
                  </div>
                </div>

                <div className="text-input-box">
                  <textarea
                    value={inputText}
                    maxLength={MAX_TEXT_CHARS}
                    placeholder="Type a phrase, or press the microphone and say it..."
                    aria-label="Text to translate"
                    onChange={(event) => {
                      setInputText(event.target.value);
                      setTranslationResult(null);
                    }}
                  />
                  <div className="text-input-footer">
                    <span>{inputText.length}/{MAX_TEXT_CHARS}</span>
                    {SpeechRecognition ? (
                      <button
                        type="button"
                        className={listening ? "mic-button listening" : "mic-button"}
                        onClick={toggleListening}
                        aria-pressed={listening}
                      >
                        <Mic size={16} />
                        {listening ? "Listening... tap to stop" : "Speak"}
                      </button>
                    ) : (
                      <span title="Speech input needs Chrome, Edge or Safari">
                        Speech input is not supported in this browser
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>

            <div className="translator-card-header">

              <div>
                <span className="translator-eyebrow">
                  STEP 1
                </span>

                <h2>Add a photo</h2>
              </div>

              <div className="translator-step-icon">
                <ImagePlus size={20} />
              </div>

            </div>

            {cameraOpen ? (

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

                  <p>
                    Position the text inside the frame
                  </p>

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

            ) : (

              <div
                className="upload-area"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >

                <div className="upload-icon">
                  <ImagePlus size={27} />
                </div>

                <h3>
                  Upload a travel photo
                </h3>

                <p>
                  Drag and drop an image here,
                  or choose an option below.
                </p>

                <div className="upload-buttons">

                  <button
                    type="button"
                    className="upload-button primary"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
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

                <span className="upload-hint">
                  JPG, PNG or WEBP
                </span>

              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden-file-input"
              onChange={handleFileChange}
            />

            {selectedFile && !cameraOpen && (

              <div className="change-photo-row">

                <button
                  type="button"
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                >
                  <RefreshCw size={15} />
                  Change photo
                </button>

                <button
                  type="button"
                  onClick={startCamera}
                >
                  <Camera size={15} />
                  Take another photo
                </button>

              </div>
            )}

              </>
            )}
          </div>

          <div className="translator-right">

            <div className="translator-card-header">

              <div>

                <span className="translator-eyebrow">
                  STEP 2
                </span>

                <h2>
                  Choose language
                </h2>

              </div>

              <div className="translator-step-icon language-icon">
                <Globe2 size={20} />
              </div>

            </div>

            <div className="language-row">

              <div className="language-select-wrapper">

                <label htmlFor="source-language">
                  Translate from
                </label>

                <div className="language-select">

                  <Globe2 size={18} />

                  <select
                    id="source-language"
                    value={sourceLanguage}
                    onChange={(event) =>
                      setSourceLanguage(event.target.value)
                    }
                  >
                    <option value="auto">Auto-detect</option>

                    {SOURCE_LANGUAGES.map((language) => (
                      <option key={language.code} value={language.code}>
                        {language.name}
                      </option>
                    ))}
                  </select>

                </div>

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
                <ArrowLeftRight size={17} />
              </button>

              <div className="language-select-wrapper">

                <label htmlFor="target-language">
                  Translate into
                </label>

                <div className="language-select">

                  <Globe2 size={18} />

                  <select
                    id="target-language"
                    value={targetLanguage}
                    onChange={(event) =>
                      setTargetLanguage(event.target.value)
                    }
                  >
                    {LANGUAGES.map((language) => (
                      <option key={language.code} value={language.code}>
                        {language.name}
                      </option>
                    ))}
                  </select>

                </div>

              </div>

            </div>

            <button
              type="button"
              className="translate-button"
              disabled={(mode === "photo" ? !selectedFile : !inputText.trim()) || loading}
              onClick={handleTranslate}
            >

              {loading ? (
                <>
                  <Loader2
                    size={19}
                    className="spin"
                  />
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

            {loading && (

              <div className="translation-loading">

                <div className="loading-animation">
                  <span />
                  <span />
                  <span />
                </div>

                <p>
                  {mode === "photo" ? "Reading the text and translating it..." : "Translating..."}
                </p>

              </div>
            )}

            {error && (

              <div className="translator-error">

                <div className="error-icon">
                  !
                </div>

                <div>

                  <strong>
                    Translation failed
                  </strong>

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

            {translationResult && (

              <div className="translation-result">

                <div className="detected-language">

                  <div>

                    <span>
                      DETECTED LANGUAGE
                    </span>

                    <strong>
                      {translationResult.detected_lang ||
                        "Unknown"}
                    </strong>

                  </div>

                  <CheckCircle2 size={19} />

                </div>

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
                          {showOverlay ? "Hide" : "Show"}
                        </button>
                      </div>
                      <div className="overlay-photo">
                        <img src={previewUrl} alt="Your photo with the translation drawn over it" />
                        {showOverlay &&
                          translationResult.lines.map((line, index) => (
                            <span
                              key={index}
                              className="overlay-line"
                              style={{
                                left: `${(line.left / photoSize.width) * 100}%`,
                                top: `${(line.top / photoSize.height) * 100}%`,
                                minWidth: `${(line.width / photoSize.width) * 100}%`,
                                minHeight: `${(line.height / photoSize.height) * 100}%`,
                                fontSize: `${(line.height / photoSize.width) * 58}cqw`,
                              }}
                            >
                              {line.translation}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                <div className="result-box">

                  <div className="result-header">
                    <span>
                      Original text
                    </span>
                  </div>

                  <p>
                    {translationResult.text ||
                      "No readable text found."}
                  </p>

                </div>

                <div className="result-box translated">

                  <div className="result-header">

                    <span>
                      Translation
                    </span>

                    {canSpeak && (
                      <button
                        type="button"
                        onClick={speakTranslation}
                        disabled={!translationResult.translation}
                      >
                        <Volume2 size={15} />
                        Listen
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={copyTranslation}
                      disabled={
                        !translationResult.translation
                      }
                    >

                      {copied ? (
                        <CheckCircle2 size={15} />
                      ) : (
                        <Copy size={15} />
                      )}

                      {copied
                        ? "Copied"
                        : "Copy"}

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

        </section>

        <section className="translator-info">

          <div className="info-item">

            <div className="info-number">
              01
            </div>

            <div>

              <strong>
                Take a photo
              </strong>

              <p>
                Photograph signs, menus or documents
                while travelling.
              </p>

            </div>

          </div>

          <div className="info-line" />

          <div className="info-item">

            <div className="info-number">
              02
            </div>

            <div>

              <strong>
                Choose a language
              </strong>

              <p>
                Select the language you want the
                text translated into.
              </p>

            </div>

          </div>

          <div className="info-line" />

          <div className="info-item">

            <div className="info-number">
              03
            </div>

            <div>

              <strong>
                Get your translation
              </strong>

              <p>
                Our OCR and translation service
                reads and translates the text.
              </p>

            </div>

          </div>

        </section>

        <div className="translator-footer-message">

          <MapPin size={17} />

          <span>
            Wherever your family travels, understand
            the world around you.
          </span>

          <Plane size={18} />

        </div>

      </main>

    </div>
  );
}

export default Translator;

