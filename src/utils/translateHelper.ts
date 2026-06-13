import { LangCode } from '../i18n/LanguageContext';

// Dictionary of translations for common database strings (qualifications, states, organizations)
const STATE_MAP: Record<LangCode, Record<string, string>> = {
  en: {},
  hi: {
    'All India': 'अखिल भारतीय',
    'Andhra Pradesh': 'आंध्र प्रदेश',
    'Arunachal Pradesh': 'अरुणाचल प्रदेश',
    'Assam': 'असम',
    'Bihar': 'बिहार',
    'Chhattisgarh': 'छत्तीसगढ़',
    'Goa': 'गोवा',
    'Gujarat': 'गुजरात',
    'Haryana': 'हरियाणा',
    'Himachal Pradesh': 'हिमाचल प्रदेश',
    'Jharkhand': 'झारखंड',
    'Karnataka': 'कर्नाटक',
    'Kerala': 'केरल',
    'Madhya Pradesh': 'मध्य प्रदेश',
    'Maharashtra': 'महाराष्ट्र',
    'Manipur': 'मणिपुर',
    'Meghalaya': 'मेघालय',
    'Mizoram': 'मिजोरम',
    'Nagaland': 'नागालैंड',
    'Odisha': 'ओडिशा',
    'Punjab': 'पंजाब',
    'Rajasthan': 'राजस्थान',
    'Sikkim': 'सिक्किम',
    'Tamil Nadu': 'तमिलनाडु',
    'Telangana': 'तेलंगाना',
    'Tripura': 'त्रिपुरा',
    'Uttar Pradesh': 'उत्तर प्रदेश',
    'Uttarakhand': 'उत्तराखंड',
    'West Bengal': 'पश्चिम बंगाल',
    'Delhi': 'दिल्ली',
    'Jammu & Kashmir': 'जम्मू और कश्मीर',
    'Puducherry': 'पुडुचेरी'
  },
  ta: {
    'All India': 'அகில இந்திய',
    'Andhra Pradesh': 'ஆந்திரப் பிரதேசம்',
    'Arunachal Pradesh': 'அருணாச்சலப் பிரதேசம்',
    'Assam': 'அசாம்',
    'Bihar': 'பீகார்',
    'Chhattisgarh': 'சத்தீஸ்கர்',
    'Goa': 'கோவா',
    'Gujarat': 'குஜராத்',
    'Haryana': 'ஹரியானா',
    'Himachal Pradesh': 'இமாச்சலப் பிரதேசம்',
    'Jharkhand': 'ஜார்க்கண்ட்',
    'Karnataka': 'கர்நாடகா',
    'Kerala': 'கேரளா',
    'Madhya Pradesh': 'மத்திய பிரதேசம்',
    'Maharashtra': 'மகாராஷ்டிரா',
    'Manipur': 'மணிப்பூர்',
    'Meghalaya': 'மேகாலயா',
    'Mizoram': 'மிசோரம்',
    'Nagaland': 'நாகாலாந்து',
    'Odisha': 'ஒடிசா',
    'Punjab': 'பஞ்சாப்',
    'Rajasthan': 'ராஜஸ்தான்',
    'Sikkim': 'சிக்கிம்',
    'Tamil Nadu': 'தமிழ்நாடு',
    'Telangana': 'தெலுங்கானா',
    'Tripura': 'திரிபுரா',
    'Uttar Pradesh': 'உத்தரப் பிரதேசம்',
    'Uttarakhand': 'உத்தரகண்ட்',
    'West Bengal': 'மேற்கு வங்காளம்',
    'Delhi': 'டெல்லி',
    'Jammu & Kashmir': 'ஜம்மு காஷ்மீர்',
    'Puducherry': 'புதுச்சேரி'
  },
  bn: {
    'All India': 'সর্বভারতীয়',
    'Andhra Pradesh': 'অন্ধ্রপ্রদেশ',
    'Arunachal Pradesh': 'অরুণাচল প্রদেশ',
    'Assam': 'আসাম',
    'Bihar': 'বিহার',
    'Chhattisgarh': 'ছত্তিশগড়',
    'Goa': 'গোয়া',
    'Gujarat': 'গুজরাট',
    'Haryana': 'হরিয়ানা',
    'Himachal Pradesh': 'হিমাচল প্রদেশ',
    'Jharkhand': 'ঝাড়খণ্ড',
    'Karnataka': 'কর্ণাটক',
    'Kerala': 'কেরল',
    'Madhya Pradesh': 'মধ্যপ্রদেশ',
    'Maharashtra': 'মহারাষ্ট্র',
    'Manipur': 'মণিপুর',
    'Meghalaya': 'মেঘালয়',
    'Mizoram': 'মিজোরাম',
    'Nagaland': 'নাগাল্যান্ড',
    'Odisha': 'ওড়িশা',
    'Punjab': 'পাঞ্জাব',
    'Rajasthan': 'রাজস্থান',
    'Sikkim': 'সিকিম',
    'Tamil Nadu': 'তামিলনাড়ু',
    'Telangana': 'তেলেঙ্গানা',
    'Tripura': 'ত্রিপুরা',
    'Uttar Pradesh': 'উত্তরপ্রদেশ',
    'Uttarakhand': 'উত্তরাখণ্ড',
    'West Bengal': 'পশ্চিমবঙ্গ',
    'Delhi': 'দিল্লি',
    'Jammu & Kashmir': 'জম্মু ও কাশ্মীর',
    'Puducherry': 'পুদুচেরি'
  },
  te: {}, mr: {}, kn: {}, ml: {}, gu: {}, pa: {}, or: {}
};

