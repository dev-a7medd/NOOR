"use strict";

/* =====================================
   NOOR - Complete Main Script
===================================== */

const API = {
  quran: "https://api.alquran.cloud/v1",
  prayer: "https://api.aladhan.com/v1"
};

const $ = selector => document.querySelector(selector);

let allSurahs = [];
let currentSurah = null;
let tasbeehCount = 0;

const audio = $("#surahAudio");

const RECITER = {
  name: "ماهر المعيقلي",
  server: "https://server12.mp3quran.net/maher/"
};

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3000);
}

function arabicNumber(number) {
  return String(number).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSurahDisplayName(surah) {
  return String(surah?.name || "")
    .trim()
    .replace(/^سُورَةُ?\s*/u, "")
    .replace(/^سورة\s*/u, "")
    .trim();
}

async function getJSON(url, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const result = await response.json();
    if (result.code && result.code !== 200) throw new Error("API Error");
    return result;
  } finally {
    clearTimeout(timer);
  }
}

/* =====================================
   QURAN - SURAH LIST
===================================== */

async function loadSurahs() {
  const status = $("#quranStatus");
  const list = $("#surahList");
  try {
    if (status) status.textContent = "جاري تحميل القرآن الكريم...";
    const result = await getJSON(`${API.quran}/surah`);
    if (!Array.isArray(result.data) || !result.data.length) {
      throw new Error("Surah list is empty");
    }
    allSurahs = result.data;
    renderSurahs(allSurahs);
    if (status) status.textContent = `تم تحميل ${allSurahs.length} سورة`;
  } catch (error) {
    console.error("Surah loading error:", error);
    if (status) status.textContent = "تعذر تحميل السور. تحقق من الإنترنت وحاول مرة أخرى.";
    if (list) {
      list.innerHTML = "";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "surah-card";
      retry.textContent = "إعادة تحميل السور";
      retry.addEventListener("click", loadSurahs);
      list.appendChild(retry);
    }
  }
}

function renderSurahs(surahs) {
  const list = $("#surahList");
  if (!list) return;
  list.innerHTML = "";

  if (!surahs.length) {
    list.textContent = "لا توجد نتائج مطابقة.";
    return;
  }

  surahs.forEach(surah => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "surah-card";
    button.style.cssText = `
      display:flex; align-items:center; gap:14px; direction:rtl;
      text-align:right; width:100%; padding:14px 16px; margin:8px 0;
      box-sizing:border-box;
    `;

    const number = document.createElement("span");
    number.className = "surah-number";
    number.textContent = arabicNumber(surah.number);
    number.style.cssText = `
      flex:0 0 42px; width:42px; height:42px; display:grid;
      place-items:center; border:1px solid #c9a85c; border-radius:12px;
      color:#e7ca82; font-weight:700; margin-left:2px;
    `;

    const details = document.createElement("span");
    details.className = "surah-details";
    details.style.cssText = "display:flex; flex-direction:column; gap:5px; min-width:0;";

    const name = document.createElement("strong");
    name.className = "surah-name";
    name.textContent = `سورة ${getSurahDisplayName(surah)}`;
    name.style.cssText = "display:block; line-height:1.6;";

    const info = document.createElement("small");
    info.className = "surah-info";
    info.textContent = `${surah.englishName} • ${arabicNumber(surah.numberOfAyahs)} آية`;
    info.style.cssText = "display:block; direction:rtl; opacity:.75; line-height:1.5;";

    details.append(name, info);
    button.append(number, details);
    button.addEventListener("click", () => openSurah(surah.number));
    list.appendChild(button);
  });
}

$("#surahSearch")?.addEventListener("input", event => {
  const query = normalizeName(event.target.value);
  renderSurahs(allSurahs.filter(surah =>
    normalizeName(surah.name).includes(query) ||
    normalizeName(surah.englishName).includes(query) ||
    String(surah.number) === query
  ));
});

/* =====================================
   QURAN READER AND PLAYER
===================================== */

