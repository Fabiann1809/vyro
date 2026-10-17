"""Builds guitar_detector.ipynb from the .py files of this folder.

The .py files are the source (they are easy to read and review); the notebook is what is
uploaded to Google Colab. A line with `# %%` starts a new cell. train_model.py is not a cell: the
notebook writes it to the Colab machine and runs it in the Python 3.10 environment.

    python tools/guitar-detector/build_notebook.py
"""

import json
from pathlib import Path

HERE = Path(__file__).parent
SCRIPT_ON_COLAB = "/content/train_model.py"

INTRO = """# VYRO guitar detector

Trains the small model that finds a guitar in the camera picture.

1. Runtime > Change runtime type > **T4 GPU**.
2. Runtime > **Run all**. If Colab asks to restart the session, restart it and run the rest.
3. The GPU cell must print a GPU. Training takes about one to two hours.
4. At the end the browser downloads `model.tflite` and `metrics.json`.

The pictures are public photos from Open Images and stay in this Colab machine
(see `docs/OBJECT_DATA.md`)."""


def split_cells(text):
    cells, current = [], []
    for line in text.splitlines():
        if line.strip() == "# %%":
            if current:
                cells.append("\n".join(current).strip())
            current = []
        else:
            current.append(line)
    if current:
        cells.append("\n".join(current).strip())
    return [cell for cell in cells if cell]


def code_cell(source):
    return {
        "cell_type": "code",
        "metadata": {},
        "execution_count": None,
        "outputs": [],
        "source": source.splitlines(keepends=True),
    }


def cells_of(name):
    return split_cells((HERE / name).read_text(encoding="utf-8"))


script = (HERE / "train_model.py").read_text(encoding="utf-8")
sources = (
    cells_of("download_data.py")
    + cells_of("setup_env.py")
    + [f"%%writefile {SCRIPT_ON_COLAB}\n{script}", f"!MPLBACKEND=Agg /content/mm/bin/python {SCRIPT_ON_COLAB}"]
    + cells_of("download_results.py")
)

cells = [{"cell_type": "markdown", "metadata": {}, "source": INTRO.splitlines(keepends=True)}]
cells.extend(code_cell(source) for source in sources)

notebook = {
    "cells": cells,
    "metadata": {
        "accelerator": "GPU",
        "colab": {"provenance": []},
        "kernelspec": {"display_name": "Python 3", "name": "python3"},
        "language_info": {"name": "python"},
    },
    "nbformat": 4,
    "nbformat_minor": 5,
}
target = HERE / "guitar_detector.ipynb"
target.write_text(json.dumps(notebook, indent=1) + "\n", encoding="utf-8")
print("wrote", target, "with", len(cells), "cells")
