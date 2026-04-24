// Audio Context for sound effects
let audioCtx;
function playClickSound() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Resume context if it was suspended (autoplay policy)
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // 800Hz beep
        oscillator.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
        console.log("Audio play failed:", e);
    }
}

// State
let currentInput = '0';
let previousInput = '';
let currentOperator = null;
let shouldResetScreen = false;
let history = [];

// DOM Elements
const displayCurrent = document.getElementById('display-current');
const displayHistory = document.getElementById('display-history');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history');
const themeToggleBtn = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const historyPanel = document.querySelector('.history-panel');
const historyToggleBtn = document.getElementById('history-toggle');
const buttons = document.querySelectorAll('.btn');

// --- Sidebar & Converter Elements ---
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const menuToggleBtn = document.getElementById('menu-toggle');
const sidebarCloseBtn = document.getElementById('sidebar-close');
const menuItems = document.querySelectorAll('.menu-item');

const currentModeTitle = document.getElementById('current-mode-title');
const calcDisplay = document.getElementById('calc-display');
const convDisplay = document.getElementById('conv-display');
const keypad = document.querySelector('.keypad');

const convFromUnit = document.getElementById('conv-from-unit');
const convToUnit = document.getElementById('conv-to-unit');
const convFromValue = document.getElementById('conv-from-value');
const convToValue = document.getElementById('conv-to-value');
const convRateDisplay = document.getElementById('conv-rate-display');
const convFromSection = document.getElementById('conv-from-section');
const convToSection = document.getElementById('conv-to-section');

// --- Converter State ---
let currentMode = 'scientific'; // scientific, currency, time, length, weight
let activeConvSection = 'from';
let exchangeRates = {};

const units = {
    currency: ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'NZD'],
    time: ['Seconds', 'Minutes', 'Hours', 'Days', 'Weeks', 'Years'],
    length: ['Millimeters', 'Centimeters', 'Meters', 'Kilometers', 'Inches', 'Feet', 'Yards', 'Miles'],
    weight: ['Milligrams', 'Grams', 'Kilograms', 'Ounces', 'Pounds']
};

const conversionFactors = {
    time: { 'Seconds': 1, 'Minutes': 60, 'Hours': 3600, 'Days': 86400, 'Weeks': 604800, 'Years': 31536000 },
    length: { 'Meters': 1, 'Kilometers': 1000, 'Centimeters': 0.01, 'Millimeters': 0.001, 'Miles': 1609.344, 'Yards': 0.9144, 'Feet': 0.3048, 'Inches': 0.0254 },
    weight: { 'Grams': 1, 'Kilograms': 1000, 'Milligrams': 0.001, 'Pounds': 453.59237, 'Ounces': 28.34952 }
};

// --- Core Calculator Logic ---

function updateDisplay() {
    // Limit display length to avoid overflow
    let formattedInput = currentInput;
    if (formattedInput.length > 15) {
        formattedInput = formattedInput.substring(0, 15);
    }
    
    displayCurrent.textContent = formattedInput;
    
    if (currentOperator !== null) {
        displayHistory.textContent = `${previousInput} ${currentOperator}`;
    } else {
        displayHistory.textContent = '';
    }
}

function clear() {
    currentInput = '0';
    previousInput = '';
    currentOperator = null;
    shouldResetScreen = false;
    if (currentMode === 'scientific') updateDisplay();
    else updateConverter();
}

function deleteNumber() {
    if (currentInput.length === 1 || (currentInput.length === 2 && currentInput.startsWith('-'))) {
        currentInput = '0';
    } else {
        currentInput = currentInput.slice(0, -1);
    }
    if (currentMode === 'scientific') updateDisplay();
    else updateConverter();
}

function appendNumber(number) {
    if (currentInput === '0' && number !== '.') {
        currentInput = number;
    } else if (shouldResetScreen) {
        currentInput = number;
        shouldResetScreen = false;
    } else {
        // Prevent multiple decimals
        if (number === '.' && currentInput.includes('.')) return;
        currentInput += number;
    }
    if (currentMode === 'scientific') updateDisplay();
    else updateConverter();
}

