import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

// English and Khmer for the rider app. Street and place names stay as mapped.
// The Khmer was written for this prototype; have a native speaker review it before launch.

export type Lang = 'en' | 'km'

const en = {
  'mode.demo': 'Demo',
  'mode.live': 'Live',
  'hud.gps': 'GPS lock',
  'hud.sim': 'Sim {x}×',
  'hud.home': 'Back to the landing page',
  'badge.dry': 'Dry route',
  'badge.caution': '{cm} cm ahead',
  'badge.blocked': 'Deep water ahead',
  'hud.recalc': 'New flood detected ahead. Recalculating a dry {vehicle} route...',
  'hud.toward': 'toward',
  'notice.nodry': 'No fully dry route left. Showing the least-flooded option.',
  'notice.updated': 'Route updated, via {via}',
  'notice.updatedExtra': 'Route updated, +{min} min, via {via}',
  'notice.scripted': 'A rider ahead just reported deep water.',
  'vehicle.moto': 'Motorbike',
  'vehicle.tuktuk': 'Tuk-Tuk',
  'vehicle.car': 'Car',
  'noun.moto': 'motorbike',
  'noun.tuktuk': 'tuk-tuk',
  'noun.car': 'car',
  'sheet.expand': 'Expand sheet for routes and nearby alerts',
  'sheet.collapse': 'Collapse sheet',
  'sheet.from': 'From {origin} to',
  'sheet.eta': 'ETA',
  'sheet.min': '{n} min',
  'sheet.dryOnly': 'Dry only',
  'sheet.report': 'Report flood',
  'sheet.start': 'Start',
  'sheet.stop': 'Stop ride',
  'sheet.search': 'Where to? Avoid flooded streets...',
  'sheet.searchLabel': 'Destination',
  'sheet.closeSearch': 'Close search',
  'sheet.noMatch': 'No saved trip matches. Try “market” or “RUPP”.',
  'sheet.fromShort': 'from {origin}',
  'sheet.routes': 'Routes, time vs flood exposure',
  'sheet.route': 'Route {letter}',
  'sheet.via': 'via',
  'exposure.blocked': '{n} impassable',
  'exposure.caution': '{n} caution',
  'exposure.dry': 'No flooding',
  'sheet.nearby': 'Reports within 2 km',
  'sheet.none': 'No flood reports near you.',
  'sheet.away': '{m} m away',
  'sheet.verified': 'verified',
  'sheet.confirmed': '{n} confirmed',
  'sheet.still': 'Still flooded',
  'sheet.cleared': 'Cleared',
  'ago.now': 'now',
  'ago.min': '{n}m ago',
  'ago.hour': '{n}h ago',
  'sync.demo': 'Demo data on this device',
  'sync.local': 'On this device only. Shared reports are not set up yet.',
  'sync.connecting': 'Connecting to shared reports...',
  'sync.live': 'Shared live with every rider',
  'sync.offline': 'Shared reports unreachable. Retrying.',
  'weather.heavyNow': 'Heavy rain now: {mm} mm/h. Low streets can flood within minutes.',
  'weather.heavySoon': 'Heavy rain expected: {mm} mm in the next 3 hours.',
  'weather.dry': 'Dry',
  'weather.unknown': 'Rain data unavailable',
  'weather.title': 'Rain now {now} mm/h, next 3 h {next} mm, chance {chance}%. Source: {source}',
  'weather.dismiss': 'Dismiss rain alert',
  'arrive.title': 'You arrived at {dest}',
  'arrive.time': 'Ride time',
  'arrive.avoided': 'Floods avoided',
  'arrive.deepest': 'Deepest water on route',
  'arrive.none': 'None',
  'arrive.again': 'Ride again',
  'arrive.done': 'Done',
  'arrive.simNote': 'Simulated ride at {x}× speed. Times are for a real ride.',
  'report.title': 'Report a flood',
  'report.khanSangkat': 'Khan {khan} · Sangkat {sangkat}',
  'report.close': 'Close',
  'report.closeBackdrop': 'Close report',
  'report.depthGroup': 'Water depth',
  'depth.ankle.title': 'Ankle / Exhaust Safe',
  'depth.knee.title': 'Knee / Engine Risk',
  'depth.waist.title': 'Impassable / Deep Water',
  'depth.clear': 'Clear',
  'depth.ankle': 'Ankle-Deep',
  'depth.knee': 'Knee-Deep',
  'depth.waist': 'Waist-Deep',
  'report.addPhoto': 'Add a photo for AI depth check',
  'report.optional': 'Optional',
  'report.demoPhotos': 'Demo photos',
  'report.samplePhotos': 'Sample photos, checked by the real AI',
  'report.upload': 'Take or upload a photo',
  'report.privacy': 'Photos are sent to Google Gemini for the check. PhnomFlood does not store them.',
  'scan.1': 'Analyzing tire submersion...',
  'scan.2': 'Checking drainage database...',
  'scan.3': 'Finalizing verdict...',
  'scan.live': 'Asking the Vision AI...',
  'photo.verified': 'Verified',
  'photo.rejected': 'Rejected',
  'photo.notAnalysed': 'Not analysed',
  'photo.remove': 'Remove photo',
  'photo.credit': 'Photo: {credit}',
  'ai.confirms': 'AI confirms {label} (~{cm} cm).',
  'ai.corrected': 'AI depth correction: you selected {from}, but {cue} indicates {to} (~{cm} cm). Severity {dir}.',
  'ai.up': 'upgraded',
  'ai.down': 'downgraded so no false alarm reaches the map',
  'ai.reference': 'Reference',
  'ai.submersion': 'Submersion',
  'ai.debris': 'Debris',
  'ai.yes': 'Yes',
  'ai.no': 'No',
  'ai.rejected': 'No street flooding found in this photo. The report was rejected to keep the map clean.',
  'ai.saw': 'What the AI saw: {reason}',
  'ai.notConfigured': 'The Vision AI is not connected on this server yet. You can still file the report unverified.',
  'ai.demoUpload': 'The demo uses pre-written verdicts for its sample photos. Open the live app to check your own photo.',
  'ai.failed': 'The Vision AI could not be reached. You can still file the report unverified.',
  'ai.source.demo': 'Pre-written demo verdict',
  'ai.source.live': 'Live Vision AI',
  'report.submit': 'Submit report',
  'report.analyzing': 'Analyzing...',
  'report.rejected': 'Report rejected',
  'controls.recenter': 'Re-centre on my position',
  'controls.zoomIn': 'Zoom in',
  'controls.zoomOut': 'Zoom out',
  'controls.mute': 'Mute audio alerts',
  'controls.unmute': 'Unmute audio alerts',
  'lang.switch': 'ភាសាខ្មែរ',
  'lang.label': 'ខ្មែរ',
  'nav.then': 'Then',
  'nav.exit': 'Exit navigation',
  'nav.recenter': 'Re-centre',
  'nav.arrival': '{time} arrival',
} as const