const QUALIFICATION_MAP: Record<LangCode, Record<string, string>> = {
  en: {},
  hi: {
    '10th': '10वीं कक्षा (मैट्रिक)',
    'Class 10': '10वीं कक्षा (मैट्रिक)',
    '12th': '12वीं कक्षा (इंटरमीडिएट)',
    'Class 12': '12वीं कक्षा (इंटरमीडिएट)',
    'Diploma': 'डिप्लोमा धारक',
    'Graduation': 'स्नातक (Graduation)',
    'Post Graduation': 'स्नातकोत्तर (Post Graduation)',
    'PhD': 'पीएचडी',
    'Refer Official Notification': 'आधिकारिक अधिसूचना देखें'
  },
  ta: {
    '10th': '10 ஆம் வகுப்பு (எஸ்எஸ்எல்சி)',
    'Class 10': '10 ஆம் வகுப்பு (எஸ்எஸ்எல்சி)',
    '12th': '12 ஆம் வகுப்பு (எச்எஸ்சி)',
    'Class 12': '12 ஆம் வகுப்பு (எச்எஸ்சி)',
    'Diploma': 'டிப்ளமோ',
    'Graduation': 'பட்டப்படிப்பு (Graduation)',
    'Post Graduation': 'முதுகலை (Post Graduation)',
    'PhD': 'முனைவர் பட்டம் (PhD)',
    'Refer Official Notification': 'அதிகாரப்பூர்வ அறிவிப்பைப் பார்க்கவும்'
  },
  bn: {
    '10th': 'দশম শ্রেণী (মাধ্যমিক)',
    'Class 10': 'দশম শ্রেণী (মাধ্যমিক)',
    '12th': 'দ্বাদশ শ্রেণী (উচ্চ মাধ্যমিক)',
    'Class 12': 'দ্বাদশ শ্রেণী (উচ্চ মাধ্যমিক)',
    'Diploma': 'ডিপ্লোমা',
    'Graduation': 'স্নাতক (Graduation)',
    'Post Graduation': 'স্নাতকোত্তর (Post Graduation)',
    'PhD': 'পিএইচডি (PhD)',
    'Refer Official Notification': 'অফিসিয়াল বিজ্ঞপ্তি দেখুন'
  },
  te: {}, mr: {}, kn: {}, ml: {}, gu: {}, pa: {}, or: {}
};

