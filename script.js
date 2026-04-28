/**
 * 3D Print Cost Calculator — Frontend Application
 * VK Mini App with Flask backend integration
 * 
 * ✅ Fixed: Lazy 3D initialization (init only when container is visible)
 */

// ============================================================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ 3D
// ============================================================================
let viewerScene = null;
let viewerCamera = null;
let viewerRenderer = null;
let viewerControls = null;
let viewerMesh = null;
let viewerInitialized = false;

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ============================================================================

document.addEventListener('DOMContentLoaded', async function() {
    // Инициализация VK Bridge
    if (typeof vkBridge !== 'undefined') {
        try {
            await vkBridge.send('VKWebAppInit');
            console.log('✅ VK Bridge инициализирован');
        } catch (error) {
            console.warn('⚠️ Ошибка инициализации VK Bridge:', error);
        }
    }
    
    // ✅ НЕ инициализируем 3D здесь! Ждём пока контейнер не станет видимым.
    
    // Обработчик скриншота
    const screenshotBtn = document.getElementById('screenshot-btn');
    if (screenshotBtn) {
        screenshotBtn.addEventListener('click', () => {
            if (viewerInitialized && viewerRenderer) {
                takeScreenshot();
            }
        });
    }
    
    // Инициализация приложения
    initApp();
});

// ============================================================================
// 3D VIEWER (Ленивая инициализация)
// ============================================================================

function init3DViewer() {
    // Если уже создан — выходим
    if (viewerInitialized) return true;

    const container = document.getElementById('preview-container');
    if (!container) {
        console.error('❌ Контейнер 3D не найден');
        return false;
    }

    // ✅ ПРОВЕРКА: Контейнер должен быть видимым и иметь размеры
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
        console.warn('⚠️ Контейнер имеет размер 0. Невозможно инициализировать 3D.');
        show3DFallback('Ошибка отображения (размер 0)');
        return false;
    }

    // Проверка WebGL
    if (!window.WebGLRenderingContext) {
        show3DFallback('WebGL не поддерживается браузером');
        return false;
    }
    
    if (typeof THREE === 'undefined') {
        show3DFallback('Библиотека 3D не загружена');
        return false;
    }

    try {
        console.log('🚀 Создание 3D Viewer...', rect.width, 'x', rect.height);
        
        // Сцена
        viewerScene = new THREE.Scene();
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        viewerScene.background = new THREE.Color(isDark ? 0x1a1a1a : 0xf4f6f8);
        
        // Камера
        viewerCamera = new THREE.PerspectiveCamera(45, rect.width / rect.height, 0.1, 10000);
        viewerCamera.position.set(0, 0, 150);
        
        // Рендерер
        viewerRenderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            preserveDrawingBuffer: true,
            powerPreference: 'high-performance'
        });
        
        viewerRenderer.setSize(rect.width, rect.height);
        viewerRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        viewerRenderer.outputEncoding = THREE.sRGBEncoding;
        
        // Очистка и добавление
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
        container.appendChild(viewerRenderer.domElement);
        
        // Освещение
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(50, 50, 50);
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
        viewerScene.add(ambient, dirLight, hemiLight);
        
        // Сетка координат
        const grid = new THREE.GridHelper(200, 20, 
            isDark ? 0x555555 : 0x888888, 
            isDark ? 0x333333 : 0x444444);
        grid.position.y = -50;
        viewerScene.add(grid);
        
        // Оси координат
        const axes = new THREE.AxesHelper(50);
        axes.position.y = -50;
        viewerScene.add(axes);
        
        // Управление камерой
        if (typeof THREE.OrbitControls !== 'undefined') {
            viewerControls = new THREE.OrbitControls(viewerCamera, viewerRenderer.domElement);
            viewerControls.enableDamping = true;
            viewerControls.dampingFactor = 0.05;
            viewerControls.minDistance = 10;
            viewerControls.maxDistance = 2000;
            viewerControls.target.set(0, -20, 0);
        }
        
        // Анимация
        animate3D();
        
        // Ресайз
        window.addEventListener('resize', on3DResize);
        
        viewerInitialized = true;
        console.log('✅ 3D Viewer успешно инициализирован');
        return true;
        
    } catch (e) {
        console.error('❌ Ошибка инициализации 3D:', e);
        show3DFallback('Ошибка: ' + e.message);
        return false;
    }
}

