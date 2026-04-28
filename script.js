/**
 * 3D Print Cost Calculator — Frontend Application
 * VK Mini App with Flask backend integration
 * 
 * ✅ Added: Three.js 3D preview with grid, axes, and screenshot
 */

// ============================================================================
// ИМПОРТЫ
// ============================================================================
import { STLViewer } from './stl-viewer.js';

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ============================================================================

document.addEventListener('DOMContentLoaded', async function() {
    // Проверяем наличие vkBridge и инициализируем
    if (typeof vkBridge !== 'undefined') {
        try {
            // Отправляем запрос на инициализацию VK Bridge
            await vkBridge.send('VKWebAppInit');
            console.log('✅ VK Bridge успешно инициализирован');
            
            // Настраиваем цветовую схему под тему пользователя
            vkBridge.send('VKWebAppGetClientVersion')
                .then(function(data) {
                    console.log('📱 VK App version:', data.platform, data.version);
                })
                .catch(function(e) {
                    console.log('ℹ️ Не удалось получить версию клиента:', e);
                });
        } catch (error) {
            console.warn('⚠️ Ошибка инициализации VK Bridge:', error);
            // Продолжаем работу даже если VK не инициализировался (для тестов вне VK)
        }
    } else {
        console.warn('⚠️ vkBridge не загружен — приложение запущено вне среды VK');
        console.log('💡 Для тестов откройте приложение через панель разработчика ВКонтакте');
    }
    
    // ✅ Инициализация 3D Viewer
    let viewer = null;
    try {
        viewer = new STLViewer('preview-container');
        console.log('✅ 3D Viewer инициализирован');
    } catch (e) {
        console.warn('⚠️ 3D Viewer не инициализирован:', e);
    }
    
    // ✅ Кнопка скриншота
    const screenshotBtn = document.getElementById('screenshot-btn');
    if (screenshotBtn && viewer) {
        screenshotBtn.addEventListener('click', () => {
            viewer.takeScreenshot();
        });
    }
    
    // Запускаем основную инициализацию приложения
    initApp();
});

// ============================================================================
// КОНСТАНТЫ И КОНФИГУРАЦИЯ
// ============================================================================

/**
 * Цены материалов за килограмм (в рублях)
 * @type {Object<string, number>}
 */
const MATERIAL_PRICES = {
    'PLA': 1200,    // Полилактид — самый популярный, экологичный
    'ABS': 1500,    // АБС-пластик — прочный, термостойкий
    'PETG': 1100,   // ПЭТ-Г — гибкий, пищевой, прозрачный
    'TPU': 2200,    // ТПУ — гибкий, резиноподобный
    'Nylon': 3000   // Нейлон — сверхпрочный, износостойкий
};

/**
 * Коэффициенты сложности печати
 * @type {Object<string, number>}
 */
const COMPLEXITY_MULTIPLIERS = {
    'low': 1.0,     // Простая модель без поддержек
    'medium': 1.3,  // Модель с поддержками, средняя детализация
    'high': 1.7     // Сложная техническая модель, много поддержек
};

/**
 * Ключи для хранения настроек в VK Storage
 * @type {string[]}
 */
const STORAGE_KEYS = [
    'electricity_cost',   // Стоимость электроэнергии (₽/кВт·ч)
    'printer_power',      // Мощность принтера (Вт)
    'printer_cost',       // Стоимость принтера (₽)
    'printer_lifetime',   // Срок службы принтера (месяцы)
    'printing_rate'       // Ставка оператора (₽/час)
];

/**
 * Базовый URL API бэкенда
 * ✅ Используем HTTPS + домен + порт для корректной работы в VK
 */
const API_BASE_URL = 'https://3dcalk.freedynamicdns.net:8443';

// ============================================================================
// DOM ЭЛЕМЕНТЫ
// ============================================================================

const elements = {
    weight: document.getElementById('weight'),
    material: document.getElementById('material'),
    time: document.getElementById('time'),
    complexity: document.getElementById('complexity'),
    markup: document.getElementById('markup'),
    calcBtn: document.getElementById('calc-btn'),
    result: document.getElementById('result'),
    uploadBtn: document.getElementById('upload-stl-btn'),
    fileInput: document.getElementById('stl-file-input'),
    uploadStatus: document.getElementById('upload-status'),
    previewContainer: document.getElementById('preview-container'),
    screenshotBtn: document.getElementById('screenshot-btn')
};

// Глобальные переменные
let viewer = null;
let currentBlobUrl = null;

// ============================================================================
// РАБОТА С VK STORAGE (через vkBridge)
// ============================================================================