const ORGANIZATION_MAP: Record<LangCode, Record<string, string>> = {
  en: {},
  hi: {
    'UPSC': 'संघ लोक सेवा आयोग (UPSC)',
    'Union Public Service Commission': 'संघ लोक सेवा आयोग (UPSC)',
    'UNION PUBLIC SERVICE COMMISSION': 'संघ लोक सेवा आयोग (UPSC)',
    'Airports Authority of India': 'भारतीय विमानपत्तन प्राधिकरण (AAI)',
    'Airports Authority Of India': 'भारतीय विमानपत्तन प्राधिकरण (AAI)',
    'AAI': 'भारतीय विमानपत्तन प्राधिकरण (AAI)',
    'Ministry of Defence': 'रक्षा मंत्रालय (Ministry of Defence)',
    'Ministry of Railways': 'रेल मंत्रालय (Ministry of Railways)',
    'Staff Selection Commission': 'कर्मचारी चयन आयोग (SSC)',
    'Indian Railways': 'भारतीय रेलवे',
    'Indian Army': 'भारतीय थल सेना',
    'Indian Navy': 'भारतीय नौसेना',
    'Indian Air Force': 'भारतीय वायु सेना',
    'State Bank of India': 'भारतीय स्टेट बैंक (SBI)',
    'Reserve Bank of India': 'भारतीय रिज़र्व बैंक (RBI)',
    'National Testing Agency': 'राष्ट्रीय परीक्षा एजेंसी (NTA)'
  },
  ta: {
    'UPSC': 'மத்திய அரசுப் பணியாளர் தேர்வாணையம் (UPSC)',
    'Union Public Service Commission': 'மத்திய அரசுப் பணியாளர் தேர்வாணையம் (UPSC)',
    'UNION PUBLIC SERVICE COMMISSION': 'மத்திய அரசுப் பணியாளர் தேர்வாணையம் (UPSC)',
    'Airports Authority of India': 'இந்திய வானூர்தி நிலையங்கள் ஆணையம் (AAI)',
    'Airports Authority Of India': 'இந்திய வானூர்தி நிலையங்கள் ஆணையம் (AAI)',
    'AAI': 'இந்திய வானூர்தி நிலையங்கள் ஆணையம் (AAI)',
    'Ministry of Defence': 'பாதுகாப்பு அமைச்சகம் (Ministry of Defence)',
    'Ministry of Railways': 'இரயில்வே அமைச்சகம் (Ministry of Railways)',
    'Staff Selection Commission': 'பணியாளர் தேர்வாணையம் (SSC)',
    'Indian Railways': 'இந்திய இரயில்வே',
    'Indian Army': 'இந்திய ராணுவம்',
    'Indian Navy': 'இந்திய கடற்படை',
    'Indian Air Force': 'இந்திய விமானப்படை',
    'State Bank of India': 'பாரத ஸ்டேட் வங்கி (SBI)',
    'Reserve Bank of India': 'இந்திய ரிசர்வ் வங்கி (RBI)',
    'National Testing Agency': 'தேசிய தேர்வு முகமை (NTA)'
  },
  bn: {
    'UPSC': 'কেন্দ্রীয় লোকসেবা আয়োগ (UPSC)',
    'Union Public Service Commission': 'কেন্দ্রীয় লোকসেবা আয়োগ (UPSC)',
    'UNION PUBLIC SERVICE COMMISSION': 'কেন্দ্রীয় লোকসেবা আয়োগ (UPSC)',
    'Airports Authority of India': 'ভারতীয় বিমানবন্দর কর্তৃপক্ষ (AAI)',
    'Airports Authority Of India': 'ভারতীয় বিমানবন্দর কর্তৃপক্ষ (AAI)',
    'AAI': 'ভারতীয় বিমানবন্দর কর্তৃপক্ষ (AAI)',
    'Ministry of Defence': 'প্রতিরক্ষা মন্ত্রণালয় (Ministry of Defence)',
    'Ministry of Railways': 'রেল মন্ত্রণালয় (Ministry of Railways)',
    'Staff Selection Commission': 'কর্মচারী নির্বাচন কমিশন (SSC)',
    'Indian Railways': 'ভারতীয় রেলওয়ে',
    'Indian Army': 'ভারতীয় সেনাবাহিনী',
    'Indian Navy': 'ভারতীয় নৌবাহিনী',
    'Indian Air Force': 'ভারতীয় বিমানবাহিনী',
    'State Bank of India': 'ভারতীয় স্টেট ব্যাঙ্ক (SBI)',
    'Reserve Bank of India': 'ভারতীয় রিজার্ভ ব্যাঙ্ক (RBI)',
    'National Testing Agency': 'জাতীয় পরীক্ষা সংস্থা (NTA)'
  },
  te: {}, mr: {}, kn: {}, ml: {}, gu: {}, pa: {}, or: {}
};

