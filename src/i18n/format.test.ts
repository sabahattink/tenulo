import { describe, expect, it } from "vitest";
import { parseLocalDate as d } from "../domain/date";
import { i18nFor } from "./index";

const en = i18nFor("en").f;
const tr = i18nFor("tr").f;
const today = d("2026-10-19");

describe("numbers", () => {
  it("uses the language's decimal mark and a true minus sign", () => {
    expect(en.decimal(82.44, 1)).toBe("82.4");
    expect(tr.decimal(82.44, 1)).toBe("82,4");
    expect(tr.decimal(-1.25, 2)).toBe("−1,25");
    expect(tr.decimal(-0.04, 1)).toBe("0,0");
  });

  it("groups thousands", () => {
    expect(en.integer(1850)).toBe("1,850");
    expect(tr.integer(1850)).toBe("1.850");
    expect(tr.integer(1_234_567)).toBe("1.234.567");
    expect(tr.integer(999)).toBe("999");
    expect(en.integer(-1200)).toBe("−1,200");
  });

  it("localizes weights and changes from the domain formatting", () => {
    expect(en.weight(82_400, "kg")).toBe("82.4 kg");
    expect(tr.weight(82_400, "kg")).toBe("82,4 kg");
    expect(tr.weight(82_400, "lb")).toBe("181,7 lb");
    expect(en.weightChange(-600, "kg")).toBe("−0.6 kg");
    expect(tr.weightChange(-600, "kg")).toBe("−0,6 kg");
    expect(tr.weightChange(1200, "kg")).toBe("+1,2 kg");
    expect(tr.weightChange(20, "kg")).toBe("0,0 kg");
    expect(tr.weightNumber(75_500, "kg")).toBe("75,5");
  });

  it("formats doses without trailing zeros", () => {
    expect(en.dose(250)).toBe("0.25 mg");
    expect(tr.dose(250)).toBe("0,25 mg");
    expect(tr.dose(15_000)).toBe("15 mg");
    expect(tr.doseNumber(2500)).toBe("2,5");
    expect(en.doseNumber(2500)).toBe("2.5");
  });

  it("keeps the 24-hour clock in both languages", () => {
    expect(en.time(540)).toBe("09:00");
    expect(tr.time(1_395)).toBe("23:15");
  });
});

describe("dates", () => {
  it("formats short and relative dates", () => {
    expect(en.shortDate(d("2026-10-05"), today)).toBe("5 Oct");
    expect(en.shortDate(d("2027-01-15"), today)).toBe("15 Jan 2027");
    expect(tr.shortDate(d("2026-10-18"), today)).toBe("18 Eki");
    expect(tr.shortDate(d("2027-08-03"), today)).toBe("3 Ağu 2027");
    expect(en.relativeDay(today, today)).toBe("Today");
    expect(en.relativeDay(d("2026-10-18"), today)).toBe("Yesterday");
    expect(en.relativeDay(d("2026-10-16"), today)).toBe("3 days ago");
    expect(en.relativeDay(d("2026-10-01"), today)).toBe("1 Oct");
    expect(tr.relativeDay(today, today)).toBe("Bugün");
    expect(tr.relativeDay(d("2026-10-18"), today)).toBe("Dün");
    expect(tr.relativeDay(d("2026-10-16"), today)).toBe("3 gün önce");
    expect(tr.relativeDay(d("2026-10-01"), today)).toBe("1 Eki");
    expect(tr.relativeDay(d("2026-10-25"), today)).toBe("25 Eki");
  });

  it("has inline forms for use inside a sentence", () => {
    expect(en.relativeDayInline(today, today)).toBe("today");
    expect(en.relativeDayInline(d("2026-10-18"), today)).toBe("yesterday");
    expect(tr.relativeDayInline(today, today)).toBe("bugün");
    expect(tr.relativeDayInline(d("2026-10-18"), today)).toBe("dün");
    expect(tr.relativeDayInline(d("2026-10-15"), today)).toBe("4 gün önce");
  });

  it("names the weekday and month", () => {
    expect(en.longWeekday(d("2026-10-29"))).toBe("Thursday, 29 October");
    expect(en.longWeekday(d("2026-11-02"))).toBe("Monday, 2 November");
    expect(en.longWeekday(d("1969-12-31"))).toBe("Wednesday, 31 December");
    expect(tr.longWeekday(d("2026-11-16"))).toBe("Pazartesi, 16 Kasım");
    expect(tr.longWeekday(d("2026-11-22"))).toBe("Pazar, 22 Kasım");
    expect(tr.longWeekday(d("1970-01-01"))).toBe("Perşembe, 1 Ocak");
    expect(en.longDate(d("2026-03-05"))).toBe("5 Mar 2026");
    expect(tr.longDate(d("2026-10-18"))).toBe("18 Ekim 2026");
    expect(en.monthTitle(d("2026-10-29"))).toBe("October 2026");
    expect(tr.monthTitle(d("2026-11-01"))).toBe("Kasım 2026");
  });

  it("describes intervals in words", () => {
    expect([1, 7, 14, 10].map(en.interval)).toEqual(["every day", "every week", "every 2 weeks", "every 10 days"]);
    expect([1, 7, 14, 10].map(tr.interval)).toEqual(["her gün", "her hafta", "2 haftada bir", "10 günde bir"]);
    expect(en.planStep(250, 7)).toBe("0.25 mg every week");
    expect(tr.planStep(500, 14)).toBe("0,5 mg, 2 haftada bir");
  });
});