function animate3D() {
    requestAnimationFrame(animate3D);
    if (viewerControls) viewerControls.update();
    if (viewerRenderer && viewerScene && viewerCamera) {
        try {
            viewerRenderer.render(viewerScene, viewerCamera);
        } catch (e) {
            console.error('❌ Ошибка рендеринга:', e);
        }
    }
}

function on3DResize() {
    if (!viewerInitialized || !viewerRenderer) return;
    const container = document.getElementById('preview-container');
    if (!container) return;
    
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    if (width > 0 && height > 0) {
        viewerCamera.aspect = width / height;
        viewerCamera.updateProjectionMatrix();
        viewerRenderer.setSize(width, height);
    }
}

function loadSTLToViewer(blob) {
    return new Promise((resolve, reject) => {
        if (!viewerInitialized || !viewerScene || typeof THREE.STLLoader === 'undefined') {
            reject(new Error('3D Viewer not initialized'));
            return;
        }
        
        // Очистка старой модели
        if (viewerMesh) {
            viewerScene.remove(viewerMesh);
            if (viewerMesh.geometry) viewerMesh.geometry.dispose();
            if (viewerMesh.material) viewerMesh.material.dispose();
            viewerMesh = null;
        }
        
        const loader = new THREE.STLLoader();
        const url = URL.createObjectURL(blob);
        
        loader.load(url, function(geometry) {
            URL.revokeObjectURL(url);
            
            if (!geometry || geometry.attributes.position.count === 0) {
                reject(new Error('Пустая геометрия'));
                return;
            }
            
            console.log('📐 Геометрия загружена:', geometry.attributes.position.count, 'вершин');
            
            geometry.computeVertexNormals();
            geometry.center();
            
            const material = new THREE.MeshStandardMaterial({
                color: 0x4a76a8,
                roughness: 0.4,
                metalness: 0.1,
                flatShading: false
            });
            
            viewerMesh = new THREE.Mesh(geometry, material);
            viewerScene.add(viewerMesh);
            
            fitCameraToObject(viewerMesh);
            resolve();
            
        }, undefined, function(error) {
            URL.revokeObjectURL(url);
            console.error('❌ Ошибка загрузки STL:', error);
            reject(error);
        });
    });
}

function fitCameraToObject(object) {
    if (!viewerCamera || !viewerControls) return;
    
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    const fov = viewerCamera.fov * (Math.PI / 180);
    const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
    
    viewerCamera.position.set(center.x, center.y, center.z + cameraZ);
    viewerCamera.lookAt(center);
    
    if (viewerControls) {
        viewerControls.target.copy(center);
        viewerControls.update();
    }
}

function takeScreenshot() {
    if (!viewerInitialized || !viewerRenderer || !viewerScene || !viewerCamera) {
        alert('❌ 3D-просмотр не инициализирован');
        return;
    }
    
    try {
        viewerRenderer.render(viewerScene, viewerCamera);
        
        const canvas = viewerRenderer.domElement;
        if (canvas.width === 0 || canvas.height === 0) {
            alert('❌ Canvas имеет нулевой размер');
            return;
        }
        
        const dataURL = canvas.toDataURL('image/png');
        
        if (!dataURL || dataURL.length < 100) {
            alert('❌ Не удалось создать скриншот');
            return;
        }
        
        const link = document.createElement('a');
        link.download = `3d-preview-${Date.now()}.png`;
        link.href = dataURL;
        link.click();
        
        console.log('📸 Скриншот сохранён');
        
    } catch (e) {
        console.error('❌ Ошибка скриншота:', e);
        alert('❌ Ошибка: ' + e.message);
    }
}

