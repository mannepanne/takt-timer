// ABOUT: All UI strings for both supported languages (English and Swedish).
// ABOUT: Each key maps to { en, sv } inline — gaps are visible at a glance and TypeScript
// ABOUT: enforces key parity at compile time via the satisfies operator.

type Translation = { en: string; sv: string };

const strings = {
  // ── Navigation / shared ──────────────────────────────────────────────
  'nav.backToHome': { en: 'Back to Home', sv: 'Tillbaka till start' },

  // ── Home ─────────────────────────────────────────────────────────────
  'home.openPresets': { en: 'Open presets', sv: 'Öppna förinställningar' },
  'home.account': { en: 'Account', sv: 'Konto' },
  'home.signIn': { en: 'Sign in or create account', sv: 'Logga in eller skapa konto' },
  'home.ready': { en: 'Ready', sv: 'Redo' },
  'home.prompt': { en: 'What cadence do you need?', sv: 'Vad är takten idag?' },
  'home.example': {
    en: '"Three sets of one minute, thirty seconds rest"',
    sv: '"Tre set om en minut, tretti sekunders vila"',
  },
  'home.configure': { en: 'Configure a session', sv: 'Konfigurera ett pass' },
  'home.privacy': { en: 'Privacy', sv: 'Integritetspolicy' },
  'home.sessions.one': { en: '1 session so far', sv: '1 pass hittills' },
  'home.sessions.many': { en: '{count} sessions so far', sv: '{count} pass hittills' },

  // ── Configure ────────────────────────────────────────────────────────
  'configure.title': { en: 'Configure', sv: 'Konfigurera' },
  'configure.heading': { en: 'Build a session', sv: 'Bygg ett pass' },
  'configure.hint': { en: 'Tap any chip to edit it.', sv: 'Tryck på en bricka för att redigera.' },
  'configure.start': { en: 'Start', sv: 'Starta' },

  // ── Interpretation ───────────────────────────────────────────────────
  'interpretation.sets': { en: 'Sets', sv: 'Set' },
  'interpretation.work': { en: 'Work', sv: 'Arbete' },
  'interpretation.rest': { en: 'Rest', sv: 'Vila' },

  // ── Run ──────────────────────────────────────────────────────────────
  'run.stop': { en: 'Stop session', sv: 'Avbryt pass' },
  'run.mute': { en: 'Mute sounds', sv: 'Stäng av ljud' },
  'run.unmute': { en: 'Unmute sounds', sv: 'Slå på ljud' },
  'run.getReady': { en: 'Get ready', sv: 'Gör dig redo' },
  'run.phase.work': { en: 'Work · Set {idx} / {total}', sv: 'Arbete · Set {idx} / {total}' },
  'run.phase.rest': { en: 'Rest · Set {idx} / {total}', sv: 'Vila · Set {idx} / {total}' },
  'run.repeatSet': { en: 'Repeat set', sv: 'Upprepa set' },
  'run.pause': { en: 'Pause', sv: 'Paus' },
  'run.resume': { en: 'Resume', sv: 'Fortsätt' },
  'run.skipPhase': { en: 'Skip phase', sv: 'Hoppa över fas' },
  'run.paused': { en: 'Session paused', sv: 'Pass pausat' },
  'run.pauseBody': {
    en: 'Your phone was locked or the tab went to the background. Ready to pick up where you left off?',
    sv: 'Din telefon låstes eller fliken gick till bakgrunden. Redo att fortsätta där du var?',
  },

  // ── Complete ─────────────────────────────────────────────────────────
  'complete.title': { en: 'Complete', sv: 'Klart' },
  'complete.heading': { en: 'Nicely done.', sv: 'Bra jobbat.' },
  'complete.subtitle.one': {
    en: '1 set · {workTime} work',
    sv: '1 set · {workTime} arbete',
  },
  'complete.subtitle.many': {
    en: '{sets} sets · {workTime} work each',
    sv: '{sets} set · {workTime} arbete vardera',
  },
  'complete.totalTime': { en: 'Total time', sv: 'Total tid' },
  'complete.workTime': { en: 'Work time', sv: 'Arbetstid' },
  'complete.runAgain': { en: 'Run it again', sv: 'Kör igen' },
  'complete.savePreset': { en: 'Save as preset', sv: 'Spara som förinställning' },
  'complete.signInToSave': { en: 'Sign in to save', sv: 'Logga in för att spara' },
  'complete.done': { en: 'Done', sv: 'Klar' },

  // ── Account ──────────────────────────────────────────────────────────
  'account.title': { en: 'Account', sv: 'Konto' },
  'account.description': {
    en: 'Your account is pseudonymous — no email address, no personal data.',
    sv: 'Ditt konto är pseudonymt — ingen e-postadress, inga personuppgifter.',
  },
  'account.signOut': { en: 'Sign out', sv: 'Logga ut' },
  'account.deleteError': {
    en: 'Could not delete account. Please try again.',
    sv: 'Det gick inte att ta bort kontot. Försök igen.',
  },
  'account.delete': { en: 'Delete account', sv: 'Ta bort konto' },
  'account.deleting': { en: 'Deleting…', sv: 'Tar bort…' },
  'account.deleteConfirm': { en: 'Tap again to confirm', sv: 'Tryck igen för att bekräfta' },
  'account.deleteWarning': {
    en: 'This permanently deletes your account, presets, and history. It cannot be undone.',
    sv: 'Detta tar permanent bort ditt konto, förinställningar och historik. Det går inte att ångra.',
  },
  'account.cancel': { en: 'Cancel', sv: 'Avbryt' },

  // ── Not found ────────────────────────────────────────────────────────
  'notFound.title': { en: '404', sv: '404' },
  'notFound.heading': { en: 'Nothing here.', sv: 'Ingenting här.' },
  'notFound.description': {
    en: "The page you're looking for doesn't exist.",
    sv: 'Sidan du letar efter finns inte.',
  },

  // ── Voice overlay — progress states ──────────────────────────────────
  'voice.requesting': { en: 'Requesting microphone…', sv: 'Begär åtkomst till mikrofon…' },
  'voice.listening': {
    en: 'Tap to stop when you’re done',
    sv: 'Tryck för att stoppa när du är klar',
  },
  'voice.uploading': { en: 'Sending…', sv: 'Skickar…' },
  'voice.transcribing': { en: 'Transcribing…', sv: 'Transkriberar…' },
  'voice.parsing': { en: 'Building session…', sv: 'Bygger pass…' },
  'voice.cancel': { en: 'Cancel', sv: 'Avbryt' },
  'voice.tryAgain': { en: 'Try again', sv: 'Försök igen' },
  'voice.configureCta': { en: 'Configure manually', sv: 'Konfigurera manuellt' },

  // ── Voice overlay — rate-limit body (all include "today's voice allowance") ──
  'voice.rateLimit.noTime': {
    en: 'You’ve used today’s voice allowance.',
    sv: 'Du har använt dagens röstkvot.',
  },
  'voice.rateLimit.oneMinute': {
    en: 'You’ve used today’s voice allowance. Try again in 1 minute.',
    sv: 'Du har använt dagens röstkvot. Försök igen om 1 minut.',
  },
  'voice.rateLimit.minutes': {
    en: 'You’ve used today’s voice allowance. Try again in {count} minutes.',
    sv: 'Du har använt dagens röstkvot. Försök igen om {count} minuter.',
  },
  'voice.rateLimit.hours': {
    en: 'You’ve used today’s voice allowance. Try again in {count} hours.',
    sv: 'Du har använt dagens röstkvot. Försök igen om {count} timmar.',
  },

  // ── Voice overlay — error headings (one per error state) ─────────────
  'voice.error.rateLimitHeading': { en: 'Daily voice limit reached', sv: 'Daglig röstgräns nådd' },
  'voice.error.languageMismatchHeading': { en: 'Language not supported', sv: 'Språk stöds inte' },
  'voice.error.tryAgainHeading': { en: 'Let’s try that again', sv: 'Låt oss försöka igen' },
  'voice.error.permissionDeniedHeading': { en: 'Microphone blocked', sv: 'Mikrofon blockerad' },
  'voice.error.offlineHeading': { en: 'Offline', sv: 'Offline' },
  'voice.error.unsupportedHeading': { en: 'Not supported', sv: 'Stöds inte' },

  // ── Voice overlay — error body copy (distinct per scenario) ──────────
  'voice.error.languageMismatch': {
    en: 'Takt currently understands English and Swedish. Tap Configure to build a session manually.',
    sv: 'Takt förstår för närvarande engelska och svenska. Tryck på Konfigurera för att bygga ett pass manuellt.',
  },
  'voice.error.notASession': {
    en: 'Couldn’t make a session from that. Have another go, or tap Configure to build one manually.',
    sv: 'Kunde inte skapa ett pass från det. Försök igen eller tryck på Konfigurera.',
  },
  'voice.error.coldStartTimeout': {
    en: 'Voice took longer than expected. Try again, or tap Configure to build a session manually.',
    sv: 'Rösten tog längre tid än väntat. Försök igen eller tryck på Konfigurera.',
  },
  'voice.error.genericBody': {
    en: 'Couldn’t build a session from that. Tap Configure to build one manually.',
    sv: 'Kunde inte bygga ett pass från det. Tryck på Konfigurera.',
  },
  'voice.error.permissionDeniedBody': {
    en: 'Microphone access is blocked for Takt. Tap Configure to build a session manually.',
    sv: 'Mikrofonåtkomst är blockerad för Takt. Tryck på Konfigurera för att bygga ett pass manuellt.',
  },
  'voice.error.offlineBody': {
    en: 'You’re offline. Tap Configure to build a session manually.',
    sv: 'Du är offline. Tryck på Konfigurera för att bygga ett pass manuellt.',
  },
  'voice.error.unsupportedBody': {
    en: 'This browser doesn’t support voice input. Tap Configure to build a session manually.',
    sv: 'Den här webbläsaren stöder inte röstinmatning. Tryck på Konfigurera för att bygga ett pass manuellt.',
  },
  'voice.error.generic': {
    en: 'Something went wrong. Please try again.',
    sv: 'Något gick fel. Försök igen.',
  },
  'voice.retryToast': {
    en: 'Didn’t catch that — tap the mic and try again.',
    sv: 'Förstod inte — tryck på mikrofonen och försök igen.',
  },

  // ── Mic button ───────────────────────────────────────────────────────
  'mic.ariaLabel': { en: 'Start voice input', sv: 'Starta röstinmatning' },
  'mic.tapToStart': { en: 'Tap to start', sv: 'Tryck för att börja' },

  // ── Last session card ────────────────────────────────────────────────
  'lastSession.eyebrow': { en: 'Last session', sv: 'Senaste pass' },
  'lastSession.rest': { en: '· rest {time}', sv: '· vila {time}' },

  // ── Passkey prompt ───────────────────────────────────────────────────
  'passkey.discover.title': { en: 'Continue with passkey', sv: 'Fortsätt med passkey' },
  'passkey.discover.description': {
    en: 'If you have a passkey for Takt on this device, your phone will offer it. Otherwise you can create a new account.',
    sv: 'Om du har en passkey för Takt på den här enheten erbjuder din telefon den. Annars kan du skapa ett nytt konto.',
  },
  'passkey.discoverFallback.title': { en: 'Create an account', sv: 'Skapa ett konto' },
  'passkey.discoverFallback.description': {
    en: 'No passkey found. Create a new account to get started.',
    sv: 'Ingen passkey hittades. Skapa ett nytt konto för att komma igång.',
  },
  'passkey.register.title': { en: 'Create an account', sv: 'Skapa ett konto' },
  'passkey.register.description': {
    en: 'Your phone will ask you to use Face ID, Touch ID, or your device PIN. No password needed.',
    sv: 'Din telefon ber dig använda Face ID, Touch ID eller enhetens PIN-kod. Inget lösenord behövs.',
  },
  'passkey.signin.title': { en: 'Sign in', sv: 'Logga in' },
  'passkey.signin.description': {
    en: 'Use your passkey to sign in.',
    sv: 'Använd din passkey för att logga in.',
  },
  'passkey.multiplatformNote': {
    en: 'If you use different platforms (e.g. Android phone + MacBook), you may need to add each device separately.',
    sv: 'Om du använder olika plattformar (t.ex. Android-telefon + MacBook) kan du behöva lägga till varje enhet separat.',
  },
  'passkey.cancel': { en: 'Cancel', sv: 'Avbryt' },
  'passkey.waiting': { en: 'Waiting…', sv: 'Väntar…' },
  'passkey.button.discover': { en: 'Continue with passkey', sv: 'Fortsätt med passkey' },
  'passkey.button.discoverFallback': {
    en: 'Create account with passkey',
    sv: 'Skapa konto med passkey',
  },
  'passkey.button.register': { en: 'Create account with passkey', sv: 'Skapa konto med passkey' },
  'passkey.button.signin': { en: 'Sign in with passkey', sv: 'Logga in med passkey' },
  'passkey.switchToSignIn': {
    en: 'Already have an account? Sign in instead',
    sv: 'Har du redan ett konto? Logga in istället',
  },

  // ── Presets drawer ───────────────────────────────────────────────────
  'presets.title': { en: 'Presets', sv: 'Förinställningar' },
  'presets.close': { en: 'Close presets', sv: 'Stäng förinställningar' },
  'presets.loading': { en: 'Loading…', sv: 'Laddar…' },
  'presets.loadError': {
    en: 'Could not load presets. Please try again.',
    sv: 'Det gick inte att ladda förinställningar. Försök igen.',
  },
  'presets.empty': {
    en: 'No presets yet. Complete a session and save it here.',
    sv: 'Inga förinställningar än. Slutför ett pass och spara det här.',
  },
  'presets.rename.label': { en: 'Rename preset', sv: 'Byt namn på förinställning' },
  'presets.rename.save': { en: 'Save rename', sv: 'Spara nytt namn' },
  'presets.rename.cancel': { en: 'Cancel rename', sv: 'Avbryt namnbyte' },
  'presets.run': { en: 'Run {name}', sv: 'Kör {name}' },
  'presets.pin': { en: 'Pin preset {name}', sv: 'Fäst förinställning {name}' },
  'presets.unpin': { en: 'Unpin preset {name}', sv: 'Lossa förinställning {name}' },
  'presets.rename.aria': { en: 'Rename {name}', sv: 'Byt namn på {name}' },
  'presets.duplicate': { en: 'Duplicate {name}', sv: 'Duplicera {name}' },
  'presets.delete.aria': { en: 'Delete {name}', sv: 'Ta bort {name}' },
  'presets.delete.confirm': { en: 'Confirm delete', sv: 'Bekräfta borttagning' },

  // ── Save preset sheet ─────────────────────────────────────────────────
  'savePreset.title': { en: 'Save as preset', sv: 'Spara som förinställning' },
  'savePreset.namePlaceholder': { en: 'e.g. Leg day', sv: 't.ex. Bendag' },
  'savePreset.nameLabel': { en: 'Name', sv: 'Namn' },
  'savePreset.nameRequired': { en: 'Please enter a name.', sv: 'Ange ett namn.' },
  'savePreset.nameTooLong': {
    en: 'Name must be 50 characters or fewer.',
    sv: 'Namnet får ha max 50 tecken.',
  },
  'savePreset.saveError': {
    en: 'Could not save preset. Please try again.',
    sv: 'Det gick inte att spara förinställningen. Försök igen.',
  },
  'savePreset.save': { en: 'Save', sv: 'Spara' },
  'savePreset.saving': { en: 'Saving…', sv: 'Sparar…' },
  'savePreset.cancel': { en: 'Cancel', sv: 'Avbryt' },

  // ── Settings ─────────────────────────────────────────────────────────────
  'settings.title': { en: 'Settings', sv: 'Inställningar' },
  'settings.language': { en: 'Language', sv: 'Språk' },
  'settings.language.en': { en: 'English', sv: 'Engelska' },
  'settings.language.sv': { en: 'Swedish', sv: 'Svenska' },
  'settings.sound': { en: 'Sound effects', sv: 'Ljudeffekter' },
  'settings.accent': { en: 'Accent colour', sv: 'Accentfärg' },
  'settings.accent.lichen': { en: 'Lichen', sv: 'Lav' },
  'settings.accent.coral': { en: 'Coral', sv: 'Korall' },
  'settings.accent.ocean': { en: 'Ocean', sv: 'Hav' },
  'settings.accent.amber': { en: 'Amber', sv: 'Bärnsten' },
  'settings.accent.iris': { en: 'Iris', sv: 'Iris' },
  'settings.accent.slate': { en: 'Slate', sv: 'Skiffer' },
  'home.settings': { en: 'Settings', sv: 'Inställningar' },

  // ── Stepper sheet ─────────────────────────────────────────────────────
  'stepper.edit': { en: 'Edit {label}', sv: 'Redigera {label}' },
  'stepper.decrease': { en: 'Decrease {label}', sv: 'Minska {label}' },
  'stepper.increase': { en: 'Increase {label}', sv: 'Öka {label}' },
  'stepper.minSec': { en: 'min : sec', sv: 'min : sek' },
  'stepper.cancel': { en: 'Cancel', sv: 'Avbryt' },
  'stepper.done': { en: 'Done', sv: 'Klar' },
} as const satisfies Record<string, Translation>;

export type StringKey = keyof typeof strings;
export type Lang = 'en' | 'sv';

export default strings;