function setupReciterDisplay() {
  const reader = $("#quranReader");
  const player = $("#quranPlayer");
  if (!reader || !player) return;

  ["#reciterPicker", "#reciterMenu", "#reciterToggle", "#reciterSearch"].forEach(selector => {
    const element = $(selector);
    if (element) element.hidden = true;
  });

  let label = $("#noorReciterLabel");
  if (!label) {
    label = document.createElement("div");
    label.id = "noorReciterLabel";
    label.textContent = `القارئ: ${RECITER.name}`;
    label.style.cssText = "width:100%;text-align:center;color:#f1dca5;font-weight:bold;margin:12px auto;padding:8px;";
  }

  const info = $("#readerSurahInfo");
  if (info) {
    info.insertAdjacentElement("afterend", label);
    label.insertAdjacentElement("afterend", player);
  } else {
    reader.insertBefore(label, reader.firstChild);
    label.insertAdjacentElement("afterend", player);
  }

  player.classList.remove("collapsed");
  player.hidden = false;
  if ($("#playerArrow")) $("#playerArrow").hidden = true;
  if ($("#playerTitle")) $("#playerTitle").textContent = currentSurah
    ? `سورة ${getSurahDisplayName(currentSurah)} • ${RECITER.name}`
    : RECITER.name;
}

function stopAudio() {
  if (!audio) return;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  resetAudioDisplay();
  setAudioStatus("تم إيقاف التلاوة.");
}