function show3DFallback(message) {
    const container = document.getElementById('preview-container');
    if (!container) return;
    
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    container.style.display = 'block';
    container.innerHTML = `
        <div style="
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: ${isDark ? '#1a1a1a' : '#f4f6f8'};
            color: ${isDark ? '#e1e3e6' : '#666'};
            font-size: 14px;
            text-align: center;
            padding: 20px;
            box-sizing: border-box;
        ">
            <div style="font-size: 48px; margin-bottom: 12px;">📐</div>
            <div style="font-weight: 600; margin-bottom: 8px;">3D-просмотр недоступен</div>
            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 12px;">${message}</div>
            <div style="font-size: 11px; opacity: 0.6;">
                Модель загружена и доступна для расчёта
            </div>
        </div>
    `;
    
    const screenshotBtn = document.getElementById('screenshot-btn');
    if (screenshotBtn) screenshotBtn.style.display = 'none';
    
    console.warn('⚠️ 3D Viewer fallback:', message);
}

function clear3DViewer() {
    if (viewerMesh && viewerScene) {
        viewerScene.remove(viewerMesh);
        if (viewerMesh.geometry) viewerMesh.geometry.dispose();
        if (viewerMesh.material) viewerMesh.material.dispose();
        viewerMesh = null;
    }
}

function destroy3DViewer() {
    window.removeEventListener('resize', on3DResize);
    clear3DViewer();
    if (viewerRenderer) {
        viewerRenderer.dispose();
        const container = document.getElementById('preview-container');
        if (container && container.contains(viewerRenderer.domElement)) {
            container.removeChild(viewerRenderer.domElement);
        }
    }
    viewerScene = null;
    viewerCamera = null;
    viewerRenderer = null;
    viewerControls = null;
    viewerInitialized = false;
}

// ============================================================================
// КОНСТАНТЫ И КОНФИГУРАЦИЯ
// ============================================================================

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

const API_BASE_URL = 'https://3dcalk.freedynamicdns.net:8443';

// ============================================================================
// РАБОТА С VK STORAGE
// ============================================================================