describe("text", () => {
  it("joins lists with the language's 'and'", () => {
    expect(en.list([])).toBe("");
    expect(en.list(["a"])).toBe("a");
    expect(en.list(["a", "b", "c"])).toBe("a, b and c");
    expect(tr.list(["a", "b", "c"])).toBe("a, b ve c");
  });

  it("upper-cases with Turkish rules for Turkish, whatever the phone's locale", () => {
    expect(tr.upper("Başlangıçtan beri")).toBe("BAŞLANGIÇTAN BERİ");
    expect(tr.upper("Haziran 2026")).toBe("HAZİRAN 2026");
    expect(tr.upper("Mayıs")).toBe("MAYIS");
    expect(en.upper("Side effects")).toBe("SIDE EFFECTS");
  });
});

describe("forecast", () => {
  it("covers every forecast kind without inventing dates", () => {
    expect(en.forecast({ kind: "insufficient-data", points: 9, needed: 10 }, "kg", today)).toBe(
      "Log 1 more day to see where your trend is heading.",
    );
    expect(en.forecast({ kind: "insufficient-data", points: 7, needed: 10 }, "kg", today)).toBe(
      "Log 3 more days to see where your trend is heading.",
    );
    expect(en.forecast({ kind: "steady", rateGPerDay: 2 }, "kg", today)).toBe("Your trend is holding steady.");
    expect(en.forecast({ kind: "reached", rateGPerDay: -50 }, "kg", today)).toBe("Your trend is at your goal.");
    expect(en.forecast({ kind: "away-from-goal", rateGPerDay: 50 }, "kg", today)).toContain("moving away");
    expect(en.forecast({ kind: "beyond-horizon", rateGPerDay: -11 }, "kg", today)).toContain("two years");
    expect(en.forecast({ kind: "no-goal", rateGPerDay: -100 }, "kg", today)).toBe(
      "Trend: −0.7 kg per week. Set a goal to see a projected date.",
    );
    expect(en.forecast({ kind: "on-track", rateGPerDay: -100, goalDate: d("2027-01-07") }, "kg", today)).toBe(
      "At −0.7 kg per week, your trend would reach your goal around 7 Jan 2027.",
    );
  });

  it("speaks Turkish with a decimal comma", () => {
    expect(tr.forecast({ kind: "insufficient-data", points: 7, needed: 10 }, "kg", today)).toBe(
      "Trendinin nereye gittiğini görmek için 3 gün daha tartım kaydet.",
    );
    expect(tr.forecast({ kind: "no-goal", rateGPerDay: -100 }, "kg", today)).toBe(
      "Trend: haftada −0,7 kg. Tahmini bir tarih görmek için bir hedef belirle.",
    );
    expect(tr.forecast({ kind: "on-track", rateGPerDay: -100, goalDate: d("2027-01-07") }, "kg", today)).toBe(
      "Bu hızla (haftada −0,7 kg) trendin hedefine 7 Oca 2027 civarında ulaşır.",
    );
    expect(tr.forecast({ kind: "reached", rateGPerDay: 0 }, "kg", today)).toBe("Trendin hedefinde.");
  });
});

