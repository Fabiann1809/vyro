# %%
# Hands the model and its numbers to the browser's downloads.
from google.colab import files

files.download("/content/guitar_model/model.tflite")
files.download("/content/guitar_model/metrics.json")
