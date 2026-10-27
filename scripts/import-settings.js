const fs = require('node:fs/promises');
const path = require('node:path');
const { SettingsStore, validate } = require('../server/settingsCtrl');
async function main() {
  const source = process.argv[2];
  if (!source) throw new Error('Provide the path to the exported settings JSON.');
  const target = process.env.SETTINGS_FILE || path.join(__dirname, '../settings.json');
  const settings = validate(JSON.parse(await fs.readFile(source, 'utf8')));
  const store = new SettingsStore(target);
  await store.update(settings, 'create'); // Fails if destination exists, including malformed files.
  if (process.env.IMPORT_UID !== undefined) {
    const uid = Number(process.env.IMPORT_UID);
    if (!Number.isSafeInteger(uid) || uid < 0) throw new Error('Invalid import owner.');
    await fs.chown(target, uid, uid);
  }
  console.log('Settings imported. Existing settings were not overwritten.');
}
main().catch(() => { console.error('Import failed. Check the source JSON, destination, and permissions; no key values are printed.'); process.exitCode = 1; });
