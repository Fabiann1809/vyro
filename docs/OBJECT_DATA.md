# Training data for the object detector

VYRO finds objects in the camera picture with a small detector trained by us (D16). The generic
detectors do not know a guitar. The first and only object is the **guitar**; a dumbbell was
dropped from the first round (the bicep curl is already measured from the body).

## What is used

| Set | Source | Classes | Pictures | Used for |
| --- | --- | --- | --- | --- |
| Training and validation | Open Images V7, split `train` | `Guitar` | up to 3000 | teaching the model |
| Test | Open Images V7, split `test` | `Guitar` | up to 300 | measuring the model on pictures it never saw |

- Home: <https://storage.googleapis.com/openimages/web/index.html>
- Boxes: Open Images V7 (`detections` labels, class `Guitar`).
- The sets are drawn at random with a fixed seed (`51`), so the same script gives the same list.

## License

- The **annotations** of Open Images are licensed by Google LLC under **CC BY 4.0**.
- The **pictures** are listed by Open Images as **CC BY 2.0** (public photos from Flickr).
- Check both on the home page above before publishing a release: the license is stated by the
  dataset, and this project has not checked each picture one by one.
- What is shipped is the trained model (a few MB of numbers), not the pictures. The model is a
  work derived from the dataset; this file and `src/renderer/assets/models/README.md` give the credit.

## Rules

- **No picture is ever added to the repository or to a release.** The script runs on Google Colab:
  the pictures are downloaded to the Colab machine and disappear with the session.
- The script is `tools/guitar-detector/download_data.py` (data) and `train.py` (training). It
  is turned into a notebook for Colab with `build_notebook.py`.
- The photos are only used to train the detector. Nothing that VYRO records with the camera or
  the microphone is used for training or uploaded anywhere.
