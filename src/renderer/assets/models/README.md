# Bundled models

Models ship inside the app so VYRO works without internet.

## pose_landmarker_lite.task

- Source: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task
- SHA-256: `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`
- Size: 5,777,746 bytes
- License: Apache 2.0 (Google MediaPipe)
- Contents: a zip with `pose_detector.tflite` and `pose_landmarks_detector.tflite`.

The `lite` variant is the default. Whether to switch to `full` is decided from the FPS measured in phase 2 (see `docs/PROJECT_SPEC.md`, section 11).

## hand_landmarker.task

- Source: https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
- SHA-256: `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`
- Size: 7,819,105 bytes
- License: Apache 2.0 (Google MediaPipe)
- Contents: a zip with `hand_detector.tflite` and `hand_landmarks_detector.tflite`.
- Used by the hands channel (up to two hands per frame, 21 points each).

## guitar_detector.tflite

- Source: trained by this project (`tools/guitar-detector/`, MediaPipe Model Maker, base model `MOBILENET_V2`, 30 epochs) on 2,999 guitar pictures of Open Images V7. Data and license: `docs/OBJECT_DATA.md`.
- SHA-256: `6943399a47747038722ef4b6eb9308f00694bd0350d0b42f2ce26afa7678a716`
- Size: 10,902,227 bytes
- License: the pictures are CC BY 2.0 and the boxes CC BY 4.0 (Open Images); credit goes to the dataset.
- Class: `Guitar`. Measured on 296 pictures it never saw: AP50 0.822 (the minimum is 0.5), AP 0.534. It fails on small guitars (AP of medium objects 0.03); the full numbers are in `tools/guitar-detector/metrics.json`.
- Used by the object channel (T15.3 on).

## yamnet.tflite

- Source: https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite
- SHA-256: `4d8b4a53282dc83ef04e3e7dbc4fbc98082e34e44ed798e16c3a0cdd4c584faf`
- Size: 4,126,810 bytes
- License: Apache 2.0 (Google YAMNet, MediaPipe audio classifier); labels from AudioSet (CC BY 4.0).
- Classes: 521 AudioSet classes; VYRO groups some of them into instruments (see D19 in `docs/DECISIONS.md`).
- Input: 16 kHz mono audio in windows of 0.975 s. Used by the instrument check (phase 22). Try it with `node tools/instrument-classifier/classify.mjs` (set `CHROMIUM_PATH` to a Chromium executable).
