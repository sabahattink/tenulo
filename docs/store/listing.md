# Play Store listing

No drug brand names anywhere in the listing, screenshots or graphics (AGENTS.md), and no food
brand names either. Two store languages: **Turkish (tr-TR), the default**, and English (en-US).
Play Console → Grow → Store presence → Main store listing → Manage translations.

## Developer name

Kalkan Software (set on the Play Console developer account, not per app; the app shows the same
name in Settings, on the Privacy screen and under the doctor report: `PUBLISHER` in `src/ui/copy.ts`).

## Türkçe (tr-TR, default)

### App name (30)

Tenulo: GLP-1, Kilo, Beslenme

### Short description (80)

GLP-1 iğnen, kilon, öğünlerin ve suyun tek yerde. Hesap yok, veri telefonda.

### Full description

Tenulo, haftalık GLP-1 ilacı kullananlar için sakin ve gizli bir günlük. İğneni bir uygulamaya,
yediklerini başka birine, suyunu ve ölçülerini bir başkasına yazmana gerek yok: hepsi burada.

YEDİKLERİN, KOLAYCA
Öğünü seç, yiyeceği ara ("yumurta", "mercimek çorbası", "simit"), porsiyonu ve adedi seç; kalori
ve protein güne eklensin. Türk mutfağının günlük yemekleri listede. Sık yediklerin en üstte
çıkar, tek dokunuşla tekrar eklersin. Listede olmayanı kendi yiyeceğin olarak kaydet.

SU VE GÜNLÜK HEDEFLER
Bir dokunuş bir bardak. Kalori, protein ve su için hedefini sen koyarsın; Tenulo hedef önermez,
yalnızca senin hedefini gösterir.

KİLO: GÜRÜLTÜ DEĞİL, TREND
Günlük kilo su ve tuzla oynar. Tenulo tartımlarını bir trend çizgisine dönüştürür; verin
yeterli olduğunda hedefine ne zaman varacağını tahmin eder, yetmediğinde uydurmaz.

ÖLÇÜLER VE EGZERSİZ
Bel, kalça, göğüs, boyun, kol ve bacak ölçülerini kaydet, değişimi gör. Yürüyüş, koşu, ağırlık
antrenmanı, yoga… süresiyle ve yoğunluğuyla not et.

İĞNELERİN, SENİN PLANIN
Her iğneyi dozu ve vücut haritasındaki bölgesiyle kaydet. Tenulo reçetendeki doz planını sana
geri gösterir: kaçıncı haftadasın, sıradaki iğne ne zaman, en uzun süredir hangi bölgeyi
kullanmadın. Asla ilaç, doz ya da değişiklik önermez.

YAN ETKİLER BAĞLAMIYLA
Bulantı, yorgunluk, enjeksiyon bölgesi tepkisi ve fazlasını kendi derecenle not et: hafif, orta
ya da güçlü.

HATIRLATICILAR
Planına göre iğne günü hatırlatıcısı ve isteğe bağlı günlük tartım hatırlatıcısı. İkisini de
telefonun kurar; hiçbir şey bir sunucudan geçmez.

VERİN SENİNDİR
- Hesap yok, kayıt yok.
- Analitik yok, reklam yok, takip yok.
- Kayıtların yalnızca bu telefonda. Android bulut yedeği kapalı.
- İstediğin zaman dosyaya yedekle, yeni telefonda geri yükle.
- Tek bir kaydı ya da her şeyi istediğin an sil.

TENULO PRO (tek seferlik satın alma)
- Doktor raporu: seçtiğin dönem için trendin, iğnelerin, planın, yan etkilerin, beslenme ve
  ölçü özetin; düzenli bir PDF olarak.
- Health Connect: akıllı tartından gelen kilo ölçümleri kendiliğinden görünür. Yalnızca okuma.

Tenulo yetişkinler için kişisel bir günlüktür. Tıbbi tavsiye değildir; doktorunun ya da
eczacının yerini tutmaz. Besin değerleri tahminidir.

## English (en-US)

### App name (30)

Tenulo: GLP-1, Weight & Food

### Short description (80)

GLP-1 shots, weight, meals and water in one private log. Stays on your phone.

### Full description

Tenulo is a calm, private log for people on a weekly GLP-1 medication. Your shots, what you eat,
your water and your measurements, in one place instead of four apps.

WHAT YOU EAT, WITHOUT THE FUSS
Pick the meal, search the food, choose the portion and how many; energy and protein are added
to your day. Everyday Turkish dishes and common international foods are in the list. Foods you
eat often come first and go back in with one tap. Anything missing becomes one of your own foods.

WATER AND DAILY GOALS
One tap, one glass. You set your own goals for energy, protein and water; Tenulo never suggests
one, it only shows yours back.

WEIGHT, WITHOUT THE NOISE
Daily weight jumps around with water and salt. Tenulo smooths your weigh-ins into a trend line,
and projects a date for your goal only when your data supports one.

MEASUREMENTS AND EXERCISE
Waist, hip, chest, neck, arm and thigh, with the change since you started. Walking, running,
strength training, yoga and more, with duration and intensity.

YOUR INJECTIONS, YOUR SCHEDULE
Log each shot with its dose and site on a body map. Tenulo shows the dose plan you entered from
your prescription back to you: which week you are in, when the next shot is due, and which site
you used longest ago. It never suggests a medication, a dose or a change.

SIDE EFFECTS IN CONTEXT
Note nausea, tiredness, injection-site reactions and more, rated in your own words: mild,
moderate or strong.

REMINDERS
An injection-day reminder that follows your schedule, and an optional daily weigh-in reminder.
Both are set by your phone; nothing goes through a server.

YOUR DATA STAYS YOURS
- No account and no sign-up.
- No analytics, no ads, no tracking.
- Your records live only on this phone. Android cloud backup is off.
- Back up to a file and restore it on a new phone, whenever you choose.
- Delete single entries, or everything, at any time.

TENULO PRO (one-time purchase)
- Doctor report: your trend, injections, plan, side effects, nutrition and measurements for a
  period, as a clean PDF.
- Health Connect: weight readings from your smart scale appear automatically. Read-only.

Tenulo is a personal log for adults. It is not medical advice and does not replace your doctor
or pharmacist. Nutrition values are estimates.

## Phone screenshots (upload in this order)

Made by `scripts/store_screens.py` from a release build holding the sample data, once per store
language (the app follows the phone's language), from raw captures in `screenshots/raw/<lang>/`
(`tr`, `en`); how, in `docs/release-checklist.md` step 5. The Turkish set is in kilograms and
centimetres, the English set in pounds and inches, as an en-US phone defaults to. Captions per
language:

| File | Turkish caption | English caption | Screen |
| --- | --- | --- | --- |
| `screenshots/<lang>/01-today.png` | Günün tek bakışta | Your day at a glance | Today |
| `screenshots/<lang>/02-food.png` | Ne yediğin, kolayca | What you eat, made easy | Food diary |
| `screenshots/<lang>/03-trend.png` | Gürültü değil, trend | Your trend, not the noise | Progress |
| `screenshots/<lang>/04-injection.png` | Senin planın, senin bölgen | Your plan, your sites | Log injection |
| `screenshots/<lang>/05-private.png` | Her şey bu telefonda | It stays on this phone | Welcome, last page |
