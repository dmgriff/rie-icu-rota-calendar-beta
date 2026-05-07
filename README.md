# RIE ICU rota calendar

A static GitHub Pages site for downloading personal all-day calendar events from ICU consultant rota data.

## User page

https://dmgriff.github.io/rie-icu-rota-calendar/

Users select:

1. Rota period, for example `August - November 2026`
2. Name
3. Check the shift preview and highlighted rota
4. Tick the confirmation box
5. Download the `.ics` file

The `.ics` file is generated in the browser. Each duty is exported as a separate all-day event.

## Rota writer page

https://dmgriff.github.io/rie-icu-rota-calendar/admin.html

This page converts one Word `.docx` rota into one independent data file. It does not merge with existing rotas.

## Adding a new rota period

Example: adding `December - March 2027`.

1. Open the rota writer page.
2. Upload the official Word rota `.docx`.
3. Download the generated rota data file, for example:
   `dec-mar-2026.js` or similar.
4. In GitHub, open the repository.
5. Open the `data/` folder.
6. Upload the generated `.js` file into `data/`.
7. Open `rota-index.js`.
8. Add the line shown by the rota writer page inside `window.ROTA_INDEX = [...]`.
9. Commit changes.

The new rota then appears in the public dropdown.

## Replacing a rota period

If a rota changes:

1. Open the rota writer page.
2. Upload the revised official Word rota.
3. Download the generated data file.
4. In GitHub, replace the existing file in `data/` with the new one.
5. Keep the same entry in `rota-index.js`.
6. Commit changes.

The public page will use the revised rota.

## Removing a rota period from the dropdown

1. Open `rota-index.js`.
2. Delete the corresponding line.
3. Commit changes.

The old data file can remain in `data/` as an archive, but it will no longer appear in the dropdown.

## Important limitations

This is an experimental helper. Users must check against the official rota. The official rota remains the source of truth.
