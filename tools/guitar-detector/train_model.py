"""Trains the guitar detector with MediaPipe Model Maker and measures it on pictures it never saw.

It runs inside the Python 3.10 environment of the notebook, after download_data.py.
"""

import json
from datetime import date

import tensorflow as tf
from mediapipe_model_maker import object_detector

if not tf.config.list_physical_devices("GPU"):
    raise SystemExit("No GPU found: on the CPU this would take many hours. Stopping.")

CLASS_NAME = "Guitar"
TRAIN_DIR = "/content/guitar_data/train"
TEST_DIR = "/content/guitar_data/test"
EXPORT_DIR = "/content/guitar_model"
# The model is kept only if it finds at least half of the guitars with a good box (AP at IoU 0.5).
MIN_AP50 = 0.5

train_and_validation = object_detector.Dataset.from_coco_folder(
    TRAIN_DIR, cache_dir="/content/cache/train"
)
train_data, validation_data = train_and_validation.split(0.9)
test_data = object_detector.Dataset.from_coco_folder(TEST_DIR, cache_dir="/content/cache/test")

options = object_detector.ObjectDetectorOptions(
    supported_model=object_detector.SupportedModels.MOBILENET_V2,
    hparams=object_detector.HParams(
        batch_size=8, learning_rate=0.3, epochs=30, export_dir=EXPORT_DIR
    ),
)
model = object_detector.ObjectDetector.create(
    train_data=train_data, validation_data=validation_data, options=options
)

# The model is exported first, so a mistake while writing the report cannot lose the training.
model.export_model()


def plain(value):
    """Turns a number, or a list of numbers, into something json can write."""
    if isinstance(value, (list, tuple)):
        return [plain(item) for item in value]
    return float(value)


loss, coco_metrics = model.evaluate(test_data, batch_size=4)
ap50 = float(coco_metrics.get("AP50", 0.0))
report = {
    "date": date.today().isoformat(),
    "class": CLASS_NAME,
    "source": "Open Images V7",
    "base_model": "MOBILENET_V2",
    "train_pictures": train_and_validation.size,
    "test_pictures": test_data.size,
    "loss": plain(loss),
    "coco_metrics": {name: plain(value) for name, value in coco_metrics.items()},
    "minimum_ap50": MIN_AP50,
    "passes": ap50 >= MIN_AP50,
}
print(json.dumps(report, indent=2))

with open(f"{EXPORT_DIR}/metrics.json", "w") as handle:
    json.dump(report, handle, indent=2)
