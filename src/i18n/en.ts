/**
 * English. This file defines the shape every language must have (`Messages`): tr.ts is typed
 * against it, so a missing or extra Turkish string is a compile error.
 *
 * Strings are final text. Functions take counts as numbers and anything with a decimal or a date
 * as text already formatted for the language (see format.ts), so a message never formats a number.
 */
import type { InjectionSite } from "../domain/injection";
import type { ReportPeriod } from "../domain/report";
import type { Severity, SideEffectType } from "../domain/side-effect";
import type { WeightUnit } from "../domain/weight";
import type { ProCheck } from "../platform/billing";
import type { ReminderTexts } from "../platform/reminders";
import type { TimelineFilter } from "../ui/timeline";
import { foodEn } from "./messages/food";
import type { BackupRecord, RestoreCountKey } from "./records";
import { todayEn } from "./messages/today"
import { progressEn } from "./messages/progress";

type Twelve = readonly [string, string, string, string, string, string, string, string, string, string, string, string];
type Seven = readonly [string, string, string, string, string, string, string];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const BACKUP_RECORD_NAMES: Record<BackupRecord, readonly [one: string, many: string]> = {
  weights: ["weigh-in", "weigh-ins"],
  medications: ["medication", "medications"],
  planSteps: ["plan step", "plan steps"],
  injections: ["injection", "injections"],
  sideEffects: ["side effect", "side effects"],
  customFoods: ["custom food", "custom foods"],
  foodEntries: ["food entry", "food entries"],
  waterEntries: ["water entry", "water entries"],
  measurements: ["measurement", "measurements"],
  exercises: ["exercise", "exercises"],
};

const countOf =
  (key: RestoreCountKey) =>
  (n: number): string => {
    const [one, many] = BACKUP_RECORD_NAMES[key];
    return plural(n, one, many);
  };