const TERM_MAP: Record<LangCode, Record<string, string>> = {
  en: {},
  hi: {
    'civil services': 'सिविल सेवा',
    'AAI': 'एएआई (AAI)',
    'GATE': 'गेट (GATE)',
    'AFCAT': 'एएफसीएटी (AFCAT)',
    'executive trainee': 'कार्यकारी प्रशिक्षु (Executive Trainee)',
    'senior assistant': 'वरिष्ठ सहायक (Senior Assistant)',
    'tradesman': 'ट्रेड्समैन (Tradesman)',
    'supervisor': 'पर्यवेक्षक (Supervisor)',
    'trainee': 'प्रशिक्षु (Trainee)',
    'engineer': 'अभियंता (Engineer)',
    'flying': 'फ्लाइंग (Flying)',
    'technical': 'तकनीकी (Technical)',
    'ground duty': 'ग्राउंड ड्यूटी (Ground Duty)',
    'examination': 'परीक्षा',
    'constable': 'कांस्टेबल (आरक्षक)',
    'head constable': 'हेड कांस्टेबल (प्रधान आरक्षक)',
    'sub inspector': 'सब इंस्पेक्टर (उपनिरीक्षक)',
    'assistant sub inspector': 'सहायक उपनिरीक्षक (ASI)',
    'junior engineer': 'कनिष्ठ अभियंता (JE)',
    'assistant engineer': 'सहायक अभियंता (AE)',
    'teacher': 'शिक्षक',
    'assistant professor': 'सहायक प्रोफेसर',
    'clerk': 'लिपिक (क्लर्क)',
    'sweeper': 'सफाई कर्मचारी',
    'peon': 'चपरासी',
    'lineman': 'लाइनमैन',
    'technician': 'तकनीशियन',
    'postman': 'डाकिया',
    'auditor': 'लेखा परीक्षक (ऑडिटर)',
    'accountant': 'लेखाकार (अकाउंटेंट)',
    'scientific officer': 'वैज्ञानिक अधिकारी',
    'technical assistant': 'तकनीकी सहायक',
    'management trainee': 'प्रबंधन प्रशिक्षु',
    'apprentice': 'अपरेंटिस',
    'executive assistant': 'अधिशासी सहायक',
    'officer': 'अधिकारी',
    'recruitment': 'भर्ती',
    'district': 'जिला',
    'state': 'राज्य',
    'high court': 'उच्च न्यायालय',
    'supreme court': 'उच्चतम न्यायालय',
    'board': 'बोर्ड',
    'commission': 'आयोग',
    'university': 'विश्वविद्यालय',
    'department': 'विभाग',
    'ministry': 'मंत्रालय'
  },
  ta: {
    'civil services': 'குடிமைப் பணிகள்',
    'AAI': 'ஏஏஐ (AAI)',
    'GATE': 'கேட் (GATE)',
    'AFCAT': 'ஏஎஃப்கேடி (AFCAT)',
    'executive trainee': 'நிர்வாகப் பயிற்சிபெறுநர் (Executive Trainee)',
    'senior assistant': 'முதுநிலை உதவியாளர் (Senior Assistant)',
    'tradesman': 'வர்த்தகர் (Tradesman)',
    'supervisor': 'கண்காணிப்பாளர் (Supervisor)',
    'trainee': 'பயிற்சிபெறுநர் (Trainee)',
    'engineer': 'பொறியாளர் (Engineer)',
    'flying': 'பறக்கும் பிரிவு (Flying)',
    'technical': 'தொழில்நுட்ப (Technical)',
    'ground duty': 'தரைப்பணி (Ground Duty)',
    'examination': 'தேர்வு',
    'constable': 'காவலர் (கான்ஸ்டபிள்)',
    'head constable': 'தலைமைக் காவலர்',
    'sub inspector': 'துணை ஆய்வாளர் (SI)',
    'assistant sub inspector': 'உதவி துணை ஆய்வாளர் (ASI)',
    'junior engineer': 'இளநிலைப் பொறியாளர் (JE)',
    'assistant engineer': 'உதவிப் பொறியாளர் (AE)',
    'teacher': 'ஆசிரியர்',
    'assistant professor': 'உதவிப் பேராசிரியர்',
    'clerk': 'எழுத்தர்',
    'sweeper': 'துப்புரவு பணியாளர்',
    'peon': 'அலுவலக உதவியாளர்',
    'lineman': 'லைன்மேன்',
    'technician': 'தொழில்நுட்ப வல்லுநர்',
    'postman': 'தபால்காரர்',
    'auditor': 'தணிக்கையாளர்',
    'accountant': 'கணக்காளர்',
    'scientific officer': 'அறிவியல் அதிகாரி',
    'technical assistant': 'தொழில்நுட்ப உதவியாளர்',
    'management trainee': 'மேலாண்மை பயிற்சிபெறுநர்',
    'apprentice': 'தொழில் பழகுநர்',
    'executive assistant': 'நிர்வாக உதவியாளர்',
    'officer': 'அதிகாரி',
    'recruitment': 'ஆள்சேர்ப்பு',
    'district': 'மாவட்டம்',
    'state': 'மாநில',
    'high court': 'உயர் நீதிமன்றம்',
    'supreme court': 'உச்ச நீதிமன்றம்',
    'board': 'வாரியம்',
    'commission': 'ஆணையம்',
    'university': 'பல்கலைக்கழகம்',
    'department': 'துறை',
    'ministry': 'அமைச்சகம்'
  },
  bn: {
    'civil services': 'সিভিল সার্ভিস',
    'AAI': 'এএআই (AAI)',
    'GATE': 'গেট (GATE)',
    'AFCAT': 'এএফক্যাট (AFCAT)',
    'executive trainee': 'নির্বাহী শিক্ষানবিস (Executive Trainee)',
    'senior assistant': 'সিনিয়র অ্যাসিস্ট্যান্ট (Senior Assistant)',
    'tradesman': 'ট্রেডসম্যান (Tradesman)',
    'supervisor': 'সুপারভাইজার (Supervisor)',
    'trainee': 'শিক্ষানবিস (Trainee)',
    'engineer': 'প্রকৌশলী (Engineer)',
    'flying': 'ফ্লাইং (Flying)',
    'technical': 'কারিগরি (Technical)',
    'ground duty': 'গ্রাউন্ড ডিউটি (Ground Duty)',
    'examination': 'পরীক্ষা',
    'constable': 'কনস্টেবল',
    'head constable': 'হেড কনস্টেবল',
    'sub inspector': 'সাব ইন্সপেক্টর (SI)',
    'assistant sub inspector': 'সহকারী সাব ইন্সপেক্টর (ASI)',
    'junior engineer': 'জুনিয়র ইঞ্জিনিয়ার (JE)',
    'assistant engineer': 'অ্যাসিস্ট্যান্ট ইঞ্জিনিয়ার (AE)',
    'teacher': 'শিক্ষক',
    'assistant professor': 'সহকারী অধ্যাপক',
    'clerk': 'কেরানি',
    'sweeper': 'ঝাড়ুদার',
    'peon': 'পিয়ন (দপ্তরি)',
    'lineman': 'লাইনম্যান',
    'technician': 'টেকনিশিয়ান',
    'postman': 'পিওন (ডাক পিয়ন)',
    'auditor': 'অডিটর',
    'accountant': 'অ্যাকাউন্ট্যান্ট',
    'scientific officer': 'বৈজ্ঞানিক কর্মকর্তা',
    'technical assistant': 'কারিগরি সহকারী',
    'management trainee': 'ম্যানেজমেন্ট ট্রেইনি',
    'apprentice': 'শিক্ষানবিস',
    'executive assistant': 'নির্বাহী সহকারী',
    'officer': 'অফিসার (কর্মকর্তা)',
    'recruitment': 'নিয়োগ',
    'district': 'জেলা',
    'state': 'রাজ্য',
    'high court': 'হাইকোর্ট',
    'supreme court': 'সুপ্রিম কোর্ট',
    'board': 'বোর্ড',
    'commission': 'কমিশন',
    'university': 'বিশ্ববিদ্যালয়',
    'department': 'বিভাগ',
    'ministry': 'মন্ত্রণালয়'
  },
  te: {}, mr: {}, kn: {}, ml: {}, gu: {}, pa: {}, or: {}
};