describe("due", () => {
  it("follows the user's own schedule", () => {
    expect(en.due(undefined, undefined, today)).toBe("Log your first injection to start tracking.");
    expect(en.due(0, today, today)).toBe("Next injection: today");
    expect(en.due(1, d("2026-10-20"), today)).toBe("Next injection: tomorrow");
    expect(en.due(4, d("2026-10-23"), today)).toBe("Next injection: 23 Oct (in 4 days)");
    expect(en.due(-1, d("2026-10-18"), today)).toBe("Next injection was due 18 Oct (1 day ago)");
    expect(en.due(-3, d("2026-10-16"), today)).toBe("Next injection was due 16 Oct (3 days ago)");
    expect(tr.due(0, today, today)).toBe("Sıradaki enjeksiyon: bugün");
    expect(tr.due(1, d("2026-10-20"), today)).toBe("Sıradaki enjeksiyon: yarın");
    expect(tr.due(4, d("2026-10-23"), today)).toBe("Sıradaki enjeksiyon: 23 Eki (4 gün sonra)");
    expect(tr.due(-3, d("2026-10-16"), today)).toBe("Enjeksiyon günü geçti: 16 Eki (3 gün önce)");
  });
});

describe("restore summary", () => {
  it("summarizes a restore in a sentence", () => {
    expect(en.restoreSummary({ weights: 12, injections: 1, sideEffects: 2 })).toBe(
      "Added 12 weigh-ins, 1 injection and 2 side effects.",
    );
    expect(en.restoreSummary({ weights: 1 })).toBe("Added 1 weigh-in.");
    expect(en.restoreSummary({ weights: 0, injections: 0 })).toBe("Nothing new: everything was already on this phone.");
    expect(tr.restoreSummary({ weights: 12, injections: 1, sideEffects: 2 })).toBe("12 tartım, 1 enjeksiyon ve 2 yan etki eklendi.");
    expect(tr.restoreSummary({})).toBe("Yeni bir şey yok: hepsi zaten bu telefondaydı.");
  });

  it("counts the daily log too", () => {
    const counts = { foodEntries: 30, customFoods: 1, waterEntries: 14, measurements: 6, exercises: 2 };
    expect(en.restoreSummary(counts)).toBe(
      "Added 30 food entries, 1 custom food, 14 water entries, 6 measurements and 2 exercises.",
    );
    expect(tr.restoreSummary(counts)).toBe("30 yiyecek kaydı, 1 özel yiyecek, 14 su kaydı, 6 ölçüm ve 2 egzersiz eklendi.");
    expect(en.restoreSummary({ planSteps: 1, medications: 2, measurements: 1 })).toBe(
      "Added 1 plan step, 2 medications and 1 measurement.",
    );
  });
});

