# AI-Brain-Netzwerk – revidierter Plan v2

Stand: 16.10.2026. Status: **Schritte 1/2 umgesetzt, Schritt 2 in PR #4; spätere Schritte bleiben geplant**.
Review-Grundlage: PR #1, Head `97a4fcf7ed26c11552d0f4d9c28f34cc01fbd2d4`.

## Verbindliche Grundlage
Dieser Plan führt [Originalplan](./ai-brain-network.md) und [Amendments](./AMENDMENTS-2026-10-15.md) zusammen. Die Amendments haben Vorrang; das Original bleibt unverändert. Bei späteren Änderungen diese Revision und das Hook-Verzeichnis aktualisieren. „Erster Implementierungs-PR“ bezeichnet den künftigen Geometrie-PR, nicht den bestehenden Dokumentations-PR #1.

Referenz `design-style-kurzgesagt-neon` aus einer privaten Hindsight-Bank wurde am 15.10.2026 gelesen (Dokument-Hash `9bf6d1c31cc6e6caa4455cfad44ff79edb8f44aee65f2f3a379f48ca0310a17c`). Die folgenden konkreten Stilregeln reichen zur Implementierung; kein Zugriff auf private Memories zur Laufzeit nötig.

## Review des Originalplans

| Bisheriger Vorschlag | Verbindliche Änderung |
|---|---|
| Neue Module in src/lib/brain-* | Sämtlicher Custom-Code samt Tests, Styles, Assets und Übersetzungen nach src/custom/brain/. |
| Positionsberechnung im gemeinsamen Renderer auslagern | Upstream-Pfad erhalten; nur kleine markierte Integrationspunkte. Keine breite Refaktorierung oder Renderer-Kopie. |
| layoutMode als einzige Aktivierung | Zusätzlicher Feature-Schalter, standardmäßig aus; ohne Aktivierung exakt bisheriges Verhalten. |
| Übersetzungen in src/messages/*.json | Eigene Dateien/Namespace; bestehende Locale-Dateien nur als begründeter letzter Ausweg. |
| Bunte Prism-Anmutung | Dunkler entsättigter Hintergrund, 2–3 Neonakzente, weiße Highlights, flache Vektorformen und zurückhaltende Tiefenstaffelung. |
| Vier Umsetzungsschritte ohne strenge PR-Grenze | Erster Code-PR ausschließlich reine Geometrie/Layout plus Tests, ohne UI, Feature-Schalter-Verkabelung oder Hooks. |
| Eventuell später Hirn als Standard | Kein automatischer Standardwechsel. Aktivierung nur bewusst; deaktivierter Schalter gewinnt immer gegen gespeicherte Präferenz. |
| Weitere Oberflächen nur lose erwähnt | Globales Theme, Soul und Projekte jeweils eigener Plan vor Umsetzung. |

Unverändert gelten: echte Graphdaten, Bank-/Tag-Isolation, feine Punkte/Kanten, stabile IDs, Canvas/SVG-Konsistenz, Performancebudgets, mobile Bedienung und zugängliche Tabellenalternative.

## Ziel und Nicht-Ziele
Ein optionales, erkennbar gehirnförmiges Memory-Netzwerk in der bestehenden Control Plane. Feine Punkte und Verbindungslinien in einer festen Dreiviertelprojektion; keine medizinische Darstellung und keine biologische Bedeutung der Regionen.

Jetzt keine Umsetzung des gesamten Dashboards, keine neue Authentifizierung, keine Backend-/Datenbank-/SDK-Änderung und keine freie 3D-Rotation. Hosting bleibt ein selbst gehosteter Server hinter einem externen Zugangs-Proxy. Zusätzlich bleibt der Control-Plane-Login über `HINDSIGHT_CP_ACCESS_KEY` erhalten; keine der beiden Schutzschichten entfernen oder umgehen. CSP nicht abschwächen. Keine Secrets in Code, Logs, Dokumenten oder Chat. Kein Deploy ohne ausdrücklichen Auftrag.

## Geprüfte Integrationsbasis
Der Originalplan dokumentiert den bestehenden Canvas-2D-Renderer `src/components/constellation.tsx`, `data-view.tsx`, `graph-data.ts` und den Datenweg über `/api/graph` zur bankgebundenen API. Diese Darstellung ist hash-/gruppenbasiert, keine Force-Simulation. Die HomeView lädt separat maximal 200 Knoten; Entities und die eigene Docs-Website-Konstellation teilen nicht automatisch die neue Ansicht.

Zusätzlich für diese Revision geprüft:
- `src/lib/features-context.tsx` lädt Backend-Fähigkeiten über getVersion; das ist kein vorhandener Schalter für unser UI. Keine neue Backend-Fähigkeit vortäuschen.
- `src/i18n/request.ts` lädt zehn Locale-Dateien über statische Loader. Bestehende Loader zunächst unverändert lassen; ein lokaler Provider für Custom-Komponenten ist der bevorzugte Integrationsweg.
- Root `AGENTS.md` / `CLAUDE.md` bleiben maßgeblich. Vor Codearbeit lokale Next-Dokumentation und `.claude/skills/code-review/SKILL.md` lesen.

## Custom-Struktur und Grenzen
Die Tabelle zeigt die ursprünglichen Planungsnamen; tatsächliche Abweichungen sind im Hook-Verzeichnis dokumentiert. Basis: `hindsight-control-plane/src/custom/brain/`.

| Datei/Ordner | Aufgabe / Phase |
|---|---|
| types.ts, geometry.ts, layout.ts | Reine eigene Typen, normierte Gehirnkontur, feste Projektion, deterministische ID-Positionen; erster Code-PR. |
| __tests__/geometry.test.ts, __tests__/layout.test.ts, fixtures/ | Tests und synthetische Daten; erster Code-PR. |
| adapter.ts, render-model.ts | Schmale Brücke zu upstream GraphData; gemeinsame Darstellung für Canvas und SVG; später. |
| feature.ts, preference.ts | Expliziter Feature-Schalter und lokale Moduspräferenz; später. |
| controls.tsx, provider.tsx, messages/*.json | Zugängliche Bedienelemente und eigener brain-Namespace; später. |
| brain.module.css, icons/ | Lokal begrenzte Gestaltung und originale kleine Vektor-Icons; später. |

Im ersten Code-PR keine Imports aus App-Komponenten, DOM, Canvas, React, Browser-Storage oder API-Client. Eigene Inputtypen genügen: ID und optional stabiler Gruppenschlüssel; Output: ID, projizierte Position/Tiefe und Bounds. Nur Tests konsumieren diese Module zunächst. Die vorhandene Vitest-Discovery und knip-Erkennung vorab prüfen. Falls reine unverdrahtete Module als unbenutzt beanstandet werden, keinen globalen Lint-/Dead-Code-Check deaktivieren: test-erreichbare Struktur verwenden oder ein eng begründetes Test-Entry gesondert dokumentieren.

Kein neues Three.js/Force-Graph-Paket. Canvas 2D mit 2,5D-Projektion genügt.

## Geometrie, Daten und Stil
- Normalisierte eigene Kurven/Formdaten für zwei Hemisphären, Trennfurche und sanfte Furchen. Form durch Punktverteilung und dezente Flächenstaffelung erkennen lassen; keine dicke Außenkontur.
- Position aus stabiler ID, Geometrieversion und optional stabilem Gruppenschlüssel berechnen. Nicht aus Index, aktueller Anzahl oder sortierter Rangposition. Gleiche ID und Gruppe bleiben bei Filtern, Sortieren und neuen Nachbarn am gleichen Ort.
- Hash-Kollisionen durch weitere deterministische Hashwerte auflösen; kein sequenzielles Verschieben aller folgenden Punkte. Sampling mit begrenzten Versuchen und definiertem Fallback innerhalb der Kontur.
- Regionen nicht von der Anzahl aktuell sichtbarer Scopes abhängig machen. Gruppierungswechsel darf bewusst andere Positionen erzeugen, bloßes Filtern nicht.
- Knotenradius ca. 1–2 CSS-Pixel, Auswahl ca. 3–4; Kanten ca. 0,35–0,65 CSS-Pixel bei geringer Deckkraft. Größere unsichtbare Trefferflächen, insbesondere Touch. Werte sind Startwerte zur visuellen Prüfung.
- Nur echte Kanten und IDs darstellen. Unbekannte Endpunkte, Selbstkanten und parallele Linktypen explizit behandeln; Richtung und Metadaten bewahren. Dekorative Furchen/Partikel gehören nicht zu Daten, Statistiken, Details oder Trefferflächen. Leere Bank bleibt leer.
- Grundpalette: Hintergrund #0B0726; Akzente #9D00FF, #FF007F, #00FFFF; weiße Highlights. „Keine Outlines“ betrifft illustrative Formen, nicht reale Graphkanten oder notwendige Fokusindikatoren.
- Neon-Bloom nur an emissiven Auswahl-/Datenelementen; kein flächiger Glow-Nebel. Flache geometrische Formen, dunklere/kühlere hintere Ebenen, viel Freiraum. Anime-Anklang ausschließlich kleine originale Icons. Keine kopierten Figuren, Logos oder Markenbezeichnungen in öffentlich sichtbaren Assets.
- Datenfarben/Legenden haben Vorrang vor dekorativer Palette: die vorhandenen Linktypen und Aktualitäts-/Scope-Semantiken nicht auf drei undeutliche Farben reduzieren. Vorhandene bewährte Datenfarben gegebenenfalls beibehalten.
- Parallax nur minimal, optional und innerhalb des Hirnmoduls; reduced-motion und Pause deaktivieren sie. Keine automatische Kamerafahrt oder falschen Live-Aktivitätssignale.

## Feature-Schalter und unverändertes Verhalten
Vorschlag: `NEXT_PUBLIC_HINDSIGHT_BRAIN_ENABLED` als expliziter **Buildzeit**-Schalter, nur exakter Wert `true` aktiviert; fehlt/false/ungültig bedeutet aus. Er enthält keine Geheimnisse. Setzen erst beim Containerstart reicht für einen vorgebauten Next-Client nicht; Build mit gesetztem Wert ist erforderlich. Eine Laufzeitkonfiguration wäre eine separate, erst zu prüfende Alternative.

- Flag aus: kein Umschalter, keine Custom-Styles/Provider/Animationen/Requests/Storage-Schreibzugriffe; upstream Netzwerk, Limits, Export und Interaktion unverändert.
- Flag an: standardmäßig weiterhin Netzwerk; Nutzer kann Hirn auswählen. Gespeicherte Hirn-Präferenz wirkt nur bei aktivem Flag.
- Custom-Code möglichst lazy laden. Vorhandene globale Auth-/Feature-Provider nicht umbauen.
- CSS nur an Hirn-Root binden. Keine globalen shadcn-Tokens oder Font-Overrides.
- Neue Texte als `brain`-Namespace in eigenen Locale-Dateien; bevorzugt lokaler NextIntlClientProvider um neue Controls. Bestehende Messages nicht überschreiben. Vererbung, Fallback und SSR anhand installierter next-intl-Version im Integrations-PR nachweisen; jede der zehn unterstützten Locales abdecken.
- Falls ein zentraler i18n-Hook zwingend nötig wird: nur eigener Namespace bei aktivem Flag ergänzen, registrieren und testen. Keine Kommentare in JSON schreiben; Markierungen gehören in TS/TSX oder das Hook-Verzeichnis.

## Hook-Verzeichnis — verbindliche Quelle

Das aktuelle, verbindliche Verzeichnis steht in [CUSTOM.md](../../CUSTOM.md), Abschnitt
„Optional brain layout (step 2)“. Nur dort Marker und Dateizuordnung pflegen; diese
Revision führt keine zweite Liste mit geplanten oder veralteten Markernamen.

Stand PR #4 nach Review: `constellation.tsx` enthält drei kleine Hook-Paare für
Importe, den optionalen Vertrag und den flag-gesteuerten Dispatch. Die gesamte
Brain-Canvas-Lebensdauer einschließlich eigener Toolbar, sicherer Hover-Texte,
SVG-Export, Maus/Wheel-Ereignissen und Resize/Fullscreen liegt in `src/custom/brain/`.
Der Netzwerk-Komponentenrumpf entspricht weiterhin upstream. Keine Renderer-Kopie.
Alle Marker in `src/` müssen mit `brain-` beginnen, paarig und eindeutig sein;
`tests/custom/brain/hooks.test.ts` prüft beide Richtungen des Registers rekursiv.

Tatsächliche Dateinamen weichen teilweise von den Planungsnamen ab:
- `integration.tsx` bündelt lokale Controls und Provider statt separater `controls.tsx` / `provider.tsx`.
- `legend.tsx` enthält die responsive Datenlegende.
- `canvas.tsx`, `controller.ts` und `scene.ts` kapseln den Canvas-Host, die bereits vorhandene
  Interaktion und die Vorbereitung des bestehenden Brain-Zeichenvertrags.
- Tests liegen in `hindsight-control-plane/tests/custom/brain/`, nicht mehr in `src/custom/brain/__tests__/`.

Multi-group-Euler-Ansichten mit `nodeGroupsFn` bleiben beim upstream Renderer und
blenden den Layout-Umschalter aus. Dies ist ein bewusster Fallback, kein Hirnmodus.
Keine Hooks in Locale-Dateien, i18n-Loader, HomeView, Entities, Auth oder CSP.

## Umsetzung als getrennte PRs
1. **Geometrie/Layout + Tests:** ausschließlich reine Module, Fixtures und Tests in src/custom/brain/. Keine UI-Änderung, keine Hooks und keine Aktivierung. Prüfen: 0/1/20/200/500 Knoten, endliche Werte, stabile IDs, Konturgrenzen, Kollisionen und fehlende Gruppen. Abnahme: reproduzierbare Positionen und schlüssige Hirnform; noch kein sichtbares Feature.
2. **Optionale Renderer-Integration:** Flag, Adapter, markierte Hooks, lokale Controls/i18n/Styles, gemeinsame Canvas-/SVG-Geometrie, Auswahl/Details und zugänglicher Moduswechsel. Netzwerklayout und Entities unverändert. Keine vollständige Kopie oder allgemeine Refaktorierung der Constellation.
3. **Interaktion und Belastbarkeit:** Touch/Pan/Zoom, Resize/Fullscreen, reduced-motion, RAF-Cleanup, bankgebundene Daten-/Auswahlresets und veraltete Antwortbehandlung. Änderungen nur Hirnpfad; allgemeine upstream Bugs separat beheben.
4. **Visuelle Abnahme / optional Home:** Bildschirmvergleich, Performance auf Desktop und Android, danach optional eigener Home-Hook. Keine automatische Aktivierung oder Veröffentlichung.

## Limits, Tests und Abnahmekriterien
Hirnansicht zunächst positives API-Limit (z. B. 500 Knoten), maximal ca. 5.000 gleichzeitig sichtbare Kanten; Home weiterhin 200. Nur im Hirnmodus anwenden. Renderbegrenzung spart keine Downloadgröße: Aufruflimit und sichtbare Teilmenge getrennt anzeigen. Kanten deterministisch nach Typ/Gewicht auswählen; ausgewählte Nachbarn priorisieren und abgeschnittene Mengen kennzeichnen.

Geometrie, Adjazenz und Textvorbereitung memoisiert; kein O(N²)-Layout, keine React-State-Updates pro Frame. DPR im Hirnmodus zunächst maximal 2. Bei Pause/unsichtbarem Tab keine permanente Ambient-Schleife; Interaktionen zeichnen weiterhin. Ziel, nicht bereits gemessen: ca. 60 FPS Desktop und mindestens 30 FPS repräsentatives Android bei obiger Last.

Prüfmatrix ab Integration:
- Flag **aus** gegen upstream: gleiche DOM-Controls, Requests/Filter/Limits, Auswahl, Netzwerkexport; keine Custom-Animation, Styles oder Storage-Schreibzugriffe.
- Flag **an**, Modus Netzwerk: gleiche Semantik; nur erlaubter Umschalter zusätzlich.
- Flag **an**, Modus Hirn: echte IDs, Filter, Kanten, Klickdetails, stabile Positionen, SVG, Tastatur und Touch.
- Bank-/Filterwechsel mit verspäteten Antworten, leere/kleine Graphen, viele Scopes, ungültige Kanten, reduzierte Bewegung und kleine Viewports.
- Externer Zugangs-Proxy und zusätzlicher CP-Login bleiben unverändert. Spätere autorisierte Staging-Prüfung beider Schutzschichten; niemals produktive Zugangskontrollen für Tests abschalten.
- Reine Layouttests zuerst; später Komponententests und Browserprüfung. Bankgebundenen Graphvertrag zusätzlich über bestehende Blackbox-Suite mit lokalen Testbanken/Stubs abdecken. Keine produktiven Retain-Testdaten.

Vor Code-Push/PR: Repo-Code-Review, lint.sh, check-unused.sh, Typecheck, relevante Vitest-Tests und Build; ab Integration beide Flag-Builds plus relevante Blackbox-Prüfung. Konkrete Befehle gegen vorhandene Toolchain prüfen. Geräte/Browser/Mengen/Messungen und tatsächlich ausgeführte Checks dokumentieren; nichts Unausgeführtes als bestanden melden.

## Upstream-Sync-Checkliste
Upstream: vectorize-io/hindsight. Ausschließlich Topic-Branch, z. B. chore/upstream-sync-YYYY-MM-DD; niemals direkt main bearbeiten.
1. Sauberen Ausgangsstand und letzten Custom-Commit festhalten. **Vor** dem Merge Hook-Liste und Diff sichern; ein nachträgliches rg kann bereits verlorene Marker nicht finden.
2. git fetch upstream; upstream/main mergen oder rebasen. Bei bereits gepushtem Branch Merge bevorzugen; niemals Force-Push.
3. Konflikte in Hotspots anhand upstream-Fassung auflösen, danach registrierte Hooks gezielt erneut einsetzen. Nicht pauschal ganze Dateien überschreiben und dadurch andere lokale Änderungen verlieren.
4. `rg -n "CUSTOM-HOOK" hindsight-control-plane/src` mit Register und gesichertem Vorher-Diff vergleichen; Paarigkeit, JSON-Ausnahmen und fehlende neue Callsite-Verträge prüfen.
5. Custom-Code an geänderte upstream Typen/Props anpassen; möglichst nur Adapter/Custom-Module ändern.
6. Lint, Typecheck, Tests und Build sowie die Verhaltensmatrix mit Flag aus/an ausführen. Nur ausgeführte Ergebnisse berichten.
7. PR eröffnen; kein Deploy. Rückfall: Flag deaktivieren und entsprechend neu bauen; Custom-Hooks bleiben funktionslos.

## Spätere Roadmap – noch nicht beauftragt
Jeder Punkt erhält vor Implementierung einen eigenen Plan:
- `neon-theme.md`: eigene Theme-Override-Schicht nach globals.css, mit Farben, Fonts und shadcn-Tokens; Brain-CSS heute nur lokal.
- `soul-personality-view.md`: Datenquelle, erlaubte Bearbeitung und UI der Persönlichkeit klären.
- `projects-view.md`: Projektmodell, Bank-/Tag-Zuordnung und Zugriffskonzept klären.

Diese drei Funktionen gehören weder zum Dokumentations-PR #1 noch zum ersten Geometrie-PR.

## Historischer Review- und Prüfstatus des Planungs-PR #1
Die sechs Amendment-Bereiche wurden gegen den Originalplan abgeglichen; i18n-/Feature-Einstiege und der referenzierte Hindsight-Styleguide wurden gelesen. Der damalige Planungs-PR änderte ausschließlich Dokumentation; dort wurden keine App-Tests, Builds, Performance- oder Live-Login-Tests ausgeführt. Tatsächlich ausgeführte Implementierungsprüfungen stehen im jeweiligen Code-PR, für Schritt 2 in PR #4.

Beim ursprünglichen PR-Head 97a4fcf7 scheiterte GitHub Actions bereits im Job detect-changes an actions/checkout: Repository not found. Das Job-Token zeigte nur Metadata/PullRequests read, kein Contents read; daher ist die fehlende Leseberechtigung im privaten Mirror die naheliegende Ursache. 98 weitere Checks wurden übersprungen, nicht bestanden. Workflow-Berechtigungen vor dem ersten Code-PR prüfen und minimal korrigieren; keine CI-Prüfung deaktivieren oder einen grünen Status behaupten.
