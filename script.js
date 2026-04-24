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
    updateDisplay();
}

function deleteNumber() {
    if (currentInput.length === 1 || (currentInput.length === 2 && currentInput.startsWith('-'))) {
        currentInput = '0';
    } else {
        currentInput = currentInput.slice(0, -1);
    }
    updateDisplay();
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
    updateDisplay();
}

function setOperator(operator) {
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
