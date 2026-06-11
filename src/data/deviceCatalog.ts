// Built-in spec catalog of popular models sold in India.
// Picking a model in the admin panel auto-fills these fixed specs,
// the same way large refurbished marketplaces list them.

export interface DeviceSpec {
  brand: string;
  model: string;
  category: 'iphone' | 'android';
  releaseYear: number;
  launchMrp: number; // approximate India launch MRP in ₹, editable in the form
  storageOptions: string[];
  ramOptions: string[];
  colors: string[];
  specs: Record<string, string>;
}

export const DEVICE_CATALOG: DeviceSpec[] = [
  // ---------------- Apple ----------------
  {
    brand: 'Apple', model: 'iPhone 15 Pro Max', category: 'iphone', releaseYear: 2023, launchMrp: 159900,
    storageOptions: ['256GB', '512GB', '1TB'], ramOptions: ['8GB'],
    colors: ['Natural Titanium', 'Blue Titanium', 'White Titanium', 'Black Titanium'],
    specs: {
      Processor: 'Apple A17 Pro', Display: '6.7" Super Retina XDR OLED, 120Hz ProMotion',
      'Rear Camera': '48MP + 12MP + 12MP (5x telephoto)', 'Front Camera': '12MP TrueDepth',
      Battery: '4441 mAh', Charging: 'USB-C, 27W wired, MagSafe', OS: 'iOS 17 (upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual SIM (nano + eSIM)',
    },
  },
  {
    brand: 'Apple', model: 'iPhone 15 Pro', category: 'iphone', releaseYear: 2023, launchMrp: 134900,
    storageOptions: ['128GB', '256GB', '512GB', '1TB'], ramOptions: ['8GB'],
    colors: ['Natural Titanium', 'Blue Titanium', 'White Titanium', 'Black Titanium'],
    specs: {
      Processor: 'Apple A17 Pro', Display: '6.1" Super Retina XDR OLED, 120Hz ProMotion',
      'Rear Camera': '48MP + 12MP + 12MP (3x telephoto)', 'Front Camera': '12MP TrueDepth',
      Battery: '3274 mAh', Charging: 'USB-C, 27W wired, MagSafe', OS: 'iOS 17 (upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual SIM (nano + eSIM)',
    },
  },
  {
    brand: 'Apple', model: 'iPhone 15 Plus', category: 'iphone', releaseYear: 2023, launchMrp: 89900,
    storageOptions: ['128GB', '256GB', '512GB'], ramOptions: ['6GB'],
    colors: ['Black', 'Blue', 'Green', 'Yellow', 'Pink'],
    specs: {
      Processor: 'Apple A16 Bionic', Display: '6.7" Super Retina XDR OLED',
      'Rear Camera': '48MP + 12MP dual', 'Front Camera': '12MP TrueDepth',
      Battery: '4383 mAh', Charging: 'USB-C, 20W wired, MagSafe', OS: 'iOS 17 (upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual SIM (nano + eSIM)',
    },
  },
  {
    brand: 'Apple', model: 'iPhone 15', category: 'iphone', releaseYear: 2023, launchMrp: 79900,
    storageOptions: ['128GB', '256GB', '512GB'], ramOptions: ['6GB'],
    colors: ['Black', 'Blue', 'Green', 'Yellow', 'Pink'],
    specs: {
      Processor: 'Apple A16 Bionic', Display: '6.1" Super Retina XDR OLED',
      'Rear Camera': '48MP + 12MP dual', 'Front Camera': '12MP TrueDepth',
      Battery: '3349 mAh', Charging: 'USB-C, 20W wired, MagSafe', OS: 'iOS 17 (upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual SIM (nano + eSIM)',
    },
  },
  {
    brand: 'Apple', model: 'iPhone 14 Plus', category: 'iphone', releaseYear: 2022, launchMrp: 89900,
    storageOptions: ['128GB', '256GB', '512GB'], ramOptions: ['6GB'],
    colors: ['Midnight', 'Starlight', 'Blue', 'Purple', 'Yellow', 'Red'],
    specs: {
      Processor: 'Apple A15 Bionic', Display: '6.7" Super Retina XDR OLED',
      'Rear Camera': '12MP + 12MP dual', 'Front Camera': '12MP TrueDepth',
      Battery: '4325 mAh', Charging: 'Lightning, 20W wired, MagSafe', OS: 'iOS 16 (upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual SIM (nano + eSIM)',
    },
  },
  {
    brand: 'Apple', model: 'iPhone 14', category: 'iphone', releaseYear: 2022, launchMrp: 79900,
    storageOptions: ['128GB', '256GB', '512GB'], ramOptions: ['6GB'],
    colors: ['Midnight', 'Starlight', 'Blue', 'Purple', 'Yellow', 'Red'],
    specs: {
      Processor: 'Apple A15 Bionic', Display: '6.1" Super Retina XDR OLED',
      'Rear Camera': '12MP + 12MP dual', 'Front Camera': '12MP TrueDepth',
      Battery: '3279 mAh', Charging: 'Lightning, 20W wired, MagSafe', OS: 'iOS 16 (upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual SIM (nano + eSIM)',
    },
  },
  {
    brand: 'Apple', model: 'iPhone 13', category: 'iphone', releaseYear: 2021, launchMrp: 79900,
    storageOptions: ['128GB', '256GB', '512GB'], ramOptions: ['4GB'],
    colors: ['Midnight', 'Starlight', 'Blue', 'Pink', 'Green', 'Red'],
    specs: {
      Processor: 'Apple A15 Bionic', Display: '6.1" Super Retina XDR OLED',
      'Rear Camera': '12MP + 12MP dual', 'Front Camera': '12MP TrueDepth',
      Battery: '3240 mAh', Charging: 'Lightning, 20W wired, MagSafe', OS: 'iOS 15 (upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual SIM (nano + eSIM)',
    },
  },
  {
    brand: 'Apple', model: 'iPhone 13 mini', category: 'iphone', releaseYear: 2021, launchMrp: 69900,
    storageOptions: ['128GB', '256GB', '512GB'], ramOptions: ['4GB'],
    colors: ['Midnight', 'Starlight', 'Blue', 'Pink', 'Green', 'Red'],
    specs: {
      Processor: 'Apple A15 Bionic', Display: '5.4" Super Retina XDR OLED',
      'Rear Camera': '12MP + 12MP dual', 'Front Camera': '12MP TrueDepth',
      Battery: '2438 mAh', Charging: 'Lightning, 20W wired, MagSafe', OS: 'iOS 15 (upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual SIM (nano + eSIM)',
    },
  },
  {
    brand: 'Apple', model: 'iPhone 12', category: 'iphone', releaseYear: 2020, launchMrp: 79900,
    storageOptions: ['64GB', '128GB', '256GB'], ramOptions: ['4GB'],
    colors: ['Black', 'White', 'Blue', 'Green', 'Purple', 'Red'],
    specs: {
      Processor: 'Apple A14 Bionic', Display: '6.1" Super Retina XDR OLED',
      'Rear Camera': '12MP + 12MP dual', 'Front Camera': '12MP TrueDepth',
      Battery: '2815 mAh', Charging: 'Lightning, 20W wired, MagSafe', OS: 'iOS 14 (upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual SIM (nano + eSIM)',
    },
  },
  {
    brand: 'Apple', model: 'iPhone 11', category: 'iphone', releaseYear: 2019, launchMrp: 64900,
    storageOptions: ['64GB', '128GB', '256GB'], ramOptions: ['4GB'],
    colors: ['Black', 'White', 'Green', 'Yellow', 'Purple', 'Red'],
    specs: {
      Processor: 'Apple A13 Bionic', Display: '6.1" Liquid Retina LCD',
      'Rear Camera': '12MP + 12MP dual', 'Front Camera': '12MP TrueDepth',
      Battery: '3110 mAh', Charging: 'Lightning, 18W wired', OS: 'iOS 13 (upgradable)',
      Network: '4G LTE', SIM: 'Dual SIM (nano + eSIM)',
    },
  },
  {
    brand: 'Apple', model: 'iPhone SE (2022)', category: 'iphone', releaseYear: 2022, launchMrp: 43900,
    storageOptions: ['64GB', '128GB', '256GB'], ramOptions: ['4GB'],
    colors: ['Midnight', 'Starlight', 'Red'],
    specs: {
      Processor: 'Apple A15 Bionic', Display: '4.7" Retina HD LCD',
      'Rear Camera': '12MP single', 'Front Camera': '7MP',
      Battery: '2018 mAh', Charging: 'Lightning, 20W wired', OS: 'iOS 15 (upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual SIM (nano + eSIM)',
    },
  },

  // ---------------- Samsung ----------------
  {
    brand: 'Samsung', model: 'Galaxy S23 Ultra', category: 'android', releaseYear: 2023, launchMrp: 124999,
    storageOptions: ['256GB', '512GB', '1TB'], ramOptions: ['12GB'],
    colors: ['Phantom Black', 'Cream', 'Green', 'Lavender'],
    specs: {
      Processor: 'Snapdragon 8 Gen 2', Display: '6.8" Dynamic AMOLED 2X, 120Hz, S Pen',
      'Rear Camera': '200MP + 12MP + 10MP + 10MP quad', 'Front Camera': '12MP',
      Battery: '5000 mAh', Charging: '45W wired, 15W wireless', OS: 'Android 13 (One UI, upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual nano SIM + eSIM',
    },
  },
  {
    brand: 'Samsung', model: 'Galaxy S23', category: 'android', releaseYear: 2023, launchMrp: 74999,
    storageOptions: ['128GB', '256GB'], ramOptions: ['8GB'],
    colors: ['Phantom Black', 'Cream', 'Green', 'Lavender'],
    specs: {
      Processor: 'Snapdragon 8 Gen 2', Display: '6.1" Dynamic AMOLED 2X, 120Hz',
      'Rear Camera': '50MP + 12MP + 10MP triple', 'Front Camera': '12MP',
      Battery: '3900 mAh', Charging: '25W wired, 15W wireless', OS: 'Android 13 (One UI, upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual nano SIM + eSIM',
    },
  },
  {
    brand: 'Samsung', model: 'Galaxy S21 FE 5G', category: 'android', releaseYear: 2022, launchMrp: 49999,
    storageOptions: ['128GB', '256GB'], ramOptions: ['8GB'],
    colors: ['Graphite', 'Olive', 'Lavender', 'White'],
    specs: {
      Processor: 'Snapdragon 888 / Exynos 2100', Display: '6.4" Dynamic AMOLED 2X, 120Hz',
      'Rear Camera': '12MP + 12MP + 8MP triple', 'Front Camera': '32MP',
      Battery: '4500 mAh', Charging: '25W wired, 15W wireless', OS: 'Android 12 (One UI, upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual nano SIM',
    },
  },
  {
    brand: 'Samsung', model: 'Galaxy A54 5G', category: 'android', releaseYear: 2023, launchMrp: 38999,
    storageOptions: ['128GB', '256GB'], ramOptions: ['8GB'],
    colors: ['Awesome Graphite', 'Awesome Violet', 'Awesome Lime', 'Awesome White'],
    specs: {
      Processor: 'Exynos 1380', Display: '6.4" Super AMOLED, 120Hz',
      'Rear Camera': '50MP + 12MP + 5MP triple (OIS)', 'Front Camera': '32MP',
      Battery: '5000 mAh', Charging: '25W wired', OS: 'Android 13 (One UI, upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual nano SIM',
    },
  },
  {
    brand: 'Samsung', model: 'Galaxy M34 5G', category: 'android', releaseYear: 2023, launchMrp: 18999,
    storageOptions: ['128GB'], ramOptions: ['6GB', '8GB'],
    colors: ['Prism Silver', 'Midnight Blue', 'Waterfall Blue'],
    specs: {
      Processor: 'Exynos 1280', Display: '6.5" Super AMOLED, 120Hz',
      'Rear Camera': '50MP + 8MP + 2MP triple (OIS)', 'Front Camera': '13MP',
      Battery: '6000 mAh', Charging: '25W wired', OS: 'Android 13 (One UI, upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual nano SIM',
    },
  },
  {
    brand: 'Samsung', model: 'Galaxy A52', category: 'android', releaseYear: 2021, launchMrp: 26499,
    storageOptions: ['128GB'], ramOptions: ['6GB', '8GB'],
    colors: ['Awesome Black', 'Awesome White', 'Awesome Blue', 'Awesome Violet'],
    specs: {
      Processor: 'Snapdragon 720G', Display: '6.5" Super AMOLED, 90Hz',
      'Rear Camera': '64MP + 12MP + 5MP + 5MP quad (OIS)', 'Front Camera': '32MP',
      Battery: '4500 mAh', Charging: '25W wired', OS: 'Android 11 (One UI, upgradable)',
      Network: '4G LTE', SIM: 'Dual nano SIM',
    },
  },

  // ---------------- OnePlus ----------------
  {
    brand: 'OnePlus', model: 'OnePlus 11 5G', category: 'android', releaseYear: 2023, launchMrp: 56999,
    storageOptions: ['128GB', '256GB'], ramOptions: ['8GB', '16GB'],
    colors: ['Titan Black', 'Eternal Green'],
    specs: {
      Processor: 'Snapdragon 8 Gen 2', Display: '6.7" AMOLED LTPO, 120Hz',
      'Rear Camera': '50MP + 48MP + 32MP triple (Hasselblad)', 'Front Camera': '16MP',
      Battery: '5000 mAh', Charging: '100W SUPERVOOC', OS: 'Android 13 (OxygenOS, upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual nano SIM',
    },
  },
  {
    brand: 'OnePlus', model: 'OnePlus 11R 5G', category: 'android', releaseYear: 2023, launchMrp: 39999,
    storageOptions: ['128GB', '256GB'], ramOptions: ['8GB', '16GB'],
    colors: ['Galactic Silver', 'Sonic Black'],
    specs: {
      Processor: 'Snapdragon 8+ Gen 1', Display: '6.74" AMOLED, 120Hz',
      'Rear Camera': '50MP + 8MP + 2MP triple (OIS)', 'Front Camera': '16MP',
      Battery: '5000 mAh', Charging: '100W SUPERVOOC', OS: 'Android 13 (OxygenOS, upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual nano SIM',
    },
  },
  {
    brand: 'OnePlus', model: 'Nord CE 3 Lite 5G', category: 'android', releaseYear: 2023, launchMrp: 19999,
    storageOptions: ['128GB', '256GB'], ramOptions: ['8GB'],
    colors: ['Pastel Lime', 'Chromatic Gray'],
    specs: {
      Processor: 'Snapdragon 695', Display: '6.72" LCD, 120Hz',
      'Rear Camera': '108MP + 2MP + 2MP triple', 'Front Camera': '16MP',
      Battery: '5000 mAh', Charging: '67W SUPERVOOC', OS: 'Android 13 (OxygenOS, upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual nano SIM',
    },
  },
  {
    brand: 'OnePlus', model: 'Nord 3 5G', category: 'android', releaseYear: 2023, launchMrp: 33999,
    storageOptions: ['128GB', '256GB'], ramOptions: ['8GB', '16GB'],
    colors: ['Misty Green', 'Tempest Gray'],
    specs: {
      Processor: 'MediaTek Dimensity 9000', Display: '6.74" AMOLED, 120Hz',
      'Rear Camera': '50MP + 8MP + 2MP triple (OIS)', 'Front Camera': '16MP',
      Battery: '5000 mAh', Charging: '80W SUPERVOOC', OS: 'Android 13 (OxygenOS, upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual nano SIM',
    },
  },

  // ---------------- Xiaomi / Redmi ----------------
  {
    brand: 'Xiaomi', model: 'Redmi Note 13 Pro 5G', category: 'android', releaseYear: 2024, launchMrp: 25999,
    storageOptions: ['128GB', '256GB'], ramOptions: ['8GB', '12GB'],
    colors: ['Midnight Black', 'Arctic White', 'Coral Purple'],
    specs: {
      Processor: 'Snapdragon 7s Gen 2', Display: '6.67" AMOLED, 120Hz',
      'Rear Camera': '200MP + 8MP + 2MP triple (OIS)', 'Front Camera': '16MP',
      Battery: '5100 mAh', Charging: '67W turbo', OS: 'Android 13 (MIUI 14, upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual nano SIM',
    },
  },
  {
    brand: 'Xiaomi', model: 'Redmi Note 12 5G', category: 'android', releaseYear: 2023, launchMrp: 17999,
    storageOptions: ['128GB', '256GB'], ramOptions: ['4GB', '6GB', '8GB'],
    colors: ['Matte Black', 'Frosted Green', 'Mystique Blue'],
    specs: {
      Processor: 'Snapdragon 4 Gen 1', Display: '6.67" AMOLED, 120Hz',
      'Rear Camera': '48MP + 8MP + 2MP triple', 'Front Camera': '13MP',
      Battery: '5000 mAh', Charging: '33W fast', OS: 'Android 12 (MIUI 13, upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual nano SIM',
    },
  },
  {
    brand: 'Xiaomi', model: 'Redmi Note 10', category: 'android', releaseYear: 2021, launchMrp: 13999,
    storageOptions: ['64GB', '128GB'], ramOptions: ['4GB', '6GB'],
    colors: ['Shadow Black', 'Frost White', 'Aqua Green'],
    specs: {
      Processor: 'Snapdragon 678', Display: '6.43" AMOLED',
      'Rear Camera': '48MP + 8MP + 2MP + 2MP quad', 'Front Camera': '13MP',
      Battery: '5000 mAh', Charging: '33W fast', OS: 'Android 11 (MIUI 12, upgradable)',
      Network: '4G LTE', SIM: 'Dual nano SIM',
    },
  },
  {
    brand: 'Poco', model: 'Poco X5 Pro 5G', category: 'android', releaseYear: 2023, launchMrp: 22999,
    storageOptions: ['128GB', '256GB'], ramOptions: ['6GB', '8GB'],
    colors: ['Astral Black', 'Horizon Blue', 'Poco Yellow'],
    specs: {
      Processor: 'Snapdragon 778G', Display: '6.67" AMOLED, 120Hz',
      'Rear Camera': '108MP + 8MP + 2MP triple', 'Front Camera': '16MP',
      Battery: '5000 mAh', Charging: '67W turbo', OS: 'Android 12 (MIUI 14, upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual nano SIM',
    },
  },

  // ---------------- Vivo / Oppo / Realme ----------------
  {
    brand: 'Vivo', model: 'Vivo V27 5G', category: 'android', releaseYear: 2023, launchMrp: 32999,
    storageOptions: ['128GB', '256GB'], ramOptions: ['8GB', '12GB'],
    colors: ['Noble Black', 'Magic Blue'],
    specs: {
      Processor: 'MediaTek Dimensity 7200', Display: '6.78" AMOLED curved, 120Hz',
      'Rear Camera': '50MP + 8MP + 2MP triple (OIS)', 'Front Camera': '50MP',
      Battery: '4600 mAh', Charging: '66W FlashCharge', OS: 'Android 13 (Funtouch, upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual nano SIM',
    },
  },
  {
    brand: 'Oppo', model: 'Oppo Reno 10 5G', category: 'android', releaseYear: 2023, launchMrp: 32999,
    storageOptions: ['256GB'], ramOptions: ['8GB'],
    colors: ['Ice Blue', 'Silvery Grey'],
    specs: {
      Processor: 'MediaTek Dimensity 7050', Display: '6.7" AMOLED curved, 120Hz',
      'Rear Camera': '64MP + 32MP + 8MP triple (2x telephoto)', 'Front Camera': '32MP',
      Battery: '5000 mAh', Charging: '67W SUPERVOOC', OS: 'Android 13 (ColorOS, upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual nano SIM',
    },
  },
  {
    brand: 'Realme', model: 'Realme 11 Pro 5G', category: 'android', releaseYear: 2023, launchMrp: 23999,
    storageOptions: ['128GB', '256GB'], ramOptions: ['8GB', '12GB'],
    colors: ['Sunrise Beige', 'Astral Black', 'Oasis Green'],
    specs: {
      Processor: 'MediaTek Dimensity 7050', Display: '6.7" AMOLED curved, 120Hz',
      'Rear Camera': '100MP + 2MP dual (OIS)', 'Front Camera': '16MP',
      Battery: '5000 mAh', Charging: '67W SUPERVOOC', OS: 'Android 13 (Realme UI, upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual nano SIM',
    },
  },
  {
    brand: 'Realme', model: 'Narzo 60 5G', category: 'android', releaseYear: 2023, launchMrp: 17999,
    storageOptions: ['128GB', '256GB'], ramOptions: ['8GB'],
    colors: ['Mars Orange', 'Cosmic Black'],
    specs: {
      Processor: 'MediaTek Dimensity 6020', Display: '6.43" AMOLED, 90Hz',
      'Rear Camera': '64MP + 2MP dual', 'Front Camera': '16MP',
      Battery: '5000 mAh', Charging: '33W SUPERVOOC', OS: 'Android 13 (Realme UI, upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual nano SIM',
    },
  },

  // ---------------- Motorola ----------------
  {
    brand: 'Motorola', model: 'Moto G84 5G', category: 'android', releaseYear: 2023, launchMrp: 19999,
    storageOptions: ['256GB'], ramOptions: ['12GB'],
    colors: ['Midnight Blue', 'Marshmallow Blue', 'Viva Magenta'],
    specs: {
      Processor: 'Snapdragon 695', Display: '6.55" pOLED, 120Hz',
      'Rear Camera': '50MP + 8MP dual (OIS)', 'Front Camera': '16MP',
      Battery: '5000 mAh', Charging: '30W TurboPower', OS: 'Android 13 (near-stock, upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual nano SIM',
    },
  },
  {
    brand: 'Motorola', model: 'Moto Edge 40', category: 'android', releaseYear: 2023, launchMrp: 29999,
    storageOptions: ['256GB'], ramOptions: ['8GB'],
    colors: ['Eclipse Black', 'Nebula Green', 'Lunar Blue'],
    specs: {
      Processor: 'MediaTek Dimensity 8020', Display: '6.55" pOLED curved, 144Hz',
      'Rear Camera': '50MP + 13MP dual (OIS)', 'Front Camera': '32MP',
      Battery: '4400 mAh', Charging: '68W TurboPower, 15W wireless', OS: 'Android 13 (near-stock, upgradable)',
      Network: '5G (India bands supported)', SIM: 'Dual nano SIM + eSIM',
    },
  },
];

export const CATALOG_BRANDS = [...new Set(DEVICE_CATALOG.map((d) => d.brand))];

export function findDevice(brand: string, model: string): DeviceSpec | undefined {
  return DEVICE_CATALOG.find((d) => d.brand === brand && d.model === model);
}