const CATEGORY_MAP: Record<LangCode, Record<string, string>> = {
  en: {},
  hi: {
    'Agriculture': 'कृषि (Agriculture)',
    'Banking': 'बैंकिंग (Banking)',
    'Central Government': 'केंद्र सरकार (Central Govt)',
    'Cooperative': 'सहकारी (Cooperative)',
    'Defence': 'रक्षा (Defence)',
    'Engineering': 'इंजीनियरिंग (Engineering)',
    'Entrance Exam': 'प्रवेश परीक्षा (Entrance Exam)',
    'Forest & Environment': 'वन और पर्यावरण (Forest & Env)',
    'Healthcare': 'स्वास्थ्य सेवा (Healthcare)',
    'Insurance': 'बीमा (Insurance)',
    'Judiciary': 'न्यायपालिका (Judiciary)',
    'Police': 'पुलिस (Police)',
    'PSU': 'सार्वजनिक उपक्रम (PSU)',
    'Railways': 'रेलवे (Railways)',
    'Research & Science': 'अनुसंधान और विज्ञान',
    'Shipping & Ports': 'शिपिंग और बंदरगाह',
    'SSC': 'कर्मचारी चयन आयोग (SSC)',
    'State Government': 'राज्य सरकार (State Govt)',
    'State PSCs': 'राज्य लोक सेवा आयोग (State PSCs)',
    'Teaching': 'शिक्षण (Teaching)',
    'Telecom': 'दूरसंचार (Telecom)',
    'UPSC': 'संघ लोक सेवा आयोग (UPSC)'
  },
  ta: {
    'Agriculture': 'வேளாண்மை (Agriculture)',
    'Banking': 'வங்கித் துறை (Banking)',
    'Central Government': 'மத்திய அரசு (Central Govt)',
    'Cooperative': 'கூட்டுறவு (Cooperative)',
    'Defence': 'பாதுகாப்புத் துறை (Defence)',
    'Engineering': 'பொறியியல் (Engineering)',
    'Entrance Exam': 'நுழைவுத் தேர்வு (Entrance Exam)',
    'Forest & Environment': 'காடு மற்றும் சுற்றுச்சூழல்',
    'Healthcare': 'சுகாதாரத் துறை (Healthcare)',
    'Insurance': 'காப்பீடு (Insurance)',
    'Judiciary': 'நீதித்துறை (Judiciary)',
    'Police': 'காவல்துறை (Police)',
    'PSU': 'பொதுத்துறை நிறுவனங்கள் (PSU)',
    'Railways': 'இரயில்வே (Railways)',
    'Research & Science': 'ஆராய்ச்சி மற்றும் அறிவியல்',
    'Shipping & Ports': 'கப்பல் மற்றும் துறைமுகங்கள்',
    'SSC': 'பணியாளர் தேர்வாணையம் (SSC)',
    'State Government': 'மாநில அரசு (State Govt)',
    'State PSCs': 'மாநில தேர்வாணையங்கள் (State PSCs)',
    'Teaching': 'கற்பித்தல் (Teaching)',
    'Telecom': 'தொலைத்தொடர்பு (Telecom)',
    'UPSC': 'மத்திய அரசுப் பணியாளர் தேர்வாணையம் (UPSC)'
  },
  bn: {
    'Agriculture': 'কৃষি (Agriculture)',
    'Banking': 'ব্যাঙ্কিং (Banking)',
    'Central Government': 'কেন্দ্রীয় সরকার (Central Govt)',
    'Cooperative': 'সমবায় (Cooperative)',
    'Defence': 'প্রতিরক্ষা (Defence)',
    'Engineering': 'ইঞ্জিনিয়ারিং (Engineering)',
    'Entrance Exam': 'প্রবেশিকা পরীক্ষা (Entrance Exam)',
    'Forest & Environment': 'বন ও পরিবেশ (Forest & Env)',
    'Healthcare': 'স্বাস্থ্য পরিষেবা (Healthcare)',
    'Insurance': 'বীমা (Insurance)',
    'Judiciary': 'বিচার বিভাগ (Judiciary)',
    'Police': 'পুলিশ (Police)',
    'PSU': 'রাষ্ট্রীয় সংস্থা (PSU)',
    'Railways': 'রেলওয়ে (Railways)',
    'Research & Science': 'গবেষণা ও বিজ্ঞান (Research & Science)',
    'Shipping & Ports': 'শিপিং এবং বন্দর (Shipping & Ports)',
    'SSC': 'কর্মচারী নির্বাচন কমিশন (SSC)',
    'State Government': 'রাজ্য সরকার (State Govt)',
    'State PSCs': 'রাজ্য লোকসেবা আয়োগ (State PSCs)',
    'Teaching': 'শিক্ষকতা (Teaching)',
    'Telecom': 'টেলিযোগাযোগ (Telecom)',
    'UPSC': 'কেন্দ্রীয় লোকসেবা আয়োগ (UPSC)'
  },
  te: {}, mr: {}, kn: {}, ml: {}, gu: {}, pa: {}, or: {}
};