/**
 * Загружает настройки пользователя из хранилища ВКонтакте
 * @async
 * @returns {Promise<void>}
 */
async function loadSettings() {
    try {
        // ✅ Правильный формат вызова через vkBridge
        const response = await vkBridge.send('VKWebAppStorageGet', { 
            keys: STORAGE_KEYS 
        });
        
        // Парсим полученные данные
        const settings = {};
        
        if (response.keys && Array.isArray(response.keys)) {
            response.keys.forEach(function(item) {
                if (item.key && item.value !== undefined && item.value !== null) {
                    // Преобразуем строковое значение в число
                    const numericValue = parseFloat(item.value);
                    if (!isNaN(numericValue)) {
                        settings[item.key] = numericValue;
                    }
                }
            });
        }
        
        // Заполняем поля формы сохранёнными значениями
        if (settings.electricity_cost !== undefined) {
            document.getElementById('electricity_cost').value = settings.electricity_cost;
        }
        if (settings.printer_power !== undefined) {
            document.getElementById('printer_power').value = settings.printer_power;
        }
        if (settings.printer_cost !== undefined) {
            document.getElementById('printer_cost').value = settings.printer_cost;
        }
        if (settings.printer_lifetime !== undefined) {
            document.getElementById('printer_lifetime').value = settings.printer_lifetime;
        }
        if (settings.printing_rate !== undefined) {
            document.getElementById('printing_rate').value = settings.printing_rate;
        }
        
        console.log('✅ Настройки загружены из VK Storage:', settings);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки настроек из VK Storage:', error);
        // При ошибке загружаем значения по умолчанию (без сохранения)
        resetSettingsToDefault(false);
    }
}

/**
 * Сохраняет текущие настройки в хранилище ВКонтакте
 * @async
 * @returns {Promise<void>}
 */
async function saveSettingsToStorage() {
    // Собираем текущие значения из полей формы
    const settings = {
        electricity_cost: document.getElementById('electricity_cost').value,
        printer_power: document.getElementById('printer_power').value,
        printer_cost: document.getElementById('printer_cost').value,
        printer_lifetime: document.getElementById('printer_lifetime').value,
        printing_rate: document.getElementById('printing_rate').value
    };
    
    // Формируем массив обновлений в формате VK Storage API
    const updates = Object.entries(settings).map(function(entry) {
        const key = entry[0];
        const value = entry[1];
        return { 
            key: key, 
            value: String(value) // VK Storage принимает только строки
        };
    });
    
    try {
        // Отправляем запрос на сохранение
        await vkBridge.send('VKWebAppStorageSet', { 
            updates: updates 
        });
        
        // Показываем пользователю успешное сохранение
        alert('✅ Настройки успешно сохранены в вашем аккаунте ВКонтакте!');
        console.log('✅ Настройки сохранены в VK Storage:', settings);
        
    } catch (error) {
        // Обрабатываем ошибку сохранения
        alert('❌ Не удалось сохранить настройки. Проверьте подключение к интернету.');
        console.error('❌ Ошибка VKWebAppStorageSet:', error);
    }
}

/**
 * Сбрасывает настройки к значениям по умолчанию
 * @param {boolean} showAlert - Показывать ли уведомление пользователю
 * @returns {void}
 */
function resetSettingsToDefault(showAlert) {
    // Значения по умолчанию (можно изменить под ваши нужды)
    const defaults = {
        electricity_cost: 5.85,   // Средний тариф в РФ
        printer_power: 200,       // Средняя мощность настольного принтера
        printer_cost: 80000,      // Стоимость принтера среднего класса
        printer_lifetime: 48,     // 4 года службы
        printing_rate: 2          // 2 рубля в минуту работы оператора
    };
    
    // Применяем значения к полям формы
    document.getElementById('electricity_cost').value = defaults.electricity_cost;
    document.getElementById('printer_power').value = defaults.printer_power;
    document.getElementById('printer_cost').value = defaults.printer_cost;
    document.getElementById('printer_lifetime').value = defaults.printer_lifetime;
    document.getElementById('printing_rate').value = defaults.printing_rate;
    
    // Если нужно — сохраняем в VK Storage
    if (showAlert !== false) {
        saveSettingsToStorage();
    }
}

// ============================================================================
// РАСЧЁТ СТОИМОСТИ ПЕЧАТИ
// ============================================================================

/**
 * Выполняет расчёт стоимости 3D печати по введённым параметрам
 * @returns {void}
 */
