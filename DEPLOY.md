# Objava stranice — upute

Statična stranica (HTML/CSS/JS, bez servera). Potrebno je: (1) backend za RSVP u Google tablici, (2) hosting, (3) domena.

## 1. RSVP → Google tablica (Google Apps Script)

1. Otvori (ili napravi) Google tablicu u koju želiš odgovore. Preporuka: nova tablica samo za to.
2. U tablici: **Extensions → Apps Script**. Obriši sadržaj `Code.gs` i zalijepi `rsvp/Code.gs` iz ovog repozitorija. Spremi.
3. **Project Settings (zupčanik) → Script properties → Add script property**:
   - `RSVP_TOKEN` = dugačak nasumičan niz (npr. iz `openssl rand -hex 24`). Isti niz ide u `script.js`.
   - `NOTIFY_EMAIL` = adresa (ili više, odvojene zarezom) na koju stiže mail za svaki odgovor. Neobavezno.
4. **Deploy → New deployment → Select type: Web app**
   - Description: `rsvp`
   - Execute as: **Me**
   - Who has access: **Anyone**  (bez toga gosti bez Google računa ne mogu slati)
   - Deploy → odobri dozvole (skripta piše u tablicu i šalje mail u tvoje ime) → kopiraj **Web app URL** (završava na `/exec`).
5. Test: otvori taj URL u pregledniku → mora vratiti `{"ok":true,"service":"rsvp"}`.
6. Lokalno: kopiraj `config.example.js` u `config.js` i upiši URL i token (datoteka je u `.gitignore`). Na GitHubu: Settings → Secrets and variables → Actions → **Secrets**: `RSVP_TOKEN`; **Variables**: `RSVP_ENDPOINT`. Workflow `.github/workflows/pages.yml` iz toga generira `config.js` pri svakoj objavi.
7. Pošalji probni odgovor sa stranice: u tablici se pojavljuje list **Odgovori** s retkom. Obriši probne retke prije slanja pozivnica.

Napomene:
- Svaka promjena `Code.gs` traži **Deploy → Manage deployments → Edit → Version: New version → Deploy**, inače i dalje radi stara verzija. URL ostaje isti.
- Apps Script besplatno dopušta ~20 000 poziva dnevno i 100 mailova dnevno — više nego dovoljno.
- Tablica je dostupna samo tvojem Google računu; stranica ne može čitati odgovore, samo dodavati.

## 2. Hosting (GitHub Pages)

Repozitorij je već inicijaliziran. Objava:

```
gh repo create ivona-i-ivan --private --source=. --push      # privatni repo je OK, Pages može biti javan
gh api -X POST repos/{owner}/ivona-i-ivan/pages -f build_type=workflow   # ili: Settings → Pages → Deploy from branch → main / (root)
```

Jednostavnije ručno: Settings → Pages → Source: *Deploy from a branch* → `main` / `/ (root)` → Save. Stranica je za ~1 min na `https://<korisnik>.github.io/ivona-i-ivan/`.

Alternative s istim rezultatom: Netlify ili Cloudflare Pages (povuci-i-ispusti mapu, besplatno, automatski HTTPS). Cloudflare Pages je najbrži za goste izvan Europe.

## 3. Domena (neobavezno, ali ljepše)

- Kupi domenu (npr. `ivonaiivan.com` ~15 €/god ili `.hr` preko hrvatskog registrara). Na GitHub Pages: Settings → Pages → Custom domain → upiši domenu; kod registrara dodaj `CNAME` zapis `www → <korisnik>.github.io` i `A` zapise za apex (185.199.108.153 … .111.153). Uključi **Enforce HTTPS**.
- Nakon toga u `index.html` zamijeni `https://EXAMPLE.invalid/...` u `og:image` pravom adresom — WhatsApp/iMessage tada pokazuju sliku kad podijelite link.

## 4. Prije slanja pozivnica — kontrolna lista

- [ ] RSVP probni odgovor stigao u tablicu i (ako je uključeno) mailom.
- [ ] `og:image` apsolutan URL; podijeli link sam sebi na WhatsApp i provjeri pregled.
- [ ] Otvori stranicu na iPhoneu (Safari) i Androidu: video se vrti, Durinova vrata se otvaraju, obrazac radi.
- [ ] Obriši probne retke iz tablice.
- [ ] Rok 19. 3. 2027.: obrazac se tada sam zatvara (`RSVP_DEADLINE` u `script.js`).
- [ ] Brojevi telefona u podnožju: svjesno javno na stranici koju imaju samo gosti (stranica ima `noindex`, tražilice je ne indeksiraju).