function setOperator(operator) {
    if (currentMode !== 'scientific') return;
    if (currentOperator !== null) {
        evaluate();
    }
    previousInput = currentInput;
    currentOperator = operator;
    shouldResetScreen = true;
    updateDisplay();
}

function evaluate() {
    if (currentOperator === null || shouldResetScreen) return;
    
    let result;
    const prev = parseFloat(previousInput);
    const current = parseFloat(currentInput);
    
    if (isNaN(prev) || isNaN(current)) return;

    switch (currentOperator) {
        case '+':
            result = prev + current;
            break;
        case '-':
            result = prev - current;
            break;
        case '*':
            result = prev * current;
            break;
        case '/':
            if (current === 0) {
                alert("Cannot divide by zero!");
                clear();
                return;
            }
            result = prev / current;
            break;
        case '%':
            result = prev % current;
            break;
        case '**':
            result = prev ** current;
            break;
        default:
            return;
    }

    // Fix floating point precision issues
    result = Math.round(result * 100000000) / 100000000;
    
    // Add to history
    addToHistory(`${prev} ${currentOperator} ${current}`, result);

    currentInput = result.toString();
    currentOperator = null;
    shouldResetScreen = true;
    updateDisplay();
}

function evaluateFunc(funcName) {
    let current = parseFloat(currentInput);
    if (isNaN(current)) return;
    
    switch (funcName) {
        case 'square':
            currentInput = (current * current).toString();
            break;
        case 'reciprocal':
            if (current === 0) { alert("Cannot divide by zero!"); clear(); return; }
            currentInput = (1 / current).toString();
            break;
        case 'abs':
            currentInput = Math.abs(current).toString();
            break;
        case 'exp':
            currentInput = Math.exp(current).toString();
            break;
        case 'sqrt':
            if (current < 0) { alert("Invalid input!"); clear(); return; }
            currentInput = Math.sqrt(current).toString();
            break;
        case 'factorial':
            if (current < 0 || !Number.isInteger(current)) { alert("Invalid input!"); clear(); return; }
            let f = 1;
            for (let i = 2; i <= current; i++) f *= i;
            currentInput = f.toString();
            break;
        case 'ten_power':
            currentInput = (10 ** current).toString();
            break;
        case 'log':
            if (current <= 0) { alert("Invalid input!"); clear(); return; }
            currentInput = Math.log10(current).toString();
            break;
        case 'ln':
            if (current <= 0) { alert("Invalid input!"); clear(); return; }
            currentInput = Math.log(current).toString();
            break;
        case 'toggle_sign':
            currentInput = (current * -1).toString();
            break;
        case '2nd':
            // Toggle alternate functions if needed, ignoring for now
            return;
    }
    
    // Fix floating point precision
    currentInput = (Math.round(parseFloat(currentInput) * 100000000) / 100000000).toString();
    shouldResetScreen = true;
    updateDisplay();
}

function insertValue(val) {
    if (val === 'PI') {
        currentInput = Math.PI.toString();
    } else if (val === 'E') {
        currentInput = Math.E.toString();
    } else if (val === '(' || val === ')') {
        // Parentheses placeholder logic (requires full expression parser for real support)
        alert("Parentheses require an expression parser, which is beyond this basic state machine.");
        return;
    }
    shouldResetScreen = true;
    updateDisplay();
}

// --- Converter Logic ---

