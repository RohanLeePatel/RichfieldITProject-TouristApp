import cv2
import pytesseract
from deep_translator import GoogleTranslator
import time

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

LANGUAGES = {
    "english": ("eng", "en"),
    "french": ("fra", "fr"),
    "spanish": ("spa", "es"),
    "german": ("deu", "de"),
    "italian": ("ita", "it"),
    "portuguese": ("por", "pt"),
}

print("Available languages:", ", ".join(LANGUAGES.keys()))
choice = input("What language is the text in? ").strip().lower()

while choice not in LANGUAGES:
    choice = input("Not recognized, try again: ").strip().lower()

tess_lang, translate_lang = LANGUAGES[choice]
translator = GoogleTranslator(source=translate_lang, target="en")
cache = {}

capture = cv2.VideoCapture(0)
capture.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
capture.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

if not capture.isOpened():
    print("Could not open camera")
    exit()

last_ocr = 0
OCR_INTERVAL = 5

def is_clean_text(text):
    if len(text) < 3:
        return False
    letters = sum(c.isalpha() or c.isspace() for c in text)
    # Check if at least 85% of the characters are letters or spaces
    return (letters / len(text)) > 0.85

while True:
    ret, frame = capture.read()
    if not ret:
        print("Could not read frame")
        break

    now = time.time()
    if now - last_ocr > OCR_INTERVAL:
        last_ocr = now

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        text = pytesseract.image_to_string(
            gray, lang=tess_lang, config="--psm 6"
        ).strip()
        text = " ".join(text.split())

        if is_clean_text(text) and text not in cache:
            try:
                cache[text] = translator.translate(text)
            except Exception as e:
                print("Translation error:", e)
                cache[text] = text

        if text in cache and is_clean_text(text):
            print(f"{text} -> {cache[text]}")

    cv2.imshow("Live Translator", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

capture.release()
cv2.destroyAllWindows()