function calculateCost() {
    // Получаем и парсим входные данные от пользователя
    const weight = parseFloat(elements.weight?.value);
    const material = elements.material?.value;
    const timeHours = parseFloat(elements.time?.value);
    const complexity = elements.complexity?.value;
    const markupPercent = parseFloat(elements.markup?.value);
    
    // Валидация: проверяем корректность введённых данных
    if (isNaN(weight) || weight <= 0) {
        alert('⚠️ Пожалуйста, введите корректный вес модели (больше 0 грамм)');
        elements.weight?.focus();
        return;
    }
    
    if (isNaN(timeHours) || timeHours <= 0) {
        alert('⚠️ Пожалуйста, введите корректное время печати (больше 0 часов)');
        elements.time?.focus();
        return;
    }
    
    if (isNaN(markupPercent) || markupPercent < 0) {
        alert('⚠️ Наценка должна быть неотрицательным числом');
        elements.markup?.focus();
        return;
    }
    
    // Получаем настройки из полей формы (с дефолтными значениями)
    const electricityCost = parseFloat(document.getElementById('electricity_cost').value) || 5.85;
    const printerPower = parseFloat(document.getElementById('printer_power').value) || 200;
    const printerCost = parseFloat(document.getElementById('printer_cost').value) || 80000;
    const printerLifetimeMonths = parseFloat(document.getElementById('printer_lifetime').value) || 48;
    const printingRate = parseFloat(document.getElementById('printing_rate').value) || 2;
    
    // ------------------------------------------------------------------------
    // 1. Расчёт стоимости пластика
    // ------------------------------------------------------------------------
    const plasticPricePerKg = MATERIAL_PRICES[material];
    const plasticCost = (weight / 1000) * plasticPricePerKg;
    
    // ------------------------------------------------------------------------
    // 2. Расчёт стоимости электроэнергии
    // ------------------------------------------------------------------------
    const printerPowerKw = printerPower / 1000; // Переводим Вт → кВт
    const electricityTotal = printerPowerKw * timeHours * electricityCost;
    
    // ------------------------------------------------------------------------
    // 3. Расчёт амортизации оборудования
    // ------------------------------------------------------------------------
    // Предполагаем 8 часов работы в день, 30 дней в месяц
    const hoursPerMonth = 8 * 30;
    const totalLifetimeHours = printerLifetimeMonths * hoursPerMonth;
    const amortizationPerHour = printerCost / totalLifetimeHours;
    const amortizationCost = amortizationPerHour * timeHours;
    
    // ------------------------------------------------------------------------
    // 4. Расчёт трудозатрат оператора
    // ------------------------------------------------------------------------
    const laborCost = timeHours * printingRate;
    
    // ------------------------------------------------------------------------
    // 5. Учёт сложности модели
    // ------------------------------------------------------------------------
    const complexityMultiplier = COMPLEXITY_MULTIPLIERS[complexity];
    const baseCost = plasticCost + electricityTotal + amortizationCost + laborCost;
    const complexityCost = baseCost * (complexityMultiplier - 1);
    
    // ------------------------------------------------------------------------
    // 6. Финальный расчёт с наценкой
    // ------------------------------------------------------------------------
    const costPrice = baseCost + complexityCost;
    const markupAmount = costPrice * (markupPercent / 100);
    const totalCost = costPrice + markupAmount;
    
    // ------------------------------------------------------------------------
    // Формирование читаемого результата
    // ------------------------------------------------------------------------
    const complexityNames = {
        'low': 'Простая (без поддержек)',
        'medium': 'Средняя (с поддержками)',
        'high': 'Сложная (техническая)'
    };
    
    const resultHTML = [
        '<b>💰 ИТОГО: ' + totalCost.toFixed(1) + ' ₽</b>',
        '<hr>',
        '<b>📊 Параметры модели:</b>',
        '• Вес: ' + weight + ' г',
        '• Материал: ' + material,
        '• Время печати: ' + timeHours + ' ч',
        '• Сложность: ' + complexityNames[complexity],
        '• Наценка: ' + markupPercent + '%',
        '<hr>',
        '<b>⚙️ Детализация расходов:</b>',
        '• Пластик: ' + plasticCost.toFixed(1) + ' ₽',
        '• Электричество: ' + electricityTotal.toFixed(1) + ' ₽',
        '• Амортизация принтера: ' + amortizationCost.toFixed(1) + ' ₽',
        '• Трудозатраты оператора: ' + laborCost.toFixed(1) + ' ₽',
        '• Коэффициент сложности: +' + complexityCost.toFixed(1) + ' ₽',
        '• Ваша наценка: +' + markupAmount.toFixed(1) + ' ₽',
        '<hr>',
        '<i>💡 Расчёт выполнен с вашими настройками. Изменить параметры можно во вкладке «Настройки»</i>'
    ].join('\n');
    
    // Отображаем результат в интерфейсе
    if (elements.result) {
        elements.result.innerHTML = resultHTML;
        elements.result.classList.remove('hidden');
        
        // Плавная прокрутка к результату
        elements.result.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
    }
    
    // Логируем для отладки
    console.log('🧮 Расчёт завершён. Итоговая стоимость:', totalCost.toFixed(2), '₽');
}

