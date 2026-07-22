# Kantin Kayıt & Borç Takip Sistemi — Kılavuz

Bu belge, kantin kayıt sisteminin nasıl çalıştığını, günlük olarak nasıl
kullanılacağını ve ayarlarının nereden değiştirileceğini açıklar.

---

## 1. Genel Bakış

Sistem, çalışanların kantinden aldıkları ürünleri (tost, çay, kahve...) kaydeder
ve borçlarını takip eder. Akış şöyledir:

```
Kâğıttaki QR kod  →  telefonda web formu açılır
                         ↓
        çalışan [ismini] + [aldığı ürünleri] seçer, Kaydet der
                         ↓
             kayıt Google E-Tablo'ya (Sheet) yazılır
                         ↓
   haftada belirli günler, borcu olanlara otomatik hatırlatma e-postası gider
                         ↓
        ödeme geldiğinde ilgili kişi "Ödendi" olarak işaretlenir
```

Sistem tamamen **Google E-Tablo + Google Apps Script** üzerinde çalışır; ayrı bir
sunucu, veritabanı, program veya ücret gerektirmez. Üç parçadan oluşur:

| Parça | Açıklama |
|-------|----------|
| **Google E-Tablo (Sheet)** | Verinin tutulduğu yer (çalışanlar, ürünler, kayıtlar). |
| **Apps Script (sunucu kodu — `Code.js`)** | Formu sunar, kaydı yazar, hatırlatma e-postalarını gönderir. |
| **Form (`Index.html`)** | Çalışanın telefonda gördüğü sayfa (isim + ürün seçimi). |

---

## 2. E-Tablo Yapısı (3 Sekme)

Sistem üç sekme kullanır. **Sekme adları ve sütun başlıkları değiştirilmemelidir**
(kod bunlara göre çalışır).

### Çalışanlar
| Ad Soyad | E-posta |
|----------|---------|
| Ahmet Yılmaz | ahmet@ornek.com |

- Çalışan listesi. Form, buradaki isimleri açılır menüde gösterir.
- **E-posta benzersiz ve dolu olmalıdır.** Boş olan kişiye hatırlatma
  gönderilemez; aynı e-posta iki kişide olursa kayıtları tek maile birleşir.

### Ürünler
| Ürün | Fiyat |
|------|-------|
| Tost | 45 |
| Çay | 10 |

- Ürün ve fiyat listesi. **Fiyat yalnızca sayı** olmalıdır (örn. `45`; "₺"
  yazılmaz). Fiyat değiştirildiğinde form otomatik güncellenir.

### Kayıtlar
| Zaman | Ad Soyad | E-posta | Ürün | Adet | Birim Fiyat | Tutar | Ödendi |
|-------|----------|---------|------|------|-------------|-------|--------|

- Her sipariş buraya yazılır — **her ürün için ayrı bir satır**.
- **Ödendi** sütunu bir onay kutusudur. İşaretli (TRUE) satırlar **ödenmiş**,
  boş (FALSE) satırlar **borç** sayılır. Hatırlatmalar yalnızca ödenmemiş
  satırları dikkate alır.

---

## 3. Günlük Kullanım

### Çalışan tarafı
Çalışan, kâğıttaki QR kodu telefonuyla okutur; açılan formda ismini ve aldığı
ürünleri seçip **Kaydet**'e basar. Kayıt anında E-Tabloya işlenir.

- **Misafir:** İsim listesinin en başında **MİSAFİR** seçeneği bulunur.
  Seçildiğinde bir "Misafir adı" kutusu açılır. Misafirin e-postası olmadığından
  ona hatırlatma gönderilmez; ödemesi geldiğinde ilgili satır `Kayıtlar`'dan elle
  "Ödendi" işaretlenir.

### Yönetim tarafı (Kantin menüsü)
E-Tablo açıkken üst menüde **"Kantin"** başlığı yer alır:

- **Bir kişinin borcunu ödendi yap:** Kişinin e-postası girilir; onay ekranında
  isim, satır sayısı ve toplam tutar gösterilir. Onaylandığında o kişinin tüm
  ödenmemiş satırları işaretlenir. (Onay kutularını tek tek işaretlemeye gerek
  kalmaz; dilenirse elle işaretleme de çalışmaya devam eder.)
- **E-posta tekrarlarını kontrol et:** Çalışan listesine toplu veri
  girildiğinde, tekrarlanan e-posta olup olmadığını denetler.

---

## 4. Önemli Ayarlar — Neyi Nereden Değiştirirsiniz

En sık gereken değişiklikler aşağıdadır. Kod tarafındaki değişiklikler için
Apps Script editöründe ilgili satır güncellenip **kaydedilir**.

