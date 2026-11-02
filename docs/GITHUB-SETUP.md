# Set up the official GitHub repository

**Suggested GitHub location:** `Halvar666/twp-for-pale-moon`

**Description:** `Unofficial native UXP port of TWP (Translate Web Pages) for Pale Moon — Google, Bing and experimental DeepL.`

**Visibility:** Public. **Default branch:** `main`.

## One-time GitHub creation

Use <https://github.com/new> and create a repository with the exact name `twp-for-pale-moon` under the `Halvar666` account. **Leave the "Add a README", `.gitignore`, and license auto-generation boxes unchecked** because the repository bundle already includes all those files. If you initialize it with a README, ask for a merge/update plan instead of force-pushing.

## Upload source with local Git

From the unzipped repository archive on Manjaro:

```sh
cd twp-for-pale-moon-repo
git init -b main
git add .
git commit -m "Initial public source: TWP for Pale Moon 1.0.0b1"
git remote add origin git@github.com:Halvar666/twp-for-pale-moon.git
git push -u origin main
```

This assumes a configured Git identity and SSH access to your GitHub account. If you use HTTPS instead of SSH, use `https://github.com/Halvar666/twp-for-pale-moon.git` as the remote. The ZIP contains source only; publish the XPI separately as a **GitHub Release asset** and give it tag `1.0.0b1` after reviewing the release notes.

Do **not** include the upstream `.github/funding.yml` or issue templates in this port's root `.github/`; they belong to the upstream project, not this maintainer. The original `src/` source tree is preserved unchanged.
