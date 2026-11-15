import { eyeFeatures, IMAGE_PIXELS } from "@/lib/eye-screen/features";
import weights from "@/lib/eye-screen/weights.json";

export type EyeScreen = {
  label: string;
  classId: string;
  confidence: number;
  unclear: boolean;
  probabilities: { id: string; label: string; probability: number }[];
  validationAccuracy: number;
  majorityBaseline: number;
  trainedImages: number;
  validationImages: number;
  disclaimer: string;
};

const CLASS_COUNT = weights.classes.length;

export function screenEye(pixels: number[]): EyeScreen {
  const probabilities = classProbabilities(pixels);
  const ranked = weights.classes
    .map((entry, index) => ({
      id: entry.id,
      label: entry.label,
      probability: probabilities[index],
    }))
    .sort((a, b) => b.probability - a.probability);
  const top = ranked[0];
  const second = ranked[1]?.probability ?? 0;
  const unclear = top.probability < 0.45 || top.probability - second < 0.08;
  const accuracy = Math.round(weights.metrics.validationAccuracy * 100);
  const baseline = Math.round(weights.metrics.majorityBaseline * 100);

  return {
    label: top.label,
    classId: top.id,
    confidence: top.probability,
    unclear,
    probabilities: ranked,
    validationAccuracy: weights.metrics.validationAccuracy,
    majorityBaseline: weights.metrics.majorityBaseline,
    trainedImages: weights.metrics.trainedImages,
    validationImages: weights.metrics.validationImages,
    disclaimer: `Experimental similarity screen trained on ${weights.metrics.trainedImages} labelled images and checked on ${weights.metrics.validationImages} held-out images (${accuracy}% correct, ${baseline}% if every image were called the largest class). Not a diagnosis, not a pupil measurement, and not a vision test.`,
  };
}

export function classProbabilities(pixels: number[]): number[] {
  const features = eyeFeatures(pixels);
  if (features.length !== weights.featureMean.length) {
    throw new Error("Feature size does not match the trained model.");
  }
  const scaled = features.map(
    (value, index) => (value - weights.featureMean[index]) / weights.featureStd[index],
  );
  const logits = weights.b.slice();
  for (let feature = 0; feature < scaled.length; feature += 1) {
    const row = feature * CLASS_COUNT;
    for (let classIndex = 0; classIndex < CLASS_COUNT; classIndex += 1) {
      logits[classIndex] += scaled[feature] * weights.w[row + classIndex];
    }
  }
  return softmax(logits);
}

export function eyeHandoffNote(stamp: string, screen: EyeScreen | null): string {
  const lead = `EYE HANDOFF LOG: still frame captured locally at ${stamp}.`;
  if (!screen) {
    return `${lead} Experimental visual log for crew handoff only — the image screen was unavailable. It is not a pupil measurement and not a diagnosis.`;
  }
  const percent = Math.round(screen.confidence * 100);
  const match = screen.unclear
    ? `Experimental image screen found no clear match. Closest label: ${screen.label} (${percent}%).`
    : `Experimental image screen closest match: ${screen.label} (${percent}%).`;
  return `${lead} ${match} Held-out accuracy on the labelled set was ${Math.round(screen.validationAccuracy * 100)}%. This is not a pupil measurement and not a diagnosis.`;
}

export function fixturePixels(): number[] {
  return Array.from({ length: IMAGE_PIXELS }, (_value, index) => index / (IMAGE_PIXELS - 1));
}

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exp = logits.map((value) => Math.exp(value - max));
  const total = exp.reduce((sum, value) => sum + value, 0);
  return exp.map((value) => value / total);
}
