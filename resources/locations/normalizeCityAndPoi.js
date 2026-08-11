const csv = require('csvtojson');
const fs = require('fs');

const csvFilePath = 'worldcities.csv';
const jsonFilePath = 'cities.normalized.json';

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

csv()
    .fromFile(csvFilePath)
    .then((rows) => {
        const cities = rows.map((row) => {
            const city = toAscii(row.city_ascii);
            const admin = toAscii(row.admin_name);

            const record = {
                id: Number(row.id),
                city,
                lat: roundCoordinate(row.lat),
                lng: roundCoordinate(row.lng),
                cty: normalizeCountry(row.country),
                pop: Number(row.population),
            };

            // Add admin only when it provides additional information
            if (admin && admin.toLowerCase() !== city.toLowerCase()) {
                record.adm = admin;
            }

            return record;
        });

        fs.writeFileSync(jsonFilePath, JSON.stringify(cities));

        console.log(`Created ${cities.length} city records`);
    })
    .catch(console.error);
