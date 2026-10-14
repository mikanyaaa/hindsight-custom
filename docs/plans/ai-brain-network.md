# AI-Brain-Netzwerk – Implementierungsplan

Stand: 15.10.2026. Geprüfte Codebasis: privates Entwicklungs-Repository, `main`, Commit `f1c911e53b9b708ee89fc0672b3a8ea73a413fcc`.
Status: **Plan, noch nicht implementiert**.

## Ziel und Umfang
Die bestehende Memory-Visualisierung erhält einen optionalen Hirnmodus nach dem im Chat abgestimmten „Prism / Neural“-Mockup: erkennbare Gehirnsilhouette, feine Punkte und Linien, dunkler Hintergrund, zurückhaltende violette/cyanfarbene Akzente. Leichter Anime-Einfluss nur an kleinen Toolbar-Icons; keine große Figur.

Nur das Netzwerk und unmittelbar nötige Bedienelemente umsetzen. Kein komplettes Dashboard-Redesign, keine Lyra-Integration, keine Änderung von Retain/Recall/Reflect, keine Migration und kein Deployment. Mockup-Texte, Zahlen und Projekt-Lyra-Beispiele sind keine Hindsight-Anforderungen oder Echtdaten.

## Geprüfter Ist-Zustand

| Bereich | Befund / Einstieg |
|---|---|
| Regeln | Root `AGENTS.md` verweist auf `CLAUDE.md`. Vor späterer Codearbeit außerdem `.claude/skills/code-review/SKILL.md` und relevante lokale Next.js-Dokumentation gemäß `hindsight-control-plane/AGENTS.md` lesen. |
| Frontend | `hindsight-control-plane/package.json`: Next.js 16, React 19, TypeScript, Tailwind, next-intl, lucide-react, Vitest/Testing Library. Keine Three.js-/Force-Graph-Abhängigkeit gelistet. |
| Renderer | `src/components/constellation.tsx`: eigener Canvas-2D-Renderer, Pretext-Labels, requestAnimationFrame, Pan/Zoom, Hover/Klick, Fullscreen, Pause und SVG-Export. Positionen werden aus ID-Hashes, Indizes und Gruppen berechnet; **keine physikalische Force-Simulation**. |
| Datenmodell | `src/components/graph-data.ts`: GraphNode/GraphLink/GraphData und API-Konverter. Der alte Cytoscape-Renderer wurde entfernt; die API liefert weiterhin Cytoscape-artig geschachtelte Daten. |
| Hauptansicht | `src/components/data-view.tsx`: lädt getGraph mit Bank, Faktentyp, Suche, Tags/Match-Modus, Dokument und Chunk; bindet Constellation und Memory-Details ein. Linkfilter: semantic/temporal/entity/causal. Observations haben Quellfakten-Größe, Aktualitätsfarbe und optional Scope-Gruppen. |
| Startseite | `src/components/home-view.tsx`: eigener Adapter, Graph asynchron geladen, 200-Knoten-Cap. Kommentar warnt vor ca. 67.000 Kanten / 22 MB bei ca. 1.000 Knoten; das ist ein Codehinweis, kein hier gemessener Benchmark. |
| Datenweg | `src/lib/api.ts#getGraph` → `src/app/api/graph/route.ts` → `GET /v1/default/banks/{bank_id}/graph` in `hindsight-api-slim/hindsight_api/api/http.py` (ab Zeile 5776). Backend-Standardlimit 1.000, erlaubt auch 0; Client serialisiert limit aktuell nur bei truthy Wert. Für das MVP explizite positive Limits verwenden. |
| Isolation | Proxy leitet Filter und serverseitige Dataplane-Headers weiter; explizites tags_match bleibt erhalten, bei Tags sonst all_strict. Bank-/Tag-Isolation nicht durch clientseitiges Zusammenführen umgehen. |
| Weitere Nutzer | Constellation ist geteilt (u. a. Entities); zusätzlich existiert eine eigene Website-Version unter `hindsight-docs/src/components/constellation/`. Diese nicht versehentlich mit ändern. |

Pfade ohne Präfix in der Tabelle sind relativ zu `hindsight-control-plane/`. Die Analyse war eine gezielte statische Codeprüfung; App und Performance wurden nicht ausgeführt.

## Architekturentscheidung
**Canvas 2D weiterverwenden; Hirn als zusätzlicher Layout-/Darstellungsmodus.**
Ein fest projiziertes 2,5D-Hirn reicht für das gewünschte Erscheinungsbild. Räumliche Tiefe entsteht durch projizierte Positionen, Helligkeit und dezente Größenvariation. Keine neue WebGL-Bibliothek und keine 3D-Rotation im MVP. Der bisherige Modus bleibt als Rückfalloption erhalten.

