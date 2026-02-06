# 🚀 Döviz Uygulaması - Deploy Rehberi

## Vercel ile Ücretsiz Yayınlama

### Adım 1: GitHub'a Yükleme

1. **GitHub'da yeni bir repository oluşturun:**
   - https://github.com/new adresine gidin
   - Repository adı: `doviz` (veya istediğiniz bir isim)
   - Public veya Private seçin
   - "Create repository" butonuna tıklayın

2. **Projeyi GitHub'a push edin:**

```bash
# Git repository başlat (zaten yapıldıysa atlayın)
git init

# Tüm dosyaları ekle
git add .

# İlk commit
git commit -m "Initial commit"

# GitHub repository'nizi ekleyin (YOUR_USERNAME yerine GitHub kullanıcı adınızı yazın)
git remote add origin https://github.com/YOUR_USERNAME/doviz.git

# Ana branch'i main olarak ayarlayın
git branch -M main

# GitHub'a push edin
git push -u origin main
```

### Adım 2: Vercel'e Deploy Etme

1. **Vercel hesabı oluşturun:**
   - https://vercel.com adresine gidin
   - "Sign Up" butonuna tıklayın
   - GitHub hesabınızla giriş yapın (en kolay yol)

2. **Yeni proje oluşturun:**
   - Vercel dashboard'da "Add New..." → "Project" seçin
   - GitHub repository'nizi seçin (`doviz`)
   - Vercel otomatik olarak Vite projesini algılayacak
   - **Framework Preset:** Vite
   - **Root Directory:** `./` (varsayılan)
   - **Build Command:** `npm run build` (otomatik algılanır)
   - **Output Directory:** `dist` (otomatik algılanır)
   - "Deploy" butonuna tıklayın

3. **İlk deploy tamamlanana kadar bekleyin** (1-2 dakika)

### Adım 3: Custom Domain Ekleme (doviz.onderyilmaz.com)

1. **Vercel Dashboard'da:**
   - Projenize gidin
   - "Settings" → "Domains" sekmesine gidin
   - "Add Domain" butonuna tıklayın
   - `doviz.onderyilmaz.com` yazın
   - "Add" butonuna tıklayın

2. **DNS Ayarları:**
   Vercel size DNS kayıtlarını gösterecek. Domain sağlayıcınızda (örneğin Namecheap, GoDaddy, vb.) şu kaydı ekleyin:

   **CNAME Kaydı:**
   - **Type:** CNAME
   - **Name:** `doviz` (veya `@` eğer ana domain ise)
   - **Value:** `cname.vercel-dns.com`
   - **TTL:** 3600 (veya varsayılan)

   **VEYA A Kaydı (eğer CNAME çalışmazsa):**
   - **Type:** A
   - **Name:** `doviz`
   - **Value:** Vercel'in verdiği IP adresleri (genelde 76.76.21.21 gibi)

3. **SSL Sertifikası:**
   - Vercel otomatik olarak SSL sertifikası sağlar (Let's Encrypt)
   - DNS kayıtları aktif olduktan sonra 24 saat içinde otomatik olarak aktif olur
   - "Force HTTPS" seçeneğini açık tutun

### Alternatif: Netlify ile Deploy

Eğer Vercel yerine Netlify kullanmak isterseniz:

1. https://netlify.com adresine gidin
2. GitHub ile giriş yapın
3. "Add new site" → "Import an existing project"
4. GitHub repository'nizi seçin
5. Build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
6. "Deploy site" butonuna tıklayın
7. Custom domain eklemek için: Site settings → Domain management → Add custom domain

### Alternatif: Cloudflare Pages ile Deploy

1. https://pages.cloudflare.com adresine gidin
2. GitHub ile giriş yapın
3. Repository'nizi seçin
4. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
5. "Save and Deploy" butonuna tıklayın
6. Custom domain için: Pages → Your project → Custom domains

## ✅ Kontrol Listesi

- [ ] GitHub repository oluşturuldu
- [ ] Kod GitHub'a push edildi
- [ ] Vercel hesabı oluşturuldu
- [ ] Proje Vercel'e deploy edildi
- [ ] Domain DNS ayarları yapıldı
- [ ] SSL sertifikası aktif (otomatik)
- [ ] Site https://doviz.onderyilmaz.com adresinde çalışıyor

## 🔧 Sorun Giderme

**Build hatası alıyorsanız:**
- `npm run build` komutunu lokal olarak çalıştırıp hataları kontrol edin
- `package.json` dosyasında build script'in doğru olduğundan emin olun

**Domain çalışmıyorsa:**
- DNS kayıtlarının aktif olması için 24-48 saat bekleyin
- DNS propagation kontrolü için: https://dnschecker.org
- Vercel dashboard'da domain durumunu kontrol edin

**API istekleri çalışmıyorsa:**
- CORS sorunları olabilir, Frankfurter API'nin CORS ayarlarını kontrol edin
- Gerekirse Vercel'de environment variables ekleyin

## 📝 Notlar

- Vercel ücretsiz planında:
  - Sınırsız deploy
  - 100GB bandwidth/ay
  - Otomatik SSL
  - Custom domain desteği
  - Preview deployments (her PR için)

- Her GitHub push'unda otomatik deploy yapılır
- Production ve preview URL'leri otomatik oluşturulur
