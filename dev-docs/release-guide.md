# Release guide

##Release Steps##
Checkpoints

- Prepare release notes and update that on CHANGELOG.md file

## Build and packaging section

From package.json, document:

```
npm run build
npm run build:prod
npm run build:mac
```

packaged output goes to dist-mac
generated bundle output is under dist
Contributors should edit source under src, not generated output

### Secure macOS signing / notarization

Do not store signing or notarization credentials in repository files.
Provide them through environment variables in your shell or CI environment before building.

Required environment variables:

- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`
- `CSC_LINK`
- `CSC_KEY_PASSWORD`

Example local shell setup:

```sh
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="YOURTEAMID"
export CSC_LINK="file:///absolute/path/to/certificate.p12"
export CSC_KEY_PASSWORD="certificate-password"
```

Build the signed macOS app:

```sh
./package-mac-signed.sh
```

After packaging, staple and validate the generated DMG:

```sh
xcrun stapler staple "dist-mac/melvec-0.0.1-arm64.dmg"
xcrun stapler validate "dist-mac/melvec-0.0.1-arm64.dmg"
```
