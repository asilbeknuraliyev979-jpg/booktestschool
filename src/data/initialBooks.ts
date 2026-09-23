import { Book } from '../types';

export const INITIAL_BOOKS: Book[] = [
  {
    id: 'book-1',
    title: "O'tkan kunlar",
    author: "Abdulla Qodiriy",
    grade: "9-sinf (9-A, 9-B, 9-D)",
    coverColor: "from-amber-600 to-amber-800",
    description: "O'zbek adabiyotidagi ilk roman. Otabek va Kumushbibi muhabbati, 19-asr o'rtalaridagi Turkiston xonliklari davridagi ijtimoiy-siyosiy ziddiyatlar tasviri.",
    createdAt: "2026-01-10",
    questions: [
      // Variantli savollar
      {
        id: 'otkan-1',
        type: 'multiple-choice',
        question: "Roman qaysi yillardagi voqealarni o'z ichiga oladi?",
        options: [
          "1845–1853-yillar",
          "1870–1880-yillar",
          "1905–1917-yillar",
          "1820–1830-yillar"
        ],
        correctOptionIndex: 0,
        explanation: "Romandagi voqealar Xudoyorxon davrida, 1845–1853-yillarda bo'lib o'tadi."
      },
      {
        id: 'otkan-2',
        type: 'multiple-choice',
        question: "Otabek birinchi marta Marg'ilonda kimning xonadoniga mehmon bo'ladi?",
        options: [
          "Mirzakarim qutidor",
          "Hasanali",
          "Homid",
          "Ziyo shohichi"
        ],
        correctOptionIndex: 0,
        explanation: "Otabek Marg'ilonda Mirzakarim qutidor xonadoniga mehmon bo'lib, uning qizi Kumushni ko'radi."
      },
      {
        id: 'otkan-3',
        type: 'multiple-choice',
        question: "Otabekning Marg'ilonga qatnashida unga sadoqatli hamroh bo'lgan qariya kim?",
        options: [
          "Hasanali",
          "Usta Alim",
          "Yusufbek hoji",
          "Rahmat"
        ],
        correctOptionIndex: 0,
        explanation: "Hasanali Yusufbek hoji xonadonining sadoqatli mahrami va Otabekning eng yaqin murabbiysi edi."
      },
      {
        id: 'otkan-4',
        type: 'multiple-choice',
        question: "Kumushbibining onasining ismi nima?",
        options: [
          "Oftoboyim",
          "O'zbekoyim",
          "Zaynab",
          "Xushro'y"
        ],
        correctOptionIndex: 0,
        explanation: "Kumushning onasi Oftoboyim bo'lib, Mirzakarim qutidorning rafiqasi edi."
      },
      {
        id: 'otkan-5',
        type: 'multiple-choice',
        question: "Otabekning Toshkentdagi xonadoniga majburlab uylantirilgan ikkinchi xotini kim?",
        options: [
          "Zaynab",
          "Xushro'y",
          "Saodat",
          "Nodira"
        ],
        correctOptionIndex: 0,
        explanation: "O'zbekoyimning talabi bilan Otabek Zaynabga uylanishga majbur bo'ladi."
      },
      {
        id: 'otkan-6',
        type: 'multiple-choice',
        question: "Romanda Otabekka dushmanlik qilib, uni qutidor oldida yomonotliq qilishga uringan qahramon kim?",
        options: [
          "Homid",
          "Sodiq",
          "Mulla Do'st",
          "Musulmonqul"
        ],
        correctOptionIndex: 0,
        explanation: "Homid Otabekning asosiy g'animi bo'lib, fitnalar to'qiydi."
      },
      {
        id: 'otkan-7',
        type: 'multiple-choice',
        question: "Kumushbibining vafotiga nima sabab bo'ladi?",
        options: [
          "Zaynab tomonidan ovqatiga zahar qo'shilishi",
          "Vabo kasalligi",
          "Yurak xuruji",
          "Jangda yaralanishi"
        ],
        correctOptionIndex: 0,
        explanation: "Kundoshlik rashki oqibatida Zaynab Kumushning taomiga zahar soladi."
      },
      {
        id: 'otkan-8',
        type: 'multiple-choice',
        question: "Otabek romanning oxirida qanday halok bo'ladi?",
        options: [
          "Vatan himoyasi uchun rus bosqinchilariga qarshi jangda",
          "Og'ir kasallikdan Toshkentda",
          "Homid bilan duelda",
          "Qamoqda"
        ],
        correctOptionIndex: 0,
        explanation: "Otabek Oqmasjid mudofaasida bosqinchilarga qarshi jangda qahramonlarcha halok bo'ladi."
      },
      {
        id: 'otkan-9',
        type: 'multiple-choice',
        question: "Otabek bilan Usta Alim qayerda tanishadi va qadrdon do'st bo'lib qoladi?",
        options: [
          "Ziyofatda karvonsaroyda",
          "Toshkent bozorida",
          "Qamoqxonada",
          "Muzrabodda"
        ],
        correctOptionIndex: 0,
        explanation: "Usta Alim Otabek bilan karvonsaroyda samimiy dardlashib do'stlashadi."
      },
      {
        id: 'otkan-10',
        type: 'multiple-choice',
        question: "Yusufbek hoji Qo'qon xonligida qanday nufuzga ega edi?",
        options: [
          "Toshkentning eng obro'li oqsoqollaridan biri va xalq himoyachisi",
          "Xon saroyining bosh xazinachisi",
          "Katta lashkarboshi",
          "Bosh qozikalon"
        ],
        correctOptionIndex: 0,
        explanation: "Yusufbek hoji xalq manfaati va adolat yo'lida gapiruvchi mo''tabar shaxs edi."
      },
      {
        id: 'otkan-11',
        type: 'multiple-choice',
        question: "Abdulla Qodiriy romanning debochasida asarni yozishdan asosiy muddao nima deb aytadi?",
        options: [
          "Moziyga qaytib ish ko'rish xayrlidir, o'tmish xatolaridan saboq chiqarish",
          "Faqat oshiq-ma'shuqlar qissasini aytish",
          "Xonliklar tarixini maqtab ko'rsatish",
          "Badiiy to'qima bilan kitobxonni ergashtirish"
        ],
        correctOptionIndex: 0,
        explanation: "'Modomiki, biz yangi davrga oyoq qo'ydik, endi har bir ishda yangilik ketidan ergashmog'imiz darkor... Moziyga qaytib ish ko'rish xayrlidir'."
      },
      {
        id: 'otkan-12',
        type: 'multiple-choice',
        question: "Kumush va Otabekning farzandiga qanday ism beriladi?",
        options: [
          "Yodgorbek",
          "Anvar",
          "Temurbek",
          "Bobur"
        ],
        correctOptionIndex: 0,
        explanation: "Ularning o'g'liga Yodgor deb nom qo'yiladi."
      },
      {
        id: 'otkan-13',
        type: 'multiple-choice',
        question: "Otabekning birinchi uchrashuvda Kumushga bo'lgan taassuroti qanday ifodalangan?",
        options: [
          "Ko'zlari qora, kipriklari o'qday, malohatli qiz",
          "Mag'rur va takabbur xon qizi",
          "Juda sho'x va quvnoq chehra",
          "Oddiy qishloq qizi"
        ],
        correctOptionIndex: 0,
        explanation: "Qodiriy Kumushning latofati va ichki go'zalligini yuksak mahorat bilan tasvirlagan."
      },
      {
        id: 'otkan-14',
        type: 'multiple-choice',
        question: "Romandagi O'zbekoyim xarakterining eng ko'zga tashlanadigan jihati nima?",
        options: [
          "O'zbilarmonlik, qaysarlik va urf-odatlarga ko'r-ko'rona bog'lanish",
          "Haddan tashqari bag'rikenglik",
          "Siyosiy hiyla-nayranglar ustasi",
          "Faqat boylik orttirishga mukkasidan ketish"
        ],
        correctOptionIndex: 0,
        explanation: "O'zbekoyim o'z xohishini o'g'liga o'tkazishga intiluvchi, an'anaparast ona sifatida gavdalanadi."
      },
      {
        id: 'otkan-15',
        type: 'multiple-choice',
        question: "Otabek va Kumushning Toshkentdagi hayoti qanday muhitda o'tadi?",
        options: [
          "Zaynab va uning onasi fitnalari tufayli murakkab va iztirobli",
          "To'liq xotirjamlik va shodlikda",
          "Hovlidan chiqmay yashirincha",
          "Doimiy sayohatlarda"
        ],
        correctOptionIndex: 0,
        explanation: "Zaynab va uning onasi Xushro'yning adovati tufayli ikki qalb iztirob chekadi."
      },
      {
        id: 'otkan-16',
        type: 'multiple-choice',
        question: "Romanda qaysi shaharlar voqealar markazida turadi?",
        options: [
          "Toshkent, Marg'ilon, Qo'qon",
          "Samarqand, Buxoro, Xiva",
          "Andijon, Namangan, O'sh",
          "Jizzax, Guliston, Chirchiq"
        ],
        correctOptionIndex: 0,
        explanation: "Asar Toshkent, Marg'ilon va Qo'qon shaharlaridagi voqealarni yoritadi."
      },

      // Javobi yoziladigan savollar
      {
        id: 'otkan-w1',
        type: 'written',
        question: "'O'tkan kunlar' romani muallifi to'liq kim va u qaysi yili e'lon qilingan?",
        expectedAnswer: "Abdulla Qodiriy (Julqunboy), 1925–1926-yillarda kitob holida nashr qilingan.",
        keywords: ["Abdulla Qodiriy", "Qodiriy", "1925", "1926"]
      },
      {
        id: 'otkan-w2',
        type: 'written',
        question: "Otabek Marg'ilonda ko'ngil qo'ygan qizning to'liq ismi va uning otasi kim?",
        expectedAnswer: "Kumushbibi (Kumush), otasi Mirzakarim qutidor.",
        keywords: ["Kumush", "Kumushbibi", "Mirzakarim", "qutidor"]
      },
      {
        id: 'otkan-w3',
        type: 'written',
        question: "Otabekning otasi kim va u qaysi shaharning nufuzli arbobi edi?",
        expectedAnswer: "Yusufbek hoji, Toshkent shahrining hurmatli va nufuzli oqsoqoli.",
        keywords: ["Yusufbek hoji", "Yusufbek", "Toshkent"]
      },
      {
        id: 'otkan-w4',
        type: 'written',
        question: "Kumushbibini zaharlagan shaxs kim va u nima sababdan bunday qabih ishga qo'l urdi?",
        expectedAnswer: "Zaynab, kundoshlik rashki va Otabekning Kumushga muhabbatiga hasad tufayli.",
        keywords: ["Zaynab", "rashk", "hasad", "kundoshlik"]
      },
      {
        id: 'otkan-w5',
        type: 'written',
        question: "Otabek romanning oxirida qaysi qal'ani himoya qilish paytida shahid bo'ladi?",
        expectedAnswer: "Oqmasjid (Oqmachit) mudofaasida bosqinchilarga qarshi jangda.",
        keywords: ["Oqmasjid", "Oqmachit", "mudofaa", "jang"]
      },
      {
        id: 'otkan-w6',
        type: 'written',
        question: "Kumush vafot etgach, Otabek uning qabri ustiga qanday so'zlarni yozdiradi?",
        expectedAnswer: "Kumushning pok sevgisi va fojiali qismatini ifodalovchi motam bayti.",
        keywords: ["qabr", "she'r", "bayt", "motam"]
      }
    ]
  },
  {
    id: 'book-2',
    title: "Sariq devni minib",
    author: "Xudoyberdi To'xtaboyev",
    grade: "5-6 sinflar (5-A, 5-B, 5-D, 6-A, 6-B, 6-D)",
    coverColor: "from-emerald-600 to-teal-800",
    description: "Sarguzasht qissa. Hoshimjonning sehrli qalpoqcha orqali kutilmagan sarguzashtlarga tushishi, dangasalik oqibatlari va ilm olishning ahamiyati haqida.",
    createdAt: "2026-01-15",
    questions: [
      {
        id: 'dev-1',
        type: 'multiple-choice',
        question: "Qissaning bosh qahramoni kim?",
        options: [
          "Hoshimjon Ro'ziyev",
          "Olimjon",
          "Ergash",
          "Doniyor"
        ],
        correctOptionIndex: 0,
        explanation: "Asar bosh qahramoni orzu-havasga to'la, sho'x Hoshimjondir."
      },
      {
        id: 'dev-2',
        type: 'multiple-choice',
        question: "Hoshimjonga g'aroyib xislat baxsh etgan sehrli buyum nima edi?",
        options: [
          "Sehrli qalpoqcha",
          "Sehrli uzuk",
          "Sehrli tayoqcha",
          "Sehrli ko'zoynak"
        ],
        correctOptionIndex: 0,
        explanation: "Hoshimjon sandiqdan topib olgan sehrli qalpoqcha uni ko'rinmas qilib qo'yadi."
      },
      {
        id: 'dev-3',
        type: 'multiple-choice',
        question: "Hoshimjon qalpoqchani kiyganda qanday mo'jiza yuz berardi?",
        options: [
          "U boshqalarga ko'rinmay qolardi",
          "U uchish qobiliyatiga ega bo'lardi",
          "U hayvonlar tilini tushunardi",
          "U barcha chet tillarida gapira olardi"
        ],
        correctOptionIndex: 0,
        explanation: "Sehrli qalpoqcha insonni ko'rinmas qilib qo'yish xususiyatiga ega edi."
      },
      {
        id: 'dev-4',
        type: 'multiple-choice',
        question: "Hoshimjon avvaliga maktabda o'qimasdan nimaga erishmoqchi bo'ladi?",
        options: [
          "Mehnat qilmasdan mashhur olim yoki agronom bo'lishga",
          "Kosmonavt bo'lishga",
          "Tadbirkor bo'lishga",
          "Chet elga sayohat qilishga"
        ],
        correctOptionIndex: 0,
        explanation: "U dars qilmasdan, qiyinchilik ko'rmasdan mashhurlikka erishishni xohlaydi."
      },
      {
        id: 'dev-5',
        type: 'multiple-choice',
        question: "Hoshimjon dashtdagi paxtakorlar oldiga borib qanday nom oladi?",
        options: [
          "Ko'rinmas polvon / sehrgar",
          "Bosh agronom",
          "Traktorchi",
          "Mirishkor paxtakor"
        ],
        correctOptionIndex: 0,
        explanation: "Odamlar uni ko'rinmay turib ish qilganini ko'rib hayratga tushishadi."
      },
      {
        id: 'dev-6',
        type: 'multiple-choice',
        question: "Qissada 'Sariq dev' ramziy ma'noda nimani anglatadi?",
        options: [
          "Sariq tusdagi avtomashina (kichik avtobus / 'Moskvich') va uning sarguzashtlari",
          "Haqiqiy afsonaviy devni",
          "Qum bo'ronini",
          "Yovvoyi hayvonni"
        ],
        correctOptionIndex: 0,
        explanation: "Asarda Hoshimjon minib yurgan sariq rangli mashina sariq dev deb ataladi."
      },
      {
        id: 'dev-7',
        type: 'multiple-choice',
        question: "Hoshimjon yakunda qanday muhim xulosaga keladi?",
        options: [
          "Bilim va halol mehnatsiz chinakam baxtga erishib bo'lmaydi",
          "Sehrli buyumlar eng zo'r yordamchi",
          "Maktabga bormasdan ham yashasa bo'ladi",
          "Kattalarga gap qaytarish kerak"
        ],
        correctOptionIndex: 0,
        explanation: "Hoshimjon sehr-jodu bilan baxt topib bo'lmasligini, faqat ilm va mehnat qadrli ekanini anglaydi."
      },
      {
        id: 'dev-8',
        type: 'multiple-choice',
        question: "Hoshimjonning onasi unga qanday munosabatda edi?",
        options: [
          "Mehribon, lekin o'g'lining yalqovligidan kuyinuvchi ona",
          "Juda qattiqqo'l va zolim",
          "O'g'liga mutlaqo e'tibor bermaydigan",
          "Doim uni maqtab turuvchi"
        ],
        correctOptionIndex: 0,
        explanation: "Onasi mehribon bo'lib, o'g'lining odobli va bilimli bo'lishini chin dildan istaydi."
      },
      {
        id: 'dev-9',
        type: 'multiple-choice',
        question: "Hoshimjon futbol o'yinida qanday hiyla ishlatadi?",
        options: [
          "Ko'rinmas bo'lib to'pni darvozaga kiritib yuboradi",
          "Hakamning hushtagini olib qo'yadi",
          "Raqib darvozabonining ko'zini bog'laydi",
          "Darvoza to'rini yirtadi"
        ],
        correctOptionIndex: 0,
        explanation: "Ko'rinmas holda maydonga tushib, kutilmagan gollar urilishiga sabab bo'ladi."
      },
      {
        id: 'dev-10',
        type: 'multiple-choice',
        question: "Qissadagi do'sti Doniyor qanday bola edi?",
        options: [
          "A'lochi, mehnatkash va tartibli",
          "Hoshimjondan ham sho'xroq",
          "Qo'rqoq va yig'loqi",
          "Faqat sport bilan shug'ullanadigan"
        ],
        correctOptionIndex: 0,
        explanation: "Doniyor Hoshimjonga ibrat bo'la oladigan tirishqoq o'quvchi edi."
      },
      {
        id: 'dev-11',
        type: 'multiple-choice',
        question: "Xudoyberdi To'xtaboyev ushbu asari uchun qanday unvonlarga sazovor bo'lgan?",
        options: [
          "O'zbekiston xalq yozuvchisi",
          "Qahramon unvoni",
          "Xalq artisti",
          "Akademik"
        ],
        correctOptionIndex: 0,
        explanation: "Xudoyberdi To'xtaboyev O'zbekiston xalq yozuvchisi faxriy unvoniga sazovor bo'lgan."
      },
      {
        id: 'dev-12',
        type: 'multiple-choice',
        question: "Hoshimjon sarguzashtlari davomida qayerlarga borib qoladi?",
        options: [
          "Toshkent, paxta dalalari, lagerlar va chekka qishloqlar",
          "Faqat o'z hovlisida qoladi",
          "Olis xorijiy mamlakatlarga",
          "Koinotga"
        ],
        correctOptionIndex: 0,
        explanation: "Hoshimjon qishlog'idan poytaxtgacha bo'lgan yo'llarda turli voqealarni boshdan kechiradi."
      },
      {
        id: 'dev-13',
        type: 'multiple-choice',
        question: "Sehrli qalpoqcha Hoshimjonga qanday muammolar tug'dirdi?",
        options: [
          "Odamlardan ajralib qolish, yolg'izlik va vijdon azobi",
          "Pulining ko'payib ketishi",
          "Kasal bo'lib qolishi",
          "Qalpoqchaning kuyib ketishi"
        ],
        correctOptionIndex: 0,
        explanation: "U yaqinlari bilan birga bo'lolmay, yolg'izlik va xiyonatkorlik azobini his qiladi."
      },
      {
        id: 'dev-14',
        type: 'multiple-choice',
        question: "Asar qaysi janrga mansub?",
        options: [
          "Badiiy-fantastik qissa / sarguzasht",
          "Tarixiy doston",
          "Tragediya",
          "Epos"
        ],
        correctOptionIndex: 0,
        explanation: "Asar bolalar uchun sarguzasht va fantastika unsurlariga boy qissadir."
      },
      {
        id: 'dev-15',
        type: 'multiple-choice',
        question: "Hoshimjon o'z qalpoqchasini oxirida nima qiladi?",
        options: [
          "Undan voz kechib, o'z kuchi bilan o'qishga ahd qiladi",
          "Bozorda sotadi",
          "Do'stiga sovg'a qiladi",
          "Daryoga oqizib yuboradi"
        ],
        correctOptionIndex: 0,
        explanation: "U sehrdan voz kechib, haqiqiy bilim olishga qaror qiladi."
      },

      // Yozma savollar
      {
        id: 'dev-w1',
        type: 'written',
        question: "Asar bosh qahramonining familiyasi nima va u qaysi sinfda o'qirdi?",
        expectedAnswer: "Hoshimjon Ro'ziyev, 5-sinf o'quvchisi.",
        keywords: ["Ro'ziyev", "Hoshimjon", "5-sinf", "5"]
      },
      {
        id: 'dev-w2',
        type: 'written',
        question: "Hoshimjonga ko'rinmas bo'lish imkonini bergan buyum qayerdan topilgan edi?",
        expectedAnswer: "Eski sandiq ichidan topib olgan sehrli qalpoqcha.",
        keywords: ["sandiq", "qalpoqcha", "bobo"]
      },
      {
        id: 'dev-w3',
        type: 'written',
        question: "Hoshimjon paxta dalasida qaysi qiz bilan tanishadi va uni hayratda qoldiradi?",
        expectedAnswer: "Oysuluv (yoki paxtakor qizlar).",
        keywords: ["Oysuluv", "paxtakor"]
      },
      {
        id: 'dev-w4',
        type: 'written',
        question: "Ushbu qissaning asosiy tarbiyaviy g'oyasi nimadan iborat?",
        expectedAnswer: "Mehnat qilmasdan, o'qimasdan hech qanday yutuqqa erishib bo'lmasligi, halol mehnat va ilm insonni ulug'lashi.",
        keywords: ["mehnat", "ilm", "halol", "o'qish"]
      },
      {
        id: 'dev-w5',
        type: 'written',
        question: "Asar muallifi Xudoyberdi To'xtaboyevning yana qanday mashhur qissalarini bilasiz?",
        expectedAnswer: "'Besh bolali yigitcha', 'Shirin qovunlar mamlakati', 'Mungli ko'zlar', 'Sehrgarlar jangi'.",
        keywords: ["Besh bolali", "Shirin qovunlar", "Mungli ko'zlar", "Sehrgarlar"]
      }
    ]
  },
  {
    id: 'book-3',
    title: "Shum bola",
    author: "G'afur G'ulom",
    grade: "6-sinf (6-A, 6-B, 6-D)",
    coverColor: "from-blue-600 to-indigo-800",
    description: "Avtobiografik qissa. 20-asr boshlaridagi xalq hayoti, shum bolaning o'tkir zakovati, hayot qiyinchiliklarini kulgi va hazil bilan yengib o'tishi.",
    createdAt: "2026-02-01",
    questions: [
      {
        id: 'shum-1',
        type: 'multiple-choice',
        question: "Shum bolaning asl ismi nima edi?",
        options: [
          "Qoravoy",
          "Omon",
          "Hoshim",
          "Salim"
        ],
        correctOptionIndex: 0,
        explanation: "Asarda qahramonning ismi Qoravoy deb aytiladi."
      },
      {
        id: 'shum-2',
        type: 'multiple-choice',
        question: "Qoravoy uyidan nima sababdan bosh olib chiqib ketadi?",
        options: [
          "Bıldırcın (bedana) qafasini sindirib qo'ygani va kaltakdan qo'rqqani uchun",
          "Boy bo'lish niyatida",
          "Sayohat qilish maqsadida",
          "Shaharga o'qishga kirgani uchun"
        ],
        correctOptionIndex: 0,
        explanation: "U tog'asining bedanasini uchirib yuborib, jazolanishdan qo'rqib qochadi."
      },
      {
        id: 'shum-3',
        type: 'multiple-choice',
        question: "Shum bolaning sadoqatli do'sti kim edi?",
        options: [
          "Omon",
          "Sultonxon",
          "Sodiq",
          "To'xtasin"
        ],
        correctOptionIndex: 0,
        explanation: "Qoravoy bilan birga sarson-sargardon bo'lgan do'sti Omondir."
      },
      {
        id: 'shum-4',
        type: 'multiple-choice',
        question: "Shum bola qaysi boyning uyida xizmatkorlik qiladi?",
        options: [
          "Hoji bobo va boyvachchalar xonadonida",
          "Mirzakarim qutidor uyida",
          "Salimboyvachcha uyida",
          "Qodirxon to'ra uyida"
        ],
        correctOptionIndex: 0,
        explanation: "U boylarning eshigida xizmatkor bo'lib, ularning ochko'zligini fosh etadi."
      },
      {
        id: 'shum-5',
        type: 'multiple-choice',
        question: "Qoravoy devonalarga qo'shilib qanday laqab oladi?",
        options: [
          "Devonavachcha",
          "Qalandar",
          "Shoir",
          "Donishmand"
        ],
        correctOptionIndex: 0,
        explanation: "Devonalar davrasida u o'zini qiziq hangomalar bilan ko'rsatadi."
      },
      {
        id: 'shum-6',
        type: 'multiple-choice',
        question: "Shum bola qaysi hunarni egallashga urinadi?",
        options: [
          "To'quvchilik, etikdo'zlik, chinnipazlik",
          "Duradgorlik",
          "Zargarlik",
          "Ko'nchilik"
        ],
        correctOptionIndex: 0,
        explanation: "U turli ustalarning qo'lida shogirdlik qilib ko'radi."
      },
      {
        id: 'shum-7',
        type: 'multiple-choice',
        question: "Asarda qaysi davr voqealari aks ettirilgan?",
        options: [
          "Birinchi jahon urushi arafasi va Chor Rossiyasi mustamlakachiligi davri",
          "Ikkinchi jahon urushi",
          "Temuriylar davri",
          "Mustaqillik yillari"
        ],
        correctOptionIndex: 0,
        explanation: "20-asr boshlari, Turkiston xalqining og'ir ijtimoiy ahvoli tasvirlangan."
      },
      {
        id: 'shum-8',
        type: 'multiple-choice',
        question: "G'afur G'ulom bu qissani qanday ohangda yozgan?",
        options: [
          "Achchiq kinoya, samimiy yumor va yengil hazil bilan",
          "Qorong'i va fojiali",
          "Faqat falsafiy",
          "Rasmiy hisobot uslubida"
        ],
        correctOptionIndex: 0,
        explanation: "G'afur G'ulom o'zbek xalqona mutoyibasi va kulgusi orqali fojialarni ko'rsatadi."
      },
      {
        id: 'shum-9',
        type: 'multiple-choice',
        question: "Shum bola qaysi xonadonda tovuqlarni aldab ovqatlanish voqeasini boshdan kechiradi?",
        options: [
          "Boyning bog'ida va qishloq xonadonlarida",
          "Choyxonada",
          "Madrasada",
          "Bozor o'rtasida"
        ],
        correctOptionIndex: 0,
        explanation: "U o'zining topqirligi bilan qornini to'ydirish yo'llarini topadi."
      },
      {
        id: 'shum-10',
        type: 'multiple-choice',
        question: "Asar asosida suratga olingan mashhur o'zbek badiiy filmi qanday ataladi?",
        options: [
          "'Shum bola'",
          "'Mahallada duv-duv gap'",
          "'Maftuningman'",
          "'Suyunchi'"
        ],
        correctOptionIndex: 0,
        explanation: "Damir Salimov tomonidan suratga olingan 'Shum bola' filmi mashhurdir."
      },
      {
        id: 'shum-11',
        type: 'multiple-choice',
        question: "Qoravoyning qaysi xislati unga hayot sinovlarida yordam beradi?",
        options: [
          "Zukkoligi, topqirligi va tushkunlikka tushmasligi",
          "Jismoniy bahodirligi",
          "Boy qarindoshlari borligi",
          "Sehrli kuchlarga tayanishi"
        ],
        correctOptionIndex: 0,
        explanation: "U har qanday nochor vaziyatdan aql va kulgi bilan chiqib ketadi."
      },
      {
        id: 'shum-12',
        type: 'multiple-choice',
        question: "Shum bolaning tog'asi qanday kasb egasi edi?",
        options: [
          "Bedanaboz va savdogar",
          "O'qituvchi",
          "Shifokor",
          "Shoir"
        ],
        correctOptionIndex: 0,
        explanation: "Tog'asi bedana parvarishlovchi qattiqqo'l kishi bo'lgan."
      },
      {
        id: 'shum-13',
        type: 'multiple-choice',
        question: "Shum bola qissasidagi bosh qahramon qaysi shahardan bo'lgan?",
        options: [
          "Toshkent",
          "Samarqand",
          "Qo'qon",
          "Buxoro"
        ],
        correctOptionIndex: 0,
        explanation: "Qoravoy Toshkent shahrining eski shahar qismidan bo'lgan."
      },
      {
        id: 'shum-14',
        type: 'multiple-choice',
        question: "Qoravoyning sarsonliklari oxirida u qayerga qaytadi?",
        options: [
          "O'z uyiga, onasi va singillarining bag'riga",
          "Xorijga ketadi",
          "Armiyaga yoziladi",
          "Tog'da qolib ketadi"
        ],
        correctOptionIndex: 0,
        explanation: "U uzoq sarsonliklardan so'ng o'z ona uyiga qaytib keladi."
      },
      {
        id: 'shum-15',
        type: 'multiple-choice',
        question: "G'afur G'ulom qissada xalqning qaysi toifasiga hamdardlik bildiradi?",
        options: [
          "Yetim-yesirlar, kambag'allar va mehnatkash omma",
          "Zolim boylar",
          "Mustamlakachi amaldorlar",
          "Faqat savdogarlar"
        ],
        correctOptionIndex: 0,
        explanation: "Yozuvchi xalqning nochor, ammo samimiy qatlamiga katta mehr bilan qaraydi."
      },

      // Yozma savollar
      {
        id: 'shum-w1',
        type: 'written',
        question: "'Shum bola' qissasining muallifi kim va u o'zbek adabiyotida qanday unvonga ega bo'lgan?",
        expectedAnswer: "G'afur G'ulom, O'zbekiston xalq shoiri va akademik.",
        keywords: ["G'afur G'ulom", "xalq shoiri", "akademik"]
      },
      {
        id: 'shum-w2',
        type: 'written',
        question: "Qoravoy uyidan qochishiga sabab bo'lgan voqeani qisqacha bayon qiling.",
        expectedAnswer: "Tog'asining qimmatbaho sayroqi bedanasini tasodifan uchirib yuborgani sababli kaltakdan qo'rqib qochadi.",
        keywords: ["bedana", "tog'a", "uchirib", "qo'rqib"]
      },
      {
        id: 'shum-w3',
        type: 'written',
        question: "Shum bola bilan birga kezgan eng yaqin do'stining ismi nima?",
        expectedAnswer: "Omon.",
        keywords: ["Omon"]
      },
      {
        id: 'shum-w4',
        type: 'written',
        question: "Qissadagi kulgi va yumorning asosiy vazifasi nima edi?",
        expectedAnswer: "Og'ir va mashaqqatli hayot sharoitlariga qaramay, insoniy umid va matonatni saqlab qolish, boylarning illatlarini fosh qilish.",
        keywords: ["matonat", "umid", "fosh", "kulgi", "hayot"]
      },
      {
        id: 'shum-w5',
        type: 'written',
        question: "Shum bola qaysi hunarlarda o'zini sinab ko'rgan (kamida 2 tasini yozing)?",
        expectedAnswer: "To'quvchilik, etikdo'zlik, novvoylik, xizmatkorlik.",
        keywords: ["to'quvchi", "etikdo'z", "novvoy", "xizmatkor"]
      }
    ]
  }
];