// ============================================================================
// ЗАГРУЗКА И ОБРАБОТКА STL ФАЙЛОВ
// ============================================================================

/**
 * Загружает STL файл на сервер для автоматического определения объёма
 * И отображает 3D-превью
 * @param {File} file - Файл STL для загрузки
 * @async
 * @returns {Promise<void>}
 */
async function uploadSTL(file) {
    // Создаём FormData для отправки файла
    const formData = new FormData();
    formData.append('stl_file', file);
    
    // Получаем элемент для отображения статуса
    const statusDiv = elements.uploadStatus;
    
    // Показываем индикатор загрузки
    if (statusDiv) {
        statusDiv.textContent = '⏳ Отправка файла на сервер...';
        statusDiv.style.color = '#6c757d';
    }
    
    // ✅ Показываем 3D-превью контейнер
    if (elements.previewContainer) {
        elements.previewContainer.style.display = 'block';
    }
    if (elements.screenshotBtn) {
        elements.screenshotBtn.style.display = 'block';
        elements.screenshotBtn.disabled = true;
        elements.screenshotBtn.textContent = '⏳ Рендеринг...';
    }
    
    try {
        // ✅ Сначала рендерим локально (быстро, без ожидания сервера)
        if (viewer) {
            await viewer.loadFromBlob(file);
            if (elements.screenshotBtn) {
                elements.screenshotBtn.disabled = false;
                elements.screenshotBtn.textContent = '📸 Сохранить скриншот';
            }
        }
        
        // Затем отправляем на сервер для расчёта объёма
        const response = await fetch(API_BASE_URL + '/api/volume', {
            method: 'POST',
            body: formData,
            // Не устанавливаем Content-Type вручную — браузер сделает это сам для FormData
            headers: {
                'Accept': 'application/json'
            }
        });
        
        // Проверяем статус ответа
        if (!response.ok) {
            const errorText = await response.text().catch(function() { return 'Unknown error'; });
            throw new Error('HTTP ' + response.status + ': ' + errorText);
        }
        
        // Парсим JSON ответ
        const data = await response.json();
        
        // Обрабатываем успешный ответ
        if (data.volume && typeof data.volume === 'number' && data.volume > 0) {
            // Подставляем рассчитанный объём (в см³) в поле веса
            // Пользователь может скорректировать с учётом плотности материала
            if (elements.weight) {
                elements.weight.value = data.volume.toFixed(2);
            }
            
            if (statusDiv) {
                statusDiv.textContent = '✅ Объём: ' + data.volume.toFixed(2) + ' см³. Значение подставлено в поле "Вес". Учтите плотность материала для точного расчёта веса.';
                statusDiv.style.color = '#4caf50';
            }
            
            console.log('✅ STL обработан. Объём:', data.volume, 'см³');
        } else {
            // Объём не удалось вычислить
            if (statusDiv) {
                statusDiv.textContent = '❌ Не удалось вычислить объём. Проверьте корректность STL файла.';
                statusDiv.style.color = '#f44336';
            }
            console.warn('⚠️ API вернул невалидный объём:', data);
        }
        
    } catch (error) {
        // Обрабатываем ошибки сети или сервера
        console.error('❌ Ошибка загрузки STL:', error);
        
        // Показываем понятное сообщение пользователю
        if (statusDiv) {
            if (error.message && error.message.includes('Failed to fetch')) {
                statusDiv.textContent = '❌ Ошибка соединения с сервером. Проверьте интернет-подключение и настройки CORS.';
            } else if (error.message && error.message.includes('404')) {
                statusDiv.textContent = '❌ Сервер не найден. Проверьте адрес API в настройках приложения.';
            } else if (error.message && error.message.includes('413')) {
                statusDiv.textContent = '❌ Файл слишком большой. Максимальный размер: 50 МБ.';
            } else {
                statusDiv.textContent = '❌ Ошибка: ' + (error.message || 'Неизвестная ошибка');
            }
            statusDiv.style.color = '#f44336';
        }
        
        // Скрываем превью при ошибке
        if (elements.previewContainer) elements.previewContainer.style.display = 'none';
        if (elements.screenshotBtn) elements.screenshotBtn.style.display = 'none';
    }
}

