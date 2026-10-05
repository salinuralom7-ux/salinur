/**
 * Indian cities used by search, the onboarding city picker and SEO pages.
 *
 * Tiers follow the common Tier 1 / 2 / 3 split (close to the government's
 * X / Y / Z HRA classes):
 *   1 — metros and their satellite cities
 *   2 — large cities (roughly the Y-class list)
 *   3 — other notable towns and district headquarters
 *
 * Entry format: "Name|Old name|Other name@custom-slug"
 *   - `|` adds search aliases (people still type "Gurgaon" or "Bangalore")
 *   - `@` sets the URL slug; only needed when two places share a name
 * Slugs are permanent (they're in URLs like /creators/guwahati) — never
 * change one after launch; add aliases instead.
 */
export type CityTier = 1 | 2 | 3;
export type City = { slug: string; name: string; state: string; tier: CityTier; aliases: string[] };

// [state, tier 1, tier 2, tier 3]
const RAW: [string, string[], string[], string[]][] = [
  ["Andaman & Nicobar Islands", [], [], ["Port Blair"]],
  ["Andhra Pradesh", [], ["Visakhapatnam|Vizag", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Rajahmundry|Rajamahendravaram", "Kakinada", "Tirupati"], ["Anantapur|Anantapuramu", "Kadapa|Cuddapah", "Ongole", "Eluru", "Vizianagaram", "Srikakulam", "Machilipatnam", "Tenali", "Chittoor", "Proddatur", "Hindupur", "Bhimavaram", "Madanapalle", "Guntakal", "Nandyal"]],
  ["Arunachal Pradesh", [], [], ["Itanagar", "Naharlagun", "Pasighat", "Tawang", "Ziro"]],
  ["Assam", [], ["Guwahati|Gauhati"], ["Bongaigaon", "Kokrajhar", "Gossaigaon", "Dibrugarh", "Jorhat", "Silchar", "Tezpur", "Nagaon", "Barpeta", "Barpeta Road", "Dhubri", "Tinsukia", "Sivasagar|Sibsagar", "Goalpara", "Golaghat", "North Lakhimpur", "Karimganj|Sribhumi", "Hailakandi", "Diphu", "Haflong", "Mangaldoi", "Nalbari", "Morigaon", "Hojai", "Dhemaji", "Bijni", "Abhayapuri", "Bilasipara", "Kajalgaon", "Udalguri", "Rangia", "Biswanath Chariali", "Duliajan", "Digboi", "Lumding", "Sonari"]],
  ["Bihar", [], ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur"], ["Darbhanga", "Purnia", "Arrah", "Begusarai", "Katihar", "Munger", "Chhapra", "Sasaram", "Hajipur", "Bettiah", "Motihari", "Siwan", "Samastipur", "Sitamarhi", "Saharsa", "Kishanganj", "Bihar Sharif", "Dehri", "Buxar", "Aurangabad@aurangabad-bihar"]],
  ["Chandigarh", [], ["Chandigarh"], []],
  ["Chhattisgarh", [], ["Raipur", "Bhilai", "Durg", "Bilaspur"], ["Korba", "Rajnandgaon", "Jagdalpur", "Ambikapur", "Raigarh", "Dhamtari"]],
  ["Dadra & Nagar Haveli and Daman & Diu", [], [], ["Daman", "Silvassa", "Diu"]],
  ["Delhi", ["Delhi|New Delhi"], [], []],
  ["Goa", [], ["Goa"], ["Panaji|Panjim", "Margao|Madgaon", "Mapusa", "Vasco da Gama", "Ponda"]],
  ["Gujarat", ["Ahmedabad|Amdavad"], ["Surat", "Vadodara|Baroda", "Rajkot", "Bhavnagar", "Jamnagar", "Gandhinagar", "Junagadh"], ["Anand", "Nadiad", "Bharuch", "Navsari", "Valsad", "Vapi", "Morbi", "Mehsana", "Gandhidham", "Bhuj", "Porbandar", "Palanpur", "Surendranagar", "Godhra", "Veraval", "Amreli", "Botad", "Patan", "Dahod"]],
  ["Haryana", ["Gurugram|Gurgaon", "Faridabad"], [], ["Ambala", "Panipat", "Karnal", "Rohtak", "Hisar", "Sonipat", "Yamunanagar", "Panchkula", "Kurukshetra", "Bhiwani", "Sirsa", "Rewari", "Jind", "Kaithal", "Palwal", "Bahadurgarh"]],
  ["Himachal Pradesh", [], [], ["Shimla", "Dharamshala", "Mandi", "Solan", "Kullu", "Manali", "Hamirpur", "Una", "Bilaspur@bilaspur-himachal-pradesh"]],
  ["Jammu & Kashmir", [], ["Srinagar", "Jammu"], ["Anantnag", "Baramulla", "Sopore", "Kathua", "Udhampur"]],
  ["Jharkhand", [], ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro Steel City|Bokaro"], ["Hazaribagh", "Deoghar", "Giridih", "Dumka", "Phusro", "Ramgarh", "Medininagar|Daltonganj", "Chaibasa"]],
  ["Karnataka", ["Bengaluru|Bangalore"], ["Mysuru|Mysore", "Mangaluru|Mangalore", "Hubballi|Hubli", "Dharwad", "Belagavi|Belgaum", "Kalaburagi|Gulbarga"], ["Davanagere", "Ballari|Bellary", "Vijayapura|Bijapur", "Shivamogga|Shimoga", "Tumakuru|Tumkur", "Raichur", "Bidar", "Hosapete|Hospet", "Udupi", "Manipal", "Hassan", "Chitradurga", "Mandya", "Chikkamagaluru|Chikmagalur", "Bagalkot", "Gadag", "Karwar", "Kolar", "Madikeri|Coorg"]],
  ["Kerala", [], ["Kochi|Cochin|Ernakulam", "Thiruvananthapuram|Trivandrum", "Kozhikode|Calicut", "Thrissur|Trichur", "Kollam|Quilon", "Kannur|Cannanore", "Malappuram"], ["Alappuzha|Alleppey", "Palakkad|Palghat", "Kottayam", "Kasaragod", "Pathanamthitta", "Thodupuzha", "Kalpetta|Wayanad", "Tirur", "Kayamkulam", "Varkala", "Guruvayur"]],
  ["Ladakh", [], [], ["Leh", "Kargil"]],
  ["Lakshadweep", [], [], ["Kavaratti"]],
  ["Madhya Pradesh", [], ["Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain"], ["Sagar", "Ratlam", "Satna", "Rewa", "Dewas", "Katni", "Singrauli", "Burhanpur", "Khandwa", "Chhindwara", "Morena", "Bhind", "Shivpuri", "Vidisha", "Damoh", "Mandsaur", "Neemuch", "Narmadapuram|Hoshangabad", "Itarsi", "Sehore", "Betul", "Seoni", "Guna", "Khargone"]],
  ["Maharashtra", ["Mumbai|Bombay", "Pune|Poona", "Thane", "Navi Mumbai"], ["Nagpur", "Nashik|Nasik", "Chhatrapati Sambhajinagar|Aurangabad", "Solapur", "Kolhapur", "Amravati", "Sangli", "Bhiwandi", "Vasai-Virar|Vasai|Virar", "Kalyan-Dombivli|Kalyan|Dombivli", "Mira-Bhayandar|Mira Road", "Ulhasnagar", "Malegaon", "Nanded"], ["Akola", "Latur", "Dhule", "Ahilyanagar|Ahmednagar", "Jalgaon", "Chandrapur", "Parbhani", "Ichalkaranji", "Jalna", "Panvel", "Satara", "Ratnagiri", "Wardha", "Yavatmal", "Beed", "Dharashiv|Osmanabad", "Gondia", "Bhusawal", "Baramati", "Lonavala", "Alibag", "Nandurbar", "Washim", "Hingoli", "Buldhana", "Bhandara", "Gadchiroli", "Palghar"]],
  ["Manipur", [], [], ["Imphal", "Thoubal", "Churachandpur"]],
  ["Meghalaya", [], [], ["Shillong", "Tura", "Jowai"]],
  ["Mizoram", [], [], ["Aizawl", "Lunglei", "Champhai"]],
  ["Nagaland", [], [], ["Kohima", "Dimapur", "Mokokchung", "Tuensang"]],
  ["Odisha", [], ["Bhubaneswar", "Cuttack", "Rourkela"], ["Berhampur|Brahmapur", "Sambalpur", "Puri", "Balasore|Baleswar", "Bhadrak", "Baripada", "Jharsuguda", "Jeypore", "Angul", "Bargarh", "Rayagada", "Kendujhar|Keonjhar", "Paradip", "Dhenkanal"]],
  ["Puducherry", [], ["Puducherry|Pondicherry|Pondy"], ["Karaikal"]],
  ["Punjab", [], ["Ludhiana", "Amritsar", "Jalandhar"], ["Patiala", "Bathinda", "Mohali|SAS Nagar", "Hoshiarpur", "Pathankot", "Moga", "Batala", "Abohar", "Firozpur|Ferozepur", "Phagwara", "Kapurthala", "Sangrur", "Barnala", "Khanna", "Sri Muktsar Sahib|Muktsar", "Rajpura"]],
  ["Rajasthan", [], ["Jaipur", "Jodhpur", "Kota", "Bikaner", "Ajmer"], ["Udaipur", "Bhilwara", "Alwar", "Bharatpur", "Sikar", "Pali", "Sri Ganganagar|Ganganagar", "Tonk", "Kishangarh", "Beawar", "Hanumangarh", "Churu", "Jhunjhunu", "Chittorgarh", "Barmer", "Jaisalmer", "Nagaur", "Bundi", "Sawai Madhopur", "Banswara", "Dungarpur", "Mount Abu"]],
  ["Sikkim", [], [], ["Gangtok", "Namchi"]],
  ["Tamil Nadu", ["Chennai|Madras"], ["Coimbatore|Kovai", "Madurai", "Tiruchirappalli|Trichy", "Salem", "Tiruppur", "Erode", "Vellore", "Tirunelveli"], ["Thoothukudi|Tuticorin", "Dindigul", "Thanjavur|Tanjore", "Nagercoil", "Kanchipuram", "Karur", "Hosur", "Kumbakonam", "Cuddalore", "Tiruvannamalai", "Pollachi", "Rajapalayam", "Sivakasi", "Pudukkottai", "Namakkal", "Ooty|Udhagamandalam", "Kodaikanal", "Karaikudi", "Nagapattinam", "Krishnagiri", "Dharmapuri", "Viluppuram", "Ramanathapuram"]],
  ["Telangana", ["Hyderabad|Secunderabad"], ["Warangal"], ["Nizamabad", "Karimnagar", "Khammam", "Ramagundam", "Mahbubnagar", "Nalgonda", "Adilabad", "Siddipet", "Suryapet", "Miryalaguda", "Mancherial", "Sangareddy"]],
  ["Tripura", [], [], ["Agartala", "Udaipur@udaipur-tripura", "Dharmanagar", "Kailashahar"]],
  ["Uttar Pradesh", ["Noida", "Ghaziabad", "Greater Noida"], ["Lucknow", "Kanpur", "Agra", "Varanasi|Banaras|Benares", "Prayagraj|Allahabad", "Meerut", "Bareilly", "Aligarh", "Moradabad", "Gorakhpur", "Jhansi", "Saharanpur", "Firozabad"], ["Mathura", "Vrindavan", "Shahjahanpur", "Rampur", "Muzaffarnagar", "Ayodhya|Faizabad", "Etawah", "Mirzapur", "Bulandshahr", "Sambhal", "Amroha", "Hardoi", "Fatehpur", "Raebareli", "Orai", "Sitapur", "Bahraich", "Modinagar", "Unnao", "Jaunpur", "Lakhimpur Kheri", "Hathras", "Banda", "Pilibhit", "Barabanki", "Khurja", "Gonda", "Mainpuri", "Lalitpur", "Etah", "Deoria", "Ghazipur", "Sultanpur", "Azamgarh", "Bijnor", "Basti", "Ballia", "Mau", "Chandausi"]],
  ["Uttarakhand", [], ["Dehradun"], ["Haridwar", "Roorkee", "Haldwani", "Rudrapur", "Kashipur", "Rishikesh", "Nainital", "Mussoorie", "Almora", "Pithoragarh", "Kotdwar"]],
  ["West Bengal", ["Kolkata|Calcutta", "Howrah"], ["Asansol", "Durgapur", "Siliguri"], ["Bardhaman|Burdwan", "Malda|English Bazar", "Baharampur|Berhampore", "Kharagpur", "Haldia", "Krishnanagar", "Jalpaiguri", "Cooch Behar|Koch Bihar", "Bankura", "Purulia", "Darjeeling", "Medinipur|Midnapore", "Raiganj", "Balurghat", "Alipurduar", "Bolpur|Santiniketan", "Habra", "Digha"]],
];

function slugify(s: string) {
  return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function build(): City[] {
  const out: City[] = [];
  // Tier 1 first, then 2, then 3 — so lists and suggestions show big cities first.
  for (const tier of [1, 2, 3] as const) {
    for (const [state, ...tiers] of RAW) {
      for (const entry of tiers[tier - 1]) {
        const [names, customSlug] = entry.split("@");
        const [name, ...aliases] = names.split("|");
        out.push({ slug: customSlug ?? slugify(name), name, state, tier, aliases });
      }
    }
  }
  return out;
}

export const CITIES: City[] = build();

const bySlug = new Map(CITIES.map((c) => [c.slug, c]));

export function getCity(slug: string): City | undefined {
  return bySlug.get(slug);
}

/** Every spelling a person might type for this city, lower-cased. */
export function cityNames(c: City): string[] {
  return [c.name, ...c.aliases].map((n) => n.toLowerCase());
}

export const TIER_LABEL: Record<CityTier, string> = { 1: "Tier 1", 2: "Tier 2", 3: "Tier 3" };
