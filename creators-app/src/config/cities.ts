/**
 * Indian cities used by search and the onboarding city picker.
 * `slug` is the URL segment (/creators/[slug]); keep it lowercase and hyphenated.
 * Add cities freely — nothing else needs to change.
 */
export type City = { slug: string; name: string; state: string };

export const CITIES: City[] = [
  // North East first — that's where we're launching from.
  { slug: "guwahati", name: "Guwahati", state: "Assam" },
  { slug: "bongaigaon", name: "Bongaigaon", state: "Assam" },
  { slug: "kokrajhar", name: "Kokrajhar", state: "Assam" },
  { slug: "dibrugarh", name: "Dibrugarh", state: "Assam" },
  { slug: "jorhat", name: "Jorhat", state: "Assam" },
  { slug: "silchar", name: "Silchar", state: "Assam" },
  { slug: "tezpur", name: "Tezpur", state: "Assam" },
  { slug: "nagaon", name: "Nagaon", state: "Assam" },
  { slug: "barpeta", name: "Barpeta", state: "Assam" },
  { slug: "dhubri", name: "Dhubri", state: "Assam" },
  { slug: "shillong", name: "Shillong", state: "Meghalaya" },
  { slug: "agartala", name: "Agartala", state: "Tripura" },
  { slug: "imphal", name: "Imphal", state: "Manipur" },
  { slug: "aizawl", name: "Aizawl", state: "Mizoram" },
  { slug: "itanagar", name: "Itanagar", state: "Arunachal Pradesh" },
  { slug: "kohima", name: "Kohima", state: "Nagaland" },
  { slug: "dimapur", name: "Dimapur", state: "Nagaland" },
  { slug: "gangtok", name: "Gangtok", state: "Sikkim" },
  { slug: "siliguri", name: "Siliguri", state: "West Bengal" },
  // Metros and large cities
  { slug: "mumbai", name: "Mumbai", state: "Maharashtra" },
  { slug: "delhi", name: "Delhi", state: "Delhi" },
  { slug: "bengaluru", name: "Bengaluru", state: "Karnataka" },
  { slug: "kolkata", name: "Kolkata", state: "West Bengal" },
  { slug: "chennai", name: "Chennai", state: "Tamil Nadu" },
  { slug: "hyderabad", name: "Hyderabad", state: "Telangana" },
  { slug: "pune", name: "Pune", state: "Maharashtra" },
  { slug: "ahmedabad", name: "Ahmedabad", state: "Gujarat" },
  { slug: "jaipur", name: "Jaipur", state: "Rajasthan" },
  { slug: "lucknow", name: "Lucknow", state: "Uttar Pradesh" },
  { slug: "noida", name: "Noida", state: "Uttar Pradesh" },
  { slug: "gurugram", name: "Gurugram", state: "Haryana" },
  { slug: "chandigarh", name: "Chandigarh", state: "Chandigarh" },
  { slug: "indore", name: "Indore", state: "Madhya Pradesh" },
  { slug: "bhopal", name: "Bhopal", state: "Madhya Pradesh" },
  { slug: "surat", name: "Surat", state: "Gujarat" },
  { slug: "vadodara", name: "Vadodara", state: "Gujarat" },
  { slug: "nagpur", name: "Nagpur", state: "Maharashtra" },
  { slug: "nashik", name: "Nashik", state: "Maharashtra" },
  { slug: "patna", name: "Patna", state: "Bihar" },
  { slug: "ranchi", name: "Ranchi", state: "Jharkhand" },
  { slug: "bhubaneswar", name: "Bhubaneswar", state: "Odisha" },
  { slug: "visakhapatnam", name: "Visakhapatnam", state: "Andhra Pradesh" },
  { slug: "vijayawada", name: "Vijayawada", state: "Andhra Pradesh" },
  { slug: "kochi", name: "Kochi", state: "Kerala" },
  { slug: "thiruvananthapuram", name: "Thiruvananthapuram", state: "Kerala" },
  { slug: "kozhikode", name: "Kozhikode", state: "Kerala" },
  { slug: "coimbatore", name: "Coimbatore", state: "Tamil Nadu" },
  { slug: "madurai", name: "Madurai", state: "Tamil Nadu" },
  { slug: "mysuru", name: "Mysuru", state: "Karnataka" },
  { slug: "mangaluru", name: "Mangaluru", state: "Karnataka" },
  { slug: "goa", name: "Goa", state: "Goa" },
  { slug: "dehradun", name: "Dehradun", state: "Uttarakhand" },
  { slug: "amritsar", name: "Amritsar", state: "Punjab" },
  { slug: "ludhiana", name: "Ludhiana", state: "Punjab" },
  { slug: "kanpur", name: "Kanpur", state: "Uttar Pradesh" },
  { slug: "varanasi", name: "Varanasi", state: "Uttar Pradesh" },
  { slug: "agra", name: "Agra", state: "Uttar Pradesh" },
  { slug: "raipur", name: "Raipur", state: "Chhattisgarh" },
  { slug: "udaipur", name: "Udaipur", state: "Rajasthan" },
  { slug: "jodhpur", name: "Jodhpur", state: "Rajasthan" },
  { slug: "srinagar", name: "Srinagar", state: "Jammu & Kashmir" },
];

const bySlug = new Map(CITIES.map((c) => [c.slug, c]));

export function getCity(slug: string): City | undefined {
  return bySlug.get(slug);
}