function updateConverter() {
    if (currentMode === 'scientific') return;
    
    const val = parseFloat(currentInput);
    const fromU = convFromUnit.value;
    const toU = convToUnit.value;
    
    if (isNaN(val)) {
        convFromValue.textContent = '0';
        convToValue.textContent = '0';
        return;
    }
    
    let result = 0;
    
    if (currentMode === 'currency') {
        if (exchangeRates[fromU] && exchangeRates[toU]) {
            const valInUSD = val / exchangeRates[fromU];
            result = valInUSD * exchangeRates[toU];
        }
    } else {
        const factors = conversionFactors[currentMode];
        if (factors && factors[fromU] && factors[toU]) {
            const baseVal = val * factors[fromU];
            result = baseVal / factors[toU];
        }
    }
    
    // Fix precision
    result = Math.round(result * 1000000) / 1000000;
    
    if (activeConvSection === 'from') {
        convFromValue.textContent = currentInput;
        convToValue.textContent = result.toString();
    } else {
        let invResult = 0;
        if (currentMode === 'currency') {
            if (exchangeRates[fromU] && exchangeRates[toU]) {
                const valInUSD = val / exchangeRates[toU];
                invResult = valInUSD * exchangeRates[fromU];
            }
        } else {
            const factors = conversionFactors[currentMode];
            if (factors && factors[fromU] && factors[toU]) {
                const baseVal = val * factors[toU];
                invResult = baseVal / factors[fromU];
            }
        }
        invResult = Math.round(invResult * 1000000) / 1000000;
        
        convToValue.textContent = currentInput;
        convFromValue.textContent = invResult.toString();
    }
}

convFromUnit.addEventListener('change', updateConverter);
convToUnit.addEventListener('change', updateConverter);

convFromSection.addEventListener('click', () => {
    activeConvSection = 'from';
    convFromSection.classList.add('active');
    convToSection.classList.remove('active');
    currentInput = convFromValue.textContent;
});

convToSection.addEventListener('click', () => {
    activeConvSection = 'to';
    convToSection.classList.add('active');
    convFromSection.classList.remove('active');
    currentInput = convToValue.textContent;
});

// --- Sidebar Logic ---

function openSidebar() {
    sidebar.classList.add('show');
    sidebarOverlay.classList.add('show');
}
function closeSidebar() {
    sidebar.classList.remove('show');
    sidebarOverlay.classList.remove('show');
}

menuToggleBtn.addEventListener('click', openSidebar);
sidebarCloseBtn.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

menuItems.forEach(item => {
    item.addEventListener('click', () => {
        const mode = item.getAttribute('data-mode');
        setMode(mode);
        
        menuItems.forEach(m => m.classList.remove('active'));
        item.classList.add('active');
        closeSidebar();
    });
});

async function setMode(mode) {
    currentMode = mode;
    currentModeTitle.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    
    if (mode === 'scientific') {
        calcDisplay.style.display = 'flex';
        convDisplay.style.display = 'none';
        keypad.classList.remove('converter-grid');
        keypad.classList.add('scientific-grid');
        clear();
    } else {
        calcDisplay.style.display = 'none';
        convDisplay.style.display = 'flex';
        keypad.classList.remove('scientific-grid');
        keypad.classList.add('converter-grid');
        
        if (mode === 'currency' && Object.keys(exchangeRates).length === 0) {
            convRateDisplay.textContent = 'Loading rates...';
            try {
                const res = await fetch('https://open.er-api.com/v6/latest/USD');
                const data = await res.json();
                exchangeRates = data.rates;
                convRateDisplay.textContent = 'Rates updated successfully.';
            } catch (err) {
                convRateDisplay.textContent = 'Failed to load rates.';
            }
        } else {
            convRateDisplay.textContent = '';
        }
        
        populateUnits(mode);
        activeConvSection = 'from';
        convFromSection.classList.add('active');
        convToSection.classList.remove('active');
        clear();
    }
}

function populateUnits(mode) {
    convFromUnit.innerHTML = '';
    convToUnit.innerHTML = '';
    
    units[mode].forEach(u => {
        const opt1 = document.createElement('option');
        opt1.value = u; opt1.textContent = u;
        const opt2 = document.createElement('option');
        opt2.value = u; opt2.textContent = u;
        
        convFromUnit.appendChild(opt1);
        convToUnit.appendChild(opt2);
    });
    
    if (units[mode].length > 1) {
        convToUnit.selectedIndex = 1;
    }
    updateConverter();
}

