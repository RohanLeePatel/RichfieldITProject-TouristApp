import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Copy,
  Globe2,
  ImagePlus,
  Loader2,
  MapPin,
  Plane,
  RefreshCw,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import "../styles/Translator.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const API_SECRET_KEY =
  import.meta.env.VITE_TRANSLATION_SECRET_KEY || "";

const LANGUAGES = [
  { code: "AR", name: "Arabic" },
  { code: "BG", name: "Bulgarian" },
  { code: "CS", name: "Czech" },
  { code: "DA", name: "Danish" },
  { code: "DE", name: "German" },
  { code: "EL", name: "Greek" },
  { code: "EN-GB", name: "English (British)" },
  { code: "EN-US", name: "English (American)" },
  { code: "ES", name: "Spanish" },
  { code: "ES-419", name: "Spanish (Latin American)" },
  { code: "ET", name: "Estonian" },
  { code: "FI", name: "Finnish" },
  { code: "FR", name: "French" },
  { code: "HE", name: "Hebrew" },
  { code: "HU", name: "Hungarian" },
  { code: "ID", name: "Indonesian" },
  { code: "IT", name: "Italian" },
  { code: "JA", name: "Japanese" },
  { code: "KO", name: "Korean" },
  { code: "LT", name: "Lithuanian" },
  { code: "LV", name: "Latvian" },
  { code: "NB", name: "Norwegian (Bokmål)" },
  { code: "NL", name: "Dutch" },
  { code: "PL", name: "Polish" },
  { code: "PT-BR", name: "Portuguese (Brazilian)" },
  { code: "PT-PT", name: "Portuguese (European)" },
  { code: "RO", name: "Romanian" },
  { code: "RU", name: "Russian" },
  { code: "SK", name: "Slovak" },
  { code: "SL", name: "Slovenian" },
  { code: "SV", name: "Swedish" },
  { code: "TH", name: "Thai" },
  { code: "TR", name: "Turkish" },
  { code: "UK", name: "Ukrainian" },
  { code: "VI", name: "Vietnamese" },
  { code: "ZH", name: "Chinese (Simplified)" },
  { code: "ZH-HANT", name: "Chinese (Traditional)" },
];

function Translator() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("EN-US");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [translationResult, setTranslationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

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

  const handleTranslate = async () => {
    if (!selectedFile) {
      setError(
        "Please upload an image or take a photo first."
      );
      return;
    }

    setLoading(true);
    setError("");
    setTranslationResult(null);
    setCopied(false);

    try {
      const formData = new FormData();

      formData.append("image", selectedFile);
      formData.append("target_lang", targetLanguage);

      const headers = {};

      if (API_SECRET_KEY.trim()) {
        headers["node-secretkey"] = API_SECRET_KEY.trim();
      }

      const apiUrl =
        API_BASE_URL.replace(/\/$/, "") + "/ocr";

      console.log("Translation API:", apiUrl);

      const response = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: formData,
      });

      let data = null;

      try {
        data = await response.json();
      } catch (jsonError) {
        console.error(
          "Could not read JSON response:",
          jsonError
        );
      }

      if (!response.ok) {
        let message =
          `Translation request failed with status ${response.status}.`;

        if (data?.detail) {
          message = data.detail;
        } else if (data?.message) {
          message = data.message;
        }

        if (response.status === 401) {
          message =
            "Unauthorized. Check your translation secret key.";
        }

        if (response.status === 422) {
          message =
            "FastAPI rejected the request. Check the image and target_lang fields.";
        }

        throw new Error(message);
      }

      if (!data) {
        throw new Error(
          "The translation server returned an empty response."
        );
      }

      setTranslationResult(data);
    } catch (requestError) {
      console.error(
        "Translation error:",
        requestError
      );

      if (requestError instanceof TypeError) {
        setError(
          `Could not connect to the FastAPI server. Make sure it is running at ${API_BASE_URL} and check your CORS settings.`
        );
      } else {
        setError(
          requestError.message ||
            "Unable to connect to the translation service."
        );
      }
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
                    setTargetLanguage(
                      event.target.value
                    )
                  }
                >

                  {LANGUAGES.map((language) => (

                    <option
                      key={language.code}
                      value={language.code}
                    >
                      {language.name}
                    </option>

                  ))}

                </select>

              </div>

            </div>

            <button
              type="button"
              className="translate-button"
              disabled={!selectedFile || loading}
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
                  Translate photo
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
                  Reading the text and translating it...
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

