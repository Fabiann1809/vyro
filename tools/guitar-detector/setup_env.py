# %%
# Part 2: is there a GPU? This must print a table with the name of a GPU (for example a Tesla T4).
# If it says the command was not found, the runtime has no GPU: Runtime > Change runtime type.
!nvidia-smi

# %%
# An environment with Python 3.10 just for training. MediaPipe Model Maker does not install on
# the newer Python that Colab ships, so it lives apart from the rest. It needs setuptools (the
# new environment has none) and the CUDA libraries that TensorFlow uses to reach the GPU.
%pip install -q uv
!uv venv --clear --python 3.10 /content/mm
!uv pip install --python /content/mm/bin/python mediapipe-model-maker "mediapipe==0.10.14" "setuptools<81"
!uv pip install --python /content/mm/bin/python --reinstall-package tensorflow "tensorflow[and-cuda]==2.15.1"

# %%
# The training must see the GPU; on the CPU alone it would take many hours.
!MPLBACKEND=Agg /content/mm/bin/python -c "import tensorflow as tf; print('GPUs:', tf.config.list_physical_devices('GPU'))"
