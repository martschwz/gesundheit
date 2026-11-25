import { supabase } from "./supabase";
import type { FoodItem } from "./types";
import { functionError } from "./fnError";

/** Bild verkleinern (spart Datenvolumen und Kosten), Ergebnis als Base64-JPEG. */
async function downscale(file: File, maxSide = 1600): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.85);
  return url.slice(url.indexOf(",") + 1);
}

export type Estimate = { title: string; items: FoodItem[]; hint: string };

const round = (n: unknown) => Math.max(0, Math.round(Number(n) || 0));

export async function estimateMeal(input: { file?: File | null; text?: string }): Promise<Estimate> {
  if (!navigator.onLine) throw new Error("Für die Schätzung braucht die App Internet. Du kannst die Mahlzeit auch von Hand eintragen.");
  const image = input.file ? await downscale(input.file) : undefined;
  const { data, error } = await supabase.functions.invoke("estimate-meal", {
    body: { image, mediaType: "image/jpeg", text: input.text ?? "" },
  });
  if (error) throw await functionError(error, "Die KI-Schätzung", "KI-Schätzung");
  const items = ((data?.items ?? []) as FoodItem[]).map((i) => ({
    name: String(i.name ?? ""),
    amount: String(i.amount ?? ""),
    kcal: round(i.kcal),
    protein: round(i.protein),
    carbs: round(i.carbs),
    fat: round(i.fat),
  }));
  return { title: String(data?.title ?? ""), items, hint: String(data?.hint ?? "") };
}