/**
 * Translates a dynamic database string on-the-fly inside the client application.
 */
export function translateDynamicData(value: string, lang: LangCode, type: 'state' | 'qualification' | 'organization' | 'job_name' | 'category'): string {
  if (!value || typeof value !== 'string') return value;
  if (lang === 'en') return value;

  const code = lang as LangCode;
  const lookup = (value || '').trim();

  // 1. Exact or Case-Insensitive string matches
  if (type === 'state') {
    const map = STATE_MAP[code];
    if (!map) return value;
    if (map[lookup]) return map[lookup];
    const found = Object.entries(map).find(([k]) => k.toLowerCase() === lookup.toLowerCase());
    return found ? found[1] : value;
  }
  
  if (type === 'qualification') {
    const map = QUALIFICATION_MAP[code];
    if (!map) return value;
    if (map[lookup]) return map[lookup];
    const found = Object.entries(map).find(([k]) => k.toLowerCase() === lookup.toLowerCase());
    return found ? found[1] : value;
  }
  
  if (type === 'organization') {
    const map = ORGANIZATION_MAP[code];
    if (!map) return value;
    if (map[lookup]) return map[lookup];
    const found = Object.entries(map).find(([k]) => k.toLowerCase() === lookup.toLowerCase());
    return found ? found[1] : value;
  }

  if (type === 'category') {
    const map = CATEGORY_MAP[code];
    if (!map) return value;
    if (map[lookup]) return map[lookup];
    const found = Object.entries(map).find(([k]) => k.toLowerCase() === lookup.toLowerCase());
    return found ? found[1] : value;
  }

  // 2. Component/Term replacement for Job Names
  if (type === 'job_name') {
    const mappings = TERM_MAP[code];
    if (!mappings) return value;

    let translated = value;

    // Check custom state prefix translations
    const stateMappings = STATE_MAP[code];
    if (stateMappings) {
      for (const [engState, trState] of Object.entries(stateMappings)) {
        if (translated.toLowerCase().startsWith(engState.toLowerCase())) {
          const regex = new RegExp(`^${engState}`, 'i');
          translated = translated.replace(regex, trState);
        }
      }
    }

    // Sort terms by length in descending order to match multi-word terms first (e.g. "executive assistant" before "assistant")
    const sortedTerms = Object.entries(mappings).sort((a, b) => b[0].length - a[0].length);
    for (const [engWord, trWord] of sortedTerms) {
      const regex = new RegExp(`\\b${engWord}\\b`, 'gi');
      translated = translated.replace(regex, trWord);
    }

    return translated;
  }

  return value;
}