// ============================================================================
// УПРАВЛЕНИЕ ВКЛАДКАМИ ИНТЕРФЕЙСА
// ============================================================================

/**
 * Переключает активную вкладку интерфейса
 * @param {string} tabId - Идентификатор вкладки: 'calc' или 'settings'
 * @returns {void}
 */
function switchTab(tabId) {
    // Скрываем/показываем контент вкладок
    const calcTab = document.getElementById('calc-tab');
    const settingsTab = document.getElementById('settings-tab');
    
    if (calcTab && settingsTab) {
        calcTab.classList.toggle('hidden', tabId !== 'calc');
        settingsTab.classList.toggle('hidden', tabId !== 'settings');
    }
    
    // Обновляем визуальное состояние кнопок вкладок
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(function(tab) {
        const isActive = tab.dataset.tab === tabId;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tab.setAttribute('tabindex', isActive ? '0' : '-1');
    });
    
    // Логируем переключение для аналитики
    console.log('🔄 Вкладка переключена:', tabId);
}

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ============================================================================

/**
 * Инициализирует обработчики событий и запускает приложение
 * @returns {void}
 */
function initApp() {
    console.log('🚀 Инициализация приложения 3D Calc...');
    
    // 1. Загружаем настройки пользователя
    loadSettings();
    
    // 2. Настраиваем кнопку расчёта стоимости
    if (elements.calcBtn) {
        elements.calcBtn.addEventListener('click', function(event) {
            event.preventDefault();
            calculateCost();
        });
    }
    
    // 3. Настраиваем кнопки настроек
    const saveBtn = document.getElementById('save-settings');
    if (saveBtn) {
        saveBtn.addEventListener('click', function(event) {
            event.preventDefault();
            saveSettingsToStorage();
        });
    }
    
    const resetBtn = document.getElementById('reset-settings');
    if (resetBtn) {
        resetBtn.addEventListener('click', function(event) {
            event.preventDefault();
            if (confirm('Сбросить все настройки к значениям по умолчанию?')) {
                resetSettingsToDefault(true);
            }
        });
    }
    
    // 4. Настраиваем загрузку STL файлов
    if (elements.uploadBtn && elements.fileInput) {
        // Клик по кнопке → триггерим скрытый input
        elements.uploadBtn.addEventListener('click', function(event) {
            event.preventDefault();
            elements.fileInput.click();
        });
        
        // Обработка выбора файла
        elements.fileInput.addEventListener('change', function(event) {
            const file = event.target.files && event.target.files[0];
            
            if (file) {
                // Проверяем расширение файла
                const fileName = file.name.toLowerCase();
                if (fileName.endsWith('.stl')) {
                    // Запускаем загрузку
                    uploadSTL(file);
                } else {
                    // Неподдерживаемый формат
                    alert('⚠️ Пожалуйста, выберите файл с расширением .stl\n\nПоддерживается только формат STL (стереолитография).');
                    console.warn('⚠️ Пользователь выбрал неподдерживаемый файл:', file.name);
                }
            }
            
            // Сбрасываем value input для возможности повторного выбора того же файла
            event.target.value = '';
        });
    }
    
    // 5. Настраиваем переключение вкладок
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(function(tab) {
        tab.addEventListener('click', function(event) {
            event.preventDefault();
            const tabId = this.dataset.tab;
            if (tabId) {
                switchTab(tabId);
            }
        });
        
        // Поддержка клавиатуры (доступность)
        tab.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                const tabId = this.dataset.tab;
                if (tabId) {
                    switchTab(tabId);
                }
            }
        });
    });
    
    // 6. Дополнительная инициализация для VK Environment
    if (typeof vkBridge !== 'undefined') {
        // Сообщаем ВКонтакте о готовности интерфейса
        vkBridge.send('VKWebAppSetViewSettings', {
            status_bar_style: 'light',
            action_bar_color: '#4a76a8'
        }).catch(function(e) {
            console.log('ℹ️ View settings not applied:', e);
        });
    }
    
    console.log('✅ Приложение 3D Calc полностью инициализировано');
}

// ============================================================================
// ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ И ОЧИСТКА
// ============================================================================

window.addEventListener('error', function(event) {
    console.error('🔴 Global error:', event.error);
    if (elements.uploadStatus) {
        elements.uploadStatus.textContent = '❌ Произошла ошибка в приложении';
        elements.uploadStatus.className = 'upload-status';
        elements.uploadStatus.style.color = '#f44336';
    }
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('🔴 Unhandled promise rejection:', event.reason);
});

// ✅ Очистка при выгрузке страницы (предотвращает утечки памяти)
window.addEventListener('beforeunload', () => {
    if (viewer) viewer.destroy();
    if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
});
