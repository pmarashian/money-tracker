# iOS Setup and Plugin Sync

## Important: After Adding/Updating Capacitor Plugins

When you add or update Capacitor plugins (like `@capacitor/preferences`), you **must** sync them to the iOS project and rebuild:

### Steps

1. **Build the web app:**
   ```bash
   npm run build
   ```

2. **Sync plugins to iOS:**
   ```bash
   npx cap sync
   ```
   
   This command:
   - Copies the built web app to iOS
   - Updates Swift Package Manager dependencies
   - Registers new plugins

3. **Rebuild in Xcode:**
   ```bash
   npm run cap:open:ios
   ```
   
   Then in Xcode:
   - Clean build folder (Product → Clean Build Folder, or Cmd+Shift+K)
   - Build and run (Product → Run, or Cmd+R)

### Why This Matters

The `@capacitor/preferences` plugin is required for auth tokens to persist across iOS app force-close. Without proper sync:

- Plugin may return "UNIMPLEMENTED" errors
- App falls back to localStorage (which doesn't persist on iOS)
- Users must re-login after force-closing the app

### Troubleshooting

If you see logs like:
```
[AuthStorage] Preferences plugin not available, falling back to localStorage
```

This indicates the Preferences plugin isn't properly synced. Follow the steps above to fix.

### Quick Sync Command

The `cap:sync` script combines build and sync:
```bash
npm run cap:sync
```