Vorgeschlagene neue Dateien unter `hindsight-control-plane/src/`:
- `lib/brain-geometry.ts`: normalisierte Gehirnkontur, Hemisphären, wenige Furchenkurven und Projektionshelfer.
- `lib/brain-layout.ts`: reine, deterministische Zuordnung von Memory-IDs zu Hirnpositionen.
- `lib/brain-render-model.ts`: gemeinsame sichtbare Knoten/Kanten und Zeichenparameter für Canvas und SVG.
- Zugehörige Tests unter `tests/`.

`ConstellationProps` um `layoutMode: "constellation" | "brain"` erweitern (Default bisheriges Verhalten). Keine vollständige Kopie der großen Komponente; Positionsberechnung gezielt auslagern. Explizite interne Typen statt neuer any-Felder.

## Darstellung und Layout
1. Gehirnkontur in leichter Dreiviertelansicht als eigene normalisierte Vektor-/Kurvendaten anlegen: zwei Hemisphären, erkennbare Trennfurche, dezente Furchen und unterer Abschluss. Keine bloßen zwei Ellipsen und keine generierte Bitmap als klickbare Graphfläche.
2. Stabile Position je ID durch gesäten Hash mit festen Geometrie-Slots beziehungsweise deterministischem Sampling innerhalb der Kontur. Kein Arrayindex oder aktuelle Knotenanzahl als Positionsbasis. Filtern/Sortieren verändert vorhandene Positionen nicht.
3. Regionale Zuordnung optional aus vorhandenen Faktentypen/Scopes; keine LLM-Klassifikation. Viele Scopes über deterministische Unterbereiche verteilen. Die Regionen haben **keine biologische Bedeutung**.
4. Memory-Punkte überwiegend ca. 1–2 CSS-Pixel Radius, hervorgehobene ca. 3–4; Linien ca. 0,35–0,65 CSS-Pixel bei niedriger Deckkraft. Startwerte visuell kalibrieren; HiDPI berücksichtigen. Unsichtbare Hit-Flächen deutlich größer, Touch etwa 24 CSS-Pixel.
5. Lesbare Labels nur für Auswahl, Hover und wenige priorisierte Knoten. Vorhandene Größen-/Farbsemantik und Legenden bewahren: Aktualität ist nicht Scope oder Verbindungsstärke. Keine erfundene „Aktivität“ aus statischen Daten.
6. Bei wenigen Memories optionale sehr schwache Kontur/Furchen als **dekorative Hintergrundebene**. Sie enthält keine Graph-IDs, keine Trefferflächen und keine gezählten Erinnerungen. Bei leerer Bank klarer Leerzustand statt gefülltem Fake-Hirn.
7. Kanten verbinden ausschließlich reale zurückgelieferte IDs. Eine Kurve darf die Geometrie unterstützen, aber keine zusätzliche Beziehung suggerieren. Selbstkanten, fehlende Endpunkte und parallele Typen explizit behandeln; Kantenrichtung/Metadaten bewahren.
8. Anime-Akzent auf kleine originale kristallartige SVG-Icons oder behutsam gestaltete vorhandene Icons beschränken; keine externen Icon-Downloads zur Laufzeit.

## Einbindung und Verhalten
- Zuerst in der Memories-Ansicht Umschalter „Netzwerk / Hirn“ anbieten. Nur Layout-Präferenz lokal speichern, keine Memory-Inhalte. Auswahl über denselben ID-basierten Detailpfad öffnen.
- Bestehende Filter bleiben wirksam. Scope-Gruppierung im Hirnmodus erhält definierte Regionen statt der bisherigen weit auseinanderliegenden Clusterkreise. Venn-/Mehrfachgruppen-Ansichten zunächst im bisherigen Modus belassen.
- Nach Abnahme HomeView optional ebenfalls umstellen; dessen 200-Knoten-Cap erhalten. Entities und Docs-Website behalten zunächst ihr bisheriges Layout.
- Resize/Fit-to-view anhand der Hirn-Bounds, einschließlich kleiner Displays und Fullscreen. Pointer Events für Maus/Touch, Pinch-Zoom und eindeutige Trennung zwischen Drag und Tap ergänzen.
- Tastaturbedienbarer Umschalter und Zoom/Reset; bestehende Tabellenansicht als zugängliche Alternative. Neue Texte in allen vorhandenen `src/messages/*.json` berücksichtigen.
- Animation nur als minimale, begrenzte Bewegung, welche die Hirnform nicht auflöst. prefers-reduced-motion respektieren; bei Pause/unsichtbarem Tab keine permanente Ambient-Animationsschleife. Interaktionen müssen trotzdem neu zeichnen.
- Beim Bankwechsel alte Geometrie, Auswahl und Daten sofort verwerfen; verspätete Antworten dürfen die neue Bank nicht überschreiben. Filterwechsel entsprechend absichern.