export type Key = keyof typeof en

const km: Record<Key, string> = {
  'mode.demo': 'សាកល្បង',
  'mode.live': 'ផ្ទាល់',
  'hud.gps': 'GPS ភ្ជាប់',
  'hud.sim': 'ក្លែង {x}×',
  'hud.home': 'ត្រឡប់ទៅទំព័រដើម',
  'badge.dry': 'ផ្លូវស្ងួត',
  'badge.caution': 'ទឹក {cm} សម ខាងមុខ',
  'badge.blocked': 'ទឹកជ្រៅខាងមុខ',
  'hud.recalc': 'រកឃើញទឹកជំនន់ថ្មីនៅខាងមុខ។ កំពុងរកផ្លូវស្ងួតថ្មីសម្រាប់{vehicle}...',
  'hud.toward': 'ឆ្ពោះទៅ',
  'notice.nodry': 'គ្មានផ្លូវស្ងួតទាំងស្រុងទេ។ កំពុងបង្ហាញផ្លូវដែលលិចតិចបំផុត។',
  'notice.updated': 'បានប្តូរផ្លូវ តាម {via}',
  'notice.updatedExtra': 'បានប្តូរផ្លូវ +{min} នាទី តាម {via}',
  'notice.scripted': 'អ្នកជិះម្នាក់នៅខាងមុខទើបរាយការណ៍ទឹកជ្រៅ។',
  'vehicle.moto': 'ម៉ូតូ',
  'vehicle.tuktuk': 'តុកតុក',
  'vehicle.car': 'ឡាន',
  'noun.moto': 'ម៉ូតូ',
  'noun.tuktuk': 'តុកតុក',
  'noun.car': 'ឡាន',
  'sheet.expand': 'បើកមើលផ្លូវ និងការជូនដំណឹងនៅជិត',
  'sheet.collapse': 'បិទផ្ទាំង',
  'sheet.from': 'ពី {origin} ទៅ',
  'sheet.eta': 'មកដល់',
  'sheet.min': '{n} នាទី',
  'sheet.dryOnly': 'តែផ្លូវស្ងួត',
  'sheet.report': 'រាយការណ៍ទឹកជំនន់',
  'sheet.start': 'ចាប់ផ្តើម',
  'sheet.stop': 'ឈប់ជិះ',
  'sheet.search': 'ទៅណា? ជៀសផ្លូវលិចទឹក...',
  'sheet.searchLabel': 'គោលដៅ',
  'sheet.closeSearch': 'បិទការស្វែងរក',
  'sheet.noMatch': 'រកមិនឃើញដំណើរ។ សាកពាក្យ “market” ឬ “RUPP”។',
  'sheet.fromShort': 'ពី {origin}',
  'sheet.routes': 'ផ្លូវ៖ ពេលវេលា និងទឹកជំនន់',
  'sheet.route': 'ផ្លូវ {letter}',
  'sheet.via': 'តាម',
  'exposure.blocked': 'មិនអាចឆ្លង {n}',
  'exposure.caution': 'ប្រុងប្រយ័ត្ន {n}',
  'exposure.dry': 'គ្មានទឹកលិច',
  'sheet.nearby': 'របាយការណ៍ក្នុងចម្ងាយ ២ គ.ម',
  'sheet.none': 'មិនមានរបាយការណ៍ទឹកជំនន់នៅជិតអ្នកទេ។',
  'sheet.away': 'ចម្ងាយ {m} ម៉ែត្រ',
  'sheet.verified': 'បានផ្ទៀងផ្ទាត់',
  'sheet.confirmed': 'បញ្ជាក់ {n} ដង',
  'sheet.still': 'នៅតែលិច',
  'sheet.cleared': 'ស្រកហើយ',
  'ago.now': 'ឥឡូវ',
  'ago.min': '{n} នាទីមុន',
  'ago.hour': '{n} ម៉ោងមុន',
  'sync.demo': 'ទិន្នន័យសាកល្បងលើឧបករណ៍នេះ',
  'sync.local': 'រក្សាទុកតែលើឧបករណ៍នេះ។ ការចែករំលែករបាយការណ៍មិនទាន់ដំឡើងនៅឡើយ។',
  'sync.connecting': 'កំពុងភ្ជាប់ទៅរបាយការណ៍រួម...',
  'sync.live': 'ចែករំលែកផ្ទាល់ជាមួយអ្នកជិះទាំងអស់',
  'sync.offline': 'មិនអាចភ្ជាប់របាយការណ៍រួមបានទេ។ កំពុងព្យាយាមម្តងទៀត។',
  'weather.heavyNow': 'ភ្លៀងខ្លាំងឥឡូវនេះ៖ {mm} មម/ម៉ោង។ ផ្លូវទាបអាចលិចក្នុងរយៈពេលប៉ុន្មាននាទី។',
  'weather.heavySoon': 'រំពឹងថានឹងភ្លៀងខ្លាំង៖ {mm} មម ក្នុង ៣ ម៉ោងខាងមុខ។',
  'weather.dry': 'ស្ងួត',
  'weather.unknown': 'មិនមានទិន្នន័យភ្លៀង',
  'weather.title': 'ភ្លៀងឥឡូវ {now} មម/ម៉ោង, ៣ ម៉ោងខាងមុខ {next} មម, ឱកាស {chance}%។ ប្រភព៖ {source}',
  'weather.dismiss': 'បិទការជូនដំណឹងភ្លៀង',
  'arrive.title': 'អ្នកបានមកដល់ {dest}',
  'arrive.time': 'រយៈពេលជិះ',
  'arrive.avoided': 'ទឹកជំនន់ដែលបានជៀស',
  'arrive.deepest': 'ទឹកជ្រៅបំផុតលើផ្លូវ',
  'arrive.none': 'គ្មាន',
  'arrive.again': 'ជិះម្តងទៀត',
  'arrive.done': 'រួចរាល់',
  'arrive.simNote': 'ការជិះក្លែងធ្វើលឿន {x}×។ ពេលវេលាគឺសម្រាប់ការជិះពិត។',
  'report.title': 'រាយការណ៍ទឹកជំនន់',
  'report.khanSangkat': 'ខណ្ឌ {khan} · សង្កាត់ {sangkat}',
  'report.close': 'បិទ',
  'report.closeBackdrop': 'បិទការរាយការណ៍',
  'report.depthGroup': 'ជម្រៅទឹក',
  'depth.ankle.title': 'កជើង / បំពង់ផ្សែងមិនលិច',
  'depth.knee.title': 'ជង្គង់ / ម៉ាស៊ីនអាចខូច',
  'depth.waist.title': 'មិនអាចឆ្លង / ទឹកជ្រៅ',
  'depth.clear': 'ស្ងួត',
  'depth.ankle': 'ត្រឹមកជើង',
  'depth.knee': 'ត្រឹមជង្គង់',
  'depth.waist': 'ត្រឹមចង្កេះ',
  'report.addPhoto': 'បន្ថែមរូបថតឱ្យ AI ពិនិត្យជម្រៅ',
  'report.optional': 'ស្រេចចិត្ត',
  'report.demoPhotos': 'រូបថតសាកល្បង',
  'report.samplePhotos': 'រូបថតគំរូ ពិនិត្យដោយ AI ពិត',
  'report.upload': 'ថត ឬផ្ទុករូបថតឡើង',
  'report.privacy': 'រូបថតត្រូវបានផ្ញើទៅ Google Gemini ដើម្បីពិនិត្យ។ PhnomFlood មិនរក្សាទុករូបថតទាំងនោះទេ។',
  'scan.1': 'កំពុងវិភាគកម្រិតលិចកង់...',
  'scan.2': 'កំពុងពិនិត្យទិន្នន័យលូ...',
  'scan.3': 'កំពុងសន្និដ្ឋាន...',
  'scan.live': 'កំពុងសួរ Vision AI...',
  'photo.verified': 'បានផ្ទៀងផ្ទាត់',
  'photo.rejected': 'បានបដិសេធ',
  'photo.notAnalysed': 'មិនទាន់វិភាគ',
  'photo.remove': 'លុបរូបថត',
  'photo.credit': 'រូបថត៖ {credit}',
  'ai.confirms': 'AI បញ្ជាក់៖ {label} (ប្រហែល {cm} សម)។',
  'ai.corrected': 'AI កែតម្រូវជម្រៅ៖ អ្នកជ្រើស {from} ប៉ុន្តែរូបថតបង្ហាញ {to} (ប្រហែល {cm} សម)។ កម្រិតគ្រោះថ្នាក់ត្រូវបាន{dir}។',
  'ai.up': 'ដំឡើង',
  'ai.down': 'បន្ថយ ដើម្បីកុំឱ្យមានការជូនដំណឹងខុស',
  'ai.reference': 'វត្ថុយោង',
  'ai.submersion': 'កម្រិតលិច',
  'ai.debris': 'សំរាម',
  'ai.yes': 'មាន',
  'ai.no': 'គ្មាន',
  'ai.rejected': 'រកមិនឃើញផ្លូវលិចទឹកក្នុងរូបថតនេះទេ។ របាយការណ៍ត្រូវបានបដិសេធ ដើម្បីរក្សាផែនទីឱ្យត្រឹមត្រូវ។',
  'ai.saw': 'អ្វីដែល AI ឃើញ៖ {reason}',
  'ai.notConfigured': 'Vision AI មិនទាន់ភ្ជាប់នៅលើម៉ាស៊ីនមេនេះទេ។ អ្នកនៅតែអាចដាក់របាយការណ៍ដោយមិនផ្ទៀងផ្ទាត់។',
  'ai.demoUpload': 'កំណែសាកល្បងប្រើលទ្ធផលសរសេរជាមុនសម្រាប់រូបថតគំរូ។ សូមបើកកម្មវិធីផ្ទាល់ ដើម្បីពិនិត្យរូបថតរបស់អ្នក។',
  'ai.failed': 'មិនអាចភ្ជាប់ Vision AI បានទេ។ អ្នកនៅតែអាចដាក់របាយការណ៍ដោយមិនផ្ទៀងផ្ទាត់។',
  'ai.source.demo': 'លទ្ធផលសាកល្បងសរសេរជាមុន',
  'ai.source.live': 'Vision AI ផ្ទាល់',
  'report.submit': 'ដាក់របាយការណ៍',
  'report.analyzing': 'កំពុងវិភាគ...',
  'report.rejected': 'របាយការណ៍ត្រូវបានបដិសេធ',
  'controls.recenter': 'ត្រឡប់ទៅទីតាំងខ្ញុំ',
  'controls.zoomIn': 'ពង្រីក',
  'controls.zoomOut': 'បង្រួម',
  'controls.mute': 'បិទសំឡេងជូនដំណឹង',
  'controls.unmute': 'បើកសំឡេងជូនដំណឹង',
  'lang.switch': 'English',
  'lang.label': 'EN',
  'nav.then': 'បន្ទាប់',
  'nav.exit': 'ចេញពីការណែនាំផ្លូវ',
  'nav.recenter': 'ត្រឡប់មកវិញ',
  'nav.arrival': 'មកដល់ម៉ោង {time}',
}

const DICTS: Record<Lang, Record<Key, string>> = { en, km }
const STORE = 'phnomflood.lang'

type Vars = Record<string, string | number>
interface I18n {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: Key, vars?: Vars) => string
}

const I18nContext = createContext<I18n | null>(null)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return window.localStorage.getItem(STORE) === 'km' ? 'km' : 'en'
    } catch {
      return 'en'
    }
  })

  useEffect(() => {
    document.documentElement.lang = lang === 'km' ? 'km' : 'en'
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      window.localStorage.setItem(STORE, next)
    } catch {
      // the choice still applies for this visit
    }
  }, [])

  const t = useCallback(
    (key: Key, vars?: Vars) => {
      let text = DICTS[lang][key] ?? en[key] ?? key
      if (vars) for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v))
      return text
    },
    [lang],
  )

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useT() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT must be used inside <LangProvider>')
  return ctx
}