async function loadSettings() {
    try {
        const response = await vkBridge.send('VKWebAppStorageGet', { 
            keys: STORAGE_KEYS 
        });
        
        const settings = {};
        
        if (response.keys && Array.isArray(response.keys)) {
            response.keys.forEach(function(item) {
                if (item.key && item.value !== undefined && item.value !== null) {
                    const numericValue = parseFloat(item.value);
                    if (!isNaN(numericValue)) {
                        settings[item.key] = numericValue;
                    }
                }
            });
        }
        
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
        resetSettingsToDefault(false);
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
    
    const updates = Object.entries(settings).map(function(entry) {
        const key = entry[0];
        const value = entry[1];
        return { 
            key: key, 
            value: String(value)
        };
    });
    
    try {
        await vkBridge.send('VKWebAppStorageSet', { 
            updates: updates 
        });
        
        alert('✅ Настройки успешно сохранены в вашем аккаунте ВКонтакте!');
        console.log('✅ Настройки сохранены в VK Storage:', settings);
        
    } catch (error) {
        alert('❌ Не удалось сохранить настройки. Проверьте подключение к интернету.');
        console.error('❌ Ошибка VKWebAppStorageSet:', error);
    }
}

function resetSettingsToDefault(showAlert) {
    const defaults = {
        electricity_cost: 5.85,
        printer_power: 200,
        printer_cost: 80000,
        printer_lifetime: 48,
        printing_rate: 2
    };
    
    document.getElementById('electricity_cost').value = defaults.electricity_cost;
    document.getElementById('printer_power').value = defaults.printer_power;
    document.getElementById('printer_cost').value = defaults.printer_cost;
    document.getElementById('printer_lifetime').value = defaults.printer_lifetime;
    document.getElementById('printing_rate').value = defaults.printing_rate;
    
    if (showAlert !== false) {
        saveSettingsToStorage();
    }
}

// ============================================================================
// РАСЧЁТ СТОИМОСТИ ПЕЧАТИ
// ============================================================================

function calculateCost() {
    const weight = parseFloat(document.getElementById('weight').value);
    const material = document.getElementById('material').value;
    const timeHours = parseFloat(document.getElementById('time').value);
    const complexity = document.getElementById('complexity').value;
    const markupPercent = parseFloat(document.getElementById('markup').value);
    
    if (isNaN(weight) || weight <= 0) {
        alert('⚠️ Пожалуйста, введите корректный вес модели (больше 0 грамм)');
        document.getElementById('weight').focus();
        return;
    }
    
    if (isNaN(timeHours) || timeHours <= 0) {
        alert('⚠️ Пожалуйста, введите корректное время печати (больше 0 часов)');
        document.getElementById('time').focus();
        return;
    }
    
    if (isNaN(markupPercent) || markupPercent < 0) {
        alert('⚠️ Наценка должна быть неотрицательным числом');
        document.getElementById('markup').focus();
        return;
    }
    
    const electricityCost = parseFloat(document.getElementById('electricity_cost').value) || 5.85;
    const printerPower = parseFloat(document.getElementById('printer_power').value) || 200;
    const printerCost = parseFloat(document.getElementById('printer_cost').value) || 80000;
    const printerLifetimeMonths = parseFloat(document.getElementById('printer_lifetime').value) || 48;
    const printingRate = parseFloat(document.getElementById('printing_rate').value) || 2;
    
    const plasticPricePerKg = MATERIAL_PRICES[material];
    const plasticCost = (weight / 1000) * plasticPricePerKg;
    
    const printerPowerKw = printerPower / 1000;
    const electricityTotal = printerPowerKw * timeHours * electricityCost;
    
    const hoursPerMonth = 8 * 30;
    const totalLifetimeHours = printerLifetimeMonths * hoursPerMonth;
    const amortizationPerHour = printerCost / totalLifetimeHours;
    const amortizationCost = amortizationPerHour * timeHours;
    
    const laborCost = timeHours * printingRate;
    
    const complexityMultiplier = COMPLEXITY_MULTIPLIERS[complexity];
    const baseCost = plasticCost + electricityTotal + amortizationCost + laborCost;
    const complexityCost = baseCost * (complexityMultiplier - 1);
    
    const costPrice = baseCost + complexityCost;
    const markupAmount = costPrice * (markupPercent / 100);
    const totalCost = costPrice + markupAmount;
    
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
    
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = resultHTML;
    resultDiv.classList.remove('hidden');
    
    resultDiv.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
    });
    
    console.log('🧮 Расчёт завершён. Итоговая стоимость:', totalCost.toFixed(2), '₽');
}

// ============================================================================
// ЗАГРУЗКА И ОБРАБОТКА STL ФАЙЛОВ
// ============================================================================

