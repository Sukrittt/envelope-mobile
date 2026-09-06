// app.json stays the source of truth for everything; this only overrides
// android.googleServicesFile so EAS Build can supply it via the file-type
// env var GOOGLE_SERVICES_JSON — the actual file is gitignored (it's tied to
// the Firebase project) and EAS Build only uploads git-tracked files, so the
// build fails without this. Local dev still reads the file straight off disk.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? config.android.googleServicesFile,
  },
});