export const en = {
  calendar: {
    monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] satisfies Twelve,
    monthsLong: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ] satisfies Twelve,
    /** Monday first. */
    weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] satisfies Seven,
    /** "18 Oct", "18 Oct 2027". */
    shortDate: (day: number, month: string, year: string | undefined) => (year === undefined ? `${day} ${month}` : `${day} ${month} ${year}`),
    /** "29 Oct 2026": English keeps the short month in documents, as before. */
    longDate: (day: number, monthShort: string, _monthLong: string, year: string) => `${day} ${monthShort} ${year}`,
    /** "Thursday, 29 October". */
    weekdayDate: (weekday: string, day: number, monthLong: string) => `${weekday}, ${day} ${monthLong}`,
    /** "October 2026". */
    monthTitle: (monthLong: string, year: string) => `${monthLong} ${year}`,
  },
  number: { decimalMark: ".", groupMark: "," },
  days: {
    today: "Today",
    yesterday: "Yesterday",
    todayInline: "today",
    yesterdayInline: "yesterday",
    daysAgo: (n: number) => `${n} days ago`,
  },
  interval: {
    daily: "every day",
    weekly: "every week",
    everyWeeks: (n: number) => `every ${n} weeks`,
    everyDays: (n: number) => `every ${n} days`,
  },
  list: { and: "and" },
  ...foodEn,

  common: {
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    delete: "Delete",
    ok: "OK",
    day: "Day",
    noteOptional: "Note (optional)",
    couldNotSave: "Could not save",
    didNotWork: "That did not work",
    somethingWentWrong: "Something went wrong",
    tryAgain: "Please try again.",
    unknownError: "Unknown error",
    seePro: "See Pro",
    addMedicationFirst: "Add your medication first.",
    medicationName: "Medication name",
    noValue: "–",
  },
  root: {
    couldNotOpen: "Tenulo could not open its data",
    crashed: "Something went wrong in Tenulo",
    tryAgain: "Try again",
  },
  tabs: { today: "Today", history: "History", settings: "Settings" },
  screens: {
    addWeight: "Log weight",
    setupMedication: "Your medication",
    logInjection: "Log injection",
    logSideEffect: "Log side effect",
    report: "Doctor report",
    pro: "Tenulo Pro",
    medication: "Medication & plan",
    privacy: "Privacy",
  },

  today: {
    title: "Today",
    yourTrend: "Your trend",
    weighed: (when: string) => `Weighed ${when}`,
    sevenDays: "7 days",
    sinceStart: "Since start",
    lastReading: "Last reading",
    atGoal: "At your goal",
    toGoal: (amount: string, goal: string) => `${amount} to your goal of ${goal}`,
    logAnother: "Log another weigh-in",
    logToday: "Log today's weight",
    emptyTitle: "Your trend starts with one weigh-in",
    emptyBody:
      "Daily weight jumps around with water and salt. Tenulo smooths it into a trend line, so you can see the direction you are really heading.",
    logWeight: "Log your weight",
    footnote: "Tenulo is a personal log. It does not give medical advice. Everything stays on this phone.",
  },
  trendChart: {
    title: "Trend",
    label: "Weight trend chart",
    labelLatest: (latest: string) => `Weight trend chart, latest trend ${latest}`,
    goal: "Goal",
    rangeLabel: "Chart range",
    ranges: { 30: "30D", 90: "90D", 365: "1Y", all: "All" },
    legendTrend: "Trend",
    legendDaily: "Daily weigh-in",
    legendGoal: "Goal",
  },
  injectionCard: {
    title: "Injections",
    emptyBody: "Your shots, your own dose schedule and where you injected, next to your weight trend.",
    addMedication: "Add your medication",
    plan: (step: string) => `Your plan: ${step}`,
    last: (when: string) => `Last: ${when}`,
    ringOf: (days: number) => `of ${days}`,
    logInjection: "Injection",
    logSideEffect: "Side effect",
  },
  due: {
    first: "Log your first injection to start tracking.",
    today: "Next injection: today",
    tomorrow: "Next injection: tomorrow",
    inDays: (date: string, days: number) => `Next injection: ${date} (in ${days} days)`,
    overdue: (date: string, days: number) => `Next injection was due ${date} (${plural(days, "day", "days")} ago)`,
  },
  forecast: {
    perWeek: (change: string) => `${change} per week`,
    insufficient: (days: number) => `Log ${plural(days, "more day", "more days")} to see where your trend is heading.`,
    noGoal: (rate: string) => `Trend: ${rate}. Set a goal to see a projected date.`,
    reached: "Your trend is at your goal.",
    steady: "Your trend is holding steady.",
    away: (rate: string) => `Trend: ${rate}, moving away from your goal.`,
    beyond: (rate: string) => `Trend: ${rate}. At this pace your goal is more than two years away.`,
    onTrack: (rate: string, date: string) => `At ${rate}, your trend would reach your goal around ${date}.`,
  },
  history: {
    title: "History",
    filters: {
      all: "All",
      weight: "Weight",
      injection: "Injections",
      "side-effect": "Side effects",
      food: "Food",
      water: "Water",
      measurement: "Measurements",
      exercise: "Exercise",
    } satisfies Record<TimelineFilter, string>,
    fromHealthConnect: "From Health Connect",
    weighIn: "Weigh-in",
    injection: (dose: string) => `Injection · ${dose}`,
    siteNotRecorded: "Site not recorded",
    deleteTitle: "Delete this entry?",
    emptyTitle: "Your log starts here",
    emptyBody: "Weigh-ins, injections, side effects, meals, water, measurements and exercise appear here as one timeline, newest first.",
    emptyFiltered: "Nothing of this kind yet.",
    longPressHint: "Tap a meal or a day's water to open that day. Long press an entry to delete it.",
    deleteHint: "Long press to delete",
  },
  addWeight: {
    weight: "Weight",
    weightIn: (unit: string) => `Weight in ${unit}`,
    notANumber: (example: string) => `Enter a number like ${example}`,
    implausible: (unit: string) => `That doesn't look like a body weight in ${unit}`,
    hint: "Weigh at the same time each day, ideally after waking. One reading a day is plenty.",
  },
  logInjection: {
    dose: "Dose (mg)",
    doseLabel: "Dose in milligrams",
    prefilled: "Prefilled from your plan. Change it if you took a different dose.",
    site: "Site",
    notePlaceholder: "Anything you want to remember",
    save: "Save injection",
  },
  bodyMap: {
    prompt: "Tap where you injected",
    selected: "Selected",
    longestAgo: "Used longest ago",
    lastTime: "Last time",
    frontView: "Front view: your left side is on the right of the picture.",
    lastTimeTag: ", last time",
    longestAgoTag: ", used longest ago",
    /** The body's right and left, drawn at the picture's left and right. */
    right: "R",
    left: "L",
  },
  sites: {
    "abdomen-left": "Belly, left",
    "abdomen-right": "Belly, right",
    "thigh-left": "Thigh, left",
    "thigh-right": "Thigh, right",
    "arm-left": "Arm, left",
    "arm-right": "Arm, right",
  } satisfies Record<InjectionSite, string>,
  sideEffects: {
    nausea: "Nausea",
    vomiting: "Vomiting",
    constipation: "Constipation",
    diarrhea: "Diarrhea",
    heartburn: "Heartburn",
    fatigue: "Tiredness",
    headache: "Headache",
    "injection-site": "Injection site",
    other: "Other",
  } satisfies Record<SideEffectType, string>,
  severity: { 1: "Mild", 2: "Moderate", 3: "Strong" } satisfies Record<Severity, string>,
  logSideEffect: {
    what: "What did you notice?",
    howStrong: "How strong, for you?",
    howStrongLabel: "How strong",
    notePlaceholder: "e.g. after a large meal",
    safety: "If a symptom is severe or worrying, contact your doctor or local emergency services. Tenulo only keeps a record.",
  },
  medication: {
    addMedication: "Add medication",
    yourPlan: "Your plan",
    planIntro: "The doses your prescriber set and when each starts. Tenulo shows this back to you; it never changes it on its own.",
    step: (dose: string, interval: string) => `${dose} ${interval}`,
    removeTitle: "Remove this step?",
    removeBody: (dose: string, date: string) => `${dose} from ${date}`,
    remove: "Remove",
    removeHint: "Long press to remove this step",
    removeAction: "Remove step",
    current: (period: number, date: string) => `Now · period ${period} · from ${date}`,
    planned: (date: string) => `Planned · from ${date}`,
    started: (date: string) => `from ${date}`,
    addChange: "Add a dose change",
    addChangeIntro: "Only as your prescriber told you. It starts on the day you pick.",
    newDosePlaceholder: "New dose in mg",
    newDoseLabel: "New dose in milligrams",
    addToPlan: "Add to plan",
    couldNotAdd: "Could not add the step",
    saveName: "Save name",
    couldNotRename: "Could not rename",
  },
  setupMedication: {
    intro:
      "Enter your medication the way your prescription describes it. Tenulo only records what you enter; it never suggests doses.",
    namePlaceholder: "As written on your pen or prescription",
    currentDose: "Current dose (mg)",
    currentDoseLabel: "Current dose in milligrams",
    dosePlaceholder: (example: string) => `e.g. ${example}`,
    doseNotANumber: (small: string, large: string) => `Enter the dose in mg, like ${small} or ${large}`,
    doseOutOfRange: "That dose is outside what Tenulo can record",
    howOften: "How often",
    intervals: { 7: "Weekly", 14: "Every 2 weeks", 1: "Daily" },
    since: "On this dose since",
  },
  privacy: {
    intro: "Tenulo is a private log for your weight and your GLP-1 medication. Here is what that means in practice.",
    points: {
      device: {
        title: "On this phone only",
        body: "Your weigh-ins, injections, side effects and notes are stored in Tenulo's own database on this phone. There is no account and no Tenulo server.",
      },
      healthConnect: {
        title: "Health Connect: read-only, weight only",
        body: "With your permission, Tenulo reads weight records to show smart-scale readings in your log. It never writes to Health Connect, and the data is used only for your weight history and trend inside the app.",
      },
      reminders: {
        title: "Reminders are local",
        body: "Injection and weigh-in reminders are scheduled by Android on this phone. No reminder passes through a server.",
      },
      exports: {
        title: "You decide what leaves",
        body: "A PDF report or a backup file is created on this phone and goes only where you send it. Android cloud backup is turned off for Tenulo.",
      },
      tracking: {
        title: "No tracking",
        body: "No analytics, ads or crash reporting. Google Play Billing confirms a Pro purchase; Tenulo never sees your name or payment details.",
      },
      deletion: {
        title: "Delete any time",
        body: "Delete single entries from History, or everything from Settings. Uninstalling Tenulo removes all of its data.",
      },
    },
    readPolicy: "Read the full privacy policy",
    footer: (publisher: string, email: string) =>
      `Tenulo is made by ${publisher}. Questions: ${email}. Tenulo is meant for adults 18 and over. It is a personal log, not medical advice, and it does not recommend medications or doses.`,
  },
  pro: {
    tagline: "One purchase. Yours on every phone signed in to your Google account.",
    features: {
      report: {
        title: "Doctor report",
        body: "Your trend, injections, plan and side effects for any period, as a clean PDF you can print or send.",
      },
      healthConnect: {
        title: "Health Connect",
        body: "Readings from your smart scale appear in your log automatically. Read-only; nothing is written back.",
      },
      private: {
        title: "Still private",
        body: "No account, no subscription, no tracking. Google Play confirms the purchase; Tenulo never learns who you are.",
      },
    },
    restoreResult: {
      owned: { title: "Tenulo Pro restored", body: "Your purchase is confirmed by Google Play. Thank you." },
      pending: { title: "Purchase pending", body: "Pro unlocks as soon as Google Play confirms your payment." },
      "not-owned": {
        title: "No purchase found",
        body: "Google Play has no Tenulo Pro purchase for the Google account on this phone. If you bought it with another account, switch to it in the Play Store and try again.",
      },
      failed: { title: "Could not reach Google Play", body: "Check your connection and try again." },
      unavailable: {
        title: "Purchases are not available here",
        body: "Purchases work in the version of Tenulo installed from Google Play.",
      },
    } satisfies Record<ProCheck, { title: string; body: string }>,
    pendingTitle: "Purchase pending",
    pendingBody: "Pro unlocks as soon as Google Play confirms your payment.",
    failedTitle: "Purchase did not go through",
    /**
     * Why a purchase failed, from the billing module's error code. English shows Play's own
     * message, as it always has; other languages explain the codes they know.
     */
    failedBody: (_code: string | undefined, message: string | undefined): string => message ?? "Please try again later.",
    unlocked: "Pro is unlocked. Thank you for supporting Tenulo.",
    opening: "Opening Google Play…",
    unlockFor: (price: string) => `Unlock Pro · ${price}`,
    unlock: "Unlock Pro",
    restore: "Restore purchase",
    pendingNote: "Your purchase is pending with Google Play.",
    unavailableNote: "Purchases are available in the version of Tenulo installed from Google Play.",
    paidOnce: "Paid once through Google Play. Refunds follow Google Play policy.",
  },
  report: {
    periods: { 30: "30 days", 90: "90 days", 180: "6 months", all: "All" } satisfies Record<ReportPeriod, string>,
    proOnly: "The doctor report is part of Tenulo Pro.",
    intro: "A summary of what you logged, for your doctor or pharmacist. It is created on this phone; you choose where to send it.",
    periodLabel: "Report period",
    couldNotRead: "Could not read your log",
    preview: "Preview",
    trend: "Trend",
    change: "Change",
    weighInDays: "Weigh-in days",
    injections: "Injections",
    sideEffects: "Side effects",
    medication: "Medication",
    noWeighIns: "No weigh-ins",
    notSetUp: "Not set up",
    creating: "Creating PDF…",
    create: "Create PDF and share",
    couldNotCreate: "Could not create the PDF",
    footnote: "The report shows your entries as you made them. It contains no advice and no assessment.",
    shareTitle: "Share your Tenulo report",
  },
  /** The PDF a user hands to their doctor: written about "the patient", for the doctor. */
  reportPdf: {
    documentTitle: (from: string, to: string) => `Tenulo report ${from} – ${to}`,
    heading: "Personal log report",
    days: (n: number) => plural(n, "day", "days"),
    trendStart: "Trend at start",
    trendEnd: "Trend at end",
    change: "Change",
    injections: "Injections",
    sideEffects: "Side effects",
    weight: "Weight",
    noWeighIns: "No weigh-ins in this period.",
    weighInDays: "Weigh-in days",
    trendRate: "Trend rate",
    lowestDay: "Lowest day",
    highestDay: "Highest day",
    firstWeighIn: "First weigh-in",
    lastWeighIn: "Last weigh-in",
    trendNote: "The trend is a moving average of daily weigh-ins; it smooths day-to-day water weight.",
    chartLabel: "Weight trend",
    legendTrend: (unit: string) => `Trend (${unit})`,
    legendDaily: "Daily weigh-in",
    medication: "Medication",
    plan: "Plan entered by the patient",
    from: "From",
    dose: "Dose",
    schedule: "Schedule",
    injectionsLogged: "Injections logged",
    noInjections: "No injections in this period.",
    date: "Date",
    site: "Site",
    notRecorded: "Not recorded",
    gaps: (range: string, mean: string) => `Days between injections: ${range} (average ${mean}).`,
    sites: (list: string) => `Sites: ${list}.`,
    noSideEffects: "No side effects logged in this period.",
    type: "Type",
    times: "Times",
    strongest: "Strongest rating",
    allEntries: "All entries",
    rating: "Rating",
    note: "Note",
    ratingsNote: "Ratings are the patient's own: mild, moderate or strong.",
    footer: (created: string, publisher: string) =>
      `Recorded by the patient in Tenulo, a personal log. Values are shown exactly as the patient entered them. Tenulo does not give medical advice and does not recommend medications or doses. Created ${created}. Tenulo by ${publisher}.`,
  },
  settings: {
    title: "Settings",
    language: {
      title: "Language / Dil",
      system: "Phone language",
      footer: "Phone language follows your phone: Turkish when it is set to Turkish, English otherwise.",
    },
    weight: "Weight",
    weightUnit: "Weight unit",
    units: { kg: "Kilograms", lb: "Pounds" } satisfies Record<WeightUnit, string>,
    goal: {
      title: "Goal weight",
      placeholder: "Optional",
      label: (unit: string) => `Goal weight in ${unit}`,
      invalid: "Enter a body weight like 75 or 75.5",
      note: "Used only to project a date from your trend. Leave empty to remove it.",
      couldNotSave: "Could not save the goal",
    },
    reminders: {
      title: "Reminders",
      footer: "Shown by this phone at the time you choose. The injection reminder follows your own schedule.",
      footerUnavailable: "Reminders need the installed app; they are not available in this build.",
      injection: "Injection day",
      injectionDetail: "On the day your schedule has your next shot",
      addMedicationFirst: "Add your medication first",
      injectionTime: "Injection reminder time",
      weighIn: "Daily weigh-in",
      weighInDetail: "Same time every day",
      weighInTime: "Weigh-in reminder time",
      notificationsOffTitle: "Notifications are off",
      notificationsOffBody: "Allow notifications for Tenulo in Android settings to get reminders.",
      notNow: "Not now",
      openSettings: "Open settings",
    },
    healthConnect: {
      title: "Health Connect",
      footer: "Read-only: Tenulo reads Weight and never writes to Health Connect. Manual entry keeps working either way.",
      read: "Read weight from Health Connect",
      unavailable: "Health Connect is not available on this phone",
      needsUpdate: "Update Health Connect from the Play Store first",
      proDetail: "Smart-scale readings in your log · Pro",
      noAccessYetTitle: "No access yet",
      noAccessYetBody: "Allow Tenulo to read Weight in Health Connect, then turn this on again.",
      syncNow: "Sync now",
      noAccessTitle: "No access",
      noAccessBody: "Tenulo can no longer read Weight in Health Connect.",
      manageAccess: "Manage access",
    },
    data: {
      title: "Your data",
      footer: "Files are created on this phone and go only where you send them.",
      report: "Doctor report (PDF)",
      reportDetail: "Trend, injections and side effects for a period",
      backup: "Back up to a file",
      backupDetail: "Everything, as one file you keep",
      backupShareTitle: "Save your Tenulo backup",
      restore: "Restore from a file",
      restoreDetail: "Adds what is missing; changes nothing else",
      deleteAll: "Delete all data",
      cannotRestore: "Cannot restore this file",
      restoreTitle: "Restore this backup?",
      restoreBody: "Records in the backup that are not on this phone will be added. Nothing on this phone is changed or removed.",
      restoreAction: "Restore",
      restoredTitle: "Backup restored",
      inactiveMedications: (n: number) =>
        n === 1
          ? "One medication from the backup was added as inactive: Tenulo keeps one current medication. Their injections are in History."
          : `${n} medications from the backup were added as inactive: Tenulo keeps one current medication. Their injections are in History.`,
      restoreFailedTitle: "Restore failed",
      restoreFailedBody: (detail: string) => `Nothing was changed. ${detail}`,
      deleteAllTitle: "Delete all data?",
      deleteAllBody: "Every weigh-in, injection, note, reminder and setting on this phone will be erased. This cannot be undone.",
      deleteEverything: "Delete everything",
      sureTitle: "Are you sure?",
      sureBody: "There is no copy anywhere else unless you made a backup.",
      keep: "Keep my data",
      erase: "Erase",
      deletedTitle: "All data deleted",
      deletedBody: "Tenulo is empty again. Reminders were cancelled too.",
      deletedPendingBody:
        "Tenulo is empty again. Reminders were cancelled too. Old copies in its database file are cleared the next time Tenulo starts.",
    },
    medication: {
      title: "Medication",
      add: "Add your medication",
      detail: "Your plan, dose changes and name",
      addDetail: "To track injections and your schedule",
    },
    about: {
      title: "About",
      privacy: "Privacy",
      privacyDetail: "No account, no servers, no tracking",
      proDetail: "Unlocked. Thank you for supporting Tenulo.",
      devUnlock: "Unlock Pro (development build)",
      devUnlockDetail: "Not in release builds",
      devSample: "Load sample data (development build)",
      devSampleDetail: "Nine weeks of made-up entries, for trying the app",
      version: "Version",
    },
    proBanner: {
      pending: "Your purchase is pending with Google Play. Pro unlocks as soon as it is confirmed.",
      pitch: "A PDF report for your doctor and Health Connect sync. One purchase, no subscription.",
    },
    disclaimer:
      "Tenulo is a personal log. It does not give medical advice and does not recommend medications or doses. Always follow your doctor or pharmacist.",
  },
  health: {
    off: "Off",
    notReadYet: "Not read yet",
    lastRead: (when: string, time: string) => `Last read ${when} at ${time}`,
    noNewReadings: "No new readings.",
    moreToRead: "There is more to read; Tenulo continues next time it opens.",
  },
  welcome: {
    pages: {
      trend: {
        title: "Your trend, not the noise",
        body: "Daily weight jumps around with water and salt. Tenulo draws the calm line underneath, so you can see where you are really heading.",
      },
      plan: {
        title: "Your plan, shown back to you",
        body: "Enter the dose schedule from your prescription. Tenulo shows which week you are in and when the next injection is due. It never suggests a medication or a dose.",
      },
      private: {
        title: "It stays on this phone",
        body: "No account, no analytics, no ads. Your records leave this phone only when you export them yourself.",
      },
    },
    skip: "Skip",
    next: "Next",
    start: "Start my log",
    unit: "I weigh myself in",
    footer: "A personal log for adults. Not medical advice.",
  },
  dayPicker: { previous: "Previous day", next: "Next day" },
  /** Notification texts, handed to the reminder module when it schedules (see platform/reminders). */
  reminders: {
    injectionTitle: "Injection day",
    injectionBody: "Your schedule has an injection due. Log it in Tenulo once it is done.",
    weighInTitle: "Time to weigh in",
    weighInBody: "Step on the scale and log it. Your trend smooths out the daily ups and downs.",
    channelName: "Reminders",
    channelDescription: "Injection and weigh-in reminders you set in Tenulo",
    /** All a locked screen shows: what a reminder is about is health data. */
    lockedTitle: "Tenulo reminder",
  } satisfies ReminderTexts,
  backup: {
    notABackup: "This file is not a Tenulo backup.",
    newerVersion: "This backup was made by a newer version of Tenulo. Update Tenulo, then try again.",
    tooLarge: "This file is too large to be a Tenulo backup. Nothing was read from it.",
    damaged: "The backup is damaged or was edited, so nothing was restored.",
    problemInSettings: "The problem is in the settings.",
    /** `n` counts from 1, as a person would; undefined when the whole table is at fault. */
    problemAt: (record: BackupRecord, n: number | undefined) => {
      const [one, many] = BACKUP_RECORD_NAMES[record];
      return `The problem is in ${n === undefined ? `the ${many}` : `${one} ${n}`}.`;
    },
    /** A whole-backup check (src/domain/backup.ts), or undefined to leave it out. */
    wholeCheck: (detail: string): string | undefined => `${detail}.`,
  },
  restore: {
    added: (list: string) => `Added ${list}.`,
    nothingNew: "Nothing new: everything was already on this phone.",
    counts: {
      weights: countOf("weights"),
      injections: countOf("injections"),
      sideEffects: countOf("sideEffects"),
      planSteps: countOf("planSteps"),
      medications: countOf("medications"),
      foodEntries: countOf("foodEntries"),
      customFoods: countOf("customFoods"),
      waterEntries: countOf("waterEntries"),
      measurements: countOf("measurements"),
      exercises: countOf("exercises"),
    } satisfies Record<RestoreCountKey, (n: number) => string>,
  },
  ...todayEn,
  ...progressEn,
};

export type Messages = typeof en;