// --- History Logic ---

function addToHistory(expression, result) {
    history.unshift({ expression, result });
    if (history.length > 20) history.pop(); // Keep only last 20
    renderHistory();
}

function renderHistory() {
    historyList.innerHTML = '';
    history.forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.classList.add('history-item');
        historyItem.innerHTML = `
            <div class="history-expr">${item.expression} =</div>
            <div class="history-result">${item.result}</div>
        `;
        // Click on history item to load result
        historyItem.addEventListener('click', () => {
            currentInput = item.result.toString();
            updateDisplay();
        });
        historyList.appendChild(historyItem);
    });
}

clearHistoryBtn.addEventListener('click', () => {
    history = [];
    renderHistory();
});

historyToggleBtn.addEventListener('click', () => {
    historyPanel.classList.toggle('show');
});

// --- Theme Logic ---

function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    
    if (currentTheme === 'dark') {
        html.setAttribute('data-theme', 'light');
        themeIcon.textContent = 'dark_mode';
    } else {
        html.setAttribute('data-theme', 'dark');
        themeIcon.textContent = 'light_mode';
    }
}

themeToggleBtn.addEventListener('click', toggleTheme);

// --- Event Listeners for Buttons ---

buttons.forEach(button => {
    button.addEventListener('click', () => {
        playClickSound();
        
        // Add visual press effect for mouse clicks
        button.classList.add('pressed');
        setTimeout(() => button.classList.remove('pressed'), 100);

        if (button.classList.contains('btn-number')) {
            appendNumber(button.getAttribute('data-value'));
        } else if (button.classList.contains('btn-operator')) {
            setOperator(button.getAttribute('data-value'));
        } else if (button.classList.contains('btn-func')) {
            const action = button.getAttribute('data-action');
            if (action === 'func') {
                evaluateFunc(button.getAttribute('data-value'));
            } else if (action === 'insert') {
                insertValue(button.getAttribute('data-value'));
            }
        } else if (button.classList.contains('btn-action')) {
            const action = button.getAttribute('data-action');
            if (action === 'clear') clear();
            if (action === 'delete') deleteNumber();
        } else if (button.classList.contains('btn-equals')) {
            evaluate();
        }
    });
});

// --- Keyboard Support ---

document.addEventListener('keydown', (e) => {
    // Prevent default actions for calculator keys to avoid scrolling etc.
    if (['Enter', 'Backspace', 'Escape', '+', '-', '*', '/', '%'].includes(e.key) || 
       (e.key >= '0' && e.key <= '9') || e.key === '.') {
        
        // Don't prevent default if it's reload (ctrl+r/f5) etc
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
        }
    }

    playClickSound();

    if (e.key >= '0' && e.key <= '9') {
        appendNumber(e.key);
        triggerButtonPress(`[data-value="${e.key}"]`);
    } else if (e.key === '.') {
        appendNumber(e.key);
        triggerButtonPress(`[data-value="."]`);
    } else if (e.key === '=' || e.key === 'Enter') {
        evaluate();
        triggerButtonPress('.btn-equals');
    } else if (e.key === 'Backspace') {
        deleteNumber();
        triggerButtonPress(`[data-action="delete"]`);
    } else if (e.key === 'Escape' || e.key === 'Delete') {
        clear();
        triggerButtonPress(`[data-action="clear"]`);
    } else if (['+', '-', '*', '/', '%'].includes(e.key)) {
        setOperator(e.key);
        triggerButtonPress(`[data-value="${e.key}"]`);
    }
});

// Helper for keyboard visual feedback
function triggerButtonPress(selector) {
    const button = document.querySelector(selector);
    if (button) {
        button.classList.add('pressed');
        setTimeout(() => button.classList.remove('pressed'), 100);
    }
}

// Initialize
clear();
