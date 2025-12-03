export const UNIT_TYPES = {
    INFANTRY: {
        id: 'infantry',
        name: 'Пехотная дивизия',
        speed: 0.05,
        attack: 10,
        defense: 20,
        supply_usage: 1,
        type: 'land',
        icon_char: 'I'
    },
    TANK: {
        id: 'tank',
        name: 'Танковая дивизия',
        speed: 0.15,
        attack: 40,
        defense: 15,
        supply_usage: 3,
        type: 'land',
        icon_char: 'T'
    },
    PLANE: {
        id: 'plane',
        name: 'Авиакрыло',
        speed: 0.8,
        attack: 30,
        defense: 5,
        supply_usage: 5,
        type: 'air',
        icon_char: 'A'
    },
    SHIP: {
        id: 'ship',
        name: 'Флот',
        speed: 0.1,
        attack: 50,
        defense: 50,
        supply_usage: 4,
        type: 'sea',
        icon_char: 'S'
    }
};

export const COUNTRIES = {
    germany: {
        name: 'Германия', // RU
        name_en: 'Germany',
        color: '#444444',
        accent: '#ff0000',
        capital: { lat: 52.52, lon: 13.40 },
        front_line_start: { lat: 49.0, lon: 8.4 }, // Near Karlsruhe
        front_line_end: { lat: 51.0, lon: 6.0 },   // Near Aachen
        naval_spawns: [{ lat: 54.0, lon: 7.5 }, { lat: 54.5, lon: 14.0 }], // North Sea, Baltic
        names: ['Ганс', 'Фриц', 'Отто', 'Карл', 'Генрих', 'Вальтер', 'Эрих', 'Вернер'],
        surnames: ['Мюллер', 'Шмидт', 'Шнайдер', 'Фишер', 'Вебер', 'Мейер', 'Вагнер']
    },
    france: {
        name: 'Франция', // RU
        name_en: 'France',
        color: '#0055aa',
        accent: '#ffffff',
        capital: { lat: 48.85, lon: 2.35 },
        front_line_start: { lat: 48.5, lon: 7.7 }, // Strasbourg area
        front_line_end: { lat: 49.5, lon: 5.8 },   // Luxembourg border
        naval_spawns: [{ lat: 49.5, lon: -1.5 }, { lat: 43.0, lon: 6.0 }], // Channel, Med
        names: ['Жан', 'Пьер', 'Мишель', 'Луи', 'Филипп', 'Жак', 'Анри', 'Франсуа'],
        surnames: ['Мартен', 'Бернар', 'Тома', 'Пети', 'Робер', 'Ришар', 'Дюпон']
    },
    ussr: {
        name: 'СССР',
        name_en: 'USSR',
        color: '#cc0000',
        accent: '#ffcc00',
        capital: { lat: 55.75, lon: 37.61 },
        naval_spawns: [{ lat: 60.0, lon: 28.0 }, { lat: 44.5, lon: 33.5 }], // Baltic, Black Sea
        names: ['Иван', 'Дмитрий', 'Сергей', 'Алексей', 'Николай', 'Василий', 'Михаил'],
        surnames: ['Иванов', 'Петров', 'Сидоров', 'Смирнов', 'Волков', 'Кузнецов', 'Попов']
    },
    uk: {
        name: 'Великобритания',
        name_en: 'United Kingdom',
        color: '#c19a6b',
        accent: '#000066',
        capital: { lat: 51.50, lon: -0.12 },
        naval_spawns: [{ lat: 50.5, lon: -0.5 }, { lat: 56.0, lon: 2.0 }], // Channel, North Sea
        names: ['Джон', 'Джеймс', 'Уильям', 'Джордж', 'Чарльз', 'Генри', 'Томас'],
        surnames: ['Смит', 'Джонс', 'Тейлор', 'Браун', 'Уильямс', 'Уилсон']
    }
};

export const DIPLOMACY = {
    germany: { france: 'war', ussr: 'peace', uk: 'peace' },
    france: { germany: 'war', ussr: 'peace', uk: 'peace' },
    ussr: { germany: 'peace', france: 'peace', uk: 'peace' },
    uk: { germany: 'peace', france: 'peace', ussr: 'peace' }
};

export function generateName(countryId) {
    const c = COUNTRIES[countryId];
    if (!c) return 'Неизвестный солдат';
    const n = c.names[Math.floor(Math.random() * c.names.length)];
    const s = c.surnames[Math.floor(Math.random() * c.surnames.length)];
    return `${n} ${s}`;
}