describe("backupProblem", () => {
  const damagedEn = "The backup is damaged or was edited, so nothing was restored.";
  const damagedTr = "Yedek bozuk ya da düzenlenmiş, bu yüzden hiçbir şey geri yüklenmedi.";
  const invalid = (path: PropertyKey[], detail = "Too small") => ({ ok: false as const, reason: "invalid" as const, detail, path });

  it("explains refused backups", () => {
    expect(en.backupProblem({ ok: false, reason: "not-json" })).toContain("not a Tenulo backup");
    expect(en.backupProblem({ ok: false, reason: "newer-version" })).toContain("newer version");
    expect(en.backupProblem({ ok: false, reason: "too-large" })).toContain("too large to be a Tenulo backup");
    expect(tr.backupProblem({ ok: false, reason: "not-a-backup" })).toBe("Bu dosya bir Tenulo yedeği değil.");
    expect(tr.backupProblem({ ok: false, reason: "newer-version" })).toContain("daha yeni bir sürümüyle");
  });

  it("points at the record a person could find, counted from 1", () => {
    expect(en.backupProblem(invalid(["data", "weights", 3, "weightG"]))).toBe(`${damagedEn} The problem is in weigh-in 4.`);
    expect(en.backupProblem(invalid(["data", "sideEffects", 0, "severity"]))).toBe(`${damagedEn} The problem is in side effect 1.`);
    expect(en.backupProblem(invalid(["data", "settings", "goalWeightG"]))).toBe(`${damagedEn} The problem is in the settings.`);
    expect(en.backupProblem(invalid(["data", "foodEntries", 9, "meal"]))).toBe(`${damagedEn} The problem is in food entry 10.`);
    expect(en.backupProblem(invalid(["data", "waterEntries"]))).toBe(`${damagedEn} The problem is in the water entries.`);
    expect(tr.backupProblem(invalid(["data", "weights", 3, "weightG"]))).toBe(`${damagedTr} Sorun 4. tartımda.`);
    expect(tr.backupProblem(invalid(["data", "injections", 0]))).toBe(`${damagedTr} Sorun 1. enjeksiyonda.`);
    expect(tr.backupProblem(invalid(["data", "measurements", 1, "site"]))).toBe(`${damagedTr} Sorun 2. ölçümde.`);
    expect(tr.backupProblem(invalid(["data", "exercises"]))).toBe(`${damagedTr} Sorun egzersizlerde.`);
    expect(tr.backupProblem(invalid(["data", "settings", "language"]))).toBe(`${damagedTr} Sorun ayarlarda.`);
  });

  it("explains whole-backup checks, and leaves out what it cannot translate", () => {
    const detail = "Injection for a medication not in the backup";
    expect(en.backupProblem(invalid([], detail))).toBe(`${damagedEn} Injection for a medication not in the backup.`);
    expect(tr.backupProblem(invalid([], detail))).toBe(`${damagedTr} Bir enjeksiyon, yedekte olmayan bir ilaca ait.`);
    expect(tr.backupProblem(invalid([], "Something new"))).toBe(damagedTr);
    expect(en.backupProblem(invalid(["exportedAt"], "Invalid input"))).toBe(damagedEn);
  });
});

describe("Health Connect", () => {
  it("describes the last read", () => {
    const now = new Date(2026, 9, 29, 12, 0);
    expect(en.synced(false, null, now)).toBe("Off");
    expect(en.synced(true, null, now)).toBe("Not read yet");
    expect(en.synced(true, new Date(2026, 9, 29, 8, 5).getTime(), now)).toBe("Last read today at 08:05");
    expect(en.synced(true, new Date(2026, 9, 20, 21, 30).getTime(), now)).toBe("Last read 20 Oct at 21:30");
    expect(tr.synced(false, null, now)).toBe("Kapalı");
    expect(tr.synced(true, new Date(2026, 9, 29, 8, 5).getTime(), now)).toBe("Son okuma: bugün, 08:05");
    expect(tr.synced(true, new Date(2026, 9, 28, 23, 0).getTime(), now)).toBe("Son okuma: dün, 23:00");
  });

  it("says what a read added and whether more is coming", () => {
    expect(en.healthSync({ added: 0, complete: true })).toBe("No new readings.");
    expect(en.healthSync({ added: 3, complete: false })).toBe(
      "Added 3 weigh-ins. There is more to read; Tenulo continues next time it opens.",
    );
    expect(tr.healthSync({ added: 3, complete: true })).toBe("3 tartım eklendi.");
    expect(tr.healthSync({ added: 0, complete: false })).toBe(
      "Yeni ölçüm yok. Okunacak başka kayıt var; Tenulo bir sonraki açılışta devam eder.",
    );
  });
});