async function uploadSTL(file) {
    const formData = new FormData();
    formData.append('stl_file', file);
    
    const statusDiv = document.getElementById('upload-status');
    
    if (statusDiv) {
        statusDiv.textContent = '⏳ Отправка файла на сервер...';
        statusDiv.style.color = '#6c757d';
    }
    
    // ✅ Показываем 3D-превью контейнер
    const previewContainer = document.getElementById('preview-container');
    const screenshotBtn = document.getElementById('screenshot-btn');
    
    if (previewContainer) {
        previewContainer.style.display = 'block';
        previewContainer.innerHTML = ''; // Очистка
    }
    
    // ✅ Небольшая задержка, чтобы браузер применил display:block
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // ✅ Инициализируем 3D (контейнер уже имеет размеры)
    const success = init3DViewer();
    
    if (success && viewerInitialized) {
        if (screenshotBtn) {
            screenshotBtn.style.display = 'block';
            screenshotBtn.disabled = true;
            screenshotBtn.textContent = '⏳ Рендеринг...';
        }
        
        // ✅ Рендерим локально (быстро)
        try {
            await loadSTLToViewer(file);
            if (screenshotBtn) {
                screenshotBtn.disabled = false;
                screenshotBtn.textContent = '📸 Сохранить скриншот';
            }
        } catch (e) {
            console.error('⚠️ 3D render error:', e);
            if (screenshotBtn) screenshotBtn.style.display = 'none';
        }
    } else {
        console.warn('⚠️ 3D Viewer не инициализирован');
        if (screenshotBtn) screenshotBtn.style.display = 'none';
    }
    
    try {
        const response = await fetch(API_BASE_URL + '/api/volume', {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text().catch(function() { return 'Unknown error'; });
            throw new Error('HTTP ' + response.status + ': ' + errorText);
        }
        
        const data = await response.json();
        
        if (data.volume && typeof data.volume === 'number' && data.volume > 0) {
            document.getElementById('weight').value = data.volume.toFixed(2);
            
            if (statusDiv) {
                statusDiv.textContent = '✅ Объём: ' + data.volume.toFixed(2) + ' см³. Значение подставлено в поле "Вес". Учтите плотность материала для точного расчёта веса.';
                statusDiv.style.color = '#4caf50';
            }
            
            console.log('✅ STL обработан. Объём:', data.volume, 'см³');
        } else {
            if (statusDiv) {
                statusDiv.textContent = '❌ Не удалось вычислить объём. Проверьте корректность STL файла.';
                statusDiv.style.color = '#f44336';
            }
            console.warn('⚠️ API вернул невалидный объём:', data);
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки STL:', error);
        
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
        if (previewContainer) previewContainer.style.display = 'none';
        if (screenshotBtn) screenshotBtn.style.display = 'none';
    }
}

// ============================================================================
// УПРАВЛЕНИЕ ВКЛАДКАМИ
// ============================================================================

function switchTab(tabId) {
    const calcTab = document.getElementById('calc-tab');
    const settingsTab = document.getElementById('settings-tab');
    
    if (calcTab && settingsTab) {
        calcTab.classList.toggle('hidden', tabId !== 'calc');
        settingsTab.classList.toggle('hidden', tabId !== 'settings');
    }
    
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(function(tab) {
        const isActive = tab.dataset.tab === tabId;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tab.setAttribute('tabindex', isActive ? '0' : '-1');
    });
    
    console.log('🔄 Вкладка переключена:', tabId);
}

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ============================================================================

function initApp() {
    console.log('🚀 Инициализация приложения 3D Calc...');
    
    loadSettings();
    
    const calcBtn = document.getElementById('calc-btn');
    if (calcBtn) {
        calcBtn.addEventListener('click', function(event) {
            event.preventDefault();
            calculateCost();
        });
    }
    
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
    
    const uploadBtn = document.getElementById('upload-stl-btn');
    const fileInput = document.getElementById('stl-file-input');
    
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', function(event) {
            event.preventDefault();
            fileInput.click();
        });
        
        fileInput.addEventListener('change', function(event) {
            const file = event.target.files && event.target.files[0];
            
            if (file) {
                const fileName = file.name.toLowerCase();
                if (fileName.endsWith('.stl')) {
                    uploadSTL(file);
                } else {
                    alert('⚠️ Пожалуйста, выберите файл с расширением .stl\n\nПоддерживается только формат STL (стереолитография).');
                    console.warn('⚠️ Пользователь выбрал неподдерживаемый файл:', file.name);
                }
            }
            
            event.target.value = '';
        });
    }
    
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(function(tab) {
        tab.addEventListener('click', function(event) {
            event.preventDefault();
            const tabId = this.dataset.tab;
            if (tabId) {
                switchTab(tabId);
            }
        });
        
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
    
    if (typeof vkBridge !== 'undefined') {
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
    const statusDiv = document.getElementById('upload-status');
    if (statusDiv) {
        statusDiv.textContent = '❌ Произошла ошибка в приложении';
        statusDiv.className = 'upload-status';
        statusDiv.style.color = '#f44336';
    }
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('🔴 Unhandled promise rejection:', event.reason);
});

// ✅ Очистка при выгрузке страницы
window.addEventListener('beforeunload', () => {
    destroy3DViewer();
});
