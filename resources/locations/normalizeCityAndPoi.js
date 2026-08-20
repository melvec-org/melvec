const csv = require('csvtojson');
const fs = require('fs');

const citiesCSVFilePath = './cities/worldcities.csv';
const citiesNormalizedFilePath = './cities/cities.normalized.json';

const worldPOIDataPath = './poi/world-poi.json';
const worldPOINormalizedFilePath = './poi/poi.normalized.json';

const COUNTRY_MAP = {
    'United States': 'USA',
    'United Kingdom': 'UK',
    'United Arab Emirates': 'UAE',
    'Russian Federation': 'Russia',
    'South Korea': 'Korea',
    'North Korea': 'DPRK',
    'Czech Republic': 'Czechia',
};

function toAscii(str = '') {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeCountry(country) {
    country = toAscii(country.trim());

    return COUNTRY_MAP[country] || country;
}

function roundCoordinate(value) {
    return Math.round(Number(value) * 10000) / 10000;
}

// cities CSV file normalization to
csv()
    .fromFile(citiesCSVFilePath)
    .then((rows) => {
        const cities = rows.map((row) => {
            const city = toAscii(row.city_ascii);
            const admin = toAscii(row.admin_name);

            const record = {
                id: Number(row.id),
                city,
                lat: roundCoordinate(row.lat),
                lng: roundCoordinate(row.lng),
                country: normalizeCountry(row.country),
                pop: Number(row.population),
            };

            // Add admin only when it provides additional information
            if (admin && admin.toLowerCase() !== city.toLowerCase()) {
                record.adm = admin;
            }

            return record;
        });

        fs.writeFileSync(citiesNormalizedFilePath, JSON.stringify(cities));

        console.log(`Created ${cities.length} city records`);
    })
    .catch(console.error);

// POI data normalization

const rawData = fs.readFileSync(worldPOIDataPath, 'utf8');
const worldPOIData = JSON.parse(rawData);

const normalizedWorldPIData = worldPOIData.map((item) => {
    const admin = toAscii(item.admin);
    const record = {
        id: item.id,
        name: item.name,
        city: item.city,
        country: item.country,
        lat: roundCoordinate(item.lat),
        lng: roundCoordinate(item.lng),
    };

    if (admin && admin.toLowerCase() !== item.city.toLowerCase()) {
        record.adm = admin;
    }

    return record;
});
fs.writeFileSync(worldPOINormalizedFilePath, JSON.stringify(normalizedWorldPIData));
console.log(`created ${normalizedWorldPIData.length} POI records normalization`);
