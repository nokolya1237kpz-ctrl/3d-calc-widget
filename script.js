// Инициализация VK Bridge (замените YOUR_APP_ID на реальный ID вашего приложения VK)
VK.init({ apiId: 54559933 });
VKWebAppInit().catch(e => console.error('Ошибка инициализации VK:', e));

// ---------- Константы ----------
const MATERIAL_PRICES = {
    'PLA': 1200,
    'ABS': 1500,
    'PETG': 1100,
    'TPU': 2200,
    'Nylon': 3000
};

const COMPLEXITY_MULTIPLIERS = {
    'low': 1.0,
    'medium': 1.3,
    'high': 1.7
};

const STORAGE_KEYS = [
    'electricity_cost',
    'printer_power',
    'printer_cost',
    'printer_lifetime',
    'printing_rate'
];

// URL вашего бэкенда (сервер с Flask)
const API_BASE_URL = 'http://194.87.201.19:5001'; // ЗАМЕНИТЕ НА РЕАЛЬНЫЙ АДРЕС

// ---------- Работа с VK Storage ----------
async function loadSettings() {
    try {
        const response = await VKWebAppStorageGet({ keys: STORAGE_KEYS });
        const settings = {};
        response.keys.forEach(item => {
            settings[item.key] = parseFloat(item.value);
        });
        if (settings.electricity_cost) document.getElementById('electricity_cost').value = settings.electricity_cost;
        if (settings.printer_power) document.getElementById('printer_power').value = settings.printer_power;
        if (settings.printer_cost) document.getElementById('printer_cost').value = settings.printer_cost;
        if (settings.printer_lifetime) document.getElementById('printer_lifetime').value = settings.printer_lifetime;
        if (settings.printing_rate) document.getElementById('printing_rate').value = settings.printing_rate;
    } catch (e) {
        console.error('Ошибка загрузки настроек:', e);
    }
}

async function saveSettingsToStorage() {
    const settings = {
        electricity_cost: document.getElementById('electricity_cost').value,
        printer_power: document.getElementById('printer_power').value,
        printer_cost: document.getElementById('printer_cost').value,
        printer_lifetime: document.getElementById('printer_lifetime').value,
        printing_rate: document.getElementById('printing_rate').value
    };
    const updates = Object.entries(settings).map(([key, value]) => ({ key, value: String(value) }));
    try {
        await VKWebAppStorageSet({ updates });
        alert('✅ Настройки сохранены!');
    } catch (e) {
        alert('❌ Ошибка сохранения настроек');
        console.error(e);
    }
}

function resetSettingsToDefault() {
    document.getElementById('electricity_cost').value = 5.85;
    document.getElementById('printer_power').value = 200;
    document.getElementById('printer_cost').value = 80000;
    document.getElementById('printer_lifetime').value = 48;
    document.getElementById('printing_rate').value = 2;
    saveSettingsToStorage();
}