## Performance und Datenintegrität
- MVP mit begrenztem Datensatz starten (Home 200, Hirn-Explorer zunächst z. B. 500); vorhandene Grenzen und Anzeige „angezeigt / geladen“ sichtbar halten. Ein Render-Limit spart keine Netzwerkdaten: deshalb positives API-Limit bereits beim Laden setzen.
- Kantenindizes/Adjazenz einmal erstellen, Geometrie und Texte memoisiert vorbereiten; keine Datenkonvertierung oder React-State-Updates pro Animationsframe.
- Sichtbare Kanten bei hoher Dichte deterministisch begrenzen, nach Typ ausgewogen und bevorzugt mit hohem Gewicht. Gekürzte Darstellung kennzeichnen; bei Knotenauswahl seine geladenen Nachbarn priorisieren. Keine Vollständigkeit über die geladene Teilmenge behaupten.
- Canvas-DPR zunächst auf 2 begrenzen, Offscreen-Culling und statische Hintergrundebene verwenden. Keine neue O(N²)-Relaxation.
- Zielwerte (zu messen): flüssige Interaktion bei 500 Knoten/5.000 sichtbaren Kanten, ca. 60 FPS Desktop / mindestens 30 FPS repräsentatives Android; Testgeräte, Browser, Datenmenge und Messwerte protokollieren. Bei Nichterreichen zuerst Dichte/DPR/Animation reduzieren.
- SVG-Export aus demselben Render-Modell erzeugen: Gehirnpositionen, Filter, Farben und dekorative Ebene müssen dem sichtbaren Modus entsprechen. Memory-Texte sicher escapen; keine neuen innerHTML-Pfade.
- Kein neuer Backend-Endpunkt nötig. Ein späteres serverseitiges Edge-Budget nur separat planen, falls Messungen den Bedarf belegen; dann Proxy, API-Typen, OpenAPI und generierte SDKs gemäß Repo-Regeln gemeinsam aktualisieren.

## Umsetzung in vier überprüfbaren Schritten
1. **Layout-Grundlage:** Geometrie und reine Layoutfunktionen; Fixtures mit 0/1/20/200/500 Knoten. Abnahme: Hirnform bereits ohne Farben erkennbar, Positionen deterministisch, keine fiktiven Memories.
2. **Renderer:** optionaler Modus, feine Zeichenparameter, gemeinsame Canvas-/SVG-Geometrie, Auswahl/Hover, Bounds und Pause. Bestehende Constellation bleibt standardmäßig unverändert.
3. **Integration:** DataView-Umschalter, i18n, Filter-/Scope-Verhalten, Bankwechsel, Touch und zugängliche Alternative; anschließend optional HomeView.
4. **Qualität:** Performanceprofil, reduzierte Bewegung, Desktop-/Mobil-Screenshots und Vergleich mit Mockup. Erst danach Hirnmodus als bevorzugte Ansicht erwägen.

## Prüfungen und Abnahme
- Vitest: stabile Positionen trotz anderer Reihenfolge/Filter, keine NaN-/Out-of-bounds-Werte, kleine/leere Graphen, unbekannte Typen, Kantenendpunkte, begrenzte Daten, Auswahl-/Export-Konsistenz.
- Komponententests: Moduswechsel, unveränderte Filterweitergabe, Klick-ID, Bankwechsel ohne alte Daten, reduzierte Bewegung und Cleanup von Listenern/RAF.
- Browserprüfung mit lokalen Fixtures: Hover, Drag, Touch, Zoom, Fullscreen, schmale Ansicht, SVG und korrekte Memory-Details. Kein Test-Retain in der produktiven Bank.
- Repo-Anforderung für benennbare neue Fähigkeiten beachten: bestehende Blackbox-Story `hindsight-system-tests/tests/test_70_entities_and_graph.py` um eine SDK-basierte Memory-Graph-Story mit isolierten Testbanken/Filtern ergänzen; diese prüft Daten, **nicht** das Canvas. Die visuelle Abnahme braucht separat den Browser.
- Spätere Codeänderungen: `./scripts/hooks/lint.sh`, `./scripts/hooks/check-unused.sh`, Control-Plane `npm test`, Build und relevante Blackbox-Story ausführen; verpflichtendes `/code-review` vor Code-Push/PR. Veraltete dokumentierte Kommandos gegen die installierte Toolchain prüfen.
- Fertig, wenn Gehirnform mit feinen Linien sichtbar ist, echte Daten/Filter/Details erhalten bleiben, keine Bankvermischung erfolgt und Performance/Export/Touch geprüft sind.

## Offene Punkte für die Umsetzung
Kein Blocker für den Plan: exakte Kontur und Punktdichte am ersten lokalen Prototyp abstimmen; Performanceziele auf tatsächlichen Geräten verifizieren. Echte freie 3D-Rotation, komplettes Prism-Dashboard und umfassendes Anime-Iconset sind spätere, getrennte Ausbaustufen.
