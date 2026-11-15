"""Train an eye-image classifier and export weights for the web app.

Images come from the labelled Eye_diseases folders. The nested duplicate of
those folders is not used. The exported model is a regularized linear
classifier on color and layout features, chosen because a raw-pixel network
overfit this small set.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

ARCHIVE = Path(r"C:\Users\Arwa Gulati\Downloads\archive\Eye_diseases")
OUT = Path(__file__).resolve().parents[1] / "lib" / "eye-screen" / "weights.json"

CLASSES = [
    ("Bulging_Eyes", "bulging_eyes", "Bulging eyes"),
    ("Cataracts", "cataracts", "Cataracts"),
    ("Crossed_Eyes", "crossed_eyes", "Crossed eyes"),
    ("Glaucoma", "glaucoma", "Glaucoma"),
    ("Uveitis", "uveitis", "Uveitis"),
]

SIZE = 32
GRID = 8
BLOCK = SIZE // GRID
SEED = 7
EPOCHS = 240
BATCH = 32
LR = 2e-2
WEIGHT_DECAY = 5e-3


def load_images() -> tuple[np.ndarray, np.ndarray]:
    pixels: list[np.ndarray] = []
    labels: list[int] = []
    for class_index, (folder, _class_id, _label) in enumerate(CLASSES):
        kept = 0
        for path in sorted((ARCHIVE / folder).iterdir()):
            if not path.is_file():
                continue
            try:
                with Image.open(path) as image:
                    rgb = image.convert("RGB").resize((SIZE, SIZE), Image.Resampling.BILINEAR)
                    pixels.append(np.asarray(rgb, dtype=np.float64).reshape(-1) / 255.0)
                labels.append(class_index)
                kept += 1
            except Exception as error:
                print(f"skip {path.name}: {error}")
        print(f"{folder}: {kept} images")
    return np.stack(pixels), np.asarray(labels, dtype=np.int64)


def as_images(pixels: np.ndarray) -> np.ndarray:
    return pixels.reshape(pixels.shape[0], SIZE, SIZE, 3)


def features_from_images(images: np.ndarray) -> np.ndarray:
    """Match lib/eye-screen/features.ts. images is (N, 32, 32, 3) in 0..1."""
    rows = []
    for image in images:
        grid = image.reshape(GRID, BLOCK, GRID, BLOCK, 3).mean(axis=(1, 3)).reshape(-1)
        mean = image.mean(axis=(0, 1))
        std = image.std(axis=(0, 1))
        center = image[8:24, 8:24]
        center_mean = center.mean(axis=(0, 1))
        border = np.concatenate(
            [
                image[:8].reshape(-1, 3),
                image[24:].reshape(-1, 3),
                image[8:24, :8].reshape(-1, 3),
                image[8:24, 24:].reshape(-1, 3),
            ],
            axis=0,
        ).mean(axis=0)
        left_right = np.abs(image[:, :16].mean(axis=(0, 1)) - image[:, 16:].mean(axis=(0, 1)))
        top_bottom = np.abs(image[:16].mean(axis=(0, 1)) - image[16:].mean(axis=(0, 1)))
        red, green, blue = center[:, :, 0], center[:, :, 1], center[:, :, 2]
        maxc = np.maximum(np.maximum(red, green), blue)
        minc = np.minimum(np.minimum(red, green), blue)
        delta = maxc - minc
        hue = np.zeros_like(maxc)
        red_max = (maxc == red) & (delta > 1e-6)
        green_max = (maxc == green) & (delta > 1e-6)
        blue_max = (maxc == blue) & (delta > 1e-6)
        hue[red_max] = np.mod((green[red_max] - blue[red_max]) / delta[red_max], 6)
        hue[green_max] = (blue[green_max] - red[green_max]) / delta[green_max] + 2
        hue[blue_max] = (red[blue_max] - green[blue_max]) / delta[blue_max] + 4
        saturation = np.divide(delta, maxc, out=np.zeros_like(delta), where=maxc > 0)
        colored = (saturation > 0.15) & (maxc > 0.1)
        bins = np.zeros(8, dtype=np.float64)
        if colored.any():
            hue_index = np.minimum((hue[colored] / 6 * 8).astype(np.int64), 7)
            for index in hue_index:
                bins[index] += 1
            bins /= bins.sum()
        rows.append(np.concatenate([grid, mean, std, center_mean, border, left_right, top_bottom, bins]))
    return np.stack(rows)


def stratified_split(labels: np.ndarray, rng: np.random.Generator) -> tuple[np.ndarray, np.ndarray]:
    train: list[int] = []
    val: list[int] = []
    for class_index in range(len(CLASSES)):
        index = np.where(labels == class_index)[0]
        rng.shuffle(index)
        val_count = max(1, int(round(len(index) * 0.2)))
        val.extend(index[:val_count].tolist())
        train.extend(index[val_count:].tolist())
    return np.asarray(train), np.asarray(val)


def softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - logits.max(axis=1, keepdims=True)
    exp = np.exp(shifted)
    return exp / exp.sum(axis=1, keepdims=True)


def train_linear(
    x_train: np.ndarray,
    y_train: np.ndarray,
    x_val: np.ndarray,
    y_val: np.ndarray,
    rng: np.random.Generator,
    balanced: bool,
) -> tuple[dict[str, np.ndarray], float]:
    counts = np.bincount(y_train, minlength=len(CLASSES)).astype(np.float64)
    class_weight = x_train.shape[0] / (len(CLASSES) * counts) if balanced else np.ones(len(CLASSES))
    sample_weight = class_weight[y_train]
    weights = {
        "w": rng.normal(0, 0.01, size=(x_train.shape[1], len(CLASSES))),
        "b": np.zeros(len(CLASSES)),
    }
    moments = {name: (np.zeros_like(value), np.zeros_like(value)) for name, value in weights.items()}
    best = {name: value.copy() for name, value in weights.items()}
    best_accuracy = -1.0
    step = 0
    for _epoch in range(EPOCHS):
        order = rng.permutation(x_train.shape[0])
        for start in range(0, order.size, BATCH):
            batch_index = order[start : start + BATCH]
            batch = x_train[batch_index]
            targets = y_train[batch_index]
            batch_weight = sample_weight[batch_index]
            logits = batch @ weights["w"] + weights["b"]
            probs = softmax(logits)
            delta = probs
            delta[np.arange(batch.shape[0]), targets] -= 1.0
            delta *= batch_weight[:, None]
            delta /= batch_weight.sum()
            grads = {
                "w": batch.T @ delta + WEIGHT_DECAY * weights["w"],
                "b": delta.sum(axis=0),
            }
            step += 1
            for name, grad in grads.items():
                moment, velocity = moments[name]
                moment[:] = 0.9 * moment + 0.1 * grad
                velocity[:] = 0.999 * velocity + 0.001 * (grad * grad)
                weights[name] -= LR * (moment / (1 - 0.9**step)) / (np.sqrt(velocity / (1 - 0.999**step)) + 1e-8)
        predicted = (x_val @ weights["w"] + weights["b"]).argmax(axis=1)
        val_accuracy = float((predicted == y_val).mean())
        if val_accuracy >= best_accuracy:
            best_accuracy = val_accuracy
            best = {name: value.copy() for name, value in weights.items()}
    return best, best_accuracy


def knn_accuracy(x_train: np.ndarray, y_train: np.ndarray, x_val: np.ndarray, y_val: np.ndarray, k: int) -> float:
    hits = 0
    for features, label in zip(x_val, y_val, strict=True):
        distance = np.linalg.norm(x_train - features, axis=1)
        nearest = np.argsort(distance)[:k]
        scores = np.zeros(len(CLASSES))
        for index in nearest:
            scores[y_train[index]] += 1.0 / (distance[index] + 1e-6)
        hits += int(scores.argmax() == label)
    return hits / len(y_val)


def recalls(predicted: np.ndarray, labels: np.ndarray) -> dict[str, float]:
    result = {}
    for class_index, (_folder, class_id, _label) in enumerate(CLASSES):
        chosen = labels == class_index
        result[class_id] = float((predicted[chosen] == class_index).mean()) if chosen.any() else 0.0
    return result


def main() -> None:
    rng = np.random.default_rng(SEED)
    pixels, labels = load_images()
    extracted = features_from_images(as_images(pixels))
    train_index, val_index = stratified_split(labels, rng)
    mean = extracted[train_index].mean(axis=0)
    std = np.maximum(extracted[train_index].std(axis=0), 1e-6)
    scaled = (extracted - mean) / std
    x_train, y_train = scaled[train_index], labels[train_index]
    x_val, y_val = scaled[val_index], labels[val_index]

    balanced, balanced_accuracy = train_linear(x_train, y_train, x_val, y_val, rng, balanced=True)
    plain, plain_accuracy = train_linear(x_train, y_train, x_val, y_val, rng, balanced=False)
    knn_scores = {k: knn_accuracy(x_train, y_train, x_val, y_val, k) for k in (3, 5, 7)}
    print(f"linear balanced {balanced_accuracy:.3f}")
    print(f"linear plain {plain_accuracy:.3f}")
    print("knn", {k: round(score, 3) for k, score in knn_scores.items()})

    if balanced_accuracy >= plain_accuracy:
        chosen, chosen_accuracy, kind = balanced, balanced_accuracy, "linear-balanced"
    else:
        chosen, chosen_accuracy, kind = plain, plain_accuracy, "linear"
    predicted = (x_val @ chosen["w"] + chosen["b"]).argmax(axis=1)
    majority = float(np.bincount(y_val).max() / y_val.size)
    print(f"selected {kind} val {chosen_accuracy:.3f} majority {majority:.3f}")
    print("recall", recalls(predicted, y_val))

    mean = mean.round(6)
    std = std.round(6)
    chosen = {name: value.round(6) for name, value in chosen.items()}
    check_pixels = np.linspace(0.0, 1.0, SIZE * SIZE * 3, dtype=np.float64)
    check_features = features_from_images(as_images(check_pixels.reshape(1, -1)))
    check_scaled = (check_features - mean) / std
    fixture_probs = softmax(check_scaled @ chosen["w"] + chosen["b"])[0]

    payload = {
        "version": 2,
        "kind": kind,
        "imageSize": SIZE,
        "classes": [
            {"id": class_id, "label": label, "folder": folder}
            for folder, class_id, label in CLASSES
        ],
        "featureMean": mean.tolist(),
        "featureStd": std.tolist(),
        "w": chosen["w"].ravel().tolist(),
        "b": chosen["b"].tolist(),
        "metrics": {
            "trainedImages": int(x_train.shape[0]),
            "validationImages": int(x_val.shape[0]),
            "validationAccuracy": round(chosen_accuracy, 4),
            "majorityBaseline": round(majority, 4),
            "perClassRecall": {key: round(value, 4) for key, value in recalls(predicted, y_val).items()},
        },
        "fixtureProbs": fixture_probs.round(6).tolist(),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"saved {OUT}")


if __name__ == "__main__":
    main()
