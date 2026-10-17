# %%
# Part 1 of the guitar detector: the tool that downloads the pictures.
%pip install -q fiftyone

# %%
# Downloads boxes of guitars from Open Images V7 and writes them in the COCO layout that
# MediaPipe Model Maker reads. The pictures stay in this Colab machine; they are never added to
# the VYRO repository. Source and license: docs/OBJECT_DATA.md.
import fiftyone as fo
import fiftyone.zoo as foz

CLASS_NAME = "Guitar"
TRAIN_SAMPLES = 3000
# The test pictures come from the official test split, so the model never sees them while training.
TEST_SAMPLES = 300
TRAIN_DIR = "/content/guitar_data/train"
TEST_DIR = "/content/guitar_data/test"


def fetch(split, max_samples):
    return foz.load_zoo_dataset(
        "open-images-v7",
        split=split,
        label_types=["detections"],
        classes=[CLASS_NAME],
        only_matching=True,
        max_samples=max_samples,
        shuffle=True,
        seed=51,
        dataset_name=f"guitar-{split}",
    )


def export_coco(dataset, folder):
    dataset.export(
        dataset_type=fo.types.COCODetectionDataset,
        data_path=f"{folder}/images",
        labels_path=f"{folder}/labels.json",
        label_field="ground_truth",
        classes=[CLASS_NAME],
    )


train_set = fetch("train", TRAIN_SAMPLES)
test_set = fetch("test", TEST_SAMPLES)
export_coco(train_set, TRAIN_DIR)
export_coco(test_set, TEST_DIR)
print("pictures for training:", len(train_set), "- pictures for the final test:", len(test_set))
