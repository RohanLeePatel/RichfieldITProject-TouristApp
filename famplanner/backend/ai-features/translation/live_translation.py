import os
import cv2
import pytesseract
import detectlanguage
from deep_translator import GoogleTranslator
from dotenv import load_dotenv

load_dotenv()

detectlanguage.configuration.api_key = os.getenv(
    "detectlanguageAPIKey"
)


pytesseract.pytesseract.tesseract_cmd = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)

#opens the camera
capture = cv2.VideoCapture(0)

capture.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
capture.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

if not capture.isOpened():
    print("Could not open camera")
    exit()

while True:

    ret, frame = capture.read()
    if not ret:
        print("Could not read frame")
        break

    cv2.imshow(
        "Live Translator - Press SPACE to take picture",
        frame
    )


    key = cv2.waitKey(1) & 0xFF

    if key == ord(" "):
        print("\nTaking picture...")

        gray = cv2.cvtColor(
            frame,
            cv2.COLOR_BGR2GRAY
        )

        text = pytesseract.image_to_string(
            gray,
            lang="eng+fra+spa+deu+ita+por",
            config="--psm 6"
        ).strip()
        text = " ".join(text.split())


        print("\n-----------------------------")
        print("OCR RESULT")
        print("-----------------------------")
        print(text)

        if len(text) < 3:
            print("\nNo readable text found.")
            continue

        try:
            detected_lang = detectlanguage.detect_code(text)
            print("\nDetected language:")
            print(detected_lang)
        except Exception as e:
            print("\nLanguage detection error:")
            print(e)
            continue

        supported_languages = [
            "en",
            "fr",
            "es",
            "de",
            "it",
            "pt"
        ]


        if detected_lang not in supported_languages:
            print(
                f"\nUnsupported language: "
                f"{detected_lang}"
            )
            continue
        try:
            translator = GoogleTranslator(
                source=detected_lang,
                target="en"
            )

            translated_text = translator.translate(text)
            print("\n-----------------------------")
            print("TRANSLATION")
            print("-----------------------------")
            print(translated_text)
            print("-----------------------------\n")
        except Exception as e:
            print("\nTranslation error:")
            print(e)

    elif key == ord("q"):

        break
capture.release()
cv2.destroyAllWindows()