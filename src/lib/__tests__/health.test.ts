import { describe, expect, it } from "vitest";
import { formatDuration, labDef, parseDuration, rateBP, rateGlucose, rateSleep, rateWaist, waterGoal } from "../health";

describe("Blutdruck", () => {
  it("ordnet Werte ein", () => {
    expect(rateBP(115, 75).label).toBe("Optimal");
    expect(rateBP(128, 82).level).toBe("good");
    expect(rateBP(138, 80).level).toBe("mid");
    expect(rateBP(130, 88).level).toBe("mid");
    expect(rateBP(165, 95).label).toBe("Hoch");
    expect(rateBP(185, 100).label).toBe("Sehr hoch");
    expect(rateBP(85, 55).label).toBe("Niedrig");
  });
});

describe("Blutzucker", () => {
  it("unterscheidet nüchtern und nach dem Essen", () => {
    expect(rateGlucose(95, "nuechtern").level).toBe("good");
    expect(rateGlucose(110, "nuechtern").level).toBe("mid");
    expect(rateGlucose(130, "nuechtern").level).toBe("high");
    expect(rateGlucose(130, "nach").level).toBe("good");
    expect(rateGlucose(65, "nach").label).toBe("Unterzucker");
  });
});

describe("Weitere Werte", () => {
  it("Taille zu Größe", () => {
    expect(rateWaist(88, 180).level).toBe("good");
    expect(rateWaist(100, 180).level).toBe("mid");
    expect(rateWaist(112, 180).level).toBe("high");
  });
  it("Schlaf", () => {
    expect(rateSleep(7.5).level).toBe("good");
    expect(rateSleep(6.2).level).toBe("mid");
    expect(rateSleep(5).level).toBe("high");
  });
  it("Wasserziel", () => {
    expect(waterGoal(97)).toBe(3000);
    expect(waterGoal(70)).toBe(2500);
    expect(waterGoal(40)).toBe(1500);
  });
  it("liest Schlafdauer", () => {
    expect(parseDuration("7,5")).toBe(7.5);
    expect(parseDuration("7:30")).toBe(7.5);
    expect(parseDuration("6 h 45")).toBe(6.75);
    expect(parseDuration("abc")).toBeNull();
    expect(formatDuration(7.25)).toBe("7:15 h");
  });
  it("findet Laborwerte unabhängig von Groß-/Kleinschreibung", () => {
    expect(labDef("hba1c")?.rate?.(6, "m").level).toBe("mid");
    expect(labDef("HDL-Cholesterin")?.rate?.(45, "w").level).toBe("mid");
    expect(labDef("Unbekannt")).toBeUndefined();
  });
});