// ---------- Расчёт стоимости ----------
function calculateCost() {
    const weight = parseFloat(document.getElementById('weight').value);
    const material = document.getElementById('material').value;
    const timeHours = parseFloat(document.getElementById('time').value);
    const complexity = document.getElementById('complexity').value;
    const markupPercent = parseFloat(document.getElementById('markup').value);
    
    if (isNaN(weight) || weight <= 0) {
        alert('Введите корректный вес (больше 0 грамм)');
        return;
    }
    if (isNaN(timeHours) || timeHours <= 0) {
        alert('Введите корректное время печати');
        return;
    }
    if (isNaN(markupPercent) || markupPercent < 0) {
        alert('Наценка должна быть неотрицательным числом');
        return;
    }
    
    const electricityCost = parseFloat(document.getElementById('electricity_cost').value);
    const printerPower = parseFloat(document.getElementById('printer_power').value);
    const printerCost = parseFloat(document.getElementById('printer_cost').value);
    const printerLifetimeMonths = parseFloat(document.getElementById('printer_lifetime').value);
    const printingRate = parseFloat(document.getElementById('printing_rate').value);
    
    // 1. Стоимость пластика
    const plasticPricePerKg = MATERIAL_PRICES[material];
    const plasticCost = (weight / 1000) * plasticPricePerKg;
    
    // 2. Электроэнергия
    const printerPowerKw = printerPower / 1000;
    const electricityTotal = printerPowerKw * timeHours * electricityCost;
    
    // 3. Амортизация (8 часов работы в день, 30 дней в месяц)
    const hoursPerMonth = 8 * 30;
    const amortizationPerHour = printerCost / (printerLifetimeMonths * hoursPerMonth);
    const amortizationCost = amortizationPerHour * timeHours;
    
    // 4. Трудозатраты
    const laborCost = timeHours * printingRate;
    
    // 5. Сложность
    const complexityMult = COMPLEXITY_MULTIPLIERS[complexity];
    const base = plasticCost + electricityTotal + amortizationCost + laborCost;
    const complexityCost = base * (complexityMult - 1);
    
    // 6. Себестоимость и наценка
    const costPrice = base + complexityCost;
    const markupAmount = costPrice * (markupPercent / 100);
    const totalCost = costPrice + markupAmount;
    
    const complexityName = {
        'low': 'Простая',
        'medium': 'Средняя',
        'high': 'Сложная'
    }[complexity];
    
    const resultHTML = `
        <b>💰 ИТОГО: ${totalCost.toFixed(1)} ₽</b>
        <hr>
        <b>📊 Параметры модели:</b>
        • Вес: ${weight} г
        • Материал: ${material}
        • Время печати: ${timeHours} ч
        • Сложность: ${complexityName}
        • Наценка: ${markupPercent}%
        <hr>
        <b>⚙️ Детализация:</b>
        • Пластик: ${plasticCost.toFixed(1)} ₽
        • Электричество: ${electricityTotal.toFixed(1)} ₽
        • Амортизация: ${amortizationCost.toFixed(1)} ₽
        • Трудозатраты: ${laborCost.toFixed(1)} ₽
        • Сложность: +${complexityCost.toFixed(1)} ₽
        • Наценка: +${markupAmount.toFixed(1)} ₽
        <hr>
        <i>Расчёт выполнен с вашими настройками (можно изменить во вкладке «Настройки»)</i>
    `;
    
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = resultHTML;
    resultDiv.classList.remove('hidden');
}

// ---------- Загрузка STL для определения объёма ----------
async function uploadSTL(file) {
    const formData = new FormData();
    formData.append('stl_file', file);
    const statusDiv = document.getElementById('upload-status');
    statusDiv.textContent = '⏳ Отправка файла на сервер...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/volume`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        
        const data = await response.json();
        if (data.volume && data.volume > 0) {
            // Подставляем объём (см³) в поле веса
            document.getElementById('weight').value = data.volume.toFixed(2);
            statusDiv.textContent = `✅ Объём: ${data.volume.toFixed(2)} см³. Значение подставлено в поле "Вес". Учтите плотность материала (для точного веса умножьте на плотность).`;
        } else {
            statusDiv.textContent = '❌ Не удалось вычислить объём.';
        }
    } catch (err) {
        console.error(err);
        statusDiv.textContent = '❌ Ошибка загрузки или обработки файла. Проверьте соединение с сервером.';
    }
}

// ---------- Управление вкладками ----------
function switchTab(tabId) {
    document.getElementById('calc-tab').classList.toggle('hidden', tabId !== 'calc');
    document.getElementById('settings-tab').classList.toggle('hidden', tabId !== 'settings');
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabId);
    });
}

// ---------- Инициализация приложения ----------
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    
    document.getElementById('calc-btn').addEventListener('click', calculateCost);
    document.getElementById('save-settings').addEventListener('click', saveSettingsToStorage);
    document.getElementById('reset-settings').addEventListener('click', resetSettingsToDefault);
    
    // Обработка загрузки STL
    document.getElementById('upload-stl-btn').addEventListener('click', () => {
        document.getElementById('stl-file-input').click();
    });
    document.getElementById('stl-file-input').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file && file.name.toLowerCase().endsWith('.stl')) {
            uploadSTL(file);
        } else if (file) {
            alert('Пожалуйста, выберите файл с расширением .stl');
        }
        event.target.value = ''; // Очищаем для повторной загрузки
    });
    
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
});
