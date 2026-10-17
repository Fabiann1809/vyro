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