async function openSurah(number) {
  const reader = $("#quranReader");
  const list = $("#surahList");
  const text = $("#quranText");
  if (!reader || !text) return;

  stopAudio();
  reader.hidden = false;
  if (list) list.hidden = true;
  setupReciterDisplay();
  text.textContent = "جاري تحميل السورة...";

  requestAnimationFrame(() => {
    reader.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  try {
    const result = await getJSON(`${API.quran}/surah/${number}`);
    currentSurah = result.data;

    if ($("#readerSurahName")) {
      $("#readerSurahName").textContent = `سورة ${getSurahDisplayName(currentSurah)}`;
    }
    if ($("#readerSurahInfo")) {
      $("#readerSurahInfo").textContent =
        `${arabicNumber(currentSurah.numberOfAyahs)} آية • ${currentSurah.revelationType === "Meccan" ? "مكية" : "مدنية"}`;
    }

    setupReciterDisplay();
    renderQuranText(currentSurah);
    if ($("#playerTitle")) {
      $("#playerTitle").textContent = `سورة ${getSurahDisplayName(currentSurah)} • ${RECITER.name}`;
    }
    setAudioStatus(`اضغط تشغيل للاستماع إلى ${RECITER.name}.`);

    requestAnimationFrame(() => {
      reader.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  } catch (error) {
    console.error("Surah reader error:", error);
    text.textContent = "حدث خطأ أثناء تحميل السورة. تحقق من الإنترنت وحاول مرة أخرى.";
  }
}

/* =====================================
   QURAN TEXT - DISPLAY AYAHS
===================================== */

function renderQuranText(surah) {
  const container = $("#quranText");
  if (!container) return;

  container.innerHTML = "";

  surah.ayahs.forEach((ayah) => {
    const verse = document.createElement("span");
    verse.className = "quran-ayah";
    verse.style.cssText = "display:inline;line-height:2.3;";

    // عرض نص الآية كما وصل من مصدر القرآن دون حذف أو تعديل.
    const textNode = document.createTextNode(`${ayah.text} `);

    const marker = document.createElement("span");
    marker.className = "ayah-number";
    marker.textContent = `۝${arabicNumber(ayah.numberInSurah)}`;
    marker.style.cssText = `
      display:inline-flex; align-items:center; justify-content:center;
      min-width:27px; height:27px; padding:0 3px; margin:0 3px;
      border:1px solid #c9a85c; border-radius:50%; color:#d8b96d;
      font-size:.8em; vertical-align:middle;
    `;

    verse.append(textNode, marker);
    container.appendChild(verse);
    container.appendChild(document.createTextNode(" "));
  });
}

$("#backToSurahs")?.addEventListener("click", () => {
  stopAudio();
  if ($("#quranReader")) $("#quranReader").hidden = true;
  if ($("#surahList")) $("#surahList").hidden = false;
  $("#surahSearch")?.focus();
  $("#surahList")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function setAudioStatus(message) {
  const status = $("#audioStatus");
  if (status) status.textContent = message;
}

function updateAudioButton() {
  const button = $("#playerToggle");
  if (!button || !audio) return;
  const playing = !audio.paused && !audio.ended;
  button.textContent = playing ? "Ⅱ" : "▶";
  button.setAttribute("aria-label", playing ? "إيقاف مؤقت" : "تشغيل التلاوة");
}

function resetAudioDisplay() {
  if ($("#currentTime")) $("#currentTime").textContent = "00:00";
  if ($("#remainingTime")) $("#remainingTime").textContent = "-00:00";
  if ($("#audioProgress")) $("#audioProgress").value = 0;
  updateAudioButton();
}

async function toggleAudio() {
  if (!audio) return showToast("مشغل الصوت غير موجود.");
  if (!currentSurah) return showToast("افتح سورة أولًا.");

  if (!audio.paused && !audio.ended) {
    audio.pause();
    updateAudioButton();
    setAudioStatus("متوقف مؤقتًا.");
    return;
  }

  if (!audio.src) {
    const code = String(currentSurah.number).padStart(3, "0");
    audio.src = `${RECITER.server}${code}.mp3`;
    audio.load();
  }

  try {
    await audio.play();
    updateAudioButton();
    setAudioStatus(`جاري الاستماع • ${RECITER.name}`);
  } catch (error) {
    console.error(error);
    setAudioStatus("تعذر تشغيل التسجيل.");
    showToast("تعذر تشغيل التسجيل. تحقق من اتصال الإنترنت.");
  }
}

$("#playerToggle")?.addEventListener("click", toggleAudio);
audio?.addEventListener("play", updateAudioButton);
audio?.addEventListener("pause", updateAudioButton);
audio?.addEventListener("loadedmetadata", () => {
  if (Number.isFinite(audio.duration) && $("#remainingTime")) {
    $("#remainingTime").textContent = `-${formatTime(audio.duration)}`;
  }
});
audio?.addEventListener("timeupdate", () => {
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
  if ($("#currentTime")) $("#currentTime").textContent = formatTime(audio.currentTime);
  if ($("#remainingTime")) $("#remainingTime").textContent = `-${formatTime(audio.duration - audio.currentTime)}`;
  if ($("#audioProgress")) $("#audioProgress").value = (audio.currentTime / audio.duration) * 100;
});
audio?.addEventListener("ended", () => {
  updateAudioButton();
  setAudioStatus("انتهت التلاوة.");
});
audio?.addEventListener("error", () => {
  updateAudioButton();
  setAudioStatus("تعذر تحميل التسجيل. تحقق من اتصال الإنترنت.");
  showToast("تعذر تشغيل تسجيل السورة.");
});
$("#audioProgress")?.addEventListener("input", event => {
  if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
  audio.currentTime = (Number(event.target.value) / 100) * audio.duration;
});

/* =====================================
   COUNTRIES AND CITIES
===================================== */

const prayerCities = {
  Egypt: [
    ["بني سويف","Beni Suef"],["القاهرة","Cairo"],["الجيزة","Giza"],
    ["الإسكندرية","Alexandria"],["المنيا","Minya"],["أسيوط","Asyut"],
    ["سوهاج","Sohag"],["قنا","Qena"],["الأقصر","Luxor"],["أسوان","Aswan"],
    ["الفيوم","Faiyum"],["الزقازيق","Zagazig"],["المنصورة","Mansoura"],
    ["طنطا","Tanta"],["شبين الكوم","Shebin El Kom"],["دمنهور","Damanhur"],
    ["دمياط","Damietta"],["بورسعيد","Port Said"],["الإسماعيلية","Ismailia"],
    ["السويس","Suez"],["العريش","Arish"],["شرم الشيخ","Sharm El Sheikh"],
    ["مرسى مطروح","Marsa Matruh"],["الغردقة","Hurghada"],["الخارجة","Kharga"],
    ["كفر الشيخ","Kafr El Sheikh"],["بنها","Benha"],["6 أكتوبر","6th of October"],
    ["العاشر من رمضان","10th of Ramadan"],["حلوان","Helwan"],["بني مزار","Beni Mazar"],
    ["ملوي","Mallawi"],["ديروط","Dayrout"],["أبو قرقاص","Abu Qurqas"],
    ["الفشن","El Fashn"],["ناصر","Nasser"],["إهناسيا","Ihnasia"],
    ["سمسطا","Sumusta"],["ببا","Biba"]
  ],
  "Saudi Arabia": [
    ["الرياض","Riyadh"],["جدة","Jeddah"],["مكة المكرمة","Mecca"],
    ["المدينة المنورة","Medina"],["الدمام","Dammam"],["الطائف","Taif"],
    ["تبوك","Tabuk"],["أبها","Abha"],["بريدة","Buraidah"],["حائل","Hail"],
    ["جازان","Jazan"],["نجران","Najran"],["ينبع","Yanbu"],["الجبيل","Jubail"],
    ["خميس مشيط","Khamis Mushait"],["الخبر","Khobar"],["القطيف","Qatif"],
    ["الأحساء","Al Ahsa"],["عرعر","Arar"],["سكاكا","Sakaka"],
    ["الباحة","Al Bahah"],["القريات","Al Qurayyat"],["حفر الباطن","Hafar Al Batin"],
    ["الخرج","Al Kharj"],["المجمعة","Al Majma'ah"],["الدوادمي","Dawadmi"],
    ["القنفذة","Al Qunfudhah"],["رفحاء","Rafha"],["الوجه","Al Wajh"]
  ],
  "United Arab Emirates": [
    ["أبوظبي","Abu Dhabi"],["دبي","Dubai"],["الشارقة","Sharjah"],
    ["عجمان","Ajman"],["العين","Al Ain"],["رأس الخيمة","Ras Al Khaimah"],
    ["الفجيرة","Fujairah"],["أم القيوين","Umm Al Quwain"],["خورفكان","Khor Fakkan"],
    ["كلباء","Kalba"],["دبا","Dibba"]
  ],
  Jordan: [
    ["عمّان","Amman"],["إربد","Irbid"],["الزرقاء","Zarqa"],["العقبة","Aqaba"],
    ["السلط","Salt"],["مادبا","Madaba"],["جرش","Jerash"],["الكرك","Karak"],
    ["معان","Ma'an"],["عجلون","Ajloun"],["المفرق","Mafraq"],["الطفيلة","Tafilah"]
  ],
  Kuwait: [
    ["مدينة الكويت","Kuwait City"],["حولي","Hawalli"],["السالمية","Salmiya"],
    ["الفروانية","Farwaniya"],["الجهراء","Jahra"],["الأحمدي","Ahmadi"],
    ["مبارك الكبير","Mubarak Al Kabeer"]
  ],
  Iraq: [
    ["بغداد","Baghdad"],["البصرة","Basra"],["الموصل","Mosul"],["أربيل","Erbil"],
    ["النجف","Najaf"],["كربلاء","Karbala"],["كركوك","Kirkuk"],
    ["السليمانية","Sulaymaniyah"],["دهوك","Duhok"],["الناصرية","Nasiriyah"],
    ["الرمادي","Ramadi"],["الحلة","Hillah"],["الديوانية","Diwaniyah"],
    ["الكوت","Kut"],["بعقوبة","Baqubah"]
  ],
  Syria: [
    ["دمشق","Damascus"],["حلب","Aleppo"],["حمص","Homs"],["حماة","Hama"],
    ["اللاذقية","Latakia"],["طرطوس","Tartus"],["إدلب","Idlib"],["درعا","Daraa"],
    ["السويداء","As Suwayda"],["دير الزور","Deir ez-Zor"],["الرقة","Raqqa"],
    ["الحسكة","Al Hasakah"]
  ],
  Morocco: [
    ["الرباط","Rabat"],["الدار البيضاء","Casablanca"],["مراكش","Marrakesh"],
    ["فاس","Fes"],["طنجة","Tangier"],["أكادير","Agadir"],["مكناس","Meknes"],
    ["وجدة","Oujda"],["تطوان","Tetouan"],["القنيطرة","Kenitra"],["آسفي","Safi"],
    ["بني ملال","Beni Mellal"],["الجديدة","El Jadida"],["الناظور","Nador"]
  ],
  Algeria: [
    ["الجزائر العاصمة","Algiers"],["وهران","Oran"],["قسنطينة","Constantine"],
    ["عنابة","Annaba"],["البليدة","Blida"],["سطيف","Setif"],["باتنة","Batna"],
    ["تلمسان","Tlemcen"],["بجاية","Bejaia"],["تيزي وزو","Tizi Ouzou"],
    ["بسكرة","Biskra"],["ورقلة","Ouargla"],["الشلف","Chlef"],["سكيكدة","Skikda"],
    ["تيارت","Tiaret"],["الجلفة","Djelfa"],["أدرار","Adrar"]
  ]
};

const countryNames = [
  ["Egypt","مصر"],["Saudi Arabia","السعودية"],
  ["United Arab Emirates","الإمارات"],["Jordan","الأردن"],
  ["Kuwait","الكويت"],["Iraq","العراق"],["Syria","سوريا"],
  ["Morocco","المغرب"],["Algeria","الجزائر"]
];

function populateCountries() {
  const select = $("#countrySelect");
  if (!select) return;

  select.innerHTML = "";
  countryNames.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });
  select.value = "Egypt";
}

function ensureCitySelect() {
  let city = $("#cityInput");
  if (!city) return null;

  if (city.tagName.toLowerCase() !== "select") {
    const select = document.createElement("select");
    select.id = city.id;
    select.className = city.className;
    select.name = city.name || "city";
    select.required = city.required;
    select.setAttribute("aria-label", "اختر المدينة");
    city.replaceWith(select);
    city = select;
  }
  return city;
}

function populateCities() {
  const country = $("#countrySelect")?.value || "Egypt";
  const citySelect = ensureCitySelect();
  if (!citySelect) return;

  const cities = prayerCities[country] || [];
  citySelect.innerHTML = "";

  cities.forEach(([arabic, english]) => {
    const option = document.createElement("option");
    option.value = english;
    option.textContent = arabic;
    citySelect.appendChild(option);
  });

  if (country === "Egypt") citySelect.value = "Beni Suef";
  else if (cities.length) citySelect.value = cities[0][1];
}

$("#countrySelect")?.addEventListener("change", () => {
  populateCities();
  const status = $("#locationStatus");
  if (status) status.textContent = "اختر المدينة ثم اضغط عرض المواقيت.";
  const list = $("#prayerList");
  if (list) list.innerHTML = "";
});

function formatPrayerTime(time) {
  if (!time) return "--:--";
  const cleanTime = String(time).split(" ")[0];
  const match = cleanTime.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return cleanTime;

  let hours = Number(match[1]);
  const minutes = match[2];
  const period = hours >= 12 ? "مساءً" : "صباحًا";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${arabicNumber(hours)}:${arabicNumber(minutes)} ${period}`;
}

function renderPrayerTimes(timings) {
  const list = $("#prayerList");
  if (!list) return;

  const prayers = [
    ["الفجر", timings.Fajr, "🌙"],["الشروق", timings.Sunrise, "🌅"],
    ["الظهر", timings.Dhuhr, "☀️"],["العصر", timings.Asr, "🌤️"],
    ["المغرب", timings.Maghrib, "🌇"],["العشاء", timings.Isha, "✨"]
  ];

  list.innerHTML = "";
  prayers.forEach(([name, time, icon]) => {
    const card = document.createElement("div");
    card.className = "prayer-card";

    const prayerIcon = document.createElement("div");
    prayerIcon.className = "prayer-icon";
    prayerIcon.textContent = icon;

    const prayerName = document.createElement("div");
    prayerName.className = "prayer-name";
    prayerName.textContent = name;

    const prayerTime = document.createElement("div");
    prayerTime.className = "prayer-time";
    prayerTime.textContent = formatPrayerTime(time);

    card.append(prayerIcon, prayerName, prayerTime);
    list.appendChild(card);
  });
}

function renderDates(date) {
  if ($("#gregorianDate")) $("#gregorianDate").textContent = date.readable || "";
  if ($("#hijriDate") && date.hijri) {
    $("#hijriDate").textContent =
      `${date.hijri.day} ${date.hijri.month.ar} ${date.hijri.year} هـ`;
  }
}

async function loadPrayerTimes() {
  const city = $("#cityInput")?.value;
  const country = $("#countrySelect")?.value;
  const status = $("#locationStatus");
  const list = $("#prayerList");

  if (!city || !country) {
    showToast("اختر الدولة والمدينة أولًا.");
    return;
  }

  if (status) status.textContent = "جاري تحميل مواقيت الصلاة...";
  if (list) list.innerHTML = "";

  try {
    const url = `${API.prayer}/timingsByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=5`;
    const result = await getJSON(url);
    if (!result.data?.timings) throw new Error("Prayer times unavailable");
    renderPrayerTimes(result.data.timings);
    renderDates(result.data.date);
    if (status) status.textContent = `مواقيت الصلاة في ${$("#cityInput").selectedOptions[0]?.textContent || city}.`;
  } catch (error) {
    console.error("Prayer times error:", error);
    if (status) status.textContent = "تعذر تحميل المواقيت. تحقق من الإنترنت واسم المدينة.";
    showToast("لم نتمكن من تحميل مواقيت الصلاة.");
  }
}

$("#loadPrayerBtn")?.addEventListener("click", loadPrayerTimes);

$("#useLocationBtn")?.addEventListener("click", () => {
  if (!navigator.geolocation) {
    showToast("تحديد الموقع غير مدعوم في هذا المتصفح.");
    return;
  }

  const status = $("#locationStatus");
  if (status) status.textContent = "جاري تحديد موقعك...";

  navigator.geolocation.getCurrentPosition(async position => {
    try {
      const { latitude, longitude } = position.coords;
      const url = `${API.prayer}/timings?latitude=${latitude}&longitude=${longitude}&method=5`;
      const result = await getJSON(url);
      renderPrayerTimes(result.data.timings);
      renderDates(result.data.date);
      if (status) status.textContent = "تم تحميل المواقيت حسب موقعك.";
    } catch (error) {
      console.error(error);
      if (status) status.textContent = "تعذر تحميل المواقيت حسب الموقع.";
      showToast("تعذر تحميل المواقيت.");
    }
  }, error => {
    console.error(error);
    if (status) status.textContent = "لم نتمكن من تحديد موقعك. تحقق من إذن الموقع.";
    showToast("اسمح للمتصفح باستخدام موقعك.");
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
});

/* =====================================
   ADHKAR - FULL TEXTS
===================================== */

const adhkarData = {
  morning: [
    { text: "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ. رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ. رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ. رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ.", count: 1 },
    { text: "اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ.", count: 1 },
    { text: "اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي، فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ.", count: 1 },
    { text: "رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ ﷺ نَبِيًّا.", count: 3 },
    { text: "اللَّهُمَّ إِنِّي أَصْبَحْتُ أُشْهِدُكَ، وَأُشْهِدُ حَمَلَةَ عَرْشِكَ، وَمَلَائِكَتَكَ، وَجَمِيعَ خَلْقِكَ، أَنَّكَ أَنْتَ اللَّهُ لَا إِلَهَ إِلَّا أَنْتَ وَحْدَكَ لَا شَرِيكَ لَكَ، وَأَنَّ مُحَمَّدًا عَبْدُكَ وَرَسُولُكَ.", count: 4 },
    { text: "اللَّهُمَّ مَا أَصْبَحَ بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ فَمِنْكَ وَحْدَكَ لَا شَرِيكَ لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ.", count: 1 },
    { text: "حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ، عَلَيْهِ تَوَكَّلْتُ، وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ.", count: 7 },
    { text: "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ.", count: 3 },
    { text: "اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لَا إِلَهَ إِلَّا أَنْتَ. اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْكُفْرِ وَالْفَقْرِ، وَأَعُوذُ بِكَ مِنْ عَذَابِ الْقَبْرِ، لَا إِلَهَ إِلَّا أَنْتَ.", count: 3 },
    { text: "يَا حَيُّ يَا قَيُّومُ، بِرَحْمَتِكَ أَسْتَغِيثُ، أَصْلِحْ لِي شَأْنِي كُلَّهُ، وَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ.", count: 1 },
    { text: "أَصْبَحْنَا عَلَى فِطْرَةِ الْإِسْلَامِ، وَعَلَى كَلِمَةِ الْإِخْلَاصِ، وَعَلَى دِينِ نَبِيِّنَا مُحَمَّدٍ ﷺ، وَعَلَى مِلَّةِ أَبِينَا إِبْرَاهِيمَ حَنِيفًا مُسْلِمًا وَمَا كَانَ مِنَ الْمُشْرِكِينَ.", count: 1 },
    { text: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ.", count: 100 },
    { text: "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ.", count: 3 },
    { text: "اللَّهُ لَا إِلَهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَنْ ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۖ وَهُوَ الْعَلِيُّ الْعَظِيمُ.", count: 1 },
    { text: "قُلْ هُوَ اللَّهُ أَحَدٌ ۝١ اللَّهُ الصَّمَدُ ۝٢ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝٣ وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ ۝٤", count: 3 },
    { text: "قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۝١ مِنْ شَرِّ مَا خَلَقَ ۝٢ وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ ۝٣ وَمِنْ شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ۝٤ وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ ۝٥", count: 3 },
    { text: "قُلْ أَعُوذُ بِرَبِّ النَّاسِ ۝١ مَلِكِ النَّاسِ ۝٢ إِلَٰهِ النَّاسِ ۝٣ مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ۝٤ الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ۝٥ مِنَ الْجِنَّةِ وَالنَّاسِ ۝٦", count: 3 }
  ],

  evening: [
    { text: "أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ. رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا. رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ. رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ.", count: 1 },
    { text: "اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ.", count: 1 },
    { text: "اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي، فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ.", count: 1 },
    { text: "رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ ﷺ نَبِيًّا.", count: 3 },
    { text: "اللَّهُمَّ إِنِّي أَمْسَيْتُ أُشْهِدُكَ، وَأُشْهِدُ حَمَلَةَ عَرْشِكَ، وَمَلَائِكَتَكَ، وَجَمِيعَ خَلْقِكَ، أَنَّكَ أَنْتَ اللَّهُ لَا إِلَهَ إِلَّا أَنْتَ وَحْدَكَ لَا شَرِيكَ لَكَ، وَأَنَّ مُحَمَّدًا عَبْدُكَ وَرَسُولُكَ.", count: 4 },
    { text: "اللَّهُمَّ مَا أَمْسَى بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ فَمِنْكَ وَحْدَكَ لَا شَرِيكَ لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ.", count: 1 },
    { text: "حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ، عَلَيْهِ تَوَكَّلْتُ، وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ.", count: 7 },
    { text: "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ.", count: 3 },
    { text: "اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لَا إِلَهَ إِلَّا أَنْتَ. اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْكُفْرِ وَالْفَقْرِ، وَأَعُوذُ بِكَ مِنْ عَذَابِ الْقَبْرِ، لَا إِلَهَ إِلَّا أَنْتَ.", count: 3 },
    { text: "يَا حَيُّ يَا قَيُّومُ، بِرَحْمَتِكَ أَسْتَغِيثُ، أَصْلِحْ لِي شَأْنِي كُلَّهُ، وَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ.", count: 1 },
    { text: "أَمْسَيْنَا عَلَى فِطْرَةِ الْإِسْلَامِ، وَعَلَى كَلِمَةِ الْإِخْلَاصِ، وَعَلَى دِينِ نَبِيِّنَا مُحَمَّدٍ ﷺ، وَعَلَى مِلَّةِ أَبِينَا إِبْرَاهِيمَ حَنِيفًا مُسْلِمًا وَمَا كَانَ مِنَ الْمُشْرِكِينَ.", count: 1 },
    { text: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ.", count: 100 },
    { text: "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ.", count: 3 },
    { text: "اللَّهُ لَا إِلَهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَنْ ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۖ وَهُوَ الْعَلِيُّ الْعَظِيمُ.", count: 1 },
    { text: "قُلْ هُوَ اللَّهُ أَحَدٌ ۝١ اللَّهُ الصَّمَدُ ۝٢ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝٣ وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ ۝٤", count: 3 },
    { text: "قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۝١ مِنْ شَرِّ مَا خَلَقَ ۝٢ وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ ۝٣ وَمِنْ شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ۝٤ وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ ۝٥", count: 3 },
    { text: "قُلْ أَعُوذُ بِرَبِّ النَّاسِ ۝١ مَلِكِ النَّاسِ ۝٢ إِلَٰهِ النَّاسِ ۝٣ مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ۝٤ الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ۝٥ مِنَ الْجِنَّةِ وَالنَّاسِ ۝٦", count: 3 }
  ],

  general: [
    { text: "سُبْحَانَ اللَّهِ", count: 100 },
    { text: "الْحَمْدُ لِلَّهِ", count: 100 },
    { text: "اللَّهُ أَكْبَرُ", count: 100 },
    { text: "لَا إِلَهَ إِلَّا اللَّهُ", count: 100 },
    { text: "أَسْتَغْفِرُ اللَّهَ", count: 100 }
  ]
};

function renderAdhkar(category = "morning") {
  const container = $("#dhikrList");
  if (!container) return;

  const items = adhkarData[category];
  if (!items) {
    container.textContent = "لا توجد أذكار في هذا القسم.";
    return;
  }

  container.innerHTML = "";
  items.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "dhikr-card";

    const number = document.createElement("div");
    number.className = "dhikr-number";
    number.textContent = index + 1;

    const text = document.createElement("p");
    text.className = "dhikr-text";
    text.textContent = item.text;

    const footer = document.createElement("div");
    footer.className = "dhikr-footer";

    let remaining = item.count;
    const remainingElement = document.createElement("span");
    remainingElement.className = "dhikr-remaining";
    remainingElement.textContent = `المتبقي: ${remaining}`;

    const button = document.createElement("button");
    button.className = "dhikr-count-btn";
    button.type = "button";
    button.textContent = "اضغط للتسبيح";

    button.addEventListener("click", () => {
      if (remaining <= 0) return;
      remaining--;
      remainingElement.textContent = `المتبقي: ${remaining}`;
      if (remaining === 0) {
        button.textContent = "تم الذكر";
        button.disabled = true;
        card.classList.add("completed");
      }
    });

    footer.append(remainingElement, button);
    card.append(number, text, footer);
    container.appendChild(card);
  });
}

/* =====================================
   ADHKAR TABS
===================================== */

$("#dhikrTabs")?.addEventListener("click", event => {
  const tab = event.target.closest("[data-category]");
  if (!tab) return;

  const category = tab.dataset.category;
  if (!adhkarData[category]) return;

  $("#dhikrTabs").querySelectorAll("[data-category]").forEach(button => {
    button.classList.remove("active");
  });

  tab.classList.add("active");
  renderAdhkar(category);
});

/* =====================================
   TASBEEH
===================================== */

function updateTasbeeh() {
  const counter = $("#counter");
  if (counter) counter.textContent = tasbeehCount;
}

$("#countBtn")?.addEventListener("click", () => {
  tasbeehCount++;
  updateTasbeeh();
});

$("#resetBtn")?.addEventListener("click", () => {
  tasbeehCount = 0;
  updateTasbeeh();
});

/* =====================================
   MOBILE MENU
===================================== */

const menuToggle = $("#menuToggle");
const navLinks = $("#navLinks");

if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    navLinks.classList.toggle("active");
    menuToggle.classList.toggle("active");
    menuToggle.setAttribute("aria-expanded", String(navLinks.classList.contains("active")));
  });

  navLinks.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("active");
      menuToggle.classList.remove("active");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });
}

/* =====================================
   INITIALIZE
===================================== */

function initializeNoor() {
  if ($("#currentYear")) {
    $("#currentYear").textContent = new Date().getFullYear();
  }

  setupReciterDisplay();
  populateCountries();
  populateCities();
  renderAdhkar("morning");
  updateTasbeeh();

  Promise.allSettled([loadSurahs(), loadPrayerTimes()]).then(results => {
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(index === 0 ? "Quran initialization error:" : "Prayer initialization error:", result.reason);
      }
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeNoor);
} else {
  initializeNoor();
}

/* END OF NOOR SCRIPT */