| Değiştirmek istenen | Yer | Açıklama |
|---------------------|-----|----------|
| **Ürün / fiyat** | `Ürünler` sekmesi | Satır eklenir/çıkarılır, fiyat güncellenir. Yeniden yayına gerek yoktur. |
| **Çalışan ekleme/çıkarma** | `Çalışanlar` sekmesi | Ad Soyad + benzersiz E-posta girilir. Yeniden yayına gerek yoktur. |
| **Ödemenin yapılacağı kişi** (e-postada geçen isim) | `Code.js` → `PAYMENT_CONTACT` | Örn. `"Burcu Koçak'a"`. Türkçe ek dahil yazılır ("…'a / …'e"). |
| **Bekleme süresi** (borç kaç gün sonra hatırlatılsın) | `Code.js` → `REMINDER_GRACE_DAYS` | Örn. `3`. Alışverişi bu süreden yeni olan kişiye e-posta gitmez. |
| **Hatırlatma günü sayısı** | `Code.js` → `REMINDER_DAYS` | Çalışanların kaç iş gününe bölüneceği (Pazartesi'den başlar). Örn. `2` = Pazartesi + Salı. 1–5 arası bir değer. |
| **E-posta konusu** | `Code.js` → `REMINDER_SUBJECT` | Örn. `'🥪 Minik bir kantin hatırlatması 😊'`. |
| **E-postanın metni ve tasarımı (HTML)** | `Code.js` → `debtEmailHtml_` fonksiyonu | Metin, renkler, başlık ve alt bilgi burada üretilir. Kullanılan renkler: `#004c7a` (koyu mavi), `#e8f1fb` (açık mavi), `#ff6f00` (turuncu), `#d32f2f` (kırmızı). |
| **Test e-posta adresi** | `Code.js` → `TEST_EMAIL` | `sendTestReminder` fonksiyonunun e-posta göndereceği adres. |
| **Formun başlığı / görünümü / rengi** | `Index.html` | Başlık: `<h1>🥪 Kantin Kayıt</h1>` ve `doGet` içindeki `setTitle`. Kurumsal renk: en üstteki `--brand` değişkeni (`#0065B3`). |

> **Not:** Formu (`Index.html` veya `doGet` / `saveOrder`) etkileyen değişikliklerden
> sonra yeniden yayınlamak (redeploy) gerekir (bkz. bölüm 7). Yalnızca e-posta veya
> menü fonksiyonları değiştirildiyse yayına gerek yoktur; yapıştırıp kaydetmek yeterlidir.

---

## 5. Fonksiyonlar Ne İşe Yarar

Kodu (`Code.js`) düzenlemek çoğu zaman gerekmez; ancak fonksiyonların görevlerini
bilmek faydalıdır.

### Form ve kayıt
| Fonksiyon | Görevi |
|-----------|--------|
| `doGet` | Web formunu sunar; tarayıcı sekme başlığını da (`setTitle`) belirler. |
| `getData` / `getEmployees` / `getProducts` | Form açıldığında çalışan ve ürün listelerini okuyup gönderir. |
| `saveOrder` | Formdan gelen siparişi `Kayıtlar`'a yazar. Aynı anda birden fazla kayıt çakışmasın diye kilit (LockService) kullanır. |

### Hatırlatma e-postaları
| Fonksiyon | Görevi |
|-----------|--------|
| `sendDailyReminders` | **Otomatik trigger'ın çalıştırdığı fonksiyon.** Hafta içi sabah, borçluları günlere bölerek o günün grubuna e-posta gönderir. |
| `sendRemindersNow` | Manuel: **vadesi gelmiş** (bekleme süresini geçmiş) tüm borçlulara hemen e-posta gönderir. |
| `sendRemindersNowIgnoreGrace` | Manuel: **herkese** (taze borç dahil) gönderir, bekleme süresini yok sayar. |
| `sendTestReminder` | Yalnızca `TEST_EMAIL` adresine test e-postası gönderir (bekleme süresini yok sayar, başka kimseyi etkilemez). |
| `logReminderPlan` | E-posta göndermez; hangi güne kaç kişi düştüğünü kayıt günlüğüne (Logs) yazar. |
| `debtEmailHtml_` | **E-postanın HTML içeriğini/tasarımını üreten fonksiyon.** Metin veya görünüm burada değiştirilir. |
| `unpaidDebtByPerson_`, `emailBucket_`, `isDueForReminder_`, `sendReminder_` | İç yardımcılar (borçları grupla, kişiyi güne ata, süresi doldu mu, tek e-posta gönder). Doğrudan çağrılmaz. |

### Yönetim menüsü ve kurulum
| Fonksiyon | Görevi |
|-----------|--------|
| `markPersonPaid` | Bir kişinin tüm borcunu tek seferde ödendi yapar (e-posta sorar, onay ister). |
| `checkDuplicateEmails` | Çalışan listesinde tekrarlanan e-posta olup olmadığını denetler. |
| `onOpen` | E-Tablo açıldığında **Kurulum** ve **Kantin** menülerini oluşturur. |
| `setup` | Sekmeleri oluşturur, örnek veri ekler, e-posta benzersizlik kuralını uygular. |
| `formatMoney`, `getSheet`, `createSheet`, `applyEmployeeEmailValidation_`, `escapeHtml_`, `include` | İç yardımcılar. |

---

## 6. Otomatik Hatırlatma ve Çalışma Mantığı

### Trigger kurulumu (tek seferlik)
Apps Script editöründe:
1. Sol menü **Triggers (⏰)** → **Add Trigger**
2. **Function:** `sendDailyReminders`
3. **Event source:** Time-driven → **Day timer** → **08:00–09:00**
4. **Save** (izin istenirse onaylanır)
5. **Project Settings → Time zone = Europe/Istanbul** olmalıdır.

### Neden günlere bölünüyor?
Ücretsiz Gmail hesabı **günde ~100 kişiye** e-posta gönderebilir. Kişi sayısı
fazla olduğunda hepsine aynı gün gönderim yapılamaz. Bu nedenle:

- Borçlular, e-postalarına göre **sabit bir kuralla** iş günlerine bölünür
  (`REMINDER_DAYS` kadar gün, Pazartesi'den başlar). Her kişi haftada **bir kez**,
  kendi gününde e-posta alır.
- **Bekleme süresi (`REMINDER_GRACE_DAYS`):** Kişinin en eski ödenmemiş borcu bu
  süreyi geçmeden e-posta gönderilmez; böylece yeni alışveriş yapan hemen
  rahatsız edilmez.
- Kimin hangi gün e-posta alacağı e-postasından hesaplandığından, sistem
  kayıt tutmaz ve aynı kişiye tekrar (spam) gönderim yapmaz. Bir çalıştırma
  atlanırsa en fazla o hafta gecikir; asla fazladan gönderim olmaz.

Trigger kurulmadan önce **`logReminderPlan`** çalıştırılarak (View → Logs) hangi
güne kaç kişi düştüğü görülebilir.

---

## 7. Kod Değişikliğinden Sonra Yeniden Yayınlama

- **Form değişikliği** (`Index.html` veya `doGet` / `saveOrder`) → kullanıcılara
  ulaşması için yeniden yayınlanır: **Deploy → Manage deployments →** mevcut
  deployment → ✏️ (düzenle) → **Version: New version → Deploy**. Aynı deployment
  güncellendiği için **URL ve QR değişmez.**
- **Yalnızca e-posta / menü / kurulum fonksiyonları** değiştiyse yayına gerek
  yoktur; **yapıştırıp kaydetmek** yeterlidir. (Menü değiştiyse E-Tablo yenilenir.)

---

## 8. Dikkat Edilecekler

- **Sekme adları ve sütun başlıkları** (`Çalışanlar`, `Ürünler`, `Kayıtlar`)
  değiştirilmemelidir. Zorunlu ise `Code.js` başındaki `SHEET_*` / `HEADERS_*`
  sabitleri de aynı şekilde güncellenmelidir.
- Apps Script'teki **HTML dosyasının adı tam olarak `Index`** olmalıdır.
- **Her çalışanın e-postası dolu ve benzersiz** olmalıdır.
- **Gmail günlük ~100 kişi** sınırı nedeniyle günlere bölme yapılır; kişi sayısı
  çok artarsa `REMINDER_DAYS` değeri artırılmalıdır.
- Bir kişiyi `Çalışanlar`'dan silmek borcunu silmez; borç `Kayıtlar`'da kalır.
  Hatırlatmayı durdurmak için ilgili satırlar **Ödendi** yapılmalıdır.
- **Saat dilimi** Europe/Istanbul olmalıdır; aksi hâlde e-postalar yanlış saatte
  gönderilir.
- Sorun yaşanırsa Apps Script editöründe **Executions** (çalıştırma geçmişi) ve
  **Logs** bölümleri incelenebilir.

---

## 9. Sıfırdan Kurulum (Referans)

Sistem kurulu teslim edildiğinde bu adımlara gerek yoktur; yalnızca yeni bir
kurulum gerektiğinde başvurulur.

1. **Google E-Tablo oluşturun:** [sheets.new](https://sheets.new) → bir isim
   verin (örn. "Kantin Kayıt").
2. **Uzantılar → Apps Script** menüsünü açın.
3. Editörde:
   - Açılışta gelen varsayılan **`Code.gs`** dosyasının içeriğini silip yerine
     `Code.js` içeriğini yapıştırın.
   - **+ → HTML** ile yeni dosya ekleyip adını tam olarak **`Index`** koyun ve
     `Index.html` içeriğini yapıştırın.
   - **Kaydedin (💾)** ve **Project Settings (⚙) → Time zone → Istanbul** yapın.
4. **E-Tabloya dönüp sayfayı yenileyin.** Beliren **"Kurulum"** menüsünden
   **"Sayfaları oluştur ve örnek veri ekle"** seçeneğini çalıştırın (ilk seferde
   izin istenir → onaylayın). Sekmeler oluşur, örnek veri ve e-posta benzersizlik
   kuralı eklenir.
5. **Yayınlayın:** **Deploy → New deployment → Web app** → *Execute as:* **Me**,
   *Who has access:* **Anyone** → **Deploy** → verilen URL'yi kopyalayın.
6. **QR kod üretin:** Bu URL'den bir QR kod oluşturup kâğıda basın.
7. **Otomatik hatırlatmayı açın:** bölüm 6'daki trigger adımlarını uygulayın.

Gerçek çalışan ve ürün listesi `Çalışanlar` / `Ürünler` sekmelerinden girilir;
bunun için yeniden yayına gerek yoktur.
